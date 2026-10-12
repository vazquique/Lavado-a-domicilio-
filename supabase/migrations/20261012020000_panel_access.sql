-- Panel access: invitations by email and business logos.
--
-- Users are never created by the public: the server creates the auth user for an
-- invited email, and this trigger turns the invitation into a membership once the
-- user's email is confirmed. Logins still require the code sent to that email.

create table public.business_invites (
  business_id uuid not null references public.businesses (id) on delete cascade,
  email text not null
    check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  primary key (business_id, email)
);

-- Only server code (service_role) reads or writes invitations.
alter table public.business_invites enable row level security;
revoke all on table public.business_invites from anon, authenticated;
grant all on table public.business_invites to service_role;

create function private.accept_business_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_members (business_id, user_id, role)
  select i.business_id, new.id, i.role
  from public.business_invites i
  where i.email = lower(new.email)
  on conflict (business_id, user_id) do nothing;

  delete from public.business_invites where email = lower(new.email);
  return new;
end;
$$;

revoke all on function private.accept_business_invites() from public;

create trigger on_auth_user_email_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row
  when (new.email_confirmed_at is not null and new.email is not null)
  execute function private.accept_business_invites();

-- JB's Bros owner.
insert into public.business_invites (business_id, email)
select id, 'vazquique@gmail.com' from public.businesses where slug = 'jbsbros';

---------------------------------------------------------------------------
-- Logos: public bucket. Uploads go through the server (secret key) after it checks
-- that the user manages the business, so no storage policies are needed.
---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
