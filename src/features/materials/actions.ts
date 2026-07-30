"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const schema=z.object({title:z.string().trim().min(3).max(200),description:z.string().trim().max(2000),materialType:z.string().trim().min(2).max(80),externalUrl:z.string().url().refine(v=>v.startsWith("https://")),coverImageUrl:z.union([z.literal(""),z.string().url().refine(v=>v.startsWith("https://"))]),availableFrom:z.string(),availableUntil:z.string(),publish:z.string().optional(),assignAll:z.string().optional(),studentIds:z.array(z.string().uuid())}).refine(v=>!v.availableFrom||!v.availableUntil||Date.parse(v.availableUntil)>Date.parse(v.availableFrom));
export async function createMaterialBook(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const parsed=schema.safeParse({...Object.fromEntries(formData),studentIds:formData.getAll("studentIds").map(String)});if(!parsed.success)redirect("/teacher/materials/new?error=invalid");const input=parsed.data;
 const {data:material,error}=await supabase.from("materials").insert({teacher_id:user.id,title:input.title,description:input.description||null,material_type:input.materialType,external_drive_url:input.externalUrl,storage_path:null,cover_image_url:input.coverImageUrl||null,available_from:input.availableFrom?new Date(input.availableFrom).toISOString():null,available_until:input.availableUntil?new Date(input.availableUntil).toISOString():null,status:input.publish==="on"?"published":"draft"}).select("id").single();
 if(error||!material)redirect("/teacher/materials/new?error=create");
 if(input.publish==="on"){let ids=input.studentIds;if(input.assignAll==="on"){const {data:e}=await supabase.from("teacher_student_enrollments").select("student_id").eq("teacher_id",user.id).eq("status","active").or(`access_expires_at.is.null,access_expires_at.gt.${new Date().toISOString()}`);ids=(e??[]).map(x=>x.student_id)}if(ids.length){const {error:a}=await supabase.from("material_assignments").insert(ids.map(student_id=>({material_id:material.id,student_id})));if(a){await supabase.from("materials").delete().eq("id",material.id);redirect("/teacher/materials/new?error=assign")}}}
 await supabase.from("audit_logs").insert({actor_id:user.id,actor_role:"teacher",action:"material.created",entity_type:"material_book",entity_id:material.id});revalidatePath("/teacher/materials");revalidatePath("/student/teachers");redirect("/teacher/materials?created=1");
}
