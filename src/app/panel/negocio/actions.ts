"use server";

import { refresh } from "next/cache";
import { dbFailure, failure, success, type ActionState } from "@/lib/panel/action-state";
import { businessSettingsSchema, firstError } from "@/lib/panel/schemas";
import { requirePanelBusiness } from "@/lib/panel/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveBusinessSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  const parsed = businessSettingsSchema.safeParse({
    name: formData.get("name"),
    whatsappPhone: formData.get("whatsappPhone"),
    brandColor: formData.get("brandColor"),
    depositType: formData.get("depositType"),
    depositValue: formData.get("depositValue"),
    cancellationPolicy: formData.get("cancellationPolicy"),
    privacyNotice: formData.get("privacyNotice"),
  });
  if (!parsed.success) return failure(firstError(parsed.error));

  const values = parsed.data;
  const { error } = await supabase
    .from("businesses")
    .update({
      name: values.name,
      whatsapp_phone: values.whatsappPhone,
      brand_color: values.brandColor.toLowerCase(),
      deposit_type: values.depositType,
      deposit_value: values.depositValue,
      cancellation_policy: values.cancellationPolicy,
      privacy_notice: values.privacyNotice,
    })
    .eq("id", business.id);
  if (error) return dbFailure(error);

  refresh();
  return success();
}

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function uploadLogo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return failure("Elige una imagen.");
  const extension = LOGO_TYPES[file.type];
  if (!extension) return failure("La imagen debe ser PNG, JPG o WebP.");
  if (file.size > MAX_LOGO_BYTES) return failure("La imagen pesa más de 2 MB. Prueba con una captura de pantalla del logo.");

  // The user was checked above (requirePanelBusiness) and the path is built from their
  // business id, so the upload can use the server's key. A new name each time, so
  // browsers and WhatsApp don't keep showing the old logo.
  const admin = createAdminClient();
  if (!admin) return failure("Falta configurar el servidor para subir imágenes.");
  const path = `${business.id}/logo-${Date.now()}.${extension}`;
  const upload = await admin.storage.from("logos").upload(path, file, { contentType: file.type });
  if (upload.error) return failure("No se pudo subir la imagen. Intenta de nuevo.");

  const { error } = await supabase.from("businesses").update({ logo_path: path }).eq("id", business.id);
  if (error) return dbFailure(error);

  refresh();
  return success("Logo actualizado.");
}

export async function removeLogo(): Promise<ActionState> {
  const { supabase, business } = await requirePanelBusiness();
  const { error } = await supabase.from("businesses").update({ logo_path: null }).eq("id", business.id);
  if (error) return dbFailure(error);
  refresh();
  return success("Logo quitado.");
}
