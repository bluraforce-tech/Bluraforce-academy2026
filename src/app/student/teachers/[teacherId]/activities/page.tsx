import Link from "next/link";
import {redirect} from "next/navigation";
import {ArrowLeft,BookOpen,GraduationCap} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {parseStudentAmericanCategory,withAmericanCategory} from "@/lib/student-american-category";

type Activity={unitId:string;unitTitle:string;kind:"self_practice"|"homework";americanCategory?:string|null};

export default async function UnitsPage({params,searchParams}:{params:Promise<{teacherId:string}>;searchParams:Promise<{category?:string}>}) {
  const {teacherId}=await params,q=await searchParams,category=parseStudentAmericanCategory(q.category),s=await createClient(),{data:{user}}=await s.auth.getUser();
  if(!user)redirect("/auth/student/login");
  const [{data:teacher},{data:raw,error},{data:profile}]=await Promise.all([s.from("teacher_profiles").select("display_name").eq("user_id",teacherId).single(),s.rpc("get_student_activities",{p_teacher_id:teacherId}),s.from("student_profiles").select("education_system").eq("user_id",user.id).single()]);
  if(!teacher||error)redirect("/student/teachers?error=access");
  const american=profile?.education_system==="american",all=(raw??[]) as Activity[],items=american?all.filter(x=>x.americanCategory===category):all,units=new Map<string,{title:string;practice:number;homework:number}>();
  if(american)redirect(withAmericanCategory(`/student/teachers/${teacherId}/assignments`,category));
  for(const item of items){const unit=units.get(item.unitId)??{title:item.unitTitle,practice:0,homework:0};if(item.kind==="homework")unit.homework++;else unit.practice++;units.set(item.unitId,unit)}
  const href=(path:string)=>american?withAmericanCategory(path,category):path;
  return <main className="app-content portal-section"><div className="student-topbar"><Link href="/student/teachers" className="brand"><GraduationCap/>Academy</Link></div><Link className="back-link" href={href(`/student/teachers/${teacherId}/dashboard`)}><ArrowLeft/>Back to {teacher.display_name}</Link><header><div><small>{teacher.display_name}</small><h1>Units</h1><p>Choose a Unit to open its Self Practice or Homework.</p></div></header><section className="unit-student-grid">{[...units].map(([id,unit])=><Link className="panel student-unit-card" href={href(`/student/teachers/${teacherId}/activities/${id}`)} key={id}><span><BookOpen/></span><div><h2>{unit.title}</h2><p>{unit.practice} Self Practice · {unit.homework} Homework</p></div><b>Open Unit</b></Link>)}{!units.size&&<div className="empty-state"><BookOpen/><h2>No Units available</h2><p>Your teacher&apos;s published Units will appear here.</p></div>}</section></main>;
}
