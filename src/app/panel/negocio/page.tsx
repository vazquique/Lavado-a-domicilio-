import { Suspense } from "react";
import { NoBusiness, PanelLoading, SectionHeader } from "@/components/panel/section";
import { logoUrl } from "@/lib/logos";
import { getPanelSession } from "@/lib/panel/session";
import { BusinessSettingsForm, LogoForm } from "./forms";

export default function BusinessPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Tu negocio" description="Lo que ven tus clientes en tu página." />
      <Suspense fallback={<PanelLoading />}>
        <BusinessEditor />
      </Suspense>
    </div>
  );
}

async function BusinessEditor() {
  const { supabase, business } = await getPanelSession();
  if (!business) return <NoBusiness />;

  const { data, error } = await supabase
    .from("businesses")
    .select(
      "name, whatsapp_phone, brand_color, logo_path, deposit_type, deposit_value, cancellation_policy, privacy_notice",
    )
    .eq("id", business.id)
    .single();
  if (error) throw error;

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
          }}
        />
      </section>
    </div>
  );
}
