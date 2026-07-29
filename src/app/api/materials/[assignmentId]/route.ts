import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
