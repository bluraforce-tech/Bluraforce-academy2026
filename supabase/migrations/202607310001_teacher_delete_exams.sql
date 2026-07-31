create or replace function public.delete_teacher_exam(p_exam_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
begin
  select teacher_id into v_teacher_id
  from public.exams
  where id = p_exam_id;

  if auth.uid() is null or v_teacher_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  -- Break the circular exam/version reference before removing dependent data.
  update public.exams
  set published_version_id = null
  where id = p_exam_id;

  delete from public.mistake_exam_checkpoints
  where generated_exam_id = p_exam_id;

  delete from public.mistake_records
  where source_attempt_id in (
    select attempt.id
    from public.exam_attempts attempt
    join public.exam_assignments assignment on assignment.id = attempt.assignment_id
    where assignment.exam_id = p_exam_id
  );

  delete from public.exam_attempts
  where assignment_id in (
    select id from public.exam_assignments where exam_id = p_exam_id
  );

  delete from public.exam_assignments where exam_id = p_exam_id;
  delete from public.exam_versions where exam_id = p_exam_id;
  delete from public.exams where id = p_exam_id;

  insert into public.audit_logs(actor_id, actor_role, action, entity_type, entity_id)
  values (auth.uid(), 'teacher', 'exam.deleted', 'exam', p_exam_id);
end;
$$;

revoke all on function public.delete_teacher_exam(uuid) from public, anon;
grant execute on function public.delete_teacher_exam(uuid) to authenticated;
