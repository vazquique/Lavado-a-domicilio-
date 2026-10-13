"use client";

import { useEffect, useRef, useState } from "react";
import { CarDiagram } from "@/components/car-diagram";
import { ServiceExplainer } from "@/components/service-explainer";
import { DeleteButton } from "@/components/panel/delete-button";
import { CheckboxField, Field, FormFooter, selectClassName } from "@/components/panel/form-bits";
import { useFormAction } from "@/components/panel/use-form-action";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AREA_LABELS,
  CAR_PART_LABELS,
  CAR_PARTS,
  PARTS_BY_AREA,
  SERVICE_AREAS,
  type CarPart,
  type ServiceArea,
} from "@/lib/car-parts";
import { centsToPesosInput } from "@/lib/panel/parse";
import { EXPLAINER_IDS, EXPLAINERS, isExplainerId } from "@/lib/service-explainers";
import { deleteService, saveService } from "./actions";

export type ServiceValues = {
  id: string;
  name: string;
  description: string;
  kind: "base" | "extra";
  capacityUnits: number;
  includesExtras: boolean;
  active: boolean;
  sortOrder: number;
  area: ServiceArea;
  carParts: CarPart[];
  explainer: string | null;
  prices: Record<string, number>;
};

export function ServiceForm({
  service,
  vehicleTypes,
  brandColor,
}: {
  service?: ServiceValues;
  vehicleTypes: { id: string; name: string }[];
  brandColor: string;
}) {
  const { state, pending, formRef, onSubmit } = useFormAction(saveService, { resetOnSuccess: !service });
  const key = service?.id ?? "new";

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={service?.id ?? ""} />
      <Field label="Nombre" htmlFor={`name-${key}`}>
        <Input id={`name-${key}`} name="name" defaultValue={service?.name} required maxLength={80} />
      </Field>
      <Field label="Descripción (opcional)" htmlFor={`description-${key}`}>
        <Textarea
          id={`description-${key}`}
          name="description"
          defaultValue={service?.description}
          maxLength={300}
          rows={2}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo" htmlFor={`kind-${key}`} hint="Principal: el cliente elige uno. Extra: se suma.">
          <select id={`kind-${key}`} name="kind" defaultValue={service?.kind ?? "extra"} className={selectClassName}>
            <option value="base">Principal</option>
            <option value="extra">Extra</option>
          </select>
        </Field>
        <Field label="Área" htmlFor={`area-${key}`} hint="En qué pestaña aparece el extra.">
          <select id={`area-${key}`} name="area" defaultValue={service?.area ?? "exterior"} className={selectClassName}>
            {SERVICE_AREAS.map((area) => (
              <option key={area} value={area}>
                {AREA_LABELS[area]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <CarPartsField defaultParts={service?.carParts ?? []} color={brandColor} />

      <ExplainerField id={`explainer-${key}`} defaultValue={service?.explainer ?? ""} color={brandColor} />

      <Field
        label="Lugares que ocupa"
        htmlFor={`units-${key}`}
        hint="Cada franja tiene lugares (ve Horarios). Lavado normal: 1. Un servicio que tarda toda la franja: el cupo completo. Extras rápidos: 0."
      >
        <Input
          id={`units-${key}`}
          name="capacityUnits"
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          defaultValue={service?.capacityUnits ?? 0}
          className="w-24"
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Precio por vehículo</legend>
        <p className="text-xs text-muted-foreground">Déjalo vacío si no ofreces este servicio para ese vehículo.</p>
        {vehicleTypes.map((vehicle) => (
          <div key={vehicle.id} className="grid grid-cols-[1fr_7.5rem] items-center gap-3">
            <label htmlFor={`price-${key}-${vehicle.id}`} className="text-sm">
              {vehicle.name}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id={`price-${key}-${vehicle.id}`}
                name={`price_${vehicle.id}`}
                inputMode="decimal"
                placeholder="—"
                defaultValue={
                  service?.prices[vehicle.id] !== undefined ? centsToPesosInput(service.prices[vehicle.id]) : ""
                }
                className="pl-7 text-right"
              />
            </div>
          </div>
        ))}
      </fieldset>

      <CheckboxField
        id={`includes-${key}`}
        name="includesExtras"
        label="Incluye todos los extras (solo principales; oculta los extras al cliente)"
        defaultChecked={service?.includesExtras ?? false}
      />
      <CheckboxField id={`active-${key}`} name="active" label="Visible para clientes" defaultChecked={service?.active ?? true} />
      <FormFooter state={state} pending={pending} label={service ? "Guardar" : "Agregar"}>
        {service && (
          <DeleteButton
            action={deleteService.bind(null, service.id)}
            confirmText={`¿Borrar "${service.name}"? Las reservas que ya existen no cambian.`}
          />
        )}
      </FormFooter>
    </form>
  );
}

function checkedParts(fieldset: HTMLFieldSetElement | null): CarPart[] {
  const checked = new Set(
    Array.from(fieldset?.querySelectorAll<HTMLInputElement>("input[name=carParts]:checked") ?? [], (input) => input.value),
  );
  return CAR_PARTS.filter((part) => checked.has(part));
}

// Parts of the car the service works on, as chips, with the drawing customers see.
function CarPartsField({ defaultParts, color }: { defaultParts: CarPart[]; color: string }) {
  const [parts, setParts] = useState(defaultParts);
  const ref = useRef<HTMLFieldSetElement>(null);

  // "Add new" forms are reset after saving: redraw once the browser has cleared the chips.
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onReset = () => setTimeout(() => setParts(checkedParts(ref.current)), 0);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  return (
    <fieldset ref={ref} onChange={() => setParts(checkedParts(ref.current))} className="space-y-2">
      <legend className="text-sm font-medium">Partes del auto</legend>
      <p className="text-xs text-muted-foreground">Se iluminan en el dibujo del auto que ven tus clientes.</p>
      <div className="flex items-start gap-4">
        <CarDiagram parts={parts} color={color} className="w-16 shrink-0" />
        <div className="space-y-3">
          {SERVICE_AREAS.map((area) => (
            <div key={area} className="space-y-1.5">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{AREA_LABELS[area]}</p>
              <div className="flex flex-wrap gap-1.5">
                {PARTS_BY_AREA[area].map((part) => (
                  <label key={part} className="cursor-pointer">
                    <input
                      type="checkbox"
                      name="carParts"
                      value={part}
                      defaultChecked={defaultParts.includes(part)}
                      className="peer sr-only"
                    />
                    <span className="block rounded-full border px-3 py-1.5 text-xs peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                      {CAR_PART_LABELS[part]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

// Which plain-language explanation customers see under "¿Qué es esto?", with a preview.
function ExplainerField({ id, defaultValue, color }: { id: string; defaultValue: string; color: string }) {
  const [value, setValue] = useState(defaultValue);
  const explainerId = isExplainerId(value) ? value : null;
  return (
    <Field label="Explicación para el cliente" htmlFor={id} hint="Lo que ve el cliente al tocar “¿Qué es esto?”.">
      <select
        id={id}
        name="explainer"
        defaultValue={defaultValue}
        onChange={(event) => setValue(event.target.value)}
        className={selectClassName}
      >
        <option value="">Sin explicación</option>
        {EXPLAINER_IDS.map((explainerId) => (
          <option key={explainerId} value={explainerId}>
            {EXPLAINERS[explainerId].name}
          </option>
        ))}
      </select>
      {explainerId && (
        <details className="rounded-lg border bg-muted/40 p-3">
          <summary className="cursor-pointer text-sm font-medium">Ver cómo la ve el cliente</summary>
          <div className="mt-3">
            <ServiceExplainer explainerId={explainerId} color={color} />
          </div>
        </details>
      )}
    </Field>
  );
}
