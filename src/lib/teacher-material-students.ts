import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getTeacherMaterialStudents() {
  const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/teacher/login");
  const {data:enrollments}=await supabase.from("teacher_student_enrollments").select("student_id").eq("teacher_id",user.id).eq("status","active");
  const ids=(enrollments??[]).map(row=>row.student_id);
  const {data:students}=ids.length?await supabase.from("profiles").select("id,full_name").in("id",ids):{data:[]};
  return students??[];
}
