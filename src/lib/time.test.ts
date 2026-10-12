import { expect, test } from "vitest";
import { formatClockTime } from "./time";

test("formatClockTime drops seconds and leading zero", () => {
  expect(formatClockTime("09:00:00")).toBe("9:00");
  expect(formatClockTime("14:30:00")).toBe("14:30");
});
