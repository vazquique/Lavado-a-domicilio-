import { describe, expect, test } from "vitest";
import { centsToPesosInput, normalizeMxPhone, parsePesos, timeToInput } from "./parse";

describe("parsePesos", () => {
  test("whole pesos, cents and common formats", () => {
    expect(parsePesos("230")).toBe(23000);
    expect(parsePesos("230.5")).toBe(23050);
    expect(parsePesos("230.05")).toBe(23005);
    expect(parsePesos(" $1,230.50 ")).toBe(123050);
    expect(parsePesos("0")).toBe(0);
  });

  test("rejects anything that isn't an amount", () => {
    for (const value of ["", "abc", "-5", "1.234", "12,5", "230,50", "1e3"]) {
      expect(parsePesos(value)).toBeNull();
    }
  });
});

describe("centsToPesosInput", () => {
  test("round trip with parsePesos", () => {
    for (const cents of [0, 23000, 23050, 23005, 123456]) {
      expect(parsePesos(centsToPesosInput(cents))).toBe(cents);
    }
    expect(centsToPesosInput(23000)).toBe("230");
    expect(centsToPesosInput(23050)).toBe("230.50");
  });
});

describe("normalizeMxPhone", () => {
  test("keeps the 10-digit number from common formats", () => {
    expect(normalizeMxPhone("3314596017")).toBe("3314596017");
    expect(normalizeMxPhone("33 1459 6017")).toBe("3314596017");
    expect(normalizeMxPhone("+52 33 1459 6017")).toBe("3314596017");
    expect(normalizeMxPhone("+52 1 33 1459 6017")).toBe("3314596017");
  });

  test("rejects incomplete numbers", () => {
    expect(normalizeMxPhone("331459601")).toBeNull();
    expect(normalizeMxPhone("")).toBeNull();
  });
});

test("timeToInput drops seconds", () => {
  expect(timeToInput("09:00:00")).toBe("09:00");
});
