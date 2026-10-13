-- Customers saved once and regular customers ("clientes de planta"), asked by the owner on
-- 2026-10-13: "con solo una vez ya se pueda reagendar un servicio y ponerle mantenimientos".
-- * Every booking is linked to its customer by phone, so the panel shows their history and
--   books them again without typing everything.
-- * A regular customer gets a plan: every 1, 2 or 4 weeks, same weekday and time slot. Their
--   bookings are created ahead automatically and take their places like any other.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  phone text not null check (phone ~ '^[0-9]{10}$'),
  name text not null check (char_length(name) between 1 and 100),
  email text check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  address text not null default '' check (char_length(address) <= 300),
  address_references text not null default '' check (char_length(address_references) <= 300),
  zone_id uuid,
  vehicle_type_id uuid,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, phone),
  unique (business_id, id),
  foreign key (business_id, zone_id) references public.zones (business_id, id) on delete set null (zone_id),
  foreign key (business_id, vehicle_type_id)
    references public.vehicle_types (business_id, id) on delete set null (vehicle_type_id)
);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function private.set_updated_at();

-- Regular customers: what, where and when, priced when the owner saved the plan (saving it
-- again takes the current prices).
create table public.recurring_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null,
  every_weeks smallint not null check (every_weeks in (1, 2, 4)),
  -- First date; it also sets the weekday.
  starts_on date not null,
  time_slot_id uuid not null,
  -- The exact time: which place of the slot (see exact_times).
  start_place smallint not null default 0 check (start_place >= 0),
  vehicle_type_id uuid,
  zone_id uuid,
  vehicle_type_name text not null,
  zone_name text,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  surcharge_cents integer not null default 0 check (surcharge_cents >= 0),
  total_cents integer not null,
  capacity_units smallint not null check (capacity_units between 1 and 100),
  address text not null check (char_length(address) between 1 and 300),
  address_references text not null default '' check (char_length(address_references) <= 300),
  notes text not null default '' check (char_length(notes) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  constraint recurring_plans_total_matches check (total_cents = subtotal_cents + surcharge_cents),
  foreign key (business_id, customer_id) references public.customers (business_id, id) on delete cascade,
  foreign key (business_id, time_slot_id) references public.time_slots (business_id, id) on delete restrict,
  foreign key (business_id, vehicle_type_id) references public.vehicle_types (business_id, id) on delete restrict,
  foreign key (business_id, zone_id) references public.zones (business_id, id) on delete restrict
);

create index recurring_plans_business_idx on public.recurring_plans (business_id) where active;

create trigger recurring_plans_set_updated_at
  before update on public.recurring_plans
  for each row execute function private.set_updated_at();

alter table public.bookings
  add column customer_id uuid,
  add column recurring_plan_id uuid,
  -- The plan date this booking came from. It stays even if the booking is moved, so the
  -- same date is never created twice.
  add column recurring_date date,
  add foreign key (business_id, customer_id)
    references public.customers (business_id, id) on delete set null (customer_id),
  add foreign key (business_id, recurring_plan_id)
    references public.recurring_plans (business_id, id) on delete set null (recurring_plan_id);

alter table public.bookings drop constraint bookings_source_check;
alter table public.bookings add constraint bookings_source_check check (source in ('online', 'manual', 'recurring'));

create index bookings_customer_idx on public.bookings (business_id, customer_id);
create unique index bookings_recurring_occurrence_idx
  on public.bookings (recurring_plan_id, recurring_date) where recurring_plan_id is not null;

-- Links each new booking to its customer (by phone), creating the customer the first time.
-- What a customer types on the public page never overwrites what the owner saved (anyone can
-- type someone else's phone); it only fills what's missing. The owner's bookings update it.
create function private.link_booking_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_online boolean := new.source = 'online';
begin
  insert into public.customers as c (
    business_id, phone, name, email, address, address_references, zone_id, vehicle_type_id
  ) values (
    new.business_id, new.customer_phone, new.customer_name, new.customer_email, new.address,
    new.address_references, new.zone_id, new.vehicle_type_id
  )
  on conflict (business_id, phone) do update set
    name = case when v_online then c.name else excluded.name end,
    email = case when v_online then coalesce(c.email, excluded.email) else coalesce(excluded.email, c.email) end,
    address = case when v_online and c.address <> '' then c.address else excluded.address end,
    address_references = case
      when v_online and c.address <> '' then c.address_references
      else excluded.address_references
    end,
    zone_id = case when v_online then coalesce(c.zone_id, excluded.zone_id) else coalesce(excluded.zone_id, c.zone_id) end,
    vehicle_type_id = case
      when v_online then coalesce(c.vehicle_type_id, excluded.vehicle_type_id)
      else coalesce(excluded.vehicle_type_id, c.vehicle_type_id)
    end
  returning c.id into new.customer_id;
  return new;
end;
$$;

revoke all on function private.link_booking_customer() from public, anon, authenticated;

create trigger bookings_link_customer
  before insert on public.bookings
  for each row execute function private.link_booking_customer();

-- Customers from the bookings made so far: the latest data of each phone.
insert into public.customers (
  business_id, phone, name, email, address, address_references, zone_id, vehicle_type_id, created_at
)
select distinct on (b.business_id, b.customer_phone)
  b.business_id, b.customer_phone, b.customer_name, b.customer_email, b.address, b.address_references,
  b.zone_id, b.vehicle_type_id,
  min(b.created_at) over (partition by b.business_id, b.customer_phone)
from public.bookings b
order by b.business_id, b.customer_phone, b.created_at desc
on conflict (business_id, phone) do nothing;

update public.bookings b
set customer_id = c.id
from public.customers c
where c.business_id = b.business_id and c.phone = b.customer_phone and b.customer_id is null;

-- Creates the bookings of active regular-customer plans from today until p_until that don't
-- exist yet. Blocked days and full slots are skipped (tried again on the next call). Safe to
-- call often: each plan date is created once, even if that booking was later moved or
-- cancelled. Server code only, after checking who asks. Returns how many it created.
create function public.extend_recurring_bookings(p_business_id uuid, p_until date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Mexico_City')::date;
  v_until date := least(p_until, (now() at time zone 'America/Mexico_City')::date + 400);
  v_plan public.recurring_plans%rowtype;
  v_customer public.customers%rowtype;
  v_slot public.time_slots%rowtype;
  v_date date;
  v_step integer;
  v_inserted integer;
  v_created integer := 0;
begin
  for v_plan in
    select * from public.recurring_plans p where p.business_id = p_business_id and p.active order by p.created_at
  loop
    select * into v_customer from public.customers c where c.business_id = p_business_id and c.id = v_plan.customer_id;
    v_step := 7 * v_plan.every_weeks;
    -- The first plan date from today on.
    v_date := v_plan.starts_on;
    if v_date < v_today then
      v_date := v_date + ((v_today - v_date + v_step - 1) / v_step) * v_step;
    end if;

    while v_date <= v_until loop
      if not exists (
          select 1 from public.bookings b where b.recurring_plan_id = v_plan.id and b.recurring_date = v_date
        )
        and not exists (
          select 1 from public.blocked_dates d where d.business_id = p_business_id and d.date = v_date
        )
      then
        -- Same lock as every other booking, so nobody takes the last place at the same time.
        select * into v_slot
        from public.time_slots s
        where s.business_id = p_business_id and s.id = v_plan.time_slot_id and s.active
        for update;
        if found and private.places_free(
          p_business_id, v_date, v_slot.id, v_slot.capacity, v_plan.start_place, v_plan.capacity_units, null
        ) then
          insert into public.bookings (
            business_id, status, source, service_date, time_slot_id, vehicle_type_id, zone_id,
            customer_name, customer_phone, customer_email, address, address_references,
            vehicle_type_name, zone_name, time_slot_name, items,
            subtotal_cents, surcharge_cents, total_cents, deposit_cents, capacity_units, notes,
            recurring_plan_id, recurring_date, start_place, arrival_time
          ) values (
            p_business_id, 'confirmed', 'recurring', v_date, v_slot.id, v_plan.vehicle_type_id, v_plan.zone_id,
            v_customer.name, v_customer.phone, v_customer.email, v_plan.address, v_plan.address_references,
            v_plan.vehicle_type_name, v_plan.zone_name, v_slot.name, v_plan.items,
            v_plan.subtotal_cents, v_plan.surcharge_cents, v_plan.total_cents, 0, v_plan.capacity_units, v_plan.notes,
            v_plan.id, v_date, v_plan.start_place,
            private.place_time(v_slot.start_time, v_slot.end_time, v_slot.capacity, v_plan.start_place)
          )
          on conflict (recurring_plan_id, recurring_date) where recurring_plan_id is not null do nothing;
          get diagnostics v_inserted = row_count;
          v_created := v_created + v_inserted;
        end if;
      end if;
      v_date := v_date + v_step;
    end loop;
  end loop;
  return v_created;
end;
$$;

-- What the customers list shows: each customer with their services so far and next one.
create function public.customer_summaries(p_business_id uuid)
returns table (
  customer_id uuid,
  services integer,
  last_service date,
  next_service date,
  spent_cents bigint,
  regular boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    count(b.id) filter (where b.status in ('confirmed', 'completed', 'no_show'))::integer,
    max(b.service_date) filter (where b.status = 'completed'),
    min(b.service_date) filter (
      where b.status = 'confirmed' and b.service_date >= (now() at time zone 'America/Mexico_City')::date
    ),
    coalesce(sum(b.total_cents) filter (where b.status = 'completed'), 0),
    exists (select 1 from public.recurring_plans p where p.customer_id = c.id and p.active)
  from public.customers c
  left join public.bookings b on b.business_id = c.business_id and b.customer_id = c.id
  where c.business_id = p_business_id and private.is_business_member(p_business_id)
  group by c.id;
$$;

-- Grants and RLS: customers and plans belong to the business; nothing is public.
alter table public.customers enable row level security;
alter table public.recurring_plans enable row level security;
revoke all on table public.customers, public.recurring_plans from anon, authenticated;
grant all on table public.customers, public.recurring_plans to service_role;

grant select on table public.customers to authenticated;
grant update (name, phone, email, address, address_references, zone_id, vehicle_type_id, notes)
  on table public.customers to authenticated;
create policy "Members read customers" on public.customers for select
  to authenticated using (private.is_business_member(business_id));
create policy "Members update customers" on public.customers for update
  to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));

grant select, insert, delete on table public.recurring_plans to authenticated;
grant update (
  every_weeks, starts_on, time_slot_id, start_place, vehicle_type_id, zone_id, vehicle_type_name, zone_name, items,
  subtotal_cents, surcharge_cents, total_cents, capacity_units, address, address_references, notes, active
) on table public.recurring_plans to authenticated;
create policy "Members read plans" on public.recurring_plans for select
  to authenticated using (private.is_business_member(business_id));
create policy "Members create plans" on public.recurring_plans for insert
  to authenticated with check (private.is_business_member(business_id));
create policy "Members update plans" on public.recurring_plans for update
  to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members delete plans" on public.recurring_plans for delete
  to authenticated using (private.is_business_member(business_id));

revoke all on function public.extend_recurring_bookings(uuid, date) from public, anon, authenticated;
revoke all on function public.customer_summaries(uuid) from public, anon, authenticated;
grant execute on function public.extend_recurring_bookings(uuid, date) to service_role;
grant execute on function public.customer_summaries(uuid) to authenticated, service_role;
