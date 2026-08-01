import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { educationTargetSchema,type EducationTarget } from "@/lib/education-target";

export const TEACHER_EDUCATION_COOKIE="academy_teacher_education_target";
export async function getTeacherEducationTarget():Promise<EducationTarget|null>{
 const raw=(await cookies()).get(TEACHER_EDUCATION_COOKIE)?.value;
 if(!raw)return null;
 try{const parsed=educationTargetSchema.safeParse(JSON.parse(raw));return parsed.success?parsed.data as EducationTarget:null}catch{return null}
}
export async function requireTeacherEducationTarget():Promise<EducationTarget>{
 const target=await getTeacherEducationTarget();
 if(!target)redirect("/teacher/dashboard?error=environment-required");
 return target;
}
