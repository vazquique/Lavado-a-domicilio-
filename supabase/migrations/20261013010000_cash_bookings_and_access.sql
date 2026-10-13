-- Two requests from the owner (2026-10-13):
-- 1. Customers book from the page and pay cash on the day: the booking is confirmed right
--    away and shows up in the agenda, without the owner typing it.
-- 2. The owner decides who else can enter the panel (by email), so nobody's email has to be
--    written in the code (the repository is public).

-- A booking from the public page, paid in cash on the day: confirmed, nothing paid yet.
-- Server code only (service_role): it already priced it with the catalog and checked the
-- customer accepted the terms. Returns no row when the slot is full or doesn't exist.
create function public.create_cash_booking(p_booking jsonb)
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
begin
  -- One booking at a time per slot: this row stays locked until the transaction ends.
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

  if private.used_units(v_business_id, v_date, v_slot.id, null) + v_units > v_slot.capacity then
    return;
  end if;

  return query
  insert into public.bookings as b (
    business_id, status, source, service_date, time_slot_id, vehicle_type_id, zone_id,
    customer_name, customer_phone, customer_email, address, address_references,
    vehicle_type_name, zone_name, time_slot_name, items,
    subtotal_cents, surcharge_cents, total_cents, deposit_cents, capacity_units, terms_accepted_at
  ) values (
    v_business_id, 'confirmed', 'online', v_date, v_slot.id,
    (p_booking ->> 'vehicle_type_id')::uuid, (p_booking ->> 'zone_id')::uuid,
    p_booking ->> 'customer_name', p_booking ->> 'customer_phone', p_booking ->> 'customer_email',
    p_booking ->> 'address', coalesce(p_booking ->> 'address_references', ''),
    p_booking ->> 'vehicle_type_name', p_booking ->> 'zone_name', v_slot.name,
    p_booking -> 'items',
    (p_booking ->> 'subtotal_cents')::integer, (p_booking ->> 'surcharge_cents')::integer,
    (p_booking ->> 'total_cents')::integer, 0, v_units, now()
  )
  returning b.id, b.folio;
end;
$$;

-- Who can enter a business's panel: its members (with their email) and pending invitations.
create function public.business_access(p_business_id uuid)
returns table (email text, status text, is_you boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select access.email, access.status, access.is_you
  from (
    select u.email::text as email, 'member'::text as status, u.id = auth.uid() as is_you
    from public.business_members m
    join auth.users u on u.id = m.user_id
    where m.business_id = p_business_id
    union all
    select i.email, 'invited', false
    from public.business_invites i
    where i.business_id = p_business_id
  ) access
  where private.is_business_member(p_business_id)
  order by access.status, access.email;
$$;

-- Gives someone access: membership right away if they already have a user, otherwise an
-- invitation that becomes membership the first time they log in. Returns 'member' or 'invited'.
create function public.grant_business_access(p_business_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_user_id uuid;
begin
  if not private.is_business_member(p_business_id) then
    raise exception 'not a member of this business' using errcode = '42501';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 254 then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = v_email and u.email_confirmed_at is not null
  limit 1;
  if v_user_id is not null then
    insert into public.business_members (business_id, user_id)
    values (p_business_id, v_user_id)
    on conflict (business_id, user_id) do nothing;
    return 'member';
  end if;

  insert into public.business_invites (business_id, email)
  values (p_business_id, v_email)
  on conflict (business_id, email) do nothing;
  return 'invited';
end;
$$;

-- Takes access away from a pending invitation or another member. Nobody removes themselves,
-- so a business always keeps someone who can enter. Returns whether something was removed.
create function public.revoke_business_access(p_business_id uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_invites integer;
  v_members integer;
begin
  if not private.is_business_member(p_business_id) then
    raise exception 'not a member of this business' using errcode = '42501';
  end if;

  delete from public.business_invites i where i.business_id = p_business_id and i.email = v_email;
  get diagnostics v_invites = row_count;

  delete from public.business_members m
  using auth.users u
  where m.business_id = p_business_id
    and m.user_id = u.id
    and lower(u.email) = v_email
    and u.id is distinct from auth.uid();
  get diagnostics v_members = row_count;

  return v_invites + v_members > 0;
end;
$$;

revoke all on function public.create_cash_booking(jsonb) from public, anon, authenticated;
revoke all on function public.business_access(uuid) from public, anon, authenticated;
revoke all on function public.grant_business_access(uuid, text) from public, anon, authenticated;
revoke all on function public.revoke_business_access(uuid, text) from public, anon, authenticated;
grant execute on function public.create_cash_booking(jsonb) to service_role;
grant execute on function public.business_access(uuid) to authenticated, service_role;
grant execute on function public.grant_business_access(uuid, text) to authenticated, service_role;
grant execute on function public.revoke_business_access(uuid, text) to authenticated, service_role;
