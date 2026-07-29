-- Create auth users from the Supabase dashboard or admin API first, then replace these UUIDs.
-- Never use this seed in production with shared credentials.
insert into public.profiles(id,role,full_name) values
('00000000-0000-0000-0000-000000000001','admin','Development Administrator')
on conflict(id) do nothing;
