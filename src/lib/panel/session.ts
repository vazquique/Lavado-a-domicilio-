import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createSessionClient } from "@/lib/supabase/server";

export type PanelBusiness = { id: string; slug: string; name: string };

export type PanelSession = {
  supabase: SupabaseClient;
  userId: string;
  email: string | null;
  business: PanelBusiness | null;
};

// Who is using the panel and which business they manage. Verifies the session
// token (getClaims) on every request and sends signed-out users to the login page.
export const getPanelSession = cache(async (): Promise<PanelSession> => {
  // Always per request: the session can't be part of a prerendered shell.
  await connection();
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/panel/entrar");

  const { data: membership, error } = await supabase
    .from("business_members")
    .select("businesses (id, slug, name)")
    .eq("user_id", claims.sub)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const business = membership?.businesses as unknown as PanelBusiness | null | undefined;
  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    business: business ?? null,
  };
});

// For Server Actions: the signed-in user's business, or an error if they have none.
export async function requirePanelBusiness(): Promise<{ supabase: SupabaseClient; business: PanelBusiness }> {
  const { supabase, business } = await getPanelSession();
  if (!business) throw new Error("This user does not manage any business");
  return { supabase, business };
}
