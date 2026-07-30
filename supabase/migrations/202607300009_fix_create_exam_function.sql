-- Replaces the original function to avoid PL/pgSQL ambiguity between the
-- local exam identifier and table columns named exam_id.
create or replace function public.create_exam_with_questions(p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_exam_id uuid; v_version_id uuid; q jsonb; c jsonb; q_id uuid; student uuid; snapshot jsonb; total numeric:=0;
begin
 if public.app_current_role()<>'teacher' then raise exception 'forbidden'; end if;
 if coalesce(jsonb_array_length(p_payload->'questions'),0)=0 then raise exception 'questions_required'; end if;
 insert into exams(teacher_id,title,description,instructions,duration_minutes,starts_at,ends_at,status,max_attempts,randomize_questions,randomize_choices,scoring_mode)
 values(auth.uid(),trim(p_payload->>'title'),nullif(trim(p_payload->>'description'),''),nullif(trim(p_payload->>'instructions'),''),(p_payload->>'durationMinutes')::int,
 nullif(p_payload->>'startsAt','')::timestamptz,nullif(p_payload->>'endsAt','')::timestamptz,
 case when coalesce((p_payload->>'publish')::boolean,false) then 'published'::record_status else 'draft'::record_status end,
 (p_payload->>'maxAttempts')::int,coalesce((p_payload->>'randomizeQuestions')::boolean,false),coalesce((p_payload->>'randomizeChoices')::boolean,false),'exact_set')
 returning id into v_exam_id;
 for q in select * from jsonb_array_elements(p_payload->'questions') loop
  if coalesce(jsonb_array_length(q->'choices'),0)<2 or not exists(select 1 from jsonb_array_elements(q->'choices') x where (x->>'isCorrect')::boolean) then raise exception 'invalid_question'; end if;
  insert into questions(exam_id,text,image_url,points,position) values(v_exam_id,trim(q->>'text'),nullif(trim(q->>'imageUrl'),''),(q->>'points')::numeric,(q->>'position')::int) returning id into q_id;
  total:=total+(q->>'points')::numeric;
  for c in select * from jsonb_array_elements(q->'choices') loop
   insert into question_choices(question_id,text,is_correct,position) values(q_id,trim(c->>'text'),(c->>'isCorrect')::boolean,(c->>'position')::int);
  end loop;
 end loop;
 if coalesce((p_payload->>'publish')::boolean,false) then
  select jsonb_build_object('examId',v_exam_id,'title',e.title,'description',e.description,'instructions',e.instructions,'durationMinutes',e.duration_minutes,'scoringMode',e.scoring_mode,
   'questions',jsonb_agg(jsonb_build_object('id',question_row.id,'text',question_row.text,'imageUrl',question_row.image_url,'points',question_row.points,'position',question_row.position,
    'choices',(select jsonb_agg(jsonb_build_object('id',choice_row.id,'text',choice_row.text,'isCorrect',choice_row.is_correct,'position',choice_row.position) order by choice_row.position) from question_choices choice_row where choice_row.question_id=question_row.id)) order by question_row.position))
  into snapshot from exams e join questions question_row on question_row.exam_id=e.id where e.id=v_exam_id group by e.id;
  insert into exam_versions(exam_id,version,snapshot,total_points,passing_score) values(v_exam_id,1,snapshot,total,nullif(p_payload->>'passingScore','')::numeric) returning id into v_version_id;
  update exams set published_version_id=v_version_id where id=v_exam_id;
  if coalesce((p_payload->>'assignAll')::boolean,false) then
   insert into exam_assignments(exam_id,student_id) select v_exam_id,enrollment.student_id from teacher_student_enrollments enrollment where enrollment.teacher_id=auth.uid() and enrollment.status='active' and (enrollment.access_expires_at is null or enrollment.access_expires_at>now()) on conflict do nothing;
  else
   for student in select (value #>> '{}')::uuid from jsonb_array_elements(p_payload->'studentIds') loop
    if not public.is_active_enrollment(auth.uid(),student) then raise exception 'invalid_student'; end if;
    insert into exam_assignments(exam_id,student_id) values(v_exam_id,student) on conflict do nothing;
   end loop;
  end if;
 end if;
 insert into audit_logs(actor_id,actor_role,action,entity_type,entity_id) values(auth.uid(),'teacher',case when coalesce((p_payload->>'publish')::boolean,false) then 'exam.published' else 'exam.created' end,'exam',v_exam_id);
 return v_exam_id;
end $$;
revoke all on function public.create_exam_with_questions(jsonb) from public,anon;
grant execute on function public.create_exam_with_questions(jsonb) to authenticated;
