"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/panel/action-state";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function CheckboxField({
  name,
  label,
  defaultChecked,
  value,
  id,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  value?: string;
  id: string;
}) {
  return (
    <label htmlFor={id} className="flex min-h-9 items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="size-5 accent-neutral-900"
      />
      {label}
    </label>
  );
}

export function FormFooter({
  state,
  pending,
  label = "Guardar",
  children,
}: {
  state: ActionState;
  pending: boolean;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : label}
      </Button>
      {children}
      {state.status !== "idle" && (
        <p
          aria-live="polite"
          className={cn("text-sm", state.status === "error" ? "text-destructive" : "text-green-700")}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

export const selectClassName =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs md:text-sm";
