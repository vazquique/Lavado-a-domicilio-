import { describe, expect, test } from "vitest";
import { formatMXN } from "./money";

describe("formatMXN", () => {
  test("whole pesos without decimals", () => {
    expect(formatMXN(15000)).toBe("$150");
    expect(formatMXN(0)).toBe("$0");
  });

  test("thousands separator and cents", () => {
    expect(formatMXN(123456)).toBe("$1,234.56");
    expect(formatMXN(15050)).toBe("$150.50");
  });
});
