import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ExamBuilder } from "@/features/exams/exam-builder";
const messages:Record<string,string>={invalid:"Check the exam fields, dates, questions, choices, and correct answers.",migration:"The Exams database migration is not installed. Apply migration 202607300008_complete_exams.sql.",questions:"Every question needs at least two choices and one correct answer.",students:"One or more selected students no longer have active access.", "teacher-profile":"Your teacher profile is incomplete. Ask the administrator to recreate or repair it.",create:"The exam could not be created. Confirm that migrations 005 through 008 were applied in order."};
export default async function NewExam({searchParams}:{searchParams:Promise<{error?:string}>}){
 const query=await searchParams,supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const {data:p}=await supabase.from("profiles").select("role").eq("id",user.id).single();if(p?.role!=="teacher")redirect("/");
 const {data:enrollments}=await supabase.from("teacher_student_enrollments").select("student_id").eq("teacher_id",user.id).eq("status","active").or(`access_expires_at.is.null,access_expires_at.gt.${new Date().toISOString()}`);
 const ids=(enrollments??[]).map(x=>x.student_id),{data:profiles}=ids.length?await supabase.from("profiles").select("id,full_name").in("id",ids):{data:[]};
 return <main className="app-content exam-page"><Link className="back-link" href="/teacher/exams"><ArrowLeft/>Back to exams</Link><header><div><small>Teacher workspace</small><h1>Create exam</h1><p>Build a timed, versioned assessment with exact-set scoring.</p></div></header>{query.error&&<p className="form-error" role="alert">{messages[query.error]??messages.create}</p>}<ExamBuilder students={(profiles??[]).map(x=>({id:x.id,name:x.full_name}))}/></main>;
}
