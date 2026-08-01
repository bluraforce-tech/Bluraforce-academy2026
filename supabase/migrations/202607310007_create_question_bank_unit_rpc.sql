create or replace function public.create_question_bank_unit(
 p_title text,
 p_description text,
 p_education_system public.education_system,
 p_national_grade public.national_grade
) returns uuid language plpgsql security definer set search_path=public as $$
declare unit_id uuid;
begin
 if public.app_current_role()<>'teacher' then raise exception 'forbidden';end if;
 if char_length(trim(p_title))<2 or char_length(trim(p_title))>200 then raise exception 'invalid_title';end if;
 if not (p_education_system='american' and p_national_grade is null or p_education_system='national' and p_national_grade is not null) then raise exception 'invalid_education_target';end if;
 insert into question_bank_units(teacher_id,title,description,education_system,national_grade)
 values(auth.uid(),trim(p_title),nullif(trim(p_description),''),p_education_system,p_national_grade)
 returning id into unit_id;
 insert into audit_logs(actor_id,actor_role,action,entity_type,entity_id)
 values(auth.uid(),'teacher','question_bank.unit_created','question_bank_unit',unit_id);
 return unit_id;
end $$;
revoke all on function public.create_question_bank_unit(text,text,public.education_system,public.national_grade) from public,anon;
grant execute on function public.create_question_bank_unit(text,text,public.education_system,public.national_grade) to authenticated;
