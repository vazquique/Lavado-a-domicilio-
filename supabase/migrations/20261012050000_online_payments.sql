-- Online bookings paid with Mercado Pago: the deposit, or everything at once.
--
-- 1. Server code computes the price (never the browser) and calls create_online_booking(),
--    which holds the booking's places for 30 minutes. It locks the time slot first, so two
--    customers can't take the last place at the same moment.
-- 2. Mercado Pago's webhook, and the page the customer comes back to, call
--    record_mercadopago_payment(): it stores each payment once (later calls update it) and
--    confirms the booking when an approved payment covers what was due online.
-- 3. register_booking_attempt() limits how many payments one IP can start.
-- Only server code (service_role) can call these functions.

-- Payments must point at a booking of the same business.
alter table public.bookings add constraint bookings_business_id_id_key unique (business_id, id);

-- Mercado Pago's checkout link, so the customer can try again while the hold lasts.
alter table public.bookings add column checkout_url text
  check (checkout_url is null or checkout_url ~ '^https?://');

---------------------------------------------------------------------------
-- Payments reported by Mercado Pago
---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  booking_id uuid not null,
  provider text not null default 'mercadopago' check (provider in ('mercadopago')),
  provider_payment_id text not null check (provider_payment_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  -- As Mercado Pago reports it: approved, rejected, refunded, charged_back...
  status text not null check (char_length(status) between 1 and 40),
  status_detail text check (char_length(status_detail) <= 100),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id),
  foreign key (business_id, booking_id) references public.bookings (business_id, id) on delete restrict
);

create index payments_booking_id_idx on public.payments (booking_id);
create index payments_business_id_idx on public.payments (business_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function private.set_updated_at();

---------------------------------------------------------------------------
-- Attempts to start a payment, per IP (hashed), for the attempts limit
---------------------------------------------------------------------------

create table public.booking_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index booking_attempts_ip_hash_created_at_idx on public.booking_attempts (ip_hash, created_at);

---------------------------------------------------------------------------
-- Grants (explicit) and RLS
---------------------------------------------------------------------------

revoke all on table public.payments, public.booking_attempts from anon, authenticated;
grant all on table public.payments, public.booking_attempts to service_role;

alter table public.payments enable row level security;
alter table public.booking_attempts enable row level security;

-- Members see the payments of their business. Only server code writes them.
grant select on table public.payments to authenticated;
create policy "Members read payments" on public.payments for select
  to authenticated using (private.is_business_member(business_id));

-- booking_attempts: server code only (no policies for anon or authenticated).

---------------------------------------------------------------------------
-- Functions for server code
---------------------------------------------------------------------------

-- Creates an online booking that holds its places for 30 minutes while the customer pays.
-- Amounts come from server code; this function only makes sure the places are still free.
-- Returns no row when the slot is full or no longer offered.
create function public.create_online_booking(p_booking jsonb)
returns table (booking_id uuid, booking_folio text)
language plpgsql
set search_path = ''
as $$
declare
  v_business_id uuid := (p_booking ->> 'business_id')::uuid;
  v_date date := (p_booking ->> 'service_date')::date;
  v_slot_id uuid := (p_booking ->> 'time_slot_id')::uuid;
  v_units integer := (p_booking ->> 'capacity_units')::integer;
  v_capacity integer;
  v_used integer;
begin
  -- One booking at a time per slot: this row stays locked until the transaction ends.
  select s.capacity into v_capacity
  from public.time_slots s
  where s.business_id = v_business_id and s.id = v_slot_id and s.active
  for update;
  if v_capacity is null then
    return;
  end if;

  -- A customer who starts over releases their previous unpaid hold.
  update public.bookings b
  set status = 'expired'
  where b.business_id = v_business_id
    and b.status = 'pending_payment'
    and b.customer_phone = p_booking ->> 'customer_phone';

  select coalesce(sum(b.capacity_units), 0) into v_used
  from public.bookings b
  where b.business_id = v_business_id
    and b.service_date = v_date
    and b.time_slot_id = v_slot_id
    and (
      b.status in ('confirmed', 'completed', 'no_show')
      or (b.status = 'pending_payment' and b.hold_expires_at > now())
    );
  if v_used + v_units > v_capacity then
    return;
  end if;

  return query
  insert into public.bookings as b (
    business_id, status, source, service_date, time_slot_id, vehicle_type_id, zone_id,
    customer_name, customer_phone, customer_email, address, address_references,
    vehicle_type_name, zone_name, time_slot_name, items,
    subtotal_cents, surcharge_cents, total_cents, deposit_cents, capacity_units,
    terms_accepted_at, hold_expires_at
  ) values (
    v_business_id, 'pending_payment', 'online', v_date, v_slot_id,
    (p_booking ->> 'vehicle_type_id')::uuid, (p_booking ->> 'zone_id')::uuid,
    p_booking ->> 'customer_name', p_booking ->> 'customer_phone', p_booking ->> 'customer_email',
    p_booking ->> 'address', coalesce(p_booking ->> 'address_references', ''),
    p_booking ->> 'vehicle_type_name', p_booking ->> 'zone_name', p_booking ->> 'time_slot_name',
    p_booking -> 'items',
    (p_booking ->> 'subtotal_cents')::integer, (p_booking ->> 'surcharge_cents')::integer,
    (p_booking ->> 'total_cents')::integer, (p_booking ->> 'deposit_cents')::integer, v_units,
    now(), now() + interval '30 minutes'
  )
  returning b.id, b.folio;
end;
$$;

-- Stores what Mercado Pago says about a payment and confirms the booking when an approved
-- payment in MXN covers what was due online (deposit_cents: the deposit, or the total).
-- A payment that arrives after the hold ran out still confirms: the money is already in.
-- confirmed_now is true only for the call that confirmed the booking, so its email goes out
-- once; booking_status is the booking's status afterwards.
create function public.record_mercadopago_payment(
  p_booking_id uuid,
  p_payment_id text,
  p_status text,
  p_status_detail text,
  p_amount_cents integer,
  p_currency text,
  p_approved_at timestamptz
)
returns table (confirmed_now boolean, booking_status text)
language plpgsql
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking % not found', p_booking_id using errcode = 'P0002';
  end if;

  insert into public.payments as p (
    business_id, booking_id, provider_payment_id, status, status_detail, amount_cents, currency, approved_at
  ) values (
    v_booking.business_id, v_booking.id, p_payment_id, p_status, p_status_detail, p_amount_cents, p_currency,
    p_approved_at
  )
  on conflict (provider, provider_payment_id) do update
    set status = excluded.status,
        status_detail = excluded.status_detail,
        approved_at = excluded.approved_at
    where p.booking_id = excluded.booking_id;

  if p_status in ('refunded', 'charged_back') then
    update public.bookings set refund_status = 'refunded' where id = v_booking.id;
    return query select false, v_booking.status;
    return;
  end if;

  if p_status = 'approved'
    and p_currency = 'MXN'
    and p_amount_cents >= v_booking.deposit_cents
    and v_booking.status in ('pending_payment', 'expired')
  then
    update public.bookings
    set status = 'confirmed', deposit_paid_at = coalesce(p_approved_at, now())
    where id = v_booking.id;
    return query select true, 'confirmed'::text;
    return;
  end if;

  return query select false, v_booking.status;
end;
$$;

-- Counts one attempt to start a payment and says whether this IP is still under the limit.
-- Attempts older than a day are deleted on the way, so the table stays small.
create function public.register_booking_attempt(p_ip_hash text, p_limit integer, p_window_minutes integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_recent integer;
begin
  delete from public.booking_attempts where created_at < now() - interval '1 day';

  select count(*) into v_recent
  from public.booking_attempts
  where ip_hash = p_ip_hash and created_at > now() - make_interval(mins => p_window_minutes);
  if v_recent >= p_limit then
    return false;
  end if;

  insert into public.booking_attempts (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

-- Supabase lets anon and authenticated execute new functions by default: take that back.
revoke all on function public.create_online_booking(jsonb) from public, anon, authenticated;
revoke all on function public.record_mercadopago_payment(uuid, text, text, text, integer, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.register_booking_attempt(text, integer, integer) from public, anon, authenticated;

grant execute on function public.create_online_booking(jsonb) to service_role;
grant execute on function public.record_mercadopago_payment(uuid, text, text, text, integer, text, timestamptz)
  to service_role;
grant execute on function public.register_booking_attempt(text, integer, integer) to service_role;
