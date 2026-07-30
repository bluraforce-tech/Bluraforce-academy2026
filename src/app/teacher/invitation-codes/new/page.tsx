import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft,GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { InvitationCodeForm } from "@/features/invitation-codes/code-form";
export default async function NewCodePage(){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/teacher/login");
 const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).single();if(profile?.role!=="teacher")redirect("/");
 return <main className="app-frame"><aside><Link href="/" className="brand"><span className="brand-mark"><GraduationCap/></span>Academy</Link><nav><Link className="active" href="/teacher/invitation-codes">Invitation codes</Link><Link href="/teacher/dashboard">Dashboard</Link></nav></aside><section className="app-content form-page"><Link className="back-link" href="/teacher/invitation-codes"><ArrowLeft size={16}/> Back to codes</Link><header><div><small>Teacher workspace</small><h1>Generate student code</h1><p>Create a secure one-time code for one student.</p></div></header><InvitationCodeForm/></section></main>
}
