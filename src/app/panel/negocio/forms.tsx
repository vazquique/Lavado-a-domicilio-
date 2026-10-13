"use client";

import Image from "next/image";
import { startTransition, useState, type ChangeEvent } from "react";
import { DeleteButton } from "@/components/panel/delete-button";
import { Field, FormFooter, selectClassName } from "@/components/panel/form-bits";
import { useFormAction } from "@/components/panel/use-form-action";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { centsToPesosInput } from "@/lib/panel/parse";
import { cn } from "@/lib/utils";
import { grantAccess, removeLogo, saveBusinessSettings, uploadLogo } from "./actions";
import { resizeImage } from "./resize-image";

export type BusinessSettingsValues = {
  name: string;
  whatsappPhone: string;
  brandColor: string;
  depositType: "percent" | "fixed";
  depositValue: number;
  cancellationPolicy: string;
  privacyNotice: string;
};

export function BusinessSettingsForm({ values }: { values: BusinessSettingsValues }) {
  const { state, pending, formRef, onSubmit } = useFormAction(saveBusinessSettings);
  const [depositType, setDepositType] = useState(values.depositType);
  const depositDefault =
    values.depositType === "fixed" ? centsToPesosInput(values.depositValue) : String(values.depositValue);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <Field label="Nombre del negocio" htmlFor="name">
        <Input id="name" name="name" defaultValue={values.name} required maxLength={80} />
      </Field>
      <Field label="WhatsApp del negocio" htmlFor="whatsappPhone" hint="10 dígitos. Aquí te escriben tus clientes.">
        <Input
          id="whatsappPhone"
          name="whatsappPhone"
          type="tel"
          inputMode="tel"
          defaultValue={values.whatsappPhone}
          required
        />
      </Field>
      <Field label="Color de tu marca" htmlFor="brandColor">
        <Input id="brandColor" name="brandColor" type="color" defaultValue={values.brandColor} className="h-11 w-24 p-1" />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Anticipo</legend>
        <div className="grid grid-cols-2 gap-3">
          <select
            name="depositType"
            aria-label="Tipo de anticipo"
            value={depositType}
            onChange={(event) => setDepositType(event.target.value as "percent" | "fixed")}
            className={selectClassName}
          >
            <option value="percent">Porcentaje</option>
            <option value="fixed">Monto fijo</option>
          </select>
          <div className="relative">
            <span
              className={cn(
                "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
                depositType === "fixed" ? "left-3" : "right-3",
              )}
            >
              {depositType === "fixed" ? "$" : "%"}
            </span>
            <Input
              name="depositValue"
              aria-label="Anticipo"
              inputMode="decimal"
              defaultValue={depositDefault}
              required
              className={depositType === "fixed" ? "pl-7" : "pr-8"}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">El cliente paga esto al reservar; el resto, el día del servicio.</p>
      </fieldset>

      <Field label="Política de cancelación" htmlFor="cancellationPolicy" hint="El cliente la acepta antes de pagar.">
        <Textarea id="cancellationPolicy" name="cancellationPolicy" defaultValue={values.cancellationPolicy} rows={4} maxLength={2000} />
      </Field>
      <Field label="Aviso de privacidad" htmlFor="privacyNotice" hint="El cliente lo acepta antes de pagar.">
        <Textarea id="privacyNotice" name="privacyNotice" defaultValue={values.privacyNotice} rows={5} maxLength={4000} />
      </Field>
      <FormFooter state={state} pending={pending} />
    </form>
  );
}

export function LogoForm({ logoUrl }: { logoUrl: string | null }) {
  const { state, pending, formRef, dispatch } = useFormAction(uploadLogo);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState("");

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPrepareError("");
    setPreparing(true);
    try {
      const resized = await resizeImage(file);
      const formData = new FormData();
      formData.set("logo", resized);
      startTransition(() => dispatch(formData));
    } catch {
      setPrepareError("No pudimos leer esa imagen. Prueba con otra (PNG o JPG).");
    } finally {
      setPreparing(false);
      event.target.value = "";
    }
  }

  const busy = pending || preparing;
  return (
    <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="space-y-3">
      {logoUrl ? (
        <div className="relative size-24 overflow-hidden rounded-lg border bg-white">
          <Image src={logoUrl} alt="Logo actual" fill unoptimized className="object-contain p-1" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Todavía no tienes logo.</p>
      )}
      <label
        className={cn(
          "inline-flex h-9 cursor-pointer items-center rounded-md border px-4 text-sm font-medium shadow-xs",
          busy && "pointer-events-none opacity-50",
        )}
      >
        {busy ? "Subiendo…" : logoUrl ? "Cambiar logo" : "Subir logo"}
        <input type="file" accept="image/*" className="sr-only" onChange={onFileChange} disabled={busy} />
      </label>
      {logoUrl && <DeleteButton action={removeLogo} confirmText="¿Quitar el logo de tu página?" label="Quitar logo" />}
      {(prepareError || state.status !== "idle") && (
        <p aria-live="polite" className={cn("text-sm", prepareError || state.status === "error" ? "text-destructive" : "text-green-700")}>
          {prepareError || state.message}
        </p>
      )}
    </form>
  );
}

// Gives someone else access to this panel by email.
export function AccessForm() {
  const { state, pending, formRef, onSubmit } = useFormAction(grantAccess, { resetOnSuccess: true });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <Field label="Correo de la persona" htmlFor="access-email" hint="Entrará con un código que le llega a ese correo.">
        <Input id="access-email" name="email" type="email" inputMode="email" autoComplete="off" required />
      </Field>
      <FormFooter state={state} pending={pending} label="Dar acceso" />
    </form>
  );
}

