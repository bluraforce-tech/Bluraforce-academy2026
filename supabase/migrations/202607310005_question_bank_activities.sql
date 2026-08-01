create table public.question_bank_units(
 id uuid primary key default gen_random_uuid(),teacher_id uuid not null references public.teacher_profiles(user_id) on delete cascade,
 title text not null check(char_length(trim(title)) between 2 and 200),description text,
 education_system public.education_system not null,national_grade public.national_grade,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(education_system='american' and national_grade is null or education_system='national' and national_grade is not null)
);
create table public.question_bank_questions(
 id uuid primary key default gen_random_uuid(),unit_id uuid not null references public.question_bank_units(id) on delete cascade,
 text text not null,image_url text,points numeric(8,2) not null default 1 check(points>0),position int not null,
 created_at timestamptz not null default now(),unique(unit_id,position)
);
create table public.question_bank_choices(
 id uuid primary key default gen_random_uuid(),question_id uuid not null references public.question_bank_questions(id) on delete cascade,
 text text not null,is_correct boolean not null default false,position int not null,unique(question_id,position)
);
alter table public.exams drop constraint if exists exams_kind_check;
alter table public.exams add constraint exams_kind_check check(kind in ('standard','mistakes','self_practice','homework'));

alter table public.question_bank_units enable row level security;
alter table public.question_bank_questions enable row level security;
alter table public.question_bank_choices enable row level security;
create policy bank_units_admin on public.question_bank_units for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy bank_units_teacher on public.question_bank_units for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
create policy bank_questions_admin on public.question_bank_questions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy bank_questions_teacher on public.question_bank_questions for all to authenticated using(exists(select 1 from question_bank_units u where u.id=unit_id and u.teacher_id=auth.uid())) with check(exists(select 1 from question_bank_units u where u.id=unit_id and u.teacher_id=auth.uid()));
create policy bank_choices_admin on public.question_bank_choices for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy bank_choices_teacher on public.question_bank_choices for all to authenticated using(exists(select 1 from question_bank_questions q join question_bank_units u on u.id=q.unit_id where q.id=question_id and u.teacher_id=auth.uid())) with check(exists(select 1 from question_bank_questions q join question_bank_units u on u.id=q.unit_id where q.id=question_id and u.teacher_id=auth.uid()));
grant select,insert,update,delete on public.question_bank_units,public.question_bank_questions,public.question_bank_choices to authenticated;

create or replace function public.create_activity_from_unit(p_unit_id uuid,p_title text,p_kind text,p_deadline timestamptz,p_assign_all boolean,p_student_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path=public as $$
declare u question_bank_units;e_id uuid;v_id uuid;q question_bank_questions;c question_bank_choices;q_id uuid;s uuid;snapshot jsonb;total numeric:=0;
begin
 if public.app_current_role()<>'teacher' or p_kind not in ('self_practice','homework') then raise exception 'forbidden';end if;
 select * into u from question_bank_units where id=p_unit_id and teacher_id=auth.uid();if not found then raise exception 'unit_not_found';end if;
 if p_kind='homework' and (p_deadline is null or p_deadline<=now()) then raise exception 'deadline_required';end if;
 if not exists(select 1 from question_bank_questions where unit_id=u.id) then raise exception 'questions_required';end if;
 insert into exams(teacher_id,title,description,instructions,kind,status,duration_minutes,ends_at,max_attempts,randomize_questions,randomize_choices,scoring_mode,education_system,national_grade)
 values(auth.uid(),trim(p_title),u.description,case when p_kind='homework' then 'Complete before the homework deadline.' else 'Practice at your own pace.' end,p_kind,'published',600,case when p_kind='homework' then p_deadline else null end,1,false,false,'exact_set',u.education_system,u.national_grade) returning id into e_id;
 for q in select * from question_bank_questions where unit_id=u.id order by position loop
  insert into questions(exam_id,text,image_url,points,position) values(e_id,q.text,q.image_url,q.points,q.position) returning id into q_id;total:=total+q.points;
  for c in select * from question_bank_choices where question_id=q.id order by position loop insert into question_choices(question_id,text,is_correct,position) values(q_id,c.text,c.is_correct,c.position);end loop;
 end loop;
 select jsonb_build_object('examId',e_id,'title',e.title,'description',e.description,'instructions',e.instructions,'durationMinutes',null,'untimed',true,'scoringMode',e.scoring_mode,'questions',jsonb_agg(jsonb_build_object('id',qr.id,'text',qr.text,'imageUrl',qr.image_url,'points',qr.points,'position',qr.position,'choices',(select jsonb_agg(jsonb_build_object('id',cr.id,'text',cr.text,'isCorrect',cr.is_correct,'position',cr.position) order by cr.position) from question_choices cr where cr.question_id=qr.id)) order by qr.position)) into snapshot from exams e join questions qr on qr.exam_id=e.id where e.id=e_id group by e.id;
 insert into exam_versions(exam_id,version,snapshot,total_points) values(e_id,1,snapshot,total) returning id into v_id;update exams set published_version_id=v_id where id=e_id;
 if p_assign_all then
  insert into exam_assignments(exam_id,student_id) select e_id,en.student_id from teacher_student_enrollments en join student_profiles sp on sp.user_id=en.student_id where en.teacher_id=auth.uid() and en.status='active' and (en.access_expires_at is null or en.access_expires_at>now()) and sp.education_system=u.education_system and (u.education_system='american' or sp.national_grade=u.national_grade) on conflict do nothing;
 else foreach s in array p_student_ids loop if not public.is_active_enrollment(auth.uid(),s) or not public.education_target_matches(u.education_system,u.national_grade,s) then raise exception 'invalid_student';end if;insert into exam_assignments(exam_id,student_id) values(e_id,s) on conflict do nothing;end loop;end if;
 return e_id;
end $$;
revoke all on function public.create_activity_from_unit(uuid,text,text,timestamptz,boolean,uuid[]) from public,anon;
grant execute on function public.create_activity_from_unit(uuid,text,text,timestamptz,boolean,uuid[]) to authenticated;

create or replace function public.get_student_activities(p_teacher_id uuid) returns jsonb language sql security definer set search_path=public stable as $$
 select coalesce(jsonb_agg(jsonb_build_object('assignmentId',a.id,'title',e.title,'description',e.description,'kind',e.kind,'deadline',e.ends_at) order by e.created_at desc),'[]'::jsonb)
 from exam_assignments a join exams e on e.id=a.exam_id where a.student_id=auth.uid() and a.revoked_at is null and e.teacher_id=p_teacher_id and e.status='published' and e.kind in ('self_practice','homework') and public.is_active_enrollment(p_teacher_id,auth.uid()) and public.education_target_matches(e.education_system,e.national_grade,auth.uid()) and (e.kind='self_practice' or e.ends_at>now());
$$;
grant execute on function public.get_student_activities(uuid) to authenticated;

create or replace function public.start_exam_attempt(p_assignment_id uuid) returns public.exam_attempts language plpgsql security definer set search_path=public as $$
declare a exam_assignments;e exams;existing exam_attempts;n int;expiry timestamptz;
begin select * into a from exam_assignments where id=p_assignment_id and student_id=auth.uid() and revoked_at is null;if not found then raise exception 'assignment_unavailable';end if;
select * into e from exams where id=a.exam_id and status='published';if not found or not public.education_target_matches(e.education_system,e.national_grade,auth.uid()) or not public.is_active_enrollment(e.teacher_id,auth.uid()) or (e.starts_at is not null and now()<e.starts_at) or (e.kind='homework' and (e.ends_at is null or now()>=e.ends_at)) or (e.kind not in ('self_practice','homework') and e.ends_at is not null and now()>=e.ends_at) then raise exception 'exam_unavailable';end if;
select * into existing from exam_attempts where assignment_id=a.id and status='in_progress' order by attempt_number desc limit 1;if found and existing.expires_at>now() then return existing;end if;
update exam_attempts set status='expired',submitted_at=now() where assignment_id=a.id and status='in_progress' and expires_at<=now();select count(*)+1 into n from exam_attempts where assignment_id=a.id;if n>e.max_attempts then raise exception 'attempt_limit';end if;
expiry:=case when e.kind='self_practice' then now()+interval '100 years' when e.kind='homework' then e.ends_at else least(now()+make_interval(mins=>e.duration_minutes),coalesce(e.ends_at,'infinity')) end;
insert into exam_attempts(assignment_id,student_id,exam_version_id,attempt_number,expires_at) values(a.id,auth.uid(),e.published_version_id,n,expiry) returning * into existing;return existing;end $$;
