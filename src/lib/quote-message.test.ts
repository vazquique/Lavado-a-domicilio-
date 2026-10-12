import { describe, expect, test } from "vitest";
import { calculateQuote, type QuoteCatalog } from "./quote";
import { formatMxPhone, quoteRequestMessage } from "./quote-message";
import { whatsAppLink } from "./whatsapp";

const catalog: QuoteCatalog = {
  vehicleTypes: [{ id: "car", name: "Carro normal" }],
  services: [
    { id: "wash", name: "Lavado normal", kind: "base", capacityUnits: 1 },
    { id: "wax", name: "Cera", kind: "extra", capacityUnits: 0 },
  ],
  prices: [
    { serviceId: "wash", vehicleTypeId: "car", priceCents: 23000 },
    { serviceId: "wax", vehicleTypeId: "car", priceCents: 12000 },
  ],
  zones: [{ id: "capital", name: "Capital Norte", surchargeCents: 0 }],
  deposit: { type: "percent", value: 50 },
};

const result = calculateQuote(catalog, {
  vehicleTypeId: "car",
  baseServiceId: "wash",
  extraServiceIds: ["wax"],
  zoneId: "capital",
});
if (!result.ok) throw new Error("bad fixture");

const request = {
  businessName: "JB's Bros",
  quote: result.quote,
  date: "2026-10-13",
  slot: { name: "Mañana", startTime: "09:00:00", endTime: "13:00:00" },
  customer: {
    name: "Ana López",
    phone: "3312345678",
    address: "Av. Siempre Viva 742, Capital Norte",
    references: "Portón negro",
    email: null,
  },
  depositLabel: "50%",
};

test("formatMxPhone groups the digits", () => {
  expect(formatMxPhone("3314596017")).toBe("33 1459 6017");
});

describe("quoteRequestMessage", () => {
  test("has everything the business needs", () => {
    expect(quoteRequestMessage(request)).toBe(
      [
        "Hola JB's Bros, quiero agendar:",
        "",
        "Vehículo: Carro normal",
        "Servicio: Lavado normal",
        "Extras: Cera",
        "Colonia: Capital Norte",
        "Fecha: martes, 13 de octubre de 2026",
        "Horario: Mañana (9:00 a 13:00)",
        "Dirección: Av. Siempre Viva 742, Capital Norte",
        "Referencias: Portón negro",
        "",
        "Nombre: Ana López",
        "Celular: 33 1234 5678",
        "",
        "Total: $350",
        "Anticipo (50%): $175",
        "Saldo el día del servicio: $175",
      ].join("\n"),
    );
  });

  test("fits in a wa.me link to the business", () => {
    const link = whatsAppLink("3314596017", quoteRequestMessage(request));
    expect(link).toMatch(/^https:\/\/wa\.me\/523314596017\?text=Hola%20JB's%20Bros/);
    expect(decodeURIComponent(link!.split("?text=")[1])).toBe(quoteRequestMessage(request));
  });
});
