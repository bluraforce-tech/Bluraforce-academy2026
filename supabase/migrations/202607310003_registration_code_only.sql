-- An activation code uniquely identifies its teacher; students must never enter a teacher UUID.
drop function if exists public.complete_student_registration_with_code(uuid,text,smallint,text,text,text,text,text,text,uuid,text);

create or replace function public.complete_student_registration_with_code(
 p_user_id uuid,p_full_name text,p_age smallint,p_address text,p_mobile text,p_guardian_mobile text,
 p_national_id_hash text,p_national_id_encrypted text,p_national_id_last4 text,p_code_hash text
) returns void language plpgsql security definer set search_path=public as $$
declare c public.student_invitation_codes; v_days int;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden'; end if;
 select * into c from student_invitation_codes where code_hash=p_code_hash for update;
 if not found or c.status<>'active' or c.education_system is null then raise exception 'unavailable_code'; end if;
 if c.expires_at is not null and c.expires_at<=now() then
  update student_invitation_codes set status='expired' where id=c.id;
  raise exception 'expired_code';
 end if;
 insert into profiles(id,role,full_name) values(p_user_id,'student',p_full_name)
 on conflict(id) do update set full_name=excluded.full_name,updated_at=now() where profiles.role='student';
 insert into student_profiles(user_id,age,address,mobile,guardian_mobile,national_id_hash,national_id_encrypted,national_id_last4,education_system,national_grade)
 values(p_user_id,p_age,p_address,p_mobile,p_guardian_mobile,p_national_id_hash,p_national_id_encrypted,p_national_id_last4,c.education_system,c.national_grade);
 v_days:=coalesce(c.access_duration_days,30);
 insert into teacher_student_enrollments(teacher_id,student_id,status,access_expires_at)
 values(c.teacher_id,p_user_id,'active',now()+make_interval(days=>v_days));
 update student_invitation_codes set status='redeemed',redeemed_by=p_user_id,redeemed_at=now()
 where id=c.id and status='active';
 if not found then raise exception 'unavailable_code'; end if;
end $$;

revoke all on function public.complete_student_registration_with_code(uuid,text,smallint,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_student_registration_with_code(uuid,text,smallint,text,text,text,text,text,text,text) to service_role;
