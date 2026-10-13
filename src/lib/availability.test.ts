import { describe, expect, test } from "vitest";
import {
  bookableDates,
  daysWithTimeLeft,
  earliestStart,
  isSlotBookable,
  placeTime,
  slotsForDate,
  slotTimes,
  type PlaceUsage,
  type ScheduleRules,
  type SlotRule,
} from "./availability";

const rules: ScheduleRules = {
  workingDays: [1, 2, 3, 4, 5, 6], // Monday to Saturday
  leadMinutes: 120,
  horizonDays: 7,
  blockedDates: ["2026-10-15"],
};

const slots: SlotRule[] = [
  { id: "morning", name: "Mañana", startTime: "09:00:00", endTime: "13:00:00", capacity: 3 },
  { id: "afternoon", name: "Tarde", startTime: "13:00:00", endTime: "18:00:00", capacity: 3 },
];

// Monday 2026-10-12, 10:30 in Mexico City.
const now = new Date("2026-10-12T16:30:00Z");

describe("bookableDates", () => {
  test("today through the horizon, without days off or blocked dates", () => {
    expect(bookableDates(rules, now)).toEqual([
      "2026-10-12", // Mon (today)
      "2026-10-13",
      "2026-10-14",
      // 15th is blocked
      "2026-10-16",
      "2026-10-17", // Sat
      // 18th is Sunday
      "2026-10-19", // Mon, 7 days ahead
    ]);
  });

  test("uses Mexico City's date late at night", () => {
    // 2026-10-13 05:00 UTC is still Monday the 12th in Mexico City.
    expect(bookableDates({ ...rules, horizonDays: 0 }, new Date("2026-10-13T05:00:00Z"))).toEqual(["2026-10-12"]);
  });
});

describe("exact times", () => {
  test("a slot's places split it in equal turns, rounded to 5 minutes", () => {
    expect(slotTimes(slots[0])).toEqual(["09:00", "10:20", "11:40"]);
    expect(slotTimes(slots[1])).toEqual(["13:00", "14:40", "16:20"]);
    expect(slotTimes({ startTime: "08:00:00", endTime: "12:00:00", capacity: 7 })).toEqual([
      "08:00",
      "08:35",
      "09:10",
      "09:45",
      "10:15",
      "10:50",
      "11:25",
    ]);
  });

  test("halves round up, like the database", () => {
    // 4 h 05 min in 6 places: place 3 is 122.5 minutes in, so 125.
    expect(placeTime({ startTime: "09:00", endTime: "13:05", capacity: 6 }, 3)).toBe("11:05");
  });
});

describe("slotsForDate", () => {
  const base = { slots, usage: [] as PlaceUsage[], unitsNeeded: 1, notBefore: earliestStart(rules, now) };
  const startsOf = (slot: { starts: { time: string; status: string }[] }) =>
    slot.starts.map((start) => `${start.time} ${start.status}`);

  test("same day: times less than 2 hours away are too soon", () => {
    // 10:30 now: the whole morning is too soon; the afternoon starts 2.5 h away.
    const [morning, afternoon] = slotsForDate({ ...base, date: "2026-10-12" });
    expect(morning.status).toBe("too_soon");
    expect(startsOf(afternoon)).toEqual(["13:00 available", "14:40 available", "16:20 available"]);
  });

  test("the last times of a slot can still be booked when the first ones can't", () => {
    const at9 = new Date("2026-10-12T15:00:00Z"); // 9:00 in Mexico City: 11:40 is 2 h 40 min away
    const [morning] = slotsForDate({ ...base, date: "2026-10-12", notBefore: earliestStart(rules, at9) });
    expect(morning.status).toBe("available");
    expect(startsOf(morning)).toEqual(["09:00 too_soon", "10:20 too_soon", "11:40 available"]);
  });

  test("exactly 2 hours ahead is still bookable", () => {
    const at11 = new Date("2026-10-12T17:00:00Z"); // 11:00 in Mexico City
    const [, afternoon] = slotsForDate({ ...base, date: "2026-10-12", notBefore: earliestStart(rules, at11) });
    expect(afternoon.starts[0].status).toBe("available");
  });

  test("taken times, and services that need several places in a row", () => {
    const usage: PlaceUsage[] = [{ date: "2026-10-13", timeSlotId: "morning", startPlace: 1, units: 1 }];
    const [one] = slotsForDate({ ...base, date: "2026-10-13", usage });
    expect(startsOf(one)).toEqual(["09:00 available", "10:20 taken", "11:40 available"]);
    expect(one.freeUnits).toBe(2);
    // Two places in a row: 9:00 would need 10:20, and 10:20 is taken.
    const [two] = slotsForDate({ ...base, date: "2026-10-13", usage, unitsNeeded: 2 });
    expect(startsOf(two)).toEqual(["09:00 taken", "10:20 taken"]);
    expect(two.status).toBe("full");
  });

  test("Full detailing (3 places) only fits an empty slot, from its start", () => {
    const usage: PlaceUsage[] = [{ date: "2026-10-13", timeSlotId: "morning", startPlace: 2, units: 1 }];
    const [morning, afternoon] = slotsForDate({ ...base, date: "2026-10-13", usage, unitsNeeded: 3 });
    expect(morning.status).toBe("full");
    expect(startsOf(afternoon)).toEqual(["13:00 available"]);
  });

  test("bookings from before exact times count as taken places, but not at any time", () => {
    const usage: PlaceUsage[] = [
      { date: "2026-10-13", timeSlotId: "morning", startPlace: null, units: 2 },
      { date: "2026-10-13", timeSlotId: "afternoon", startPlace: null, units: 3 },
    ];
    const [morning, afternoon] = slotsForDate({ ...base, date: "2026-10-13", usage });
    expect(startsOf(morning)).toEqual(["09:00 available", "10:20 available", "11:40 available"]);
    expect(morning.freeUnits).toBe(1);
    expect(afternoon.status).toBe("full");
    expect(slotsForDate({ ...base, date: "2026-10-13", usage, unitsNeeded: 2 })[0].status).toBe("full");
  });

  test("a service bigger than the whole slot never fits", () => {
    const statuses = slotsForDate({ ...base, date: "2026-10-13", unitsNeeded: 4 }).map((slot) => slot.status);
    expect(statuses).toEqual(["too_big", "too_big"]);
  });

  test("the panel books any time, even past ones", () => {
    const [morning] = slotsForDate({ ...base, date: "2026-10-12", notBefore: null });
    expect(morning.status).toBe("available");
  });
});

describe("isSlotBookable", () => {
  const input = { slots, usage: [] as PlaceUsage[], rules, now, unitsNeeded: 1 };

  test("checks the day, the slot and the time", () => {
    expect(isSlotBookable({ ...input, date: "2026-10-13", slotId: "morning", startPlace: 2 })).toBe(true);
    expect(isSlotBookable({ ...input, date: "2026-10-13", slotId: "morning", startPlace: 3 })).toBe(false); // no such time
    expect(isSlotBookable({ ...input, date: "2026-10-15", slotId: "morning", startPlace: 0 })).toBe(false); // blocked
    expect(isSlotBookable({ ...input, date: "2026-10-18", slotId: "morning", startPlace: 0 })).toBe(false); // Sunday
    expect(isSlotBookable({ ...input, date: "2026-10-20", slotId: "morning", startPlace: 0 })).toBe(false); // beyond horizon
    expect(isSlotBookable({ ...input, date: "2026-10-12", slotId: "morning", startPlace: 2 })).toBe(false); // too soon
    expect(isSlotBookable({ ...input, date: "2026-10-13", slotId: "night", startPlace: 0 })).toBe(false); // unknown slot
  });

  test("a taken time is not bookable", () => {
    const usage: PlaceUsage[] = [{ date: "2026-10-13", timeSlotId: "morning", startPlace: 0, units: 1 }];
    expect(isSlotBookable({ ...input, usage, date: "2026-10-13", slotId: "morning", startPlace: 0 })).toBe(false);
    expect(isSlotBookable({ ...input, usage, date: "2026-10-13", slotId: "morning", startPlace: 1 })).toBe(true);
  });
});

test("daysWithTimeLeft drops today once every time is too soon", () => {
  const evening = new Date("2026-10-12T22:30:00Z"); // 16:30 in Mexico City: 16:20 already passed
  const slotsByDate = new Map(
    ["2026-10-12", "2026-10-13"].map((date) => [
      date,
      slotsForDate({ date, slots, usage: [], unitsNeeded: 1, notBefore: earliestStart(rules, evening) }),
    ]),
  );
  expect(daysWithTimeLeft(slotsByDate)).toEqual(["2026-10-13"]);
});
