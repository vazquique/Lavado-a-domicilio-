import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, test } from "vitest";
import { asRole, createTestDb, createUser } from "./test-db";

// Bookings paid in cash from the public page, and who can enter a business's panel.

let db: PGlite;
let jbsId: string;
let ownerId: string;
let morning: { id: string; capacity: number };

const asServer = <T>(fn: (tx: Transaction) => Promise<T>) => asRole(db, "service_role", null, fn);
const asOwner = <T>(fn: (tx: Transaction) => Promise<T>) => asRole(db, "authenticated", ownerId, fn);

function cash(overrides: Record<string, unknown> = {}) {
  return {
    business_id: jbsId,
    service_date: "2026-10-20",
    time_slot_id: morning.id,
    capacity_units: 1,
    vehicle_type_id: null,
    zone_id: null,
    customer_name: "Ana López",
    customer_phone: "3312345678",
    customer_email: null,
    address: "Av. Siempre Viva 742",
    address_references: "",
    vehicle_type_name: "Carro normal",
    zone_name: "Capital Norte",
    items: [{ name: "Lavado normal", kind: "base", price_cents: 23000 }],
    subtotal_cents: 23000,
    surcharge_cents: 0,
    total_cents: 23000,
    ...overrides,
  };
}

async function bookCash(tx: Transaction, data: Record<string, unknown>) {
  const { rows } = await tx.query<{ booking_id: string; booking_folio: string }>(
    "select * from public.create_cash_booking($1)",
    [JSON.stringify(data)],
  );
  return rows[0] ?? null;
}

async function access(tx: Transaction) {
  const { rows } = await tx.query<{ email: string; status: string; is_you: boolean }>(
    "select * from public.business_access($1)",
    [jbsId],
  );
  return rows;
}

beforeAll(async () => {
  db = await createTestDb();
  jbsId = (await db.query<{ id: string }>("select id from public.businesses where slug = 'jbsbros'")).rows[0].id;
  ownerId = await createUser(db, "vazquique@gmail.com");
  morning = (
    await db.query<{ id: string; capacity: number }>(
      "select id, capacity from public.time_slots where business_id = $1 order by start_time limit 1",
      [jbsId],
    )
  ).rows[0];
}, 60_000);

describe("cash bookings", () => {
  test("are confirmed right away, with nothing paid and the terms accepted", async () => {
    const booking = await asServer(async (tx) => {
      const created = await bookCash(tx, cash());
      const { rows } = await tx.query<Record<string, unknown>>(
        `select status, source, deposit_cents, balance_cents, time_slot_name, terms_accepted_at is not null as terms,
           hold_expires_at from public.bookings where id = $1`,
        [created?.booking_id],
      );
      return { folio: created?.booking_folio, ...rows[0] };
    });
    expect(booking).toEqual({
      folio: expect.stringMatching(/^JBS-\d+$/),
      status: "confirmed",
      source: "online",
      deposit_cents: 0,
      balance_cents: 23000,
      time_slot_name: "Mañana",
      terms: true,
      hold_expires_at: null,
    });
  });

  test("take places like any booking: a full slot says no", async () => {
    const [first, second] = await asServer(async (tx) => [
      await bookCash(tx, cash({ capacity_units: morning.capacity })),
      await bookCash(tx, cash({ customer_phone: "3399999999" })),
    ]);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  test("release the same customer's unpaid online hold", async () => {
    const status = await asServer(async (tx) => {
      const { rows } = await tx.query<{ booking_id: string }>("select * from public.create_online_booking($1)", [
        JSON.stringify({ ...cash(), time_slot_name: "Mañana", deposit_cents: 11500 }),
      ]);
      await bookCash(tx, cash());
      const held = await tx.query<{ status: string }>("select status from public.bookings where id = $1", [
        rows[0].booking_id,
      ]);
      return held.rows[0].status;
    });
    expect(status).toBe("expired");
  });

  test("only server code can create them", async () => {
    await expect(asRole(db, "anon", null, (tx) => bookCash(tx, cash()))).rejects.toThrow(/permission denied/);
    await expect(asOwner((tx) => bookCash(tx, cash()))).rejects.toThrow(/permission denied/);
  });
});

describe("panel access", () => {
  test("the owner sees who can enter, and is marked as themselves", async () => {
    expect(await asOwner(access)).toEqual([{ email: "vazquique@gmail.com", status: "member", is_you: true }]);
  });

  test("inviting a new email: pending until they first log in, then a member", async () => {
    const pending = await asOwner(async (tx) => {
      const { rows } = await tx.query<{ grant_business_access: string }>(
        "select public.grant_business_access($1, $2)",
        [jbsId, "  Socio@Example.com "],
      );
      return { result: rows[0].grant_business_access, access: await access(tx) };
    });
    expect(pending.result).toBe("invited");
    expect(pending.access).toContainEqual({ email: "socio@example.com", status: "invited", is_you: false });

    // Committed for real this time, then the invited person logs in for the first time.
    await db.query("insert into public.business_invites (business_id, email) values ($1, 'socio@example.com')", [jbsId]);
    const socioId = await createUser(db, "socio@example.com");
    const members = await db.query("select 1 from public.business_members where business_id = $1 and user_id = $2", [
      jbsId,
      socioId,
    ]);
    expect(members.rows).toHaveLength(1);
  });

  test("someone who already has a user becomes a member right away", async () => {
    await createUser(db, "ya-existe@example.com");
    const result = await asOwner(async (tx) => {
      const { rows } = await tx.query<{ grant_business_access: string }>(
        "select public.grant_business_access($1, 'ya-existe@example.com')",
        [jbsId],
      );
      return { granted: rows[0].grant_business_access, access: await access(tx) };
    });
    expect(result.granted).toBe("member");
    expect(result.access).toContainEqual({ email: "ya-existe@example.com", status: "member", is_you: false });
  });

  test("access can be taken away, but nobody removes themselves", async () => {
    const result = await asOwner(async (tx) => {
      await tx.query("select public.grant_business_access($1, 'temporal@example.com')", [jbsId]);
      const revoke = async (email: string) =>
        (
          await tx.query<{ revoke_business_access: boolean }>("select public.revoke_business_access($1, $2)", [
            jbsId,
            email,
          ])
        ).rows[0].revoke_business_access;
      return {
        invite: await revoke("temporal@example.com"),
        self: await revoke("vazquique@gmail.com"),
        access: await access(tx),
      };
    });
    expect(result.invite).toBe(true);
    expect(result.self).toBe(false);
    expect(result.access.map((row) => row.email)).not.toContain("temporal@example.com");
    expect(result.access.map((row) => row.email)).toContain("vazquique@gmail.com");
  });

  test("other people can't see or change this business's access, and bad emails are refused", async () => {
    const strangerId = await createUser(db, "extrano@example.com");
    const stranger = <T>(fn: (tx: Transaction) => Promise<T>) => asRole(db, "authenticated", strangerId, fn);
    expect(await stranger(access)).toEqual([]);
    await expect(
      stranger((tx) => tx.query("select public.grant_business_access($1, 'yo@example.com')", [jbsId])),
    ).rejects.toThrow(/not a member/);
    await expect(
      asOwner((tx) => tx.query("select public.grant_business_access($1, 'no es un correo')", [jbsId])),
    ).rejects.toThrow(/invalid email/);
    await expect(
      asRole(db, "anon", null, (tx) => tx.query("select * from public.business_access($1)", [jbsId])),
    ).rejects.toThrow(/permission denied/);
  });
});
