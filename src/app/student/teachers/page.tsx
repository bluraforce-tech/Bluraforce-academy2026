import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap,LogOut,UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/features/auth/actions";
import { redeemInvitationCode } from "@/features/invitation-codes/actions";

export default async function TeachersPage({searchParams}:{searchParams:Promise<{error?:string}>}){
 const query=await searchParams,supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/student/login");
 const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).single();if(profile?.role!=="student")redirect("/");
 const now=new Date().toISOString();
 const [{data:teachers},{data:enrollments}]=await Promise.all([
  supabase.from("teacher_profiles").select("user_id,display_name,image_url,biography").eq("is_active",true).order("display_name"),
  supabase.from("teacher_student_enrollments").select("teacher_id,access_expires_at").eq("student_id",user.id).eq("status","active").or(`access_expires_at.is.null,access_expires_at.gt.${now}`),
 ]);
 const active=new Map((enrollments??[]).map(item=>[item.teacher_id,item.access_expires_at]));
 const messages:Record<string,string>={invalid:"Enter a valid invitation code.","wrong-teacher":"This code belongs to a different teacher.",expired:"This code has expired.",used:"This code was already used or revoked.",access:"Your access to this teacher is unavailable or has expired."};
 return <main className="app-content student-teachers"><div className="student-topbar"><Link href="/student/teachers" className="brand"><span className="brand-mark"><GraduationCap/></span>Academy</Link><form action={logout}><button className="button secondary small" type="submit"><LogOut size={16}/>Sign out</button></form></div><header><div><small>Student workspace</small><h1>Available teachers</h1><p>Open an activated teacher or enter that teacher&apos;s invitation code.</p></div></header>{query.error&&<p className="form-error">{messages[query.error]??"The code is invalid."}</p>}<div className="teacher-cards">{(teachers??[]).map(teacher=>{const expires=active.get(teacher.user_id);return <article className="panel teacher-card" key={teacher.user_id}>{teacher.image_url?<img src={teacher.image_url} alt="" />:<span className="teacher-avatar"><UserRound/></span>}<div><h2>{teacher.display_name}</h2><p>{teacher.biography||"Teacher on Academy"}</p></div>{active.has(teacher.user_id)?<div className="active-teacher"><small>Activated{expires?` until ${new Date(expires).toLocaleDateString()}`:""}</small><Link className="button" href={`/student/teachers/${teacher.user_id}/dashboard`}>Open learning portal</Link></div>:<form action={redeemInvitationCode}><input type="hidden" name="teacherId" value={teacher.user_id}/><div className="field"><label htmlFor={`code-${teacher.user_id}`}>Teacher invitation code</label><input id={`code-${teacher.user_id}`} name="code" placeholder="ABCD-EFGH" autoComplete="off" required/></div><button className="button" type="submit">Join teacher</button></form>}</article>})}</div>{!teachers?.length&&<div className="empty-state"><span><GraduationCap/></span><h2>No active teachers</h2><p>Active teachers will appear here.</p></div>}</main>;
}
