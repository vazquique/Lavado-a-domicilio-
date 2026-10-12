import "server-only";
import { getSupabasePublicEnv } from "@/lib/env";

// Public URL of a logo stored in the "logos" bucket.
export function logoUrl(path: string | null): string | null {
  const env = getSupabasePublicEnv();
  if (!path || !env) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${env.url}/storage/v1/object/public/logos/${encoded}`;
}
