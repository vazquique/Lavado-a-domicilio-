import { describe, expect, test } from "vitest";
import {
  canChangeStatus,
  dayLoad,
  formatMonth,
  isActiveBooking,
  isMonth,
  monthGrid,
  shiftMonth,
  slotRows,
  takesPlace,
} from "./agenda";

describe("monthGrid", () => {
  test("October 2026 starts on Thursday: the grid starts the Monday before and ends on a Sunday", () => {
    const weeks = monthGrid("2026-10");
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(weeks.at(-1)?.at(-1)).toBe("2026-11-01");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  test("a month that starts on Monday and needs six weeks", () => {
    expect(monthGrid("2026-06")[0][0]).toBe("2026-06-01");
    const august = monthGrid("2026-08");
    expect(august).toHaveLength(6);
    expect(august[0][0]).toBe("2026-07-27");
    expect(august[5][0]).toBe("2026-08-31");
  });
});

describe("months", () => {
  test("move across years and read in Spanish", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(formatMonth("2026-10")).toBe("Octubre de 2026");
    expect(isMonth("2026-10")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-10-01")).toBe(false);
  });
});

describe("statuses", () => {
  test("the owner finishes, marks no-shows or cancels confirmed bookings, and can undo a wrong tap", () => {
    expect(canChangeStatus("confirmed", "completed")).toBe(true);
    expect(canChangeStatus("confirmed", "no_show")).toBe(true);
    expect(canChangeStatus("confirmed", "cancelled")).toBe(true);
    expect(canChangeStatus("completed", "confirmed")).toBe(true);
    expect(canChangeStatus("no_show", "confirmed")).toBe(true);
  });

  test("but a cancelled or unpaid booking doesn't come back, and nothing jumps over 'confirmed'", () => {
    expect(canChangeStatus("cancelled", "confirmed")).toBe(false);
    expect(canChangeStatus("expired", "confirmed")).toBe(false);
    expect(canChangeStatus("pending_payment", "confirmed")).toBe(false);
    expect(canChangeStatus("completed", "no_show")).toBe(false);
  });

  test("which bookings take a place, like the database counts them", () => {
    const now = new Date("2026-10-13T18:00:00Z");
    expect(takesPlace({ status: "confirmed", holdExpiresAt: null }, now)).toBe(true);
    expect(takesPlace({ status: "no_show", holdExpiresAt: null }, now)).toBe(true);
    expect(takesPlace({ status: "pending_payment", holdExpiresAt: "2026-10-13T18:10:00Z" }, now)).toBe(true);
    expect(takesPlace({ status: "pending_payment", holdExpiresAt: "2026-10-13T17:50:00Z" }, now)).toBe(false);
    expect(takesPlace({ status: "cancelled", holdExpiresAt: null }, now)).toBe(false);
    expect(isActiveBooking({ status: "expired", holdExpiresAt: null }, now)).toBe(false);
    expect(isActiveBooking({ status: "completed", holdExpiresAt: null }, now)).toBe(true);
  });
});

describe("dayLoad", () => {
  test("empty, some, busy from half the places, full", () => {
    expect(dayLoad(0, 6)).toBe("none");
    expect(dayLoad(2, 6)).toBe("some");
    expect(dayLoad(3, 6)).toBe("busy");
    expect(dayLoad(6, 6)).toBe("full");
    expect(dayLoad(1, 0)).toBe("full");
  });
});

describe("slotRows", () => {
  const morning = { startTime: "09:00:00", endTime: "13:00:00", capacity: 3 };
  const booking = (name: string, startPlace: number | null, capacityUnits = 1) => ({ name, startPlace, capacityUnits });
  const view = (result: ReturnType<typeof slotRows<ReturnType<typeof booking>>>) => ({
    rows: result.rows.map((row) => `${row.time} ${row.bookings.map((item) => item.name).join(", ") || "libre"}`),
    loose: result.loose.map((item) => item.name),
  });

  test("an empty slot is all free times", () => {
    expect(view(slotRows(morning, []))).toEqual({ rows: ["09:00 libre", "10:20 libre", "11:40 libre"], loose: [] });
  });

  test("each booking at its time; one of two places covers the next time", () => {
    expect(view(slotRows(morning, [booking("Beto", 1, 2), booking("Ana", 0)]))).toEqual({
      rows: ["09:00 Ana", "10:20 Beto"],
      loose: [],
    });
  });

  test("bookings without a time come apart", () => {
    expect(view(slotRows(morning, [booking("Ana", null), booking("Beto", 5), booking("Carla", 2)]))).toEqual({
      rows: ["09:00 libre", "10:20 libre", "11:40 Carla"],
      loose: ["Ana", "Beto"],
    });
  });
});
