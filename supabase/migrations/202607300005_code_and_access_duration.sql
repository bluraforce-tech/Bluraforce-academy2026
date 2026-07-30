-- Invitation codes are redeemable for two days. Teacher access has its own
-- teacher-selected duration and is enforced independently of code expiry.
alter table public.teacher_student_enrollments
  add column if not exists access_expires_at timestamptz;

alter table public.student_invitation_codes
  add column if not exists access_duration_days int;

update public.student_invitation_codes
set access_duration_days = 30
where access_duration_days is null;

alter table public.student_invitation_codes
  alter column access_duration_days set not null;

alter table public.student_invitation_codes
  add constraint invitation_access_duration_check
  check (access_duration_days between 1 and 3650);

alter table public.student_invitation_codes
  alter column expires_at set default (now() + interval '2 days');

create or replace function public.is_active_enrollment(
  p_teacher uuid,
  p_student uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from teacher_student_enrollments e
    join teacher_profiles t on t.user_id = e.teacher_id
    where e.teacher_id = p_teacher
      and e.student_id = p_student
      and e.status = 'active'
      and (e.access_expires_at is null or e.access_expires_at > now())
      and t.is_active
  )
$$;

create or replace function public.redeem_invitation_code(
  p_teacher_id uuid,
  p_code_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c student_invitation_codes;
  enrollment_id uuid;
begin
  if public.app_current_role() <> 'student' then
    raise exception 'forbidden';
  end if;

  select * into c
  from student_invitation_codes
  where code_hash = p_code_hash
  for update;

  if not found then raise exception 'invalid_code'; end if;
  if c.teacher_id <> p_teacher_id then raise exception 'wrong_teacher'; end if;
  if c.status <> 'active' or c.revoked_at is not null then raise exception 'unavailable_code'; end if;

  if c.expires_at <= now() then
    update student_invitation_codes set status = 'expired' where id = c.id;
    raise exception 'expired_code';
  end if;

  insert into teacher_student_enrollments (
    teacher_id, student_id, status, enrolled_at, access_expires_at, revoked_at
  )
  values (
    p_teacher_id, auth.uid(), 'active', now(),
    now() + make_interval(days => c.access_duration_days), null
  )
  on conflict (teacher_id, student_id) do update
    set status = 'active',
        enrolled_at = now(),
        access_expires_at = excluded.access_expires_at,
        revoked_at = null
  returning id into enrollment_id;

  update student_invitation_codes
  set status = 'redeemed', redeemed_by = auth.uid(), redeemed_at = now()
  where id = c.id;

  insert into audit_logs(actor_id,actor_role,action,entity_type,entity_id)
  values(auth.uid(),'student','code.redeemed','enrollment',enrollment_id);

  return enrollment_id;
end;
$$;

revoke all on function public.redeem_invitation_code(uuid,text) from public,anon;
grant execute on function public.redeem_invitation_code(uuid,text) to authenticated;

create index if not exists enrollments_access_expiry_idx
on public.teacher_student_enrollments(student_id,access_expires_at)
where status='active';
