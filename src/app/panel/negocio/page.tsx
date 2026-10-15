import { Suspense } from "react";
import { DeleteButton } from "@/components/panel/delete-button";
import { NoBusiness, PanelLoading, SectionHeader } from "@/components/panel/section";
import { logoUrl } from "@/lib/logos";
import { getPanelSession } from "@/lib/panel/session";
import { revokeAccess } from "./actions";
import { AccessForm, BusinessSettingsForm, LogoForm } from "./forms";

export default function BusinessPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Tu negocio" description="Lo que ven tus clientes en tu página, y quién entra a este panel." />
      <Suspense fallback={<PanelLoading />}>
        <BusinessEditor />
      </Suspense>
    </div>
  );
}

async function BusinessEditor() {
  const { supabase, business } = await getPanelSession();
  if (!business) return <NoBusiness />;

  const [{ data, error }, access] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "name, whatsapp_phone, brand_color, logo_path, deposit_type, deposit_value, cancellation_policy, privacy_notice, price_notice, special_services_notice",
      )
      .eq("id", business.id)
      .single(),
    supabase.rpc("business_access", { p_business_id: business.id }),
  ]);
  if (error) throw error;
  if (access.error) throw access.error;
  const people = (access.data ?? []) as { email: string; status: "member" | "invited"; is_you: boolean }[];

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Logo</h2>
        <LogoForm logoUrl={logoUrl(data.logo_path)} />
      </section>
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <BusinessSettingsForm
          values={{
            name: data.name,
            whatsappPhone: data.whatsapp_phone ?? "",
            brandColor: data.brand_color,
            depositType: data.deposit_type,
            depositValue: data.deposit_value,
            cancellationPolicy: data.cancellation_policy,
            privacyNotice: data.privacy_notice,
            priceNotice: data.price_notice,
            specialServicesNotice: data.special_services_notice,
          }}
        />
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">Acceso al panel</h2>
          <p className="text-sm text-muted-foreground">Quién puede entrar a este panel con su correo.</p>
        </div>
        <ul className="divide-y">
          {people.map((person) => (
            <li key={person.email} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{person.email}</span>
                <span className="text-xs text-muted-foreground">
                  {person.is_you ? "Tú" : person.status === "member" ? "Ya puede entrar" : "Todavía no entra por primera vez"}
                </span>
              </span>
              {!person.is_you && (
                <DeleteButton
                  action={revokeAccess.bind(null, person.email)}
                  confirmText={`¿Quitarle el acceso al panel a ${person.email}?`}
                  label="Quitar"
                />
              )}
            </li>
          ))}
        </ul>
        <AccessForm />
      </section>
    </div>
  );
}
