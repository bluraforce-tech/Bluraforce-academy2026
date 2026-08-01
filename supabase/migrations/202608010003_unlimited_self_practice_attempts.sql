create or replace function public.start_exam_attempt(p_assignment_id uuid) returns public.exam_attempts language plpgsql security definer set search_path=public as $$
declare a exam_assignments;e exams;existing exam_attempts;n int;expiry timestamptz;
begin
 select * into a from exam_assignments where id=p_assignment_id and student_id=auth.uid() and revoked_at is null;
 if not found then raise exception 'assignment_unavailable';end if;
 select * into e from exams where id=a.exam_id and status='published';
 if not found or not public.education_target_matches(e.education_system,e.national_grade,auth.uid()) or not public.is_active_enrollment(e.teacher_id,auth.uid()) or (e.starts_at is not null and now()<e.starts_at) or (e.kind='homework' and (e.ends_at is null or now()>=e.ends_at)) or (e.kind not in ('self_practice','homework') and e.ends_at is not null and now()>=e.ends_at) then raise exception 'exam_unavailable';end if;
 select * into existing from exam_attempts where assignment_id=a.id and status='in_progress' order by attempt_number desc limit 1;
 if found and existing.expires_at>now() then return existing;end if;
 update exam_attempts set status='expired',submitted_at=now() where assignment_id=a.id and status='in_progress' and expires_at<=now();
 select count(*)+1 into n from exam_attempts where assignment_id=a.id;
 if e.kind<>'self_practice' and n>e.max_attempts then raise exception 'attempt_limit';end if;
 expiry:=case when e.kind='self_practice' then now()+interval '100 years' when e.kind='homework' then e.ends_at else least(now()+make_interval(mins=>e.duration_minutes),coalesce(e.ends_at,'infinity')) end;
 insert into exam_attempts(assignment_id,student_id,exam_version_id,attempt_number,expires_at) values(a.id,auth.uid(),e.published_version_id,n,expiry) returning * into existing;
 return existing;
end $$;

revoke all on function public.start_exam_attempt(uuid) from public,anon;
grant execute on function public.start_exam_attempt(uuid) to authenticated;
