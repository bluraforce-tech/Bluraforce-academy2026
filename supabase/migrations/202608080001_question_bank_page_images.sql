alter table public.question_bank_questions add column if not exists page_image_url text;

create or replace function public.create_activity_from_questions(p_unit_id uuid,p_question_ids uuid[],p_title text,p_kind text,p_deadline timestamptz,p_assign_all boolean,p_student_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path=public as $$
declare u question_bank_units;e_id uuid;v_id uuid;q question_bank_questions;c question_bank_choices;q_id uuid;s uuid;snapshot jsonb;total numeric:=0;pos int:=0;
begin
 if public.app_current_role()<>'teacher' or p_kind not in ('self_practice','homework') then raise exception 'forbidden';end if;
 select * into u from question_bank_units where id=p_unit_id and teacher_id=auth.uid();if not found then raise exception 'unit_not_found';end if;
 if p_kind='homework' and (p_deadline is null or p_deadline<=now()) then raise exception 'deadline_required';end if;
 if cardinality(p_question_ids)=0 or exists(select 1 from unnest(p_question_ids) chosen where not exists(select 1 from question_bank_questions bq where bq.id=chosen and bq.unit_id=u.id)) then raise exception 'questions_required';end if;
 insert into exams(teacher_id,title,description,instructions,kind,status,duration_minutes,ends_at,max_attempts,randomize_questions,randomize_choices,scoring_mode,education_system,national_grade)
 values(auth.uid(),trim(p_title),u.description,case when p_kind='homework' then 'Complete before the homework deadline.' else 'Practice at your own pace.' end,p_kind,'published',600,case when p_kind='homework' then p_deadline else null end,1,false,false,'exact_set',u.education_system,u.national_grade) returning id into e_id;
 for q in select bq.* from unnest(p_question_ids) with ordinality selected(id,ord) join question_bank_questions bq on bq.id=selected.id and bq.unit_id=u.id order by selected.ord loop
  pos:=pos+1;insert into questions(exam_id,text,image_url,page_image_url,points,position) values(e_id,q.text,q.image_url,q.page_image_url,q.points,pos) returning id into q_id;total:=total+q.points;
  for c in select * from question_bank_choices where question_id=q.id order by position loop insert into question_choices(question_id,text,is_correct,position) values(q_id,c.text,c.is_correct,c.position);end loop;
 end loop;
 select jsonb_build_object('examId',e_id,'title',e.title,'description',e.description,'instructions',e.instructions,'durationMinutes',null,'untimed',true,'scoringMode',e.scoring_mode,'questions',jsonb_agg(jsonb_build_object('id',qr.id,'text',qr.text,'imageUrl',qr.image_url,'pageImageUrl',qr.page_image_url,'points',qr.points,'position',qr.position,'choices',(select jsonb_agg(jsonb_build_object('id',cr.id,'text',cr.text,'isCorrect',cr.is_correct,'position',cr.position) order by cr.position) from question_choices cr where cr.question_id=qr.id)) order by qr.position)) into snapshot from exams e join questions qr on qr.exam_id=e.id where e.id=e_id group by e.id;
 insert into exam_versions(exam_id,version,snapshot,total_points) values(e_id,1,snapshot,total) returning id into v_id;update exams set published_version_id=v_id where id=e_id;
 if p_assign_all then insert into exam_assignments(exam_id,student_id) select e_id,en.student_id from teacher_student_enrollments en join student_profiles sp on sp.user_id=en.student_id where en.teacher_id=auth.uid() and en.status='active' and (en.access_expires_at is null or en.access_expires_at>now()) and sp.education_system=u.education_system and (u.education_system='american' or sp.national_grade=u.national_grade) on conflict do nothing;
 else foreach s in array p_student_ids loop if not public.is_active_enrollment(auth.uid(),s) or not public.education_target_matches(u.education_system,u.national_grade,s) then raise exception 'invalid_student';end if;insert into exam_assignments(exam_id,student_id) values(e_id,s) on conflict do nothing;end loop;end if;
 return e_id;
end $$;
revoke all on function public.create_activity_from_questions(uuid,uuid[],text,text,timestamptz,boolean,uuid[]) from public,anon;
grant execute on function public.create_activity_from_questions(uuid,uuid[],text,text,timestamptz,boolean,uuid[]) to authenticated;
