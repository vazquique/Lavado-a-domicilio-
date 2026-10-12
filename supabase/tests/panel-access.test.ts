import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, test } from "vitest";
import { asRole, createTestDb, createUser } from "./test-db";

let db: PGlite;
let jbsId: string;
let otherId: string;

async function membershipsOf(userId: string): Promise<string[]> {
  const { rows } = await db.query<{ business_id: string }>(
    "select business_id from public.business_members where user_id = $1",
    [userId],
  );
  return rows.map((row) => row.business_id);
}

beforeAll(async () => {
  db = await createTestDb();
  jbsId = (await db.query<{ id: string }>("select id from public.businesses where slug = 'jbsbros'")).rows[0].id;
  otherId = (
    await db.query<{ id: string }>(
      "insert into public.businesses (slug, name, folio_prefix) values ('otro', 'Otro', 'OTR') returning id",
    )
  ).rows[0].id;
}, 60_000);

describe("invitations", () => {
  test("the JB's Bros owner becomes a member when their user is created", async () => {
    const ownerId = await createUser(db, "vazquique@gmail.com");
    expect(await membershipsOf(ownerId)).toEqual([jbsId]);

    const { rows } = await db.query("select * from public.business_invites where email = 'vazquique@gmail.com'");
    expect(rows).toEqual([]);
  });

  test("an unconfirmed email gets access only after confirming it", async () => {
    await db.query("insert into public.business_invites (business_id, email) values ($1, 'nuevo@example.com')", [
      otherId,
    ]);
    const { rows } = await db.query<{ id: string }>(
      "insert into auth.users (email) values ('Nuevo@Example.com') returning id",
    );
    const userId = rows[0].id;
    expect(await membershipsOf(userId)).toEqual([]);

    await db.query("update auth.users set email_confirmed_at = now() where id = $1", [userId]);
    expect(await membershipsOf(userId)).toEqual([otherId]);
  });

  test("users without an invitation get no access", async () => {
    const userId = await createUser(db, "cualquiera@example.com");
    expect(await membershipsOf(userId)).toEqual([]);
  });

  test("invitations are not visible through the API", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      await expect(
        asRole(db, role, null, (tx) => tx.query("select * from public.business_invites")),
      ).rejects.toThrow(/permission denied/);
    }
  });
});

test("the logos bucket is public and only takes small images", async () => {
  const { rows } = await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>(
    "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'logos'",
  );
  expect(rows[0]).toEqual({
    public: true,
    file_size_limit: 2097152,
    allowed_mime_types: ["image/png", "image/jpeg", "image/webp"],
  });
});

test("nobody can upload files through the API directly", async () => {
  const memberId = await createUser(db, "duenio@example.com");
  await db.query("insert into public.business_members (business_id, user_id) values ($1, $2)", [jbsId, memberId]);
  await expect(
    asRole(db, "authenticated", memberId, (tx) =>
      tx.query("insert into storage.objects (bucket_id, name, owner) values ('logos', $1, $2)", [
        `${jbsId}/logo.png`,
        memberId,
      ]),
    ),
  ).rejects.toThrow(/row-level security/);
});
