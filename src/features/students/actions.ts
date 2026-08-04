"use server";
import {createHmac} from "crypto";
import {redirect} from "next/navigation";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {env} from "@/lib/env";
import {normalizeNationalId} from "@/features/auth/schemas";

async function requireAdmin(){const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/admin/login");const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).single();if(profile?.role!=="admin")redirect("/");return user}

export async function findStudentForPasswordReset(formData:FormData){
 await requireAdmin();
 if(!env.NATIONAL_ID_HMAC_SECRET)throw new Error("Server configuration is incomplete");
 const nationalId=normalizeNationalId(String(formData.get("nationalId")??""));
 if(!/^\d{14}$/.test(nationalId))redirect("/admin/students/password?error=invalid-id");
 const hash=createHmac("sha256",env.NATIONAL_ID_HMAC_SECRET).update(nationalId).digest("hex");
 const {data}=await createAdminClient().from("student_profiles").select("user_id").eq("national_id_hash",hash).maybeSingle();
 if(!data)redirect("/admin/students/password?error=not-found");
 redirect(`/admin/students/password?studentId=${data.user_id}`);
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
