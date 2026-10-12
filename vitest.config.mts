import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts", "supabase/tests/**/*.test.ts"],
    // Database tests start an in-memory Postgres (PGlite), which takes a few seconds.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
