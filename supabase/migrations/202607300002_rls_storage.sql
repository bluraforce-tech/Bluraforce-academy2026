-- Every application table is deny-by-default once RLS is enabled.
alter table profiles enable row level security;
alter table teacher_profiles enable row level security;
alter table student_profiles enable row level security;
alter table teacher_student_enrollments enable row level security;
alter table student_invitation_codes enable row level security;
alter table teacher_settings enable row level security;
alter table platform_settings enable row level security;
alter table exams enable row level security;
alter table exam_versions enable row level security;
alter table questions enable row level security;
alter table question_choices enable row level security;
alter table exam_assignments enable row level security;
alter table exam_attempts enable row level security;
alter table attempt_answers enable row level security;
alter table attempt_selected_choices enable row level security;
alter table mistake_records enable row level security;
alter table mistake_exam_checkpoints enable row level security;
alter table lesson_videos enable row level security;
alter table video_assignments enable row level security;
alter table video_view_sessions enable row level security;
alter table materials enable row level security;
alter table material_assignments enable row level security;
alter table admin_notifications enable row level security;
alter table audit_logs enable row level security;

create policy profiles_admin_all on profiles for all to authenticated using(is_admin()) with check(is_admin());
create policy profiles_self_read on profiles for select to authenticated using(id=auth.uid());
create policy profiles_self_safe_update on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid() and role=app_current_role());
create policy profiles_teacher_students on profiles for select to authenticated using(
 app_current_role()='teacher' and exists(select 1 from teacher_student_enrollments e where e.teacher_id=auth.uid() and e.student_id=profiles.id and e.status='active'));

create policy active_teachers_public on teacher_profiles for select to authenticated using(is_active or is_admin() or user_id=auth.uid());
create policy teachers_admin_write on teacher_profiles for all to authenticated using(is_admin()) with check(is_admin());
create policy students_admin_all on student_profiles for all to authenticated using(is_admin()) with check(is_admin());
create policy students_self_read on student_profiles for select to authenticated using(user_id=auth.uid());
create policy students_teacher_read on student_profiles for select to authenticated using(app_current_role()='teacher' and exists(
 select 1 from teacher_student_enrollments e where e.teacher_id=auth.uid() and e.student_id=student_profiles.user_id and e.status='active'));
create policy students_self_update on student_profiles for update to authenticated using(user_id=auth.uid())
 with check(user_id=auth.uid()); -- column grants below prevent identity-field edits.
revoke update on student_profiles from authenticated;
grant update(address,mobile,guardian_mobile) on student_profiles to authenticated;

create policy enrollment_admin_all on teacher_student_enrollments for all to authenticated using(is_admin()) with check(is_admin());
create policy enrollment_teacher_read on teacher_student_enrollments for select to authenticated using(teacher_id=auth.uid());
create policy enrollment_student_read on teacher_student_enrollments for select to authenticated using(student_id=auth.uid());
create policy codes_admin_all on student_invitation_codes for all to authenticated using(is_admin()) with check(is_admin());
create policy codes_teacher_all on student_invitation_codes for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid() and created_by=auth.uid());
create policy teacher_settings_admin on teacher_settings for all to authenticated using(is_admin()) with check(is_admin());
create policy teacher_settings_own on teacher_settings for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
create policy platform_settings_admin on platform_settings for all to authenticated using(is_admin()) with check(is_admin());

create policy exams_admin on exams for all to authenticated using(is_admin()) with check(is_admin());
create policy exams_teacher on exams for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
create policy exams_student_assigned on exams for select to authenticated using(status='published' and exists(
 select 1 from exam_assignments a where a.exam_id=exams.id and a.student_id=auth.uid() and a.revoked_at is null));
create policy versions_admin on exam_versions for all to authenticated using(is_admin()) with check(is_admin());
create policy versions_teacher on exam_versions for all to authenticated using(exists(select 1 from exams e where e.id=exam_versions.exam_id and e.teacher_id=auth.uid()))
 with check(exists(select 1 from exams e where e.id=exam_versions.exam_id and e.teacher_id=auth.uid()));
create policy questions_admin on questions for all to authenticated using(is_admin()) with check(is_admin());
create policy questions_teacher on questions for all to authenticated using(exists(select 1 from exams e where e.id=questions.exam_id and e.teacher_id=auth.uid()))
 with check(exists(select 1 from exams e where e.id=questions.exam_id and e.teacher_id=auth.uid()));
create policy choices_admin on question_choices for all to authenticated using(is_admin()) with check(is_admin());
create policy choices_teacher on question_choices for all to authenticated using(exists(select 1 from questions q join exams e on e.id=q.exam_id where q.id=question_choices.question_id and e.teacher_id=auth.uid()))
 with check(exists(select 1 from questions q join exams e on e.id=q.exam_id where q.id=question_choices.question_id and e.teacher_id=auth.uid()));

create policy exam_assignments_admin on exam_assignments for all to authenticated using(is_admin()) with check(is_admin());
create policy exam_assignments_teacher on exam_assignments for all to authenticated using(exists(select 1 from exams e where e.id=exam_assignments.exam_id and e.teacher_id=auth.uid()))
 with check(exists(select 1 from exams e where e.id=exam_assignments.exam_id and e.teacher_id=auth.uid()) and exists(select 1 from teacher_student_enrollments x where x.teacher_id=auth.uid() and x.student_id=exam_assignments.student_id and x.status='active'));
create policy exam_assignments_student on exam_assignments for select to authenticated using(student_id=auth.uid());
create policy attempts_admin on exam_attempts for select to authenticated using(is_admin());
create policy attempts_student_read on exam_attempts for select to authenticated using(student_id=auth.uid());
create policy attempts_teacher_read on exam_attempts for select to authenticated using(exists(select 1 from exam_assignments a join exams e on e.id=a.exam_id where a.id=exam_attempts.assignment_id and e.teacher_id=auth.uid()));
create policy answers_admin on attempt_answers for select to authenticated using(is_admin());
create policy answers_student_read on attempt_answers for select to authenticated using(exists(select 1 from exam_attempts a where a.id=attempt_answers.attempt_id and a.student_id=auth.uid()));
create policy answers_teacher_read on attempt_answers for select to authenticated using(exists(select 1 from exam_attempts a join exam_assignments x on x.id=a.assignment_id join exams e on e.id=x.exam_id where a.id=attempt_answers.attempt_id and e.teacher_id=auth.uid()));
create policy selected_admin on attempt_selected_choices for select to authenticated using(is_admin());
create policy selected_owner_read on attempt_selected_choices for select to authenticated using(exists(select 1 from attempt_answers aa join exam_attempts at on at.id=aa.attempt_id where aa.id=attempt_selected_choices.answer_id and (at.student_id=auth.uid() or exists(select 1 from exam_assignments x join exams e on e.id=x.exam_id where x.id=at.assignment_id and e.teacher_id=auth.uid()))));

create policy mistakes_admin on mistake_records for all to authenticated using(is_admin()) with check(is_admin());
create policy mistakes_teacher on mistake_records for select to authenticated using(teacher_id=auth.uid());
create policy mistakes_student on mistake_records for select to authenticated using(student_id=auth.uid());
create policy checkpoints_admin on mistake_exam_checkpoints for all to authenticated using(is_admin()) with check(is_admin());
create policy checkpoints_teacher on mistake_exam_checkpoints for select to authenticated using(teacher_id=auth.uid());
create policy checkpoints_student on mistake_exam_checkpoints for select to authenticated using(student_id=auth.uid());

create policy videos_admin on lesson_videos for all to authenticated using(is_admin()) with check(is_admin());
create policy videos_teacher on lesson_videos for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
-- Students never select lesson_videos directly; an authorized server operation returns only player data.
create policy video_assignments_admin on video_assignments for all to authenticated using(is_admin()) with check(is_admin());
create policy video_assignments_teacher on video_assignments for all to authenticated using(exists(select 1 from lesson_videos v where v.id=video_assignments.video_id and v.teacher_id=auth.uid()))
 with check(exists(select 1 from lesson_videos v where v.id=video_assignments.video_id and v.teacher_id=auth.uid()) and exists(select 1 from teacher_student_enrollments e where e.teacher_id=auth.uid() and e.student_id=video_assignments.student_id and e.status='active'));
create policy video_assignments_student on video_assignments for select to authenticated using(student_id=auth.uid());
create policy video_sessions_admin on video_view_sessions for select to authenticated using(is_admin());
create policy video_sessions_student on video_view_sessions for select to authenticated using(student_id=auth.uid());
create policy video_sessions_teacher on video_view_sessions for select to authenticated using(exists(select 1 from video_assignments a join lesson_videos v on v.id=a.video_id where a.id=video_view_sessions.assignment_id and v.teacher_id=auth.uid()));

create policy materials_admin on materials for all to authenticated using(is_admin()) with check(is_admin());
create policy materials_teacher on materials for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
-- URLs and storage paths are returned only by an authorized server route, never directly to students.
create policy material_assignments_admin on material_assignments for all to authenticated using(is_admin()) with check(is_admin());
create policy material_assignments_teacher on material_assignments for all to authenticated using(exists(select 1 from materials m where m.id=material_assignments.material_id and m.teacher_id=auth.uid()))
 with check(exists(select 1 from materials m where m.id=material_assignments.material_id and m.teacher_id=auth.uid()) and exists(select 1 from teacher_student_enrollments e where e.teacher_id=auth.uid() and e.student_id=material_assignments.student_id and e.status='active'));
create policy material_assignments_student on material_assignments for select to authenticated using(student_id=auth.uid());
create policy notifications_admin_only on admin_notifications for all to authenticated using(is_admin()) with check(is_admin());
create policy audit_admin_read on audit_logs for select to authenticated using(is_admin());

insert into storage.buckets(id,name,public,file_size_limit) values('private-materials','private-materials',false,52428800)
on conflict(id) do update set public=false;
create policy material_upload_teacher on storage.objects for insert to authenticated with check(
 bucket_id='private-materials' and app_current_role() in ('admin','teacher') and (app_current_role()='admin' or (storage.foldername(name))[1]=auth.uid()::text));
create policy material_manage_teacher on storage.objects for all to authenticated using(
 bucket_id='private-materials' and (is_admin() or (storage.foldername(name))[1]=auth.uid()::text))
with check(bucket_id='private-materials' and (is_admin() or (storage.foldername(name))[1]=auth.uid()::text));

grant select on teacher_profiles to authenticated;
grant select on profiles,student_profiles,teacher_student_enrollments,student_invitation_codes,teacher_settings,platform_settings,exams,exam_assignments,exam_attempts,attempt_answers,attempt_selected_choices,mistake_records,mistake_exam_checkpoints,video_assignments,video_view_sessions,material_assignments,admin_notifications,audit_logs to authenticated;
grant select,insert,update,delete on student_invitation_codes,teacher_settings,exams,exam_versions,questions,question_choices,exam_assignments,lesson_videos,video_assignments,materials,material_assignments to authenticated;
grant update on admin_notifications,platform_settings,teacher_profiles to authenticated;
