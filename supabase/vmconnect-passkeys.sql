-- VMConnect passkeys and trusted-device records.
-- Run this in the Supabase SQL Editor after vmconnect-auth.sql.

create table if not exists public.vmconnect_trusted_devices (
  device_id text primary key,
  owner_id text not null default 'owner' check (owner_id = 'owner'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create table if not exists public.vmconnect_passkeys (
  credential_id text primary key,
  owner_id text not null default 'owner' check (owner_id = 'owner'),
  device_id text not null references public.vmconnect_trusted_devices(device_id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0,
  transports jsonb not null default '[]'::jsonb,
  device_type text not null,
  backed_up boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.vmconnect_webauthn_challenges (
  purpose text not null check (purpose in ('registration','authentication')),
  device_id text not null,
  challenge text not null,
  expires_at timestamptz not null,
  primary key (purpose, device_id)
);

alter table public.vmconnect_trusted_devices enable row level security;
alter table public.vmconnect_passkeys enable row level security;
alter table public.vmconnect_webauthn_challenges enable row level security;

revoke all on public.vmconnect_trusted_devices, public.vmconnect_passkeys, public.vmconnect_webauthn_challenges from anon, authenticated;
grant all on public.vmconnect_trusted_devices, public.vmconnect_passkeys, public.vmconnect_webauthn_challenges to service_role;

create or replace function public.vmconnect_trust_device(p_device_id text, p_now timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  insert into public.vmconnect_trusted_devices(device_id, created_at, last_used_at)
  values (p_device_id, p_now, p_now)
  on conflict (device_id) do update set last_used_at = excluded.last_used_at;
  return true;
end;
$$;

create or replace function public.vmconnect_device_is_trusted(p_device_id text, p_now timestamptz)
returns boolean language sql security definer set search_path = '' as $$
  select exists(select 1 from public.vmconnect_trusted_devices where device_id = p_device_id);
$$;

create or replace function public.vmconnect_save_challenge(p_purpose text, p_device_id text, p_challenge text, p_now timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_purpose not in ('registration','authentication') then return false; end if;
  if not exists(select 1 from public.vmconnect_trusted_devices where device_id = p_device_id) then return false; end if;
  insert into public.vmconnect_webauthn_challenges(purpose, device_id, challenge, expires_at)
  values (p_purpose, p_device_id, p_challenge, p_now + interval '5 minutes')
  on conflict (purpose, device_id) do update
    set challenge = excluded.challenge, expires_at = excluded.expires_at;
  return true;
end;
$$;

create or replace function public.vmconnect_take_challenge(p_purpose text, p_device_id text, p_now timestamptz)
returns text language plpgsql security definer set search_path = '' as $$
declare saved text;
begin
  delete from public.vmconnect_webauthn_challenges
  where purpose = p_purpose and device_id = p_device_id and expires_at > p_now
  returning challenge into saved;
  return saved;
end;
$$;

create or replace function public.vmconnect_list_passkeys(p_device_id text)
returns jsonb language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'credential_id', credential_id,
    'public_key', public_key,
    'counter', counter,
    'transports', transports,
    'device_type', device_type,
    'backed_up', backed_up
  )), '[]'::jsonb)
  from public.vmconnect_passkeys
  where device_id = p_device_id;
$$;

create or replace function public.vmconnect_save_passkey(
  p_credential_id text, p_device_id text, p_public_key text, p_counter bigint,
  p_transports jsonb, p_device_type text, p_backed_up boolean
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.vmconnect_trusted_devices where device_id = p_device_id) then return false; end if;
  insert into public.vmconnect_passkeys(credential_id, device_id, public_key, counter, transports, device_type, backed_up)
  values (p_credential_id, p_device_id, p_public_key, p_counter, coalesce(p_transports, '[]'::jsonb), p_device_type, p_backed_up)
  on conflict (credential_id) do nothing;
  return found;
end;
$$;

create or replace function public.vmconnect_get_passkey(p_credential_id text, p_device_id text)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'credential_id', credential_id,
    'public_key', public_key,
    'counter', counter,
    'transports', transports,
    'device_type', device_type,
    'backed_up', backed_up
  )
  from public.vmconnect_passkeys
  where credential_id = p_credential_id and device_id = p_device_id
  limit 1;
$$;

create or replace function public.vmconnect_update_passkey_counter(p_credential_id text, p_device_id text, p_counter bigint, p_now timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.vmconnect_passkeys
  set counter = p_counter, last_used_at = p_now
  where credential_id = p_credential_id and device_id = p_device_id;
  if not found then return false; end if;
  update public.vmconnect_trusted_devices set last_used_at = p_now where device_id = p_device_id;
  return true;
end;
$$;

revoke all on function public.vmconnect_trust_device(text,timestamptz) from public, anon, authenticated;
revoke all on function public.vmconnect_device_is_trusted(text,timestamptz) from public, anon, authenticated;
revoke all on function public.vmconnect_save_challenge(text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.vmconnect_take_challenge(text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.vmconnect_list_passkeys(text) from public, anon, authenticated;
revoke all on function public.vmconnect_save_passkey(text,text,text,bigint,jsonb,text,boolean) from public, anon, authenticated;
revoke all on function public.vmconnect_get_passkey(text,text) from public, anon, authenticated;
revoke all on function public.vmconnect_update_passkey_counter(text,text,bigint,timestamptz) from public, anon, authenticated;

grant execute on function public.vmconnect_trust_device(text,timestamptz) to service_role;
grant execute on function public.vmconnect_device_is_trusted(text,timestamptz) to service_role;
grant execute on function public.vmconnect_save_challenge(text,text,text,timestamptz) to service_role;
grant execute on function public.vmconnect_take_challenge(text,text,timestamptz) to service_role;
grant execute on function public.vmconnect_list_passkeys(text) to service_role;
grant execute on function public.vmconnect_save_passkey(text,text,text,bigint,jsonb,text,boolean) to service_role;
grant execute on function public.vmconnect_get_passkey(text,text) to service_role;
grant execute on function public.vmconnect_update_passkey_counter(text,text,bigint,timestamptz) to service_role;
