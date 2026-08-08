"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const teacherSchema=z.object({
  displayName:z.string().trim().min(3).max(120),
  email:z.string().trim().toLowerCase().email(),
  password:z.string().min(8).max(72),
  imageUrl:z.union([z.literal(""),z.string().url().refine(value=>value.startsWith("https://"),"HTTPS required")]),
  biography:z.string().trim().max(1000),
  isActive:z.string().optional(),
});
const teacherUpdateSchema=teacherSchema.omit({password:true}).extend({
  teacherId:z.string().uuid(),
  password:z.union([z.literal(""),z.string().min(8).max(72)]),
  accessDurationDays:z.coerce.number().int().min(1).max(3650),
});

export async function createTeacher(formData:FormData){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/admin/login");
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).single();
  if(profile?.role!=="admin")redirect("/");

  const parsed=teacherSchema.safeParse(Object.fromEntries(formData));
  if(!parsed.success)redirect("/admin/teachers/new?error=invalid");
  const admin=createAdminClient(),input=parsed.data;
  const {data:created,error:authError}=await admin.auth.admin.createUser({
    email:input.email,password:input.password,email_confirm:true,
    user_metadata:{full_name:input.displayName},
  });
  if(authError||!created.user)redirect(`/admin/teachers/new?error=${authError?.code==="email_exists"?"email":"account"}`);

  const teacherId=created.user.id;
  const {error:profileError}=await admin.from("profiles").upsert({
    id:teacherId,role:"teacher",full_name:input.displayName,updated_at:new Date().toISOString(),
  },{onConflict:"id"});
  const {error:teacherError}=profileError?{error:profileError}:await admin.from("teacher_profiles").insert({
    user_id:teacherId,display_name:input.displayName,image_url:input.imageUrl||null,
    biography:input.biography||null,is_active:input.isActive==="on",
  });
  const {error:settingsError}=teacherError?{error:teacherError}:await admin.from("teacher_settings").insert({teacher_id:teacherId});

  if(profileError||teacherError||settingsError){
    await admin.from("teacher_settings").delete().eq("teacher_id",teacherId);
    await admin.from("teacher_profiles").delete().eq("user_id",teacherId);
    await admin.auth.admin.deleteUser(teacherId);
    redirect("/admin/teachers/new?error=profile");
  }
  await admin.from("audit_logs").insert({
    actor_id:user.id,actor_role:"admin",action:"teacher.created",
    entity_type:"teacher",entity_id:teacherId,metadata:{email:input.email,is_active:input.isActive==="on"},
  });
  redirect("/admin/teachers?created=1");
}

export async function updateTeacher(formData:FormData){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/admin/login");
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).single();
  if(profile?.role!=="admin")redirect("/");
  const parsed=teacherUpdateSchema.safeParse(Object.fromEntries(formData));
  const teacherId=String(formData.get("teacherId")??"");
  if(!parsed.success)redirect(`/admin/teachers/${teacherId}/edit?error=invalid`);
  const input=parsed.data,admin=createAdminClient();
  const {data:existing}=await admin.from("teacher_profiles").select("user_id").eq("user_id",input.teacherId).maybeSingle();
  if(!existing)redirect("/admin/teachers");
  const {error:profileError}=await admin.from("profiles").update({
    full_name:input.displayName,updated_at:new Date().toISOString(),
  }).eq("id",input.teacherId).eq("role","teacher");
  const {error:teacherError}=profileError?{error:profileError}:await admin.from("teacher_profiles").update({
    display_name:input.displayName,image_url:input.imageUrl||null,
    biography:input.biography||null,is_active:input.isActive==="on",access_duration_days:input.accessDurationDays,
  }).eq("user_id",input.teacherId);
  if(profileError||teacherError)redirect(`/admin/teachers/${input.teacherId}/edit?error=profile`);
  const authChanges:{email:string;user_metadata:{full_name:string};password?:string}={
    email:input.email,user_metadata:{full_name:input.displayName},
  };
  if(input.password)authChanges.password=input.password;
  const {error:authError}=await admin.auth.admin.updateUserById(input.teacherId,authChanges);
  if(authError)redirect(`/admin/teachers/${input.teacherId}/edit?error=${authError.code==="email_exists"?"email":"account"}`);
  await admin.from("audit_logs").insert({
    actor_id:user.id,actor_role:"admin",action:"teacher.updated",
    entity_type:"teacher",entity_id:input.teacherId,
    metadata:{email:input.email,is_active:input.isActive==="on",access_duration_days:input.accessDurationDays},
  });
  redirect("/admin/teachers?updated=1");
}
