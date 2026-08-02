import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireTeacherEducationTarget } from "@/lib/teacher-education-context";
type Results={title:string;results:Array<{attemptId:string;studentName:string;attemptNumber:number;status:string;score:number|null;totalPoints:number;startedAt:string;submittedAt:string|null}>};
export default async function Page({params}:{params:Promise<{examId:string}>}){
 const {examId}=await params,supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");const target=await requireTeacherEducationTarget();
 let sourceQuery=supabase.from("exams").select("kind,source_unit_id").eq("id",examId).eq("teacher_id",user.id).eq("education_system",target.educationSystem);
 sourceQuery=target.educationSystem==="american"?sourceQuery.eq("american_category",target.americanCategory):sourceQuery.eq("national_grade",target.nationalGrade);
 const {data:source}=await sourceQuery.single();if(!source)redirect("/teacher/exams");
 const {data,error}=await supabase.rpc("get_teacher_exam_results",{p_exam_id:examId});if(error||!data)redirect("/teacher/exams");const exam=data as Results;
 const activity=source?.source_unit_id&&["self_practice","homework"].includes(source.kind);const backHref=activity?`/teacher/question-bank/${source.source_unit_id}/${source.kind}`:"/teacher/exams";
 return <main className="app-content exam-page"><Link className="back-link" href={backHref}><ArrowLeft size={16}/>Back to {activity?source.kind==="homework"?"Homework":"Self Practice":"exams"}</Link><header><div><small>Teacher workspace</small><h1>{exam.title} results</h1><p>Review student submissions, scores, and answers.</p></div></header><section className="panel records-panel">{exam.results.length===0?<div className="empty-state"><span><FileText/></span><h2>No submissions yet</h2><p>Student scores will appear here after they start or submit this activity.</p></div>:<div className="records">{exam.results.map(r=><article key={r.attemptId}><div><b>{r.studentName}</b><small>Attempt {r.attemptNumber} · {r.status.replace("_"," ")}</small></div><div className="record-actions"><strong>{r.score===null?"Not submitted":`${r.score} / ${r.totalPoints}`}</strong><time>{new Date(r.submittedAt??r.startedAt).toLocaleString()}</time><Link className="button secondary small" href={`/teacher/exams/attempts/${r.attemptId}/results`}>Review answers</Link></div></article>)}</div>}</section></main>;
}
