"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { isSlotBookable, type SlotRule } from "@/lib/availability";
import { getBookingData, depositLabel, type BookingData } from "@/lib/booking-data";
import { bookingRequestSchema, type BookingRequest } from "@/lib/booking-request";
import { formatLongDate, todayInMexico } from "@/lib/dates";
import { getSupabaseSecretKey } from "@/lib/env";
import { createCheckout, getMercadoPagoConfig } from "@/lib/mercadopago";
import { formatMXN } from "@/lib/money";
import { emailBusiness } from "@/lib/online-bookings";
import { firstError } from "@/lib/panel/schemas";
import { amountDueNow, paymentChoices, PAYMENT_OPTIONS, type PaymentChoice } from "@/lib/payment-options";
import { calculateQuote, type Quote } from "@/lib/quote";
import { quoteRequestMessage } from "@/lib/quote-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { whatsAppLink } from "@/lib/whatsapp";

export type QuoteSummary = {
  quote: Quote;
  dateLabel: string;
  slot: { name: string; startTime: string; endTime: string };
  depositLabel: string;
  customer: { name: string; phone: string; address: string; references: string; email: string | null };
  whatsappUrl: string | null;
  // The customer can book here and pay cash on the day (the server can save bookings).
  bookOnline: boolean;
  // Mercado Pago is set up: the customer can also pay by card or transfer here.
  payOnline: boolean;
  choices: PaymentChoice[];
};

export type PrepareQuoteResult = { ok: true; summary: QuoteSummary } | { ok: false; message: string };

const QUOTE_ERRORS = {
  vehicle: "Ese vehículo ya no está disponible. Elige otro.",
  base_service: "Ese servicio ya no está disponible para tu vehículo. Elige otro.",
  extra_service: "Uno de los extras ya no está disponible para tu vehículo. Quítalo e intenta de nuevo.",
  zone: "Esa colonia ya no está en la lista. Elige otra o pregúntanos por WhatsApp.",
} as const;

const SLOT_GONE = "Ese horario ya no está disponible. Elige otro, por favor.";

type CheckedRequest =
  | {
      ok: true;
      input: z.output<typeof bookingRequestSchema>;
      data: BookingData;
      quote: Quote;
      slot: SlotRule;
    }
  | { ok: false; message: string };

// Prices come from the database and the slot is checked again, so nothing the browser
// sends can change an amount.
async function checkRequest(request: BookingRequest, now: Date): Promise<CheckedRequest> {
  const parsed = bookingRequestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const input = parsed.data;

  const supabase = createPublicClient();
  if (!supabase) return { ok: false, message: "Estamos en mantenimiento. Intenta en unos minutos." };

  const data = await getBookingData(supabase, input.slug, now);
  if (!data) return { ok: false, message: "Este negocio ya no está disponible." };

  const result = calculateQuote(data.catalog, {
    vehicleTypeId: input.vehicleTypeId,
    baseServiceId: input.baseServiceId,
    extraServiceIds: input.extraServiceIds,
    zoneId: input.zoneId,
  });
  if (!result.ok) return { ok: false, message: QUOTE_ERRORS[result.error] };

  const slot = data.slots.find((item) => item.id === input.timeSlotId);
  const available =
    slot &&
    isSlotBookable({
      date: input.date,
      slotId: input.timeSlotId,
      slots: data.slots,
      usage: data.usage,
      rules: data.rules,
      now,
      unitsNeeded: result.quote.capacityUnits,
    });
  if (!slot || !available) return { ok: false, message: SLOT_GONE };

  return { ok: true, input, data, quote: result.quote, slot };
}

// Builds the official summary on the server.
export async function prepareQuote(request: BookingRequest): Promise<PrepareQuoteResult> {
  const checked = await checkRequest(request, new Date());
  if (!checked.ok) return checked;
  const { input, data, quote, slot } = checked;

  const summary: Omit<QuoteSummary, "whatsappUrl"> = {
    quote,
    dateLabel: formatLongDate(input.date),
    slot: { name: slot.name, startTime: slot.startTime, endTime: slot.endTime },
    depositLabel: depositLabel(data.catalog.deposit, formatMXN),
    customer: input.customer,
    bookOnline: createAdminClient() !== null && getSupabaseSecretKey() !== null,
    payOnline: getMercadoPagoConfig() !== null && createAdminClient() !== null,
    choices: paymentChoices(quote),
  };
  const message = quoteRequestMessage({
    businessName: data.business.name,
    quote,
    date: input.date,
    slot: summary.slot,
    customer: input.customer,
    depositLabel: summary.depositLabel,
  });

  return { ok: true, summary: { ...summary, whatsappUrl: whatsAppLink(data.business.whatsappPhone, message) } };
}

const checkoutChoiceSchema = z.object({
  option: z.enum(PAYMENT_OPTIONS, { error: "Elige cuánto quieres pagar." }),
  acceptTerms: z.literal(true, { error: "Acepta la política de cancelación y el aviso de privacidad para continuar." }),
});

export type CheckoutChoice = z.input<typeof checkoutChoiceSchema>;

export type StartCheckoutResult = { ok: true; checkoutUrl: string } | { ok: false; message: string };

// Payments started per IP before we ask the customer to wait (spam protection).
const ATTEMPTS_PER_IP = 10;
const ATTEMPTS_WINDOW_MINUTES = 60;

async function requestOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = list.get("x-forwarded-proto")?.split(",")[0]?.trim() || (local ? "http" : "https");
  return `${proto}://${host}`;
}

const termsSchema = z.object({
  acceptTerms: z.literal(true, { error: "Acepta la política de cancelación y el aviso de privacidad para continuar." }),
});

export type BookCashResult = { ok: true; bookingUrl: string } | { ok: false; message: string };

// Upcoming bookings one phone can hold, so nobody fills the agenda with fake bookings.
const BOOKINGS_PER_PHONE = 3;

// Keyed hash of the visitor's IP: enough to count attempts without storing the IP itself.
async function ipHash(key: string): Promise<string> {
  const list = await headers();
  const ip = list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown";
  return createHmac("sha256", key).update(ip).digest("hex");
}

// Holds the places for 30 minutes and opens Mercado Pago's checkout for the deposit or
// the whole total. Returns the link the browser goes to.
export async function startCheckout(request: BookingRequest, choice: CheckoutChoice): Promise<StartCheckoutResult> {
  const parsedChoice = checkoutChoiceSchema.safeParse(choice);
  if (!parsedChoice.success) return { ok: false, message: firstError(parsedChoice.error) };

  const config = getMercadoPagoConfig();
  const admin = createAdminClient();
  const secretKey = getSupabaseSecretKey();
  if (!config || !admin || !secretKey) {
    return { ok: false, message: "Por ahora no podemos cobrar en línea. Envíanos tu pedido por WhatsApp." };
  }

  const now = new Date();
  const checked = await checkRequest(request, now);
  if (!checked.ok) return checked;
  const { input, data, quote, slot } = checked;

  const amountCents = amountDueNow(quote, parsedChoice.data.option);
  if (amountCents === null || amountCents < 100) {
    return { ok: false, message: "Elige cuánto quieres pagar." };
  }

  const { data: allowed, error: attemptError } = await admin.rpc("register_booking_attempt", {
    p_ip_hash: await ipHash(secretKey),
    p_limit: ATTEMPTS_PER_IP,
    p_window_minutes: ATTEMPTS_WINDOW_MINUTES,
  });
  if (attemptError) throw attemptError;
  if (allowed !== true) {
    return { ok: false, message: "Hiciste muchos intentos. Espera un rato o escríbenos por WhatsApp." };
  }

  const { data: created, error: createError } = await admin.rpc("create_online_booking", {
    p_booking: {
      business_id: data.business.id,
      service_date: input.date,
      time_slot_id: slot.id,
      vehicle_type_id: quote.vehicle.id,
      zone_id: quote.zone?.id ?? null,
      capacity_units: quote.capacityUnits,
      customer_name: input.customer.name,
      customer_phone: input.customer.phone,
      customer_email: input.customer.email,
      address: input.customer.address,
      address_references: input.customer.references,
      vehicle_type_name: quote.vehicle.name,
      zone_name: quote.zone?.name ?? null,
      time_slot_name: slot.name,
      items: quote.lines.map((line) => ({
        service_id: line.serviceId,
        name: line.name,
        kind: line.kind,
        price_cents: line.priceCents,
      })),
      subtotal_cents: quote.subtotalCents,
      surcharge_cents: quote.surchargeCents,
      total_cents: quote.totalCents,
      deposit_cents: amountCents,
    },
  });
  if (createError) throw createError;
  const booking = (created as { booking_id: string; booking_folio: string }[] | null)?.[0];
  if (!booking) return { ok: false, message: SLOT_GONE };

  const service = quote.lines.find((line) => line.kind === "base")?.name ?? "Servicio";
  const label = parsedChoice.data.option === "full" ? "Pago completo" : "Anticipo";
  try {
    const { checkoutUrl } = await createCheckout(config, {
      bookingId: booking.booking_id,
      folio: booking.booking_folio,
      title: `${label} · ${service} (${booking.booking_folio})`,
      amountCents,
      payerEmail: input.customer.email,
      returnUrl: `${await requestOrigin()}/${data.business.slug}/reserva/${booking.booking_id}`,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
      now,
    });
    const { error } = await admin.from("bookings").update({ checkout_url: checkoutUrl }).eq("id", booking.booking_id);
    if (error) throw error;
    return { ok: true, checkoutUrl };
  } catch (error) {
    console.error("Could not open Mercado Pago for booking", booking.booking_id, error);
    // Give the places back right away.
    await admin.from("bookings").update({ status: "expired" }).eq("id", booking.booking_id).eq("status", "pending_payment");
    return { ok: false, message: "No pudimos abrir Mercado Pago. Intenta de nuevo en unos minutos." };
  }
}

// Books the slot right away to pay cash on the day: the booking is confirmed and shows up
// in the business's agenda, and the business gets an email. Same checks as paying online.
export async function bookWithCash(request: BookingRequest, choice: { acceptTerms: boolean }): Promise<BookCashResult> {
  const parsedChoice = termsSchema.safeParse(choice);
  if (!parsedChoice.success) return { ok: false, message: firstError(parsedChoice.error) };

  const admin = createAdminClient();
  const secretKey = getSupabaseSecretKey();
  if (!admin || !secretKey) {
    return { ok: false, message: "Por ahora no podemos apartar aquí. Envíanos tu pedido por WhatsApp." };
  }

  const now = new Date();
  const checked = await checkRequest(request, now);
  if (!checked.ok) return checked;
  const { input, data, quote, slot } = checked;

  const { data: allowed, error: attemptError } = await admin.rpc("register_booking_attempt", {
    p_ip_hash: await ipHash(secretKey),
    p_limit: ATTEMPTS_PER_IP,
    p_window_minutes: ATTEMPTS_WINDOW_MINUTES,
  });
  if (attemptError) throw attemptError;
  if (allowed !== true) {
    return { ok: false, message: "Hiciste muchos intentos. Espera un rato o escríbenos por WhatsApp." };
  }

  const { count, error: countError } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("business_id", data.business.id)
    .eq("customer_phone", input.customer.phone)
    .eq("status", "confirmed")
    .gte("service_date", todayInMexico(now));
  if (countError) throw countError;
  if ((count ?? 0) >= BOOKINGS_PER_PHONE) {
    return { ok: false, message: "Ya tienes varias reservas apartadas. Escríbenos por WhatsApp para agendar otra." };
  }

  const { data: created, error: createError } = await admin.rpc("create_cash_booking", {
    p_booking: {
      business_id: data.business.id,
      service_date: input.date,
      time_slot_id: slot.id,
      vehicle_type_id: quote.vehicle.id,
      zone_id: quote.zone?.id ?? null,
      capacity_units: quote.capacityUnits,
      customer_name: input.customer.name,
      customer_phone: input.customer.phone,
      customer_email: input.customer.email,
      address: input.customer.address,
      address_references: input.customer.references,
      vehicle_type_name: quote.vehicle.name,
      zone_name: quote.zone?.name ?? null,
      items: quote.lines.map((line) => ({
        service_id: line.serviceId,
        name: line.name,
        kind: line.kind,
        price_cents: line.priceCents,
      })),
      subtotal_cents: quote.subtotalCents,
      surcharge_cents: quote.surchargeCents,
      total_cents: quote.totalCents,
    },
  });
  if (createError) throw createError;
  const booking = (created as { booking_id: string; booking_folio: string }[] | null)?.[0];
  if (!booking) return { ok: false, message: SLOT_GONE };

  after(() => emailBusiness(booking.booking_id));
  return { ok: true, bookingUrl: `/${data.business.slug}/reserva/${booking.booking_id}` };
}
