create or replace function public.get_teacher_exam_results(p_exam_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb;
begin
 if not exists(select 1 from exams where id=p_exam_id and teacher_id=auth.uid()) then raise exception 'forbidden'; end if;
 select jsonb_build_object('examId',e.id,'title',e.title,'results',coalesce((
  select jsonb_agg(jsonb_build_object('attemptId',a.id,'studentName',p.full_name,'attemptNumber',a.attempt_number,
   'status',a.status,'score',a.score,'totalPoints',v.total_points,'startedAt',a.started_at,'submittedAt',a.submitted_at) order by a.created_at desc)
  from exam_assignments x join exam_attempts a on a.assignment_id=x.id join profiles p on p.id=a.student_id
  join exam_versions v on v.id=a.exam_version_id where x.exam_id=e.id),'[]'::jsonb))
 into r from exams e where e.id=p_exam_id; return r;
end $$;

create or replace function public.get_teacher_attempt_result(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb;
begin
 if not exists(select 1 from exam_attempts a join exam_assignments x on x.id=a.assignment_id join exams e on e.id=x.exam_id
  where a.id=p_attempt_id and e.teacher_id=auth.uid()) then raise exception 'forbidden'; end if;
 select jsonb_build_object('examId',e.id,'title',v.snapshot->>'title','studentName',p.full_name,
  'attemptNumber',a.attempt_number,'status',a.status,'score',a.score,'totalPoints',v.total_points,
  'questions',coalesce((select jsonb_agg(jsonb_build_object(
   'id',q.value->>'id','text',q.value->>'text','imageUrl',q.value->>'imageUrl','points',q.value->'points',
   'awardedPoints',coalesce(aa.awarded_points,0),'isCorrect',coalesce(aa.is_correct,false),
   'choices',(select jsonb_agg(jsonb_build_object('id',c.value->>'id','text',c.value->>'text',
    'isCorrect',coalesce((c.value->>'isCorrect')::boolean,false),
    'selected',exists(select 1 from attempt_selected_choices sc where sc.answer_id=aa.id and sc.choice_snapshot_id=c.value->>'id'))
    order by (c.value->>'position')::int) from jsonb_array_elements(q.value->'choices') c(value)))
   order by (q.value->>'position')::int) from jsonb_array_elements(v.snapshot->'questions') q(value)
   left join attempt_answers aa on aa.attempt_id=a.id and aa.question_snapshot_id=q.value->>'id'),'[]'::jsonb))
 into r from exam_attempts a join exam_assignments x on x.id=a.assignment_id join exams e on e.id=x.exam_id
 join exam_versions v on v.id=a.exam_version_id join profiles p on p.id=a.student_id where a.id=p_attempt_id;
 return r;
end $$;
revoke all on function public.get_teacher_exam_results(uuid) from public,anon;
revoke all on function public.get_teacher_attempt_result(uuid) from public,anon;
grant execute on function public.get_teacher_exam_results(uuid) to authenticated;
grant execute on function public.get_teacher_attempt_result(uuid) to authenticated;
