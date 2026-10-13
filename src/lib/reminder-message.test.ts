import { describe, expect, test } from "vitest";
import { reminderMessage, type ReminderBooking } from "./reminder-message";

const booking: ReminderBooking = {
  businessName: "JB's Bros",
  customerName: "Ana López",
  folio: "JBS-1042",
  serviceDate: "2026-10-14",
  slot: { name: "Tarde", startTime: "13:00:00", endTime: "18:00:00", arrivalTime: "14:40:00" },
  address: "Av. Siempre Viva 742",
  zoneName: "Capital Norte",
  vehicleName: "Carro normal",
  services: ["Lavado normal", "Restauración de faros"],
  totalCents: 63000,
  paidOnlineCents: 31500,
  balanceCents: 31500,
  balancePaid: false,
};

describe("reminderMessage", () => {
  test("reminds the date, place, car and what's left to pay", () => {
    expect(reminderMessage(booking)).toBe(
      [
        "Hola Ana, te recordamos tu servicio con JB's Bros:",
        "",
        "Fecha: miércoles, 14 de octubre de 2026",
        "Horario: 14:40 (Tarde)",
        "Dirección: Av. Siempre Viva 742, Capital Norte",
        "Vehículo: Carro normal",
        "Servicios: Lavado normal, Restauración de faros",
        "",
        "Total: $630",
        "Anticipo pagado: $315",
        "Saldo el día del servicio: $315",
        "",
        "Folio JBS-1042. Si necesitas cambiar algo, contéstanos por aquí.",
      ].join("\n"),
    );
  });

  test("a booking from the panel pays everything on the day", () => {
    const text = reminderMessage({ ...booking, paidOnlineCents: 0, balanceCents: 63000, zoneName: null });
    expect(text).toContain("Total a pagar el día del servicio: $630");
    expect(text).toContain("Dirección: Av. Siempre Viva 742\n");
    expect(text).not.toContain("Anticipo");
  });

  test("nothing left to pay", () => {
    expect(reminderMessage({ ...booking, balancePaid: true })).toContain("Total: $630 (pagado)");
    expect(reminderMessage({ ...booking, paidOnlineCents: 63000, balanceCents: 0 })).toContain("Total: $630 (pagado)");
  });
});
