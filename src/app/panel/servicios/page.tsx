import { Suspense } from "react";
import { ServiceIconBadge } from "@/components/car-summary";
import { AddNew, NoBusiness, PanelLoading, SectionHeader } from "@/components/panel/section";
import { isCarPart, partsLabels, serviceIcon } from "@/lib/car-parts";
import { getPanelSession } from "@/lib/panel/session";
import { MoveButtons } from "./move-buttons";
import { ServiceForm, type ServiceValues } from "./service-form";

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Servicios y precios"
        description="Principales: el cliente elige uno. Extras: se suman al principal, en pestañas de exterior e interior. Usa las flechas para acomodarlos."
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

  const [settings, vehicleTypes, services, prices] = await Promise.all([
    supabase.from("businesses").select("brand_color").eq("id", business.id).single(),
    supabase
      .from("vehicle_types")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("services")
      .select("id, name, description, kind, capacity_units, includes_extras, active, sort_order, area, car_parts")
      .eq("business_id", business.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("service_prices")
      .select("service_id, vehicle_type_id, price_cents")
      .eq("business_id", business.id),
  ]);
  for (const result of [settings, vehicleTypes, services, prices]) {
    if (result.error) throw result.error;
  }
  const brandColor: string = settings.data?.brand_color ?? "#1d4ed8";

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
    capacityUnits: service.capacity_units,
    includesExtras: service.includes_extras,
    active: service.active,
    sortOrder: service.sort_order,
    area: service.area === "interior" ? "interior" : "exterior",
    carParts: ((service.car_parts as unknown[] | null) ?? []).filter(isCarPart),
    prices: pricesByService.get(service.id) ?? {},
  }));
  const groups = [
    { title: "Principales", items: values.filter((service) => service.kind === "base") },
    {
      title: "Extras de exterior",
      items: values.filter((service) => service.kind === "extra" && service.area === "exterior"),
    },
    {
      title: "Extras de interior",
      items: values.filter((service) => service.kind === "extra" && service.area === "interior"),
    },
  ];

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          {group.items.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay ninguno.</p>}
          {group.items.map((service, index) => (
            <div key={service.id} className="flex items-start gap-2">
              <details className="min-w-0 flex-1 rounded-xl border bg-card p-3 shadow-sm">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <ServiceIconBadge
                    icon={serviceIcon(service)}
                    className="size-9 text-white"
                    style={{ backgroundColor: service.active ? brandColor : "#9ca3af" }}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{service.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[
                        ...partsLabels(service.carParts),
                        ...(service.active ? [] : ["oculto"]),
                        ...(Object.keys(service.prices).length === 0 ? ["sin precio"] : []),
                      ].join(" · ") || "Sin partes del auto"}
                    </span>
                  </span>
                </summary>
                <div className="mt-4">
                  <ServiceForm service={service} vehicleTypes={vehicleTypes.data ?? []} brandColor={brandColor} />
                </div>
              </details>
              <MoveButtons
                id={service.id}
                name={service.name}
                canUp={index > 0}
                canDown={index < group.items.length - 1}
              />
            </div>
          ))}
        </section>
      ))}
      <AddNew label="Agregar servicio">
        <ServiceForm vehicleTypes={vehicleTypes.data ?? []} brandColor={brandColor} />
      </AddNew>
    </div>
  );
}
