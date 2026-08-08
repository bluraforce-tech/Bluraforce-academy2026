import Link from "next/link";
import {redirect} from "next/navigation";
import {ArrowLeft} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {ExamBuilder,type InitialExam} from "@/features/exams/exam-builder";
import {requireTeacherEducationTarget} from "@/lib/teacher-education-context";

function localValue(value:string|null){if(!value)return "";return new Intl.DateTimeFormat("sv-SE",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(value)).replace(" ","T")}

export default async function EditExam({params}:{params:Promise<{examId:string}>}){
 const {examId}=await params,supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/auth/teacher/login");
 const target=await requireTeacherEducationTarget();
 let examQuery=supabase.from("exams").select("id,title,description,instructions,duration_minutes,starts_at,ends_at,status,max_attempts,randomize_questions,randomize_choices,published_version_id,parent_mock_exam_id,mock_module_position").eq("id",examId).eq("teacher_id",user.id).eq("education_system",target.educationSystem);
 examQuery=target.educationSystem==="american"?examQuery.eq("american_category",target.americanCategory):examQuery.eq("national_grade",target.nationalGrade);
 const {data:exam}=await examQuery.single();if(!exam)redirect("/teacher/exams");
 const [{data:questions},{data:latest},{data:enrollments},{data:assignments}]=await Promise.all([
  supabase.from("questions").select("id,text,image_url,page_image_url,points,position,question_choices(id,text,is_correct,position)").eq("exam_id",examId).order("position"),
  exam.published_version_id?supabase.from("exam_versions").select("passing_score").eq("id",exam.published_version_id).maybeSingle():Promise.resolve({data:null}),
  supabase.from("teacher_student_enrollments").select("student_id").eq("teacher_id",user.id).eq("status","active").or(`access_expires_at.is.null,access_expires_at.gt.${new Date().toISOString()}`),
  supabase.from("exam_assignments").select("student_id,revoked_at").eq("exam_id",examId),
 ]);
 const studentIds=(enrollments??[]).map(x=>x.student_id),{data:profiles}=studentIds.length?await supabase.from("profiles").select("id,full_name").in("id",studentIds):{data:[]};
 const imageCounts=new Map<string,number>();for(const q of questions??[])if(q.image_url)imageCounts.set(q.image_url,(imageCounts.get(q.image_url)??0)+1);
 const pageGroups=new Map<string,number>();let nextGroup=0;
 const initialQuestions=(questions??[]).map(q=>{const legacyPage=!q.page_image_url&&q.image_url&&(imageCounts.get(q.image_url)??0)>1,qImage=legacyPage?"":q.image_url??"",page=q.page_image_url??(legacyPage?q.image_url:"");if(!pageGroups.has(page))pageGroups.set(page,nextGroup++);return {text:q.text??"",imageUrl:qImage,pageImageUrl:page,points:Number(q.points),questionNumber:q.position,imageGroupIndex:pageGroups.get(page)!,choices:q.question_choices.sort((a,b)=>a.position-b.position).map(c=>({text:c.text,isCorrect:c.is_correct}))}});
 const initial:InitialExam={id:exam.id,title:exam.title,description:exam.description??"",instructions:exam.instructions??"",durationMinutes:exam.duration_minutes,startsAt:localValue(exam.starts_at),endsAt:localValue(exam.ends_at),maxAttempts:exam.max_attempts,passingScore:String(latest?.passing_score??""),randomizeQuestions:exam.randomize_questions,randomizeChoices:exam.randomize_choices,studentIds:(assignments??[]).filter(a=>!a.revoked_at).map(a=>a.student_id),questions:initialQuestions};
 return <main className="app-content exam-page"><Link className="back-link" href={exam.parent_mock_exam_id?`/teacher/exams/mock/${exam.parent_mock_exam_id}`:"/teacher/exams"}><ArrowLeft/>Back to {exam.parent_mock_exam_id?"Mock Exam":"exams"}</Link><header><div><small>{exam.parent_mock_exam_id?`Mock Exam · Module ${exam.mock_module_position}`:"Teacher workspace"}</small><h1>Edit exam</h1><p>Edit every part of the exam. Publishing creates a new immutable version for future attempts.</p></div></header><ExamBuilder students={(profiles??[]).map(x=>({id:x.id,name:x.full_name}))} initial={initial} mockModule={exam.parent_mock_exam_id?{mockExamId:exam.parent_mock_exam_id,position:exam.mock_module_position!,studentIds:initial.studentIds}:undefined}/></main>;
}
