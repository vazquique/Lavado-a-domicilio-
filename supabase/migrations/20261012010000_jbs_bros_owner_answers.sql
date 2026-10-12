-- JB's Bros: owner's answers (2026-10-12).
-- * Full detailing includes every service and is chosen instead of "Lavado normal",
--   so it is a main (base) service.
-- * 3 normal washes fit in each time slot.
-- * Coverage: these colonias in the north of Zapopan, no surcharge.

do $$
declare
  biz uuid := (select id from public.businesses where slug = 'jbsbros');
begin
  update public.services
  set kind = 'base', sort_order = 2
  where business_id = biz and name = 'Full detailing';

  update public.time_slots
  set capacity = 3
  where business_id = biz;

  delete from public.zones
  where business_id = biz and name = 'Zapopan (zona norte)';

  insert into public.zones (business_id, name, surcharge_cents, sort_order) values
    (biz, 'Capital Norte', 0, 1),
    (biz, 'Valle Imperial', 0, 2),
    (biz, 'Real de Valdepeñas', 0, 3),
    (biz, 'La Cima', 0, 4),
    (biz, 'Boreales', 0, 5);
end;
$$;
