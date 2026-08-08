import type {Metadata} from "next";
import Link from "next/link";
import {GraduationCap,LockKeyhole} from "lucide-react";
import {StudentResultsSearch} from "@/components/student-results-search";
export const metadata:Metadata={title:"Check Student Results | High Achievers",description:"Securely check a student's completed exam results."};
export default function StudentResultsPage(){return <main className="public-results-page"><nav className="nav shell"><Link href="/" className="brand"><span className="brand-mark"><GraduationCap size={22}/></span>High Achievers</Link><Link href="/auth/student/login" className="text-link">Student sign in</Link></nav><section className="results-hero shell"><div className="eyebrow"><LockKeyhole size={15}/>Secure public lookup</div><h1>Check student results</h1><p>Use one registered detail to view completed exams. No account sign-in is required.</p><StudentResultsSearch/></section></main>}
