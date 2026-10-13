import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, test } from "vitest";
import { asRole, createTestDb, createUser } from "./test-db";

// The agenda in the panel: bookings the owner adds by hand, moving them to another day and
// the day-to-day marks (done, no-show, balance paid, notes), run as the signed-in owner.

let db: PGlite;
let jbsId: string;
let ownerId: string;
let strangerId: string;
let morning: { id: string; capacity: number };
let afternoon: { id: string; capacity: number };

const asOwner = <T>(fn: (tx: Transaction) => Promise<T>) => asRole(db, "authenticated", ownerId, fn);
const asStranger = <T>(fn: (tx: Transaction) => Promise<T>) => asRole(db, "authenticated", strangerId, fn);

function manual(overrides: Record<string, unknown> = {}) {
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
    address_references: "Portón negro",
    vehicle_type_name: "Carro normal",
    zone_name: "Capital Norte",
    items: [{ name: "Lavado normal", kind: "base", price_cents: 23000 }],
    subtotal_cents: 23000,
    surcharge_cents: 0,
    total_cents: 23000,
    notes: "Me escribió por WhatsApp",
    ...overrides,
  };
}

async function createManual(tx: Transaction, data: Record<string, unknown>) {
  const { rows } = await tx.query<{ booking_id: string; booking_folio: string }>(
    "select * from public.create_manual_booking($1)",
    [JSON.stringify(data)],
  );
  return rows[0] ?? null;
}

async function reschedule(tx: Transaction, bookingId: string, date: string, slotId: string) {
  const { rows } = await tx.query<{ reschedule_booking: string }>("select public.reschedule_booking($1, $2, $3)", [
    bookingId,
    date,
    slotId,
  ]);
  return rows[0].reschedule_booking;
}

async function where(tx: Transaction, bookingId: string) {
  const { rows } = await tx.query<{ service_date: string; time_slot_id: string; time_slot_name: string }>(
    "select service_date::text, time_slot_id, time_slot_name from public.bookings where id = $1",
    [bookingId],
  );
  return rows[0];
}

beforeAll(async () => {
  db = await createTestDb();
  jbsId = (await db.query<{ id: string }>("select id from public.businesses where slug = 'jbsbros'")).rows[0].id;
  ownerId = await createUser(db, "vazquique@gmail.com");
  strangerId = await createUser(db, "otro-negocio@example.com");
  const slots = await db.query<{ id: string; capacity: number }>(
    "select id, capacity from public.time_slots where business_id = $1 order by start_time",
    [jbsId],
  );
  [morning, afternoon] = slots.rows;
}, 60_000);

describe("manual bookings", () => {
  test("the owner adds a confirmed booking with its folio; everything is paid on the day", async () => {
    const row = await asOwner(async (tx) => {
      const created = await createManual(tx, manual());
      const { rows } = await tx.query(
        `select folio, status, source, deposit_cents, balance_cents, time_slot_name, notes, hold_expires_at
         from public.bookings where id = $1`,
        [created?.booking_id],
      );
      return { created, booking: rows[0] };
    });
    expect(row.created?.booking_folio).toMatch(/^JBS-\d+$/);
    expect(row.booking).toEqual({
      folio: row.created?.booking_folio,
      status: "confirmed",
      source: "manual",
      deposit_cents: 0,
      balance_cents: 23000,
      time_slot_name: "Mañana",
      notes: "Me escribió por WhatsApp",
      hold_expires_at: null,
    });
  });

  test("they take places like any booking: a full slot says no", async () => {
    const [first, second] = await asOwner(async (tx) => [
      await createManual(tx, manual({ capacity_units: morning.capacity })),
      await createManual(tx, manual({ customer_name: "Beto" })),
    ]);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  test("an inactive or unknown slot says no", async () => {
    const created = await asOwner((tx) => createManual(tx, manual({ time_slot_id: crypto.randomUUID() })));
    expect(created).toBeNull();
  });

  test("nobody else can add bookings to this business", async () => {
    await expect(asStranger((tx) => createManual(tx, manual()))).rejects.toThrow(/not a member/);
    await expect(asRole(db, "anon", null, (tx) => createManual(tx, manual()))).rejects.toThrow(/permission denied/);
  });
});

describe("rescheduling", () => {
  test("moves a booking to a free slot, with that slot's name", async () => {
    const result = await asOwner(async (tx) => {
      const created = await createManual(tx, manual());
      const moved = await reschedule(tx, created!.booking_id, "2026-10-22", afternoon.id);
      return { moved, at: await where(tx, created!.booking_id) };
    });
    expect(result).toEqual({
      moved: "moved",
      at: { service_date: "2026-10-22", time_slot_id: afternoon.id, time_slot_name: "Tarde" },
    });
  });

  test("a full slot keeps the booking where it was", async () => {
    const result = await asOwner(async (tx) => {
      await createManual(tx, manual({ service_date: "2026-10-22", capacity_units: morning.capacity }));
      const created = await createManual(tx, manual({ time_slot_id: afternoon.id }));
      const moved = await reschedule(tx, created!.booking_id, "2026-10-22", morning.id);
      return { moved, at: await where(tx, created!.booking_id) };
    });
    expect(result.moved).toBe("full");
    expect(result.at.time_slot_id).toBe(afternoon.id);
  });

  test("a booking doesn't count against itself when it stays in its slot", async () => {
    const moved = await asOwner(async (tx) => {
      const created = await createManual(tx, manual({ capacity_units: morning.capacity }));
      return reschedule(tx, created!.booking_id, "2026-10-20", morning.id);
    });
    expect(moved).toBe("moved");
  });

  test("only confirmed bookings move, and only to slots that exist", async () => {
    const result = await asOwner(async (tx) => {
      const done = await createManual(tx, manual());
      await tx.query("update public.bookings set status = 'completed' where id = $1", [done!.booking_id]);
      const open = await createManual(tx, manual({ customer_name: "Beto" }));
      return {
        done: await reschedule(tx, done!.booking_id, "2026-10-23", morning.id),
        noSlot: await reschedule(tx, open!.booking_id, "2026-10-23", crypto.randomUUID()),
        unknown: await reschedule(tx, crypto.randomUUID(), "2026-10-23", morning.id),
      };
    });
    expect(result).toEqual({ done: "not_movable", noSlot: "no_slot", unknown: "not_movable" });
  });

  test("nobody else can move this business's bookings", async () => {
    const message = await asOwner(async (tx) => {
      const created = await createManual(tx, manual());
      // Same transaction, now as the owner of another business.
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: strangerId, role: "authenticated" }),
      ]);
      return reschedule(tx, created!.booking_id, "2026-10-21", morning.id).then(
        () => "moved",
        (error: Error) => error.message,
      );
    });
    expect(message).toMatch(/not a member/);
  });
});

describe("day to day", () => {
  test("the owner marks a booking done, the balance paid and writes notes", async () => {
    const row = await asOwner(async (tx) => {
      const created = await createManual(tx, manual());
      await tx.query(
        "update public.bookings set status = 'completed', balance_paid_at = now(), notes = $2 where id = $1",
        [created!.booking_id, "Pagó en efectivo"],
      );
      const { rows } = await tx.query(
        "select status, balance_paid_at is not null as paid, notes from public.bookings where id = $1",
        [created!.booking_id],
      );
      return rows[0];
    });
    expect(row).toEqual({ status: "completed", paid: true, notes: "Pagó en efectivo" });
  });

  test("amounts and dates can't be edited directly (moving goes through reschedule_booking)", async () => {
    const attempt = (sql: string) =>
      asOwner(async (tx) => {
        const created = await createManual(tx, manual());
        await tx.query(sql, [created!.booking_id]);
      });
    await expect(attempt("update public.bookings set total_cents = 1 where id = $1")).rejects.toThrow(
      /permission denied/,
    );
    await expect(attempt("update public.bookings set service_date = '2026-12-01' where id = $1")).rejects.toThrow(
      /permission denied/,
    );
  });
});
