// Which days and time slots can be booked. Pure functions shared by the page (to
// show options) and the server (to check them again before saving anything).
import { addDays, isoWeekday, mexicoCityDateTime, todayInMexico } from "./dates";

export type ScheduleRules = {
  workingDays: number[]; // ISO weekdays, 1 = Monday ... 7 = Sunday
  leadMinutes: number; // a slot must start at least this long after "now"
  horizonDays: number; // bookable from today through today + horizonDays
  blockedDates: string[]; // "YYYY-MM-DD"
};

export type SlotRule = { id: string; name: string; startTime: string; endTime: string; capacity: number };

export type SlotUsage = { date: string; timeSlotId: string; usedUnits: number };

export type SlotStatus = "available" | "too_soon" | "full" | "too_big";

export type SlotAvailability = SlotRule & { status: SlotStatus; freeUnits: number };

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

export function slotsForDate({
  date,
  slots,
  usage,
  rules,
  now,
  unitsNeeded,
}: {
  date: string;
  slots: SlotRule[];
  usage: SlotUsage[];
  rules: ScheduleRules;
  now: Date;
  unitsNeeded: number;
}): SlotAvailability[] {
  const earliestStart = now.getTime() + rules.leadMinutes * 60_000;
  return slots.map((slot) => {
    const used = usage
      .filter((item) => item.date === date && item.timeSlotId === slot.id)
      .reduce((sum, item) => sum + item.usedUnits, 0);
    const freeUnits = Math.max(0, slot.capacity - used);
    let status: SlotStatus = "available";
    if (mexicoCityDateTime(date, slot.startTime).getTime() < earliestStart) status = "too_soon";
    else if (unitsNeeded > slot.capacity) status = "too_big";
    else if (unitsNeeded > freeUnits) status = "full";
    return { ...slot, status, freeUnits };
  });
}

// Final check for one choice (date + slot) with everything above.
export function isSlotBookable(input: {
  date: string;
  slotId: string;
  slots: SlotRule[];
  usage: SlotUsage[];
  rules: ScheduleRules;
  now: Date;
  unitsNeeded: number;
}): boolean {
  if (!bookableDates(input.rules, input.now).includes(input.date)) return false;
  const slot = slotsForDate(input).find((item) => item.id === input.slotId);
  return slot?.status === "available";
}

// Days where at least one slot can still be reached in time. Late in the day, today
// has none left and shouldn't be offered (nor shown as "full").
export function daysWithTimeLeft(slotsByDate: Map<string, SlotAvailability[]>): string[] {
  return [...slotsByDate.entries()]
    .filter(([, slots]) => slots.some((slot) => slot.status !== "too_soon"))
    .map(([date]) => date);
}
