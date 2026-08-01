-- Students register unclassified, then choose a teacher and redeem that teacher's code.
-- The first code sets the immutable student target; subsequent codes must match it.
create or replace function public.redeem_invitation_code(p_teacher_id uuid,p_code_hash text)
returns uuid language plpgsql security definer set search_path=public as $$
declare c student_invitation_codes; s student_profiles; enrollment_id uuid;
begin
 if public.app_current_role()<>'student' then raise exception 'forbidden'; end if;
 select * into c from student_invitation_codes where code_hash=p_code_hash for update;
 if not found then raise exception 'invalid_code'; end if;
 if c.teacher_id<>p_teacher_id then raise exception 'wrong_teacher'; end if;
 if c.status<>'active' or c.revoked_at is not null or c.education_system is null then raise exception 'unavailable_code'; end if;
 if c.expires_at<=now() then
  update student_invitation_codes set status='expired' where id=c.id;
  raise exception 'expired_code';
 end if;
 select * into s from student_profiles where user_id=auth.uid() for update;
 if not found then raise exception 'student_profile_missing'; end if;
 if s.education_system is null then
  update student_profiles set education_system=c.education_system,national_grade=c.national_grade,updated_at=now() where user_id=auth.uid();
 elsif s.education_system<>c.education_system or s.national_grade is distinct from c.national_grade then
  raise exception 'education_target_mismatch';
 end if;
 insert into teacher_student_enrollments(teacher_id,student_id,status,enrolled_at,access_expires_at,revoked_at)
 values(p_teacher_id,auth.uid(),'active',now(),now()+make_interval(days=>c.access_duration_days),null)
 on conflict(teacher_id,student_id) do update set status='active',enrolled_at=now(),revoked_at=null,access_expires_at=excluded.access_expires_at
 returning id into enrollment_id;
 update student_invitation_codes set status='redeemed',redeemed_by=auth.uid(),redeemed_at=now() where id=c.id and status='active';
 if not found then raise exception 'unavailable_code'; end if;
 insert into audit_logs(actor_id,actor_role,action,entity_type,entity_id) values(auth.uid(),'student','code.redeemed','enrollment',enrollment_id);
 return enrollment_id;
end $$;
revoke all on function public.redeem_invitation_code(uuid,text) from public,anon;
grant execute on function public.redeem_invitation_code(uuid,text) to authenticated;

drop function if exists public.complete_student_registration_with_code(uuid,text,smallint,text,text,text,text,text,text,text);
