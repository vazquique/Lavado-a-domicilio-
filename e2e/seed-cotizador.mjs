// Test data for e2e/cotizador.mjs in the local Supabase emulator.
// Test data in the local Supabase: prices for some extras and a full morning tomorrow.
const base = "http://127.0.0.1:54321/rest/v1";
const headers = { Authorization: "Bearer sb_secret_local", "Content-Type": "application/json", Prefer: "return=representation" };
const get = async (path) => (await fetch(`${base}/${path}`, { headers })).json();
const [business] = await get("businesses?select=id&slug=eq.jbsbros");
const vehicles = await get(`vehicle_types?select=id,name&business_id=eq.${business.id}&order=sort_order.asc`);
const services = await get(`services?select=id,name&business_id=eq.${business.id}`);
const slots = await get(`time_slots?select=id,name&business_id=eq.${business.id}`);
const id = (name) => services.find((service) => service.name === name).id;
const car = vehicles[0].id;
const prices = [
  { service_id: id("Full detailing"), vehicle_type_id: car, price_cents: 150000 },
  { service_id: id("Restauración de faros"), vehicle_type_id: car, price_cents: 40000 },
  { service_id: id("Tratamiento cerámico"), vehicle_type_id: car, price_cents: 250000 },
].map((price) => ({ ...price, business_id: business.id }));
let r = await fetch(`${base}/service_prices`, { method: "POST", headers, body: JSON.stringify(prices) });
console.log("prices", r.status);
r = await fetch(`${base}/services?id=eq.${id("Tratamiento cerámico")}`, { method: "PATCH", headers, body: JSON.stringify({ capacity_units: 1 }) });
console.log("ceramic units", r.status);
const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
const morning = slots.find((slot) => slot.name === "Mañana").id;
r = await fetch(`${base}/bookings`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    business_id: business.id, status: "confirmed", source: "manual", service_date: tomorrow, time_slot_id: morning,
    customer_name: "Ocupado", customer_phone: "3311111111", address: "Calle 1", vehicle_type_name: "Carro normal",
    time_slot_name: "Mañana", items: [], subtotal_cents: 23000, surcharge_cents: 0, total_cents: 23000,
    deposit_cents: 0, capacity_units: 3,
  }),
});
console.log("booking", r.status, tomorrow);
