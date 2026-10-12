import { connection } from "next/server";
import { getSupabaseSecretKey } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// What the secret key looks like (never its value), to tell a wrong paste from a wrong project.
function keyKind(key: string | null) {
  if (!key) return "missing";
  if (/^sb_secret_[\w-]+$/.test(key)) return "secret";
  if (key.startsWith("sb_publishable_")) return "publishable";
  if (key.startsWith("eyJ")) return "legacy";
  return "other";
}

// Says which settings are present and whether the secret key is accepted (never their
// values), so the setup can be checked from outside after a deploy.
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
  });
}
