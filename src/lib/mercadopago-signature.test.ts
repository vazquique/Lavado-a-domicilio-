import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { isValidWebhookSignature, signatureManifest } from "./mercadopago-signature";

const secret = "test-secret";
const sign = (manifest: string) => createHmac("sha256", secret).update(manifest).digest("hex");

describe("signatureManifest", () => {
  test("follows Mercado Pago's template", () => {
    expect(signatureManifest("123456", "bb56a2f1", "1704908010")).toBe("id:123456;request-id:bb56a2f1;ts:1704908010;");
  });

  test("leaves out missing parts and lowercases alphanumeric ids", () => {
    expect(signatureManifest(null, "bb56a2f1", "1")).toBe("request-id:bb56a2f1;ts:1;");
    expect(signatureManifest("ORD01ABC", null, "1")).toBe("id:ord01abc;ts:1;");
  });
});

describe("isValidWebhookSignature", () => {
  const valid = {
    signature: `ts=1704908010,v1=${sign("id:123456;request-id:bb56a2f1;ts:1704908010;")}`,
    requestId: "bb56a2f1",
    dataId: "123456",
    secret,
  };

  test("accepts a correct signature", () => {
    expect(isValidWebhookSignature(valid)).toBe(true);
    expect(isValidWebhookSignature({ ...valid, signature: ` ts=1704908010 , v1=${valid.signature.split("v1=")[1]}` })).toBe(
      true,
    );
  });

  test("rejects a different payment, request, secret or timestamp", () => {
    expect(isValidWebhookSignature({ ...valid, dataId: "999999" })).toBe(false);
    expect(isValidWebhookSignature({ ...valid, requestId: "other" })).toBe(false);
    expect(isValidWebhookSignature({ ...valid, secret: "other" })).toBe(false);
    expect(isValidWebhookSignature({ ...valid, signature: valid.signature.replace("1704908010", "1704908011") })).toBe(
      false,
    );
  });

  test("rejects missing or malformed headers", () => {
    expect(isValidWebhookSignature({ ...valid, signature: null })).toBe(false);
    expect(isValidWebhookSignature({ ...valid, signature: "v1=abc" })).toBe(false);
    expect(isValidWebhookSignature({ ...valid, signature: "ts=abc,v1=abc" })).toBe(false);
    expect(isValidWebhookSignature({ ...valid, signature: "ts=1704908010" })).toBe(false);
    expect(isValidWebhookSignature({ ...valid, secret: "" })).toBe(false);
  });
});
