import Link from "next/link";
import type { ReactNode } from "react";

export function SectionHeader({
  title,
  description,
  back = { href: "/panel", label: "Panel" },
}: {
  title: string;
  description?: string;
  back?: { href: string; label: string };
}) {
  return (
    <header className="space-y-1">
      <Link href={back.href} className="text-sm text-muted-foreground">
        ← {back.label}
      </Link>
      <h1 className="text-2xl font-bold">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </header>
  );
}

export function PanelLoading() {
  return <p className="text-muted-foreground">Cargando…</p>;
}

export function NoBusiness() {
  return (
    <p className="rounded-lg bg-amber-100 p-4 text-amber-900">
      Tu correo todavía no tiene un negocio asignado. Escríbenos para darte acceso.
    </p>
  );
}

// Collapsible box for "add new" forms, closed by default to keep the page short.
export function AddNew({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border border-dashed bg-card p-4">
      <summary className="cursor-pointer font-medium">+ {label}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
