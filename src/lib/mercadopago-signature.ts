import { createHmac, timingSafeEqual } from "node:crypto";

export type WebhookSignatureInput = {
  signature: string | null; // x-signature header: "ts=1704908010,v1=<hex>"
  requestId: string | null; // x-request-id header
  dataId: string | null; // data.id from the notification URL's query string
  secret: string; // the application's secret key ("clave secreta") in Mercado Pago
};

// The text Mercado Pago signs: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;". Parts
// that are missing are left out. Alphanumeric ids are signed in lowercase.
export function signatureManifest(dataId: string | null, requestId: string | null, ts: string): string {
  const parts = [];
  if (dataId) parts.push(`id:${dataId.toLowerCase()}`);
  if (requestId) parts.push(`request-id:${requestId}`);
  parts.push(`ts:${ts}`);
  return `${parts.join(";")};`;
}

// Same check as Mercado Pago's official SDK (WebhookSignatureValidator): v1 must be the
// HMAC-SHA256 (hex) of the manifest with the secret, compared in constant time.
export function isValidWebhookSignature({ signature, requestId, dataId, secret }: WebhookSignatureInput): boolean {
  if (!signature || !secret) return false;
  const fields = new Map(
    signature.split(",").map((part) => {
      const [key = "", ...value] = part.split("=");
      return [key.trim().toLowerCase(), value.join("=").trim()] as const;
    }),
  );
  const ts = fields.get("ts");
  const v1 = fields.get("v1");
  if (!ts || !/^\d+$/.test(ts) || !v1) return false;

  const expected = createHmac("sha256", secret)
    .update(signatureManifest(dataId?.trim() || null, requestId?.trim() || null, ts))
    .digest("hex");
  return expected.length === v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
