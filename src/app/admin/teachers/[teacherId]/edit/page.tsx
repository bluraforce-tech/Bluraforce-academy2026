import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateTeacher } from "@/features/teachers/actions";

const errors:Record<string,string>={
 invalid:"Check the teacher information and try again.",
 profile:"The teacher profile could not be updated.",
 email:"That email address is already being used.",
 account:"The teacher login information could not be updated.",
};
export default async function EditTeacherPage({params,searchParams}:{params:Promise<{teacherId:string}>;searchParams:Promise<{error?:string}>}){
 const {teacherId}=await params,query=await searchParams,supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/admin/login");
 const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).single();if(profile?.role!=="admin")redirect("/");
 const admin=createAdminClient();const [{data:teacher},{data:account}]=await Promise.all([
  admin.from("teacher_profiles").select("user_id,display_name,image_url,biography,is_active").eq("user_id",teacherId).maybeSingle(),
  admin.auth.admin.getUserById(teacherId),
 ]);if(!teacher||!account.user)redirect("/admin/teachers");
 return <main className="app-frame"><aside><Link href="/" className="brand"><span className="brand-mark"><GraduationCap/></span>Academy</Link><nav><Link className="active" href="/admin/teachers">Teachers</Link><Link href="/admin/dashboard">Dashboard</Link></nav></aside><section className="app-content form-page"><Link className="back-link" href="/admin/teachers"><ArrowLeft size={16}/>Back to teachers</Link><header><div><small>Admin workspace</small><h1>Edit teacher</h1><p>Update the teacher profile and login information.</p></div></header>{query.error&&<p className="form-error">{errors[query.error]??errors.profile}</p>}<form action={updateTeacher} className="panel teacher-form"><input type="hidden" name="teacherId" value={teacher.user_id}/><div className="form-grid"><div className="field"><label htmlFor="displayName">Display name</label><input id="displayName" name="displayName" defaultValue={teacher.display_name} minLength={3} maxLength={120} required/></div><div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" defaultValue={account.user.email??""} required/></div><div className="field"><label htmlFor="password">New password</label><input id="password" name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password"/><small>Leave blank to keep the current password.</small></div><div className="field"><label htmlFor="imageUrl">Profile image URL</label><input id="imageUrl" name="imageUrl" type="url" defaultValue={teacher.image_url??""} placeholder="https://…"/></div><div className="field full"><label htmlFor="biography">Biography</label><textarea id="biography" name="biography" defaultValue={teacher.biography??""} maxLength={1000} rows={5}/></div><label className="check full"><input type="checkbox" name="isActive" defaultChecked={teacher.is_active}/><span><b>Active teacher</b><small>Inactive teachers are hidden from students and cannot provide active access.</small></span></label></div><div className="form-actions"><Link className="button secondary" href="/admin/teachers">Cancel</Link><button className="button" type="submit">Save changes</button></div></form></section></main>;
}
