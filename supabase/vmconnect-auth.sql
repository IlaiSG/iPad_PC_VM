-- Run this once in the Supabase SQL Editor for the VMConnect project.
-- The table is intentionally private: only the service role can access it.
create table if not exists public.vmconnect_auth_codes (
  owner_id text primary key check (owner_id = 'owner'),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 5),
  sent_at timestamptz not null
);

alter table public.vmconnect_auth_codes enable row level security;

revoke all on public.vmconnect_auth_codes from anon, authenticated;
grant all on public.vmconnect_auth_codes to service_role;

create or replace function public.vmconnect_issue_code(
  p_code_hash text,
  p_now timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_sent timestamptz;
begin
  select sent_at into previous_sent
  from public.vmconnect_auth_codes
  where owner_id = 'owner'
  for update;

  if previous_sent is not null and previous_sent > p_now - interval '60 seconds' then
    return false;
  end if;

  insert into public.vmconnect_auth_codes (owner_id, code_hash, expires_at, attempts, sent_at)
  values ('owner', p_code_hash, p_now + interval '10 minutes', 0, p_now)
  on conflict (owner_id) do update
    set code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        attempts = 0,
        sent_at = excluded.sent_at;
  return true;
end;
$$;

create or replace function public.vmconnect_consume_code(
  p_code_hash text,
  p_now timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_hash text;
  current_attempts integer;
begin
  select code_hash, attempts into stored_hash, current_attempts
  from public.vmconnect_auth_codes
  where owner_id = 'owner' and expires_at > p_now
  for update;

  if stored_hash is null or current_attempts >= 5 then
    return false;
  end if;

  if stored_hash = p_code_hash then
    delete from public.vmconnect_auth_codes where owner_id = 'owner';
    return true;
  end if;

  update public.vmconnect_auth_codes
  set attempts = attempts + 1
  where owner_id = 'owner';
  return false;
end;
$$;

revoke all on function public.vmconnect_issue_code(text, timestamptz) from public, anon, authenticated;
revoke all on function public.vmconnect_consume_code(text, timestamptz) from public, anon, authenticated;
grant execute on function public.vmconnect_issue_code(text, timestamptz) to service_role;
grant execute on function public.vmconnect_consume_code(text, timestamptz) to service_role;
