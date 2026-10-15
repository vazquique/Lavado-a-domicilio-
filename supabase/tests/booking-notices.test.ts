import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, test } from "vitest";
import { asRole, createTestDb, createUser } from "./test-db";

// The booking page's notices: prices that can change, and special services by WhatsApp.

let db: PGlite;
let jbsId: string;
let ownerId: string;

const asOwner = <T>(fn: (tx: Transaction) => Promise<T>) => asRole(db, "authenticated", ownerId, fn);
const notices = (tx: Transaction) =>
  tx
    .query<{ price_notice: string; special_services_notice: string }>(
      "select price_notice, special_services_notice from public.businesses where id = $1",
      [jbsId],
    )
    .then((result) => result.rows[0]);

beforeAll(async () => {
  db = await createTestDb();
  jbsId = (await db.query<{ id: string }>("select id from public.businesses where slug = 'jbsbros'")).rows[0].id;
  ownerId = await createUser(db, "vazquique@gmail.com");
}, 60_000);

describe("booking notices", () => {
  test("start with the owner's texts, and the booking page can read them", async () => {
    expect(await asRole(db, "anon", null, notices)).toEqual({
      price_notice:
        "Los precios pueden cambiar si el auto trae algo fuera de lo normal, como mucho pelo de perro o muchos mosquitos.",
      special_services_notice: "Los servicios especiales, como quitar hongos, se cotizan por WhatsApp.",
    });
  });

  test("the owner changes them or leaves them empty, up to 300 characters", async () => {
    const changed = await asOwner(async (tx) => {
      await tx.query("update public.businesses set price_notice = $2, special_services_notice = '' where id = $1", [
        jbsId,
        "El precio puede subir si hay lodo.",
      ]);
      return notices(tx);
    });
    expect(changed).toEqual({ price_notice: "El precio puede subir si hay lodo.", special_services_notice: "" });

    await expect(
      asOwner((tx) => tx.query("update public.businesses set price_notice = $2 where id = $1", [jbsId, "x".repeat(301)])),
    ).rejects.toThrow(/price_notice/);
  });

  test("nobody else can change them", async () => {
    const strangerId = await createUser(db, "extrano@example.com");
    const updated = await asRole(db, "authenticated", strangerId, async (tx) => {
      const { rows } = await tx.query(
        "update public.businesses set price_notice = 'Hackeado' where id = $1 returning id",
        [jbsId],
      );
      return rows.length;
    });
    expect(updated).toBe(0);
    await expect(
      asRole(db, "anon", null, (tx) =>
        tx.query("update public.businesses set price_notice = 'Hackeado' where id = $1", [jbsId]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
