-- The owner signs in as ramrajkvpy100@gmail.com: that account is an admin too (as soon as its email is confirmed).
create or replace function public.grant_owner_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(new.email) in ('ramrajkansana100@gmail.com', 'ramrajkvpy100@gmail.com') and new.email_confirmed_at is not null then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.grant_owner_admin() from public, anon, authenticated;

insert into public.admins (user_id)
  select id from auth.users where lower(email) in ('ramrajkansana100@gmail.com', 'ramrajkvpy100@gmail.com') and email_confirmed_at is not null
  on conflict do nothing;
