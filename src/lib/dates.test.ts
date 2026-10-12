import { describe, expect, test } from "vitest";
import { formatLongDate, todayInMexico } from "./dates";

describe("todayInMexico", () => {
  test("uses Mexico City's calendar day, not UTC's", () => {
    // 2026-10-13 03:00 UTC is still the 12th in Mexico City (UTC-6).
    expect(todayInMexico(new Date("2026-10-13T03:00:00Z"))).toBe("2026-10-12");
    expect(todayInMexico(new Date("2026-10-13T07:00:00Z"))).toBe("2026-10-13");
  });
});

test("formatLongDate in Spanish", () => {
  expect(formatLongDate("2026-12-25")).toBe("viernes, 25 de diciembre de 2026");
});
