"use server";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {uploadQuestionImage} from "@/lib/question-image-storage";
import {addBankQuestion,createActivityWithQuestions} from "./actions";
async function teacher(){const supabase=await createClient("teacher"),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");return {supabase,user}}
export async function addBankQuestionWithUploadedImage(formData:FormData){const {supabase,user}=await teacher();let payload:Record<string,unknown>;try{payload=JSON.parse(String(formData.get("payload")))}catch{redirect("/teacher/question-bank?error=question")}try{payload.imageUrl=await uploadQuestionImage(supabase,user.id,formData.get("questionImage"))??payload.imageUrl}catch{redirect("/teacher/question-bank?error=image")}formData.set("payload",JSON.stringify(payload));return addBankQuestion(formData)}
export async function createActivityWithUploadedQuestions(formData:FormData){const {supabase,user}=await teacher();let payload:{newQuestions?:Array<{imageUrl?:string}>};try{payload=JSON.parse(String(formData.get("payload")))}catch{redirect("/teacher/question-bank?error=activity")}try{for(let index=0;index<(payload.newQuestions?.length??0);index++){const uploaded=await uploadQuestionImage(supabase,user.id,formData.get(`newQuestionImage_${index}`));if(uploaded)payload.newQuestions![index].imageUrl=uploaded}}catch{redirect("/teacher/question-bank?error=image")}formData.set("payload",JSON.stringify(payload));return createActivityWithQuestions(formData)}
