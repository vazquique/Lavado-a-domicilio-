import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduleRules, SlotRule, SlotUsage } from "./availability";
import { isCarPart, type CarPart, type ServiceArea } from "./car-parts";
import { addDays, todayInMexico } from "./dates";
import { logoUrl } from "./logos";
import type { QuoteCatalog } from "./quote";

export type BookingService = QuoteCatalog["services"][number] & {
  description: string;
  area: ServiceArea;
  carParts: CarPart[];
  // Plain-language explanation for customers (src/lib/service-explainers.ts).
  explainer: string | null;
};

// Everything the public booking page needs for one business. Plain data, so it can
// be passed to the browser; amounts are recomputed on the server before any use.
export type BookingData = {
  business: {
    id: string;
    slug: string;
    name: string;
    whatsappPhone: string | null;
    brandColor: string;
    logoUrl: string | null;
    cancellationPolicy: string;
    privacyNotice: string;
  };
  catalog: Omit<QuoteCatalog, "services"> & { services: BookingService[] };
  rules: ScheduleRules;
  slots: SlotRule[];
  usage: SlotUsage[];
};

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Null when the slug doesn't belong to an active business.
export async function getBookingData(supabase: SupabaseClient, slug: string, now: Date): Promise<BookingData | null> {
  if (!SLUG_PATTERN.test(slug)) return null;

  const { data: business, error } = await supabase
    .from("businesses")
    .select(
      "id, slug, name, whatsapp_phone, brand_color, logo_path, deposit_type, deposit_value, working_days, booking_lead_minutes, booking_horizon_days, cancellation_policy, privacy_notice",
    )
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!business) return null;

  const today = todayInMexico(now);
  const lastDay = addDays(today, business.booking_horizon_days);

  const [vehicleTypes, services, prices, zones, slots, blocked, usage] = await Promise.all([
    supabase.from("vehicle_types").select("id, name").eq("business_id", business.id).eq("active", true).order("sort_order"),
    supabase
      .from("services")
      .select("id, name, description, kind, capacity_units, includes_extras, area, car_parts, explainer")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort_order"),
    supabase.from("service_prices").select("service_id, vehicle_type_id, price_cents").eq("business_id", business.id),
    supabase
      .from("zones")
      .select("id, name, surcharge_cents")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("time_slots")
      .select("id, name, start_time, end_time, capacity")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort_order")
      .order("start_time"),
    supabase.from("blocked_dates").select("date").eq("business_id", business.id).gte("date", today).lte("date", lastDay),
    supabase.rpc("slot_usage", { p_business_id: business.id, p_from: today, p_to: lastDay }),
  ]);
  for (const result of [vehicleTypes, services, prices, zones, slots, blocked, usage]) {
    if (result.error) throw result.error;
  }

  return {
    business: {
      id: business.id,
      slug: business.slug,
      name: business.name,
      whatsappPhone: business.whatsapp_phone,
      brandColor: business.brand_color,
      logoUrl: logoUrl(business.logo_path),
      cancellationPolicy: business.cancellation_policy,
      privacyNotice: business.privacy_notice,
    },
    catalog: {
      vehicleTypes: vehicleTypes.data ?? [],
      services: (services.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        kind: row.kind,
        capacityUnits: row.capacity_units,
        includesExtras: row.includes_extras,
        area: row.area === "interior" ? "interior" : "exterior",
        carParts: ((row.car_parts as unknown[] | null) ?? []).filter(isCarPart),
        explainer: row.explainer,
      })),
      prices: (prices.data ?? []).map((row) => ({
        serviceId: row.service_id,
        vehicleTypeId: row.vehicle_type_id,
        priceCents: row.price_cents,
      })),
      zones: (zones.data ?? []).map((row) => ({ id: row.id, name: row.name, surchargeCents: row.surcharge_cents })),
      deposit: { type: business.deposit_type, value: business.deposit_value },
    },
    rules: {
      workingDays: business.working_days,
      leadMinutes: business.booking_lead_minutes,
      horizonDays: business.booking_horizon_days,
      blockedDates: (blocked.data ?? []).map((row) => row.date),
    },
    slots: (slots.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      startTime: row.start_time,
      endTime: row.end_time,
      capacity: row.capacity,
    })),
    usage: (usage.data ?? []).map((row: { service_date: string; time_slot_id: string; used_units: number }) => ({
      date: row.service_date,
      timeSlotId: row.time_slot_id,
      usedUnits: row.used_units,
    })),
  };
}

export function depositLabel(deposit: QuoteCatalog["deposit"], formatFixed: (cents: number) => string): string {
  return deposit.type === "percent" ? `${deposit.value}%` : formatFixed(deposit.value);
}
