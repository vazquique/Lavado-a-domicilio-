"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canChangeStatus, isBookingStatus, type BookingStatus } from "@/lib/agenda";
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

export type DaySlot = { id: string; name: string; startTime: string; endTime: string; capacity: number; freeUnits: number };

export type DaySlots =
  | { ok: true; date: string; working: boolean; blockedReason: string | null; slots: DaySlot[] }
  | { ok: false; message: string };

// Free places per time slot on a day, for moving a booking or adding one by hand.
export async function getDaySlots(date: string): Promise<DaySlots> {
  const { supabase, business } = await requirePanelBusiness();
  if (!isDate(date)) return { ok: false, message: "Elige un día." };

  const [settings, slots, blocked, usage] = await Promise.all([
    supabase.from("businesses").select("working_days").eq("id", business.id).single(),
    supabase
      .from("time_slots")
      .select("id, name, start_time, end_time, capacity")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort_order")
      .order("start_time"),
    supabase.from("blocked_dates").select("reason").eq("business_id", business.id).eq("date", date).maybeSingle(),
    supabase.rpc("slot_usage", { p_business_id: business.id, p_from: date, p_to: date }),
  ]);
  for (const result of [settings, slots, blocked, usage]) {
    if (result.error) throw result.error;
  }

  const used = new Map(
    ((usage.data ?? []) as { time_slot_id: string; used_units: number }[]).map((row) => [row.time_slot_id, row.used_units]),
  );
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
      freeUnits: Math.max(0, slot.capacity - (used.get(slot.id) ?? 0)),
    })),
  };
}

// Another day or time slot, if there's room there (checked by the database, which locks
// the slot so nobody takes the last place at the same time).
export async function rescheduleBooking(bookingId: string, date: string, timeSlotId: string): Promise<ActionState> {
  const { supabase } = await requirePanelBusiness();
  if (!isUuid(bookingId) || !isUuid(timeSlotId) || !isDate(date)) return failure("Elige el día y el horario.");
  if (date < todayInMexico()) return failure("Elige un día de hoy en adelante.");

  const { data, error } = await supabase.rpc("reschedule_booking", {
    p_booking_id: bookingId,
    p_date: date,
    p_slot_id: timeSlotId,
  });
  if (error) return dbFailure(error);
  switch (data) {
    case "moved":
      refresh();
      return success(`Listo, quedó para el ${formatLongDate(date)}.`);
    case "full":
      return failure("Ese horario ya está lleno ese día. Elige otro.");
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
  if (!booking) return failure("Ese horario ya está lleno ese día. Elige otro.");

  redirect(`/panel/agenda?dia=${input.date}&nueva=${encodeURIComponent(booking.booking_folio)}`);
}
