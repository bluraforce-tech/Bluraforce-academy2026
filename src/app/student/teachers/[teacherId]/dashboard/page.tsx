import Link from "next/link";
import {redirect} from "next/navigation";
import {ArrowLeft,BookOpen,Brain,CalendarClock,FileText,GraduationCap,LogOut,PlayCircle,Library} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {logout} from "@/features/auth/actions";
import {StudentAmericanCategorySwitcher} from "@/components/student-american-category-switcher";
import {parseStudentAmericanCategory,withAmericanCategory} from "@/lib/student-american-category";

type Categorized={americanCategory?:string|null};
type Video=Categorized&{id:string;title:string;maxViews:number|null;countedViews:number;viewLimitReached?:boolean};
type Portal={exams:Categorized[];materials:Categorized[];videos:Video[]};

export default async function TeacherPortal({params,searchParams}:{params:Promise<{teacherId:string}>;searchParams:Promise<{joined?:string;category?:string}>}) {
  const {teacherId}=await params,query=await searchParams,category=parseStudentAmericanCategory(query.category),supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/student/login");
  const {data:profile}=await supabase.from("profiles").select("role,full_name").eq("id",user.id).single();
  if(profile?.role!=="student")redirect("/");
  const {data:enrollment}=await supabase.from("teacher_student_enrollments").select("id,access_expires_at").eq("teacher_id",teacherId).eq("student_id",user.id).eq("status","active").or(`access_expires_at.is.null,access_expires_at.gt.${new Date().toISOString()}`).maybeSingle();
  if(!enrollment)redirect("/student/teachers?error=access");
  const {data:teacher}=await supabase.from("teacher_profiles").select("display_name,biography").eq("user_id",teacherId).eq("is_active",true).single();
  if(!teacher)redirect("/student/teachers?error=access");
  const [{data:raw,error},{data:mistakesRaw},{data:activitiesRaw},{data:studentProfile}]=await Promise.all([supabase.rpc("get_student_teacher_portal",{p_teacher_id:teacherId}),supabase.rpc("get_student_mistakes_exams",{p_teacher_id:teacherId}),supabase.rpc("get_student_activities",{p_teacher_id:teacherId}),supabase.from("student_profiles").select("education_system").eq("user_id",user.id).single()]);
  if(error)redirect("/student/teachers?error=access");
  const american=studentProfile?.education_system==="american",filter=<T extends Categorized>(items:T[])=>american?items.filter(item=>item.americanCategory===category):items,all=raw as Portal;
  const portal={exams:filter(all.exams),materials:filter(all.materials),videos:filter(all.videos)},mistakes=(mistakesRaw??[]) as unknown[],activities=filter((activitiesRaw??[]) as Categorized[]);
  const cards=[{key:"exams",label:"Assigned exams",count:portal.exams.length,text:"Open assessments and results",icon:BookOpen},{key:"mistakes-exams",label:"Mistakes exams",count:mistakes.length,text:"Revision exams generated from your mistakes",icon:Brain},{key:american?"assignments":"activities",label:american?"Assignments":"Practice & Homework",count:activities.length,text:american?"Teacher assignments with unlimited practice":"Untimed activities and assigned homework",icon:Library},{key:"videos",label:"Lesson videos",count:portal.videos.length,text:"Lessons available from this teacher",icon:PlayCircle},{key:"materials",label:"Material Books",count:portal.materials.length,text:"Books, notes, worksheets, and files",icon:FileText}] as const;
  const href=(path:string)=>american?withAmericanCategory(path,category):path;
  return <main className="app-content student-portal"><div className="student-topbar"><Link href="/student/teachers" className="brand"><span className="brand-mark"><GraduationCap/></span>Academy</Link><form action={logout}><button className="button secondary small" type="submit"><LogOut size={16}/>Sign out</button></form></div><Link className="back-link" href="/student/teachers"><ArrowLeft size={16}/> All teachers</Link>{query.joined&&<p className="success-banner">Teacher activated successfully. Welcome to your learning portal.</p>}<header><div><small>Student learning portal</small><h1>{teacher.display_name}</h1><p>{teacher.biography||`Welcome back, ${profile.full_name}. Your assigned learning content is available below.`}</p></div>{enrollment.access_expires_at&&<span className="access-expiry"><CalendarClock/><span><small>Access expires</small><b>{new Date(enrollment.access_expires_at).toLocaleDateString()}</b></span></span>}</header>{american&&<StudentAmericanCategorySwitcher basePath={`/student/teachers/${teacherId}/dashboard`} selected={category}/>}<div className="portal-grid">{cards.map(({key,label,count,text,icon:Icon})=><Link href={href(`/student/teachers/${teacherId}/${key}`)} className="panel portal-card" key={key}><span><Icon/></span><div><small>{label}</small><strong>{count}</strong><p>{text}</p></div></Link>)}</div>{Boolean(portal.videos.length)&&<section className="panel portal-lessons"><div className="panel-head"><div><h2>Available lessons</h2><p>Watch securely inside Academy</p></div><Link href={href(`/student/teachers/${teacherId}/videos`)}>View all</Link></div>{portal.videos.slice(0,3).map(video=>video.viewLimitReached?<article className="activity locked-activity" key={video.id}><span className="activity-icon"><PlayCircle/></span><div><b>{video.title}</b><small>Remaining views: 0</small></div><span>Locked</span></article>:<Link className="activity" href={`/student/videos/${video.id}`} key={video.id}><span className="activity-icon"><PlayCircle/></span><div><b>{video.title}</b><small>Remaining views: {video.maxViews===null?"Unlimited":Math.max(0,video.maxViews-video.countedViews)}</small></div><span>Watch</span></Link>)}</section>}</main>;
}
