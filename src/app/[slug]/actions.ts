"use server";

import { isSlotBookable } from "@/lib/availability";
import { getBookingData, depositLabel } from "@/lib/booking-data";
import { bookingRequestSchema, type BookingRequest } from "@/lib/booking-request";
import { formatLongDate } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import { firstError } from "@/lib/panel/schemas";
import { calculateQuote, type Quote } from "@/lib/quote";
import { quoteRequestMessage } from "@/lib/quote-message";
import { createPublicClient } from "@/lib/supabase/public";
import { whatsAppLink } from "@/lib/whatsapp";

export type QuoteSummary = {
  quote: Quote;
  dateLabel: string;
  slot: { name: string; startTime: string; endTime: string };
  depositLabel: string;
  customer: { name: string; phone: string; address: string; references: string; email: string | null };
  whatsappUrl: string | null;
};

export type PrepareQuoteResult = { ok: true; summary: QuoteSummary } | { ok: false; message: string };

const QUOTE_ERRORS = {
  vehicle: "Ese vehículo ya no está disponible. Elige otro.",
  base_service: "Ese servicio ya no está disponible para tu vehículo. Elige otro.",
  extra_service: "Uno de los extras ya no está disponible para tu vehículo. Quítalo e intenta de nuevo.",
  zone: "Esa colonia ya no está en la lista. Elige otra o pregúntanos por WhatsApp.",
} as const;

// Builds the official summary on the server: prices come from the database and the
// slot is checked again, so nothing the browser sends can change an amount.
export async function prepareQuote(request: BookingRequest): Promise<PrepareQuoteResult> {
  const parsed = bookingRequestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const input = parsed.data;

  const supabase = createPublicClient();
  if (!supabase) return { ok: false, message: "Estamos en mantenimiento. Intenta en unos minutos." };

  const now = new Date();
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
  if (!slot || !available) {
    return { ok: false, message: "Ese horario ya no está disponible. Elige otro, por favor." };
  }

  const summary: Omit<QuoteSummary, "whatsappUrl"> = {
    quote: result.quote,
    dateLabel: formatLongDate(input.date),
    slot: { name: slot.name, startTime: slot.startTime, endTime: slot.endTime },
    depositLabel: depositLabel(data.catalog.deposit, formatMXN),
    customer: input.customer,
  };
  const message = quoteRequestMessage({
    businessName: data.business.name,
    quote: result.quote,
    date: input.date,
    slot: summary.slot,
    customer: input.customer,
    depositLabel: summary.depositLabel,
  });

  return { ok: true, summary: { ...summary, whatsappUrl: whatsAppLink(data.business.whatsappPhone, message) } };
}
