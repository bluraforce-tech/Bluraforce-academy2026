-- Education targeting. Legacy nulls deliberately mean needs_classification and are deny-by-default.
do $$ begin create type public.education_system as enum ('american','national'); exception when duplicate_object then null; end $$;
do $$ begin create type public.national_grade as enum ('sensor_1','sensor_2','sensor_3'); exception when duplicate_object then null; end $$;

alter table public.student_invitation_codes add column if not exists education_system public.education_system;
alter table public.student_invitation_codes add column if not exists national_grade public.national_grade;
alter table public.student_profiles add column if not exists education_system public.education_system;
alter table public.student_profiles add column if not exists national_grade public.national_grade;
alter table public.exams add column if not exists education_system public.education_system;
alter table public.exams add column if not exists national_grade public.national_grade;
alter table public.lesson_videos add column if not exists education_system public.education_system;
alter table public.lesson_videos add column if not exists national_grade public.national_grade;
alter table public.materials add column if not exists education_system public.education_system;
alter table public.materials add column if not exists national_grade public.national_grade;

alter table public.student_invitation_codes add constraint invitation_codes_target_valid check (education_system is null and national_grade is null or education_system='american' and national_grade is null or education_system='national' and national_grade is not null) not valid;
alter table public.student_profiles add constraint student_profiles_target_valid check (education_system is null and national_grade is null or education_system='american' and national_grade is null or education_system='national' and national_grade is not null) not valid;
alter table public.exams add constraint exams_target_valid check (education_system is null and national_grade is null or education_system='american' and national_grade is null or education_system='national' and national_grade is not null) not valid;
alter table public.lesson_videos add constraint lesson_videos_target_valid check (education_system is null and national_grade is null or education_system='american' and national_grade is null or education_system='national' and national_grade is not null) not valid;
alter table public.materials add constraint materials_target_valid check (education_system is null and national_grade is null or education_system='american' and national_grade is null or education_system='national' and national_grade is not null) not valid;

create index if not exists students_education_target_idx on public.student_profiles(education_system,national_grade);
create index if not exists codes_education_target_idx on public.student_invitation_codes(education_system,national_grade);
create index if not exists exams_education_target_idx on public.exams(teacher_id,education_system,national_grade);
create index if not exists videos_education_target_idx on public.lesson_videos(teacher_id,education_system,national_grade);
create index if not exists materials_education_target_idx on public.materials(teacher_id,education_system,national_grade);

create or replace function public.education_target_matches(p_system public.education_system,p_grade public.national_grade,p_student uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from student_profiles s where s.user_id=p_student and s.education_system=p_system and (p_system='american' or s.national_grade=p_grade));
$$;

create or replace function public.complete_student_registration_with_code(
 p_user_id uuid,p_full_name text,p_age smallint,p_address text,p_mobile text,p_guardian_mobile text,
 p_national_id_hash text,p_national_id_encrypted text,p_national_id_last4 text,p_teacher_id uuid,p_code_hash text
) returns void language plpgsql security definer set search_path=public as $$
declare c public.student_invitation_codes; v_days int;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden'; end if;
 select * into c from student_invitation_codes where code_hash=p_code_hash and teacher_id=p_teacher_id for update;
 if not found or c.status<>'active' or c.education_system is null then raise exception 'unavailable_code'; end if;
 if c.expires_at is not null and c.expires_at<=now() then update student_invitation_codes set status='expired' where id=c.id; raise exception 'expired_code'; end if;
 insert into profiles(id,role,full_name) values(p_user_id,'student',p_full_name)
 on conflict(id) do update set full_name=excluded.full_name,updated_at=now() where profiles.role='student';
 insert into student_profiles(user_id,age,address,mobile,guardian_mobile,national_id_hash,national_id_encrypted,national_id_last4,education_system,national_grade)
 values(p_user_id,p_age,p_address,p_mobile,p_guardian_mobile,p_national_id_hash,p_national_id_encrypted,p_national_id_last4,c.education_system,c.national_grade);
 v_days:=coalesce(c.access_duration_days,30);
 insert into teacher_student_enrollments(teacher_id,student_id,status,access_expires_at) values(p_teacher_id,p_user_id,'active',now()+make_interval(days=>v_days));
 update student_invitation_codes set status='redeemed',redeemed_by=p_user_id,redeemed_at=now() where id=c.id and status='active';
 if not found then raise exception 'unavailable_code'; end if;
end $$;
revoke all on function public.complete_student_registration_with_code(uuid,text,smallint,text,text,text,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.complete_student_registration_with_code(uuid,text,smallint,text,text,text,text,text,text,uuid,text) to service_role;

-- Assignment writes are a second backend boundary: ownership alone is insufficient.
create or replace function public.enforce_assignment_education_target() returns trigger language plpgsql set search_path=public as $$
declare s public.education_system; g public.national_grade;
begin
 if tg_table_name='exam_assignments' then select education_system,national_grade into s,g from exams where id=new.exam_id;
 elsif tg_table_name='video_assignments' then select education_system,national_grade into s,g from lesson_videos where id=new.video_id;
 else select education_system,national_grade into s,g from materials where id=new.material_id; end if;
 if s is not null and not public.education_target_matches(s,g,new.student_id) then raise exception 'education_target_mismatch'; end if;
 return new;
end $$;
drop trigger if exists exam_assignment_target on public.exam_assignments;
create trigger exam_assignment_target before insert or update of student_id,exam_id on public.exam_assignments for each row execute function public.enforce_assignment_education_target();
drop trigger if exists video_assignment_target on public.video_assignments;
create trigger video_assignment_target before insert or update of student_id,video_id on public.video_assignments for each row execute function public.enforce_assignment_education_target();
drop trigger if exists material_assignment_target on public.material_assignments;
create trigger material_assignment_target before insert or update of student_id,material_id on public.material_assignments for each row execute function public.enforce_assignment_education_target();

drop policy if exists exams_student_assigned on public.exams;
create policy exams_student_assigned on public.exams for select to authenticated using(status='published' and public.education_target_matches(education_system,national_grade,auth.uid()) and exists(select 1 from exam_assignments a where a.exam_id=exams.id and a.student_id=auth.uid() and a.revoked_at is null));
drop policy if exists exam_assignments_student on public.exam_assignments;
create policy exam_assignments_student on public.exam_assignments for select to authenticated using(student_id=auth.uid() and exists(select 1 from exams e where e.id=exam_assignments.exam_id and public.education_target_matches(e.education_system,e.national_grade,auth.uid())));
drop policy if exists video_assignments_student on public.video_assignments;
create policy video_assignments_student on public.video_assignments for select to authenticated using(student_id=auth.uid() and exists(select 1 from lesson_videos v where v.id=video_assignments.video_id and public.education_target_matches(v.education_system,v.national_grade,auth.uid())));
drop policy if exists material_assignments_student on public.material_assignments;
create policy material_assignments_student on public.material_assignments for select to authenticated using(student_id=auth.uid() and exists(select 1 from materials m where m.id=material_assignments.material_id and public.education_target_matches(m.education_system,m.national_grade,auth.uid())));

-- Students may update contact fields only; classification remains admin-only through column grants.
revoke update on public.student_profiles from authenticated;
grant update(address,mobile,guardian_mobile) on public.student_profiles to authenticated;

-- Security-definer entry points must repeat the target check because they bypass RLS.
create or replace function public.start_exam_attempt(p_assignment_id uuid) returns public.exam_attempts language plpgsql security definer set search_path=public as $$
declare a exam_assignments;e exams;existing exam_attempts;n int;
begin select * into a from exam_assignments where id=p_assignment_id and student_id=auth.uid() and revoked_at is null;if not found then raise exception 'assignment_unavailable';end if;
select * into e from exams where id=a.exam_id and status='published';if not found or not public.education_target_matches(e.education_system,e.national_grade,auth.uid()) or not public.is_active_enrollment(e.teacher_id,auth.uid()) or (e.starts_at is not null and now()<e.starts_at) or (e.ends_at is not null and now()>=e.ends_at) then raise exception 'exam_unavailable';end if;
select * into existing from exam_attempts where assignment_id=a.id and status='in_progress' and expires_at>now() order by attempt_number desc limit 1;if found then return existing;end if;
update exam_attempts set status='expired',submitted_at=now() where assignment_id=a.id and status='in_progress' and expires_at<=now();select count(*)+1 into n from exam_attempts where assignment_id=a.id;if n>e.max_attempts then raise exception 'attempt_limit';end if;
insert into exam_attempts(assignment_id,student_id,exam_version_id,attempt_number,expires_at) values(a.id,auth.uid(),e.published_version_id,n,least(now()+make_interval(mins=>e.duration_minutes),coalesce(e.ends_at,'infinity'))) returning * into existing;return existing;end $$;

create or replace function public.get_material_book_access(p_assignment_id uuid) returns table(title text,description text,material_type text,external_url text,cover_image_url text,available_until timestamptz) language plpgsql security definer set search_path=public as $$
declare a material_assignments;m materials;begin select * into a from material_assignments where id=p_assignment_id and student_id=auth.uid() and revoked_at is null;if not found then raise exception 'material_unavailable';end if;select * into m from materials where id=a.material_id and status='published';if not found or not public.education_target_matches(m.education_system,m.national_grade,auth.uid()) or not public.is_active_enrollment(m.teacher_id,auth.uid()) or (m.available_from is not null and now()<m.available_from) or (m.available_until is not null and now()>=m.available_until) then raise exception 'material_unavailable';end if;return query select m.title,m.description,m.material_type,m.external_drive_url,m.cover_image_url,m.available_until;end $$;
