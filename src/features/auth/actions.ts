"use server";
import { createHmac,createCipheriv,randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { loginSchema,studentRegistrationSchema } from "./schemas";

export async function login(formData:FormData){
  const parsed=loginSchema.safeParse(Object.fromEntries(formData));
  if(!parsed.success) redirect(`/auth/${formData.get("role")||"student"}/login?error=invalid`);
  const supabase=await createClient(parsed.data.role);
  const {data,error}=await supabase.auth.signInWithPassword({email:parsed.data.email,password:parsed.data.password});
  if(error||!data.user) redirect(`/auth/${parsed.data.role}/login?error=credentials`);
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",data.user.id).single();
  if(profile?.role!==parsed.data.role){await supabase.auth.signOut();redirect(`/auth/${parsed.data.role}/login?error=role`)}
  redirect(parsed.data.role==="student"?"/student/teachers":`/${parsed.data.role}/dashboard`);
}

export async function registerStudent(formData:FormData){
  const parsed=studentRegistrationSchema.safeParse(Object.fromEntries(formData));
  if(!parsed.success) redirect("/auth/student/register?error=invalid");
  if(!env.NATIONAL_ID_HMAC_SECRET||!env.NATIONAL_ID_ENCRYPTION_KEY) throw new Error("Server configuration is incomplete");
  const admin=createAdminClient(); const d=parsed.data;
  const hash=createHmac("sha256",env.NATIONAL_ID_HMAC_SECRET).update(d.nationalId).digest("hex");
  const key=Buffer.from(env.NATIONAL_ID_ENCRYPTION_KEY,"base64"); if(key.length!==32) throw new Error("Server configuration is incomplete");
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv);
  const encrypted=Buffer.concat([cipher.update(d.nationalId,"utf8"),cipher.final(),cipher.getAuthTag(),iv]).toString("base64");
  const {data:user,error}=await admin.auth.admin.createUser({email:d.email,password:d.password,email_confirm:true,user_metadata:{full_name:d.fullName}});
  if(error||!user.user){
    const reason=error?.code==="email_exists"||error?.code==="user_already_exists"?"email":error?.status===401||error?.status===403?"configuration":"account";
    redirect(`/auth/student/register?error=${reason}`);
  }
  const {error:profileError}=await admin.rpc("complete_student_registration",{p_user_id:user.user.id,p_full_name:d.fullName,p_age:d.age,p_address:d.address,p_mobile:d.mobile,p_guardian_mobile:d.guardianMobile,p_national_id_hash:hash,p_national_id_encrypted:encrypted,p_national_id_last4:d.nationalId.slice(-4)});
  if(profileError){await admin.auth.admin.deleteUser(user.user.id);redirect("/auth/student/register?error=identity")}
  const supabase=await createClient("student");
  const {error:signInError}=await supabase.auth.signInWithPassword({email:d.email,password:d.password});
  if(signInError)redirect("/auth/student/login?registered=1");
  redirect("/student/teachers");
}

export async function logout(){
  const supabase=await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
