import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VideoPlayer } from "@/components/video-player";
export default async function Lesson({params}:{params:Promise<{assignmentId:string}>}){
 const {assignmentId}=await params,supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/auth/student/login");
 const [{data:raw,error},{data:profile}]=await Promise.all([supabase.rpc("get_video_player_data",{p_assignment_id:assignmentId}).single(),supabase.from("profiles").select("full_name").eq("id",user.id).single()]);
 const data=raw as null|{title:string;description:string|null;youtube_video_id:string;remaining_views:number|null;available_until:string|null};
 if(error||!data)return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-bold">Video unavailable</h1><p className="mt-3 text-slate-600">This lesson is not assigned to your account, has expired, or its view limit has been reached.</p></main>;
 return <main className="mx-auto max-w-5xl p-6 md:p-10"><div className="mb-6"><span className="text-sm font-semibold text-emerald-700">Internal lesson player</span><h1 className="mt-2 text-3xl font-bold">{data.title}</h1><p className="mt-2 text-slate-600">{data.description}</p></div><VideoPlayer videoId={data.youtube_video_id} assignmentId={assignmentId} studentName={profile?.full_name??"Student"}/><div className="mt-5 flex flex-wrap gap-3 text-sm"><span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">Remaining views: {data.remaining_views??"Unlimited"}</span>{data.available_until&&<span className="rounded-lg bg-slate-100 px-3 py-2">Available until: {new Date(data.available_until).toLocaleString()}</span>}</div></main>
}
