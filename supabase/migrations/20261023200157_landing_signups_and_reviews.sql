-- Venue owner sign-ups from the landing page, and player/owner reviews shown on it.
--
-- Sign-up flow: the `register` Edge Function validates the form and calls auth.signUp with the
-- form fields as user metadata (source = 'landing'). The insert trigger below copies them into
-- venue_signups. When the owner clicks the confirmation email, the update trigger starts the trial.
--
-- Reviews are inserted only by the `feedback` Edge Function (service role) and stay hidden until
-- someone sets approved = true in the dashboard.

create schema if not exists private;

-- Venue sign-ups -------------------------------------------------------------------------------

create table public.venue_signups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  phone text not null check (char_length(phone) between 7 and 20),
  venue_name text not null check (char_length(venue_name) between 2 and 80),
  location text not null check (char_length(location) between 2 and 120),
  courts smallint not null check (courts between 1 and 50),
  facebook text check (char_length(facebook) <= 200),
  open_play_addon boolean not null default false,
  message text check (char_length(message) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'trial', 'active', 'cancelled')),
  email_confirmed_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.venue_signups is
  'One row per venue owner who signed up on the landing page. Written only by triggers on auth.users.';

alter table public.venue_signups enable row level security;

-- Writes come only from the security definer triggers below.
revoke insert, update, delete on public.venue_signups from anon, authenticated;

create policy "Owners read their own sign-up"
  on public.venue_signups for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function private.handle_landing_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := new.raw_user_meta_data;
begin
  if meta ->> 'source' is distinct from 'landing' then
    return new;
  end if;

  insert into public.venue_signups (
    user_id, first_name, last_name, phone, venue_name, location, courts,
    facebook, open_play_addon, message
  ) values (
    new.id,
    meta ->> 'first_name',
    meta ->> 'last_name',
    meta ->> 'phone',
    meta ->> 'venue_name',
    meta ->> 'location',
    (meta ->> 'courts')::smallint,
    nullif(meta ->> 'facebook', ''),
    coalesce((meta ->> 'open_play_addon')::boolean, false),
    nullif(meta ->> 'message', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created_landing
  after insert on auth.users
  for each row execute function private.handle_landing_signup();

-- The trial starts when the owner confirms their email, not when they submit the form.
create or replace function private.start_trial_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.venue_signups
     set status = 'trial',
         email_confirmed_at = new.email_confirmed_at,
         trial_ends_at = new.email_confirmed_at + interval '7 days'
   where user_id = new.id
     and status = 'pending';
  return new;
end;
$$;

create trigger on_auth_user_confirmed_landing
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.start_trial_on_confirm();

-- Reviews --------------------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  venue text check (char_length(venue) <= 80),
  quote text not null check (char_length(quote) between 10 and 400),
  role text not null check (role in ('player', 'owner')),
  rating smallint not null check (rating between 1 and 5),
  approved boolean not null default false,
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.reviews is
  'Reviews sent from the landing page. Inserted by the feedback Edge Function; shown once approved.';

create index reviews_approved_created_at_idx on public.reviews (created_at desc) where approved;

alter table public.reviews enable row level security;

revoke insert, update, delete on public.reviews from anon, authenticated;

create policy "Anyone reads approved reviews"
  on public.reviews for select
  to anon, authenticated
  using (approved);
