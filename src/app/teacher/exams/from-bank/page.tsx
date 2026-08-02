import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ExamBuilder, type BankQuestion } from "@/features/exams/exam-builder";
import { requireTeacherEducationTarget } from "@/lib/teacher-education-context";

export default async function ExamFromBankPage(){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");const target=await requireTeacherEducationTarget();
 let examQuery=supabase.from("exams").select("id,title,questions(id,text,image_url,points,position,question_choices(text,is_correct,position))").eq("teacher_id",user.id).eq("kind","standard").eq("education_system",target.educationSystem);
 examQuery=target.educationSystem==="american"?examQuery.eq("american_category",target.americanCategory):examQuery.eq("national_grade",target.nationalGrade);
 const [{data:enrollments},{data:examRows}]=await Promise.all([
  supabase.from("teacher_student_enrollments").select("student_id").eq("teacher_id",user.id).eq("status","active").or(`access_expires_at.is.null,access_expires_at.gt.${new Date().toISOString()}`),
  examQuery.order("created_at",{ascending:false}),
 ]);
 const ids=(enrollments??[]).map((row)=>row.student_id);
 const {data:profiles}=ids.length?await supabase.from("profiles").select("id,full_name").in("id",ids):{data:[]};
 const questionBank:BankQuestion[]=(examRows??[]).flatMap((exam)=>(exam.questions??[]).sort((a,b)=>a.position-b.position).map((question)=>({
  sourceId:question.id,sourceTitle:exam.title,text:question.text,imageUrl:question.image_url??"",points:Number(question.points),
  choices:(question.question_choices??[]).sort((a,b)=>a.position-b.position).map((choice)=>({text:choice.text,isCorrect:choice.is_correct})),
 })));
 return <main className="app-content exam-page"><Link className="back-link" href="/teacher/exams"><ArrowLeft/>Back to exams</Link><header><div><small>Teacher workspace</small><h1>Make an exam from old pages</h1><p>Preview and reuse complete uploaded pages with all of their questions.</p></div></header>{questionBank.length===0&&<p className="form-error">No old exam pages are available yet. Create a regular exam first.</p>}<ExamBuilder students={(profiles??[]).map((profile)=>({id:profile.id,name:profile.full_name}))} questionBank={questionBank}/></main>;
}
