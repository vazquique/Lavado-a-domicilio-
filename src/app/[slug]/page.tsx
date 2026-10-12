import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getBusinessCatalog, priceRange, type BusinessCatalog } from "@/lib/catalog";
import { readableTextColor } from "@/lib/colors";
import { logoUrl } from "@/lib/logos";
import { formatMXN } from "@/lib/money";
import { formatWorkingDays } from "@/lib/schedule";
import { createPublicClient } from "@/lib/supabase/public";
import { formatClockTime } from "@/lib/time";
import { whatsAppLink } from "@/lib/whatsapp";

// Hito 0: read-only preview that proves the database connection and the
// business data. Hito 1 replaces it with the quote and booking flow.
export default function BusinessPage({ params }: PageProps<"/[slug]">) {
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <Suspense fallback={<p className="text-gray-500">Cargando…</p>}>
        {params.then(({ slug }) => (
          <BusinessPreview slug={slug} />
        ))}
      </Suspense>
    </main>
  );
}

async function BusinessPreview({ slug }: { slug: string }) {
  // Fresh data on every visit (prices and schedules change from the panel).
  await connection();
  const supabase = createPublicClient();
  if (!supabase) {
    return (
      <p className="rounded-lg bg-amber-100 p-4 text-amber-900">
        Falta conectar la base de datos (variables de Supabase en Vercel).
      </p>
    );
  }

  const catalog = await getBusinessCatalog(supabase, slug);
  if (!catalog) notFound();

  return <CatalogPreview catalog={catalog} logo={logoUrl(catalog.business.logoPath)} />;
}

function CatalogPreview({ catalog, logo }: { catalog: BusinessCatalog; logo: string | null }) {
  const { business, vehicleTypes, services, prices, zones, timeSlots } = catalog;
  const priceByKey = new Map(
    prices.map((price) => [`${price.serviceId}:${price.vehicleTypeId}`, price.priceCents]),
  );
  const baseServices = services.filter((service) => service.kind === "base");
  const extras = services.filter((service) => service.kind === "extra");
  const deposit =
    business.depositType === "percent"
      ? `${business.depositValue}% del total`
      : formatMXN(business.depositValue);
  const askZoneLink = whatsAppLink(
    business.whatsappPhone,
    `Hola ${business.name}, quiero agendar un lavado. ¿Llegan a mi zona? Estoy en: `,
  );

  return (
    <div className="space-y-6">
      <header
        className="flex items-center gap-4 rounded-xl p-5"
        style={{ backgroundColor: business.brandColor, color: readableTextColor(business.brandColor) }}
      >
        {logo && (
          <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-white">
            <Image src={logo} alt={`Logo de ${business.name}`} fill unoptimized className="object-contain p-1" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{business.name}</h1>
          <p className="mt-1 text-sm opacity-90">Lavado de autos a domicilio</p>
        </div>
      </header>

      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
        Vista previa: así quedaron guardados los datos. Pronto aquí estará el cotizador.
      </p>

      {baseServices.map((service) => (
        <section key={service.id} className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">{service.name}</h2>
          <ul className="mt-2 divide-y divide-gray-100 text-sm">
            {vehicleTypes.map((vehicle) => {
              const price = priceByKey.get(`${service.id}:${vehicle.id}`);
              return (
                <li key={vehicle.id} className="flex justify-between gap-4 py-2">
                  <span>{vehicle.name}</span>
                  <span className="font-medium">
                    {price === undefined ? "Precio por definir" : formatMXN(price)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {extras.length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Extras</h2>
          <ul className="mt-2 divide-y divide-gray-100 text-sm">
            {extras.map((service) => {
              const range = priceRange(service.id, prices);
              return (
                <li key={service.id} className="flex justify-between gap-4 py-2">
                  <span>{service.name}</span>
                  <span className="shrink-0 text-right font-medium">
                    {range === null
                      ? <span className="font-normal text-gray-500">Precio por definir</span>
                      : range.min === range.max
                        ? formatMXN(range.min)
                        : `${formatMXN(range.min)} a ${formatMXN(range.max)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Zonas</h2>
        <ul className="mt-2 divide-y divide-gray-100 text-sm">
          {zones.map((zone) => (
            <li key={zone.id} className="flex justify-between gap-4 py-2">
              <span>{zone.name}</span>
              <span>{zone.surchargeCents > 0 ? `+${formatMXN(zone.surchargeCents)}` : "Sin recargo"}</span>
            </li>
          ))}
        </ul>
        {askZoneLink && (
          <a
            href={askZoneLink}
            className="mt-3 block rounded-lg bg-green-600 px-4 py-3 text-center font-medium text-white"
          >
            ¿Tu zona no aparece? Pregúntanos por WhatsApp
          </a>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Horarios</h2>
        <p className="mt-1 text-sm text-gray-600">{formatWorkingDays(business.workingDays)}</p>
        <ul className="mt-2 divide-y divide-gray-100 text-sm">
          {timeSlots.map((slot) => (
            <li key={slot.id} className="flex justify-between gap-4 py-2">
              <span>
                {slot.name} · {formatClockTime(slot.startTime)} a {formatClockTime(slot.endTime)}
              </span>
              <span>
                {slot.capacity} {slot.capacity === 1 ? "lugar" : "lugares"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-gray-600">Anticipo: {deposit}</p>
      </section>
    </div>
  );
}
