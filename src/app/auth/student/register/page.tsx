import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { registerStudent } from "@/features/auth/actions";

const errors:Record<string,string>={
 invalid:"Check the entered information. The National ID must contain exactly 14 digits.",
 email:"An account already exists with this email address. Sign in instead or use another email.",
 configuration:"Account creation is temporarily unavailable because the server credentials are invalid.",
 account:"The account could not be created. Please check your details and try again.",
 identity:"This National ID is already registered or could not be verified.",
};
export default async function RegisterPage({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error}=await searchParams;
 const fields=[["fullName","Full name","text"],["email","Email address","email"],["password","Password","password"],["age","Age","number"],["address","Address","text"],["mobile","Mobile number","tel"],["guardianMobile","Parent or guardian mobile","tel"],["nationalId","National ID","text"]];
 return <main className="auth-shell"><section className="auth-art"><Link href="/" className="brand"><GraduationCap/> Academy</Link><div><h2>Your learning journey starts here.</h2><p>Create your account first. You can choose and join a teacher securely afterwards.</p></div><small>No teacher code is required to register.</small></section><section className="auth-panel"><form action={registerStudent} className="auth-form"><h1>Create student account</h1><p>Use accurate details to protect your account.</p>{error&&<p className="form-error" role="alert">{errors[error]??errors.account}</p>}{fields.map(([name,label,type])=><div className="field" key={name}><label htmlFor={name}>{label}</label><input id={name} name={name} type={type} required minLength={name==="password"?8:name==="nationalId"?14:undefined} maxLength={name==="nationalId"?14:undefined} inputMode={name==="nationalId"?"numeric":undefined} pattern={name==="nationalId"?"[0-9٠-٩]{14}":undefined} title={name==="nationalId"?"Enter exactly 14 digits":undefined}/>{name==="nationalId"&&<small>Enter exactly 14 digits. Arabic or English numerals are accepted.</small>}</div>)}<button className="button">Create account</button><p className="form-note">Already registered? <Link href="/auth/student/login">Sign in</Link></p></form></section></main>;
}
