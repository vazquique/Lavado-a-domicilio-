import { describe, expect, test } from "vitest";
import { amountDueNow, paymentChoices } from "./payment-options";

describe("paymentChoices", () => {
  test("offers the deposit or everything", () => {
    expect(paymentChoices({ totalCents: 63000, depositCents: 31500 })).toEqual([
      { option: "deposit", amountCents: 31500 },
      { option: "full", amountCents: 63000 },
    ]);
  });

  test("only everything when the deposit is the whole total or zero", () => {
    expect(paymentChoices({ totalCents: 23000, depositCents: 23000 })).toEqual([{ option: "full", amountCents: 23000 }]);
    expect(paymentChoices({ totalCents: 23000, depositCents: 0 })).toEqual([{ option: "full", amountCents: 23000 }]);
  });
});

describe("amountDueNow", () => {
  test("is the amount of the chosen option", () => {
    expect(amountDueNow({ totalCents: 63000, depositCents: 31500 }, "deposit")).toBe(31500);
    expect(amountDueNow({ totalCents: 63000, depositCents: 31500 }, "full")).toBe(63000);
  });

  test("is null for an option that isn't offered", () => {
    expect(amountDueNow({ totalCents: 23000, depositCents: 0 }, "deposit")).toBeNull();
  });
});
