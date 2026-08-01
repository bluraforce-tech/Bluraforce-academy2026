insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('question-images','question-images',true,3145728,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists question_images_teacher_insert on storage.objects;
create policy question_images_teacher_insert on storage.objects for insert to authenticated with check(bucket_id='question-images' and public.app_current_role()='teacher' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists question_images_teacher_manage on storage.objects;
create policy question_images_teacher_manage on storage.objects for update to authenticated using(bucket_id='question-images' and public.app_current_role()='teacher' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='question-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists question_images_teacher_delete on storage.objects;
create policy question_images_teacher_delete on storage.objects for delete to authenticated using(bucket_id='question-images' and public.app_current_role()='teacher' and (storage.foldername(name))[1]=auth.uid()::text);
