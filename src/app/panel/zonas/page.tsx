import { Suspense } from "react";
import { AddNew, NoBusiness, PanelLoading, SectionHeader } from "@/components/panel/section";
import { getPanelSession } from "@/lib/panel/session";
import { ZoneForm } from "./zone-form";

export default function ZonesPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Zonas"
        description="Colonias que cubres. Si la del cliente no está, le aparece un botón para preguntarte por WhatsApp."
      />
      <Suspense fallback={<PanelLoading />}>
        <ZonesEditor />
      </Suspense>
    </div>
  );
}

async function ZonesEditor() {
  const { supabase, business } = await getPanelSession();
  if (!business) return <NoBusiness />;

  const { data, error } = await supabase
    .from("zones")
    .select("id, name, surcharge_cents, active, sort_order")
    .eq("business_id", business.id)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;

  return (
    <div className="space-y-3">
      {data.map((zone) => (
        <div key={zone.id} className="rounded-xl border bg-card p-4 shadow-sm">
          <ZoneForm
            zone={{
              id: zone.id,
              name: zone.name,
              surchargeCents: zone.surcharge_cents,
              active: zone.active,
              sortOrder: zone.sort_order,
            }}
          />
        </div>
      ))}
      <AddNew label="Agregar colonia o zona">
        <ZoneForm />
      </AddNew>
    </div>
  );
}
