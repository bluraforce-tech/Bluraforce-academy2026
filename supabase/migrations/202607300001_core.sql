create extension if not exists pgcrypto;
create type public.app_role as enum ('admin','teacher','student');
create type public.record_status as enum ('draft','published','archived');
create type public.enrollment_status as enum ('active','revoked');
create type public.code_status as enum ('active','redeemed','expired','revoked');
create type public.attempt_status as enum ('in_progress','submitted','expired');
create type public.notification_status as enum ('unread','read','resolved','dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null,
  full_name text not null check (char_length(full_name) between 3 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.teacher_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null, image_url text check (image_url is null or image_url ~ '^https://'),
  biography text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.student_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  age smallint not null check(age between 5 and 100), address text not null,
  mobile text not null, guardian_mobile text not null,
  national_id_hash text not null unique, national_id_encrypted text not null,
  national_id_last4 char(4) not null check(national_id_last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.teacher_student_enrollments (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teacher_profiles(user_id),
  student_id uuid not null references public.student_profiles(user_id), status enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(), access_expires_at timestamptz, revoked_at timestamptz,
  unique(teacher_id,student_id)
);
create table public.student_invitation_codes (
  id uuid primary key default gen_random_uuid(), code_hash text not null unique, code_masked text not null,
  teacher_id uuid not null references public.teacher_profiles(user_id), created_by uuid not null references public.profiles(id),
  status code_status not null default 'active', expires_at timestamptz not null default (now()+interval '2 days'),
  access_duration_days int not null check(access_duration_days between 1 and 3650),
  redeemed_by uuid references public.student_profiles(user_id),
  redeemed_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now()
);
create table public.teacher_settings (
  teacher_id uuid primary key references public.teacher_profiles(user_id), mistakes_exam_interval smallint not null default 3 check(mistakes_exam_interval between 1 and 20),
  mistakes_max_questions smallint not null default 20 check(mistakes_max_questions between 1 and 100),
  include_resolved_mistakes boolean not null default false, updated_at timestamptz not null default now()
);
create table public.platform_settings (
  id boolean primary key default true check(id), standard_max_views int not null default 5,
  standard_max_availability_days int not null default 30, min_availability_days int,
  view_session_cooldown_minutes int not null default 30, strict_enforcement boolean not null default false,
  updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
insert into public.platform_settings(id) values(true);

create table public.exams (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teacher_profiles(user_id),
  title text not null, description text, instructions text, kind text not null default 'standard' check(kind in ('standard','mistakes')),
  status record_status not null default 'draft', duration_minutes int not null check(duration_minutes between 1 and 600),
  starts_at timestamptz, ends_at timestamptz, max_attempts int not null default 1 check(max_attempts between 1 and 20),
  randomize_questions boolean not null default false, randomize_choices boolean not null default false,
  published_version_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(ends_at is null or starts_at is null or ends_at > starts_at)
);
create table public.exam_versions (
  id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id),
  version int not null, snapshot jsonb not null, total_points numeric(8,2) not null,
  passing_score numeric(8,2), created_at timestamptz not null default now(), unique(exam_id,version)
);
alter table public.exams add constraint exams_version_fk foreign key(published_version_id) references public.exam_versions(id);
create table public.questions (
  id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id) on delete cascade,
  text text not null, image_url text, points numeric(8,2) not null check(points>0), position int not null,
  created_at timestamptz not null default now(), unique(exam_id,position)
);
create table public.question_choices (
  id uuid primary key default gen_random_uuid(), question_id uuid not null references public.questions(id) on delete cascade,
  text text not null, is_correct boolean not null default false, position int not null, unique(question_id,position)
);
create table public.exam_assignments (
  id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.exams(id),
  student_id uuid not null references public.student_profiles(user_id), assigned_at timestamptz not null default now(),
  revoked_at timestamptz, unique(exam_id,student_id)
);
create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.exam_assignments(id),
  student_id uuid not null references public.student_profiles(user_id), exam_version_id uuid not null references public.exam_versions(id),
  attempt_number int not null, started_at timestamptz not null default now(), expires_at timestamptz not null,
  submitted_at timestamptz, status attempt_status not null default 'in_progress', score numeric(8,2),
  created_at timestamptz not null default now(), unique(assignment_id,attempt_number)
);
create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_snapshot_id text not null, awarded_points numeric(8,2), is_correct boolean,
  answered_at timestamptz not null default now(), unique(attempt_id,question_snapshot_id)
);
create table public.attempt_selected_choices (
  answer_id uuid not null references public.attempt_answers(id) on delete cascade, choice_snapshot_id text not null,
  primary key(answer_id,choice_snapshot_id)
);
create table public.mistake_records (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teacher_profiles(user_id),
  student_id uuid not null references public.student_profiles(user_id), source_attempt_id uuid not null references public.exam_attempts(id),
  question_snapshot jsonb not null, fingerprint text not null, occurrence_count int not null default 1,
  resolved_at timestamptz, last_occurred_at timestamptz not null default now(), unique(teacher_id,student_id,fingerprint)
);
create table public.mistake_exam_checkpoints (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teacher_profiles(user_id),
  student_id uuid not null references public.student_profiles(user_id), submitted_standard_count int not null,
  generated_exam_id uuid references public.exams(id), processed_at timestamptz not null default now(),
  unique(teacher_id,student_id,submitted_standard_count)
);

create table public.lesson_videos (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teacher_profiles(user_id),
  title text not null, description text, youtube_video_id char(11) not null, thumbnail_url text,
  lesson_name text, category_name text, position int, status record_status not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.video_assignments (
  id uuid primary key default gen_random_uuid(), video_id uuid not null references public.lesson_videos(id),
  student_id uuid not null references public.student_profiles(user_id), available_from timestamptz, available_until timestamptz,
  max_views int check(max_views is null or max_views>0), counted_views int not null default 0 check(counted_views>=0),
  revoked_at timestamptz, teacher_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(video_id,student_id), check(available_until is null or available_from is null or available_until>available_from)
);
create table public.video_view_sessions (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.video_assignments(id),
  student_id uuid not null references public.student_profiles(user_id), playback_session_id uuid not null unique,
  started_at timestamptz not null default now(), last_heartbeat_at timestamptz not null default now(),
  ended_at timestamptz, counted_view boolean not null default true, completion_state text, watched_seconds int not null default 0
);
create table public.materials (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teacher_profiles(user_id),
  title text not null, description text, material_type text not null, external_drive_url text,
  storage_path text, cover_image_url text, available_from timestamptz, available_until timestamptz,
  status record_status not null default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((external_drive_url is not null)::int+(storage_path is not null)::int=1)
);
create table public.material_assignments (
  id uuid primary key default gen_random_uuid(), material_id uuid not null references public.materials(id),
  student_id uuid not null references public.student_profiles(user_id), revoked_at timestamptz,
  created_at timestamptz not null default now(), unique(material_id,student_id)
);
create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(), status notification_status not null default 'unread',
  teacher_id uuid references public.teacher_profiles(user_id), entity_type text not null, entity_id uuid,
  standard jsonb not null, actual jsonb not null, internal_path text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), actor_role app_role,
  action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index enrollments_teacher_idx on public.teacher_student_enrollments(teacher_id,status);
create index enrollments_student_idx on public.teacher_student_enrollments(student_id,status);
create index codes_teacher_status_idx on public.student_invitation_codes(teacher_id,status,created_at desc);
create index exams_teacher_status_idx on public.exams(teacher_id,status,created_at desc);
create index assignments_student_idx on public.exam_assignments(student_id);
create index attempts_student_status_idx on public.exam_attempts(student_id,status);
create index mistakes_teacher_student_idx on public.mistake_records(teacher_id,student_id);
create index videos_teacher_status_idx on public.lesson_videos(teacher_id,status);
create index video_assignments_student_idx on public.video_assignments(student_id,available_from,available_until);
create index materials_teacher_status_idx on public.materials(teacher_id,status);
create index material_assignments_student_idx on public.material_assignments(student_id);
create index audit_created_idx on public.audit_logs(created_at desc);

create function public.app_current_role() returns app_role language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.app_current_role()='admin',false) $$;
create function public.is_active_enrollment(p_teacher uuid,p_student uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from teacher_student_enrollments e join teacher_profiles t on t.user_id=e.teacher_id
 where e.teacher_id=p_teacher and e.student_id=p_student and e.status='active'
 and (e.access_expires_at is null or e.access_expires_at>now()) and t.is_active)
$$;

create function public.complete_student_registration(p_user_id uuid,p_full_name text,p_age smallint,p_address text,p_mobile text,p_guardian_mobile text,p_national_id_hash text,p_national_id_encrypted text,p_national_id_last4 text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.role()<>'service_role' then raise exception 'forbidden'; end if;
 insert into profiles(id,role,full_name) values(p_user_id,'student',p_full_name)
 on conflict(id) do update set full_name=excluded.full_name,updated_at=now()
 where profiles.role='student';
 insert into student_profiles(user_id,age,address,mobile,guardian_mobile,national_id_hash,national_id_encrypted,national_id_last4)
 values(p_user_id,p_age,p_address,p_mobile,p_guardian_mobile,p_national_id_hash,p_national_id_encrypted,p_national_id_last4);
end $$;

create function public.redeem_invitation_code(p_teacher_id uuid,p_code_hash text) returns uuid
language plpgsql security definer set search_path=public as $$
declare c student_invitation_codes; enrollment_id uuid;
begin
 if public.app_current_role()<>'student' then raise exception 'forbidden'; end if;
 select * into c from student_invitation_codes where code_hash=p_code_hash for update;
 if not found then raise exception 'invalid_code'; end if;
 if c.teacher_id<>p_teacher_id then raise exception 'wrong_teacher'; end if;
 if c.status<>'active' or c.revoked_at is not null then raise exception 'unavailable_code'; end if;
 if c.expires_at is not null and c.expires_at<=now() then update student_invitation_codes set status='expired' where id=c.id; raise exception 'expired_code'; end if;
 insert into teacher_student_enrollments(teacher_id,student_id,access_expires_at)
 values(p_teacher_id,auth.uid(),now()+make_interval(days=>c.access_duration_days))
 on conflict(teacher_id,student_id) do update set status='active',revoked_at=null,
 access_expires_at=excluded.access_expires_at returning id into enrollment_id;
 update student_invitation_codes set status='redeemed',redeemed_by=auth.uid(),redeemed_at=now() where id=c.id;
 insert into audit_logs(actor_id,actor_role,action,entity_type,entity_id) values(auth.uid(),'student','code.redeemed','enrollment',enrollment_id);
 return enrollment_id;
end $$;

create function public.start_exam_attempt(p_assignment_id uuid) returns public.exam_attempts
language plpgsql security definer set search_path=public as $$
declare a exam_assignments; e exams; existing exam_attempts; n int;
begin
 select * into a from exam_assignments where id=p_assignment_id and student_id=auth.uid() and revoked_at is null;
 if not found then raise exception 'forbidden'; end if;
 select * into e from exams where id=a.exam_id and status='published';
 if not found or (e.starts_at is not null and now()<e.starts_at) or (e.ends_at is not null and now()>=e.ends_at) then raise exception 'exam_unavailable'; end if;
 select * into existing from exam_attempts where assignment_id=a.id and status='in_progress' order by attempt_number desc limit 1;
 if found and existing.expires_at>now() then return existing; end if;
 update exam_attempts set status='expired',submitted_at=now() where assignment_id=a.id and status='in_progress' and expires_at<=now();
 select count(*)+1 into n from exam_attempts where assignment_id=a.id;
 if n>e.max_attempts then raise exception 'max_attempts'; end if;
 insert into exam_attempts(assignment_id,student_id,exam_version_id,attempt_number,expires_at)
 values(a.id,auth.uid(),e.published_version_id,n,least(now()+make_interval(mins=>e.duration_minutes),coalesce(e.ends_at,'infinity')))
 returning * into existing; return existing;
end $$;

create function public.begin_video_view(p_assignment_id uuid,p_session_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare a video_assignments; v lesson_videos; session_id uuid;
begin
 select * into a from video_assignments where id=p_assignment_id and student_id=auth.uid() for update;
 if not found or a.revoked_at is not null or (a.available_from is not null and now()<a.available_from) or (a.available_until is not null and now()>=a.available_until) then raise exception 'video_unavailable'; end if;
 select * into v from lesson_videos where id=a.video_id and status='published';
 if not found or not is_active_enrollment(v.teacher_id,auth.uid()) then raise exception 'video_unavailable'; end if;
 if a.max_views is not null and a.counted_views>=a.max_views then raise exception 'view_limit'; end if;
 insert into video_view_sessions(assignment_id,student_id,playback_session_id) values(a.id,auth.uid(),p_session_id)
 on conflict(playback_session_id) do update set last_heartbeat_at=now() returning id into session_id;
 if not exists(select 1 from video_view_sessions where id=session_id and started_at<now()-interval '1 second') then
   update video_assignments set counted_views=counted_views+1 where id=a.id;
 end if;
 return session_id;
end $$;

create function public.get_video_player_data(p_assignment_id uuid)
returns table(title text,description text,youtube_video_id char(11),remaining_views int,available_from timestamptz,available_until timestamptz)
language plpgsql security definer set search_path=public as $$
declare a video_assignments; v lesson_videos;
begin
 select * into a from video_assignments where id=p_assignment_id and student_id=auth.uid();
 if not found or a.revoked_at is not null or (a.available_from is not null and now()<a.available_from) or (a.available_until is not null and now()>=a.available_until) then raise exception 'video_unavailable'; end if;
 select * into v from lesson_videos where id=a.video_id and status='published';
 if not found or not is_active_enrollment(v.teacher_id,auth.uid()) or (a.max_views is not null and a.counted_views>=a.max_views) then raise exception 'video_unavailable'; end if;
 return query select v.title,v.description,v.youtube_video_id,case when a.max_views is null then null else a.max_views-a.counted_views end,a.available_from,a.available_until;
end $$;

revoke all on function public.complete_student_registration from public,anon,authenticated;
grant execute on function public.complete_student_registration to service_role;
revoke all on function public.redeem_invitation_code from public,anon;
grant execute on function public.redeem_invitation_code to authenticated;
revoke all on function public.start_exam_attempt from public,anon;
grant execute on function public.start_exam_attempt to authenticated;
revoke all on function public.begin_video_view from public,anon;
grant execute on function public.begin_video_view to authenticated;
revoke all on function public.get_video_player_data from public,anon;
grant execute on function public.get_video_player_data to authenticated;
