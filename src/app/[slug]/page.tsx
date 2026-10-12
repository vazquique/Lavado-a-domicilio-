import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getBookingData } from "@/lib/booking-data";
import { readableTextColor } from "@/lib/colors";
import { createPublicClient } from "@/lib/supabase/public";
import { whatsAppLink } from "@/lib/whatsapp";
import { BookingFlow } from "./booking-flow";

export default function BusinessPage({ params }: PageProps<"/[slug]">) {
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        {params.then(({ slug }) => (
          <Booking slug={slug} />
        ))}
      </Suspense>
    </main>
  );
}

async function Booking({ slug }: { slug: string }) {
  // Fresh data on every visit: prices, schedules and free places change.
  await connection();
  const supabase = createPublicClient();
  if (!supabase) {
    return (
      <p className="rounded-lg bg-amber-100 p-4 text-amber-900">
        Falta conectar la base de datos (variables de Supabase en Vercel).
      </p>
    );
  }

  const now = new Date();
  const data = await getBookingData(supabase, slug, now);
  if (!data) notFound();

  const { business } = data;
  const askZoneUrl = whatsAppLink(
    business.whatsappPhone,
    `Hola ${business.name}, quiero agendar un lavado. ¿Llegan a mi colonia? Estoy en: `,
  );

  return (
    <div className="space-y-6">
      <header
        className="flex items-center gap-4 rounded-xl p-5"
        style={{ backgroundColor: business.brandColor, color: readableTextColor(business.brandColor) }}
      >
        {business.logoUrl && (
          <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-white">
            <Image src={business.logoUrl} alt={`Logo de ${business.name}`} fill unoptimized className="object-contain p-1" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{business.name}</h1>
          <p className="mt-1 text-sm opacity-90">Lavado de autos a domicilio. Cotiza y aparta en un minuto.</p>
        </div>
      </header>
      <BookingFlow data={data} now={now.toISOString()} askZoneUrl={askZoneUrl} />
    </div>
  );
}
