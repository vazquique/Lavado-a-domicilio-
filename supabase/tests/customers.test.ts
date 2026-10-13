import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, test } from "vitest";
import { asRole, createTestDb, createUser } from "./test-db";

// Customers saved once (linked to every booking by phone) and regular customers' plans,
// whose bookings are created ahead automatically.

let db: PGlite;
let jbsId: string;
let ownerId: string;
let morning: { id: string; capacity: number };

const asOwner = <T>(fn: (tx: Transaction) => Promise<T>) => asRole(db, "authenticated", ownerId, fn);
const TODAY = "(now() at time zone 'America/Mexico_City')::date";

function booking(overrides: Record<string, unknown> = {}) {
  return {
    business_id: jbsId,
    service_date: "2026-12-01",
    time_slot_id: morning.id,
    capacity_units: 1,
    vehicle_type_id: null,
    zone_id: null,
    customer_name: "Ana López",
    customer_phone: "3312345678",
    customer_email: null,
    address: "Av. Siempre Viva 742",
    address_references: "Portón negro",
    vehicle_type_name: "Carro normal",
    zone_name: null,
    items: [{ name: "Lavado normal", kind: "base", price_cents: 23000 }],
    subtotal_cents: 23000,
    surcharge_cents: 0,
    total_cents: 23000,
    ...overrides,
  };
}

async function manual(tx: Transaction, data: Record<string, unknown>) {
  const { rows } = await tx.query<{ booking_id: string }>("select * from public.create_manual_booking($1)", [
    JSON.stringify(data),
  ]);
  return rows[0].booking_id;
}

async function cash(tx: Transaction, data: Record<string, unknown>) {
  const { rows } = await tx.query<{ booking_id: string }>("select * from public.create_cash_booking($1)", [
    JSON.stringify(data),
  ]);
  return rows[0].booking_id;
}

async function customerOf(tx: Transaction, bookingId: string) {
  const { rows } = await tx.query<{ id: string; name: string; address: string; email: string | null }>(
    `select c.id, c.name, c.address, c.email from public.bookings b
     join public.customers c on c.id = b.customer_id where b.id = $1`,
    [bookingId],
  );
  return rows[0];
}

// A plan for Ana every `weeks` weeks from `startsIn` days from today, in the morning.
async function plan(tx: Transaction, { weeks = 2, startsIn = 1, units = 1 } = {}) {
  const customerId = await customerOf(tx, await manual(tx, booking({ service_date: "2027-06-01" }))).then((c) => c.id);
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.recurring_plans (business_id, customer_id, every_weeks, starts_on, time_slot_id,
       vehicle_type_name, items, subtotal_cents, total_cents, capacity_units, address)
     values ($1, $2, $3, ${TODAY} + $4::integer, $5, 'Carro normal',
       '[{"name": "Lavado normal", "kind": "base", "price_cents": 23000}]', 23000, 23000, $6, 'Av. Siempre Viva 742')
     returning id`,
    [jbsId, customerId, weeks, startsIn, morning.id, units],
  );
  return rows[0].id;
}

async function extend(tx: Transaction, days: number) {
  const { rows } = await tx.query<{ extend_recurring_bookings: number }>(
    `select public.extend_recurring_bookings($1, ${TODAY} + $2::integer)`,
    [jbsId, days],
  );
  return rows[0].extend_recurring_bookings;
}

async function planDates(tx: Transaction, planId: string) {
  const { rows } = await tx.query<{ offset: number; status: string; source: string; deposit_cents: number }>(
    `select service_date - ${TODAY} as offset, status, source, deposit_cents
     from public.bookings where recurring_plan_id = $1 order by recurring_date`,
    [planId],
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

describe("customers", () => {
  test("every booking is linked to its customer by phone, created the first time", async () => {
    const result = await asOwner(async (tx) => {
      const first = await manual(tx, booking());
      const second = await manual(tx, booking({ service_date: "2026-12-08" }));
      const other = await manual(tx, booking({ customer_phone: "3399999999", customer_name: "Beto" }));
      return {
        same: (await customerOf(tx, first)).id === (await customerOf(tx, second)).id,
        different: (await customerOf(tx, first)).id !== (await customerOf(tx, other)).id,
      };
    });
    expect(result).toEqual({ same: true, different: true });
  });

  test("the owner's bookings update the customer; the public page only fills what's missing", async () => {
    const result = await asOwner(async (tx) => {
      await manual(tx, booking({ customer_name: "Ana López", address: "Calle Real 1" }));
      // Someone types Ana's phone on the public page with other data (run as server code).
      await tx.exec("set local role service_role");
      const online = await cash(tx, booking({ customer_name: "Otra persona", address: "Otra calle", customer_email: "ana@example.com" }));
      await tx.exec("set local role authenticated");
      const afterOnline = await customerOf(tx, online);
      const later = await manual(tx, booking({ customer_name: "Ana L.", address: "Calle Nueva 2", service_date: "2026-12-15" }));
      return { afterOnline, afterOwner: await customerOf(tx, later) };
    });
    expect(result.afterOnline).toMatchObject({ name: "Ana López", address: "Calle Real 1", email: "ana@example.com" });
    expect(result.afterOwner).toMatchObject({ name: "Ana L.", address: "Calle Nueva 2", email: "ana@example.com" });
  });

  test("the list shows services so far, the next one and what they spent", async () => {
    const summary = await asOwner(async (tx) => {
      const done = await manual(tx, booking({ service_date: "2026-11-02" }));
      await tx.query("update public.bookings set status = 'completed' where id = $1", [done]);
      const upcoming = await manual(tx, booking({ service_date: "2099-01-05" }));
      const { rows } = await tx.query(
        "select services, last_service::text, next_service::text, spent_cents::int, regular from public.customer_summaries($1) where customer_id = $2",
        [jbsId, (await customerOf(tx, upcoming)).id],
      );
      return rows[0];
    });
    expect(summary).toEqual({
      services: 2,
      last_service: "2026-11-02",
      next_service: "2099-01-05",
      spent_cents: 23000,
      regular: false,
    });
  });

  test("customers are private to the business", async () => {
    const strangerId = await createUser(db, "extrano@example.com");
    const seen = await asOwner(async (tx) => {
      await manual(tx, booking());
      // Same transaction, now as someone else.
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: strangerId, role: "authenticated" }),
      ]);
      const { rows } = await tx.query("select * from public.customers");
      return rows.length;
    });
    expect(seen).toBe(0);
    await expect(asRole(db, "anon", null, (tx) => tx.query("select * from public.customers"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("regular customers", () => {
  test("a plan every 2 weeks creates its bookings ahead, once", async () => {
    const result = await asOwner(async (tx) => {
      const planId = await plan(tx, { weeks: 2, startsIn: 1 });
      await tx.exec("set local role service_role");
      const created = await extend(tx, 30);
      const again = await extend(tx, 30);
      return { created, again, dates: await planDates(tx, planId) };
    });
    expect(result.created).toBe(3);
    expect(result.again).toBe(0);
    expect(result.dates).toEqual([
      { offset: 1, status: "confirmed", source: "recurring", deposit_cents: 0 },
      { offset: 15, status: "confirmed", source: "recurring", deposit_cents: 0 },
      { offset: 29, status: "confirmed", source: "recurring", deposit_cents: 0 },
    ]);
  });

  test("a plan that started weeks ago continues on its rhythm from today", async () => {
    const offsets = await asOwner(async (tx) => {
      const planId = await plan(tx, { weeks: 1, startsIn: -10 });
      await tx.exec("set local role service_role");
      await extend(tx, 14);
      return (await planDates(tx, planId)).map((row) => row.offset);
    });
    expect(offsets).toEqual([4, 11]);
  });

  test("moved or cancelled dates aren't created again; blocked days and full slots are skipped", async () => {
    const result = await asOwner(async (tx) => {
      const planId = await plan(tx, { weeks: 1, startsIn: 1 });
      await tx.query(`insert into public.blocked_dates (business_id, date) values ($1, ${TODAY} + 8)`, [jbsId]);
      await tx.exec("set local role service_role");
      // Fill the morning of day 15 before the plan gets there.
      await tx.query(
        `insert into public.bookings (business_id, status, source, service_date, time_slot_id, customer_name,
           customer_phone, address, vehicle_type_name, time_slot_name, items, subtotal_cents, total_cents,
           deposit_cents, capacity_units)
         values ($1, 'confirmed', 'manual', ${TODAY} + 15, $2, 'Otro', '3300000000', 'Calle', 'Carro normal', 'Mañana',
           '[]', 23000, 23000, 0, $3)`,
        [jbsId, morning.id, morning.capacity],
      );
      await extend(tx, 22);
      const first = await planDates(tx, planId);
      // The owner moves the first one and cancels the next one.
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.bookings where recurring_plan_id = $1 order by recurring_date",
        [planId],
      );
      await tx.query(`update public.bookings set service_date = ${TODAY} + 2 where id = $1`, [rows[0].id]);
      await tx.query("update public.bookings set status = 'cancelled' where id = $1", [rows[1].id]);
      const again = await extend(tx, 22);
      return { first: first.map((row) => row.offset), again };
    });
    expect(result.first).toEqual([1, 22]);
    expect(result.again).toBe(0);
  });

  test("only server code creates plan bookings; plans are private to the business", async () => {
    await expect(asOwner((tx) => extend(tx, 30))).rejects.toThrow(/permission denied/);
    const strangerId = await createUser(db, "otro-extrano@example.com");
    const seen = await asOwner(async (tx) => {
      await plan(tx);
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: strangerId, role: "authenticated" }),
      ]);
      const { rows } = await tx.query("select * from public.recurring_plans");
      return rows.length;
    });
    expect(seen).toBe(0);
  });
});
