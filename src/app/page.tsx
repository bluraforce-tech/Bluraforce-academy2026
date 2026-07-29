import Link from "next/link";
import { ArrowLeft, BookOpen, GraduationCap, ShieldCheck, Sparkles, Users, Video } from "lucide-react";

const features = [
  { icon: BookOpen, title: "Smart exams", text: "Timed assessments, exact-set scoring, secure attempts, and mistake-based revision." },
  { icon: Video, title: "Protected lessons", text: "Assigned YouTube lessons play inside the platform with availability and view limits." },
  { icon: ShieldCheck, title: "Privacy by design", text: "Server validation and database row-level security isolate every teacher and student." },
];

export default function Home() {
  return (
    <main>
      <nav className="nav shell">
        <Link href="/" className="brand"><span className="brand-mark"><GraduationCap size={22}/></span>Academy</Link>
        <div className="nav-actions"><Link href="/auth/student/login" className="text-link">Sign in</Link><Link href="/auth/student/register" className="button small">Create account</Link></div>
      </nav>
      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15}/> A safer way to learn and teach</div>
          <h1>Learning that stays<br/><span>focused, personal, and secure.</span></h1>
          <p>One modern home for lessons, exams, revision, and learning materials—built around each student&apos;s progress.</p>
          <div className="hero-actions">
            <Link href="/auth/student/register" className="button">I&apos;m a student <ArrowLeft size={18}/></Link>
            <Link href="/auth/teacher/login" className="button secondary">I&apos;m a teacher</Link>
          </div>
          <div className="trust"><span><ShieldCheck size={17}/> Secure access</span><span><Users size={17}/> Teacher-led learning</span></div>
        </div>
        <div className="hero-card">
          <div className="dashboard-preview">
            <div className="preview-top"><span className="avatar">AM</span><div><b>Welcome back, Ahmed</b><small>Your learning dashboard</small></div><span className="status">On track</span></div>
            <div className="progress-ring"><div><strong>78%</strong><small>Weekly progress</small></div></div>
            <div className="preview-grid"><article><BookOpen/><span><b>3</b><small>Active exams</small></span></article><article><Video/><span><b>6</b><small>New lessons</small></span></article></div>
            <div className="next-lesson"><span className="play">▶</span><div><small>Continue learning</small><b>Introduction to electronics</b></div><span>24 min</span></div>
          </div>
        </div>
      </section>
      <section className="feature-section shell">
        <div className="section-heading"><span>Everything in one place</span><h2>Designed for meaningful progress</h2><p>Teachers get precise control. Students get a clear path forward.</p></div>
        <div className="features">{features.map(({icon: Icon, title, text}) => <article key={title}><span><Icon/></span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <footer className="shell"><Link href="/" className="brand"><GraduationCap size={20}/>Academy</Link><p>Secure learning, thoughtfully built.</p><Link href="/auth/admin/login">Admin access</Link></footer>
    </main>
  );
}
