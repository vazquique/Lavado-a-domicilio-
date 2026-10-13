-- Exact times (the owner, 2026-10-13: "poner hora exacta para que no esté tan amplio el mañana
-- y tarde"). A time slot's places are consecutive turns: "Mañana" from 9:00 to 13:00 with 3
-- places is 9:00, 10:20 and 11:40. A booking starts at one place and takes as many places
-- in a row as its services need (Full detailing: the whole morning). Customers pick the time;
-- the agenda shows it.

alter table public.bookings
  -- First place it takes in its time slot (0 = the slot's start). Null for bookings made
  -- before exact times that didn't fit in order; they still count as taken places.
  add column start_place smallint check (start_place >= 0),
  -- When we arrive, as it was when booked (editing the slot later doesn't move it).
  add column arrival_time time;

-- Start time of a place, rounded to 5 minutes (multiplying first keeps it exact, so it
-- rounds like the page: placeTime in src/lib/availability.ts).
create function private.place_time(p_start time, p_end time, p_capacity integer, p_place integer)
returns time
language sql
immutable
set search_path = ''
as $$
  select p_start + make_interval(
    mins => (round(extract(epoch from (p_end - p_start)) / 60 * p_place / (p_capacity * 5)) * 5)::integer
  );
$$;

-- Bookings made so far: places in the order they were booked.
with ordered as (
  select
    b.id,
    s.start_time,
    s.end_time,
    s.capacity,
    b.capacity_units,
    coalesce(
      sum(b.capacity_units) over (
        partition by b.business_id, b.service_date, b.time_slot_id
        order by b.created_at
        rows between unbounded preceding and 1 preceding
      ),
      0
    )::integer as start_place
  from public.bookings b
  join public.time_slots s on s.business_id = b.business_id and s.id = b.time_slot_id
  where b.status in ('confirmed', 'completed', 'no_show')
    or (b.status = 'pending_payment' and b.hold_expires_at > now())
)
update public.bookings b
set start_place = o.start_place,
    arrival_time = private.place_time(o.start_time, o.end_time, o.capacity, o.start_place)
from ordered o
where b.id = o.id and o.start_place + o.capacity_units <= o.capacity;

-- Whether places [p_start, p_start + p_units) of a slot are free on a day, leaving out one
-- booking (the one being moved). Same rule as the page (src/lib/availability.ts).
create function private.places_free(
  p_business_id uuid,
  p_date date,
  p_slot_id uuid,
  p_capacity integer,
  p_start integer,
  p_units integer,
  p_except uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_start >= 0
    and p_start + p_units <= p_capacity
    and private.used_units(p_business_id, p_date, p_slot_id, p_except) + p_units <= p_capacity
    and not exists (
      select 1
      from public.bookings b
      where b.business_id = p_business_id
        and b.service_date = p_date
        and b.time_slot_id = p_slot_id
        and b.id is distinct from p_except
        and b.start_place is not null
        and b.start_place < p_start + p_units
        and b.start_place + b.capacity_units > p_start
        and (
          b.status in ('confirmed', 'completed', 'no_show')
          or (b.status = 'pending_payment' and b.hold_expires_at > now())
        )
    );
$$;

-- The first place where p_units places in a row are free, or null.
create function private.first_free_place(
  p_business_id uuid,
  p_date date,
  p_slot_id uuid,
  p_capacity integer,
  p_units integer,
  p_except uuid
)
returns integer
language sql
stable
set search_path = ''
as $$
  select s
  from generate_series(0, p_capacity - p_units) as s
  where private.places_free(p_business_id, p_date, p_slot_id, p_capacity, s, p_units, p_except)
  order by s
  limit 1;
$$;

-- Places taken per date, slot and start, for the booking page. Only times and sizes, never
-- booking details.
create function public.slot_places(p_business_id uuid, p_from date, p_to date)
returns table (service_date date, time_slot_id uuid, start_place smallint, units integer)
language sql
stable
security definer
set search_path = ''
as $$
  select b.service_date, b.time_slot_id, b.start_place, b.capacity_units::integer
  from public.bookings b
  where b.business_id = p_business_id
    and b.service_date between p_from and p_to
    and p_to - p_from <= 400
    and exists (select 1 from public.businesses x where x.id = p_business_id and x.active)
    and (
      b.status in ('confirmed', 'completed', 'no_show')
      or (b.status = 'pending_payment' and b.hold_expires_at > now())
    );
$$;

-- The booking functions now take the chosen place ('start_place'). Without one (code from
-- before exact times) they take the first free place.

-- Now security definer, like the others (it uses the private helpers); still server code only.
create or replace function public.create_online_booking(p_booking jsonb)
returns table (booking_id uuid, booking_folio text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := (p_booking ->> 'business_id')::uuid;
  v_date date := (p_booking ->> 'service_date')::date;
  v_units integer := (p_booking ->> 'capacity_units')::integer;
  v_slot public.time_slots%rowtype;
  v_place integer;
begin
  -- One booking at a time per slot: this row stays locked until the transaction ends.
  select * into v_slot
  from public.time_slots s
  where s.business_id = v_business_id and s.id = (p_booking ->> 'time_slot_id')::uuid and s.active
  for update;
  if not found then
    return;
  end if;

  -- A customer who starts over releases their previous unpaid hold.
  update public.bookings b
  set status = 'expired'
  where b.business_id = v_business_id
    and b.status = 'pending_payment'
    and b.customer_phone = p_booking ->> 'customer_phone';

  v_place := coalesce(
    (p_booking ->> 'start_place')::integer,
    private.first_free_place(v_business_id, v_date, v_slot.id, v_slot.capacity, v_units, null)
  );
  if v_place is null
    or not private.places_free(v_business_id, v_date, v_slot.id, v_slot.capacity, v_place, v_units, null)
  then
    return;
  end if;

  return query
  insert into public.bookings as b (
    business_id, status, source, service_date, time_slot_id, vehicle_type_id, zone_id,
    customer_name, customer_phone, customer_email, address, address_references,
    vehicle_type_name, zone_name, time_slot_name, items,
    subtotal_cents, surcharge_cents, total_cents, deposit_cents, capacity_units,
    terms_accepted_at, hold_expires_at, start_place, arrival_time
  ) values (
    v_business_id, 'pending_payment', 'online', v_date, v_slot.id,
    (p_booking ->> 'vehicle_type_id')::uuid, (p_booking ->> 'zone_id')::uuid,
    p_booking ->> 'customer_name', p_booking ->> 'customer_phone', p_booking ->> 'customer_email',
    p_booking ->> 'address', coalesce(p_booking ->> 'address_references', ''),
    p_booking ->> 'vehicle_type_name', p_booking ->> 'zone_name', v_slot.name,
    p_booking -> 'items',
    (p_booking ->> 'subtotal_cents')::integer, (p_booking ->> 'surcharge_cents')::integer,
    (p_booking ->> 'total_cents')::integer, (p_booking ->> 'deposit_cents')::integer, v_units,
    now(), now() + interval '30 minutes',
    v_place, private.place_time(v_slot.start_time, v_slot.end_time, v_slot.capacity, v_place)
  )
  returning b.id, b.folio;
end;
$$;

create or replace function public.create_cash_booking(p_booking jsonb)
returns table (booking_id uuid, booking_folio text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := (p_booking ->> 'business_id')::uuid;
  v_date date := (p_booking ->> 'service_date')::date;
  v_units integer := (p_booking ->> 'capacity_units')::integer;
  v_slot public.time_slots%rowtype;
  v_place integer;
begin
  select * into v_slot
  from public.time_slots s
  where s.business_id = v_business_id and s.id = (p_booking ->> 'time_slot_id')::uuid and s.active
  for update;
  if not found then
    return;
  end if;

  -- A customer who started paying online and switched to cash gives that hold back.
  update public.bookings b
  set status = 'expired'
  where b.business_id = v_business_id
    and b.status = 'pending_payment'
    and b.customer_phone = p_booking ->> 'customer_phone';

  v_place := coalesce(
    (p_booking ->> 'start_place')::integer,
    private.first_free_place(v_business_id, v_date, v_slot.id, v_slot.capacity, v_units, null)
  );
  if v_place is null
    or not private.places_free(v_business_id, v_date, v_slot.id, v_slot.capacity, v_place, v_units, null)
  then
    return;
  end if;

  return query
  insert into public.bookings as b (
    business_id, status, source, service_date, time_slot_id, vehicle_type_id, zone_id,
    customer_name, customer_phone, customer_email, address, address_references,
    vehicle_type_name, zone_name, time_slot_name, items,
    subtotal_cents, surcharge_cents, total_cents, deposit_cents, capacity_units, terms_accepted_at,
    start_place, arrival_time
  ) values (
    v_business_id, 'confirmed', 'online', v_date, v_slot.id,
    (p_booking ->> 'vehicle_type_id')::uuid, (p_booking ->> 'zone_id')::uuid,
    p_booking ->> 'customer_name', p_booking ->> 'customer_phone', p_booking ->> 'customer_email',
    p_booking ->> 'address', coalesce(p_booking ->> 'address_references', ''),
    p_booking ->> 'vehicle_type_name', p_booking ->> 'zone_name', v_slot.name,
    p_booking -> 'items',
    (p_booking ->> 'subtotal_cents')::integer, (p_booking ->> 'surcharge_cents')::integer,
    (p_booking ->> 'total_cents')::integer, 0, v_units, now(),
    v_place, private.place_time(v_slot.start_time, v_slot.end_time, v_slot.capacity, v_place)
  )
  returning b.id, b.folio;
end;
$$;

create or replace function public.create_manual_booking(p_booking jsonb)
returns table (booking_id uuid, booking_folio text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := (p_booking ->> 'business_id')::uuid;
  v_date date := (p_booking ->> 'service_date')::date;
  v_units integer := (p_booking ->> 'capacity_units')::integer;
  v_slot public.time_slots%rowtype;
  v_place integer;
begin
  if not private.is_business_member(v_business_id) then
    raise exception 'not a member of this business' using errcode = '42501';
  end if;

  select * into v_slot
  from public.time_slots s
  where s.business_id = v_business_id and s.id = (p_booking ->> 'time_slot_id')::uuid and s.active
  for update;
  if not found then
    return;
  end if;

  v_place := coalesce(
    (p_booking ->> 'start_place')::integer,
    private.first_free_place(v_business_id, v_date, v_slot.id, v_slot.capacity, v_units, null)
  );
  if v_place is null
    or not private.places_free(v_business_id, v_date, v_slot.id, v_slot.capacity, v_place, v_units, null)
  then
    return;
  end if;

  return query
  insert into public.bookings as b (
    business_id, status, source, service_date, time_slot_id, vehicle_type_id, zone_id,
    customer_name, customer_phone, customer_email, address, address_references,
    vehicle_type_name, zone_name, time_slot_name, items,
    subtotal_cents, surcharge_cents, total_cents, deposit_cents, capacity_units, notes,
    start_place, arrival_time
  ) values (
    v_business_id, 'confirmed', 'manual', v_date, v_slot.id,
    (p_booking ->> 'vehicle_type_id')::uuid, (p_booking ->> 'zone_id')::uuid,
    p_booking ->> 'customer_name', p_booking ->> 'customer_phone', p_booking ->> 'customer_email',
    p_booking ->> 'address', coalesce(p_booking ->> 'address_references', ''),
    p_booking ->> 'vehicle_type_name', p_booking ->> 'zone_name', v_slot.name,
    p_booking -> 'items',
    (p_booking ->> 'subtotal_cents')::integer, (p_booking ->> 'surcharge_cents')::integer,
    (p_booking ->> 'total_cents')::integer, 0, v_units, coalesce(p_booking ->> 'notes', ''),
    v_place, private.place_time(v_slot.start_time, v_slot.end_time, v_slot.capacity, v_place)
  )
  returning b.id, b.folio;
end;
$$;

-- Moving now says the exact place too; without one it takes the first free place there.
drop function public.reschedule_booking(uuid, date, uuid);

create function public.reschedule_booking(
  p_booking_id uuid,
  p_date date,
  p_slot_id uuid,
  p_start_place integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_booking public.bookings%rowtype;
  v_slot public.time_slots%rowtype;
  v_place integer;
begin
  select b.business_id into v_business_id from public.bookings b where b.id = p_booking_id;
  if not found then
    return 'not_movable';
  end if;
  if not private.is_business_member(v_business_id) then
    raise exception 'not a member of this business' using errcode = '42501';
  end if;

  -- Same lock order as new bookings: the slot first, then the booking.
  select * into v_slot
  from public.time_slots s
  where s.business_id = v_business_id and s.id = p_slot_id and s.active
  for update;
  if not found then
    return 'no_slot';
  end if;

  select * into v_booking from public.bookings b where b.id = p_booking_id for update;
  if v_booking.status <> 'confirmed' then
    return 'not_movable';
  end if;

  v_place := coalesce(
    p_start_place,
    private.first_free_place(v_business_id, p_date, v_slot.id, v_slot.capacity, v_booking.capacity_units, v_booking.id)
  );
  if v_place is null
    or not private.places_free(
      v_business_id, p_date, v_slot.id, v_slot.capacity, v_place, v_booking.capacity_units, v_booking.id
    )
  then
    return 'full';
  end if;

  update public.bookings
  set service_date = p_date,
      time_slot_id = v_slot.id,
      time_slot_name = v_slot.name,
      start_place = v_place,
      arrival_time = private.place_time(v_slot.start_time, v_slot.end_time, v_slot.capacity, v_place)
  where id = v_booking.id;
  return 'moved';
end;
$$;

revoke all on function private.place_time(time, time, integer, integer) from public, anon, authenticated;
revoke all on function private.places_free(uuid, date, uuid, integer, integer, integer, uuid) from public, anon, authenticated;
revoke all on function private.first_free_place(uuid, date, uuid, integer, integer, uuid) from public, anon, authenticated;
revoke all on function public.slot_places(uuid, date, date) from public;
revoke all on function public.reschedule_booking(uuid, date, uuid, integer) from public, anon, authenticated;
grant execute on function public.slot_places(uuid, date, date) to anon, authenticated, service_role;
grant execute on function public.reschedule_booking(uuid, date, uuid, integer) to authenticated, service_role;
