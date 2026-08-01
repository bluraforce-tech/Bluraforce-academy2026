"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseEducationTarget } from "@/lib/education-target";
import { TEACHER_EDUCATION_COOKIE } from "@/lib/teacher-education-context";

export async function selectTeacherEnvironment(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).single();if(profile?.role!=="teacher")redirect("/");
 const parsed=parseEducationTarget({educationSystem:formData.get("educationSystem"),americanCategory:formData.get("americanCategory"),nationalGrade:formData.get("nationalGrade")});
 if(!parsed.success)redirect("/teacher/dashboard?error=environment");
 (await cookies()).set(TEACHER_EDUCATION_COOKIE,JSON.stringify(parsed.data),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*12});
 redirect("/teacher/dashboard");
}
