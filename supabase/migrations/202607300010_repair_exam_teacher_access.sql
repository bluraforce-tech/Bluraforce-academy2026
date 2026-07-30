alter table public.exams enable row level security;
grant select,insert,update,delete on public.exams to authenticated;

drop policy if exists exams_teacher on public.exams;
drop policy if exists exams_teacher_manage on public.exams;
create policy exams_teacher_manage
on public.exams
for all
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists exams_admin on public.exams;
create policy exams_admin
on public.exams
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists exams_student_assigned on public.exams;
create policy exams_student_assigned
on public.exams
for select
to authenticated
using (
  status = 'published'
  and exists (
    select 1 from public.exam_assignments assignment
    where assignment.exam_id = exams.id
      and assignment.student_id = auth.uid()
      and assignment.revoked_at is null
  )
);
