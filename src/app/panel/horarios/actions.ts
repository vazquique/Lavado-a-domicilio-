"use server";

import { refresh } from "next/cache";
import { dbFailure, failure, isUuid, success, type ActionState } from "@/lib/panel/action-state";
import { blockedDateSchema, firstError, scheduleSettingsSchema, timeSlotSchema } from "@/lib/panel/schemas";
import { requirePanelBusiness } from "@/lib/panel/session";

export async function saveScheduleSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  const parsed = scheduleSettingsSchema.safeParse({
    workingDays: formData.getAll("workingDays"),
    leadHours: formData.get("leadHours"),
    horizonDays: formData.get("horizonDays"),
  });
  if (!parsed.success) return failure(firstError(parsed.error));

  const { workingDays, leadHours, horizonDays } = parsed.data;
  const { error } = await supabase
    .from("businesses")
    .update({
      working_days: workingDays,
      booking_lead_minutes: Math.round(leadHours * 60),
      booking_horizon_days: horizonDays,
    })
    .eq("id", business.id);
  if (error) return dbFailure(error);

  refresh();
  return success();
}

export async function saveTimeSlot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  const parsed = timeSlotSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    capacity: formData.get("capacity"),
    active: formData.get("active"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.success) return failure(firstError(parsed.error));

  const { id, name, startTime, endTime, capacity, active, sortOrder } = parsed.data;
  const values = { name, start_time: startTime, end_time: endTime, capacity, active, sort_order: sortOrder };
  const { error } = id
    ? await supabase.from("time_slots").update(values).eq("id", id).eq("business_id", business.id)
    : await supabase.from("time_slots").insert({ ...values, business_id: business.id });
  if (error) return dbFailure(error);

  refresh();
  return success(id ? "Guardado." : "Agregada.");
}

export async function deleteTimeSlot(id: string): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  if (!isUuid(id)) return failure("No se encontró.");
  const { error } = await supabase.from("time_slots").delete().eq("id", id).eq("business_id", business.id);
  if (error) return dbFailure(error);
  refresh();
  return success("Borrada.");
}

export async function addBlockedDate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  const parsed = blockedDateSchema.safeParse({ date: formData.get("date"), reason: formData.get("reason") });
  if (!parsed.success) return failure(firstError(parsed.error));

  const { error } = await supabase
    .from("blocked_dates")
    .insert({ business_id: business.id, date: parsed.data.date, reason: parsed.data.reason });
  if (error?.code === "23505") return failure("Ese día ya está bloqueado.");
  if (error) return dbFailure(error);

  refresh();
  return success("Día bloqueado.");
}

export async function removeBlockedDate(date: string): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  const parsed = blockedDateSchema.shape.date.safeParse(date);
  if (!parsed.success) return failure("No se encontró.");
  const { error } = await supabase.from("blocked_dates").delete().eq("business_id", business.id).eq("date", parsed.data);
  if (error) return dbFailure(error);
  refresh();
  return success("Desbloqueado.");
}
