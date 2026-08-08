import "server-only";
import {createHmac} from "crypto";
import {createAdminClient} from "@/lib/supabase/admin";
import {env} from "@/lib/env";
import {educationSystemLabel,nationalGradeLabel} from "@/lib/education-target";

export type PublicExamResult={examName:string;teacherName:string;score:number;totalScore:number;percentage:number;submittedAt:string;status:"Pass"|"Fail"|null};
export type PublicStudentResult={studentName:string;academicLevel:string|null;exams:PublicExamResult[]};
const digits=(value:string)=>value.trim().replace(/[\u0660-\u0669]/g,d=>String(d.charCodeAt(0)-0x0660)).replace(/[\u06f0-\u06f9]/g,d=>String(d.charCodeAt(0)-0x06f0)).replace(/[^\d]/g,"");
export function normalizeResultsIdentifier(value:string){return digits(value)}
export function resultsLookupKey(value:string){return createHmac("sha256",env.RESULTS_LOOKUP_HMAC_SECRET??env.NATIONAL_ID_HMAC_SECRET??env.SUPABASE_SERVICE_ROLE_KEY!).update(value).digest("hex")}

// Connect an SMS challenge verifier here before setting RESULTS_OTP_REQUIRED=true.
// Keeping the gate server-only allows OTP to be enabled without changing the DTO.
export async function isResultsOtpVerified(request:Request){void request;return env.RESULTS_OTP_REQUIRED!=="true"}

export async function findPublicStudentResults(identifier:string):Promise<PublicStudentResult[]>{
 const admin=createAdminClient();
 const nationalHash=identifier.length===14&&env.NATIONAL_ID_HMAC_SECRET?createHmac("sha256",env.NATIONAL_ID_HMAC_SECRET).update(identifier).digest("hex"):null;
 let query=admin.from("student_profiles").select("user_id,education_system,national_grade");
 query=nationalHash?query.or(`mobile.eq.${identifier},guardian_mobile.eq.${identifier},national_id_hash.eq.${nationalHash}`):query.or(`mobile.eq.${identifier},guardian_mobile.eq.${identifier}`);
 const {data:students,error}=await query.limit(10);if(error)throw error;if(!students?.length)return [];
 const studentIds=students.map(s=>s.user_id);
 const [{data:profiles,error:profileError},{data:attempts,error:attemptError}]=await Promise.all([
  admin.from("profiles").select("id,full_name").in("id",studentIds),
  admin.from("exam_attempts").select("student_id,assignment_id,exam_version_id,score,submitted_at").in("student_id",studentIds).in("status",["submitted","expired"]).not("submitted_at","is",null).order("submitted_at",{ascending:false}),
 ]);if(profileError)throw profileError;if(attemptError)throw attemptError;
 const assignmentIds=[...new Set((attempts??[]).map(a=>a.assignment_id))],versionIds=[...new Set((attempts??[]).map(a=>a.exam_version_id))];
 const [{data:assignments,error:assignmentError},{data:versions,error:versionError}]=await Promise.all([
  assignmentIds.length?admin.from("exam_assignments").select("id,exam_id").in("id",assignmentIds):Promise.resolve({data:[],error:null}),
  versionIds.length?admin.from("exam_versions").select("id,total_points,passing_score,snapshot").in("id",versionIds):Promise.resolve({data:[],error:null}),
 ]);if(assignmentError)throw assignmentError;if(versionError)throw versionError;
 const examIds=[...new Set((assignments??[]).map(a=>a.exam_id))];
 const {data:exams,error:examError}=examIds.length?await admin.from("exams").select("id,title,teacher_id").in("id",examIds):{data:[],error:null};if(examError)throw examError;
 const teacherIds=[...new Set((exams??[]).map(e=>e.teacher_id))];
 const {data:teachers,error:teacherError}=teacherIds.length?await admin.from("teacher_profiles").select("user_id,display_name").in("user_id",teacherIds):{data:[],error:null};if(teacherError)throw teacherError;
 const names=new Map((profiles??[]).map(p=>[p.id,p.full_name])),assignmentMap=new Map((assignments??[]).map(a=>[a.id,a.exam_id])),versionMap=new Map((versions??[]).map(v=>[v.id,v])),examMap=new Map((exams??[]).map(e=>[e.id,e])),teacherMap=new Map((teachers??[]).map(t=>[t.user_id,t.display_name]));
 return students.map(student=>({
  studentName:names.get(student.user_id)??"Student",
  academicLevel:student.education_system?`${educationSystemLabel(student.education_system)}${student.national_grade?` · ${nationalGradeLabel(student.national_grade)}`:""}`:null,
  exams:(attempts??[]).filter(a=>a.student_id===student.user_id).flatMap(a=>{
   const version=versionMap.get(a.exam_version_id),exam=examMap.get(assignmentMap.get(a.assignment_id)??"");
   if(!version||!exam||a.score===null||!a.submitted_at)return [];
   const score=Number(a.score),totalScore=Number(version.total_points),passing=version.passing_score===null?null:Number(version.passing_score),snapshot=version.snapshot as {title?:string}|null;
   return [{examName:snapshot?.title??exam.title,teacherName:teacherMap.get(exam.teacher_id)??"Teacher",score,totalScore,percentage:totalScore>0?Math.round(score/totalScore*10000)/100:0,submittedAt:a.submitted_at,status:passing===null?null:score>=passing?"Pass" as const:"Fail" as const}];
  }),
 }));
}
