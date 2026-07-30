create or replace function public.get_material_book_access(p_assignment_id uuid)
returns table(title text,description text,material_type text,external_url text,cover_image_url text,available_until timestamptz)
language plpgsql security definer set search_path=public as $$
declare a material_assignments; m materials;
begin
 select * into a from material_assignments where id=p_assignment_id and student_id=auth.uid() and revoked_at is null;
 if not found then raise exception 'material_unavailable'; end if;
 select * into m from materials where id=a.material_id and status='published';
 if not found or not public.is_active_enrollment(m.teacher_id,auth.uid())
  or (m.available_from is not null and now()<m.available_from)
  or (m.available_until is not null and now()>=m.available_until)
 then raise exception 'material_unavailable'; end if;
 return query select m.title,m.description,m.material_type,m.external_drive_url,m.cover_image_url,m.available_until;
end $$;
revoke all on function public.get_material_book_access(uuid) from public,anon;
grant execute on function public.get_material_book_access(uuid) to authenticated;
