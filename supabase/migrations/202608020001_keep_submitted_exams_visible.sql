create or replace function public.get_student_teacher_portal(p_teacher_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if public.app_current_role()<>'student' or not public.is_active_enrollment(p_teacher_id,auth.uid()) then raise exception 'forbidden'; end if;
 select jsonb_build_object(
  'exams',coalesce((
    select jsonb_agg(jsonb_build_object('assignmentId',a.id,'title',e.title,'description',e.description,'durationMinutes',e.duration_minutes,'endsAt',e.ends_at,'americanCategory',e.american_category) order by e.created_at desc)
    from exam_assignments a join exams e on e.id=a.exam_id
    where a.student_id=auth.uid() and e.teacher_id=p_teacher_id and e.kind='standard'
      and ((a.revoked_at is null and e.status='published') or exists (
        select 1 from exam_attempts completed where completed.assignment_id=a.id and completed.student_id=auth.uid() and completed.status in ('submitted','expired')
      ))
  ),'[]'::jsonb),
  'materials',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',a.id,'title',m.title,'description',m.description,'materialType',m.material_type,'availableUntil',m.available_until,'americanCategory',m.american_category) order by m.created_at desc) from material_assignments a join materials m on m.id=a.material_id where a.student_id=auth.uid() and a.revoked_at is null and m.teacher_id=p_teacher_id and m.resource_kind='material_book' and m.status='published' and (m.available_from is null or m.available_from<=now()) and (m.available_until is null or m.available_until>now())),'[]'::jsonb),
  'studyNotes',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',a.id,'title',m.title,'description',m.description,'materialType',m.material_type,'availableUntil',m.available_until,'americanCategory',m.american_category) order by m.created_at desc) from material_assignments a join materials m on m.id=a.material_id where a.student_id=auth.uid() and a.revoked_at is null and m.teacher_id=p_teacher_id and m.resource_kind='study_note' and m.status='published' and (m.available_from is null or m.available_from<=now()) and (m.available_until is null or m.available_until>now())),'[]'::jsonb),
  'videos',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',v.title,'description',v.description,'maxViews',a.max_views,'countedViews',a.counted_views,'remainingViews',case when a.max_views is null then null else greatest(0,a.max_views-a.counted_views) end,'viewLimitReached',a.max_views is not null and a.counted_views>=a.max_views,'availableUntil',a.available_until,'americanCategory',v.american_category) order by v.position nulls last,v.created_at desc) from video_assignments a join lesson_videos v on v.id=a.video_id where a.student_id=auth.uid() and a.revoked_at is null and v.teacher_id=p_teacher_id and v.status='published' and (a.available_from is null or a.available_from<=now()) and (a.available_until is null or a.available_until>now())),'[]'::jsonb)
 ) into result;
 return result;
end $$;

revoke all on function public.get_student_teacher_portal(uuid) from public,anon;
grant execute on function public.get_student_teacher_portal(uuid) to authenticated;
