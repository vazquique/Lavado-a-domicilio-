import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getBusinessCatalog, type BusinessCatalog } from "@/lib/catalog";
import { formatMXN } from "@/lib/money";
import { createPublicClient } from "@/lib/supabase/public";
import { formatClockTime } from "@/lib/time";

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

  return <CatalogPreview catalog={catalog} />;
}

function CatalogPreview({ catalog }: { catalog: BusinessCatalog }) {
  const { business, vehicleTypes, services, prices, zones, timeSlots } = catalog;
  const priceByKey = new Map(
    prices.map((price) => [`${price.serviceId}:${price.vehicleTypeId}`, price.priceCents]),
  );
  const deposit =
    business.depositType === "percent"
      ? `${business.depositValue}% del total`
      : formatMXN(business.depositValue);

  return (
    <div className="space-y-6">
      <header className="rounded-xl p-5 text-white" style={{ backgroundColor: business.brandColor }}>
        <h1 className="text-2xl font-bold">{business.name}</h1>
        <p className="mt-1 text-sm opacity-90">Lavado de autos a domicilio</p>
      </header>

      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
        Vista previa: así quedaron guardados los datos. Pronto aquí estará el cotizador.
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Precios</h2>
        {vehicleTypes.map((vehicle) => (
          <div key={vehicle.id} className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="font-medium">{vehicle.name}</h3>
            <ul className="mt-2 divide-y divide-gray-100 text-sm">
              {services.map((service) => {
                const price = priceByKey.get(`${service.id}:${vehicle.id}`);
                if (price === undefined) return null;
                return (
                  <li key={service.id} className="flex justify-between gap-4 py-2">
                    <span>
                      {service.name}
                      {service.kind === "extra" && <span className="text-gray-500"> (extra)</span>}
                    </span>
                    <span className="font-medium">{formatMXN(price)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

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
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Horarios</h2>
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
