-- Narrow, audited bridge to Neon Auth identities. The auth schema is never
-- granted to the application role; only this function can read it.
create or replace function public.resolve_user_id(p_email text)
returns text
language sql
security definer
set search_path = neon_auth, public
as $$
  select u.id::text from neon_auth."user" u where lower(u.email) = lower(p_email) limit 1
$$;

revoke all on function public.resolve_user_id(text) from public;
grant execute on function public.resolve_user_id(text) to app_user;


-- Realtime reads the board_live projection (see migration 0001); the base
-- table keeps RLS forced for every application query.
alter table boards force row level security;
