import { describe, expect, test } from "vitest";
import { priceRange } from "./catalog";

const prices = [
  { serviceId: "wash", vehicleTypeId: "car", priceCents: 23000 },
  { serviceId: "wash", vehicleTypeId: "suv", priceCents: 30000 },
  { serviceId: "wax", vehicleTypeId: "car", priceCents: 12000 },
];

describe("priceRange", () => {
  test("lowest and highest price of a service", () => {
    expect(priceRange("wash", prices)).toEqual({ min: 23000, max: 30000 });
    expect(priceRange("wax", prices)).toEqual({ min: 12000, max: 12000 });
  });

  test("null when the service has no price yet", () => {
    expect(priceRange("polish", prices)).toBeNull();
  });
});
