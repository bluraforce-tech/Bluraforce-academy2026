import {createDecipheriv} from "crypto";
import Link from "next/link";
import {ArrowLeft,GraduationCap,IdCard,LogOut,Phone,School,UserRound} from "lucide-react";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {env} from "@/lib/env";
import {educationSystemLabel,nationalGradeLabel} from "@/lib/education-target";
import {logout} from "@/features/auth/actions";

function decryptNationalId(value:string,last4:string){
 try{if(!env.NATIONAL_ID_ENCRYPTION_KEY)return `••••••••••${last4}`;const packed=Buffer.from(value,"base64"),key=Buffer.from(env.NATIONAL_ID_ENCRYPTION_KEY,"base64");if(key.length!==32||packed.length<29)return `••••••••••${last4}`;const iv=packed.subarray(packed.length-12),tag=packed.subarray(packed.length-28,packed.length-12),encrypted=packed.subarray(0,packed.length-28),decipher=createDecipheriv("aes-256-gcm",key,iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(encrypted),decipher.final()]).toString("utf8")}catch{return `••••••••••${last4}`}
}

export default async function StudentProfilePage(){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/student/login");
 const [{data:profile},{data:student}]=await Promise.all([supabase.from("profiles").select("full_name,role").eq("id",user.id).single(),supabase.from("student_profiles").select("mobile,education_system,national_grade,national_id_encrypted,national_id_last4").eq("user_id",user.id).single()]);
 if(profile?.role!=="student"||!student)redirect("/");
 const nationalId=decryptNationalId(student.national_id_encrypted,student.national_id_last4),category=student.education_system==="national"?`${educationSystemLabel(student.education_system)} · ${nationalGradeLabel(student.national_grade)??"Grade not set"}`:educationSystemLabel(student.education_system);
 const fields=[{label:"Full name",value:profile.full_name,icon:UserRound},{label:"Mobile number",value:student.mobile,icon:Phone},{label:"Category",value:category,icon:School},{label:"National ID",value:nationalId,icon:IdCard}] as const;
 return <main className="app-content student-profile-page"><div className="student-topbar"><Link href="/student/teachers" className="brand"><span className="brand-mark"><GraduationCap/></span>Academy</Link><form action={logout}><button className="button secondary small" type="submit"><LogOut size={16}/>Sign out</button></form></div><Link className="back-link" href="/student/teachers"><ArrowLeft size={16}/>Back to teachers</Link><header><div><small>Student workspace</small><h1>My profile</h1><p>Your personal and education account information.</p></div><span className="profile-avatar"><UserRound/></span></header><section className="panel profile-details">{fields.map(({label,value,icon:Icon})=><article key={label}><span><Icon/></span><div><small>{label}</small><strong>{value}</strong></div></article>)}</section></main>;
}
