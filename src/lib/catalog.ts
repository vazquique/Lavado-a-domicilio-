import type { SupabaseClient } from "@supabase/supabase-js";

export type Business = {
  id: string;
  slug: string;
  name: string;
  whatsappPhone: string | null;
  brandColor: string;
  depositType: "percent" | "fixed";
  depositValue: number;
  workingDays: number[];
};

export type VehicleType = { id: string; name: string };

export type Service = {
  id: string;
  name: string;
  description: string;
  kind: "base" | "extra";
};

export type ServicePrice = { serviceId: string; vehicleTypeId: string; priceCents: number };

export type Zone = { id: string; name: string; surchargeCents: number };

export type TimeSlot = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
};

export type BusinessCatalog = {
  business: Business;
  vehicleTypes: VehicleType[];
  services: Service[];
  prices: ServicePrice[];
  zones: Zone[];
  timeSlots: TimeSlot[];
};

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Loads everything the public page needs for one business, or null if the
// slug doesn't belong to an active business.
export async function getBusinessCatalog(
  supabase: SupabaseClient,
  slug: string,
): Promise<BusinessCatalog | null> {
  if (!SLUG_PATTERN.test(slug)) return null;

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, slug, name, whatsapp_phone, brand_color, deposit_type, deposit_value, working_days")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!business) return null;

  const [vehicleTypes, services, prices, zones, timeSlots] = await Promise.all([
    supabase
      .from("vehicle_types")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("services")
      .select("id, name, description, kind")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("service_prices")
      .select("service_id, vehicle_type_id, price_cents")
      .eq("business_id", business.id),
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
      .order("sort_order"),
  ]);

  for (const result of [vehicleTypes, services, prices, zones, timeSlots]) {
    if (result.error) throw result.error;
  }

  return {
    business: {
      id: business.id,
      slug: business.slug,
      name: business.name,
      whatsappPhone: business.whatsapp_phone,
      brandColor: business.brand_color,
      depositType: business.deposit_type,
      depositValue: business.deposit_value,
      workingDays: business.working_days,
    },
    vehicleTypes: vehicleTypes.data ?? [],
    services: services.data ?? [],
    prices: (prices.data ?? []).map((row) => ({
      serviceId: row.service_id,
      vehicleTypeId: row.vehicle_type_id,
      priceCents: row.price_cents,
    })),
    zones: (zones.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      surchargeCents: row.surcharge_cents,
    })),
    timeSlots: (timeSlots.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      startTime: row.start_time,
      endTime: row.end_time,
      capacity: row.capacity,
    })),
  };
}

// Lowest and highest price of a service across vehicle types, or null if it has no price yet.
export function priceRange(
  serviceId: string,
  prices: ServicePrice[],
): { min: number; max: number } | null {
  const amounts = prices.filter((price) => price.serviceId === serviceId).map((price) => price.priceCents);
  if (amounts.length === 0) return null;
  return { min: Math.min(...amounts), max: Math.max(...amounts) };
}
