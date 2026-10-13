import { expect, test } from "vitest";
import { arrivalLabel, formatClockTime, slotLabel } from "./time";

test("formatClockTime drops seconds and leading zero", () => {
  expect(formatClockTime("09:00:00")).toBe("9:00");
  expect(formatClockTime("14:30:00")).toBe("14:30");
});

test("slotLabel says the exact time, or the whole slot for bookings from before", () => {
  const morning = { name: "Mañana", startTime: "09:00:00", endTime: "13:00:00" };
  expect(slotLabel({ ...morning, arrivalTime: "10:20:00" })).toBe("10:20 (Mañana)");
  expect(slotLabel({ ...morning, arrivalTime: null })).toBe("Mañana (9:00 a 13:00)");
  expect(slotLabel({ name: "Mañana", startTime: null, endTime: null, arrivalTime: null })).toBe("Mañana");
  expect(arrivalLabel({ ...morning, arrivalTime: "14:40:00" })).toBe("Llegamos a las 14:40 (Mañana)");
  expect(arrivalLabel({ ...morning, arrivalTime: null })).toBe("Mañana (9:00 a 13:00)");
});
