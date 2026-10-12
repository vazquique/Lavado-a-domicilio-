-- First business: JB's Bros (Zapopan, Jalisco).
-- Everything marked TODO is example data until the owner sends the real values
-- (price card photo). After the panel exists, the owner edits this from there.

do $$
declare
  biz uuid;
  v_auto uuid;
  v_suv uuid;
  v_pickup uuid;
  s_exterior uuid;
  s_package uuid;
  s_vacuum uuid;
  s_wax uuid;
  s_polish uuid;
begin
  insert into public.businesses (
    slug, name, whatsapp_phone, folio_prefix, deposit_type, deposit_value,
    working_days, booking_lead_minutes, booking_horizon_days,
    cancellation_policy, privacy_notice
  ) values (
    'jbsbros',
    'JB''s Bros',
    null, -- TODO: WhatsApp del negocio (10 dígitos)
    'JBS',
    'percent', 30, -- TODO: anticipo real
    '{1,2,3,4,5,6}', -- TODO: días laborales (lunes a sábado de ejemplo)
    120, -- confirmado: mismo día con 2 horas de anticipación
    30,
    -- TODO: revisar texto de política de cancelación
    'Puedes cancelar o cambiar tu cita sin costo hasta 24 horas antes. '
      || 'Si cancelas con menos de 24 horas o no estás en el domicilio a la hora acordada, '
      || 'el anticipo no es reembolsable. Si nosotros cancelamos, te devolvemos el anticipo completo.',
    -- TODO: revisar aviso de privacidad (idealmente con un abogado)
    'JB''s Bros usa tu nombre, celular, dirección y correo solo para agendar y realizar tu servicio '
      || 'y contactarte sobre él. No vendemos tus datos; solo los compartimos con Mercado Pago para '
      || 'procesar tu pago. Puedes pedir que corrijamos o borremos tus datos escribiéndonos por WhatsApp.'
  )
  returning id into biz;

  -- TODO: tipos de vehículo reales (3 de la tarjeta de precios)
  insert into public.vehicle_types (business_id, name, sort_order)
    values (biz, 'Auto (sedán o hatchback)', 1) returning id into v_auto;
  insert into public.vehicle_types (business_id, name, sort_order)
    values (biz, 'SUV o camioneta', 2) returning id into v_suv;
  insert into public.vehicle_types (business_id, name, sort_order)
    values (biz, 'Pickup o van', 3) returning id into v_pickup;

  -- TODO: servicios y precios reales
  insert into public.services (business_id, name, description, kind, sort_order)
    values (biz, 'Lavado exterior', 'Carrocería, rines, llantas y vidrios.', 'base', 1)
    returning id into s_exterior;
  insert into public.services (business_id, name, description, kind, sort_order)
    values (biz, 'Paquete completo', 'Lavado exterior, aspirado interior y cera.', 'base', 2)
    returning id into s_package;
  insert into public.services (business_id, name, description, kind, sort_order)
    values (biz, 'Aspirado interior', 'Asientos, alfombras y cajuela.', 'extra', 3)
    returning id into s_vacuum;
  insert into public.services (business_id, name, description, kind, sort_order)
    values (biz, 'Cera', 'Brillo y protección para la pintura.', 'extra', 4)
    returning id into s_wax;
  insert into public.services (business_id, name, description, kind, sort_order)
    values (biz, 'Pulido', 'Quita rayones finos y opacidad.', 'extra', 5)
    returning id into s_polish;

  insert into public.service_prices (business_id, service_id, vehicle_type_id, price_cents) values
    (biz, s_exterior, v_auto, 15000), (biz, s_exterior, v_suv, 18000), (biz, s_exterior, v_pickup, 22000),
    (biz, s_package, v_auto, 35000), (biz, s_package, v_suv, 42000), (biz, s_package, v_pickup, 50000),
    (biz, s_vacuum, v_auto, 8000), (biz, s_vacuum, v_suv, 10000), (biz, s_vacuum, v_pickup, 12000),
    (biz, s_wax, v_auto, 12000), (biz, s_wax, v_suv, 15000), (biz, s_wax, v_pickup, 18000),
    (biz, s_polish, v_auto, 40000), (biz, s_polish, v_suv, 50000), (biz, s_polish, v_pickup, 60000);

  -- TODO: zonas y recargos reales
  insert into public.zones (business_id, name, surcharge_cents, sort_order) values
    (biz, 'Zapopan', 0, 1),
    (biz, 'Guadalajara', 0, 2),
    (biz, 'Tlaquepaque', 5000, 3),
    (biz, 'Tlajomulco', 8000, 4);

  -- TODO: franjas y cupos reales
  insert into public.time_slots (business_id, name, start_time, end_time, capacity, sort_order) values
    (biz, 'Mañana', '09:00', '13:00', 2, 1),
    (biz, 'Tarde', '14:00', '18:00', 2, 2);
end;
$$;
