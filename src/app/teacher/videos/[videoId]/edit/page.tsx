import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateLessonVideo } from "@/features/videos/actions";

const errors:Record<string,string>={
 invalid:"Check all video and availability fields.",
 youtube:"Enter a valid YouTube URL.",
 update:"The lesson video could not be updated.",
 assign:"The student assignments could not be updated.",
 views:"Each custom remaining-view value must be a whole number from 1 to 10,000.",
};
function local(value:string|null){
 if(!value)return "";
 const d=new Date(value),pad=(n:number)=>String(n).padStart(2,"0");
 return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export default async function Page({params,searchParams}:{params:Promise<{videoId:string}>;searchParams:Promise<{error?:string}>}){
 const {videoId}=await params,query=await searchParams,supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/auth/teacher/login");
 const {data:video}=await supabase.from("lesson_videos").select("id,title,description,youtube_video_id,lesson_name,category_name,status").eq("id",videoId).eq("teacher_id",user.id).single();
 if(!video)redirect("/teacher/videos");
 const [{data:enrollments},{data:assignments}]=await Promise.all([
  supabase.from("teacher_student_enrollments").select("student_id").eq("teacher_id",user.id).eq("status","active"),
  supabase.from("video_assignments").select("student_id,available_from,available_until,max_views,counted_views,revoked_at").eq("video_id",videoId),
 ]);
 const ids=(enrollments??[]).map(e=>e.student_id);
 const {data:students}=ids.length?await supabase.from("profiles").select("id,full_name").in("id",ids):{data:[]};
 const active=new Set((assignments??[]).filter(a=>!a.revoked_at).map(a=>a.student_id));
 const assignmentByStudent=new Map((assignments??[]).map(a=>[a.student_id,a]));
 const settings=(assignments??[]).find(a=>!a.revoked_at)??assignments?.[0];
 return <main className="app-content exam-page">
  <Link className="back-link" href="/teacher/videos"><ArrowLeft size={16}/>Back to lesson videos</Link>
  <header><div><small>Teacher workspace</small><h1>Edit lesson video</h1><p>Update the lesson and its student access rules.</p></div></header>
  {query.error&&<p className="form-error">{errors[query.error]??errors.update}</p>}
  <form action={updateLessonVideo} className="panel teacher-form">
   <input type="hidden" name="videoId" value={video.id}/>
   <div className="form-grid">
    <div className="field"><label>Title</label><input name="title" defaultValue={video.title} minLength={3} maxLength={200} required/></div>
    <div className="field"><label>YouTube URL</label><input name="youtubeUrl" type="url" defaultValue={`https://www.youtube.com/watch?v=${video.youtube_video_id.trim()}`} required/></div>
    <div className="field full"><label>Description</label><textarea name="description" defaultValue={video.description??""} maxLength={2000} rows={4}/></div>
    <div className="field"><label>Lesson name</label><input name="lessonName" defaultValue={video.lesson_name??""} maxLength={200}/></div>
    <div className="field"><label>Category</label><input name="categoryName" defaultValue={video.category_name??""} maxLength={200}/></div>
    <div className="field"><label>Available from</label><input name="availableFrom" type="datetime-local" defaultValue={local(settings?.available_from??null)}/></div>
    <div className="field"><label>Available until</label><input name="availableUntil" type="datetime-local" defaultValue={local(settings?.available_until??null)}/></div>
    <div className="field"><label>Default maximum views</label><input name="maxViews" type="number" min={1} defaultValue={settings?.max_views??""} placeholder="Unlimited"/></div>
    <label className="check"><input name="publish" type="checkbox" defaultChecked={video.status==="published"}/><span><b>Published</b></span></label>
    <label className="check full"><input name="assignAll" type="checkbox" defaultChecked={active.size===ids.length&&ids.length>0}/><span><b>Assign to all active students</b></span></label>
    <div className="student-selector video-student-limits full">
     <div className="student-limit-heading"><b>Student</b><b>Custom remaining views</b></div>
     {(students??[]).map(student=>{
      const assignment=assignmentByStudent.get(student.id);
      const remaining=assignment?.max_views==null?"":Math.max(0,assignment.max_views-assignment.counted_views);
      return <div className="student-limit-row" key={student.id}>
       <label><input type="checkbox" name="studentIds" value={student.id} defaultChecked={active.has(student.id)}/><span>{student.full_name}<small>{assignment?.counted_views??0} views already used</small></span></label>
       <input aria-label={`Remaining views for ${student.full_name}`} name={`remainingViews_${student.id}`} type="number" min={1} max={10000} defaultValue={remaining} placeholder="Use default"/>
      </div>;
     })}
     {!students?.length&&<small>No active students are enrolled.</small>}
    </div>
   </div>
   <div className="form-actions"><Link className="button secondary" href="/teacher/videos">Cancel</Link><button className="button">Save changes</button></div>
  </form>
 </main>;
}
