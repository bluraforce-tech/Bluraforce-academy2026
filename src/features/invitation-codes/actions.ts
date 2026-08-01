"use server";
import { createHmac,randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { invitationEducationTargetSchema } from "@/lib/education-target";

export type CodeState={code?:string;error?:string};
const FIXED_ACCESS_DURATION_DAYS=30;
const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode(){
 const part=()=>Array.from({length:4},()=>alphabet[randomInt(0,alphabet.length)]).join("");
 return `${part()}-${part()}`;
}
function hashCode(code:string){
 if(!env.INVITATION_CODE_PEPPER)throw new Error("Server configuration is incomplete");
 return createHmac("sha256",env.INVITATION_CODE_PEPPER).update(code.replaceAll("-","").toUpperCase()).digest("hex");
}
async function requireTeacher(){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/auth/teacher/login");
 const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).single();
 if(profile?.role!=="teacher")redirect("/");
 return {supabase,user};
}
export async function generateInvitationCode(_:CodeState,_formData:FormData):Promise<CodeState>{
 void _;
 const parsedTarget=invitationEducationTargetSchema.safeParse({educationSystem:_formData.get("educationSystem"),nationalGrade:_formData.get("nationalGrade")||null});
 if(!parsedTarget.success)return {error:parsedTarget.error.issues[0]?.message??"Please select an educational system."};
 const target=parsedTarget.data;
 const {supabase,user}=await requireTeacher();
 for(let attempt=0;attempt<5;attempt++){
   const code=makeCode(),codeHash=hashCode(code);
   const {data,error}=await supabase.from("student_invitation_codes").insert({
     code_hash:codeHash,code_masked:`••••-${code.slice(-4)}`,teacher_id:user.id,
     created_by:user.id,status:"active",expires_at:new Date(Date.now()+2*24*60*60*1000).toISOString(),
     access_duration_days:FIXED_ACCESS_DURATION_DAYS,
     education_system:target.educationSystem,national_grade:target.nationalGrade,american_category:null,
   }).select("id").single();
   if(!error&&data){
     await supabase.from("audit_logs").insert({actor_id:user.id,actor_role:"teacher",action:"code.generated",entity_type:"invitation_code",entity_id:data.id});
     revalidatePath("/teacher/invitation-codes");
     return {code};
   }
   if(error?.code!=="23505")return {error:"The code could not be generated. Please try again."};
 }
 return {error:"The code could not be generated. Please try again."};
}
export async function revokeInvitationCode(formData:FormData){
 const {supabase,user}=await requireTeacher(),id=z.string().uuid().safeParse(formData.get("codeId"));
 if(!id.success)redirect("/teacher/invitation-codes?error=invalid");
 const {data}=await supabase.from("student_invitation_codes").update({
   status:"revoked",revoked_at:new Date().toISOString(),
 }).eq("id",id.data).eq("teacher_id",user.id).eq("status","active").select("id").maybeSingle();
 if(data)await supabase.from("audit_logs").insert({actor_id:user.id,actor_role:"teacher",action:"code.revoked",entity_type:"invitation_code",entity_id:data.id});
 revalidatePath("/teacher/invitation-codes");
 redirect("/teacher/invitation-codes");
}
export async function redeemInvitationCode(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/auth/student/login");
 const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).single();
 if(profile?.role!=="student")redirect("/");
 const input=z.object({teacherId:z.string().uuid(),code:z.string().trim().min(8).max(20)}).safeParse(Object.fromEntries(formData));
 if(!input.success)redirect("/student/teachers?error=invalid");
 const codeHash=hashCode(input.data.code.replace(/[^A-Za-z0-9]/g,"").toUpperCase());
 const {error}=await supabase.rpc("redeem_invitation_code",{p_teacher_id:input.data.teacherId,p_code_hash:codeHash});
 if(error){
   const reason=error.message.includes("wrong_teacher")?"wrong-teacher":error.message.includes("education_target_mismatch")?"classification":error.message.includes("expired")?"expired":error.message.includes("unavailable")?"used":"invalid";
   redirect(`/student/teachers?error=${reason}`);
 }
 revalidatePath("/student/teachers");
 redirect(`/student/teachers/${input.data.teacherId}/dashboard?joined=1`);
}
