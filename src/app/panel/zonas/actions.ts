"use server";

import { refresh } from "next/cache";
import { dbFailure, failure, isUuid, success, type ActionState } from "@/lib/panel/action-state";
import { firstError, zoneSchema } from "@/lib/panel/schemas";
import { requirePanelBusiness } from "@/lib/panel/session";

export async function saveZone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  const parsed = zoneSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    surchargeCents: formData.get("surcharge"),
    active: formData.get("active"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.success) return failure(firstError(parsed.error));

  const { id, name, surchargeCents, active, sortOrder } = parsed.data;
  const values = { name, surcharge_cents: surchargeCents, active, sort_order: sortOrder };
  const { error } = id
    ? await supabase.from("zones").update(values).eq("id", id).eq("business_id", business.id)
    : await supabase.from("zones").insert({ ...values, business_id: business.id });
  if (error) return dbFailure(error);

  refresh();
  return success(id ? "Guardado." : "Agregada.");
}

export async function deleteZone(id: string): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  if (!isUuid(id)) return failure("No se encontró.");
  const { error } = await supabase.from("zones").delete().eq("id", id).eq("business_id", business.id);
  if (error) return dbFailure(error);
  refresh();
  return success("Borrada.");
}
