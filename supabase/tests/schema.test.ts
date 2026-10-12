import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, test } from "vitest";
import { asRole, createTestDb, createUser } from "./test-db";

let db: PGlite;
let jbsId: string;
let otherId: string;
let jbsSlotId: string;
let otherSlotId: string;
let ownerId: string;
let strangerId: string;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<T>(sql, params);
  return rows[0];
}

async function insertBooking(businessId: string, slotId: string) {
  return one<{ folio: string }>(
    `insert into public.bookings (
       business_id, status, source, service_date, time_slot_id, customer_name, customer_phone,
       address, vehicle_type_name, time_slot_name, items, subtotal_cents, surcharge_cents,
       total_cents, deposit_cents, hold_expires_at
     ) values (
       $1, 'pending_payment', 'online', '2026-10-20', $2, 'Cliente Prueba', '3312345678',
       'Calle 1 #2, Zapopan', 'Auto', 'Mañana', '[]', 15000, 0, 15000, 4500, now() + interval '30 minutes'
     ) returning folio`,
    [businessId, slotId],
  );
}

beforeAll(async () => {
  db = await createTestDb();
  jbsId = (await one<{ id: string }>("select id from public.businesses where slug = 'jbsbros'")).id;
  otherId = (
    await one<{ id: string }>(
      `insert into public.businesses (slug, name, folio_prefix) values ('otro-lavado', 'Otro Lavado', 'OTR')
       returning id`,
    )
  ).id;
  jbsSlotId = (
    await one<{ id: string }>("select id from public.time_slots where business_id = $1 limit 1", [jbsId])
  ).id;
  otherSlotId = (
    await one<{ id: string }>(
      `insert into public.time_slots (business_id, name, start_time, end_time, capacity)
       values ($1, 'Mañana', '09:00', '13:00', 1) returning id`,
      [otherId],
    )
  ).id;
  ownerId = await createUser(db, "owner@example.com");
  strangerId = await createUser(db, "stranger@example.com");
  await db.query("insert into public.business_members (business_id, user_id) values ($1, $2)", [
    jbsId,
    ownerId,
  ]);
}, 60_000);

describe("schema", () => {
  test("RLS is enabled on every public table", async () => {
    const { rows } = await db.query<{ relname: string }>(
      `select c.relname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });

  test("JB's Bros starts with a complete price table", async () => {
    const counts = await one<Record<string, number>>(
      `select
         (select count(*)::int from public.vehicle_types where business_id = $1) as vehicle_types,
         (select count(*)::int from public.services where business_id = $1) as services,
         (select count(*)::int from public.service_prices where business_id = $1) as prices,
         (select count(*)::int from public.zones where business_id = $1) as zones,
         (select count(*)::int from public.time_slots where business_id = $1) as time_slots`,
      [jbsId],
    );
    expect(counts).toEqual({ vehicle_types: 3, services: 5, prices: 15, zones: 4, time_slots: 2 });
  });
});

describe("public visitor (anon)", () => {
  test("can read the catalog of an active business", async () => {
    const names = await asRole(db, "anon", null, async (tx) => {
      const { rows } = await tx.query<{ name: string }>(
        "select name from public.services where business_id = $1 order by sort_order",
        [jbsId],
      );
      return rows.map((row) => row.name);
    });
    expect(names).toContain("Lavado exterior");
  });

  test("cannot read bookings", async () => {
    await expect(
      asRole(db, "anon", null, (tx) => tx.query("select * from public.bookings")),
    ).rejects.toThrow(/permission denied/);
  });

  test("cannot change the catalog", async () => {
    await expect(
      asRole(db, "anon", null, (tx) =>
        tx.query("update public.service_prices set price_cents = 1 where business_id = $1", [jbsId]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  test("does not see inactive businesses or their catalog", async () => {
    await db.query("update public.businesses set active = false where id = $1", [otherId]);
    const visible = await asRole(db, "anon", null, async (tx) => {
      const businesses = await tx.query("select id from public.businesses where id = $1", [otherId]);
      const slots = await tx.query("select id from public.time_slots where business_id = $1", [otherId]);
      return businesses.rows.length + slots.rows.length;
    });
    await db.query("update public.businesses set active = true where id = $1", [otherId]);
    expect(visible).toBe(0);
  });
});

describe("business owner", () => {
  test("can manage their own catalog", async () => {
    const name = await asRole(db, "authenticated", ownerId, async (tx) => {
      const { rows } = await tx.query<{ name: string }>(
        `insert into public.zones (business_id, name, surcharge_cents) values ($1, 'Tonalá', 6000)
         returning name`,
        [jbsId],
      );
      return rows[0].name;
    });
    expect(name).toBe("Tonalá");
  });

  test("cannot add to another business's catalog", async () => {
    await expect(
      asRole(db, "authenticated", ownerId, (tx) =>
        tx.query("insert into public.zones (business_id, name) values ($1, 'Intrusa')", [otherId]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  test("cannot edit another business's catalog", async () => {
    const changed = await asRole(db, "authenticated", ownerId, async (tx) => {
      const result = await tx.query("update public.time_slots set capacity = 99 where business_id = $1", [
        otherId,
      ]);
      return result.affectedRows;
    });
    expect(changed).toBe(0);
  });

  test("can edit settings but not slug, folio or active flag", async () => {
    const name = await asRole(db, "authenticated", ownerId, async (tx) => {
      const { rows } = await tx.query<{ name: string }>(
        "update public.businesses set name = 'JB Bros' where id = $1 returning name",
        [jbsId],
      );
      return rows[0].name;
    });
    expect(name).toBe("JB Bros");

    for (const column of ["slug = 'robado'", "folio_counter = 0", "active = false"]) {
      await expect(
        asRole(db, "authenticated", ownerId, (tx) =>
          tx.query(`update public.businesses set ${column} where id = $1`, [jbsId]),
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });

  test("sees only their own business's bookings", async () => {
    await insertBooking(jbsId, jbsSlotId);
    await insertBooking(otherId, otherSlotId);
    const businessIds = await asRole(db, "authenticated", ownerId, async (tx) => {
      const { rows } = await tx.query<{ business_id: string }>("select business_id from public.bookings");
      return new Set(rows.map((row) => row.business_id));
    });
    expect([...businessIds]).toEqual([jbsId]);
  });

  test("a user without a business sees nothing private", async () => {
    const count = await asRole(db, "authenticated", strangerId, async (tx) => {
      const { rows } = await tx.query("select id from public.bookings");
      return rows.length;
    });
    expect(count).toBe(0);
  });
});

describe("bookings", () => {
  test("get a short folio per business, in sequence", async () => {
    const first = await insertBooking(jbsId, jbsSlotId);
    const second = await insertBooking(jbsId, jbsSlotId);
    const otherBusiness = await insertBooking(otherId, otherSlotId);

    const firstNumber = Number(first.folio.replace("JBS-", ""));
    expect(first.folio).toMatch(/^JBS-\d{4}$/);
    expect(second.folio).toBe(`JBS-${firstNumber + 1}`);
    expect(otherBusiness.folio).toMatch(/^OTR-\d{4}$/);
  });

  test("cannot use a time slot from another business", async () => {
    await expect(insertBooking(jbsId, otherSlotId)).rejects.toThrow(/foreign key/);
  });

  test("total must equal subtotal plus surcharge", async () => {
    await expect(
      db.query(
        `insert into public.bookings (
           business_id, status, source, service_date, time_slot_id, customer_name, customer_phone,
           address, vehicle_type_name, time_slot_name, items, subtotal_cents, surcharge_cents,
           total_cents, deposit_cents
         ) values ($1, 'confirmed', 'manual', '2026-10-20', $2, 'Cliente', '3312345678', 'Calle 1',
           'Auto', 'Mañana', '[]', 15000, 5000, 15000, 0)`,
        [jbsId, jbsSlotId],
      ),
    ).rejects.toThrow(/bookings_total_matches/);
  });

  test("balance is total minus deposit", async () => {
    const row = await one<{ balance_cents: number }>(
      "select balance_cents from public.bookings where business_id = $1 limit 1",
      [jbsId],
    );
    expect(row.balance_cents).toBe(15000 - 4500);
  });
});
