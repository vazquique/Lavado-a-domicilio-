import Link from "next/link";
import { Suspense } from "react";
import { NoBusiness, PanelLoading } from "@/components/panel/section";
import { Button } from "@/components/ui/button";
import { getPanelSession } from "@/lib/panel/session";
import { signOut } from "./entrar/actions";

const SECTIONS = [
  { href: "/panel/servicios", title: "Servicios y precios", text: "Lavados, paquetes, extras y precio por vehículo" },
  { href: "/panel/vehiculos", title: "Tipos de vehículo", text: "Carro, camioneta mediana, grande…" },
  { href: "/panel/zonas", title: "Zonas", text: "Colonias que cubres y recargos" },
  { href: "/panel/horarios", title: "Horarios", text: "Franjas, cupos, días de trabajo y fechas bloqueadas" },
  { href: "/panel/negocio", title: "Tu negocio", text: "Nombre, WhatsApp, logo, color, anticipo y textos" },
] as const;

export default function PanelHomePage() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <PanelHome />
    </Suspense>
  );
}

async function PanelHome() {
  const { business, email } = await getPanelSession();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">{email}</p>
        <h1 className="text-2xl font-bold">{business?.name ?? "Tu panel"}</h1>
      </header>

      {business ? (
        <>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/${business.slug}`}>Ver mi página como cliente</Link>
          </Button>
          <nav className="space-y-3">
            {SECTIONS.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="block rounded-xl border bg-card p-4 shadow-sm active:bg-accent"
              >
                <span className="font-semibold">{section.title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{section.text}</span>
              </Link>
            ))}
          </nav>
        </>
      ) : (
        <NoBusiness />
      )}

      <form action={signOut}>
        <Button type="submit" variant="ghost" className="px-0 text-muted-foreground">
          Salir
        </Button>
      </form>
    </div>
  );
}
