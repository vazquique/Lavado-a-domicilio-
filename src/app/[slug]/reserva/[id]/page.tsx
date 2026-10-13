import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { paidBookingMessage, paymentLines } from "@/lib/booking-message";
import { readableTextColor } from "@/lib/colors";
import { formatLongDate, TIMEZONE } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import { getOnlineBooking, isUuid, syncMercadoPagoPayment, type OnlineBooking } from "@/lib/online-bookings";
import { createAdminClient } from "@/lib/supabase/admin";
import { arrivalLabel } from "@/lib/time";
import { whatsAppLink } from "@/lib/whatsapp";
import { BusinessHeader } from "../../business-header";

export const metadata: Metadata = {
  title: "Tu reserva",
  robots: { index: false, follow: false },
};

// Where Mercado Pago sends the customer back (and the link they keep). Its address holds
// the booking's random id, which is what lets someone see it.
export default function BookingPage({ params, searchParams }: PageProps<"/[slug]/reserva/[id]">) {
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <Suspense fallback={<p className="text-muted-foreground">Revisando tu reserva…</p>}>
        {Promise.all([params, searchParams]).then(([{ slug, id }, query]) => (
          <BookingStatus
            slug={slug}
            id={id}
            paymentId={typeof query.payment_id === "string" ? query.payment_id : null}
            returnedStatus={typeof query.status === "string" ? query.status : null}
          />
        ))}
      </Suspense>
    </main>
  );
}

async function BookingStatus({
  slug,
  id,
  paymentId,
  returnedStatus,
}: {
  slug: string;
  id: string;
  paymentId: string | null;
  returnedStatus: string | null;
}) {
  await connection();
  const admin = createAdminClient();
  if (!admin || !isUuid(id)) notFound();
  const booking = await getOnlineBooking(admin, id);
  if (!booking || booking.business.slug !== slug) notFound();

  // Back from Mercado Pago before its notification: ask Mercado Pago directly instead of
  // trusting the address (anyone can type "status=approved"). Only the status can change,
  // and reading the booking again here would get the first read's answer (Next.js reuses
  // identical requests within one render), so take the status from the sync.
  if (paymentId && /^\d{1,30}$/.test(paymentId) && (booking.status === "pending_payment" || booking.status === "expired")) {
    try {
      const synced = await syncMercadoPagoPayment(paymentId);
      if (synced?.bookingId === booking.id) booking.status = synced.bookingStatus;
    } catch (error) {
      console.error("Could not check Mercado Pago payment", paymentId, error);
    }
  }

  const now = new Date();
  return (
    <div className="space-y-6">
      <BusinessHeader business={booking.business} />
      <Status booking={booking} returnedStatus={returnedStatus} now={now.getTime()} />
    </div>
  );
}

const holdTime = new Intl.DateTimeFormat("es-MX", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit" });

function Status({ booking, returnedStatus, now }: { booking: OnlineBooking; returnedStatus: string | null; now: number }) {
  const { paid, business } = booking;
  const holdEnds = booking.holdExpiresAt ? new Date(booking.holdExpiresAt) : null;

  if (booking.status === "confirmed" || booking.status === "completed") {
    const whatsappUrl = whatsAppLink(booking.business.whatsappPhone, paidBookingMessage(paid));
    return (
      <div className="space-y-5">
        <section className="space-y-1 rounded-xl border-2 border-green-600 bg-green-50 p-4 text-green-950">
          <h2 className="text-xl font-bold">¡Listo! Tu reserva está confirmada</h2>
          <p>
            Folio <span className="font-semibold">{paid.folio}</span>
          </p>
        </section>
        <Details booking={booking} paidLines={paymentLines(paid)} />
        {whatsappUrl && (
          <a href={whatsappUrl} className="block rounded-lg bg-green-600 px-4 py-3 text-center font-semibold text-white">
            Avisar a {business.name} por WhatsApp
          </a>
        )}
        <p className="text-sm text-muted-foreground">Guarda esta página para consultar tu reserva.</p>
      </div>
    );
  }

  if (booking.status === "pending_payment" && holdEnds && holdEnds.getTime() > now) {
    const failed = returnedStatus !== null && returnedStatus !== "approved";
    const dueLines = [
      `Total: ${formatMXN(paid.totalCents)}`,
      `A pagar ahora: ${formatMXN(paid.paidCents)}`,
      ...(paid.balanceCents > 0 ? [`Saldo el día del servicio: ${formatMXN(paid.balanceCents)}`] : []),
    ];
    return (
      <div className="space-y-5">
        <section className="space-y-1 rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-amber-950">
          <h2 className="text-xl font-bold">{failed ? "Tu pago no se completó" : "Falta tu pago"}</h2>
          <p>
            Tu lugar está apartado hasta las {holdTime.format(holdEnds).replace(/\.$/, "")}.{" "}
            {failed ? "Puedes intentarlo otra vez con otra tarjeta." : "Termina tu pago para confirmarlo."}
          </p>
        </section>
        <Details booking={booking} paidLines={dueLines} />
        {booking.checkoutUrl && (
          <a
            href={booking.checkoutUrl}
            className="block rounded-lg px-4 py-3 text-center font-semibold"
            style={{ backgroundColor: business.brandColor, color: readableTextColor(business.brandColor) }}
          >
            Pagar con Mercado Pago
          </a>
        )}
        <a href="?" className="block text-center text-sm font-medium underline">
          Ya pagué: revisar otra vez
        </a>
      </div>
    );
  }

  if (booking.status === "cancelled") {
    return (
      <section className="space-y-1 rounded-xl border bg-card p-4">
        <h2 className="text-xl font-bold">Esta reserva fue cancelada</h2>
        <p className="text-muted-foreground">Si tienes dudas, escríbenos por WhatsApp.</p>
      </section>
    );
  }

  // Unpaid and the hold ran out (or expired): the places went back to the schedule.
  return (
    <div className="space-y-5">
      <section className="space-y-1 rounded-xl border bg-card p-4">
        <h2 className="text-xl font-bold">Se acabó el tiempo para pagar</h2>
        <p className="text-muted-foreground">El lugar se liberó. Puedes volver a elegir día y horario.</p>
      </section>
      <a
        href={`/${business.slug}`}
        className="block rounded-lg border-2 px-4 py-3 text-center font-semibold"
      >
        Volver a reservar
      </a>
    </div>
  );
}

function Details({ booking, paidLines }: { booking: OnlineBooking; paidLines: string[] }) {
  const { paid } = booking;
  return (
    <section className="space-y-1 rounded-xl border bg-card p-4 text-sm shadow-sm">
      <p className="font-medium first-letter:uppercase">{formatLongDate(paid.serviceDate)}</p>
      <p>{arrivalLabel(paid.slot)}</p>
      <p className="pt-2">
        {paid.address}
        {paid.zoneName && `, ${paid.zoneName}`}
      </p>
      {paid.references && <p className="text-muted-foreground">{paid.references}</p>}
      <p className="pt-2">
        {paid.vehicleName}: {paid.services.join(", ")}
      </p>
      <div className="mt-2 space-y-0.5 border-t pt-2">
        {paidLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </section>
  );
}
