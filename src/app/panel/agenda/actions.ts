"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canChangeStatus, isBookingStatus, takesPlace, type BookingStatus } from "@/lib/agenda";
import type { PlaceUsage, SlotRule } from "@/lib/availability";
import { getBookingData } from "@/lib/booking-data";
import { formatLongDate, isoWeekday, todayInMexico } from "@/lib/dates";
import { dbFailure, failure, isUuid, success, type ActionState } from "@/lib/panel/action-state";
import { bookingNotesSchema, firstError, manualBookingSchema } from "@/lib/panel/schemas";
import { requirePanelBusiness } from "@/lib/panel/session";
import { calculateQuote } from "@/lib/quote";

const NOT_FOUND = "No se encontró la reserva.";
const CHANGED = "Esta reserva ya cambió. Recarga la página.";

const STATUS_DONE: Partial<Record<BookingStatus, string>> = {
  completed: "Listo, quedó como terminada.",
  no_show: "Quedó como 'no llegó'.",
  cancelled: "Reserva cancelada. Su lugar quedó libre.",
  confirmed: "Listo, regresó a confirmada.",
};

const isDate = (value: unknown): value is string => z.iso.date().safeParse(value).success;

// Terminada, no llegó, cancelada, or back to confirmed after a wrong tap.
export async function changeBookingStatus(bookingId: string, to: string): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  if (!isUuid(bookingId) || !isBookingStatus(to)) return failure(NOT_FOUND);

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("status")
    .eq("id", bookingId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (error) return dbFailure(error);
  if (!booking || !isBookingStatus(booking.status)) return failure(NOT_FOUND);
  if (!canChangeStatus(booking.status, to)) return failure(CHANGED);

  // Only if nobody changed it in the meantime.
  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({ status: to })
    .eq("id", bookingId)
    .eq("business_id", business.id)
    .eq("status", booking.status)
    .select("id");
  if (updateError) return dbFailure(updateError);
  if (!updated?.length) return failure(CHANGED);

  refresh();
  return success(STATUS_DONE[to]);
}

// The customer paid what was left (cash or transfer on the day), or undo it.
export async function setBalancePaid(bookingId: string, paid: boolean): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  if (!isUuid(bookingId) || typeof paid !== "boolean") return failure(NOT_FOUND);

  const { data: updated, error } = await supabase
    .from("bookings")
    .update({ balance_paid_at: paid ? new Date().toISOString() : null })
    .eq("id", bookingId)
    .eq("business_id", business.id)
    .in("status", ["confirmed", "completed"])
    .select("id");
  if (error) return dbFailure(error);
  if (!updated?.length) return failure(CHANGED);

  refresh();
  return success(paid ? "Saldo pagado." : "Saldo pendiente otra vez.");
}

export async function saveBookingNotes(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  const parsed = bookingNotesSchema.safeParse({ id: formData.get("id"), notes: formData.get("notes") });
  if (!parsed.success) return failure(firstError(parsed.error));

  const { data: updated, error } = await supabase
    .from("bookings")
    .update({ notes: parsed.data.notes })
    .eq("id", parsed.data.id)
    .eq("business_id", business.id)
    .select("id");
  if (error) return dbFailure(error);
  if (!updated?.length) return failure(NOT_FOUND);

  refresh();
  return success("Notas guardadas.");
}

export type DaySlots =
  | {
      ok: true;
      date: string;
      working: boolean;
      blockedReason: string | null;
      slots: SlotRule[];
      // Places taken that day (the booking being moved doesn't count).
      usage: PlaceUsage[];
    }
  | { ok: false; message: string };

// The time slots of a day and their taken places, for moving a booking or adding one by
// hand. The picker works out the free times with the same rules as the booking page.
export async function getDaySlots(date: string, exceptBookingId: string | null = null): Promise<DaySlots> {
  const { supabase, business } = await requirePanelBusiness();
  if (!isDate(date)) return { ok: false, message: "Elige un día." };
  if (exceptBookingId !== null && !isUuid(exceptBookingId)) return { ok: false, message: NOT_FOUND };

  const [settings, slots, blocked, bookings] = await Promise.all([
    supabase.from("businesses").select("working_days").eq("id", business.id).single(),
    supabase
      .from("time_slots")
      .select("id, name, start_time, end_time, capacity")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort_order")
      .order("start_time"),
    supabase.from("blocked_dates").select("reason").eq("business_id", business.id).eq("date", date).maybeSingle(),
    supabase
      .from("bookings")
      .select("id, time_slot_id, start_place, capacity_units, status, hold_expires_at")
      .eq("business_id", business.id)
      .eq("service_date", date),
  ]);
  for (const result of [settings, slots, blocked, bookings]) {
    if (result.error) throw result.error;
  }

  const now = new Date();
  return {
    ok: true,
    date,
    working: (settings.data?.working_days ?? []).includes(isoWeekday(date)),
    blockedReason: blocked.data ? blocked.data.reason || "Bloqueado" : null,
    slots: (slots.data ?? []).map((slot) => ({
      id: slot.id,
      name: slot.name,
      startTime: slot.start_time,
      endTime: slot.end_time,
      capacity: slot.capacity,
    })),
    usage: (bookings.data ?? []).flatMap((row) =>
      row.id !== exceptBookingId &&
      isBookingStatus(row.status) &&
      takesPlace({ status: row.status, holdExpiresAt: row.hold_expires_at }, now)
        ? [{ date, timeSlotId: row.time_slot_id, startPlace: row.start_place, units: row.capacity_units }]
        : [],
    ),
  };
}

const placeSchema = z.number().int().min(0).max(99);

// Another day and time, if there's room there (checked by the database, which locks the
// slot so nobody takes the last place at the same time).
export async function rescheduleBooking(
  bookingId: string,
  date: string,
  timeSlotId: string,
  startPlace: number,
): Promise<ActionState> {
  const { supabase } = await requirePanelBusiness();
  if (!isUuid(bookingId) || !isUuid(timeSlotId) || !isDate(date) || !placeSchema.safeParse(startPlace).success) {
    return failure("Elige el día y la hora.");
  }
  if (date < todayInMexico()) return failure("Elige un día de hoy en adelante.");

  const { data, error } = await supabase.rpc("reschedule_booking", {
    p_booking_id: bookingId,
    p_date: date,
    p_slot_id: timeSlotId,
    p_start_place: startPlace,
  });
  if (error) return dbFailure(error);
  switch (data) {
    case "moved":
      refresh();
      return success(`Listo, quedó para el ${formatLongDate(date)}.`);
    case "full":
      return failure("Esa hora ya está ocupada ese día. Elige otra.");
    case "no_slot":
      return failure("Ese horario ya no existe. Elige otro.");
    default:
      return failure("Esta reserva ya no se puede mover.");
  }
}

const QUOTE_ERRORS = {
  vehicle: "Ese vehículo ya no está activo. Elige otro.",
  base_service: "Ese servicio no tiene precio para ese vehículo. Elige otro o ponle precio en Servicios.",
  extra_service: "Un extra no tiene precio para ese vehículo. Quítalo o ponle precio en Servicios.",
  zone: "Esa colonia ya no está activa. Elige otra.",
} as const;

// A booking that came by WhatsApp or phone. Priced on the server with the catalog; it
// takes its places like any other booking and is paid on the day.
export async function createManualBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  const parsed = manualBookingSchema.safeParse({
    vehicleTypeId: formData.get("vehicleTypeId"),
    baseServiceId: formData.get("baseServiceId"),
    extraServiceIds: formData.getAll("extraServiceIds"),
    zoneId: formData.get("zoneId"),
    date: formData.get("date"),
    timeSlotId: formData.get("timeSlotId"),
    startPlace: formData.get("startPlace"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    address: formData.get("address"),
    references: formData.get("references"),
    email: formData.get("email"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return failure(firstError(parsed.error));
  const input = parsed.data;
  if (input.date < todayInMexico()) return failure("Elige un día de hoy en adelante.");

  const data = await getBookingData(supabase, business.slug, new Date());
  if (!data) return failure("No se encontró tu negocio.");
  const result = calculateQuote(data.catalog, {
    vehicleTypeId: input.vehicleTypeId,
    baseServiceId: input.baseServiceId,
    extraServiceIds: input.extraServiceIds,
    zoneId: input.zoneId,
  });
  if (!result.ok) return failure(QUOTE_ERRORS[result.error]);
  const { quote } = result;

  const { data: created, error } = await supabase.rpc("create_manual_booking", {
    p_booking: {
      business_id: business.id,
      service_date: input.date,
      time_slot_id: input.timeSlotId,
      start_place: input.startPlace,
      vehicle_type_id: quote.vehicle.id,
      zone_id: quote.zone?.id ?? null,
      capacity_units: quote.capacityUnits,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.email,
      address: input.address,
      address_references: input.references,
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
      notes: input.notes,
    },
  });
  if (error) return dbFailure(error);
  const booking = (created as { booking_id: string; booking_folio: string }[] | null)?.[0];
  if (!booking) return failure("Esa hora ya está ocupada ese día. Elige otra.");

  redirect(`/panel/agenda?dia=${input.date}&nueva=${encodeURIComponent(booking.booking_folio)}`);
}
