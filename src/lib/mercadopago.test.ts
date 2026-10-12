import { describe, expect, test } from "vitest";
import { mexicoIsoDateTime, preferenceBody } from "./mercadopago";

describe("mexicoIsoDateTime", () => {
  test("writes the time in Mexico City with its offset", () => {
    expect(mexicoIsoDateTime(new Date("2026-10-20T18:30:00.000Z"))).toBe("2026-10-20T12:30:00.000-06:00");
  });
});

describe("preferenceBody", () => {
  const input = {
    bookingId: "6f1c0f6e-2a5b-4f43-9d55-0d6f4d3a1b2c",
    folio: "JBS-1042",
    title: "Anticipo · Lavado normal (JBS-1042)",
    amountCents: 31550,
    payerEmail: null,
    returnUrl: "https://example.com/jbsbros/reserva/6f1c0f6e-2a5b-4f43-9d55-0d6f4d3a1b2c",
    expiresAt: new Date("2026-10-20T19:00:00.000Z"),
    now: new Date("2026-10-20T18:30:00.000Z"),
  };

  test("charges the server's amount in pesos, once, in MXN", () => {
    expect(preferenceBody(input).items).toEqual([
      { id: "JBS-1042", title: input.title, quantity: 1, unit_price: 315.5, currency_id: "MXN" },
    ]);
  });

  test("links the payment to the booking and expires with the hold", () => {
    const body = preferenceBody(input);
    expect(body.external_reference).toBe(input.bookingId);
    expect(body.back_urls).toEqual({ success: input.returnUrl, failure: input.returnUrl, pending: input.returnUrl });
    expect(body).toMatchObject({
      auto_return: "approved",
      binary_mode: true,
      expires: true,
      expiration_date_from: "2026-10-20T12:30:00.000-06:00",
      expiration_date_to: "2026-10-20T13:00:00.000-06:00",
    });
  });

  test("only cards and Mercado Pago balance", () => {
    expect(preferenceBody(input).payment_methods.excluded_payment_types).toEqual([
      { id: "ticket" },
      { id: "atm" },
      { id: "bank_transfer" },
    ]);
  });

  test("sends the payer's email only when there is one", () => {
    expect(preferenceBody(input)).not.toHaveProperty("payer");
    expect(preferenceBody({ ...input, payerEmail: "ana@example.com" }).payer).toEqual({ email: "ana@example.com" });
  });
});
