import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getBookingData } from "@/lib/booking-data";
import { getMercadoPagoConfig } from "@/lib/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { whatsAppLink } from "@/lib/whatsapp";
import { BookingFlow } from "./booking-flow";
import { BusinessHero } from "./business-hero";
import { HowItWorks } from "./how-it-works";

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
      <BusinessHero business={business} />
      <HowItWorks color={business.brandColor} />
      <BookingFlow
        data={data}
        now={now.toISOString()}
        askZoneUrl={askZoneUrl}
        payOnline={getMercadoPagoConfig() !== null && createAdminClient() !== null}
      />
    </div>
  );
}
