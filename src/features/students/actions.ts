"use server";
import {createDecipheriv,createHmac} from "crypto";
import {redirect} from "next/navigation";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {env} from "@/lib/env";
import {normalizeNationalId} from "@/features/auth/schemas";

async function requireAdmin(){const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/admin/login");const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).single();if(profile?.role!=="admin")redirect("/");return user}

export async function findStudentForPasswordReset(formData:FormData){
 await requireAdmin();
 const nationalId=normalizeNationalId(String(formData.get("nationalId")??""));
 if(!/^\d{14}$/.test(nationalId))redirect("/admin/students/password?error=invalid-id");
 const admin=createAdminClient(),hash=env.NATIONAL_ID_HMAC_SECRET?createHmac("sha256",env.NATIONAL_ID_HMAC_SECRET).update(nationalId).digest("hex"):null;
 const {data}=hash?await admin.from("student_profiles").select("user_id").eq("national_id_hash",hash).maybeSingle():{data:null};
 if(data)redirect(`/admin/students/password?studentId=${data.user_id}`);
 const {data:candidates}=await admin.from("student_profiles").select("user_id,national_id_encrypted").eq("national_id_last4",nationalId.slice(-4));
 if(env.NATIONAL_ID_ENCRYPTION_KEY){
  const key=Buffer.from(env.NATIONAL_ID_ENCRYPTION_KEY,"base64");
  let matchedStudentId:string|undefined;
  if(key.length===32)for(const candidate of candidates??[]){try{const packed=Buffer.from(candidate.national_id_encrypted,"base64");if(packed.length<29)continue;const iv=packed.subarray(packed.length-12),tag=packed.subarray(packed.length-28,packed.length-12),encrypted=packed.subarray(0,packed.length-28),decipher=createDecipheriv("aes-256-gcm",key,iv);decipher.setAuthTag(tag);const decrypted=Buffer.concat([decipher.update(encrypted),decipher.final()]).toString("utf8");if(normalizeNationalId(decrypted)===nationalId){matchedStudentId=candidate.user_id;break}}catch{continue}}
  if(matchedStudentId)redirect(`/admin/students/password?studentId=${matchedStudentId}`);
 }
 if(candidates?.length===1)redirect(`/admin/students/password?studentId=${candidates[0].user_id}&lookup=fallback`);
 if((candidates??[]).length>1)redirect("/admin/students/password?error=multiple-matches");
 redirect("/admin/students/password?error=not-found");
}

export async function resetStudentPassword(formData:FormData){
 const actor=await requireAdmin();
 const parsed=z.object({studentId:z.string().uuid(),password:z.string().min(8).max(72),confirmPassword:z.string()}).refine(value=>value.password===value.confirmPassword,{path:["confirmPassword"]}).safeParse(Object.fromEntries(formData));
 const studentId=String(formData.get("studentId")??"");
 if(!parsed.success)redirect(`/admin/students/password?studentId=${studentId}&error=invalid-password`);
 const admin=createAdminClient(),{data:student}=await admin.from("profiles").select("id,role").eq("id",parsed.data.studentId).maybeSingle();
 if(student?.role!=="student")redirect("/admin/students/password?error=not-found");
 const {error}=await admin.auth.admin.updateUserById(parsed.data.studentId,{password:parsed.data.password});
 if(error)redirect(`/admin/students/password?studentId=${parsed.data.studentId}&error=account`);
 await admin.from("audit_logs").insert({actor_id:actor.id,actor_role:"admin",action:"student.password_reset",entity_type:"student",entity_id:parsed.data.studentId});
 redirect(`/admin/students/password?studentId=${parsed.data.studentId}&updated=1`);
}
