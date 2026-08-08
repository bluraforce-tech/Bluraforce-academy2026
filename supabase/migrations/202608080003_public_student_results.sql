create table if not exists public.public_results_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  blocked_until timestamptz
);
alter table public.public_results_rate_limits enable row level security;
revoke all on table public.public_results_rate_limits from public, anon, authenticated;

create or replace function public.consume_public_results_rate_limit(p_key_hash text,p_limit integer default 5,p_window_seconds integer default 900)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_row public.public_results_rate_limits%rowtype;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden'; end if;
 if p_key_hash is null or length(p_key_hash)<>64 or p_limit<1 or p_window_seconds<1 then raise exception 'invalid_rate_limit'; end if;
 insert into public.public_results_rate_limits(key_hash,request_count) values(p_key_hash,0) on conflict(key_hash) do nothing;
 select * into v_row from public.public_results_rate_limits where key_hash=p_key_hash for update;
 if v_row.blocked_until is not null and v_row.blocked_until>now() then return false; end if;
 if v_row.window_started_at<=now()-make_interval(secs=>p_window_seconds) then
  update public.public_results_rate_limits set window_started_at=now(),request_count=1,blocked_until=null where key_hash=p_key_hash; return true;
 end if;
 if v_row.request_count>=p_limit then
  update public.public_results_rate_limits set blocked_until=v_row.window_started_at+make_interval(secs=>p_window_seconds) where key_hash=p_key_hash; return false;
 end if;
 update public.public_results_rate_limits set request_count=request_count+1 where key_hash=p_key_hash; return true;
end $$;
revoke all on function public.consume_public_results_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_public_results_rate_limit(text,integer,integer) to service_role;
create index if not exists student_profiles_mobile_exact_idx on public.student_profiles(mobile);
create index if not exists student_profiles_guardian_mobile_exact_idx on public.student_profiles(guardian_mobile);
