"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {requireTeacherEducationTarget} from "@/lib/teacher-education-context";

function cairoLocalToUtc(value:string){if(!value)return null;const [date,time]=value.split("T"),[year,month,day]=date.split("-").map(Number),[hour,minute]=time.split(":").map(Number),target=Date.UTC(year,month-1,day,hour,minute),formatter=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}),parts=Object.fromEntries(formatter.formatToParts(new Date(target)).filter(p=>p.type!=="literal").map(p=>[p.type,Number(p.value)])),represented=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute);return new Date(target+(target-represented)).toISOString()}

export async function createMockExam(formData:FormData){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const target=await requireTeacherEducationTarget();if(target.educationSystem!=="american"||target.americanCategory!=="est")redirect("/teacher/exams");
 const parsed=z.object({title:z.string().trim().min(3).max(200),description:z.string().trim().max(2000),startsAt:z.string(),endsAt:z.string(),assignAll:z.string().optional(),studentIds:z.array(z.string().uuid())}).refine(v=>!v.startsAt||!v.endsAt||Date.parse(v.endsAt)>Date.parse(v.startsAt),{message:"dates"}).safeParse({...Object.fromEntries(formData),studentIds:formData.getAll("studentIds")});
 if(!parsed.success)redirect("/teacher/exams/new/mock?error=invalid");
 const startsAt=cairoLocalToUtc(parsed.data.startsAt),endsAt=cairoLocalToUtc(parsed.data.endsAt);
 const {data:mock,error}=await supabase.from("mock_exams").insert({teacher_id:user.id,title:parsed.data.title,description:parsed.data.description||null,starts_at:startsAt,ends_at:endsAt}).select("id").single();
 if(error||!mock){console.error("Mock Exam parent creation failed",{code:error?.code,message:error?.message,details:error?.details});redirect(`/teacher/exams/new/mock?error=${error?.message.includes("recursion")?"rls":"create"}`)}
 let studentIds=parsed.data.studentIds;
 if(parsed.data.assignAll==="on"){const {data:enrollments}=await supabase.from("teacher_student_enrollments").select("student_id").eq("teacher_id",user.id).eq("status","active").or(`access_expires_at.is.null,access_expires_at.gt.${new Date().toISOString()}`);studentIds=(enrollments??[]).map(e=>e.student_id)}
 if(studentIds.length){const {error:assignmentError}=await supabase.from("mock_exam_assignments").insert(studentIds.map(student_id=>({mock_exam_id:mock.id,student_id})));if(assignmentError){console.error("Mock Exam student assignment failed",{mockExamId:mock.id,code:assignmentError.code,message:assignmentError.message,details:assignmentError.details});redirect(`/teacher/exams/mock/${mock.id}?error=students`)}}
 revalidatePath("/teacher/exams");redirect(`/teacher/exams/mock/${mock.id}`);
}

async function requireOwnedEstMockExam(mockExamId:string){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const target=await requireTeacherEducationTarget();if(target.educationSystem!=="american"||target.americanCategory!=="est")redirect("/teacher/exams");
 const {data:mock}=await supabase.from("mock_exams").select("id,status").eq("id",mockExamId).eq("teacher_id",user.id).eq("education_system","american").eq("american_category","est").single();
 if(!mock)redirect("/teacher/exams?error=mock-not-found");return {supabase,mock};
}

export async function toggleMockExamVisibility(formData:FormData){
 const parsed=z.object({mockExamId:z.string().uuid(),show:z.enum(["true","false"])}).safeParse(Object.fromEntries(formData));if(!parsed.success)redirect("/teacher/exams?error=mock-visibility");
 const {supabase}=await requireOwnedEstMockExam(parsed.data.mockExamId),show=parsed.data.show==="true";
 if(show){const {count}=await supabase.from("exams").select("id",{count:"exact",head:true}).eq("parent_mock_exam_id",parsed.data.mockExamId).eq("status","published");if(count!==3)redirect("/teacher/exams?error=mock-incomplete")}
 const {error}=await supabase.from("mock_exams").update({status:show?"published":"archived",updated_at:new Date().toISOString()}).eq("id",parsed.data.mockExamId);
 if(error)redirect("/teacher/exams?error=mock-visibility");revalidatePath("/teacher/exams");revalidatePath("/student/teachers");redirect(`/teacher/exams?visibility=${show?"shown":"hidden"}`);
}

export async function deleteMockExam(formData:FormData){
 const mockExamId=z.string().uuid().safeParse(formData.get("mockExamId"));if(!mockExamId.success)redirect("/teacher/exams?error=mock-delete");
 const {supabase}=await requireOwnedEstMockExam(mockExamId.data),{error}=await supabase.rpc("delete_teacher_mock_exam",{p_mock_exam_id:mockExamId.data});
 if(error)redirect(`/teacher/exams?error=${error.code==="PGRST202"||error.code==="42883"?"mock-delete-migration":"mock-delete"}`);
 revalidatePath("/teacher/exams");revalidatePath("/student/teachers");redirect("/teacher/exams?deleted=1");
}
