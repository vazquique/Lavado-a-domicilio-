import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/env";

// Client tied to the signed-in user's cookies: every query runs with their
// permissions (RLS as `authenticated`). Create one per request.
export async function createSessionClient() {
  const env = getSupabasePublicEnv();
  if (!env) throw new Error("Supabase is not configured");
  const cookieStore = await cookies();

  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which can't write cookies.
          // The proxy refreshes the session instead.
        }
      },
    },
  });
}
