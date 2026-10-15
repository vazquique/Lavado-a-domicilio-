import { connection } from "next/server";
import { getGmailConfig, gmailTransport } from "@/lib/email";
import { getSupabaseSecretKey } from "@/lib/env";
import { getMercadoPagoConfig } from "@/lib/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";

// What the secret key looks like (never its value), to tell a wrong paste from a wrong project.
function keyKind(key: string | null) {
  if (!key) return "missing";
  if (/^sb_secret_[\w-]+$/.test(key)) return "secret";
  if (key.startsWith("sb_publishable_")) return "publishable";
  if (key.startsWith("eyJ")) return "legacy";
  return "other";
}

// Whether Mercado Pago accepts the access token, and whether it belongs to a test account
// (the owner asked for test credentials until he says otherwise).
async function mercadoPagoStatus() {
  const config = getMercadoPagoConfig();
  if (!config) return { mercadoPago: false };
  const tokenKind = /^(TEST|APP_USR)-[\w-]+$/.test(config.accessToken) ? config.accessToken.split("-")[0] : "other";
  try {
    const response = await fetch(`${config.apiUrl}/users/me`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    const me: { email?: unknown; tags?: unknown } | null = response.ok ? await response.json() : null;
    const testAccount =
      tokenKind === "TEST" ||
      (Array.isArray(me?.tags) && me.tags.includes("test_user")) ||
      (typeof me?.email === "string" && me.email.endsWith("@testuser.com"));
    return { mercadoPago: true, mercadoPagoTokenKind: tokenKind, mercadoPagoWorks: response.ok, mercadoPagoTestAccount: testAccount };
  } catch {
    return { mercadoPago: true, mercadoPagoTokenKind: tokenKind, mercadoPagoWorks: false };
  }
}

// Whether Gmail accepts the business's address and app password: it logs in without
// sending anything.
async function gmailStatus() {
  const gmail = getGmailConfig();
  if (!gmail) return { gmail: false };
  try {
    await gmailTransport(gmail).verify();
    return { gmail: true, gmailWorks: true };
  } catch {
    return { gmail: true, gmailWorks: false };
  }
}

// Says which settings are present and whether the keys are accepted (never their values),
// so the setup can be checked from outside after a deploy.
export async function GET() {
  await connection();
  const admin = createAdminClient();
  // A request that reads no rows: it only fails if Supabase rejects the key.
  const secretKeyWorks = admin
    ? !(await admin.from("business_invites").select("email", { head: true })).error
    : false;
  return Response.json({
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    secretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
    secretKeyKind: keyKind(getSupabaseSecretKey()),
    secretKeyWorks,
    ...(await mercadoPagoStatus()),
    ...(await gmailStatus()),
    resend: Boolean(process.env.RESEND_API_KEY?.trim()),
  });
}
