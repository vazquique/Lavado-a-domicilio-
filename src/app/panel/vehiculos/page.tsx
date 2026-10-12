import { Suspense } from "react";
import { AddNew, NoBusiness, PanelLoading, SectionHeader } from "@/components/panel/section";
import { getPanelSession } from "@/lib/panel/session";
import { VehicleTypeForm } from "./vehicle-type-form";

export default function VehicleTypesPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tipos de vehículo"
        description="El cliente elige uno y ve el precio de cada servicio para ese vehículo."
      />
      <Suspense fallback={<PanelLoading />}>
        <VehicleTypesEditor />
      </Suspense>
    </div>
  );
}

async function VehicleTypesEditor() {
  const { supabase, business } = await getPanelSession();
  if (!business) return <NoBusiness />;

  const { data, error } = await supabase
    .from("vehicle_types")
    .select("id, name, sort_order, active")
    .eq("business_id", business.id)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;

  return (
    <div className="space-y-3">
      {data.map((vehicle) => (
        <div key={vehicle.id} className="rounded-xl border bg-card p-4 shadow-sm">
          <VehicleTypeForm
            vehicle={{ id: vehicle.id, name: vehicle.name, sortOrder: vehicle.sort_order, active: vehicle.active }}
          />
        </div>
      ))}
      <AddNew label="Agregar tipo de vehículo">
        <VehicleTypeForm />
      </AddNew>
    </div>
  );
}
