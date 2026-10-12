import type { NextRequest } from "next/server";
import { getMercadoPagoConfig } from "@/lib/mercadopago";
import { isValidWebhookSignature } from "@/lib/mercadopago-signature";
import { syncMercadoPagoPayment } from "@/lib/online-bookings";

// Mercado Pago calls this when a payment changes (configured in "Tus integraciones" →
// Webhooks, event "Pagos"). The notification only says which payment changed: after
// checking its signature we ask Mercado Pago about that payment. Recording it twice is
// harmless, so retries are fine. Any answer other than 200 makes Mercado Pago retry later.
export async function POST(request: NextRequest) {
  const config = getMercadoPagoConfig();
  if (!config) return new Response("Mercado Pago is not configured", { status: 503 });

  const dataId = request.nextUrl.searchParams.get("data.id");
  const signed = isValidWebhookSignature({
    signature: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
    secret: config.webhookSecret,
  });
  if (!signed) return new Response("Invalid signature", { status: 401 });

  const body: { type?: unknown } = await request.json().catch(() => ({}));
  const type = request.nextUrl.searchParams.get("type") ?? body.type;
  // Other topics (orders, chargebacks...) need nothing from us yet.
  if (type !== "payment" || !dataId) return new Response(null, { status: 200 });

  try {
    await syncMercadoPagoPayment(dataId);
  } catch (error) {
    console.error("Could not process Mercado Pago payment", dataId, error);
    return new Response("Please retry", { status: 500 });
  }
  return new Response(null, { status: 200 });
}
