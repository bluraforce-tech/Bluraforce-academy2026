import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
const body=z.object({sessionId:z.string().uuid()});
export async function POST(request:Request,{params}:{params:Promise<{assignmentId:string}>}){
 const parsed=body.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({message:"Invalid request"},{status:400});
 const {assignmentId}=await params,supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({message:"Unauthorized"},{status:401});
 const {data,error}=await supabase.rpc("begin_video_view",{p_assignment_id:assignmentId,p_session_id:parsed.data.sessionId});
 if(error)return NextResponse.json({message:"Playback is unavailable"},{status:403}); return NextResponse.json({sessionId:data});
}
