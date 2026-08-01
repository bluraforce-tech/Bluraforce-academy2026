import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen,Brain,FileText,GraduationCap,LayoutDashboard,Library,LogOut,PlayCircle,Shuffle,Ticket,Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/features/auth/actions";
import { AdminGrowthAnalytics } from "@/components/admin-growth-analytics";
import { getTeacherEducationTarget } from "@/lib/teacher-education-context";
import {americanCategoryLabel,educationSystemLabel,nationalGradeLabel} from "@/lib/education-target";
import { EducationTargetSelector } from "@/components/education-target-selector";
import { selectTeacherEnvironment } from "@/features/teachers/environment-actions";

const nav=[["Dashboard","dashboard",LayoutDashboard],["Teachers","teachers",GraduationCap],["Students","students",Users],["Invitation codes","invitation-codes",Ticket],["Question Bank","question-bank",Library],["Assignments","assignments",Library],["Exams","exams",BookOpen],["Mistakes exams","mistakes-exams",Brain],["Create exam","exams/new",BookOpen],["Random exam","exams/random",Shuffle],["Exam from old questions","exams/from-bank",Library],["Lesson videos","videos",PlayCircle],["Material Books","materials",FileText],["Study Notes","study-notes",FileText]] as const;
type Point={label:string;value:number};
type TeacherRedemption={teacherId:string;name:string;total:number;thisMonth:number};
type Analytics={dailyStudents:Point[];monthlyStudents:Point[];monthlyRedemptions:Point[];teacherRedemptions:TeacherRedemption[]};
export default async function Dashboard({params}:{params:Promise<{role:string}>}){
 const {role}=await params;if(!["admin","teacher","student"].includes(role))redirect("/");
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect(`/auth/${role}/login`);
 const {data:profile}=await supabase.from("profiles").select("full_name,role").eq("id",user.id).single();if(profile?.role!==role)redirect("/");
 if(role==="student")redirect("/student/teachers");
 const teacherTarget=role==="teacher"?await getTeacherEducationTarget():null;
 let stats:Array<[string,string|number]>=role==="teacher"?[["Enrolled students",0],["Active codes",0],["Exam completion","0%"],["Average score","0%"]]:[["Active teachers",0],["Students",0],["Enrollments",0],["Open alerts",0]];
 let adminAnalytics:Analytics|null=null;
 if(role==="teacher"){
  const now=new Date().toISOString();
  const [{count:enrolled},{count:codes},{data:teacherExams}]=await Promise.all([
   supabase.from("teacher_student_enrollments").select("id",{count:"exact",head:true}).eq("teacher_id",user.id).eq("status","active").or(`access_expires_at.is.null,access_expires_at.gt.${now}`),
   supabase.from("student_invitation_codes").select("id",{count:"exact",head:true}).eq("teacher_id",user.id).eq("status","active").gt("expires_at",now),
   supabase.from("exams").select("id").eq("teacher_id",user.id).eq("kind","standard"),
  ]);
  const examIds=(teacherExams??[]).map(exam=>exam.id);
  const {data:assignments}=examIds.length?await supabase.from("exam_assignments").select("id").in("exam_id",examIds).is("revoked_at",null):{data:[]};
  const assignmentIds=(assignments??[]).map(assignment=>assignment.id);
  const {data:attempts}=assignmentIds.length?await supabase.from("exam_attempts").select("assignment_id,status,score,exam_versions(total_points)").in("assignment_id",assignmentIds).in("status",["submitted","expired"]):{data:[]};
  const completed=new Set((attempts??[]).map(attempt=>attempt.assignment_id)).size;
  const completion=assignmentIds.length?Math.round(completed/assignmentIds.length*100):0;
  const scored=(attempts??[]).filter(a=>a.score!==null).map(a=>{const v=a.exam_versions as unknown as {total_points:number}|null;return v&&v.total_points>0?Number(a.score)/Number(v.total_points)*100:null}).filter((v):v is number=>v!==null);
  const average=scored.length?Math.round(scored.reduce((sum,value)=>sum+value,0)/scored.length):0;
  stats=[["Enrolled students",enrolled??0],["Active codes",codes??0],["Exam completion",`${completion}%`],["Average score",`${average}%`]];
 }
 if(role==="admin"){
  const today=new Date(),now=today.toISOString(),rangeStart=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-11,1));
  const [{count:teachers},{count:students},{count:enrollments},{count:alerts},{data:registrations},{data:redemptions},{data:teacherProfiles}]=await Promise.all([
   supabase.from("teacher_profiles").select("user_id",{count:"exact",head:true}).eq("is_active",true),
   supabase.from("profiles").select("id",{count:"exact",head:true}).eq("role","student"),
   supabase.from("teacher_student_enrollments").select("id",{count:"exact",head:true}).eq("status","active").or(`access_expires_at.is.null,access_expires_at.gt.${now}`),
   supabase.from("admin_notifications").select("id",{count:"exact",head:true}).eq("status","unread"),
   supabase.from("profiles").select("created_at").eq("role","student").gte("created_at",rangeStart.toISOString()),
   supabase.from("student_invitation_codes").select("teacher_id,redeemed_by,redeemed_at").not("redeemed_at","is",null),
   supabase.from("profiles").select("id,full_name").eq("role","teacher"),
  ]);
  stats=[["Active teachers",teachers??0],["Students",students??0],["Enrollments",enrollments??0],["Open alerts",alerts??0]];
  const cairoDay=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
  const monthKey=(date:Date)=>`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}`;
  const days=Array.from({length:30},(_,i)=>new Date(today.getTime()-(29-i)*86400000));
  const months=Array.from({length:12},(_,i)=>new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-(11-i),1)));
  const dayCounts=new Map<string,number>(),monthCounts=new Map<string,number>(),redeemers=new Map<string,Set<string>>();
  const teacherTotals=new Map<string,number>(),teacherMonthlyTotals=new Map<string,number>(),currentMonth=monthKey(today);
  for(const row of registrations??[]){const date=new Date(row.created_at),day=cairoDay(date),month=monthKey(date);dayCounts.set(day,(dayCounts.get(day)??0)+1);monthCounts.set(month,(monthCounts.get(month)??0)+1)}
  for(const row of redemptions??[]){if(!row.redeemed_at||!row.redeemed_by)continue;const month=monthKey(new Date(row.redeemed_at));if(!redeemers.has(month))redeemers.set(month,new Set());redeemers.get(month)!.add(row.redeemed_by);teacherTotals.set(row.teacher_id,(teacherTotals.get(row.teacher_id)??0)+1);if(month===currentMonth)teacherMonthlyTotals.set(row.teacher_id,(teacherMonthlyTotals.get(row.teacher_id)??0)+1)}
  adminAnalytics={
   dailyStudents:days.map(date=>({label:new Intl.DateTimeFormat("en",{month:"short",day:"numeric",timeZone:"Africa/Cairo"}).format(date),value:dayCounts.get(cairoDay(date))??0})),
   monthlyStudents:months.map(date=>({label:new Intl.DateTimeFormat("en",{month:"short",year:"2-digit",timeZone:"UTC"}).format(date),value:monthCounts.get(monthKey(date))??0})),
   monthlyRedemptions:months.map(date=>({label:new Intl.DateTimeFormat("en",{month:"short",year:"2-digit",timeZone:"UTC"}).format(date),value:redeemers.get(monthKey(date))?.size??0})),
   teacherRedemptions:(teacherProfiles??[]).map(teacher=>({teacherId:teacher.id,name:teacher.full_name,total:teacherTotals.get(teacher.id)??0,thisMonth:teacherMonthlyTotals.get(teacher.id)??0})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name)),
  };
 }
 const adminNavItems=new Set(["Dashboard","Teachers","Students"]);
 const welcomeName=profile.full_name.trim().split(/\s+/).slice(0,2).join(" ");
 profile.full_name=welcomeName.replace(" ","\u00a0");
 const visibleNav=nav.filter(([label])=>
  role==="admin"
   ? adminNavItems.has(label)
   : label!=="Teachers"&&(teacherTarget?.educationSystem==="american"?label!=="Question Bank":label!=="Assignments")
 );
 return <main className="app-frame">
  <aside><Link href="/" className="brand"><span className="brand-mark"><GraduationCap/></span>Academy</Link><nav>{visibleNav.map(([label,path,Icon],i)=><Link key={label} className={i===0?"active":""} href={`/${role}/${path}`}><Icon size={19}/>{label}</Link>)}</nav><form action={logout}><button className="logout" type="submit"><LogOut size={18}/>Sign out</button></form></aside>
  <section className="app-content">
   <header><div><small>{role} workspace</small><h1>Welcome back, {profile.full_name.split(" ")[0]}</h1><p>{teacherTarget?`${educationSystemLabel(teacherTarget.educationSystem)}${teacherTarget.americanCategory?` · ${americanCategoryLabel(teacherTarget.americanCategory)}`:""}${teacherTarget.nationalGrade?` · ${nationalGradeLabel(teacherTarget.nationalGrade)}`:""} environment`:"Here’s what’s happening with your learning space today."}</p></div><span className="user-badge">{profile.full_name.slice(0,2).toUpperCase()}</span></header>
   {role==="teacher"&&<form action={selectTeacherEnvironment} className="panel dashboard-environment"><div><h2>Teaching environment</h2><p>{teacherTarget?"New codes and content will use this selection.":"Choose an environment before creating content."}</p></div><EducationTargetSelector defaultEducationSystem={teacherTarget?.educationSystem??""} defaultAmericanCategory={teacherTarget?.americanCategory??""} defaultNationalGrade={teacherTarget?.nationalGrade??""}/><button className="button" type="submit">{teacherTarget?"Switch environment":"Set environment"}</button></form>}
   <div className="stat-grid">{stats.map(([label,value])=><article key={label}><small>{label}</small><strong>{value}</strong><span>Live data</span></article>)}</div>
   {adminAnalytics&&<AdminGrowthAnalytics {...adminAnalytics}/>}
   <div className="content-grid"><section className="panel"><div className="panel-head"><div><h2>Quick access</h2><p>Open your learning tools</p></div><Link href={`/${role}/activity`}>View activity</Link></div>{[["Lesson videos","videos"],["Exams","exams"],["Material Books","materials"],["Study Notes","study-notes"]].map(([title,path],i)=><Link href={`/${role}/${path}`} className="activity" key={title}><span className="activity-icon">{i===0?<PlayCircle/>:i===1?<BookOpen/>:<FileText/>}</span><div><b>{title}</b><small>Open this section</small></div><span>Open</span></Link>)}</section><section className="panel"><div className="panel-head"><div><h2>Getting started</h2><p>Your next steps</p></div></div><div className="progress-row"><span>Complete your profile</span><b>Ready</b></div><div className="progress-row"><span>Explore available content</span><b>Open</b></div></section></div>
  </section>
 </main>;
}
