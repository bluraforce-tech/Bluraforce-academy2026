import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
type Results={title:string;results:Array<{attemptId:string;studentName:string;attemptNumber:number;status:string;score:number|null;totalPoints:number;startedAt:string;submittedAt:string|null}>};
export default async function Page({params}:{params:Promise<{examId:string}>}){
 const {examId}=await params,supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const {data,error}=await supabase.rpc("get_teacher_exam_results",{p_exam_id:examId});if(error||!data)redirect("/teacher/exams");const exam=data as Results;
 return <main className="app-content exam-page"><Link className="back-link" href="/teacher/exams"><ArrowLeft size={16}/>Back to exams</Link><header><div><small>Teacher workspace</small><h1>{exam.title} results</h1><p>Review student scores, attempts, and mistakes.</p></div></header><section className="panel records-panel">{exam.results.length===0?<div className="empty-state"><span><FileText/></span><h2>No attempts yet</h2><p>Student results will appear here.</p></div>:<div className="records">{exam.results.map(r=><article key={r.attemptId}><div><b>{r.studentName}</b><small>Attempt {r.attemptNumber} · {r.status.replace("_"," ")}</small></div><div className="record-actions"><strong>{r.score===null?"Not submitted":`${r.score} / ${r.totalPoints}`}</strong><time>{new Date(r.submittedAt??r.startedAt).toLocaleString()}</time><Link className="button secondary small" href={`/teacher/exams/attempts/${r.attemptId}/results`}>Review</Link></div></article>)}</div>}</section></main>;
}
