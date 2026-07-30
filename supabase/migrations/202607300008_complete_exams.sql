alter table public.exams add column if not exists scoring_mode text not null default 'exact_set'
check(scoring_mode in ('exact_set','partial'));

create or replace function public.create_exam_with_questions(p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_exam_id uuid; v_version_id uuid; q jsonb; c jsonb; q_id uuid; student uuid; snapshot jsonb; total numeric:=0;
begin
 if public.app_current_role()<>'teacher' then raise exception 'forbidden'; end if;
 if coalesce(jsonb_array_length(p_payload->'questions'),0)=0 then raise exception 'questions_required'; end if;
 insert into exams(teacher_id,title,description,instructions,duration_minutes,starts_at,ends_at,status,max_attempts,randomize_questions,randomize_choices,scoring_mode)
 values(auth.uid(),trim(p_payload->>'title'),nullif(trim(p_payload->>'description'),''),nullif(trim(p_payload->>'instructions'),''),
 (p_payload->>'durationMinutes')::int,nullif(p_payload->>'startsAt','')::timestamptz,nullif(p_payload->>'endsAt','')::timestamptz,
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
   'questions',jsonb_agg(jsonb_build_object('id',q.id,'text',q.text,'imageUrl',q.image_url,'points',q.points,'position',q.position,
    'choices',(select jsonb_agg(jsonb_build_object('id',c.id,'text',c.text,'isCorrect',c.is_correct,'position',c.position) order by c.position) from question_choices c where c.question_id=q.id)) order by q.position))
  into snapshot from exams e join questions q on q.exam_id=e.id where e.id=v_exam_id group by e.id;
  insert into exam_versions(exam_id,version,snapshot,total_points,passing_score) values(v_exam_id,1,snapshot,total,nullif(p_payload->>'passingScore','')::numeric) returning id into v_version_id;
  update exams set published_version_id=v_version_id where id=v_exam_id;
  if coalesce((p_payload->>'assignAll')::boolean,false) then
   insert into exam_assignments(exam_id,student_id) select v_exam_id,e.student_id from teacher_student_enrollments e where e.teacher_id=auth.uid() and e.status='active' and (e.access_expires_at is null or e.access_expires_at>now()) on conflict do nothing;
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

create or replace function public.get_attempt_payload(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a exam_attempts; s jsonb;
begin
 select * into a from exam_attempts where id=p_attempt_id and student_id=auth.uid();
 if not found then raise exception 'forbidden'; end if;
 if a.status='in_progress' and a.expires_at<=now() then perform public.submit_exam_attempt(p_attempt_id); select * into a from exam_attempts where id=p_attempt_id; end if;
 select jsonb_build_object('attemptId',a.id,'startedAt',a.started_at,'expiresAt',a.expires_at,'status',a.status,'score',a.score,
  'exam',jsonb_build_object('title',v.snapshot->>'title','description',v.snapshot->>'description','instructions',v.snapshot->>'instructions',
   'questions',(select jsonb_agg(jsonb_build_object('id',q->>'id','text',q->>'text','imageUrl',q->>'imageUrl','points',q->'points',
    'multiple',(select count(*)>1 from jsonb_array_elements(q->'choices') cc where (cc->>'isCorrect')::boolean),
    'choices',(select jsonb_agg(jsonb_build_object('id',c->>'id','text',c->>'text','position',c->'position') order by (c->>'position')::int) from jsonb_array_elements(q->'choices') c)) order by (q->>'position')::int) from jsonb_array_elements(v.snapshot->'questions') q)),
  'answers',coalesce((select jsonb_object_agg(aa.question_snapshot_id,(select jsonb_agg(sc.choice_snapshot_id) from attempt_selected_choices sc where sc.answer_id=aa.id)) from attempt_answers aa where aa.attempt_id=a.id),'{}'::jsonb))
 into s from exam_versions v where v.id=a.exam_version_id;
 return s;
end $$;

create or replace function public.save_attempt_answer(p_attempt_id uuid,p_question_id text,p_choice_ids text[])
returns void language plpgsql security definer set search_path=public as $$
declare a exam_attempts; v_answer_id uuid; valid_count int;
begin
 select * into a from exam_attempts where id=p_attempt_id and student_id=auth.uid() for update;
 if not found then raise exception 'forbidden'; end if;
 if a.status<>'in_progress' or a.expires_at<=now() then raise exception 'attempt_closed'; end if;
 select count(*) into valid_count from exam_versions v,jsonb_array_elements(v.snapshot->'questions') q,jsonb_array_elements(q->'choices') c
 where v.id=a.exam_version_id and q->>'id'=p_question_id and c->>'id'=any(p_choice_ids);
 if valid_count<>cardinality(p_choice_ids) then raise exception 'invalid_choices'; end if;
 insert into attempt_answers(attempt_id,question_snapshot_id) values(p_attempt_id,p_question_id)
 on conflict(attempt_id,question_snapshot_id) do update set answered_at=now() returning id into v_answer_id;
 delete from attempt_selected_choices where answer_id=v_answer_id;
 insert into attempt_selected_choices(answer_id,choice_snapshot_id) select v_answer_id,unnest(p_choice_ids);
end $$;

create or replace function public.submit_exam_attempt(p_attempt_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare a exam_attempts; q jsonb; correct text[]; selected text[]; pts numeric; total numeric:=0; answer_id uuid; is_right boolean; teacher uuid;
begin
 select * into a from exam_attempts where id=p_attempt_id and student_id=auth.uid() for update;
 if not found then raise exception 'forbidden'; end if;
 if a.status<>'in_progress' then return coalesce(a.score,0); end if;
 select e.teacher_id into teacher from exam_assignments x join exams e on e.id=x.exam_id where x.id=a.assignment_id;
 for q in select value from exam_versions v,jsonb_array_elements(v.snapshot->'questions') where v.id=a.exam_version_id loop
  select array_agg(c->>'id' order by c->>'id') into correct from jsonb_array_elements(q->'choices') c where (c->>'isCorrect')::boolean;
  select aa.id,array_agg(sc.choice_snapshot_id order by sc.choice_snapshot_id) into answer_id,selected from attempt_answers aa left join attempt_selected_choices sc on sc.answer_id=aa.id where aa.attempt_id=a.id and aa.question_snapshot_id=q->>'id' group by aa.id;
  is_right:=coalesce(selected,'{}'::text[])=coalesce(correct,'{}'::text[]); pts:=case when is_right then (q->>'points')::numeric else 0 end; total:=total+pts;
  if answer_id is not null then update attempt_answers set awarded_points=pts,is_correct=is_right where id=answer_id; end if;
  if not is_right then insert into mistake_records(teacher_id,student_id,source_attempt_id,question_snapshot,fingerprint) values(teacher,auth.uid(),a.id,q,encode(digest(teacher::text||':'||(q->>'id'),'sha256'),'hex')) on conflict(teacher_id,student_id,fingerprint) do update set occurrence_count=mistake_records.occurrence_count+1,last_occurred_at=now(),source_attempt_id=a.id,question_snapshot=q; end if;
 end loop;
 update exam_attempts set status=case when expires_at<=now() then 'expired' else 'submitted' end,submitted_at=now(),score=total where id=a.id;
 insert into audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata) values(auth.uid(),'student','exam.submitted','exam_attempt',a.id,jsonb_build_object('score',total));
 return total;
end $$;

revoke all on function public.create_exam_with_questions(jsonb) from public,anon;
grant execute on function public.create_exam_with_questions(jsonb) to authenticated;
revoke all on function public.get_attempt_payload(uuid) from public,anon;
grant execute on function public.get_attempt_payload(uuid) to authenticated;
revoke all on function public.save_attempt_answer(uuid,text,text[]) from public,anon;
grant execute on function public.save_attempt_answer(uuid,text,text[]) to authenticated;
revoke all on function public.submit_exam_attempt(uuid) from public,anon;
grant execute on function public.submit_exam_attempt(uuid) to authenticated;
