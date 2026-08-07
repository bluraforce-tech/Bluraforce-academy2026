"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireTeacherEducationTarget } from "@/lib/teacher-education-context";
import {uploadQuestionImage} from "@/lib/question-image-storage";
const choice=z.object({text:z.string().trim().min(1).max(500),isCorrect:z.boolean(),position:z.number().int().positive()});
const question=z.object({text:z.string().trim().max(5000),imageUrl:z.union([z.literal(""),z.string().url()]),pageImageUrl:z.union([z.literal(""),z.string().url()]).optional(),imageGroupIndex:z.number().int().nonnegative().optional(),points:z.number().positive().max(1000),position:z.number().int().positive(),choices:z.array(choice).min(2).refine(v=>v.some(c=>c.isCorrect))});
const exam=z.object({educationSystem:z.enum(["american","national"]),nationalGrade:z.enum(["sensor_1","sensor_2","sensor_3"]).nullable(),title:z.string().trim().min(3).max(200),description:z.string().max(2000),instructions:z.string().max(5000),durationMinutes:z.number().int().min(1).max(600),startsAt:z.string(),endsAt:z.string(),maxAttempts:z.number().int().min(1).max(20),passingScore:z.string(),randomizeQuestions:z.boolean(),randomizeChoices:z.boolean(),publish:z.boolean(),assignAll:z.boolean(),studentIds:z.array(z.string().uuid()),questions:z.array(question).min(1)}).refine(v=>(v.educationSystem==="american"&&v.nationalGrade===null)||(v.educationSystem==="national"&&v.nationalGrade!==null),{message:"Invalid education target"}).refine(v=>!v.startsAt||!v.endsAt||Date.parse(v.endsAt)>Date.parse(v.startsAt),{message:"End must follow start"});
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
 const target=await requireTeacherEducationTarget();let raw:unknown;try{raw={...JSON.parse(String(formData.get("payload")??"")),...target}}catch{redirect("/teacher/exams/new?error=invalid")}
 const parsed=exam.safeParse(raw);if(!parsed.success){
  const issue=parsed.error.issues[0],path=issue.path.map(String),field=path[0]??"dates";
  const reason=field==="questions"?(path.includes("choices")?"choices":path.includes("imageUrl")?"question-image":path.includes("points")||path.includes("position")?"question-points":"question-text"):field==="startsAt"||field==="endsAt"||field==="dates"?"dates":field==="educationSystem"||field==="nationalGrade"?"environment":field;
  console.error("Exam validation failed",{reason,path,code:issue.code});
  redirect(`/teacher/exams/new?error=invalid-${reason}`);
 }
 let questionsWithImages=parsed.data.questions;try{const groupIds=[...new Set(questionsWithImages.flatMap(q=>q.imageGroupIndex===undefined?[]:[q.imageGroupIndex]))];const groupImages=new Map<number,string>();for(const groupId of groupIds){const image=await uploadQuestionImage(supabase,user.id,formData.get(`questionGroupImage_${groupId}`));if(image)groupImages.set(groupId,image)}questionsWithImages=await Promise.all(questionsWithImages.map(async(question,index)=>{const individualImage=await uploadQuestionImage(supabase,user.id,formData.get(`questionImage_${index}`));return {...question,imageUrl:individualImage??(question.imageGroupIndex===undefined?question.imageUrl:""),pageImageUrl:question.imageGroupIndex===undefined?"":groupImages.get(question.imageGroupIndex)??""};}))}catch{redirect("/teacher/exams/new?error=image")}
 const payload={...parsed.data,questions:questionsWithImages,startsAt:cairoLocalToUtc(parsed.data.startsAt),endsAt:cairoLocalToUtc(parsed.data.endsAt)};
 const {data:createdExamId,error}=await supabase.rpc("create_exam_with_questions",{p_payload:payload});
 if(error){
  const reason=error.code==="PGRST202"||error.code==="42883"?"migration":error.message.includes("questions_required")||error.message.includes("invalid_question")?"questions":error.message.includes("invalid_student")?"students":error.code==="23503"?"teacher-profile":"create";
  redirect(`/teacher/exams/new?error=${reason}`);
 }
 const {error:targetError}=await supabase.from("exams").update({education_system:payload.educationSystem,national_grade:payload.nationalGrade,american_category:target.americanCategory}).eq("id",createdExamId).eq("teacher_id",user.id);
 if(targetError)redirect("/teacher/exams/new?error=create");
 revalidatePath("/teacher/exams");
 revalidatePath("/teacher/dashboard");
 redirect(`/teacher/exams?created=${payload.publish?"published":"draft"}${payload.publish?"":"&status=draft"}`);
}
export type ExamUpdateState={error:string|null};
export async function updateExam(_previous:ExamUpdateState,formData:FormData):Promise<ExamUpdateState>{
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const examId=z.string().uuid().safeParse(formData.get("examId"));if(!examId.success)return {error:"This exam identifier is invalid. Return to the Exams list and open Edit again."};
 const target=await requireTeacherEducationTarget();
 let raw:unknown;try{raw={...JSON.parse(String(formData.get("payload")??"")),...target}}catch{return {error:"The edited exam data could not be read. Your changes are still here; please try saving again."}}
 const parsed=exam.safeParse(raw);if(!parsed.success){const issue=parsed.error.issues[0],path=issue.path.map(String),field=path[0]??"dates",label=field==="questions"?(path.includes("choices")?"answer choices":path.includes("imageUrl")||path.includes("pageImageUrl")?"question image":path.includes("points")?"question points":"question text"):field==="startsAt"||field==="endsAt"||field==="dates"?"exam dates":field;return {error:`Check ${label}: ${issue.message}`};}
 let questionsWithImages=parsed.data.questions;try{const groupIds=[...new Set(questionsWithImages.flatMap(q=>q.imageGroupIndex===undefined?[]:[q.imageGroupIndex]))],groupImages=new Map<number,string>();for(const groupId of groupIds){const existing=questionsWithImages.find(q=>q.imageGroupIndex===groupId)?.pageImageUrl??"",uploaded=await uploadQuestionImage(supabase,user.id,formData.get(`questionGroupImage_${groupId}`));if(uploaded||existing)groupImages.set(groupId,uploaded??existing)}questionsWithImages=await Promise.all(questionsWithImages.map(async(q,index)=>({...q,imageUrl:await uploadQuestionImage(supabase,user.id,formData.get(`questionImage_${index}`))??q.imageUrl,pageImageUrl:q.imageGroupIndex===undefined?q.pageImageUrl??"":groupImages.get(q.imageGroupIndex)??""})))}catch{return {error:"An image could not be uploaded. Use JPG, PNG, WebP, or GIF up to 3 MB, then select that file again."}}
 const payload={...parsed.data,questions:questionsWithImages,startsAt:cairoLocalToUtc(parsed.data.startsAt),endsAt:cairoLocalToUtc(parsed.data.endsAt)};
 const {error}=await supabase.rpc("update_exam_with_questions",{p_exam_id:examId.data,p_payload:payload});
 if(error){if(error.code==="PGRST202"||error.code==="42883"||error.message.includes("page_image_url"))return {error:"The exam database is missing the latest page-image migration."};if(error.message.includes("invalid_question"))return {error:"Every question needs at least two choices and one correct answer."};if(error.message.includes("invalid_student"))return {error:"One selected student no longer has active access. Update the student selection and try again."};return {error:`The database rejected the update (${error.code||"unknown"}). ${error.message}`};}
 revalidatePath("/teacher/exams");revalidatePath(`/teacher/exams/${examId.data}/edit`);redirect("/teacher/exams?updated=1");
}
export async function updateExistingExam(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const examId=z.string().uuid().safeParse(formData.get("examId"));if(!examId.success)redirect("/teacher/exams");
 const {data:e}=await supabase.from("exams").select("id").eq("id",examId.data).eq("teacher_id",user.id).single();if(!e)redirect("/teacher/exams");
 const {data:questions}=await supabase.from("questions").select("id,position,question_choices(id,position)").eq("exam_id",examId.data).order("position");
 const payload={title:String(formData.get("title")??""),description:String(formData.get("description")??""),instructions:String(formData.get("instructions")??""),durationMinutes:Number(formData.get("durationMinutes")),startsAt:cairoLocalToUtc(String(formData.get("startsAt")??"")),endsAt:cairoLocalToUtc(String(formData.get("endsAt")??"")),maxAttempts:Number(formData.get("maxAttempts")),passingScore:String(formData.get("passingScore")??""),randomizeQuestions:formData.get("randomizeQuestions")==="on",randomizeChoices:formData.get("randomizeChoices")==="on",publish:formData.get("publish")==="on",assignAll:formData.get("assignAll")==="on",studentIds:[],questions:(questions??[]).map(q=>({text:String(formData.get(`q_${q.id}_text`)??""),imageUrl:String(formData.get(`q_${q.id}_image`)??""),points:Number(formData.get(`q_${q.id}_points`)),position:q.position,choices:(q.question_choices??[]).sort((a,b)=>a.position-b.position).map(c=>({text:String(formData.get(`c_${c.id}_text`)??""),isCorrect:formData.get(`c_${c.id}_correct`)==="on",position:c.position}))}))};
 try{for(let i=0;i<payload.questions.length;i++){const uploaded=await uploadQuestionImage(supabase,user.id,formData.get(`q_${questions![i].id}_image_file`));if(uploaded)payload.questions[i].imageUrl=uploaded}}catch{redirect(`/teacher/exams/${examId.data}/edit?error=image`)}
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
export async function deleteExam(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const examId=z.string().uuid().safeParse(formData.get("examId"));if(!examId.success)redirect("/teacher/exams?error=delete");
 const {data:exam}=await supabase.from("exams").select("kind").eq("id",examId.data).eq("teacher_id",user.id).single();
 if(!exam)redirect("/teacher/exams?error=delete");
 const destination=exam.kind==="mistakes"?"/teacher/mistakes-exams":"/teacher/exams";
 const {error}=await supabase.rpc("delete_teacher_exam",{p_exam_id:examId.data});
 if(error)redirect(`${destination}?error=${error.code==="PGRST202"||error.code==="42883"?"migration":"delete"}`);
 revalidatePath("/teacher/exams");revalidatePath("/teacher/mistakes-exams");revalidatePath("/teacher/dashboard");revalidatePath("/student/teachers");
 redirect(`${destination}?deleted=1`);
}
export async function createRandomPastExam(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const target=await requireTeacherEducationTarget();
 const input=z.object({title:z.string().trim().min(3).max(200),description:z.string().max(2000),instructions:z.string().max(5000),durationMinutes:z.coerce.number().int().min(1).max(600),questionCount:z.coerce.number().int().min(1).max(100),startsAt:z.string(),endsAt:z.string(),maxAttempts:z.coerce.number().int().min(1).max(20),passingScore:z.string(),assignAll:z.string().optional(),studentIds:z.array(z.string().uuid())}).safeParse({...Object.fromEntries(formData),studentIds:formData.getAll("studentIds")});
 if(!input.success)redirect("/teacher/exams/random?error=invalid");
 let sourceQuery=supabase.from("exams").select("id,title,questions(id,text,image_url,points,position,question_choices(text,is_correct,position))").eq("teacher_id",user.id).eq("kind","standard").eq("education_system",target.educationSystem);
 sourceQuery=target.educationSystem==="american"?sourceQuery.eq("american_category",target.americanCategory):sourceQuery.eq("national_grade",target.nationalGrade);
 const {data:examRows}=await sourceQuery;
 type Candidate={category:string;text:string;imageUrl:string;points:number;choices:Array<{text:string;isCorrect:boolean}>};
 const groups=new Map<string,Candidate[]>();
 for(const source of examRows??[])for(const question of source.questions??[]){const candidate={category:source.id,text:question.text,imageUrl:question.image_url??"",points:Number(question.points),choices:(question.question_choices??[]).sort((a,b)=>a.position-b.position).map(choice=>({text:choice.text,isCorrect:choice.is_correct}))};groups.set(source.id,[...(groups.get(source.id)??[]),candidate])}
 const weighted=(items:Candidate[])=>items.map(item=>({item,key:Math.pow(Math.random(),1/Math.max(.01,item.points))})).sort((a,b)=>b.key-a.key).map(row=>row.item);
 const queues=[...groups.values()].map(weighted),selected:Candidate[]=[];
 while(selected.length<input.data.questionCount&&queues.some(queue=>queue.length)){for(const queue of queues.sort(()=>Math.random()-.5)){const next=queue.shift();if(next)selected.push(next);if(selected.length===input.data.questionCount)break}}
 if(selected.length<input.data.questionCount)redirect("/teacher/exams/random?error=questions");
 const payload={...target,title:input.data.title,description:input.data.description,instructions:input.data.instructions,durationMinutes:input.data.durationMinutes,startsAt:cairoLocalToUtc(input.data.startsAt),endsAt:cairoLocalToUtc(input.data.endsAt),maxAttempts:input.data.maxAttempts,passingScore:input.data.passingScore,randomizeQuestions:true,randomizeChoices:true,publish:true,assignAll:input.data.assignAll==="on",studentIds:formData.getAll("studentIds"),questions:selected.map((question,index)=>({...question,position:index+1,choices:question.choices.map((choice,choiceIndex)=>({...choice,position:choiceIndex+1}))}))};
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
