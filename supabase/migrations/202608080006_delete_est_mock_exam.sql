create or replace function public.delete_teacher_mock_exam(p_mock_exam_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_module record;
begin
 if public.app_current_role()<>'teacher' or not public.teacher_owns_mock_exam(p_mock_exam_id) then raise exception 'forbidden'; end if;
 for v_module in select id from public.exams where parent_mock_exam_id=p_mock_exam_id loop
  perform public.delete_teacher_exam(v_module.id);
 end loop;
 delete from public.mock_exams where id=p_mock_exam_id and teacher_id=auth.uid();
 insert into public.audit_logs(actor_id,actor_role,action,entity_type,entity_id)
 values(auth.uid(),'teacher','mock_exam.deleted','mock_exam',p_mock_exam_id);
end $$;
revoke all on function public.delete_teacher_mock_exam(uuid) from public,anon;
grant execute on function public.delete_teacher_mock_exam(uuid) to authenticated;
