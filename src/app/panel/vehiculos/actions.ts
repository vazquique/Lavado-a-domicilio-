"use server";

import { refresh } from "next/cache";
import { dbFailure, failure, isUuid, success, type ActionState } from "@/lib/panel/action-state";
import { firstError, vehicleTypeSchema } from "@/lib/panel/schemas";
import { requirePanelBusiness } from "@/lib/panel/session";

export async function saveVehicleType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  const parsed = vehicleTypeSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    active: formData.get("active"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.success) return failure(firstError(parsed.error));

  const { id, name, active, sortOrder } = parsed.data;
  const values = { name, active, sort_order: sortOrder };
  const { error } = id
    ? await supabase.from("vehicle_types").update(values).eq("id", id).eq("business_id", business.id)
    : await supabase.from("vehicle_types").insert({ ...values, business_id: business.id });
  if (error) return dbFailure(error);

  refresh();
  return success(id ? "Guardado." : "Agregado. Ahora ponle precios en Servicios y precios.");
}

export async function deleteVehicleType(id: string): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  if (!isUuid(id)) return failure("No se encontró.");
  const { error } = await supabase.from("vehicle_types").delete().eq("id", id).eq("business_id", business.id);
  if (error) return dbFailure(error);
  refresh();
  return success("Borrado.");
}
