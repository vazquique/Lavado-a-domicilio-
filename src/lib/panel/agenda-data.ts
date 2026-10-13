import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isBookingStatus, monthGrid, type BookingStatus } from "@/lib/agenda";
import { placeTime } from "@/lib/availability";
import { formatMxPhone } from "@/lib/quote-message";
import { reminderMessage } from "@/lib/reminder-message";
import { whatsAppLink } from "@/lib/whatsapp";

export type AgendaSlot = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  active: boolean;
};

// A booking as the agenda shows it. Personal data: only for the business's own panel.
export type AgendaBooking = {
  id: string;
  folio: string;
  status: BookingStatus;
  source: "online" | "manual";
  serviceDate: string;
  timeSlotId: string;
  timeSlotName: string;
  // First place it takes in its slot and when we arrive ("10:20"); null for bookings from
  // before exact times.
  startPlace: number | null;
  arrivalTime: string | null;
  // When its last place ends (the next place's time), shown for bookings of several places.
  untilTime: string | null;
  capacityUnits: number;
  holdExpiresAt: string | null;
  customer: { name: string; phone: string; phoneLabel: string; email: string | null };
  address: string;
  references: string;
  zoneName: string | null;
  vehicleName: string;
  services: string[];
  totalCents: number;
  paidOnlineCents: number;
  balanceCents: number;
  balancePaid: boolean;
  notes: string;
  reminderUrl: string | null;
};

export type AgendaMonth = {
  month: string;
  weeks: string[][];
  workingDays: number[];
  blockedDates: Record<string, string>; // date -> reason
  slots: AgendaSlot[];
  bookings: AgendaBooking[];
};

type BookingRow = {
  id: string;
  folio: string;
  status: string;
  source: "online" | "manual";
  service_date: string;
  time_slot_id: string;
  time_slot_name: string;
  start_place: number | null;
  arrival_time: string | null;
  capacity_units: number;
  hold_expires_at: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  address: string;
  address_references: string;
  zone_name: string | null;
  vehicle_type_name: string;
  items: { name: string }[];
  total_cents: number;
  deposit_cents: number;
  deposit_paid_at: string | null;
  balance_cents: number;
  balance_paid_at: string | null;
  notes: string;
};

// Everything the agenda shows for the weeks of one month, read with the owner's session.
export async function getAgendaMonth(
  supabase: SupabaseClient,
  business: { id: string; name: string },
  month: string,
): Promise<AgendaMonth> {
  const weeks = monthGrid(month);
  const from = weeks[0][0];
  const to = weeks.at(-1)!.at(-1)!;

  const [settings, slots, blocked, bookings] = await Promise.all([
    supabase.from("businesses").select("working_days").eq("id", business.id).single(),
    supabase
      .from("time_slots")
      .select("id, name, start_time, end_time, capacity, active")
      .eq("business_id", business.id)
      .order("sort_order")
      .order("start_time"),
    supabase.from("blocked_dates").select("date, reason").eq("business_id", business.id).gte("date", from).lte("date", to),
    supabase
      .from("bookings")
      .select(
        "id, folio, status, source, service_date, time_slot_id, time_slot_name, start_place, arrival_time, capacity_units, hold_expires_at, customer_name, customer_phone, customer_email, address, address_references, zone_name, vehicle_type_name, items, total_cents, deposit_cents, deposit_paid_at, balance_cents, balance_paid_at, notes",
      )
      .eq("business_id", business.id)
      .gte("service_date", from)
      .lte("service_date", to)
      .order("created_at"),
  ]);
  for (const result of [settings, slots, blocked, bookings]) {
    if (result.error) throw result.error;
  }

  const agendaSlots: AgendaSlot[] = (slots.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    capacity: row.capacity,
    active: row.active,
  }));
  const slotById = new Map(agendaSlots.map((slot) => [slot.id, slot]));

  return {
    month,
    weeks,
    workingDays: settings.data?.working_days ?? [],
    blockedDates: Object.fromEntries((blocked.data ?? []).map((row) => [row.date, row.reason])),
    slots: agendaSlots,
    bookings: ((bookings.data ?? []) as BookingRow[]).flatMap((row) => {
      if (!isBookingStatus(row.status)) return [];
      const slot = slotById.get(row.time_slot_id);
      // Paid online: the deposit (or everything) once Mercado Pago confirmed it.
      const paidOnlineCents = row.deposit_paid_at ? row.deposit_cents : 0;
      const balancePaid = row.balance_paid_at !== null;
      const services = row.items.map((item) => item.name);
      const booking: AgendaBooking = {
        id: row.id,
        folio: row.folio,
        status: row.status,
        source: row.source,
        serviceDate: row.service_date,
        timeSlotId: row.time_slot_id,
        timeSlotName: row.time_slot_name,
        startPlace: row.start_place,
        arrivalTime: row.arrival_time,
        untilTime:
          slot && row.start_place !== null && row.capacity_units > 1
            ? placeTime(slot, row.start_place + row.capacity_units)
            : null,
        capacityUnits: row.capacity_units,
        holdExpiresAt: row.hold_expires_at,
        customer: {
          name: row.customer_name,
          phone: row.customer_phone,
          phoneLabel: formatMxPhone(row.customer_phone),
          email: row.customer_email,
        },
        address: row.address,
        references: row.address_references,
        zoneName: row.zone_name,
        vehicleName: row.vehicle_type_name,
        services,
        totalCents: row.total_cents,
        paidOnlineCents,
        balanceCents: row.total_cents - paidOnlineCents,
        balancePaid,
        notes: row.notes,
        reminderUrl: whatsAppLink(
          row.customer_phone,
          reminderMessage({
            businessName: business.name,
            customerName: row.customer_name,
            folio: row.folio,
            serviceDate: row.service_date,
            slot: {
              name: row.time_slot_name,
              startTime: slot?.startTime ?? null,
              endTime: slot?.endTime ?? null,
              arrivalTime: row.arrival_time,
            },
            address: row.address,
            zoneName: row.zone_name,
            vehicleName: row.vehicle_type_name,
            services,
            totalCents: row.total_cents,
            paidOnlineCents,
            balanceCents: row.total_cents - paidOnlineCents,
            balancePaid,
          }),
        ),
      };
      return [booking];
    }),
  };
}
