import "server-only";
import { z } from "zod";

const supabasePublicEnvSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(1),
});

export type SupabasePublicEnv = z.infer<typeof supabasePublicEnvSchema>;

// Returns null while the Supabase project is not connected yet, so pages can
// show a friendly message instead of crashing.
export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const parsed = supabasePublicEnvSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return parsed.success ? parsed.data : null;
}

// The secret key bypasses RLS. Only server code that has already checked who is
// asking may use it.
export function getSupabaseSecretKey(): string | null {
  // Trimmed: a key pasted from a phone can carry a space or a line break.
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  return key ? key : null;
}
