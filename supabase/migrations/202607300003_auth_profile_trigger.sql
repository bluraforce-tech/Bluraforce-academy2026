-- Every Auth user receives a safe default application profile automatically.
-- Never derive application roles from user-controlled metadata.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_name text;
begin
  candidate_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  if char_length(candidate_name) < 3 then
    candidate_name := split_part(coalesce(new.email, ''), '@', 1);
  end if;

  if char_length(candidate_name) < 3 then
    candidate_name := 'New User';
  end if;

  insert into public.profiles (id, role, full_name)
  values (new.id, 'student', left(candidate_name, 120))
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Safely backfill Auth users created before this trigger existed.
insert into public.profiles (id, role, full_name)
select
  user_record.id,
  'student'::public.app_role,
  left(
    case
      when char_length(trim(coalesce(user_record.raw_user_meta_data ->> 'full_name', ''))) >= 3
        then trim(user_record.raw_user_meta_data ->> 'full_name')
      when char_length(split_part(coalesce(user_record.email, ''), '@', 1)) >= 3
        then split_part(user_record.email, '@', 1)
      else 'New User'
    end,
    120
  )
from auth.users as user_record
where not exists (
  select 1 from public.profiles as profile where profile.id = user_record.id
);
