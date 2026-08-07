alter table public.questions add column if not exists page_image_url text;

create or replace function public.create_exam_with_questions(p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_exam_id uuid; v_version_id uuid; q jsonb; c jsonb; q_id uuid; student uuid; snapshot jsonb; total numeric:=0;
begin
 if public.app_current_role()<>'teacher' then raise exception 'forbidden'; end if;
 if coalesce(jsonb_array_length(p_payload->'questions'),0)=0 then raise exception 'questions_required'; end if;
 insert into exams(teacher_id,title,description,instructions,duration_minutes,starts_at,ends_at,status,max_attempts,randomize_questions,randomize_choices,scoring_mode)
 values(auth.uid(),trim(p_payload->>'title'),nullif(trim(p_payload->>'description'),''),nullif(trim(p_payload->>'instructions'),''),(p_payload->>'durationMinutes')::int,nullif(p_payload->>'startsAt','')::timestamptz,nullif(p_payload->>'endsAt','')::timestamptz,case when coalesce((p_payload->>'publish')::boolean,false) then 'published'::record_status else 'draft'::record_status end,(p_payload->>'maxAttempts')::int,coalesce((p_payload->>'randomizeQuestions')::boolean,false),coalesce((p_payload->>'randomizeChoices')::boolean,false),'exact_set') returning id into v_exam_id;
 for q in select * from jsonb_array_elements(p_payload->'questions') loop
  if coalesce(jsonb_array_length(q->'choices'),0)<2 or not exists(select 1 from jsonb_array_elements(q->'choices') x where (x->>'isCorrect')::boolean) then raise exception 'invalid_question'; end if;
  insert into questions(exam_id,text,image_url,page_image_url,points,position) values(v_exam_id,trim(q->>'text'),nullif(trim(q->>'imageUrl'),''),nullif(trim(q->>'pageImageUrl'),''),(q->>'points')::numeric,(q->>'position')::int) returning id into q_id;
  total:=total+(q->>'points')::numeric;
  for c in select * from jsonb_array_elements(q->'choices') loop insert into question_choices(question_id,text,is_correct,position) values(q_id,trim(c->>'text'),(c->>'isCorrect')::boolean,(c->>'position')::int); end loop;
 end loop;
 if coalesce((p_payload->>'publish')::boolean,false) then
  select jsonb_build_object('examId',v_exam_id,'title',e.title,'description',e.description,'instructions',e.instructions,'durationMinutes',e.duration_minutes,'scoringMode',e.scoring_mode,'questions',jsonb_agg(jsonb_build_object('id',qr.id,'text',qr.text,'imageUrl',qr.image_url,'pageImageUrl',qr.page_image_url,'points',qr.points,'position',qr.position,'choices',(select jsonb_agg(jsonb_build_object('id',cr.id,'text',cr.text,'isCorrect',cr.is_correct,'position',cr.position) order by cr.position) from question_choices cr where cr.question_id=qr.id)) order by qr.position)) into snapshot from exams e join questions qr on qr.exam_id=e.id where e.id=v_exam_id group by e.id;
  insert into exam_versions(exam_id,version,snapshot,total_points,passing_score) values(v_exam_id,1,snapshot,total,nullif(p_payload->>'passingScore','')::numeric) returning id into v_version_id;
  update exams set published_version_id=v_version_id where id=v_exam_id;
  if coalesce((p_payload->>'assignAll')::boolean,false) then insert into exam_assignments(exam_id,student_id) select v_exam_id,en.student_id from teacher_student_enrollments en where en.teacher_id=auth.uid() and en.status='active' and (en.access_expires_at is null or en.access_expires_at>now()) on conflict do nothing;
  else for student in select (value #>> '{}')::uuid from jsonb_array_elements(p_payload->'studentIds') loop if not public.is_active_enrollment(auth.uid(),student) then raise exception 'invalid_student'; end if; insert into exam_assignments(exam_id,student_id) values(v_exam_id,student) on conflict do nothing; end loop; end if;
 end if;
 insert into audit_logs(actor_id,actor_role,action,entity_type,entity_id) values(auth.uid(),'teacher',case when coalesce((p_payload->>'publish')::boolean,false) then 'exam.published' else 'exam.created' end,'exam',v_exam_id);
 return v_exam_id;
end $$;

create or replace function public.update_exam_with_questions(p_exam_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_exam exams; v_version_id uuid; v_version int; q jsonb; c jsonb; q_id uuid; student uuid; snapshot jsonb; total numeric:=0;
begin
 select * into v_exam from exams where id=p_exam_id and teacher_id=auth.uid() for update;
 if not found or public.app_current_role()<>'teacher' then raise exception 'forbidden'; end if;
 if coalesce(jsonb_array_length(p_payload->'questions'),0)=0 then raise exception 'questions_required'; end if;
 update exams set title=trim(p_payload->>'title'),description=nullif(trim(p_payload->>'description'),''),instructions=nullif(trim(p_payload->>'instructions'),''),duration_minutes=(p_payload->>'durationMinutes')::int,starts_at=nullif(p_payload->>'startsAt','')::timestamptz,ends_at=nullif(p_payload->>'endsAt','')::timestamptz,status=case when coalesce((p_payload->>'publish')::boolean,false) then 'published'::record_status else 'draft'::record_status end,max_attempts=(p_payload->>'maxAttempts')::int,randomize_questions=coalesce((p_payload->>'randomizeQuestions')::boolean,false),randomize_choices=coalesce((p_payload->>'randomizeChoices')::boolean,false),updated_at=now() where id=p_exam_id;
 delete from questions where exam_id=p_exam_id;
 for q in select * from jsonb_array_elements(p_payload->'questions') loop
  if coalesce(jsonb_array_length(q->'choices'),0)<2 or not exists(select 1 from jsonb_array_elements(q->'choices') x where (x->>'isCorrect')::boolean) then raise exception 'invalid_question'; end if;
  insert into questions(exam_id,text,image_url,page_image_url,points,position) values(p_exam_id,trim(q->>'text'),nullif(trim(q->>'imageUrl'),''),nullif(trim(q->>'pageImageUrl'),''),(q->>'points')::numeric,(q->>'position')::int) returning id into q_id;
  total:=total+(q->>'points')::numeric;
  for c in select * from jsonb_array_elements(q->'choices') loop insert into question_choices(question_id,text,is_correct,position) values(q_id,trim(c->>'text'),(c->>'isCorrect')::boolean,(c->>'position')::int); end loop;
 end loop;
 if coalesce((p_payload->>'publish')::boolean,false) then
  select coalesce(max(version),0)+1 into v_version from exam_versions where exam_id=p_exam_id;
  select jsonb_build_object('examId',p_exam_id,'title',e.title,'description',e.description,'instructions',e.instructions,'durationMinutes',e.duration_minutes,'scoringMode',e.scoring_mode,'questions',jsonb_agg(jsonb_build_object('id',qr.id,'text',qr.text,'imageUrl',qr.image_url,'pageImageUrl',qr.page_image_url,'points',qr.points,'position',qr.position,'choices',(select jsonb_agg(jsonb_build_object('id',cr.id,'text',cr.text,'isCorrect',cr.is_correct,'position',cr.position) order by cr.position) from question_choices cr where cr.question_id=qr.id)) order by qr.position)) into snapshot from exams e join questions qr on qr.exam_id=e.id where e.id=p_exam_id group by e.id;
  insert into exam_versions(exam_id,version,snapshot,total_points,passing_score) values(p_exam_id,v_version,snapshot,total,nullif(p_payload->>'passingScore','')::numeric) returning id into v_version_id;
  update exams set published_version_id=v_version_id where id=p_exam_id;
  if coalesce((p_payload->>'assignAll')::boolean,false) then insert into exam_assignments(exam_id,student_id) select p_exam_id,en.student_id from teacher_student_enrollments en where en.teacher_id=auth.uid() and en.status='active' and (en.access_expires_at is null or en.access_expires_at>now()) on conflict do nothing;
  else for student in select (value #>> '{}')::uuid from jsonb_array_elements(p_payload->'studentIds') loop if not public.is_active_enrollment(auth.uid(),student) then raise exception 'invalid_student'; end if; insert into exam_assignments(exam_id,student_id) values(p_exam_id,student) on conflict do nothing; end loop; end if;
 end if;
 insert into audit_logs(actor_id,actor_role,action,entity_type,entity_id) values(auth.uid(),'teacher','exam.updated','exam',p_exam_id);
 return p_exam_id;
end $$;

revoke all on function public.create_exam_with_questions(jsonb) from public,anon;
revoke all on function public.update_exam_with_questions(uuid,jsonb) from public,anon;
grant execute on function public.create_exam_with_questions(jsonb) to authenticated;
grant execute on function public.update_exam_with_questions(uuid,jsonb) to authenticated;
