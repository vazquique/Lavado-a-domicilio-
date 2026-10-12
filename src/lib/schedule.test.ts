import { describe, expect, test } from "vitest";
import { formatWorkingDays } from "./schedule";

describe("formatWorkingDays", () => {
  test("all seven days", () => {
    expect(formatWorkingDays([1, 2, 3, 4, 5, 6, 7])).toBe("Todos los días");
  });

  test("lists the days in order", () => {
    expect(formatWorkingDays([6, 1, 2])).toBe("Lunes, martes y sábado");
    expect(formatWorkingDays([7])).toBe("Domingo");
  });
});
