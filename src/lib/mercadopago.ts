import "server-only";
import { z } from "zod";

// Mercado Pago's REST API (Checkout Pro). Field names follow their official Node SDK
// (`mercadopago` 3.x types) and the developer docs for Mexico.

const DEFAULT_API_URL = "https://api.mercadopago.com";
const TIMEOUT_MS = 10_000;

export type MercadoPagoConfig = { accessToken: string; webhookSecret: string; apiUrl: string };

// For now every business is paid with the credentials in the environment (SPEC, "Pagos por
// negocio"). When each business connects its own account, look them up here.
export function getMercadoPagoConfig(): MercadoPagoConfig | null {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!accessToken || !webhookSecret) return null;
  return { accessToken, webhookSecret, apiUrl: process.env.MERCADOPAGO_API_URL?.trim() || DEFAULT_API_URL };
}

// Only cards and Mercado Pago balance, which are approved or rejected right away (SPEC).
// Cash (OXXO and the like), ATM and bank transfers take days to arrive.
export const EXCLUDED_PAYMENT_TYPES = ["ticket", "atm", "bank_transfer"] as const;

export type CheckoutInput = {
  bookingId: string;
  folio: string;
  title: string;
  amountCents: number;
  payerEmail: string | null;
  returnUrl: string; // the customer comes back here whatever happens
  expiresAt: Date; // the end of the booking's hold
  now: Date;
};

// Mexico City has had no daylight saving time since 2022: always UTC-6. Mercado Pago's
// examples send dates with their offset.
export function mexicoIsoDateTime(date: Date): string {
  return new Date(date.getTime() - 6 * 60 * 60 * 1000).toISOString().replace("Z", "-06:00");
}

// Body for POST /checkout/preferences. The amount always comes from the server.
export function preferenceBody(input: CheckoutInput) {
  return {
    items: [
      {
        id: input.folio,
        title: input.title,
        quantity: 1,
        unit_price: input.amountCents / 100,
        currency_id: "MXN",
      },
    ],
    ...(input.payerEmail ? { payer: { email: input.payerEmail } } : {}),
    external_reference: input.bookingId,
    back_urls: { success: input.returnUrl, failure: input.returnUrl, pending: input.returnUrl },
    auto_return: "approved",
    // Approved or rejected, never "pending".
    binary_mode: true,
    payment_methods: {
      excluded_payment_types: EXCLUDED_PAYMENT_TYPES.map((id) => ({ id })),
      installments: 1,
    },
    // Nobody can pay after the hold ends.
    expires: true,
    expiration_date_from: mexicoIsoDateTime(input.now),
    expiration_date_to: mexicoIsoDateTime(input.expiresAt),
  };
}

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request(config: MercadoPagoConfig, path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) {
    throw new MercadoPagoError(
      `Mercado Pago ${init.method ?? "GET"} ${path} answered ${response.status}: ${body.slice(0, 300)}`,
      response.status,
    );
  }
  return JSON.parse(body);
}

const preferenceSchema = z.object({
  id: z.string(),
  init_point: z.url(),
  sandbox_init_point: z.url().nullish(),
});

// Creates the checkout and returns the link to send the customer to.
export async function createCheckout(config: MercadoPagoConfig, input: CheckoutInput) {
  const preference = preferenceSchema.parse(
    await request(config, "/checkout/preferences", {
      method: "POST",
      // A retry with the same booking can't create a second checkout.
      headers: { "X-Idempotency-Key": input.bookingId },
      body: JSON.stringify(preferenceBody(input)),
    }),
  );
  // Old-style test tokens (TEST-...) pay in the sandbox; test accounts' tokens use the normal link.
  const checkoutUrl =
    config.accessToken.startsWith("TEST-") && preference.sandbox_init_point
      ? preference.sandbox_init_point
      : preference.init_point;
  return { preferenceId: preference.id, checkoutUrl };
}

const paymentSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  status: z.string(),
  status_detail: z.string().nullish(),
  external_reference: z.string().nullish(),
  transaction_amount: z.number(),
  currency_id: z.string(),
  date_approved: z.string().nullish(),
});

export type MercadoPagoPayment = z.infer<typeof paymentSchema>;

// What Mercado Pago says about a payment. Never trust a notification or a return URL by
// itself: always ask here.
export async function getPayment(config: MercadoPagoConfig, paymentId: string): Promise<MercadoPagoPayment> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(paymentId)) throw new Error("Invalid Mercado Pago payment id");
  return paymentSchema.parse(await request(config, `/v1/payments/${paymentId}`));
}
