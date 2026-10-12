import { describe, expect, test } from "vitest";
import {
  bookableDates,
  daysWithTimeLeft,
  isSlotBookable,
  slotsForDate,
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

describe("slotsForDate", () => {
  const base = { slots, usage: [], rules, now, unitsNeeded: 1 };

  test("same day: a slot that starts in less than 2 hours is too soon", () => {
    // 10:30 now: the morning (9:00) already started; the afternoon (13:00) is 2.5 h away.
    const statuses = slotsForDate({ ...base, date: "2026-10-12" }).map((slot) => slot.status);
    expect(statuses).toEqual(["too_soon", "available"]);
  });

  test("exactly 2 hours ahead is still bookable", () => {
    const at11 = new Date("2026-10-12T17:00:00Z"); // 11:00 in Mexico City
    const afternoon = slotsForDate({ ...base, date: "2026-10-12", now: at11 }).find((slot) => slot.id === "afternoon");
    expect(afternoon?.status).toBe("available");
  });

  test("places already taken", () => {
    const usage = [
      { date: "2026-10-13", timeSlotId: "morning", usedUnits: 2 },
      { date: "2026-10-13", timeSlotId: "afternoon", usedUnits: 3 },
      { date: "2026-10-14", timeSlotId: "morning", usedUnits: 3 },
    ];
    const tuesday = slotsForDate({ ...base, date: "2026-10-13", usage });
    expect(tuesday.map((slot) => [slot.id, slot.status, slot.freeUnits])).toEqual([
      ["morning", "available", 1],
      ["afternoon", "full", 0],
    ]);
    const twoPlaces = slotsForDate({ ...base, date: "2026-10-13", usage, unitsNeeded: 2 });
    expect(twoPlaces[0].status).toBe("full");
  });

  test("Full detailing (3 places) only fits an empty slot", () => {
    const usage = [{ date: "2026-10-13", timeSlotId: "morning", usedUnits: 1 }];
    const statuses = slotsForDate({ ...base, date: "2026-10-13", usage, unitsNeeded: 3 }).map((slot) => slot.status);
    expect(statuses).toEqual(["full", "available"]);
  });

  test("a service bigger than the whole slot never fits", () => {
    const statuses = slotsForDate({ ...base, date: "2026-10-13", unitsNeeded: 4 }).map((slot) => slot.status);
    expect(statuses).toEqual(["too_big", "too_big"]);
  });
});

describe("isSlotBookable", () => {
  const input = { slots, usage: [], rules, now, unitsNeeded: 1 };

  test("checks the day and the slot", () => {
    expect(isSlotBookable({ ...input, date: "2026-10-13", slotId: "morning" })).toBe(true);
    expect(isSlotBookable({ ...input, date: "2026-10-15", slotId: "morning" })).toBe(false); // blocked
    expect(isSlotBookable({ ...input, date: "2026-10-18", slotId: "morning" })).toBe(false); // Sunday
    expect(isSlotBookable({ ...input, date: "2026-10-20", slotId: "morning" })).toBe(false); // beyond horizon
    expect(isSlotBookable({ ...input, date: "2026-10-12", slotId: "morning" })).toBe(false); // too soon
    expect(isSlotBookable({ ...input, date: "2026-10-13", slotId: "night" })).toBe(false); // unknown slot
  });
});

test("daysWithTimeLeft drops today once every slot is too soon", () => {
  const lateMorning = new Date("2026-10-12T17:30:00Z"); // 11:30 in Mexico City: 13:00 is under 2 hours away
  const slotsByDate = new Map(
    ["2026-10-12", "2026-10-13"].map((date) => [
      date,
      slotsForDate({ date, slots, usage: [], rules, now: lateMorning, unitsNeeded: 1 }),
    ]),
  );
  expect(daysWithTimeLeft(slotsByDate)).toEqual(["2026-10-13"]);
});
