// The panel's agenda: the days a month shows, what each booking status means and which
// changes the owner can make. Pure functions: the page uses them to draw the calendar and
// the Server Actions check them again before saving.
import { addDays, isoWeekday } from "./dates";

export const BOOKING_STATUSES = ["pending_payment", "confirmed", "completed", "cancelled", "no_show", "expired"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: "Esperando pago",
  confirmed: "Confirmada",
  completed: "Terminada",
  cancelled: "Cancelada",
  no_show: "No llegó",
  expired: "No pagó",
};

// What the owner can do from the agenda. "Terminada" and "No llegó" can be undone (a wrong
// tap); a cancelled booking can't come back because its place may be taken by now.
const STATUS_CHANGES: Record<BookingStatus, readonly BookingStatus[]> = {
  pending_payment: [],
  confirmed: ["completed", "no_show", "cancelled"],
  completed: ["confirmed"],
  no_show: ["confirmed"],
  cancelled: [],
  expired: [],
};

export function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === "string" && (BOOKING_STATUSES as readonly string[]).includes(value);
}

export function canChangeStatus(from: BookingStatus, to: BookingStatus): boolean {
  return STATUS_CHANGES[from].includes(to);
}

// Whether a booking takes its places in the slot: the same rule as the database.
export function takesPlace(booking: { status: BookingStatus; holdExpiresAt: string | null }, now: Date): boolean {
  if (booking.status === "pending_payment") {
    return booking.holdExpiresAt !== null && new Date(booking.holdExpiresAt).getTime() > now.getTime();
  }
  return booking.status === "confirmed" || booking.status === "completed" || booking.status === "no_show";
}

// Bookings the day list shows first; cancelled and unpaid ones are tucked away.
export function isActiveBooking(booking: { status: BookingStatus; holdExpiresAt: string | null }, now: Date): boolean {
  return booking.status !== "cancelled" && booking.status !== "expired" && takesPlace(booking, now);
}

// Months travel as "YYYY-MM".
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH.test(value);
}

export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

// "2026-10" -> "Octubre de 2026".
export function formatMonth(month: string): string {
  const [year, number] = month.split("-").map(Number);
  const text = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, number - 1, 15)),
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The weeks a month's calendar shows, Monday first, filled out with days of the months
// around it so every week has 7 days.
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const start = addDays(first, 1 - isoWeekday(first));
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const weeks: string[][] = [];
  for (let day = start; day <= last; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(day, index)));
  }
  return weeks;
}

// How full a day is, for the calendar: places taken against places the day has.
export type DayLoad = "none" | "some" | "busy" | "full";

export function dayLoad(usedUnits: number, capacityUnits: number): DayLoad {
  if (usedUnits <= 0) return "none";
  if (capacityUnits <= 0 || usedUnits >= capacityUnits) return "full";
  return usedUnits / capacityUnits >= 0.5 ? "busy" : "some";
}
