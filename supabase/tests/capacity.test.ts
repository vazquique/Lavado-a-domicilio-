import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, test } from "vitest";
import { asRole, createTestDb } from "./test-db";

let db: PGlite;
let jbsId: string;
let morningId: string;
let afternoonId: string;

async function book(slotId: string, units: number, status: string, holdMinutes = 30) {
  await db.query(
    `insert into public.bookings (
       business_id, status, source, service_date, time_slot_id, customer_name, customer_phone, address,
       vehicle_type_name, time_slot_name, items, subtotal_cents, surcharge_cents, total_cents, deposit_cents,
       hold_expires_at, capacity_units
     ) values ($1, $2, 'online', '2026-10-20', $3, 'Cliente', '3312345678', 'Calle 1', 'Carro normal', 'Mañana',
       '[]', 23000, 0, 23000, 11500, now() + make_interval(mins => $4), $5)`,
    [jbsId, status, slotId, holdMinutes, units],
  );
}

beforeAll(async () => {
  db = await createTestDb();
  jbsId = (await db.query<{ id: string }>("select id from public.businesses where slug = 'jbsbros'")).rows[0].id;
  const slots = await db.query<{ id: string; name: string }>(
    "select id, name from public.time_slots where business_id = $1",
    [jbsId],
  );
  morningId = slots.rows.find((slot) => slot.name === "Mañana")!.id;
  afternoonId = slots.rows.find((slot) => slot.name === "Tarde")!.id;
}, 60_000);

describe("places per service", () => {
  test("JB's Bros: normal wash 1, Full detailing 3, extras 0", async () => {
    const { rows } = await db.query<{ name: string; kind: string; capacity_units: number }>(
      "select name, kind, capacity_units from public.services where business_id = $1",
      [jbsId],
    );
    expect(rows.find((row) => row.name === "Lavado normal")?.capacity_units).toBe(1);
    expect(rows.find((row) => row.name === "Full detailing")?.capacity_units).toBe(3);
    expect(rows.filter((row) => row.kind === "extra").every((row) => row.capacity_units === 0)).toBe(true);
  });
});

describe("slot_usage", () => {
  test("counts taken places per slot, including unexpired holds only", async () => {
    await book(morningId, 1, "confirmed");
    await book(morningId, 2, "pending_payment", 30);
    await book(morningId, 3, "pending_payment", -5); // expired hold: frees its places
    await book(morningId, 1, "cancelled");
    await book(afternoonId, 3, "completed");

    const usage = await asRole(db, "anon", null, async (tx) => {
      const { rows } = await tx.query<{ time_slot_id: string; used_units: number }>(
        "select time_slot_id, used_units from public.slot_usage($1, '2026-10-01', '2026-10-31')",
        [jbsId],
      );
      return Object.fromEntries(rows.map((row) => [row.time_slot_id, row.used_units]));
    });
    expect(usage).toEqual({ [morningId]: 3, [afternoonId]: 3 });
  });

  test("the public can't read the bookings themselves", async () => {
    await expect(asRole(db, "anon", null, (tx) => tx.query("select * from public.bookings"))).rejects.toThrow(
      /permission denied/,
    );
  });

  test("refuses huge date ranges", async () => {
    const { rows } = await db.query("select * from public.slot_usage($1, '2026-01-01', '2028-01-01')", [jbsId]);
    expect(rows).toEqual([]);
  });
});
