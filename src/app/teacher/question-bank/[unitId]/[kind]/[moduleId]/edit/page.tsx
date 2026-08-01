import Link from "next/link";
import {redirect} from "next/navigation";
import {ArrowLeft} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {updateModule} from "@/features/question-bank/module-actions";

function localValue(value:string|null){if(!value)return "";return new Intl.DateTimeFormat("sv-SE",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(value)).replace(" ","T")}
export default async function EditModulePage({params,searchParams}:{params:Promise<{unitId:string;kind:string;moduleId:string}>;searchParams:Promise<{error?:string}>}){
 const [{unitId,kind,moduleId},query]=await Promise.all([params,searchParams]);if(!["self_practice","homework"].includes(kind))redirect(`/teacher/question-bank/${unitId}`);
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const {data:module}=await supabase.from("exams").select("id,title,kind,ends_at,source_unit_id").eq("id",moduleId).eq("teacher_id",user.id).eq("source_unit_id",unitId).eq("kind",kind).single();if(!module)redirect(`/teacher/question-bank/${unitId}/${kind}`);
 const label=kind==="homework"?"Homework":"Self Practice";
 return <main className="app-content exam-page"><Link className="back-link" href={`/teacher/question-bank/${unitId}/${kind}`}><ArrowLeft/>Back to {label}</Link><header><div><small>Teacher workspace</small><h1>Edit {label}</h1><p>Update the module information shown to students.</p></div></header>{query.error&&<p className="form-error">The module could not be updated. Homework deadlines must be in the future.</p>}<form action={updateModule} className="panel form-grid"><input type="hidden" name="moduleId" value={module.id}/><div className="field"><label>Module title</label><input name="title" defaultValue={module.title} required/></div>{kind==="homework"&&<div className="field"><label>Submission deadline</label><input name="deadline" type="datetime-local" defaultValue={localValue(module.ends_at)} required/></div>}<div className="builder-actions"><Link className="button secondary" href={`/teacher/question-bank/${unitId}/${kind}`}>Cancel</Link><button className="button">Save changes</button></div></form></main>
}
