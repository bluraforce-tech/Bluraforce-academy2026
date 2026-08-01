import Link from "next/link";
import { ArrowLeft, BookOpen, GraduationCap, ShieldCheck, Sparkles, Users, Video } from "lucide-react";

const features = [
  { icon: BookOpen, title: "Smart exams", text: "Timed assessments, exact-set scoring, secure attempts, and mistake-based revision." },
  { icon: Video, title: "Protected lessons", text: "Assigned YouTube lessons play inside the platform with availability and view limits." },
  { icon: ShieldCheck, title: "Privacy by design", text: "Server validation and database row-level security isolate every teacher and student." },
];

export default async function Home() {
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
            <Link href="/auth/student/login" className="button">I&apos;m a student <ArrowLeft size={18}/></Link>
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
        <div className="hero-waves" aria-hidden="true">
          <svg viewBox="0 0 1440 220" preserveAspectRatio="none">
            <path className="wave wave-back" d="M0 95 C260 25 430 150 720 82 C980 20 1190 38 1440 105 L1440 220 L0 220 Z"><animate attributeName="d" dur="10s" repeatCount="indefinite" values="M0 95 C260 25 430 150 720 82 C980 20 1190 38 1440 105 L1440 220 L0 220 Z;M0 70 C230 145 470 30 730 98 C1010 170 1210 48 1440 82 L1440 220 L0 220 Z;M0 95 C260 25 430 150 720 82 C980 20 1190 38 1440 105 L1440 220 L0 220 Z"/></path>
            <path className="wave wave-middle" d="M0 115 C250 170 470 40 735 100 C1000 160 1200 72 1440 88 L1440 220 L0 220 Z"><animate attributeName="d" dur="8s" repeatCount="indefinite" values="M0 115 C250 170 470 40 735 100 C1000 160 1200 72 1440 88 L1440 220 L0 220 Z;M0 92 C220 35 470 155 720 105 C970 55 1200 140 1440 70 L1440 220 L0 220 Z;M0 115 C250 170 470 40 735 100 C1000 160 1200 72 1440 88 L1440 220 L0 220 Z"/></path>
            <path className="wave wave-front" d="M0 130 C260 78 470 178 720 125 C970 72 1190 150 1440 105 L1440 220 L0 220 Z"><animate attributeName="d" dur="7s" repeatCount="indefinite" values="M0 130 C260 78 470 178 720 125 C970 72 1190 150 1440 105 L1440 220 L0 220 Z;M0 112 C240 175 500 70 740 135 C980 198 1220 72 1440 120 L1440 220 L0 220 Z;M0 130 C260 78 470 178 720 125 C970 72 1190 150 1440 105 L1440 220 L0 220 Z"/></path>
          </svg>
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
