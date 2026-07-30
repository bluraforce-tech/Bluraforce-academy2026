import Link from "next/link";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { login } from "@/features/auth/actions";

export default async function LoginPage({params}:{params:Promise<{role:string}>}) {
  const {role}=await params; const valid=["student","teacher","admin"].includes(role)?role:"student";
  const labels={student:"Student",teacher:"Teacher",admin:"Administrator"} as const;
  return <main className="auth-shell">
    <section className="auth-art"><Link href="/" className="brand"><GraduationCap/> Academy</Link><div><ShieldCheck size={38}/><h2>Learning begins with a secure space.</h2><p>Your lessons, progress, and results stay connected to the right people.</p></div></section>
    <section className="auth-panel"><form action={login} className="auth-form">{valid!=="admin"&&<div className="login-role-selector"><small>Sign in as</small><div><Link className={valid==="student"?"active":""} href="/auth/student/login">Student</Link><Link className={valid==="teacher"?"active":""} href="/auth/teacher/login">Teacher</Link></div></div>}<input type="hidden" name="role" value={valid}/><h1>{labels[valid as keyof typeof labels]} sign in</h1><p>Enter your account details to continue.</p><div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required/></div><div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required/></div><button className="button">Sign in</button><p className="form-note"><Link href="/auth/reset">Forgot password?</Link></p>{valid==="student"&&<p className="form-note">New to Academy? <Link href="/auth/student/register">Create an account</Link></p>}</form></section>
  </main>
}
