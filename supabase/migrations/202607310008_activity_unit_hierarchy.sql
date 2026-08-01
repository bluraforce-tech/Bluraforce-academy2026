alter table public.exams add column if not exists source_unit_id uuid references public.question_bank_units(id) on delete set null;
create index if not exists exams_source_unit_idx on public.exams(source_unit_id,kind,status);
-- Preserve existing activities when their teacher has exactly one matching Unit.
update public.exams e set source_unit_id=(select u.id from public.question_bank_units u where u.teacher_id=e.teacher_id and u.education_system=e.education_system and u.national_grade is not distinct from e.national_grade order by u.created_at,u.id limit 1)
where e.kind in ('self_practice','homework') and e.source_unit_id is null and 1=(select count(*) from public.question_bank_units u where u.teacher_id=e.teacher_id and u.education_system=e.education_system and u.national_grade is not distinct from e.national_grade);
create or replace function public.get_student_activities(p_teacher_id uuid) returns jsonb language sql security definer set search_path=public stable as $$
 select coalesce(jsonb_agg(jsonb_build_object('assignmentId',a.id,'title',e.title,'description',e.description,'kind',e.kind,'deadline',e.ends_at,'unitId',u.id,'unitTitle',u.title) order by u.created_at desc,e.created_at desc),'[]'::jsonb)
 from exam_assignments a join exams e on e.id=a.exam_id join question_bank_units u on u.id=e.source_unit_id
 where a.student_id=auth.uid() and a.revoked_at is null and e.teacher_id=p_teacher_id and e.status='published' and e.kind in ('self_practice','homework') and public.is_active_enrollment(p_teacher_id,auth.uid()) and public.education_target_matches(e.education_system,e.national_grade,auth.uid()) and (e.kind='self_practice' or e.ends_at>now());
$$;
revoke all on function public.get_student_activities(uuid) from public,anon;
grant execute on function public.get_student_activities(uuid) to authenticated;
