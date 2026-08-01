"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";

type ModuleRef = {id:string;kind:"self_practice"|"homework";source_unit_id:string;status:string};
async function ownedModule(moduleId:string){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const {data}=await supabase.from("exams").select("id,kind,source_unit_id,status").eq("id",moduleId).eq("teacher_id",user.id).in("kind",["self_practice","homework"]).single();
 if(!data||!data.source_unit_id)redirect("/teacher/question-bank?error=module");
 return {supabase,module:data as ModuleRef};
}
function destination(module:ModuleRef){return `/teacher/question-bank/${module.source_unit_id}/${module.kind}`}

export async function toggleModuleVisibility(formData:FormData){
 const parsed=z.string().uuid().safeParse(formData.get("moduleId"));if(!parsed.success)redirect("/teacher/question-bank?error=module");
 const {supabase,module}=await ownedModule(parsed.data),next=module.status==="published"?"archived":"published";
 const {error}=await supabase.from("exams").update({status:next,updated_at:new Date().toISOString()}).eq("id",module.id);
 if(error)redirect(`${destination(module)}?error=visibility`);
 revalidatePath(destination(module));revalidatePath("/student/teachers","layout");
 redirect(`${destination(module)}?visibility=${next==="published"?"shown":"hidden"}`);
}

export async function deleteModule(formData:FormData){
 const parsed=z.string().uuid().safeParse(formData.get("moduleId"));if(!parsed.success)redirect("/teacher/question-bank?error=module");
 const {supabase,module}=await ownedModule(parsed.data),target=destination(module);
 const {error}=await supabase.rpc("delete_teacher_exam",{p_exam_id:module.id});
 if(error)redirect(`${target}?error=delete`);
 revalidatePath(target);revalidatePath(`/teacher/question-bank/${module.source_unit_id}`);revalidatePath("/student/teachers","layout");
 redirect(`${target}?deleted=1`);
}

export async function updateModule(formData:FormData){
 const parsed=z.object({moduleId:z.string().uuid(),title:z.string().trim().min(3).max(200),deadline:z.string().optional()}).safeParse(Object.fromEntries(formData));
 if(!parsed.success)redirect("/teacher/question-bank?error=module");
 const {supabase,module}=await ownedModule(parsed.data.moduleId),target=destination(module);
 if(module.kind==="homework"&&(!parsed.data.deadline||Date.parse(parsed.data.deadline)<=Date.now()))redirect(`/teacher/question-bank/${module.source_unit_id}/${module.kind}/${module.id}/edit?error=deadline`);
 const {error}=await supabase.from("exams").update({title:parsed.data.title,ends_at:module.kind==="homework"?new Date(parsed.data.deadline!).toISOString():null,updated_at:new Date().toISOString()}).eq("id",module.id);
 if(error)redirect(`/teacher/question-bank/${module.source_unit_id}/${module.kind}/${module.id}/edit?error=save`);
 revalidatePath(target);revalidatePath("/student/teachers","layout");redirect(`${target}?updated=1`);
}
