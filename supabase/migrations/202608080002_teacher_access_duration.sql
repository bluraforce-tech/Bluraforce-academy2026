alter table public.teacher_profiles
  add column if not exists access_duration_days integer not null default 30;

alter table public.teacher_profiles
  drop constraint if exists teacher_profiles_access_duration_days_check;

alter table public.teacher_profiles
  add constraint teacher_profiles_access_duration_days_check
  check (access_duration_days between 1 and 3650);
