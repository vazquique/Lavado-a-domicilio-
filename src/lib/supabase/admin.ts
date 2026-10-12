import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, getSupabaseSecretKey } from "@/lib/env";

// Bypasses RLS. Use only after checking on the server who is asking and what
// they may do; never pass data from this client to the browser unfiltered.
export function createAdminClient(): SupabaseClient | null {
  const env = getSupabasePublicEnv();
  const secretKey = getSupabaseSecretKey();
  if (!env || !secretKey) return null;
  return createClient(env.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
