import { connection } from "next/server";

// Says which settings are present (never their values), so the setup can be
// checked from outside after a deploy.
export async function GET() {
  await connection();
  return Response.json({
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    secretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
  });
}
