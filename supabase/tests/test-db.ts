import type { PGlite, Transaction } from "@electric-sql/pglite";
import { createLocalDb } from "../local/db.mjs";

// Fresh in-memory Postgres with all migrations applied (see supabase/local/db.mjs).
export async function createTestDb(): Promise<PGlite> {
  return createLocalDb();
}

type ApiRole = "anon" | "authenticated" | "service_role";

// Runs `fn` the way a Data API request would: as the given role, with the
// given user id in the JWT claims. Always rolled back, so tests stay isolated.
export async function asRole<T>(
  db: PGlite,
  role: ApiRole,
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  let result: T | undefined;
  const rollback = new Error("rollback");
  try {
    await db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId, role }),
      ]);
      await tx.exec(`set local role ${role}`);
      result = await fn(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return result as T;
}

// Like Supabase's admin createUser with email_confirm: true.
export async function createUser(db: PGlite, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id",
    [email],
  );
  return rows[0].id;
}
