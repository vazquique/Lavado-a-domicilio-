import { describe, expect, test } from "vitest";
import { confirmedBookingEmail } from "./booking-email";
import { paidBookingMessage, type PaidBooking } from "./booking-message";

const booking: PaidBooking = {
  businessName: "JB's Bros",
  folio: "JBS-1042",
  serviceDate: "2026-10-20",
  slot: { name: "Mañana", startTime: "09:00:00", endTime: "13:00:00" },
  address: "Av. Siempre Viva 742",
  references: "Portón negro",
  zoneName: "Capital Norte",
  vehicleName: "Carro normal",
  services: ["Lavado normal", "Restauración de faros"],
  customer: { name: "Ana López", phone: "3312345678", email: "ana@example.com" },
  totalCents: 63000,
  paidCents: 31500,
  balanceCents: 31500,
};

describe("paidBookingMessage", () => {
  test("has everything the business needs", () => {
    expect(paidBookingMessage(booking)).toBe(
      [
        "Hola JB's Bros, ya pagué mi reserva JBS-1042:",
        "",
        "Fecha: martes, 20 de octubre de 2026",
        "Horario: Mañana (9:00 a 13:00)",
        "Dirección: Av. Siempre Viva 742, Capital Norte",
        "Referencias: Portón negro",
        "Vehículo: Carro normal",
        "Servicios: Lavado normal, Restauración de faros",
        "",
        "Nombre: Ana López",
        "Celular: 33 1234 5678",
        "",
        "Total: $630",
        "Anticipo pagado: $315",
        "Saldo el día del servicio: $315",
      ].join("\n"),
    );
  });

  test("a booking paid in cash on the day says so", () => {
    const message = paidBookingMessage({ ...booking, paidCents: 0, balanceCents: 63000 });
    expect(message).toContain("Hola JB's Bros, aparté mi lugar con la reserva JBS-1042:");
    expect(message).toContain("Total: $630, en efectivo el día del servicio");
    expect(message).not.toContain("Anticipo");
  });

  test("says when everything was paid", () => {
    const message = paidBookingMessage({ ...booking, references: "", paidCents: 63000, balanceCents: 0 });
    expect(message).toContain("Total: $630 (pagado completo)");
    expect(message).not.toContain("Saldo");
    expect(message).not.toContain("Referencias");
  });
});

describe("confirmedBookingEmail", () => {
  test("subject and text name the folio, date and slot", () => {
    const email = confirmedBookingEmail(booking);
    expect(email.subject).toBe("Nueva reserva JBS-1042: martes, 20 de octubre de 2026, Mañana");
    expect(email.text).toContain("Celular: 33 1234 5678");
    expect(email.text).toContain("Anticipo pagado: $315");
    expect(email.text).toContain("https://wa.me/523312345678");
  });

  test("tells the business when the customer pays in cash", () => {
    const email = confirmedBookingEmail({ ...booking, paidCents: 0, balanceCents: 63000 });
    expect(email.text).toContain("JB's Bros: nueva reserva, paga en efectivo el día del servicio.");
    expect(email.text).toContain("Total: $630, en efectivo el día del servicio");
  });

  test("escapes what the customer typed", () => {
    const email = confirmedBookingEmail({ ...booking, customer: { ...booking.customer, name: '<img src=x onerror="1">' } });
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;1&quot;&gt;");
  });
});
