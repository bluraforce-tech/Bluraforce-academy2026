-- Makes student registration compatible with the automatic auth.users trigger.
-- Safe to apply to projects where the original function already exists.
create or replace function public.complete_student_registration(
  p_user_id uuid,
  p_full_name text,
  p_age smallint,
  p_address text,
  p_mobile text,
  p_guardian_mobile text,
  p_national_id_hash text,
  p_national_id_encrypted text,
  p_national_id_last4 text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;

  insert into public.profiles (id, role, full_name)
  values (p_user_id, 'student', p_full_name)
  on conflict (id) do update
    set full_name = excluded.full_name,
        updated_at = now()
    where profiles.role = 'student';

  insert into public.student_profiles (
    user_id,
    age,
    address,
    mobile,
    guardian_mobile,
    national_id_hash,
    national_id_encrypted,
    national_id_last4
  )
  values (
    p_user_id,
    p_age,
    p_address,
    p_mobile,
    p_guardian_mobile,
    p_national_id_hash,
    p_national_id_encrypted,
    p_national_id_last4
  );
end;
$$;

revoke all on function public.complete_student_registration(
  uuid, text, smallint, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.complete_student_registration(
  uuid, text, smallint, text, text, text, text, text, text
) to service_role;
