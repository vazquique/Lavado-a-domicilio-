// Which days, time slots and exact times can be booked. Pure functions shared by the page
// (to show options) and the server (to check them again before saving anything).
//
// A slot's places are consecutive turns: "Mañana" from 9:00 to 13:00 with 3 places starts
// at 9:00, 10:20 and 11:40. A booking starts at one place and takes as many places in a
// row as its services need. Same rules as the database (private.places_free).
import { addDays, isoWeekday, mexicoCityDateTime, todayInMexico } from "./dates";

export type ScheduleRules = {
  workingDays: number[]; // ISO weekdays, 1 = Monday ... 7 = Sunday
  leadMinutes: number; // a time must be at least this long after "now"
  horizonDays: number; // bookable from today through today + horizonDays
  blockedDates: string[]; // "YYYY-MM-DD"
};

export type SlotRule = { id: string; name: string; startTime: string; endTime: string; capacity: number };

// Places taken on a day: where a booking starts and how many places in a row it takes.
// Bookings from before exact times may have no start; they still count as taken places.
export type PlaceUsage = { date: string; timeSlotId: string; startPlace: number | null; units: number };

export type StartStatus = "available" | "too_soon" | "taken";

// A time a booking can start at: its place in the slot and its clock time ("10:20").
export type SlotStart = { place: number; time: string; status: StartStatus };

export type SlotStatus = "available" | "too_soon" | "full" | "too_big";

export type SlotAvailability = SlotRule & { status: SlotStatus; freeUnits: number; starts: SlotStart[] };

function minutesOf(clockTime: string): number {
  const [hours, minutes] = clockTime.split(":").map(Number);
  return hours * 60 + minutes;
}

// Clock time ("10:20") a place starts at, rounded to 5 minutes like the database.
export function placeTime(slot: Pick<SlotRule, "startTime" | "endTime" | "capacity">, place: number): string {
  const start = minutesOf(slot.startTime);
  const length = minutesOf(slot.endTime) - start;
  const total = start + Math.round((length * place) / (slot.capacity * 5)) * 5;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Times of every place of a slot, e.g. ["09:00", "10:20", "11:40"].
export function slotTimes(slot: Pick<SlotRule, "startTime" | "endTime" | "capacity">): string[] {
  return Array.from({ length: slot.capacity }, (_, place) => placeTime(slot, place));
}

// The first instant customers can book: now plus the business's notice time.
export function earliestStart(rules: Pick<ScheduleRules, "leadMinutes">, now: Date): Date {
  return new Date(now.getTime() + rules.leadMinutes * 60_000);
}

// Working, unblocked days from today to the end of the booking window.
export function bookableDates(rules: ScheduleRules, now: Date): string[] {
  const today = todayInMexico(now);
  const blocked = new Set(rules.blockedDates);
  const dates: string[] = [];
  for (let offset = 0; offset <= rules.horizonDays; offset++) {
    const date = addDays(today, offset);
    if (rules.workingDays.includes(isoWeekday(date)) && !blocked.has(date)) dates.push(date);
  }
  return dates;
}

// Each slot of a day with the times a booking of `unitsNeeded` places can start at.
// Times before `notBefore` are too soon; the panel passes null (the owner books any time).
export function slotsForDate({
  date,
  slots,
  usage,
  unitsNeeded,
  notBefore,
}: {
  date: string;
  slots: SlotRule[];
  usage: PlaceUsage[];
  unitsNeeded: number;
  notBefore: Date | null;
}): SlotAvailability[] {
  const tooSoon = (time: string) =>
    notBefore !== null && mexicoCityDateTime(date, time).getTime() < notBefore.getTime();
  return slots.map((slot) => {
    const taken = usage.filter((item) => item.date === date && item.timeSlotId === slot.id);
    const used = taken.reduce((sum, item) => sum + item.units, 0);
    const freeUnits = Math.max(0, slot.capacity - used);
    const starts: SlotStart[] = [];
    for (let place = 0; place + unitsNeeded <= slot.capacity; place++) {
      const time = placeTime(slot, place);
      const overlaps = taken.some(
        (item) => item.startPlace !== null && item.startPlace < place + unitsNeeded && item.startPlace + item.units > place,
      );
      const status: StartStatus = tooSoon(time) ? "too_soon" : unitsNeeded > freeUnits || overlaps ? "taken" : "available";
      starts.push({ place, time, status });
    }

    let status: SlotStatus = "available";
    if (starts.length === 0) status = tooSoon(slot.startTime) ? "too_soon" : "too_big";
    else if (starts.every((start) => start.status === "too_soon")) status = "too_soon";
    else if (!starts.some((start) => start.status === "available")) status = "full";
    return { ...slot, status, freeUnits, starts };
  });
}

// Final check for one choice (date + slot + time) with everything above.
export function isSlotBookable(input: {
  date: string;
  slotId: string;
  startPlace: number;
  slots: SlotRule[];
  usage: PlaceUsage[];
  rules: ScheduleRules;
  now: Date;
  unitsNeeded: number;
}): boolean {
  if (!bookableDates(input.rules, input.now).includes(input.date)) return false;
  const slot = slotsForDate({ ...input, notBefore: earliestStart(input.rules, input.now) }).find(
    (item) => item.id === input.slotId,
  );
  return slot?.starts.some((start) => start.place === input.startPlace && start.status === "available") ?? false;
}

// Days where at least one time can still be reached. Late in the day, today has none
// left and shouldn't be offered (nor shown as "full").
export function daysWithTimeLeft(slotsByDate: Map<string, SlotAvailability[]>): string[] {
  return [...slotsByDate.entries()]
    .filter(([, slots]) => slots.some((slot) => slot.status !== "too_soon"))
    .map(([date]) => date);
}
