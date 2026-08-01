import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function printableGoogleUrls(input:string){
 try{
  const url=new URL(input);
  if(url.hostname==="drive.google.com"){
   const file=url.pathname.match(/^\/file\/d\/([^/]+)/);
   const id=file?.[1]??url.searchParams.get("id");
   if(id)return [
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(id)}`,
   ];
  }
  if(url.hostname==="docs.google.com"){
   const doc=url.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([^/]+)/);
   if(doc)return [`https://docs.google.com/${doc[1]}/d/${encodeURIComponent(doc[2])}/export?format=pdf`];
  }
  return [];
 }catch{return []}
}

function isPdf(bytes:Uint8Array){return bytes.length>=5&&bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d}

export async function GET(_:Request,{params}:{params:Promise<{assignmentId:string}>}){
 const {assignmentId}=await params,supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({message:"Unauthorized"},{status:401});
 const {data:rows,error}=await supabase.rpc("get_material_book_access",{p_assignment_id:assignmentId});
 const material=Array.isArray(rows)?rows[0]:rows as {title?:string;external_url?:string}|undefined;
 if(error||!material?.external_url)return NextResponse.json({message:"Material unavailable"},{status:403});
 const sources=printableGoogleUrls(material.external_url);
 if(!sources.length)return NextResponse.json({message:"This material source cannot be printed inside Academy."},{status:422});
 for(const source of sources){
  const upstream=await fetch(source,{redirect:"follow",cache:"no-store",headers:{Accept:"application/pdf,application/octet-stream;q=0.9,*/*;q=0.1","User-Agent":"Mozilla/5.0 Academy Material Printer"}});
  if(!upstream.ok)continue;
  const bytes=new Uint8Array(await upstream.arrayBuffer());
  if(!isPdf(bytes))continue;
  return new Response(bytes,{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="${encodeURIComponent(material.title??"material-book")}.pdf"`,"Cache-Control":"private, no-store"}});
 }
 return NextResponse.json({message:"Google Drive did not return a PDF. Make sure the file is a PDF and that anyone with the link can view and download it."},{status:422});
}
export async function POST(_:Request,{params}:{params:Promise<{assignmentId:string}>}){
 const {assignmentId}=await params,supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({message:"Unauthorized"},{status:401});
 const {data}=await supabase.from("material_assignments").select("id,student_id,revoked_at,materials(id,teacher_id,storage_path,status,available_from,available_until)").eq("id",assignmentId).eq("student_id",user.id).single();
 const material=Array.isArray(data?.materials)?data.materials[0]:data?.materials as {id:string;teacher_id:string;storage_path:string|null;status:string;available_from:string|null;available_until:string|null}|undefined;
 const now=Date.now(); if(!data||data.revoked_at||!material||material.status!=="published"||(material.available_from&&Date.parse(material.available_from)>now)||(material.available_until&&Date.parse(material.available_until)<=now)||!material.storage_path)return NextResponse.json({message:"Material unavailable"},{status:403});
 const {data:enrollment}=await supabase.from("teacher_student_enrollments").select("id").eq("teacher_id",material.teacher_id).eq("student_id",user.id).eq("status","active").maybeSingle();
 if(!enrollment)return NextResponse.json({message:"Material unavailable"},{status:403});
 const admin=createAdminClient(); const {data:signed,error}=await admin.storage.from("private-materials").createSignedUrl(material.storage_path,300);
 if(error)return NextResponse.json({message:"Material unavailable"},{status:403});
 await admin.from("audit_logs").insert({actor_id:user.id,actor_role:"student",action:"material.accessed",entity_type:"material",entity_id:material.id});
 return NextResponse.json({url:signed.signedUrl,expiresIn:300});
}
