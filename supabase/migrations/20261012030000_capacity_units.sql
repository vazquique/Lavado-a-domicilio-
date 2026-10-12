-- Capacity in "places": each time slot has N places, each service uses some of them.
-- A booking uses the sum of its services' places (at least 1). Example: a normal wash
-- uses 1 of the 3 places in a slot; Full detailing uses all 3.

alter table public.services
  add column capacity_units smallint not null default 1 check (capacity_units between 0 and 20);

-- Extras don't take extra places unless the owner says so.
update public.services set capacity_units = 0 where kind = 'extra';

-- JB's Bros: Full detailing takes the whole slot (the owner agreed on 2026-10-12).
update public.services s
set capacity_units = 3
from public.businesses b
where b.id = s.business_id and b.slug = 'jbsbros' and s.name = 'Full detailing';

alter table public.bookings
  add column capacity_units smallint not null default 1 check (capacity_units between 1 and 100);

-- Places already taken per date and slot, for the public booking page. Only counts,
-- never booking details. Pending payments count while their hold hasn't expired.
create function public.slot_usage(p_business_id uuid, p_from date, p_to date)
returns table (service_date date, time_slot_id uuid, used_units integer)
language sql
stable
security definer
set search_path = ''
as $$
  select b.service_date, b.time_slot_id, sum(b.capacity_units)::integer
  from public.bookings b
  where b.business_id = p_business_id
    and b.service_date between p_from and p_to
    and p_to - p_from <= 400
    and exists (select 1 from public.businesses x where x.id = p_business_id and x.active)
    and (
      b.status in ('confirmed', 'completed', 'no_show')
      or (b.status = 'pending_payment' and b.hold_expires_at > now())
    )
  group by b.service_date, b.time_slot_id;
$$;

revoke all on function public.slot_usage(uuid, date, date) from public;
grant execute on function public.slot_usage(uuid, date, date) to anon, authenticated, service_role;
