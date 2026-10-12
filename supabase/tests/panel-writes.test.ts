import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, test } from "vitest";
import { asRole, createTestDb, createUser } from "./test-db";

// The same statements the panel's Server Actions send through the API, run as the
// signed-in owner, to make sure grants and policies allow exactly these changes.

let db: PGlite;
let jbsId: string;
let ownerId: string;

const asOwner = <T>(fn: (tx: Transaction) => Promise<T>) => asRole(db, "authenticated", ownerId, fn);

beforeAll(async () => {
  db = await createTestDb();
  jbsId = (await db.query<{ id: string }>("select id from public.businesses where slug = 'jbsbros'")).rows[0].id;
  ownerId = await createUser(db, "vazquique@gmail.com");
}, 60_000);

describe("owner panel writes", () => {
  test("business settings, schedule settings and logo", async () => {
    const row = await asOwner(async (tx) => {
      await tx.query(
        `update public.businesses set name = $2, whatsapp_phone = $3, brand_color = $4, deposit_type = $5,
           deposit_value = $6, cancellation_policy = $7, privacy_notice = $8
         where id = $1`,
        [jbsId, "JB's Bros", "3314596017", "#0f766e", "fixed", 15000, "Política", "Aviso"],
      );
      await tx.query(
        `update public.businesses set working_days = $2, booking_lead_minutes = $3, booking_horizon_days = $4
         where id = $1`,
        [jbsId, [1, 2, 3, 4, 5, 6], 90, 45],
      );
      await tx.query("update public.businesses set logo_path = $2 where id = $1", [jbsId, `${jbsId}/logo-1.png`]);
      const { rows } = await tx.query<{ deposit_type: string; booking_lead_minutes: number; logo_path: string }>(
        "select deposit_type, booking_lead_minutes, logo_path from public.businesses where id = $1",
        [jbsId],
      );
      return rows[0];
    });
    expect(row).toEqual({ deposit_type: "fixed", booking_lead_minutes: 90, logo_path: `${jbsId}/logo-1.png` });
  });

  test("service with prices: insert, upsert prices, remove a price, delete", async () => {
    const prices = await asOwner(async (tx) => {
      const vehicles = await tx.query<{ id: string }>(
        "select id from public.vehicle_types where business_id = $1 order by sort_order",
        [jbsId],
      );
      const [car, mid, large] = vehicles.rows.map((row) => row.id);
      const service = await tx.query<{ id: string }>(
        `insert into public.services (business_id, name, description, kind, active, sort_order)
         values ($1, 'Restauración de faros', '', 'extra', true, 16) returning id`,
        [jbsId],
      );
      const serviceId = service.rows[0].id;

      const upsert = `insert into public.service_prices (business_id, service_id, vehicle_type_id, price_cents)
        values ($1, $2, $3, $4), ($1, $2, $5, $6)
        on conflict (service_id, vehicle_type_id) do update set price_cents = excluded.price_cents`;
      await tx.query(upsert, [jbsId, serviceId, car, 30000, mid, 35000]);
      await tx.query(upsert, [jbsId, serviceId, car, 32000, large, 40000]);
      await tx.query(
        "delete from public.service_prices where business_id = $1 and service_id = $2 and vehicle_type_id = any($3)",
        [jbsId, serviceId, [mid]],
      );

      const { rows } = await tx.query<{ vehicle_type_id: string; price_cents: number }>(
        "select vehicle_type_id, price_cents from public.service_prices where service_id = $1 order by price_cents",
        [serviceId],
      );
      await tx.query("delete from public.services where id = $1 and business_id = $2", [serviceId, jbsId]);
      return rows.map((row) => [row.vehicle_type_id === car ? "car" : "large", row.price_cents]);
    });
    expect(prices).toEqual([
      ["car", 32000],
      ["large", 40000],
    ]);
  });

  test("vehicle types, zones, time slots and blocked dates", async () => {
    const counts = await asOwner(async (tx) => {
      await tx.query("insert into public.vehicle_types (business_id, name, active, sort_order) values ($1, 'Moto', true, 4)", [jbsId]);
      await tx.query(
        "insert into public.zones (business_id, name, surcharge_cents, active, sort_order) values ($1, 'Tesistán', 5000, true, 6)",
        [jbsId],
      );
      await tx.query(
        `insert into public.time_slots (business_id, name, start_time, end_time, capacity, active, sort_order)
         values ($1, 'Noche', '18:00', '20:00', 1, true, 3)`,
        [jbsId],
      );
      await tx.query("update public.time_slots set capacity = 4 where business_id = $1 and name = 'Mañana'", [jbsId]);
      await tx.query("insert into public.blocked_dates (business_id, date, reason) values ($1, '2026-12-25', 'Navidad')", [jbsId]);
      await tx.query("delete from public.blocked_dates where business_id = $1 and date = '2026-12-25'", [jbsId]);
      await tx.query("delete from public.zones where business_id = $1 and name = 'Tesistán'", [jbsId]);
      const { rows } = await tx.query<Record<string, number>>(
        `select
           (select count(*)::int from public.vehicle_types where business_id = $1) as vehicle_types,
           (select count(*)::int from public.zones where business_id = $1) as zones,
           (select count(*)::int from public.time_slots where business_id = $1) as time_slots,
           (select max(capacity)::int from public.time_slots where business_id = $1) as max_capacity`,
        [jbsId],
      );
      return rows[0];
    });
    expect(counts).toEqual({ vehicle_types: 4, zones: 5, time_slots: 3, max_capacity: 4 });
  });

  test("the panel's membership lookup returns the business", async () => {
    const business = await asOwner(async (tx) => {
      const { rows } = await tx.query<{ slug: string }>(
        `select b.slug from public.business_members m join public.businesses b on b.id = m.business_id
         where m.user_id = $1`,
        [ownerId],
      );
      return rows[0];
    });
    expect(business).toEqual({ slug: "jbsbros" });
  });
});
