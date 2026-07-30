"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { extractYouTubeId } from "./youtube";

const schema=z.object({
 title:z.string().trim().min(3).max(200),description:z.string().trim().max(2000),
 youtubeUrl:z.string().url(),lessonName:z.string().trim().max(200),categoryName:z.string().trim().max(200),
 maxViews:z.union([z.literal(""),z.coerce.number().int().positive().max(10000)]),
 availableFrom:z.string(),availableUntil:z.string(),publish:z.string().optional(),assignAll:z.string().optional(),
 studentIds:z.union([z.string().uuid(),z.array(z.string().uuid())]).optional(),
}).refine(v=>!v.availableFrom||!v.availableUntil||Date.parse(v.availableUntil)>Date.parse(v.availableFrom),{message:"Invalid availability"});
export async function createLessonVideo(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const raw=Object.fromEntries(formData);const ids=formData.getAll("studentIds").map(String);const parsed=schema.safeParse({...raw,studentIds:ids});
 if(!parsed.success)redirect("/teacher/videos/new?error=invalid");const input=parsed.data,videoId=extractYouTubeId(input.youtubeUrl);
 if(!videoId)redirect("/teacher/videos/new?error=youtube");
 const {data:video,error}=await supabase.from("lesson_videos").insert({
  teacher_id:user.id,title:input.title,description:input.description||null,youtube_video_id:videoId,
  thumbnail_url:`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,lesson_name:input.lessonName||null,
  category_name:input.categoryName||null,status:input.publish==="on"?"published":"draft",
 }).select("id").single();
 if(error||!video)redirect("/teacher/videos/new?error=create");
 if(input.publish==="on"){
  let studentIds=ids;
  if(input.assignAll==="on"){const {data:enrollments}=await supabase.from("teacher_student_enrollments").select("student_id").eq("teacher_id",user.id).eq("status","active").or(`access_expires_at.is.null,access_expires_at.gt.${new Date().toISOString()}`);studentIds=(enrollments??[]).map(e=>e.student_id)}
  if(studentIds.length){const {error:assignmentError}=await supabase.from("video_assignments").insert(studentIds.map(studentId=>({
   video_id:video.id,student_id:studentId,available_from:input.availableFrom?new Date(input.availableFrom).toISOString():null,
   available_until:input.availableUntil?new Date(input.availableUntil).toISOString():null,max_views:input.maxViews===""?null:input.maxViews,
  })));if(assignmentError){await supabase.from("lesson_videos").delete().eq("id",video.id);redirect("/teacher/videos/new?error=assign")}}
 }
 await supabase.from("audit_logs").insert({actor_id:user.id,actor_role:"teacher",action:"video.created",entity_type:"lesson_video",entity_id:video.id});
 revalidatePath("/teacher/videos");revalidatePath("/student/teachers");redirect("/teacher/videos?created=1");
}

export async function updateLessonVideo(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const videoKey=z.string().uuid().safeParse(formData.get("videoId")),raw=Object.fromEntries(formData),ids=formData.getAll("studentIds").map(String),parsed=schema.safeParse({...raw,studentIds:ids});
 if(!videoKey.success||!parsed.success)redirect(`/teacher/videos/${String(formData.get("videoId"))}/edit?error=invalid`);
 const input=parsed.data,videoId=extractYouTubeId(input.youtubeUrl);if(!videoId)redirect(`/teacher/videos/${videoKey.data}/edit?error=youtube`);
 const {data:video,error}=await supabase.from("lesson_videos").update({
  title:input.title,description:input.description||null,youtube_video_id:videoId,
  thumbnail_url:`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,lesson_name:input.lessonName||null,
  category_name:input.categoryName||null,status:input.publish==="on"?"published":"draft",updated_at:new Date().toISOString(),
 }).eq("id",videoKey.data).eq("teacher_id",user.id).select("id").single();
 if(error||!video)redirect(`/teacher/videos/${videoKey.data}/edit?error=update`);

 let targetIds=ids;
 if(input.assignAll==="on"){const {data:enrollments}=await supabase.from("teacher_student_enrollments").select("student_id").eq("teacher_id",user.id).eq("status","active").or(`access_expires_at.is.null,access_expires_at.gt.${new Date().toISOString()}`);targetIds=(enrollments??[]).map(e=>e.student_id)}
 const from=input.availableFrom?new Date(input.availableFrom).toISOString():null,until=input.availableUntil?new Date(input.availableUntil).toISOString():null,max=input.maxViews===""?null:input.maxViews;
 const {data:existing}=await supabase.from("video_assignments").select("student_id,counted_views").eq("video_id",video.id);
 const existingIds=(existing??[]).map(a=>a.student_id),removed=existingIds.filter(id=>!targetIds.includes(id)),existingByStudent=new Map((existing??[]).map(a=>[a.student_id,a]));
 if(removed.length)await supabase.from("video_assignments").update({revoked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("video_id",video.id).in("student_id",removed);
 if(targetIds.length){const assignmentRows=targetIds.map(studentId=>{const raw=String(formData.get(`remainingViews_${studentId}`)??"").trim(),remaining=raw===""?null:Number(raw),counted=existingByStudent.get(studentId)?.counted_views??0;if(remaining!==null&&(!Number.isInteger(remaining)||remaining<1||remaining>10000))redirect(`/teacher/videos/${video.id}/edit?error=views`);return {
  video_id:video.id,student_id:studentId,available_from:from,available_until:until,max_views:remaining===null?max:counted+remaining,revoked_at:input.publish==="on"?null:new Date().toISOString(),updated_at:new Date().toISOString(),
 }});const {error:assignmentError}=await supabase.from("video_assignments").upsert(assignmentRows,{onConflict:"video_id,student_id"});if(assignmentError)redirect(`/teacher/videos/${video.id}/edit?error=assign`)}
 if(input.publish!=="on")await supabase.from("video_assignments").update({revoked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("video_id",video.id);
 await supabase.from("audit_logs").insert({actor_id:user.id,actor_role:"teacher",action:"video.updated",entity_type:"lesson_video",entity_id:video.id});
 revalidatePath("/teacher/videos");revalidatePath("/student/teachers");redirect("/teacher/videos?updated=1");
}
