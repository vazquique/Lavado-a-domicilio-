import { formatLongDate } from "./dates";
import { paymentLines, slotLabel, type PaidBooking } from "./booking-message";
import { formatMxPhone } from "./quote-message";

export type Email = { subject: string; text: string; html: string };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Email to the business for each booking confirmed from the page (paid online or to pay
// in cash on the day). Customer details are escaped: they are typed by whoever books.
export function confirmedBookingEmail(booking: PaidBooking): Email {
  const date = formatLongDate(booking.serviceDate);
  const whatsapp = `https://wa.me/52${booking.customer.phone}`;
  const details: [string, string][] = [
    ["Fecha", date],
    ["Horario", slotLabel(booking.slot)],
    ["Cliente", booking.customer.name],
    ["Celular", formatMxPhone(booking.customer.phone)],
    ...(booking.customer.email ? ([["Correo", booking.customer.email]] as [string, string][]) : []),
    ["Dirección", `${booking.address}${booking.zoneName ? `, ${booking.zoneName}` : ""}`],
    ...(booking.references ? ([["Referencias", booking.references]] as [string, string][]) : []),
    ["Vehículo", booking.vehicleName],
    ["Servicios", booking.services.join(", ")],
  ];
  const money = paymentLines(booking);
  const kind = booking.paidCents > 0 ? "nueva reserva pagada en línea" : "nueva reserva, paga en efectivo el día del servicio";

  const subject = `Nueva reserva ${booking.folio}: ${date}, ${booking.slot.name}`;
  const text = [
    `${booking.businessName}: ${kind}.`,
    "",
    `Folio: ${booking.folio}`,
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    ...money,
    "",
    `Escribirle por WhatsApp: ${whatsapp}`,
  ].join("\n");
  const html = [
    `<p>${escapeHtml(booking.businessName)}: ${kind}.</p>`,
    `<p style="font-size:20px;font-weight:bold;margin:16px 0">${escapeHtml(booking.folio)}</p>`,
    `<p>${details.map(([label, value]) => `<b>${label}:</b> ${escapeHtml(value)}`).join("<br>")}</p>`,
    `<p>${money.map(escapeHtml).join("<br>")}</p>`,
    `<p><a href="${whatsapp}">Escribirle por WhatsApp</a></p>`,
  ].join("\n");
  return { subject, text, html };
}
