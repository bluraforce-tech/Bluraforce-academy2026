"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {requireTeacherEducationTarget} from "@/lib/teacher-education-context";
export async function createCategorizedUnit(formData:FormData){const supabase=await createClient("teacher"),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");const target=await requireTeacherEducationTarget(),title=z.string().trim().min(2).max(200).safeParse(formData.get("title"));if(!title.success)redirect("/teacher/question-bank?error=unit");const {error}=await supabase.rpc("create_question_bank_unit",{p_title:title.data,p_description:String(formData.get("description")??""),p_education_system:target.educationSystem,p_national_grade:target.nationalGrade,p_american_category:target.americanCategory});if(error)redirect("/teacher/question-bank?error=unit-save");revalidatePath("/teacher/question-bank");redirect("/teacher/question-bank?created=unit")}
