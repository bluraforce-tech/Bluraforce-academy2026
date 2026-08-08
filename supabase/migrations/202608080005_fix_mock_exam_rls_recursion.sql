create or replace function public.teacher_owns_mock_exam(p_mock_exam_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.mock_exams m where m.id=p_mock_exam_id and m.teacher_id=auth.uid())
$$;
create or replace function public.student_is_assigned_mock_exam(p_mock_exam_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.mock_exam_assignments a where a.mock_exam_id=p_mock_exam_id and a.student_id=auth.uid())
$$;
revoke all on function public.teacher_owns_mock_exam(uuid) from public,anon;
revoke all on function public.student_is_assigned_mock_exam(uuid) from public,anon;
grant execute on function public.teacher_owns_mock_exam(uuid),public.student_is_assigned_mock_exam(uuid) to authenticated;
drop policy if exists mock_exams_student on public.mock_exams;
create policy mock_exams_student on public.mock_exams for select to authenticated using(status='published' and public.student_is_assigned_mock_exam(id));
drop policy if exists mock_assignments_teacher on public.mock_exam_assignments;
create policy mock_assignments_teacher on public.mock_exam_assignments for all to authenticated
using(public.teacher_owns_mock_exam(mock_exam_id))
with check(public.teacher_owns_mock_exam(mock_exam_id) and public.is_active_enrollment(auth.uid(),student_id));
