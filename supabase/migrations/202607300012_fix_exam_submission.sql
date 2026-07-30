-- Fix submission failures caused by PL/pgSQL variable/column ambiguity.
create or replace function public.submit_exam_attempt(p_attempt_id uuid)
returns numeric language plpgsql security definer set search_path = public, extensions as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_question jsonb;
  v_correct_ids text[];
  v_selected_ids text[];
  v_points numeric;
  v_total numeric := 0;
  v_answer_id uuid;
  v_is_correct boolean;
  v_teacher_id uuid;
  v_student_id uuid := auth.uid();
  v_fingerprint text;
begin
  if v_student_id is null then raise exception 'forbidden'; end if;

  select attempt.* into v_attempt
  from public.exam_attempts attempt
  where attempt.id = p_attempt_id and attempt.student_id = v_student_id
  for update;
  if not found then raise exception 'forbidden'; end if;
  if v_attempt.status <> 'in_progress' then return coalesce(v_attempt.score, 0); end if;

  select exam.teacher_id into strict v_teacher_id
  from public.exam_assignments assignment
  join public.exams exam on exam.id = assignment.exam_id
  where assignment.id = v_attempt.assignment_id;

  for v_question in
    select question.value
    from public.exam_versions version
    cross join lateral jsonb_array_elements(version.snapshot->'questions') question(value)
    where version.id = v_attempt.exam_version_id
  loop
    select coalesce(
      array_agg(choice.value->>'id' order by choice.value->>'id')
        filter (where coalesce((choice.value->>'isCorrect')::boolean, false)),
      array[]::text[]
    ) into v_correct_ids
    from jsonb_array_elements(v_question->'choices') choice(value);

    select answer.id into v_answer_id
    from public.attempt_answers answer
    where answer.attempt_id = v_attempt.id
      and answer.question_snapshot_id = v_question->>'id';

    if v_answer_id is null then
      v_selected_ids := array[]::text[];
    else
      select coalesce(
        array_agg(selection.choice_snapshot_id order by selection.choice_snapshot_id),
        array[]::text[]
      ) into v_selected_ids
      from public.attempt_selected_choices selection
      where selection.answer_id = v_answer_id;
    end if;

    v_is_correct := v_selected_ids = v_correct_ids;
    v_points := case when v_is_correct
      then coalesce((v_question->>'points')::numeric, 0) else 0 end;
    v_total := v_total + v_points;

    if v_answer_id is not null then
      update public.attempt_answers answer
      set awarded_points = v_points, is_correct = v_is_correct
      where answer.id = v_answer_id;
    end if;

    v_fingerprint := encode(
      extensions.digest(
        v_teacher_id::text || ':' || (v_question->>'id'),
        'sha256'
      ),
      'hex'
    );
    if not v_is_correct then
      insert into public.mistake_records
        (teacher_id, student_id, source_attempt_id, question_snapshot, fingerprint)
      values
        (v_teacher_id, v_student_id, v_attempt.id, v_question, v_fingerprint)
      on conflict (teacher_id, student_id, fingerprint) do update set
        occurrence_count = public.mistake_records.occurrence_count + 1,
        last_occurred_at = now(),
        source_attempt_id = excluded.source_attempt_id,
        question_snapshot = excluded.question_snapshot,
        resolved_at = null;
    else
      update public.mistake_records mistake set resolved_at = now()
      where mistake.teacher_id = v_teacher_id
        and mistake.student_id = v_student_id
        and mistake.fingerprint = v_fingerprint
        and mistake.resolved_at is null;
    end if;
  end loop;

  update public.exam_attempts attempt set
    status = case when v_attempt.expires_at <= now()
      then 'expired'::public.attempt_status else 'submitted'::public.attempt_status end,
    submitted_at = now(),
    score = v_total
  where attempt.id = v_attempt.id;

  insert into public.audit_logs
    (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values
    (v_student_id, 'student', 'exam.submitted', 'exam_attempt',
     v_attempt.id, jsonb_build_object('score', v_total));
  return v_total;
end;
$$;

revoke all on function public.submit_exam_attempt(uuid) from public, anon;
grant execute on function public.submit_exam_attempt(uuid) to authenticated;
