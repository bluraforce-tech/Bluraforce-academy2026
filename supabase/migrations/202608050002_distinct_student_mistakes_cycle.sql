-- Generate one private revision exam per student after each three distinct
-- standard exams completed for the same teacher.
-- Normalize legacy attempt-based checkpoints to fixed three-exam cycles.
with ranked as (
 select id,row_number() over(partition by teacher_id,student_id order by processed_at,id) as cycle
 from public.mistake_exam_checkpoints
)
update public.mistake_exam_checkpoints checkpoint
set submitted_standard_count = -ranked.cycle
from ranked where ranked.id=checkpoint.id;

update public.mistake_exam_checkpoints
set submitted_standard_count = -submitted_standard_count*3
where submitted_standard_count<0;

create or replace function public.get_student_mistakes_exams(p_teacher_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_student uuid:=auth.uid(); v_interval int:=3; v_max int:=20; v_include_resolved boolean:=false;
 v_completed int; v_checkpoint int:=0; v_exam uuid; v_version uuid; v_snapshot jsonb;
 v_questions jsonb; v_total numeric; v_count int;
begin
 if public.app_current_role()<>'student' or not public.is_active_enrollment(p_teacher_id,v_student)
 then raise exception 'forbidden'; end if;

 -- Serialize generation for this exact teacher/student pair.
 perform pg_advisory_xact_lock(hashtextextended(p_teacher_id::text||':'||v_student::text,0));

 select coalesce((select s.mistakes_max_questions from teacher_settings s where s.teacher_id=p_teacher_id),20),
  coalesce((select s.include_resolved_mistakes from teacher_settings s where s.teacher_id=p_teacher_id),false)
 into v_max,v_include_resolved;

 select count(distinct e.id) into v_completed
 from exam_attempts a
 join exam_assignments x on x.id=a.assignment_id
 join exams e on e.id=x.exam_id
 where a.student_id=v_student and e.teacher_id=p_teacher_id
  and e.kind='standard' and a.status in ('submitted','expired');

 select coalesce(max(submitted_standard_count),0) into v_checkpoint
 from mistake_exam_checkpoints
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
   insert into exam_versions(exam_id,version,snapshot,total_points)
    values(v_exam,1,v_snapshot,v_total) returning id into v_version;
   update exams set published_version_id=v_version where id=v_exam;
   insert into exam_assignments(exam_id,student_id,revoked_at) values(v_exam,v_student,null);
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
