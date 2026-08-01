import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MaterialBookViewer } from "@/components/material-book-viewer";

type StudyNote={title:string;description:string|null;material_type:string;external_url:string;cover_image_url:string|null;available_until:string|null};

export default async function Page({params,searchParams}:{params:Promise<{assignmentId:string}>;searchParams:Promise<{teacherId?:string;category?:string}>}){
 const [{assignmentId},{teacherId,category}]=await Promise.all([params,searchParams]);
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/auth/student/login");
 const [{data:rows,error},{data:profile}]=await Promise.all([supabase.rpc("get_material_book_access",{p_assignment_id:assignmentId}),supabase.from("profiles").select("full_name").eq("id",user.id).single()]);
 const data=(Array.isArray(rows)?rows[0]:rows) as StudyNote|undefined;
 const validTeacherId=teacherId&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teacherId),validCategory=category==="classified"||category==="sat"||category==="est";
 const backHref=validTeacherId?`/student/teachers/${teacherId}/study-notes${validCategory?`?category=${category}`:""}`:"/student/teachers";
 if(error||!data)return <main className="app-content portal-section"><Link className="back-link" href={backHref}><ArrowLeft size={16}/>Back to Study Notes</Link><section className="panel empty-state"><span><FileText/></span><h1>Study note unavailable</h1><p>This study note is unavailable or its access period has ended.</p></section></main>;
 return <main className="app-content material-reader-page"><Link className="back-link" href={backHref}><ArrowLeft size={16}/>Back to Study Notes</Link><header><div><small>{data.material_type}</small><h1>{data.title}</h1><p>{data.description}</p></div></header>{data.available_until&&<p className="material-availability">Available until {new Date(data.available_until).toLocaleString()}</p>}<MaterialBookViewer assignmentId={assignmentId} url={data.external_url} title={data.title} studentName={profile?.full_name??"Student"}/></main>;
}
