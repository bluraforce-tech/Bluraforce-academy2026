-- Mistakes revision exams are student-owned remediation and are visible immediately.
update public.exam_assignments assignment
set revoked_at = null
from public.exams exam
where exam.id = assignment.exam_id
  and exam.kind = 'mistakes'
  and assignment.revoked_at is not null;

create or replace function public.keep_mistakes_exam_assignments_visible()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.exams
    where id = new.exam_id and kind = 'mistakes'
  ) then
    new.revoked_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists keep_mistakes_exam_assignments_visible on public.exam_assignments;
create trigger keep_mistakes_exam_assignments_visible
before insert or update of exam_id, revoked_at on public.exam_assignments
for each row execute function public.keep_mistakes_exam_assignments_visible();
