import type { Quote } from "./quote";

export const PAYMENT_OPTIONS = ["deposit", "full"] as const;
export type PaymentOption = (typeof PAYMENT_OPTIONS)[number];

export type PaymentChoice = { option: PaymentOption; amountCents: number };

// What the customer can pay online now: the deposit, or everything at once. When the
// deposit is zero or already the whole total, paying everything is the only choice.
export function paymentChoices(quote: Pick<Quote, "totalCents" | "depositCents">): PaymentChoice[] {
  const full: PaymentChoice = { option: "full", amountCents: quote.totalCents };
  return quote.depositCents > 0 && quote.depositCents < quote.totalCents
    ? [{ option: "deposit", amountCents: quote.depositCents }, full]
    : [full];
}

// Amount to charge now for the chosen option, or null when that option isn't offered.
export function amountDueNow(quote: Pick<Quote, "totalCents" | "depositCents">, option: PaymentOption): number | null {
  return paymentChoices(quote).find((choice) => choice.option === option)?.amountCents ?? null;
}
