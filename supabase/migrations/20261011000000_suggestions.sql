-- RamAI · user suggestions
--
-- Signed-in players send suggestions; the site's admins read, answer and
-- manage them. Row-level security does the guarding inside the database:
--   · a player can add suggestions as themselves and read only their own;
--   · only admins can read everyone's, answer, change the status or delete;
--   · nobody can promote themselves to admin through the API.
-- Run once in the Supabase SQL editor (or with `supabase db push`). Safe to re-run.

-- Admins ----------------------------------------------------------------------

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "an admin can see their own row" on public.admins;
create policy "an admin can see their own row" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- Runs with the caller's own rights: a signed-in user can only ever see their own admins row.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- The site owner becomes an admin as soon as their email is confirmed.
create or replace function public.grant_owner_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(new.email) = 'ramrajkansana100@gmail.com' and new.email_confirmed_at is not null then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
-- A trigger function, never meant to be called through the API.
revoke all on function public.grant_owner_admin() from public, anon, authenticated;
drop trigger if exists grant_owner_admin on auth.users;
create trigger grant_owner_admin
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.grant_owner_admin();
-- …and if they've already signed up:
insert into public.admins (user_id)
  select id from auth.users where lower(email) = 'ramrajkansana100@gmail.com' and email_confirmed_at is not null
  on conflict do nothing;

-- Suggestions -----------------------------------------------------------------

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) between 3 and 200),
  category text not null check (category in ('idea', 'problem', 'case', 'other')),
  message text not null check (char_length(message) between 10 and 2000),
  page text check (char_length(page) <= 200),
  status text not null default 'new' check (status in ('new', 'reviewing', 'planned', 'done', 'declined')),
  reply text check (char_length(reply) <= 2000),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suggestions_status_created on public.suggestions (status, created_at desc);
create index if not exists suggestions_user_created on public.suggestions (user_id, created_at desc);
alter table public.suggestions enable row level security;

drop policy if exists "players add their own" on public.suggestions;
create policy "players add their own" on public.suggestions
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "players read their own; admins read all" on public.suggestions;
create policy "players read their own; admins read all" on public.suggestions
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "admins answer" on public.suggestions;
create policy "admins answer" on public.suggestions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins delete" on public.suggestions;
create policy "admins delete" on public.suggestions
  for delete to authenticated using ((select public.is_admin()));

-- Whatever a request sends: a player's new suggestion starts unanswered, and
-- an answer never rewrites who sent it or what they said.
create or replace function public.suggestions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.status := 'new';
      new.reply := null;
    end if;
    new.replied_at := case when new.reply is null then null else now() end;
    new.created_at := now();
    new.updated_at := now();
  else
    new.id := old.id;
    new.user_id := old.user_id;
    new.name := old.name;
    new.email := old.email;
    new.message := old.message;
    new.category := old.category;
    new.page := old.page;
    new.created_at := old.created_at;
    new.updated_at := now();
    if new.reply is distinct from old.reply then
      new.replied_at := case when new.reply is null then null else now() end;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists suggestions_guard on public.suggestions;
create trigger suggestions_guard
  before insert or update on public.suggestions
  for each row execute function public.suggestions_guard();

grant select, insert, update, delete on public.suggestions to authenticated;
grant select on public.admins to authenticated;
revoke all on public.suggestions from anon;
revoke all on public.admins from anon;
