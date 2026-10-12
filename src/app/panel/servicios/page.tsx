import { Suspense } from "react";
import { AddNew, NoBusiness, PanelLoading, SectionHeader } from "@/components/panel/section";
import { getPanelSession } from "@/lib/panel/session";
import { ServiceForm, type ServiceValues } from "./service-form";

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Servicios y precios"
        description="Principales: el cliente elige uno. Extras: se suman al principal."
      />
      <Suspense fallback={<PanelLoading />}>
        <ServicesEditor />
      </Suspense>
    </div>
  );
}

async function ServicesEditor() {
  const { supabase, business } = await getPanelSession();
  if (!business) return <NoBusiness />;

  const [vehicleTypes, services, prices] = await Promise.all([
    supabase
      .from("vehicle_types")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("services")
      .select("id, name, description, kind, active, sort_order")
      .eq("business_id", business.id)
      .order("kind")
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("service_prices")
      .select("service_id, vehicle_type_id, price_cents")
      .eq("business_id", business.id),
  ]);
  for (const result of [vehicleTypes, services, prices]) {
    if (result.error) throw result.error;
  }

  const pricesByService = new Map<string, Record<string, number>>();
  for (const price of prices.data ?? []) {
    const entry = pricesByService.get(price.service_id) ?? {};
    entry[price.vehicle_type_id] = price.price_cents;
    pricesByService.set(price.service_id, entry);
  }

  const values: ServiceValues[] = (services.data ?? []).map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    kind: service.kind,
    active: service.active,
    sortOrder: service.sort_order,
    prices: pricesByService.get(service.id) ?? {},
  }));
  const groups = [
    { title: "Principales", items: values.filter((service) => service.kind === "base") },
    { title: "Extras", items: values.filter((service) => service.kind === "extra") },
  ];

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          {group.items.map((service) => (
            <details key={service.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <summary className="cursor-pointer">
                <span className="font-medium">{service.name}</span>
                {!service.active && <span className="text-sm text-muted-foreground"> (oculto)</span>}
                {Object.keys(service.prices).length === 0 && (
                  <span className="text-sm text-amber-700"> · sin precio</span>
                )}
              </summary>
              <div className="mt-4">
                <ServiceForm service={service} vehicleTypes={vehicleTypes.data ?? []} />
              </div>
            </details>
          ))}
        </section>
      ))}
      <AddNew label="Agregar servicio">
        <ServiceForm vehicleTypes={vehicleTypes.data ?? []} />
      </AddNew>
    </div>
  );
}
