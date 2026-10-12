import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { confirmedBookingEmail } from "./booking-email";
import type { PaidBooking } from "./booking-message";
import { sendEmail } from "./email";
import { logoUrl } from "./logos";
import { getMercadoPagoConfig, getPayment, MercadoPagoError, type MercadoPagoPayment } from "./mercadopago";
import { createAdminClient } from "./supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}

export type OnlineBooking = {
  id: string;
  status: "pending_payment" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired";
  holdExpiresAt: string | null;
  checkoutUrl: string | null;
  business: { id: string; slug: string; name: string; whatsappPhone: string | null; brandColor: string; logoUrl: string | null };
  paid: PaidBooking;
};

type BookingItem = { name: string };

// A booking with what its page, WhatsApp message and email show. Reads with the secret
// key: callers must only show it to someone who holds the booking's id (its link).
export async function getOnlineBooking(admin: SupabaseClient, bookingId: string): Promise<OnlineBooking | null> {
  if (!isUuid(bookingId)) return null;
  const { data: row, error } = await admin
    .from("bookings")
    .select(
      "id, business_id, folio, status, service_date, time_slot_id, time_slot_name, hold_expires_at, checkout_url, customer_name, customer_phone, customer_email, address, address_references, zone_name, vehicle_type_name, items, total_cents, deposit_cents, balance_cents",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const [business, slot] = await Promise.all([
    admin
      .from("businesses")
      .select("id, slug, name, whatsapp_phone, brand_color, logo_path")
      .eq("id", row.business_id)
      .single(),
    admin
      .from("time_slots")
      .select("start_time, end_time")
      .eq("business_id", row.business_id)
      .eq("id", row.time_slot_id)
      .maybeSingle(),
  ]);
  if (business.error) throw business.error;
  if (slot.error) throw slot.error;

  return {
    id: row.id,
    status: row.status,
    holdExpiresAt: row.hold_expires_at,
    checkoutUrl: row.checkout_url,
    business: {
      id: business.data.id,
      slug: business.data.slug,
      name: business.data.name,
      whatsappPhone: business.data.whatsapp_phone,
      brandColor: business.data.brand_color,
      logoUrl: logoUrl(business.data.logo_path),
    },
    paid: {
      businessName: business.data.name,
      folio: row.folio,
      serviceDate: row.service_date,
      slot: { name: row.time_slot_name, startTime: slot.data?.start_time ?? null, endTime: slot.data?.end_time ?? null },
      address: row.address,
      references: row.address_references,
      zoneName: row.zone_name,
      vehicleName: row.vehicle_type_name,
      services: (row.items as BookingItem[]).map((item) => item.name),
      customer: { name: row.customer_name, phone: row.customer_phone, email: row.customer_email },
      totalCents: row.total_cents,
      paidCents: row.deposit_cents,
      balanceCents: row.balance_cents,
    },
  };
}

// Asks Mercado Pago about a payment and records it; an approved payment confirms its
// booking (see record_mercadopago_payment). Safe to call many times for the same payment.
// Returns the booking's status afterwards, or null when the payment isn't for one of our
// bookings.
export async function syncMercadoPagoPayment(
  paymentId: string,
): Promise<{ bookingId: string; bookingStatus: OnlineBooking["status"] } | null> {
  const config = getMercadoPagoConfig();
  const admin = createAdminClient();
  if (!config || !admin) throw new Error("Mercado Pago or the Supabase secret key is not configured");

  let payment: MercadoPagoPayment;
  try {
    payment = await getPayment(config, paymentId);
  } catch (error) {
    // Mercado Pago doesn't know it (e.g. their "simulate notification" test): nothing to do.
    if (error instanceof MercadoPagoError && error.status === 404) return null;
    throw error;
  }
  const bookingId = payment.external_reference;
  if (!isUuid(bookingId)) return null;

  const { data, error } = await admin.rpc("record_mercadopago_payment", {
    p_booking_id: bookingId,
    p_payment_id: payment.id,
    p_status: payment.status,
    p_status_detail: payment.status_detail ?? null,
    p_amount_cents: Math.round(payment.transaction_amount * 100),
    p_currency: payment.currency_id,
    p_approved_at: payment.date_approved ?? null,
  });
  if (error?.code === "P0002") return null; // not one of our bookings
  if (error) throw error;
  const [result] = data as { confirmed_now: boolean; booking_status: OnlineBooking["status"] }[];

  // Only the call that confirmed the booking emails the business, after answering.
  if (result.confirmed_now) after(() => emailBusiness(bookingId));
  return { bookingId, bookingStatus: result.booking_status };
}

async function emailBusiness(bookingId: string) {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    const booking = await getOnlineBooking(admin, bookingId);
    if (!booking) return;
    const { data: members, error } = await admin
      .from("business_members")
      .select("user_id")
      .eq("business_id", booking.business.id);
    if (error) throw error;
    const users = await Promise.all((members ?? []).map((member) => admin.auth.admin.getUserById(member.user_id)));
    const emails = users.flatMap((result) => (result.data.user?.email ? [result.data.user.email] : []));
    await sendEmail(emails, confirmedBookingEmail(booking.paid));
  } catch (error) {
    console.error("Could not email the business about booking", bookingId, error);
  }
}
