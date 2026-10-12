import { describe, expect, test } from "vitest";
import { addDays, dayLabel, formatLongDate, isoWeekday, mexicoCityDateTime, todayInMexico } from "./dates";

describe("todayInMexico", () => {
  test("uses Mexico City's calendar day, not UTC's", () => {
    // 2026-10-13 03:00 UTC is still the 12th in Mexico City (UTC-6).
    expect(todayInMexico(new Date("2026-10-13T03:00:00Z"))).toBe("2026-10-12");
    expect(todayInMexico(new Date("2026-10-13T07:00:00Z"))).toBe("2026-10-13");
  });
});

describe("calendar math", () => {
  test("addDays crosses months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-12", 30)).toBe("2026-11-11");
  });

  test("isoWeekday", () => {
    expect(isoWeekday("2026-10-12")).toBe(1); // Monday
    expect(isoWeekday("2026-10-18")).toBe(7); // Sunday
  });
});

test("mexicoCityDateTime converts the local clock to the real instant", () => {
  expect(mexicoCityDateTime("2026-10-13", "09:00").toISOString()).toBe("2026-10-13T15:00:00.000Z");
  expect(mexicoCityDateTime("2026-12-31", "18:30:00").toISOString()).toBe("2027-01-01T00:30:00.000Z");
});

test("labels in Spanish", () => {
  expect(formatLongDate("2026-12-25")).toBe("viernes, 25 de diciembre de 2026");
  expect(dayLabel("2026-10-13")).toEqual({ weekday: "mar", day: "13", month: "oct" });
});
