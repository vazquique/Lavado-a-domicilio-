import { describe, expect, test } from "vitest";
import { vehicleShape } from "./vehicle-shape";

describe("vehicleShape", () => {
  test("picks a silhouette from the vehicle type's name", () => {
    expect(vehicleShape("Carro normal")).toBe("car");
    expect(vehicleShape("Camioneta mediana")).toBe("suv");
    expect(vehicleShape("Camioneta grande")).toBe("big");
    expect(vehicleShape("Pick up")).toBe("big");
    expect(vehicleShape("Sedán")).toBe("car");
    expect(vehicleShape("Camión")).toBe("big");
  });
});
