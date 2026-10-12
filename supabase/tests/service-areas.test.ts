import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, test } from "vitest";
import { EXPLAINER_IDS } from "@/lib/service-explainers";
import { asRole, createTestDb } from "./test-db";

let db: PGlite;
let jbsId: string;

beforeAll(async () => {
  db = await createTestDb();
  jbsId = (await db.query<{ id: string }>("select id from public.businesses where slug = 'jbsbros'")).rows[0].id;
}, 60_000);

describe("service areas and car parts", () => {
  test("JB's Bros extras are split into exterior and interior", async () => {
    const { rows } = await db.query<{ name: string }>(
      "select name from public.services where business_id = $1 and kind = 'extra' and area = 'interior' order by sort_order",
      [jbsId],
    );
    expect(rows.map((row) => row.name)).toEqual([
      "Detallado general de interiores",
      "Tallado de asientos y suelos",
      "Hidratación de cueros",
      "Restauración e hidratación de plásticos interiores",
    ]);
  });

  test("every JB's Bros service says which parts of the car it works on", async () => {
    const { rows } = await db.query<{ name: string; car_parts: string[] }>(
      "select name, car_parts from public.services where business_id = $1",
      [jbsId],
    );
    expect(rows.filter((row) => row.car_parts.length === 0).map((row) => row.name)).toEqual([]);
    expect(rows.find((row) => row.name === "Detallado de rines y llantas")?.car_parts).toEqual(["wheels"]);
    expect(rows.find((row) => row.name === "Full detailing")?.car_parts).toHaveLength(8);
  });

  test("only known areas and parts", async () => {
    await expect(db.query("update public.services set area = 'motor' where business_id = $1", [jbsId])).rejects.toThrow(
      /check/,
    );
    await expect(
      db.query("update public.services set car_parts = '{wheels,engine}' where business_id = $1", [jbsId]),
    ).rejects.toThrow(/check/);
  });

  test("the public booking page can read them", async () => {
    const rows = await asRole(db, "anon", null, async (tx) => {
      const result = await tx.query<{ area: string; car_parts: string[] }>(
        "select area, car_parts from public.services where business_id = $1 and name = 'Restauración de faros'",
        [jbsId],
      );
      return result.rows;
    });
    expect(rows).toEqual([{ area: "exterior", car_parts: ["lights"] }]);
  });
});

describe("service explainers", () => {
  test("every JB's Bros service has a known plain-language explanation", async () => {
    const { rows } = await db.query<{ name: string; explainer: string | null }>(
      "select name, explainer from public.services where business_id = $1",
      [jbsId],
    );
    for (const row of rows) expect(EXPLAINER_IDS, row.name).toContain(row.explainer);
  });

  test("Lavado normal also vacuums and wipes the dashboard and panels (the owner)", async () => {
    const { rows } = await db.query<{ car_parts: string[]; description: string; explainer: string }>(
      "select car_parts, description, explainer from public.services where business_id = $1 and name = 'Lavado normal'",
      [jbsId],
    );
    expect(rows[0]).toEqual({
      car_parts: ["body", "windows", "wheels", "floors", "dashboard"],
      description: "Lavado exterior, aspirado y limpieza rápida de paneles y tablero.",
      explainer: "lavado-completo",
    });
  });

  test("explainer ids are short slugs", async () => {
    await expect(
      db.query("update public.services set explainer = 'Algo raro!' where business_id = $1", [jbsId]),
    ).rejects.toThrow(/check/);
  });
});
