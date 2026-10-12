-- First business: JB's Bros (zona norte de Zapopan, Jalisco).
-- Data from the owner (2026-10-12). Items marked TODO are still pending;
-- once the panel exists, the owner edits everything from there.

do $$
declare
  biz uuid;
  v_car uuid;
  v_mid uuid;
  v_large uuid;
  s_wash uuid;
begin
  insert into public.businesses (
    slug, name, whatsapp_phone, folio_prefix, deposit_type, deposit_value,
    working_days, booking_lead_minutes, booking_horizon_days,
    cancellation_policy, privacy_notice
  ) values (
    'jbsbros',
    'JB''s Bros',
    '3314596017',
    'JBS',
    'percent', 50,
    '{1,2,3,4,5,6,7}', -- lunes a domingo
    120, -- mismo día con 2 horas de anticipación
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

  insert into public.vehicle_types (business_id, name, sort_order)
    values (biz, 'Carro normal', 1) returning id into v_car;
  insert into public.vehicle_types (business_id, name, sort_order)
    values (biz, 'Camioneta mediana', 2) returning id into v_mid;
  insert into public.vehicle_types (business_id, name, sort_order)
    values (biz, 'Camioneta grande', 3) returning id into v_large;

  insert into public.services (business_id, name, kind, sort_order)
    values (biz, 'Lavado normal', 'base', 1)
    returning id into s_wash;

  insert into public.service_prices (business_id, service_id, vehicle_type_id, price_cents) values
    (biz, s_wash, v_car, 23000),
    (biz, s_wash, v_mid, 27000),
    (biz, s_wash, v_large, 30000);

  -- TODO: precios de los extras. Un extra se ofrece en el cotizador hasta que tenga precio.
  insert into public.services (business_id, name, kind, sort_order) values
    (biz, 'Descontaminado químico y mecánico de pintura', 'extra', 10),
    (biz, 'Descontaminado y quita gotas para vidrios', 'extra', 11),
    (biz, 'Restauración de plásticos exteriores', 'extra', 12),
    (biz, 'Detallado de rines y llantas', 'extra', 13),
    (biz, 'Protección cerámica rápida con SiO2', 'extra', 14),
    (biz, 'Tratamiento cerámico', 'extra', 15),
    (biz, 'Restauración de faros', 'extra', 16),
    (biz, 'Tallado de asientos y suelos', 'extra', 17),
    (biz, 'Restauración e hidratación de plásticos interiores', 'extra', 18),
    (biz, 'Detallado general de interiores', 'extra', 19),
    (biz, 'Detallado general de exteriores', 'extra', 20),
    (biz, 'Full detailing', 'extra', 21), -- TODO: ¿paquete principal o extra?
    (biz, 'Hidratación de cueros', 'extra', 22);

  -- TODO: colonias exactas y recargos fuera de esta zona.
  insert into public.zones (business_id, name, surcharge_cents, sort_order) values
    (biz, 'Zapopan (zona norte)', 0, 1);

  -- Horario de 9 a 6. TODO: cupo real por franja.
  insert into public.time_slots (business_id, name, start_time, end_time, capacity, sort_order) values
    (biz, 'Mañana', '09:00', '13:00', 2, 1),
    (biz, 'Tarde', '13:00', '18:00', 2, 2);
end;
$$;
