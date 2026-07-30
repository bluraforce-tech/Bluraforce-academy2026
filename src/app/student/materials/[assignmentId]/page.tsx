import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MaterialBookViewer } from "@/components/material-book-viewer";

type MaterialBook={
 title:string;description:string|null;material_type:string;external_url:string;
 cover_image_url:string|null;available_until:string|null;
};
export default async function Page({
 params,searchParams,
}:{
 params:Promise<{assignmentId:string}>;
 searchParams:Promise<{teacherId?:string}>;
}){
 const [{assignmentId},{teacherId}]=await Promise.all([params,searchParams]);
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/auth/student/login");
 const [{data:rows,error},{data:profile}]=await Promise.all([
  supabase.rpc("get_material_book_access",{p_assignment_id:assignmentId}),
  supabase.from("profiles").select("full_name").eq("id",user.id).single(),
 ]);
 const data=(Array.isArray(rows)?rows[0]:rows) as MaterialBook|undefined;
 const validTeacherId=teacherId&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teacherId);
 const backHref=validTeacherId?`/student/teachers/${teacherId}/materials`:"/student/teachers";
 if(error||!data)return <main className="app-content portal-section">
  <Link className="back-link" href={backHref}><ArrowLeft size={16}/>Back to Material Books</Link>
  <section className="panel empty-state"><span><FileText/></span><h1>Material book unavailable</h1><p>{error?.code==="PGRST202"?"Install migration 018 to activate the internal reader.":"This book is unavailable or its access period has ended."}</p></section>
 </main>;
 return <main className="app-content material-reader-page">
  <Link className="back-link" href={backHref}><ArrowLeft size={16}/>Back to Material Books</Link>
  <header><div><small>{data.material_type}</small><h1>{data.title}</h1><p>{data.description}</p></div></header>
  {data.available_until&&<p className="material-availability">Available until {new Date(data.available_until).toLocaleString()}</p>}
  <MaterialBookViewer url={data.external_url} title={data.title} studentName={profile?.full_name??"Student"}/>
 </main>;
}
