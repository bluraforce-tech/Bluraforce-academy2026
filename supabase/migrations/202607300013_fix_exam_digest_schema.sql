-- Supabase installs pgcrypto in the extensions schema. The submit function
-- must include that schema because it generates mistake-record fingerprints.
alter function public.submit_exam_attempt(uuid)
set search_path = public, extensions;
