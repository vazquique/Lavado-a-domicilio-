import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, test } from "vitest";
import { asRole, createTestDb, createUser } from "./test-db";

let db: PGlite;
let jbsId: string;
let morningId: string;

type Booking = Record<string, unknown>;

function booking(overrides: Booking = {}): Booking {
  return {
    business_id: jbsId,
    service_date: "2026-10-20",
    time_slot_id: morningId,
    capacity_units: 1,
    customer_name: "Ana López",
    customer_phone: "3312345678",
    customer_email: null,
    address: "Av. Siempre Viva 742",
    address_references: "Portón negro",
    vehicle_type_name: "Carro normal",
    zone_name: "Capital Norte",
    time_slot_name: "Mañana",
    items: [{ name: "Lavado normal", kind: "base", price_cents: 23000 }],
    subtotal_cents: 23000,
    surcharge_cents: 0,
    total_cents: 23000,
    deposit_cents: 11500,
    ...overrides,
  };
}

async function create(tx: Transaction, data: Booking) {
  const { rows } = await tx.query<{ booking_id: string; booking_folio: string }>(
    "select * from public.create_online_booking($1)",
    [JSON.stringify(data)],
  );
  return rows[0] ?? null;
}

async function pay(
  tx: Transaction,
  bookingId: string,
  { id = "1001", status = "approved", amount = 11500, currency = "MXN" } = {},
) {
  const { rows } = await tx.query<{ confirmed_now: boolean; booking_status: string }>(
    "select * from public.record_mercadopago_payment($1, $2, $3, 'accredited', $4, $5, now())",
    [bookingId, id, status, amount, currency],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].booking_status).toBe((await bookingRow(tx, bookingId)).status);
  return rows[0].confirmed_now;
}

async function bookingRow(tx: Transaction, id: string) {
  const { rows } = await tx.query<{
    status: string;
    folio: string;
    hold_minutes: number;
    terms_accepted: boolean;
    deposit_paid: boolean;
    refund_status: string;
    balance_cents: number;
  }>(
    `select status, folio, round(extract(epoch from hold_expires_at - now()) / 60)::int as hold_minutes,
            terms_accepted_at is not null as terms_accepted, deposit_paid_at is not null as deposit_paid,
            refund_status, balance_cents
     from public.bookings where id = $1`,
    [id],
  );
  return rows[0];
}

// Every test runs as server code (service_role) inside a transaction that is rolled back.
function asServer<T>(fn: (tx: Transaction) => Promise<T>) {
  return asRole(db, "service_role", null, fn);
}

beforeAll(async () => {
  db = await createTestDb();
  jbsId = (await db.query<{ id: string }>("select id from public.businesses where slug = 'jbsbros'")).rows[0].id;
  morningId = (
    await db.query<{ id: string }>("select id from public.time_slots where business_id = $1 and name = 'Mañana'", [
      jbsId,
    ])
  ).rows[0].id;
}, 60_000);

describe("create_online_booking", () => {
  test("holds the places for 30 minutes and gives the booking a folio", async () => {
    await asServer(async (tx) => {
      const created = await create(tx, booking());
      expect(created?.booking_folio).toMatch(/^JBS-\d+$/);
      expect(await bookingRow(tx, created!.booking_id)).toMatchObject({
        status: "pending_payment",
        hold_minutes: 30,
        terms_accepted: true,
        balance_cents: 11500,
      });
      const { rows } = await tx.query<{ used_units: number }>(
        "select used_units from public.slot_usage($1, '2026-10-20', '2026-10-20')",
        [jbsId],
      );
      expect(rows[0].used_units).toBe(1);
    });
  });

  test("refuses when the places are taken", async () => {
    await asServer(async (tx) => {
      expect(await create(tx, booking({ capacity_units: 3 }))).not.toBeNull();
      expect(await create(tx, booking({ customer_phone: "3399999999" }))).toBeNull();
    });
  });

  test("a hold that ran out frees its places", async () => {
    await asServer(async (tx) => {
      const first = await create(tx, booking({ capacity_units: 3 }));
      await tx.query("update public.bookings set hold_expires_at = now() - interval '1 minute' where id = $1", [
        first!.booking_id,
      ]);
      expect(await create(tx, booking({ customer_phone: "3399999999" }))).not.toBeNull();
    });
  });

  test("a customer who starts over releases their previous hold", async () => {
    await asServer(async (tx) => {
      const first = await create(tx, booking({ capacity_units: 3 }));
      const second = await create(tx, booking({ capacity_units: 3 }));
      expect(second).not.toBeNull();
      expect((await bookingRow(tx, first!.booking_id)).status).toBe("expired");
    });
  });

  test("refuses a slot that is not offered anymore", async () => {
    await asServer(async (tx) => {
      await tx.query("update public.time_slots set active = false where id = $1", [morningId]);
      expect(await create(tx, booking())).toBeNull();
    });
  });
});

describe("record_mercadopago_payment", () => {
  test("an approved payment confirms the booking once", async () => {
    await asServer(async (tx) => {
      const { booking_id } = (await create(tx, booking()))!;
      expect(await pay(tx, booking_id)).toBe(true);
      expect(await pay(tx, booking_id)).toBe(false); // the same notification again
      expect(await bookingRow(tx, booking_id)).toMatchObject({ status: "confirmed", deposit_paid: true });
      const { rows } = await tx.query("select * from public.payments where booking_id = $1", [booking_id]);
      expect(rows).toHaveLength(1);
    });
  });

  test("rejected, short or foreign-currency payments don't confirm", async () => {
    await asServer(async (tx) => {
      const { booking_id } = (await create(tx, booking()))!;
      expect(await pay(tx, booking_id, { id: "1", status: "rejected" })).toBe(false);
      expect(await pay(tx, booking_id, { id: "2", amount: 11400 })).toBe(false);
      expect(await pay(tx, booking_id, { id: "3", currency: "USD" })).toBe(false);
      expect((await bookingRow(tx, booking_id)).status).toBe("pending_payment");
    });
  });

  test("a rejected payment that later gets approved confirms", async () => {
    await asServer(async (tx) => {
      const { booking_id } = (await create(tx, booking()))!;
      expect(await pay(tx, booking_id, { status: "in_process" })).toBe(false);
      expect(await pay(tx, booking_id, { status: "approved" })).toBe(true);
    });
  });

  test("paying everything leaves nothing to pay on the day", async () => {
    await asServer(async (tx) => {
      const { booking_id } = (await create(tx, booking({ deposit_cents: 23000 })))!;
      expect(await pay(tx, booking_id, { amount: 23000 })).toBe(true);
      expect(await bookingRow(tx, booking_id)).toMatchObject({ status: "confirmed", balance_cents: 0 });
    });
  });

  test("a payment that arrives after the hold ran out still confirms", async () => {
    await asServer(async (tx) => {
      const { booking_id } = (await create(tx, booking()))!;
      await tx.query("update public.bookings set status = 'expired' where id = $1", [booking_id]);
      expect(await pay(tx, booking_id)).toBe(true);
    });
  });

  test("a cancelled booking is not confirmed by a late payment", async () => {
    await asServer(async (tx) => {
      const { booking_id } = (await create(tx, booking()))!;
      await tx.query("update public.bookings set status = 'cancelled' where id = $1", [booking_id]);
      expect(await pay(tx, booking_id)).toBe(false);
      expect((await bookingRow(tx, booking_id)).status).toBe("cancelled");
    });
  });

  test("refunds are recorded on the booking", async () => {
    await asServer(async (tx) => {
      const { booking_id } = (await create(tx, booking()))!;
      await pay(tx, booking_id);
      expect(await pay(tx, booking_id, { status: "refunded" })).toBe(false);
      expect(await bookingRow(tx, booking_id)).toMatchObject({ status: "confirmed", refund_status: "refunded" });
    });
  });

  test("fails for an unknown booking", async () => {
    await expect(asServer((tx) => pay(tx, "00000000-0000-0000-0000-000000000000"))).rejects.toThrow(/not found/);
  });
});

describe("register_booking_attempt", () => {
  test("allows up to the limit per IP within the window", async () => {
    await asServer(async (tx) => {
      const attempt = async (ip: string) =>
        (
          await tx.query<{ ok: boolean }>("select public.register_booking_attempt($1, 3, 60) as ok", [
            ip.repeat(64),
          ])
        ).rows[0].ok;
      expect([await attempt("a"), await attempt("a"), await attempt("a")]).toEqual([true, true, true]);
      expect(await attempt("a")).toBe(false);
      expect(await attempt("b")).toBe(true);
    });
  });
});

describe("who can do what", () => {
  const calls = [
    ["create_online_booking", "select public.create_online_booking('{}'::jsonb)"],
    ["record_mercadopago_payment", "select public.record_mercadopago_payment(null, '1', 'approved', null, 1, 'MXN', null)"],
    ["register_booking_attempt", `select public.register_booking_attempt('${"a".repeat(64)}', 1, 1)`],
  ] as const;

  test.each(calls)("the public and signed-in users can't call %s", async (_name, sql) => {
    for (const role of ["anon", "authenticated"] as const) {
      await expect(asRole(db, role, null, (tx) => tx.query(sql))).rejects.toThrow(/permission denied/);
    }
  });

  test("members read their business's payments; nobody else does", async () => {
    // Committed on purpose (other tests roll back), on a date no other test uses.
    const created = (
      await db.query<{ booking_id: string }>("select * from public.create_online_booking($1)", [
        JSON.stringify(booking({ service_date: "2026-11-05", customer_phone: "3300000001" })),
      ])
    ).rows[0];
    await db.query("select * from public.record_mercadopago_payment($1, '5005', 'approved', null, 11500, 'MXN', now())", [
      created.booking_id,
    ]);
    const ownerId = await createUser(db, "dueno@example.com");
    const strangerId = await createUser(db, "otro@example.com");
    await db.query("insert into public.business_members (business_id, user_id) values ($1, $2)", [jbsId, ownerId]);

    const read = (userId: string) =>
      asRole(db, "authenticated", userId, async (tx) => {
        const { rows } = await tx.query<{ provider_payment_id: string }>(
          "select provider_payment_id from public.payments",
        );
        return rows.map((row) => row.provider_payment_id);
      });
    expect(await read(ownerId)).toEqual(["5005"]);
    expect(await read(strangerId)).toEqual([]);
    await expect(asRole(db, "anon", null, (tx) => tx.query("select * from public.payments"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      asRole(db, "authenticated", ownerId, (tx) =>
        tx.query("update public.payments set status = 'refunded' where provider_payment_id = '5005'"),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
