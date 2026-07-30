"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const choice=z.object({text:z.string().trim().min(1).max(500),isCorrect:z.boolean(),position:z.number().int().positive()});
const question=z.object({text:z.string().trim().min(1).max(5000),imageUrl:z.union([z.literal(""),z.string().url()]),points:z.number().positive().max(1000),position:z.number().int().positive(),choices:z.array(choice).min(2).refine(v=>v.some(c=>c.isCorrect))});
const exam=z.object({title:z.string().trim().min(3).max(200),description:z.string().max(2000),instructions:z.string().max(5000),durationMinutes:z.number().int().min(1).max(600),startsAt:z.string(),endsAt:z.string(),maxAttempts:z.number().int().min(1).max(20),passingScore:z.string(),randomizeQuestions:z.boolean(),randomizeChoices:z.boolean(),publish:z.boolean(),assignAll:z.boolean(),studentIds:z.array(z.string().uuid()),questions:z.array(question).min(1)}).refine(v=>!v.startsAt||!v.endsAt||Date.parse(v.endsAt)>Date.parse(v.startsAt),{message:"End must follow start"});
function cairoLocalToUtc(value:string){
 if(!value)return "";
 const [date,time]=value.split("T"),[year,month,day]=date.split("-").map(Number),[hour,minute]=time.split(":").map(Number);
 const target=Date.UTC(year,month-1,day,hour,minute),formatter=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
 const parts=Object.fromEntries(formatter.formatToParts(new Date(target)).filter(p=>p.type!=="literal").map(p=>[p.type,Number(p.value)]));
 const represented=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute);
 return new Date(target+(target-represented)).toISOString();
}
export async function createExam(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 let raw:unknown;try{raw=JSON.parse(String(formData.get("payload")??""))}catch{redirect("/teacher/exams/new?error=invalid")}
 const parsed=exam.safeParse(raw);if(!parsed.success)redirect("/teacher/exams/new?error=invalid");
 const payload={...parsed.data,startsAt:cairoLocalToUtc(parsed.data.startsAt),endsAt:cairoLocalToUtc(parsed.data.endsAt)};
 const {error}=await supabase.rpc("create_exam_with_questions",{p_payload:payload});
 if(error){
  const reason=error.code==="PGRST202"||error.code==="42883"?"migration":error.message.includes("questions_required")||error.message.includes("invalid_question")?"questions":error.message.includes("invalid_student")?"students":error.code==="23503"?"teacher-profile":"create";
  redirect(`/teacher/exams/new?error=${reason}`);
 }
 revalidatePath("/teacher/exams");
 revalidatePath("/teacher/dashboard");
 redirect("/teacher/exams?created=1");
}
export async function updateExam(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const examId=z.string().uuid().safeParse(formData.get("examId"));let raw:unknown;try{raw=JSON.parse(String(formData.get("payload")??""))}catch{redirect("/teacher/exams")}
 const parsed=exam.safeParse(raw);if(!examId.success||!parsed.success)redirect(`/teacher/exams/${String(formData.get("examId"))}/edit?error=invalid`);
 const payload={...parsed.data,startsAt:cairoLocalToUtc(parsed.data.startsAt),endsAt:cairoLocalToUtc(parsed.data.endsAt)};
 const {error}=await supabase.rpc("update_exam_with_questions",{p_exam_id:examId.data,p_payload:payload});
 if(error){const reason=error.code==="PGRST202"?"migration":error.message.includes("invalid_question")?"questions":"update";redirect(`/teacher/exams/${examId.data}/edit?error=${reason}`)}
 revalidatePath("/teacher/exams");revalidatePath(`/teacher/exams/${examId.data}/edit`);redirect("/teacher/exams?updated=1");
}
export async function updateExistingExam(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const examId=z.string().uuid().safeParse(formData.get("examId"));if(!examId.success)redirect("/teacher/exams");
 const {data:e}=await supabase.from("exams").select("id").eq("id",examId.data).eq("teacher_id",user.id).single();if(!e)redirect("/teacher/exams");
 const {data:questions}=await supabase.from("questions").select("id,position,question_choices(id,position)").eq("exam_id",examId.data).order("position");
 const payload={title:String(formData.get("title")??""),description:String(formData.get("description")??""),instructions:String(formData.get("instructions")??""),durationMinutes:Number(formData.get("durationMinutes")),startsAt:cairoLocalToUtc(String(formData.get("startsAt")??"")),endsAt:cairoLocalToUtc(String(formData.get("endsAt")??"")),maxAttempts:Number(formData.get("maxAttempts")),passingScore:String(formData.get("passingScore")??""),randomizeQuestions:formData.get("randomizeQuestions")==="on",randomizeChoices:formData.get("randomizeChoices")==="on",publish:formData.get("publish")==="on",assignAll:formData.get("assignAll")==="on",studentIds:[],questions:(questions??[]).map(q=>({text:String(formData.get(`q_${q.id}_text`)??""),imageUrl:String(formData.get(`q_${q.id}_image`)??""),points:Number(formData.get(`q_${q.id}_points`)),position:q.position,choices:(q.question_choices??[]).sort((a,b)=>a.position-b.position).map(c=>({text:String(formData.get(`c_${c.id}_text`)??""),isCorrect:formData.get(`c_${c.id}_correct`)==="on",position:c.position}))}))};
 const parsed=exam.safeParse(payload);if(!parsed.success)redirect(`/teacher/exams/${examId.data}/edit?error=invalid`);
 const {error}=await supabase.rpc("update_exam_with_questions",{p_exam_id:examId.data,p_payload:parsed.data});if(error)redirect(`/teacher/exams/${examId.data}/edit?error=update`);
 revalidatePath("/teacher/exams");redirect("/teacher/exams?updated=1");
}
export async function startExamNow(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const examId=z.string().uuid().safeParse(formData.get("examId"));if(!examId.success)redirect("/teacher/exams");
 const {data:exam}=await supabase.from("exams").select("duration_minutes,ends_at").eq("id",examId.data).eq("teacher_id",user.id).eq("status","published").single();
 if(!exam)redirect("/teacher/exams?error=not-found");
 const now=new Date(),minimumEnd=new Date(now.getTime()+exam.duration_minutes*60_000);
 const endsAt=!exam.ends_at||Date.parse(exam.ends_at)<=minimumEnd.getTime()?minimumEnd.toISOString():exam.ends_at;
 const {error}=await supabase.from("exams").update({starts_at:new Date(now.getTime()-5000).toISOString(),ends_at:endsAt,updated_at:now.toISOString()}).eq("id",examId.data).eq("teacher_id",user.id);
 if(error)redirect("/teacher/exams?error=start-now");
 revalidatePath("/teacher/exams");revalidatePath("/student/teachers");redirect("/teacher/exams?started=1");
}
export async function toggleExamVisibility(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const examId=z.string().uuid().safeParse(formData.get("examId"));if(!examId.success)redirect("/teacher/exams?error=visibility");
 const {data:exam}=await supabase.from("exams").select("status").eq("id",examId.data).eq("teacher_id",user.id).eq("kind","standard").single();
 if(!exam||!["published","archived"].includes(exam.status))redirect("/teacher/exams?error=visibility");
 const nextStatus=exam.status==="published"?"archived":"published";
 const {error}=await supabase.from("exams").update({status:nextStatus,updated_at:new Date().toISOString()}).eq("id",examId.data).eq("teacher_id",user.id);
 if(error)redirect("/teacher/exams?error=visibility");
 revalidatePath("/teacher/exams");
 revalidatePath("/student/teachers");
 revalidatePath("/student/teachers/[teacherId]/exams","page");
 redirect(`/teacher/exams?visibility=${nextStatus==="published"?"shown":"hidden"}`);
}
export async function toggleMistakesExamVisibility(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const input=z.object({assignmentId:z.string().uuid(),visible:z.enum(["true","false"])}).safeParse(Object.fromEntries(formData));
 if(!input.success)redirect("/teacher/mistakes-exams?error=visibility");
 const {data:assignment}=await supabase.from("exam_assignments").select("id,exam_id,exams!inner(teacher_id,kind)").eq("id",input.data.assignmentId).eq("exams.teacher_id",user.id).eq("exams.kind","mistakes").single();
 if(!assignment)redirect("/teacher/mistakes-exams?error=visibility");
 const {error}=await supabase.from("exam_assignments").update({revoked_at:input.data.visible==="true"?null:new Date().toISOString()}).eq("id",assignment.id);
 if(error)redirect("/teacher/mistakes-exams?error=visibility");
 revalidatePath("/teacher/mistakes-exams");revalidatePath("/student/teachers");revalidatePath("/student/teachers/[teacherId]/mistakes-exams","page");
 redirect(`/teacher/mistakes-exams?visibility=${input.data.visible==="true"?"shown":"hidden"}`);
}
export async function createRandomPastExam(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const input=z.object({title:z.string().trim().min(3).max(200),description:z.string().max(2000),instructions:z.string().max(5000),durationMinutes:z.coerce.number().int().min(1).max(600),questionCount:z.coerce.number().int().min(1).max(100),startsAt:z.string(),endsAt:z.string(),maxAttempts:z.coerce.number().int().min(1).max(20),passingScore:z.string(),assignAll:z.string().optional(),studentIds:z.array(z.string().uuid())}).safeParse({...Object.fromEntries(formData),studentIds:formData.getAll("studentIds")});
 if(!input.success)redirect("/teacher/exams/random?error=invalid");
 const {data:examRows}=await supabase.from("exams").select("id,title,questions(id,text,image_url,points,position,question_choices(text,is_correct,position))").eq("teacher_id",user.id).eq("kind","standard");
 type Candidate={category:string;text:string;imageUrl:string;points:number;choices:Array<{text:string;isCorrect:boolean}>};
 const groups=new Map<string,Candidate[]>();
 for(const source of examRows??[])for(const question of source.questions??[]){const candidate={category:source.id,text:question.text,imageUrl:question.image_url??"",points:Number(question.points),choices:(question.question_choices??[]).sort((a,b)=>a.position-b.position).map(choice=>({text:choice.text,isCorrect:choice.is_correct}))};groups.set(source.id,[...(groups.get(source.id)??[]),candidate])}
 const weighted=(items:Candidate[])=>items.map(item=>({item,key:Math.pow(Math.random(),1/Math.max(.01,item.points))})).sort((a,b)=>b.key-a.key).map(row=>row.item);
 const queues=[...groups.values()].map(weighted),selected:Candidate[]=[];
 while(selected.length<input.data.questionCount&&queues.some(queue=>queue.length)){for(const queue of queues.sort(()=>Math.random()-.5)){const next=queue.shift();if(next)selected.push(next);if(selected.length===input.data.questionCount)break}}
 if(selected.length<input.data.questionCount)redirect("/teacher/exams/random?error=questions");
 const payload={title:input.data.title,description:input.data.description,instructions:input.data.instructions,durationMinutes:input.data.durationMinutes,startsAt:cairoLocalToUtc(input.data.startsAt),endsAt:cairoLocalToUtc(input.data.endsAt),maxAttempts:input.data.maxAttempts,passingScore:input.data.passingScore,randomizeQuestions:true,randomizeChoices:true,publish:true,assignAll:input.data.assignAll==="on",studentIds:formData.getAll("studentIds"),questions:selected.map((question,index)=>({...question,position:index+1,choices:question.choices.map((choice,choiceIndex)=>({...choice,position:choiceIndex+1}))}))};
 const {error}=await supabase.rpc("create_exam_with_questions",{p_payload:payload});
 if(error)redirect("/teacher/exams/random?error=create");
 revalidatePath("/teacher/exams");redirect("/teacher/exams?created=1");
}
export async function startAttempt(formData:FormData){
 const assignmentId=z.string().uuid().safeParse(formData.get("assignmentId")),teacherId=z.string().uuid().safeParse(formData.get("teacherId"));if(!assignmentId.success||!teacherId.success)redirect("/student/teachers");
 const supabase=await createClient();const {data,error}=await supabase.rpc("start_exam_attempt",{p_assignment_id:assignmentId.data});
 if(error||!data){const reason=error?.message.includes("max_attempts")?"attempts":error?.message.includes("exam_unavailable")?"unavailable":error?.message.includes("forbidden")?"assigned":"start";redirect(`/student/teachers/${teacherId.data}/exams?error=${reason}`)}
 const attempt=Array.isArray(data)?data[0]:data as {id:string};redirect(`/student/exams/attempts/${attempt.id}`);
}
export async function submitAttempt(formData:FormData){
 const attemptId=z.string().uuid().safeParse(formData.get("attemptId"));if(!attemptId.success)redirect("/student/teachers");
 const supabase=await createClient();await supabase.rpc("submit_exam_attempt",{p_attempt_id:attemptId.data});redirect(`/student/exams/attempts/${attemptId.data}`);
}
