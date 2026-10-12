-- Core multi-business schema for Part 1 (quote + booking with deposit).
--
-- Security model:
--   * RLS is enabled on every table.
--   * Grants are explicit (we never rely on Supabase's default privileges).
--   * anon (public booking page) can only read the catalog of active businesses.
--   * authenticated users can manage only the businesses they are members of.
--   * service_role (server code with the secret key) bypasses RLS; it is used
--     for online bookings, payment webhooks and superadmin tasks.
--
-- Conventions: money in integer cents (MXN), weekdays in ISO format
-- (1 = Monday ... 7 = Sunday), dates/times in America/Mexico_City.

-- Helpers live in a schema that is not exposed through the Data API.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

---------------------------------------------------------------------------
-- Businesses and members
---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  name text not null check (char_length(name) between 1 and 80),
  -- 10-digit Mexican number; links use 52 + number.
  whatsapp_phone text check (whatsapp_phone ~ '^[0-9]{10}$'),
  logo_path text,
  brand_color text not null default '#1d4ed8' check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  folio_prefix text not null check (folio_prefix ~ '^[A-Z]{2,5}$'),
  folio_counter integer not null default 1000 check (folio_counter >= 0),
  -- percent: deposit_value is 0-100. fixed: deposit_value is cents.
  deposit_type text not null default 'percent' check (deposit_type in ('percent', 'fixed')),
  deposit_value integer not null default 30 check (deposit_value >= 0),
  working_days smallint[] not null default '{1,2,3,4,5,6}'
    check (working_days <@ '{1,2,3,4,5,6,7}'::smallint[]),
  -- Minimum time between booking and slot start, and how far ahead customers can book.
  booking_lead_minutes integer not null default 120 check (booking_lead_minutes between 0 and 10080),
  booking_horizon_days integer not null default 30 check (booking_horizon_days between 1 and 365),
  cancellation_policy text not null default '',
  privacy_notice text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint businesses_deposit_percent_range
    check (deposit_type <> 'percent' or deposit_value <= 100)
);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index business_members_user_id_idx on public.business_members (user_id);

create function private.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = target_business_id
      and m.user_id = auth.uid()
  );
$$;

create function private.is_public_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = target_business_id
      and b.active
  );
$$;

revoke all on function private.is_business_member(uuid) from public;
revoke all on function private.is_public_business(uuid) from public;
grant execute on function private.is_business_member(uuid) to anon, authenticated, service_role;
grant execute on function private.is_public_business(uuid) to anon, authenticated, service_role;

---------------------------------------------------------------------------
-- Catalog: vehicle types, services, prices, zones, time slots, blocked dates
---------------------------------------------------------------------------

create table public.vehicle_types (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  -- base: main service or package (customer picks exactly one).
  -- extra: add-on to a base service (customer picks zero or more).
  kind text not null check (kind in ('base', 'extra')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

-- A service is offered for a vehicle type only if it has a price row for it.
create table public.service_prices (
  business_id uuid not null,
  service_id uuid not null,
  vehicle_type_id uuid not null,
  price_cents integer not null check (price_cents >= 0),
  primary key (service_id, vehicle_type_id),
  foreign key (business_id, service_id)
    references public.services (business_id, id) on delete cascade,
  foreign key (business_id, vehicle_type_id)
    references public.vehicle_types (business_id, id) on delete cascade
);

create index service_prices_business_id_idx on public.service_prices (business_id);
create index service_prices_vehicle_type_id_idx on public.service_prices (vehicle_type_id);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  surcharge_cents integer not null default 0 check (surcharge_cents >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

create table public.time_slots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  start_time time not null,
  end_time time not null,
  capacity integer not null check (capacity between 1 and 100),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  unique (business_id, id)
);

create table public.blocked_dates (
  business_id uuid not null references public.businesses (id) on delete cascade,
  date date not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  primary key (business_id, date)
);

create index vehicle_types_business_id_idx on public.vehicle_types (business_id);
create index services_business_id_idx on public.services (business_id);
create index zones_business_id_idx on public.zones (business_id);
create index time_slots_business_id_idx on public.time_slots (business_id);

---------------------------------------------------------------------------
-- Bookings
---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  -- Assigned by trigger, e.g. JBS-1042.
  folio text not null,
  status text not null check (
    status in ('pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show', 'expired')
  ),
  source text not null check (source in ('online', 'manual')),
  service_date date not null,
  time_slot_id uuid not null,
  vehicle_type_id uuid,
  zone_id uuid,
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  customer_phone text not null check (customer_phone ~ '^[0-9]{10}$'),
  customer_email text check (customer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  address text not null check (char_length(address) between 1 and 300),
  address_references text not null default '',
  -- Snapshot of what was quoted, so later catalog edits don't change past bookings.
  vehicle_type_name text not null,
  zone_name text,
  time_slot_name text not null,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  surcharge_cents integer not null default 0 check (surcharge_cents >= 0),
  total_cents integer not null,
  deposit_cents integer not null,
  balance_cents integer generated always as (total_cents - deposit_cents) stored,
  terms_accepted_at timestamptz,
  -- While pending_payment, the slot is held until this moment.
  hold_expires_at timestamptz,
  deposit_paid_at timestamptz,
  balance_paid_at timestamptz,
  -- Refunds are done by hand in Mercado Pago; we only record the state.
  refund_status text not null default 'none' check (refund_status in ('none', 'pending', 'refunded')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, folio),
  constraint bookings_total_matches check (total_cents = subtotal_cents + surcharge_cents),
  constraint bookings_deposit_range check (deposit_cents between 0 and total_cents),
  constraint bookings_hold_when_pending
    check (status <> 'pending_payment' or hold_expires_at is not null),
  foreign key (business_id, time_slot_id)
    references public.time_slots (business_id, id) on delete restrict,
  foreign key (business_id, vehicle_type_id)
    references public.vehicle_types (business_id, id) on delete restrict,
  foreign key (business_id, zone_id)
    references public.zones (business_id, id) on delete restrict
);

create index bookings_slot_usage_idx on public.bookings (business_id, service_date, time_slot_id);
create index bookings_business_status_date_idx on public.bookings (business_id, status, service_date);
create index bookings_pending_hold_idx on public.bookings (hold_expires_at)
  where status = 'pending_payment';

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function private.set_updated_at();

-- Short, human-friendly folio per business (PREFIX-NUMBER), always assigned by the database.
create function private.assign_booking_folio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.businesses
  set folio_counter = folio_counter + 1
  where id = new.business_id
  returning folio_prefix || '-' || folio_counter into new.folio;
  return new;
end;
$$;

revoke all on function private.assign_booking_folio() from public;

create trigger bookings_assign_folio
  before insert on public.bookings
  for each row execute function private.assign_booking_folio();

---------------------------------------------------------------------------
-- Grants (explicit) and RLS
---------------------------------------------------------------------------

revoke all on table
  public.businesses, public.business_members, public.vehicle_types, public.services,
  public.service_prices, public.zones, public.time_slots, public.blocked_dates, public.bookings
from anon, authenticated;

grant all on table
  public.businesses, public.business_members, public.vehicle_types, public.services,
  public.service_prices, public.zones, public.time_slots, public.blocked_dates, public.bookings
to service_role;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.vehicle_types enable row level security;
alter table public.services enable row level security;
alter table public.service_prices enable row level security;
alter table public.zones enable row level security;
alter table public.time_slots enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.bookings enable row level security;

-- businesses: public can read active ones; members can edit their settings.
-- Members cannot change slug, folio, or active (only the superadmin, via service_role).
grant select on table public.businesses to anon, authenticated;
grant update (
  name, whatsapp_phone, logo_path, brand_color, deposit_type, deposit_value, working_days,
  booking_lead_minutes, booking_horizon_days, cancellation_policy, privacy_notice
) on table public.businesses to authenticated;

create policy "Active businesses are public"
  on public.businesses for select
  to anon, authenticated
  using (active or private.is_business_member(id));

create policy "Members update their business"
  on public.businesses for update
  to authenticated
  using (private.is_business_member(id))
  with check (private.is_business_member(id));

-- business_members: users see their own memberships. Writes only via service_role.
grant select on table public.business_members to authenticated;

create policy "Users see their own memberships"
  on public.business_members for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Catalog tables: public read for active businesses, full management for members.
grant select on table
  public.vehicle_types, public.services, public.service_prices, public.zones,
  public.time_slots, public.blocked_dates
to anon, authenticated;

grant insert, update, delete on table
  public.vehicle_types, public.services, public.service_prices, public.zones,
  public.time_slots, public.blocked_dates
to authenticated;

create policy "Public reads active vehicle types" on public.vehicle_types for select
  to anon, authenticated
  using ((active and private.is_public_business(business_id)) or private.is_business_member(business_id));
create policy "Members insert vehicle types" on public.vehicle_types for insert
  to authenticated with check (private.is_business_member(business_id));
create policy "Members update vehicle types" on public.vehicle_types for update
  to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members delete vehicle types" on public.vehicle_types for delete
  to authenticated using (private.is_business_member(business_id));

create policy "Public reads active services" on public.services for select
  to anon, authenticated
  using ((active and private.is_public_business(business_id)) or private.is_business_member(business_id));
create policy "Members insert services" on public.services for insert
  to authenticated with check (private.is_business_member(business_id));
create policy "Members update services" on public.services for update
  to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members delete services" on public.services for delete
  to authenticated using (private.is_business_member(business_id));

create policy "Public reads prices" on public.service_prices for select
  to anon, authenticated
  using (private.is_public_business(business_id) or private.is_business_member(business_id));
create policy "Members insert prices" on public.service_prices for insert
  to authenticated with check (private.is_business_member(business_id));
create policy "Members update prices" on public.service_prices for update
  to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members delete prices" on public.service_prices for delete
  to authenticated using (private.is_business_member(business_id));

create policy "Public reads active zones" on public.zones for select
  to anon, authenticated
  using ((active and private.is_public_business(business_id)) or private.is_business_member(business_id));
create policy "Members insert zones" on public.zones for insert
  to authenticated with check (private.is_business_member(business_id));
create policy "Members update zones" on public.zones for update
  to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members delete zones" on public.zones for delete
  to authenticated using (private.is_business_member(business_id));

create policy "Public reads active time slots" on public.time_slots for select
  to anon, authenticated
  using ((active and private.is_public_business(business_id)) or private.is_business_member(business_id));
create policy "Members insert time slots" on public.time_slots for insert
  to authenticated with check (private.is_business_member(business_id));
create policy "Members update time slots" on public.time_slots for update
  to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members delete time slots" on public.time_slots for delete
  to authenticated using (private.is_business_member(business_id));

create policy "Public reads blocked dates" on public.blocked_dates for select
  to anon, authenticated
  using (private.is_public_business(business_id) or private.is_business_member(business_id));
create policy "Members insert blocked dates" on public.blocked_dates for insert
  to authenticated with check (private.is_business_member(business_id));
create policy "Members update blocked dates" on public.blocked_dates for update
  to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members delete blocked dates" on public.blocked_dates for delete
  to authenticated using (private.is_business_member(business_id));

-- bookings: never public (personal data). Members read, create manual bookings and
-- update status/payment fields. Online bookings are created by server code (service_role).
grant select, insert on table public.bookings to authenticated;
grant update (status, balance_paid_at, refund_status, notes) on table public.bookings to authenticated;

create policy "Members read bookings" on public.bookings for select
  to authenticated using (private.is_business_member(business_id));
create policy "Members create bookings" on public.bookings for insert
  to authenticated with check (private.is_business_member(business_id));
create policy "Members update bookings" on public.bookings for update
  to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
