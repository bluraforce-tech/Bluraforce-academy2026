import Link from "next/link";
import {redirect} from "next/navigation";
import {ArrowLeft,BookOpen,ClipboardCheck} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {parseStudentAmericanCategory,withAmericanCategory} from "@/lib/student-american-category";

type Activity={unitId:string;unitTitle:string;kind:"self_practice"|"homework";americanCategory?:string|null};

export default async function UnitPage({params,searchParams}:{params:Promise<{teacherId:string;unitId:string}>;searchParams:Promise<{category?:string}>}) {
  const {teacherId,unitId}=await params,q=await searchParams,category=parseStudentAmericanCategory(q.category),s=await createClient(),{data:{user}}=await s.auth.getUser();
  if(!user)redirect("/auth/student/login");
  const [{data:raw,error},{data:profile}]=await Promise.all([s.rpc("get_student_activities",{p_teacher_id:teacherId}),s.from("student_profiles").select("education_system").eq("user_id",user.id).single()]);
  if(error)redirect("/student/teachers?error=access");
  const american=profile?.education_system==="american",items=((raw??[]) as Activity[]).filter(x=>x.unitId===unitId&&(!american||x.americanCategory===category));
  if(!items.length)redirect(american?withAmericanCategory(`/student/teachers/${teacherId}/activities`,category):`/student/teachers/${teacherId}/activities`);
  const href=(path:string)=>american?withAmericanCategory(path,category):path,title=items[0].unitTitle,practice=items.filter(x=>x.kind==="self_practice").length,homework=items.filter(x=>x.kind==="homework").length;
  return <main className="app-content portal-section"><Link className="back-link" href={href(`/student/teachers/${teacherId}/activities`)}><ArrowLeft/>Back to Units</Link><header><div><small>Unit</small><h1>{title}</h1><p>Choose the activity type you want to open.</p></div></header><div className="activity-type-grid"><Link className="panel activity-type-card" href={href(`/student/teachers/${teacherId}/activities/${unitId}/self_practice`)}><BookOpen/><div><h2>Self Practice</h2><p>Untimed practice without deadlines.</p></div><strong>{practice} available</strong></Link><Link className="panel activity-type-card homework" href={href(`/student/teachers/${teacherId}/activities/${unitId}/homework`)}><ClipboardCheck/><div><h2>Homework</h2><p>Assigned work with submission deadlines.</p></div><strong>{homework} available</strong></Link></div></main>;
}
