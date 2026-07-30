create or replace function public.get_student_mistakes_exams(p_teacher_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_student uuid:=auth.uid(); v_interval int:=3; v_max int:=20; v_include_resolved boolean:=false;
 v_completed int; v_checkpoint int:=0; v_exam uuid; v_version uuid; v_snapshot jsonb;
 v_questions jsonb; v_total numeric; v_count int;
begin
 if public.app_current_role()<>'student' or not public.is_active_enrollment(p_teacher_id,v_student)
 then raise exception 'forbidden'; end if;
 select coalesce((select s.mistakes_exam_interval from teacher_settings s where s.teacher_id=p_teacher_id),3),
  coalesce((select s.mistakes_max_questions from teacher_settings s where s.teacher_id=p_teacher_id),20),
  coalesce((select s.include_resolved_mistakes from teacher_settings s where s.teacher_id=p_teacher_id),false)
 into v_interval,v_max,v_include_resolved;
 select count(*) into v_completed from exam_attempts a join exam_assignments x on x.id=a.assignment_id
 join exams e on e.id=x.exam_id where a.student_id=v_student and e.teacher_id=p_teacher_id
 and e.kind='standard' and a.status in ('submitted','expired');
 select coalesce(max(submitted_standard_count),0) into v_checkpoint from mistake_exam_checkpoints
 where teacher_id=p_teacher_id and student_id=v_student;

 if v_completed>=v_checkpoint+v_interval then
  select jsonb_agg(m.question_snapshot order by m.last_occurred_at desc),
   coalesce(sum((m.question_snapshot->>'points')::numeric),0),count(*)
  into v_questions,v_total,v_count from (
   select * from mistake_records where teacher_id=p_teacher_id and student_id=v_student
   and (v_include_resolved or resolved_at is null) order by last_occurred_at desc limit v_max
  ) m;
  if v_count>0 then
   insert into exams(teacher_id,title,description,instructions,kind,status,duration_minutes,starts_at,ends_at,
    max_attempts,randomize_questions,randomize_choices)
   values(p_teacher_id,'Mistakes revision exam','Automatically generated from your previous mistakes.',
    'Review your previous mistakes and choose the correct answers.','mistakes','published',
    greatest(10,least(600,v_count*2)),now(),now()+interval '30 days',1,true,true)
   returning id into v_exam;
   v_snapshot:=jsonb_build_object('examId',v_exam,'title','Mistakes revision exam',
    'description','Automatically generated from your previous mistakes.',
    'instructions','Review your previous mistakes and choose the correct answers.',
    'durationMinutes',greatest(10,least(600,v_count*2)),'scoringMode','exact_set','questions',v_questions);
   insert into exam_versions(exam_id,version,snapshot,total_points) values(v_exam,1,v_snapshot,v_total) returning id into v_version;
   update exams set published_version_id=v_version where id=v_exam;
   insert into exam_assignments(exam_id,student_id) values(v_exam,v_student);
   insert into mistake_exam_checkpoints(teacher_id,student_id,submitted_standard_count,generated_exam_id)
   values(p_teacher_id,v_student,v_completed,v_exam) on conflict do nothing;
  end if;
 end if;

 return coalesce((select jsonb_agg(jsonb_build_object(
  'assignmentId',x.id,'title',e.title,'description',e.description,'durationMinutes',e.duration_minutes,
  'endsAt',e.ends_at,'createdAt',e.created_at) order by e.created_at desc)
  from exam_assignments x join exams e on e.id=x.exam_id
  where x.student_id=v_student and x.revoked_at is null and e.teacher_id=p_teacher_id
  and e.kind='mistakes' and e.status='published'),'[]'::jsonb);
end $$;

revoke all on function public.get_student_mistakes_exams(uuid) from public,anon;
grant execute on function public.get_student_mistakes_exams(uuid) to authenticated;

create or replace function public.generate_mistakes_exam_after_submission()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_teacher uuid; v_kind text;
begin
 if old.status='in_progress' and new.status in ('submitted','expired') then
  select e.teacher_id,e.kind into v_teacher,v_kind from exam_assignments x
  join exams e on e.id=x.exam_id where x.id=new.assignment_id;
  if v_kind='standard' then perform public.get_student_mistakes_exams(v_teacher); end if;
 end if;
 return new;
end $$;
drop trigger if exists generate_mistakes_exam_after_submission on public.exam_attempts;
create trigger generate_mistakes_exam_after_submission
after update of status on public.exam_attempts for each row
execute function public.generate_mistakes_exam_after_submission();

-- Keep automatically generated revision exams out of the normal Exams section.
create or replace function public.get_student_teacher_portal(p_teacher_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if public.app_current_role()<>'student' or not public.is_active_enrollment(p_teacher_id,auth.uid()) then raise exception 'forbidden'; end if;
 select jsonb_build_object(
  'exams',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',a.id,'title',e.title,'description',e.description,'durationMinutes',e.duration_minutes,'endsAt',e.ends_at) order by e.created_at desc) from exam_assignments a join exams e on e.id=a.exam_id where a.student_id=auth.uid() and a.revoked_at is null and e.teacher_id=p_teacher_id and e.status='published' and e.kind='standard'),'[]'::jsonb),
  'materials',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',a.id,'title',m.title,'description',m.description,'materialType',m.material_type,'availableUntil',m.available_until) order by m.created_at desc) from material_assignments a join materials m on m.id=a.material_id where a.student_id=auth.uid() and a.revoked_at is null and m.teacher_id=p_teacher_id and m.status='published' and (m.available_from is null or m.available_from<=now()) and (m.available_until is null or m.available_until>now())),'[]'::jsonb),
  'videos',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',v.title,'description',v.description,'maxViews',a.max_views,'countedViews',a.counted_views,'availableUntil',a.available_until) order by v.position nulls last,v.created_at desc) from video_assignments a join lesson_videos v on v.id=a.video_id where a.student_id=auth.uid() and a.revoked_at is null and v.teacher_id=p_teacher_id and v.status='published' and (a.available_from is null or a.available_from<=now()) and (a.available_until is null or a.available_until>now()) and (a.max_views is null or a.counted_views<a.max_views)),'[]'::jsonb)
 ) into result; return result;
end $$;
