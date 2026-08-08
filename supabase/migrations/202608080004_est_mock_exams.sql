-- EST-only mock exam containers. Modules continue to use public.exams and all
-- existing question, attempt, submission, grading, and result tables.
create table public.mock_exams (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references public.teacher_profiles(user_id),
 title text not null check(char_length(title) between 3 and 200),
 description text,
 starts_at timestamptz,
 ends_at timestamptz,
 status public.record_status not null default 'draft',
 education_system public.education_system not null default 'american' check(education_system='american'),
 american_category public.american_category not null default 'est' check(american_category='est'),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(ends_at is null or starts_at is null or ends_at>starts_at)
);
create table public.mock_exam_assignments (
 mock_exam_id uuid not null references public.mock_exams(id) on delete cascade,
 student_id uuid not null references public.student_profiles(user_id),
 created_at timestamptz not null default now(),primary key(mock_exam_id,student_id)
);
alter table public.exams add column parent_mock_exam_id uuid references public.mock_exams(id) on delete cascade;
alter table public.exams add column mock_module_position smallint;
alter table public.exams add constraint exams_mock_module_shape check(
 (parent_mock_exam_id is null and mock_module_position is null) or
 (parent_mock_exam_id is not null and mock_module_position between 1 and 3 and education_system='american' and american_category='est' and kind='standard')
);
create unique index exams_mock_module_position_unique on public.exams(parent_mock_exam_id,mock_module_position) where parent_mock_exam_id is not null;
create index mock_exams_teacher_created_idx on public.mock_exams(teacher_id,created_at desc);
alter table public.mock_exams enable row level security;
alter table public.mock_exam_assignments enable row level security;
create policy mock_exams_teacher on public.mock_exams for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid() and public.app_current_role()='teacher');
create policy mock_exams_student on public.mock_exams for select to authenticated using(status='published' and exists(select 1 from public.mock_exam_assignments a where a.mock_exam_id=mock_exams.id and a.student_id=auth.uid()));
create policy mock_assignments_teacher on public.mock_exam_assignments for all to authenticated using(exists(select 1 from public.mock_exams m where m.id=mock_exam_id and m.teacher_id=auth.uid())) with check(exists(select 1 from public.mock_exams m where m.id=mock_exam_id and m.teacher_id=auth.uid()) and public.is_active_enrollment(auth.uid(),student_id));
create policy mock_assignments_student on public.mock_exam_assignments for select to authenticated using(student_id=auth.uid());
grant select,insert,update,delete on public.mock_exams,public.mock_exam_assignments to authenticated;

create or replace function public.get_student_teacher_portal(p_teacher_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if public.app_current_role()<>'student' or not public.is_active_enrollment(p_teacher_id,auth.uid()) then raise exception 'forbidden'; end if;
 select jsonb_build_object(
  'exams',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',a.id,'title',e.title,'description',e.description,'durationMinutes',e.duration_minutes,'endsAt',e.ends_at,'americanCategory',e.american_category) order by e.created_at desc) from exam_assignments a join exams e on e.id=a.exam_id where a.student_id=auth.uid() and e.teacher_id=p_teacher_id and e.kind='standard' and e.parent_mock_exam_id is null and ((a.revoked_at is null and e.status='published') or exists(select 1 from exam_attempts completed where completed.assignment_id=a.id and completed.student_id=auth.uid() and completed.status in ('submitted','expired')))),'[]'::jsonb),
  'mockExams',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'description',m.description,'endsAt',m.ends_at,'americanCategory',m.american_category,'moduleCount',(select count(*) from exams e where e.parent_mock_exam_id=m.id and e.status='published'),'completedCount',(select count(*) from exams e join exam_assignments a on a.exam_id=e.id where e.parent_mock_exam_id=m.id and e.status='published' and a.student_id=auth.uid() and exists(select 1 from exam_attempts x where x.assignment_id=a.id and x.status in ('submitted','expired'))) ) order by m.created_at desc) from mock_exam_assignments ma join mock_exams m on m.id=ma.mock_exam_id where ma.student_id=auth.uid() and m.teacher_id=p_teacher_id and m.status='published' and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())),'[]'::jsonb),
  'materials',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',a.id,'title',m.title,'description',m.description,'materialType',m.material_type,'availableUntil',m.available_until,'americanCategory',m.american_category) order by m.created_at desc) from material_assignments a join materials m on m.id=a.material_id where a.student_id=auth.uid() and a.revoked_at is null and m.teacher_id=p_teacher_id and m.resource_kind='material_book' and m.status='published' and (m.available_from is null or m.available_from<=now()) and (m.available_until is null or m.available_until>now())),'[]'::jsonb),
  'studyNotes',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',a.id,'title',m.title,'description',m.description,'materialType',m.material_type,'availableUntil',m.available_until,'americanCategory',m.american_category) order by m.created_at desc) from material_assignments a join materials m on m.id=a.material_id where a.student_id=auth.uid() and a.revoked_at is null and m.teacher_id=p_teacher_id and m.resource_kind='study_note' and m.status='published' and (m.available_from is null or m.available_from<=now()) and (m.available_until is null or m.available_until>now())),'[]'::jsonb),
  'videos',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',v.title,'description',v.description,'maxViews',a.max_views,'countedViews',a.counted_views,'remainingViews',case when a.max_views is null then null else greatest(0,a.max_views-a.counted_views) end,'viewLimitReached',a.max_views is not null and a.counted_views>=a.max_views,'availableUntil',a.available_until,'americanCategory',v.american_category) order by v.position nulls last,v.created_at desc) from video_assignments a join lesson_videos v on v.id=a.video_id where a.student_id=auth.uid() and a.revoked_at is null and v.teacher_id=p_teacher_id and v.status='published' and (a.available_from is null or a.available_from<=now()) and (a.available_until is null or a.available_until>now())),'[]'::jsonb)
 ) into result;return result;
end $$;
revoke all on function public.get_student_teacher_portal(uuid) from public,anon;
grant execute on function public.get_student_teacher_portal(uuid) to authenticated;
