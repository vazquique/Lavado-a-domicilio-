import { describe, expect, test } from "vitest";
import { bookingRequestSchema } from "./booking-request";
import { firstError } from "./panel/schemas";

const valid = {
  slug: "jbsbros",
  vehicleTypeId: "8f1e1a5e-7b3c-4c43-9d8f-0f4f5d1b2a10",
  baseServiceId: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
  extraServiceIds: [],
  zoneId: "2b3c4d5e-6f70-4a81-92b3-c4d5e6f70812",
  date: "2026-10-13",
  timeSlotId: "3c4d5e6f-7081-4a92-a3b4-d5e6f7081923",
  customer: {
    name: " Ana López ",
    phone: "+52 33 1234 5678",
    address: "Av. Siempre Viva 742",
    references: "",
    email: "",
  },
  website: "",
};

describe("bookingRequestSchema", () => {
  test("cleans the customer's details", () => {
    const result = bookingRequestSchema.parse(valid);
    expect(result.customer).toEqual({
      name: "Ana López",
      phone: "3312345678",
      address: "Av. Siempre Viva 742",
      references: "",
      email: null,
    });
  });

  test("explains what's missing", () => {
    const cases: [object, string][] = [
      [{ ...valid, zoneId: "" }, "Elige tu colonia."],
      [{ ...valid, timeSlotId: "" }, "Elige el horario."],
      [{ ...valid, customer: { ...valid.customer, phone: "33 1234" } }, "Escribe tu celular a 10 dígitos."],
      [{ ...valid, customer: { ...valid.customer, email: "ana@" } }, "Revisa tu correo."],
      [{ ...valid, customer: { ...valid.customer, address: "x" } }, "Escribe tu dirección (calle, número y colonia)."],
    ];
    for (const [input, message] of cases) {
      const result = bookingRequestSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) expect(firstError(result.error)).toBe(message);
    }
  });

  test("rejects bots that fill the hidden field", () => {
    expect(bookingRequestSchema.safeParse({ ...valid, website: "http://spam" }).success).toBe(false);
  });
});
