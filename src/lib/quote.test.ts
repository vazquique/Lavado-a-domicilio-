import { describe, expect, test } from "vitest";
import { calculateQuote, depositFor, servicesForVehicle, type QuoteCatalog } from "./quote";

const catalog: QuoteCatalog = {
  vehicleTypes: [
    { id: "car", name: "Carro normal" },
    { id: "big", name: "Camioneta grande" },
  ],
  services: [
    { id: "wash", name: "Lavado normal", kind: "base", capacityUnits: 1 },
    { id: "full", name: "Full detailing", kind: "base", capacityUnits: 3, includesExtras: true },
    { id: "wax", name: "Cera", kind: "extra", capacityUnits: 0 },
    { id: "ceramic", name: "Tratamiento cerámico", kind: "extra", capacityUnits: 1 },
    { id: "lights", name: "Restauración de faros", kind: "extra", capacityUnits: 0 },
  ],
  prices: [
    { serviceId: "wash", vehicleTypeId: "car", priceCents: 23000 },
    { serviceId: "wash", vehicleTypeId: "big", priceCents: 30000 },
    { serviceId: "full", vehicleTypeId: "car", priceCents: 150000 },
    { serviceId: "wax", vehicleTypeId: "car", priceCents: 12000 },
    { serviceId: "ceramic", vehicleTypeId: "car", priceCents: 45050 },
  ],
  zones: [
    { id: "capital", name: "Capital Norte", surchargeCents: 0 },
    { id: "far", name: "Tesistán", surchargeCents: 5000 },
  ],
  deposit: { type: "percent", value: 50 },
};

const select = (overrides: Partial<Parameters<typeof calculateQuote>[1]> = {}) => ({
  vehicleTypeId: "car",
  baseServiceId: "wash",
  extraServiceIds: [],
  zoneId: "capital",
  ...overrides,
});

describe("calculateQuote", () => {
  test("base service only", () => {
    const result = calculateQuote(catalog, select());
    expect(result).toMatchObject({
      ok: true,
      quote: { subtotalCents: 23000, surchargeCents: 0, totalCents: 23000, depositCents: 11500, balanceCents: 11500 },
    });
  });

  test("price depends on the vehicle", () => {
    const result = calculateQuote(catalog, select({ vehicleTypeId: "big" }));
    expect(result.ok && result.quote.totalCents).toBe(30000);
  });

  test("extras and zone surcharge add up", () => {
    const result = calculateQuote(catalog, select({ extraServiceIds: ["wax", "ceramic"], zoneId: "far" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote.lines.map((line) => line.name)).toEqual(["Lavado normal", "Cera", "Tratamiento cerámico"]);
    expect(result.quote.subtotalCents).toBe(23000 + 12000 + 45050);
    expect(result.quote.surchargeCents).toBe(5000);
    expect(result.quote.totalCents).toBe(85050);
    // 50% of $850.50 = $425.25 -> rounded to whole pesos.
    expect(result.quote.depositCents).toBe(42500);
    expect(result.quote.balanceCents).toBe(85050 - 42500);
  });

  test("the same extra twice is charged once", () => {
    const result = calculateQuote(catalog, select({ extraServiceIds: ["wax", "wax"] }));
    expect(result.ok && result.quote.totalCents).toBe(35000);
  });

  test("places: services add up, at least 1", () => {
    const wash = calculateQuote(catalog, select({ extraServiceIds: ["wax"] }));
    const withCeramic = calculateQuote(catalog, select({ extraServiceIds: ["ceramic"] }));
    const full = calculateQuote(catalog, select({ baseServiceId: "full" }));
    expect(wash.ok && wash.quote.capacityUnits).toBe(1);
    expect(withCeramic.ok && withCeramic.quote.capacityUnits).toBe(2);
    expect(full.ok && full.quote.capacityUnits).toBe(3);
  });

  test("a service that includes the extras never charges them again", () => {
    const result = calculateQuote(catalog, select({ baseServiceId: "full", extraServiceIds: ["wax", "ceramic"] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote.lines.map((line) => line.name)).toEqual(["Full detailing"]);
    expect(result.quote.totalCents).toBe(150000);
    expect(result.quote.capacityUnits).toBe(3);
  });

  test("zone can be left for later (no surcharge yet)", () => {
    const result = calculateQuote(catalog, select({ zoneId: null }));
    expect(result.ok && result.quote.zone).toBeNull();
  });

  test("rejects choices that aren't offered", () => {
    expect(calculateQuote(catalog, select({ vehicleTypeId: "moto" }))).toEqual({ ok: false, error: "vehicle" });
    expect(calculateQuote(catalog, select({ baseServiceId: "wax" }))).toEqual({ ok: false, error: "base_service" });
    expect(calculateQuote(catalog, select({ vehicleTypeId: "big", baseServiceId: "full" }))).toEqual({
      ok: false,
      error: "base_service",
    });
    expect(calculateQuote(catalog, select({ extraServiceIds: ["wash"] }))).toEqual({ ok: false, error: "extra_service" });
    expect(calculateQuote(catalog, select({ extraServiceIds: ["lights"] }))).toEqual({
      ok: false,
      error: "extra_service",
    });
    expect(calculateQuote(catalog, select({ zoneId: "mars" }))).toEqual({ ok: false, error: "zone" });
  });
});

describe("depositFor", () => {
  test("percent rounds to whole pesos", () => {
    expect(depositFor(23000, { type: "percent", value: 50 })).toBe(11500);
    expect(depositFor(23500, { type: "percent", value: 30 })).toBe(7100); // $70.50 -> $71
    expect(depositFor(23000, { type: "percent", value: 0 })).toBe(0);
    expect(depositFor(23000, { type: "percent", value: 100 })).toBe(23000);
  });

  test("fixed amount never exceeds the total", () => {
    expect(depositFor(23000, { type: "fixed", value: 10000 })).toBe(10000);
    expect(depositFor(8000, { type: "fixed", value: 10000 })).toBe(8000);
  });
});

test("servicesForVehicle lists only priced services", () => {
  const car = servicesForVehicle(catalog, "car");
  expect(car.base.map((service) => service.id)).toEqual(["wash", "full"]);
  expect(car.extras.map((service) => [service.id, service.priceCents])).toEqual([
    ["wax", 12000],
    ["ceramic", 45050],
  ]);
  const big = servicesForVehicle(catalog, "big");
  expect(big.base.map((service) => service.id)).toEqual(["wash"]);
  expect(big.extras).toEqual([]);
});
