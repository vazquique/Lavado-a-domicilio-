-- The panel's agenda: bookings the owner adds by hand (they come by WhatsApp or phone) and
-- bookings moved to another day or time slot. Both lock the time slot row, like
-- create_online_booking, so two bookings can't take the last place at the same time.
-- Status, notes and "saldo pagado" are plain updates the owner already may do (RLS).

-- Places taken in a slot on a day, leaving out one booking (the one being moved).
create function private.used_units(p_business_id uuid, p_date date, p_slot_id uuid, p_except uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(b.capacity_units), 0)::integer
  from public.bookings b
  where b.business_id = p_business_id
    and b.service_date = p_date
    and b.time_slot_id = p_slot_id
    and b.id is distinct from p_except
    and (
      b.status in ('confirmed', 'completed', 'no_show')
      or (b.status = 'pending_payment' and b.hold_expires_at > now())
    );
$$;

-- A booking from the panel: confirmed right away, nothing paid yet (all of it is paid on
-- the day). Amounts come from the server, which prices it with the catalog. Returns no row
-- when the slot is full or doesn't exist.
create function public.create_manual_booking(p_booking jsonb)
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
  if not private.is_business_member(v_business_id) then
    raise exception 'not a member of this business' using errcode = '42501';
  end if;

  -- One booking at a time per slot: this row stays locked until the transaction ends.
  select * into v_slot
  from public.time_slots s
  where s.business_id = v_business_id and s.id = (p_booking ->> 'time_slot_id')::uuid and s.active
  for update;
  if not found or private.used_units(v_business_id, v_date, v_slot.id, null) + v_units > v_slot.capacity then
    return;
  end if;

  return query
  insert into public.bookings as b (
    business_id, status, source, service_date, time_slot_id, vehicle_type_id, zone_id,
    customer_name, customer_phone, customer_email, address, address_references,
    vehicle_type_name, zone_name, time_slot_name, items,
    subtotal_cents, surcharge_cents, total_cents, deposit_cents, capacity_units, notes
  ) values (
    v_business_id, 'confirmed', 'manual', v_date, v_slot.id,
    (p_booking ->> 'vehicle_type_id')::uuid, (p_booking ->> 'zone_id')::uuid,
    p_booking ->> 'customer_name', p_booking ->> 'customer_phone', p_booking ->> 'customer_email',
    p_booking ->> 'address', coalesce(p_booking ->> 'address_references', ''),
    p_booking ->> 'vehicle_type_name', p_booking ->> 'zone_name', v_slot.name,
    p_booking -> 'items',
    (p_booking ->> 'subtotal_cents')::integer, (p_booking ->> 'surcharge_cents')::integer,
    (p_booking ->> 'total_cents')::integer, 0, v_units, coalesce(p_booking ->> 'notes', '')
  )
  returning b.id, b.folio;
end;
$$;

-- Moves a confirmed booking to another day or time slot if there's room there.
-- Returns 'moved', 'full' (no room), 'no_slot' (that slot doesn't exist or is off) or
-- 'not_movable' (not found, or not confirmed: done, cancelled, unpaid...).
create function public.reschedule_booking(p_booking_id uuid, p_date date, p_slot_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_booking public.bookings%rowtype;
  v_slot public.time_slots%rowtype;
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
  if private.used_units(v_business_id, p_date, v_slot.id, v_booking.id) + v_booking.capacity_units > v_slot.capacity then
    return 'full';
  end if;

  update public.bookings
  set service_date = p_date, time_slot_id = v_slot.id, time_slot_name = v_slot.name
  where id = v_booking.id;
  return 'moved';
end;
$$;

revoke all on function private.used_units(uuid, date, uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_manual_booking(jsonb) from public, anon, authenticated;
revoke all on function public.reschedule_booking(uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.create_manual_booking(jsonb) to authenticated, service_role;
grant execute on function public.reschedule_booking(uuid, date, uuid) to authenticated, service_role;
