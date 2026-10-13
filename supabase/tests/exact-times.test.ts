import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, test } from "vitest";
import { asRole, createTestDb, createUser } from "./test-db";

// Exact times: a slot's places are consecutive turns (Mañana 9:00–13:00 with 3 places is
// 9:00, 10:20 and 11:40); a booking starts at one and takes as many in a row as it needs.

let db: PGlite;
let jbsId: string;
let ownerId: string;
let morning: { id: string; capacity: number };
let afternoon: { id: string };

const asServer = <T>(fn: (tx: Transaction) => Promise<T>) => asRole(db, "service_role", null, fn);
const asOwner = <T>(fn: (tx: Transaction) => Promise<T>) => asRole(db, "authenticated", ownerId, fn);

function cash(overrides: Record<string, unknown> = {}) {
  return {
    business_id: jbsId,
    service_date: "2026-10-20",
    time_slot_id: morning.id,
    capacity_units: 1,
    customer_name: "Ana López",
    customer_phone: "3312345678",
    address: "Av. Siempre Viva 742",
    vehicle_type_name: "Carro normal",
    items: [{ name: "Lavado normal", kind: "base", price_cents: 23000 }],
    subtotal_cents: 23000,
    surcharge_cents: 0,
    total_cents: 23000,
    ...overrides,
  };
}

// Books and returns the arrival time ("10:20"), or null when it doesn't fit.
async function book(tx: Transaction, overrides: Record<string, unknown> = {}) {
  const { rows } = await tx.query<{ booking_id: string }>("select * from public.create_cash_booking($1)", [
    JSON.stringify(cash({ customer_phone: `33${String(Math.random()).slice(2, 10)}`, ...overrides })),
  ]);
  if (!rows[0]) return null;
  const booking = await tx.query<{ arrival: string; place: number }>(
    "select to_char(arrival_time, 'FMHH24:MI') as arrival, start_place as place from public.bookings where id = $1",
    [rows[0].booking_id],
  );
  return { id: rows[0].booking_id, ...booking.rows[0] };
}

beforeAll(async () => {
  db = await createTestDb();
  jbsId = (await db.query<{ id: string }>("select id from public.businesses where slug = 'jbsbros'")).rows[0].id;
  ownerId = await createUser(db, "vazquique@gmail.com");
  [morning, afternoon] = (
    await db.query<{ id: string; capacity: number }>(
      "select id, capacity from public.time_slots where business_id = $1 order by start_time",
      [jbsId],
    )
  ).rows;
}, 60_000);

describe("exact times", () => {
  test("each place of the morning has its own time", async () => {
    const times = await asServer(async (tx) => [
      (await book(tx, { start_place: 0 }))?.arrival,
      (await book(tx, { start_place: 1 }))?.arrival,
      (await book(tx, { start_place: 2 }))?.arrival,
      (await book(tx, { time_slot_id: afternoon.id, start_place: 1 }))?.arrival,
    ]);
    expect(times).toEqual(["9:00", "10:20", "11:40", "14:40"]);
  });

  test("times are rounded to 5 minutes like the page does (src/lib/availability.test.ts)", async () => {
    const { rows } = await db.query<{ times: string[]; half: string }>(
      `select array(
         select to_char(private.place_time('08:00', '12:00', 7, place), 'HH24:MI') from generate_series(0, 6) place
       ) as times,
       to_char(private.place_time('09:00', '13:05', 6, 3), 'HH24:MI') as half`,
    );
    expect(rows[0]).toEqual({
      times: ["08:00", "08:35", "09:10", "09:45", "10:15", "10:50", "11:25"],
      half: "11:05",
    });
  });

  test("a taken time can't be booked twice, and bookings of several places need them in a row", async () => {
    const result = await asServer(async (tx) => ({
      first: (await book(tx, { start_place: 1 }))?.arrival,
      again: await book(tx, { start_place: 1 }),
      twoFromStart: await book(tx, { start_place: 0, capacity_units: 2 }),
      lastOne: (await book(tx, { start_place: 2 }))?.arrival,
      wholeMorning: await book(tx, { service_date: "2026-10-21", start_place: 1, capacity_units: 3 }),
      fullDetailing: (await book(tx, { service_date: "2026-10-21", start_place: 0, capacity_units: 3 }))?.arrival,
    }));
    expect(result).toEqual({
      first: "10:20",
      again: null,
      twoFromStart: null,
      lastOne: "11:40",
      wholeMorning: null,
      fullDetailing: "9:00",
    });
  });

  test("without a time (code from before), the first free one is taken", async () => {
    const places = await asServer(async (tx) => [
      (await book(tx, { start_place: 0 }))?.place,
      (await book(tx))?.place,
      (await book(tx))?.place,
      await book(tx),
    ]);
    expect(places).toEqual([0, 1, 2, null]);
  });

  test("the page sees which times are taken, without any personal data", async () => {
    const rows = await asServer(async (tx) => {
      await book(tx, { start_place: 2, capacity_units: 1 });
      await tx.exec("set local role anon");
      const { rows } = await tx.query("select * from public.slot_places($1, '2026-10-20', '2026-10-20')", [jbsId]);
      return rows;
    });
    expect(rows).toEqual([{ service_date: expect.anything(), time_slot_id: morning.id, start_place: 2, units: 1 }]);
  });

  test("moving a booking to an exact time, if it's free", async () => {
    const result = await asOwner(async (tx) => {
      const { rows } = await tx.query<{ booking_id: string }>("select * from public.create_manual_booking($1)", [
        JSON.stringify({ ...cash(), start_place: 0 }),
      ]);
      const id = rows[0].booking_id;
      const { rows: other } = await tx.query<{ booking_id: string }>("select * from public.create_manual_booking($1)", [
        JSON.stringify({ ...cash({ customer_phone: "3398765432" }), start_place: 2 }),
      ]);
      const move = async (place: number | null) =>
        (
          await tx.query<{ reschedule_booking: string }>("select public.reschedule_booking($1, '2026-10-20', $2, $3)", [
            id,
            morning.id,
            place,
          ])
        ).rows[0].reschedule_booking;
      const toTaken = await move(2);
      const toFree = await move(1);
      const arrival = await tx.query<{ arrival: string }>(
        "select to_char(arrival_time, 'FMHH24:MI') as arrival from public.bookings where id = $1",
        [id],
      );
      return { toTaken, toFree, arrival: arrival.rows[0].arrival, other: other.length };
    });
    expect(result).toEqual({ toTaken: "full", toFree: "moved", arrival: "10:20", other: 1 });
  });
});
