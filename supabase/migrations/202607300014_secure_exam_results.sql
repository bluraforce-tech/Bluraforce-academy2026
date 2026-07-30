drop policy if exists mistakes_student on public.mistake_records;
create policy mistakes_student on public.mistake_records for select to authenticated
using (
  student_id = auth.uid() and exists (
    select 1 from public.exam_attempts a
    join public.exam_assignments x on x.id = a.assignment_id
    join public.exams e on e.id = x.exam_id
    where a.id = mistake_records.source_attempt_id
      and e.ends_at is not null and e.ends_at <= now()
  )
);

create or replace function public.get_student_exam_result(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if not exists (
    select 1 from public.exam_attempts a
    join public.exam_assignments x on x.id = a.assignment_id
    join public.exams e on e.id = x.exam_id
    where a.id = p_attempt_id and a.student_id = auth.uid()
      and a.status <> 'in_progress'
      and e.ends_at is not null and e.ends_at <= now()
  ) then raise exception 'results_unavailable'; end if;

  select jsonb_build_object(
    'attemptId',a.id,'teacherId',e.teacher_id,'title',v.snapshot->>'title',
    'score',a.score,'totalPoints',v.total_points,
    'questions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',q.value->>'id','text',q.value->>'text','imageUrl',q.value->>'imageUrl',
        'points',q.value->'points','awardedPoints',coalesce(aa.awarded_points,0),
        'isCorrect',coalesce(aa.is_correct,false),
        'choices',(select jsonb_agg(jsonb_build_object(
          'id',c.value->>'id','text',c.value->>'text',
          'isCorrect',coalesce((c.value->>'isCorrect')::boolean,false),
          'selected',exists(select 1 from public.attempt_selected_choices sc
            where sc.answer_id=aa.id and sc.choice_snapshot_id=c.value->>'id')
        ) order by (c.value->>'position')::int)
        from jsonb_array_elements(q.value->'choices') c(value))
      ) order by (q.value->>'position')::int)
      from jsonb_array_elements(v.snapshot->'questions') q(value)
      left join public.attempt_answers aa on aa.attempt_id=a.id
        and aa.question_snapshot_id=q.value->>'id'
    ),'[]'::jsonb)
  ) into v_result
  from public.exam_attempts a
  join public.exam_assignments x on x.id=a.assignment_id
  join public.exams e on e.id=x.exam_id
  join public.exam_versions v on v.id=a.exam_version_id
  where a.id=p_attempt_id and a.student_id=auth.uid();
  return v_result;
end $$;

revoke all on function public.get_student_exam_result(uuid) from public,anon;
grant execute on function public.get_student_exam_result(uuid) to authenticated;
