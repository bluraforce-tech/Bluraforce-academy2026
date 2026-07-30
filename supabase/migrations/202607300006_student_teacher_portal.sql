create or replace function public.get_student_teacher_portal(p_teacher_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if public.app_current_role()<>'student' or not public.is_active_enrollment(p_teacher_id,auth.uid()) then raise exception 'forbidden'; end if;
 select jsonb_build_object(
  'examCount',(select count(*) from exam_assignments a join exams e on e.id=a.exam_id where a.student_id=auth.uid() and a.revoked_at is null and e.teacher_id=p_teacher_id and e.status='published'),
  'materialCount',(select count(*) from material_assignments a join materials m on m.id=a.material_id where a.student_id=auth.uid() and a.revoked_at is null and m.teacher_id=p_teacher_id and m.status='published'),
  'videos',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',v.title,'maxViews',a.max_views,'countedViews',a.counted_views) order by v.position nulls last,v.created_at desc)
   from video_assignments a join lesson_videos v on v.id=a.video_id where a.student_id=auth.uid() and a.revoked_at is null and v.teacher_id=p_teacher_id and v.status='published'
   and (a.available_from is null or a.available_from<=now()) and (a.available_until is null or a.available_until>now())
   and (a.max_views is null or a.counted_views<a.max_views)),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.get_student_teacher_portal(uuid) from public,anon;
grant execute on function public.get_student_teacher_portal(uuid) to authenticated;
