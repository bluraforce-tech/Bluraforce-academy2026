import { z } from "zod";
const schema=z.object({
  NEXT_PUBLIC_SUPABASE_URL:z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY:z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY:z.string().min(20).optional(),
  NATIONAL_ID_HMAC_SECRET:z.string().min(32).optional(),
  NATIONAL_ID_ENCRYPTION_KEY:z.string().optional(),
  INVITATION_CODE_PEPPER:z.string().min(32).optional(),
});
export const env=schema.parse({
  NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY,
  NATIONAL_ID_HMAC_SECRET:process.env.NATIONAL_ID_HMAC_SECRET,
  NATIONAL_ID_ENCRYPTION_KEY:process.env.NATIONAL_ID_ENCRYPTION_KEY,
  INVITATION_CODE_PEPPER:process.env.INVITATION_CODE_PEPPER,
});
