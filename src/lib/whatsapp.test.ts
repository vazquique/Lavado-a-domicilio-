import { describe, expect, test } from "vitest";
import { whatsAppLink } from "./whatsapp";

describe("whatsAppLink", () => {
  test("uses 52 + 10 digits and encodes the message", () => {
    expect(whatsAppLink("3314596017", "Hola, ¿tienen lugar mañana?\nGracias")).toBe(
      "https://wa.me/523314596017?text=Hola%2C%20%C2%BFtienen%20lugar%20ma%C3%B1ana%3F%0AGracias",
    );
  });

  test("rejects numbers that are not 10 digits", () => {
    expect(whatsAppLink(null, "Hola")).toBeNull();
    expect(whatsAppLink("331459601", "Hola")).toBeNull();
    expect(whatsAppLink("523314596017", "Hola")).toBeNull();
  });
});
