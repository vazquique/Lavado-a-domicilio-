-- A main service can include every extra (e.g. Full detailing). When the customer
-- picks it, the booking page hides the extras and the price never adds them.
alter table public.services
  add column includes_extras boolean not null default false;

alter table public.services
  add constraint services_includes_extras_base_only check (kind = 'base' or not includes_extras);

-- JB's Bros: Full detailing includes everything (the owner confirmed on 2026-10-12).
update public.services s
set includes_extras = true
from public.businesses b
where b.id = s.business_id and b.slug = 'jbsbros' and s.name = 'Full detailing';
