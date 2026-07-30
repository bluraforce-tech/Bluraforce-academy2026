import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft,CheckCircle2,XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
type Result={examId:string;title:string;studentName:string;attemptNumber:number;score:number|null;totalPoints:number;questions:Array<{id:string;text:string;imageUrl:string|null;points:number;awardedPoints:number;isCorrect:boolean;choices:Array<{id:string;text:string;isCorrect:boolean;selected:boolean}>}>};
export default async function Page({params}:{params:Promise<{attemptId:string}>}){
 const {attemptId}=await params,supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const {data,error}=await supabase.rpc("get_teacher_attempt_result",{p_attempt_id:attemptId});if(error||!data)redirect("/teacher/exams");const result=data as Result;
 return <main className="attempt-page result-page"><Link className="back-link" href={`/teacher/exams/${result.examId}/results`}><ArrowLeft size={16}/>Back to student results</Link><header><small>Teacher review · Attempt {result.attemptNumber}</small><h1>{result.studentName}</h1><p>{result.title} · Score: <strong>{result.score??0} / {result.totalPoints}</strong></p></header>{result.questions.map((q,i)=><section className={`panel result-question ${q.isCorrect?"correct":"incorrect"}`} key={q.id}><div className="result-heading"><span>{q.isCorrect?<CheckCircle2/>:<XCircle/>}Question {i+1}</span><b>{q.awardedPoints} / {q.points} points</b></div><h2>{q.text}</h2>{q.imageUrl&&<img src={q.imageUrl} alt="Question"/>}<div className="result-choices">{q.choices.map(c=><div className={`${c.isCorrect?"correct-choice":""} ${c.selected?"selected-choice":""}`} key={c.id}><span>{c.text}</span><small>{c.isCorrect?"Correct answer":""}{c.selected?`${c.isCorrect?" · ":""}Student answer`:""}</small></div>)}</div></section>)}</main>;
}
