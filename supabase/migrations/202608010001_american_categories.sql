do $$ begin create type public.american_category as enum('classified','sat','est'); exception when duplicate_object then null; end $$;
alter table public.question_bank_units add column if not exists american_category public.american_category;
alter table public.exams add column if not exists american_category public.american_category;
alter table public.lesson_videos add column if not exists american_category public.american_category;
alter table public.materials add column if not exists american_category public.american_category;
alter table public.student_invitation_codes add column if not exists american_category public.american_category;
update public.question_bank_units set american_category='classified' where education_system='american' and american_category is null;
update public.exams set american_category='classified' where education_system='american' and american_category is null;
update public.lesson_videos set american_category='classified' where education_system='american' and american_category is null;
update public.materials set american_category='classified' where education_system='american' and american_category is null;
update public.student_invitation_codes set american_category='classified' where education_system='american' and american_category is null;
create or replace function public.create_question_bank_unit(p_title text,p_description text,p_education_system public.education_system,p_national_grade public.national_grade,p_american_category public.american_category)
returns uuid language plpgsql security definer set search_path=public as $$
declare unit_id uuid;begin if public.app_current_role()<>'teacher' then raise exception 'forbidden';end if;if char_length(trim(p_title))<2 or char_length(trim(p_title))>200 then raise exception 'invalid_title';end if;if not (p_education_system='american' and p_national_grade is null and p_american_category is not null or p_education_system='national' and p_national_grade is not null and p_american_category is null) then raise exception 'invalid_education_target';end if;insert into question_bank_units(teacher_id,title,description,education_system,national_grade,american_category) values(auth.uid(),trim(p_title),nullif(trim(p_description),''),p_education_system,p_national_grade,p_american_category) returning id into unit_id;insert into audit_logs(actor_id,actor_role,action,entity_type,entity_id) values(auth.uid(),'teacher','question_bank.unit_created','question_bank_unit',unit_id);return unit_id;end $$;
revoke all on function public.create_question_bank_unit(text,text,public.education_system,public.national_grade,public.american_category) from public,anon;
grant execute on function public.create_question_bank_unit(text,text,public.education_system,public.national_grade,public.american_category) to authenticated;
create or replace function public.sync_exam_american_category_from_unit() returns trigger language plpgsql security definer set search_path=public as $$begin if new.source_unit_id is not null then select american_category into new.american_category from public.question_bank_units where id=new.source_unit_id;end if;return new;end$$;
drop trigger if exists sync_exam_american_category_from_unit on public.exams;
create trigger sync_exam_american_category_from_unit before insert or update of source_unit_id on public.exams for each row execute function public.sync_exam_american_category_from_unit();
