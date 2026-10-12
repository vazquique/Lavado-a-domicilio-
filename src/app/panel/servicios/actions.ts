"use server";

import { refresh } from "next/cache";
import { dbFailure, failure, isUuid, success, type ActionState } from "@/lib/panel/action-state";
import { moveWithinGroup, nextSortOrder } from "@/lib/panel/reorder";
import { firstError, optionalPesosField, serviceSchema } from "@/lib/panel/schemas";
import { requirePanelBusiness } from "@/lib/panel/session";

// Saves a service and its price for each vehicle type. An empty price means the
// service isn't offered for that vehicle.
export async function saveService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  const parsed = serviceSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description"),
    kind: formData.get("kind"),
    capacityUnits: formData.get("capacityUnits"),
    includesExtras: formData.get("includesExtras"),
    active: formData.get("active"),
    area: formData.get("area"),
    carParts: formData.getAll("carParts"),
  });
  if (!parsed.success) return failure(firstError(parsed.error));

  // Vehicle types come from the database, never from the form.
  const { data: vehicleTypes, error: vehicleError } = await supabase
    .from("vehicle_types")
    .select("id, name")
    .eq("business_id", business.id)
    .eq("active", true);
  if (vehicleError) return dbFailure(vehicleError);

  const prices: { vehicleTypeId: string; cents: number | null }[] = [];
  for (const vehicle of vehicleTypes) {
    const price = optionalPesosField(vehicle.name).safeParse(formData.get(`price_${vehicle.id}`) ?? "");
    if (!price.success) return failure(firstError(price.error));
    prices.push({ vehicleTypeId: vehicle.id, cents: price.data });
  }

  const { id, name, description, kind, capacityUnits, includesExtras, active, area, carParts } = parsed.data;
  const values = {
    name,
    description,
    kind,
    capacity_units: capacityUnits,
    // Only main services can include the extras.
    includes_extras: kind === "base" && includesExtras,
    active,
    area,
    car_parts: carParts,
  };

  let saved;
  if (id) {
    saved = await supabase.from("services").update(values).eq("id", id).eq("business_id", business.id).select("id").single();
  } else {
    // New services go to the end of their group; the arrows move them.
    const { data: group, error } = await supabase
      .from("services")
      .select("id, sort_order")
      .eq("business_id", business.id)
      .eq("kind", kind)
      .eq("area", area);
    if (error) return dbFailure(error);
    const sortOrder = nextSortOrder(group.map((row) => ({ id: row.id, sortOrder: row.sort_order })));
    saved = await supabase
      .from("services")
      .insert({ ...values, sort_order: sortOrder, business_id: business.id })
      .select("id")
      .single();
  }
  if (saved.error) return dbFailure(saved.error);
  const serviceId: string = saved.data.id;

  const toUpsert = prices
    .filter((price) => price.cents !== null)
    .map((price) => ({
      business_id: business.id,
      service_id: serviceId,
      vehicle_type_id: price.vehicleTypeId,
      price_cents: price.cents as number,
    }));
  if (toUpsert.length > 0) {
    const { error } = await supabase.from("service_prices").upsert(toUpsert, { onConflict: "service_id,vehicle_type_id" });
    if (error) return dbFailure(error);
  }

  const toRemove = prices.filter((price) => price.cents === null).map((price) => price.vehicleTypeId);
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("service_prices")
      .delete()
      .eq("business_id", business.id)
      .eq("service_id", serviceId)
      .in("vehicle_type_id", toRemove);
    if (error) return dbFailure(error);
  }

  refresh();
  return success(id ? "Guardado." : "Agregado.");
}

export async function deleteService(id: string): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  if (!isUuid(id)) return failure("No se encontró.");
  // Past bookings keep their own copy of the service name and price.
  const { error } = await supabase.from("services").delete().eq("id", id).eq("business_id", business.id);
  if (error) return dbFailure(error);
  refresh();
  return success("Borrado.");
}

// Moves a service one place up or down within its group (main services, exterior extras
// or interior extras), which is the order customers see.
export async function moveService(id: string, direction: "up" | "down"): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  if (!isUuid(id) || (direction !== "up" && direction !== "down")) return failure("No se encontró.");

  const { data, error } = await supabase
    .from("services")
    .select("id, kind, area, sort_order")
    .eq("business_id", business.id)
    .order("sort_order")
    .order("created_at");
  if (error) return dbFailure(error);

  const services = data.map((row) => ({ id: row.id, sortOrder: row.sort_order, group: row.kind === "base" ? "base" : row.area }));
  for (const change of moveWithinGroup(services, (service) => service.group, id, direction)) {
    const { error: updateError } = await supabase
      .from("services")
      .update({ sort_order: change.sortOrder })
      .eq("id", change.id)
      .eq("business_id", business.id);
    if (updateError) return dbFailure(updateError);
  }
  refresh();
  return success("Listo.");
}
