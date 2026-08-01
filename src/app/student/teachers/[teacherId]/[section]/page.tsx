import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpen, FileText, GraduationCap, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { startAttempt } from "@/features/exams/actions";
import { parseStudentAmericanCategory, withAmericanCategory } from "@/lib/student-american-category";

type Item = {
  assignmentId?: string;
  id?: string;
  title: string;
  description: string | null;
  durationMinutes?: number;
  endsAt?: string | null;
  maxViews?: number | null;
  countedViews?: number;
  remainingViews?: number | null;
  viewLimitReached?: boolean;
  americanCategory?: string | null;
};
type Portal = { exams: Item[]; videos: Item[]; materials: Item[]; studyNotes: Item[] };
type Attempt = {
  id: string;
  assignment_id: string;
  status: "in_progress" | "submitted" | "expired";
  score: number | null;
  attempt_number: number;
};

const labels = {
  exams: { title: "Exams", description: "Assessments assigned by this teacher.", icon: BookOpen },
  videos: { title: "Lesson videos", description: "Lessons available from this teacher.", icon: PlayCircle },
  materials: { title: "Material Books", description: "Books and learning resources assigned by this teacher.", icon: FileText },
  "study-notes": { title: "Study Notes", description: "Study notes and learning resources assigned by this teacher.", icon: FileText },
} as const;
const examErrors: Record<string, string> = {
  attempts: "You have reached the maximum number of attempts for this exam.",
  unavailable: "This exam has not started yet or its deadline has passed.",
  assigned: "This exam is not assigned to your account.",
  start: "The exam could not be started. Please try again.",
};

export default async function PortalSection({
  params,
  searchParams,
}: {
  params: Promise<{ teacherId: string; section: string }>;
  searchParams: Promise<{ error?: string; submitted?: string; category?: string }>;
}) {
  const { teacherId, section } = await params;
  const query = await searchParams;
  const category = parseStudentAmericanCategory(query.category);
  if (!(section in labels)) redirect(`/student/teachers/${teacherId}/dashboard`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/student/login");

  const { data: enrollment } = await supabase
    .from("teacher_student_enrollments").select("id")
    .eq("teacher_id", teacherId).eq("student_id", user.id).eq("status", "active")
    .or(`access_expires_at.is.null,access_expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();
  if (!enrollment) redirect("/student/teachers?error=access");

  const [{ data: teacher }, { data: raw, error }] = await Promise.all([
    supabase.from("teacher_profiles").select("display_name")
      .eq("user_id", teacherId).eq("is_active", true).single(),
    supabase.rpc("get_student_teacher_portal", { p_teacher_id: teacherId }),
  ]);
  if (!teacher || error) redirect("/student/teachers?error=access");

  const portal = raw as Portal;
  const renderedAt = Date.parse(new Date().toISOString());
  const key = (section==="study-notes"?"studyNotes":section) as keyof Portal;
  const {data:profile}=await supabase.from("student_profiles").select("education_system").eq("user_id",user.id).single();
  const american=profile?.education_system==="american";
  const sectionItems=portal[key]??[];
  const items = american ? sectionItems.filter(item=>item.americanCategory===category) : sectionItems;
  const config = labels[section as keyof typeof labels];
  const Icon = config.icon;
  const attemptsByAssignment = new Map<string, Attempt>();

  if (key === "exams") {
    const assignmentIds = items.flatMap((item) => item.assignmentId ? [item.assignmentId] : []);
    if (assignmentIds.length) {
      const { data: attempts } = await supabase.from("exam_attempts")
        .select("id,assignment_id,status,score,attempt_number")
        .in("assignment_id", assignmentIds)
        .order("attempt_number", { ascending: false });
      for (const attempt of (attempts ?? []) as Attempt[]) {
        if (!attemptsByAssignment.has(attempt.assignment_id)) {
          attemptsByAssignment.set(attempt.assignment_id, attempt);
        }
      }
    }
  }

  return (
    <main className="app-content portal-section">
      <div className="student-topbar">
        <Link href="/student/teachers" className="brand">
          <span className="brand-mark"><GraduationCap /></span>Academy
        </Link>
      </div>
      <Link className="back-link" href={american?withAmericanCategory(`/student/teachers/${teacherId}/dashboard`,category):`/student/teachers/${teacherId}/dashboard`}>
        <ArrowLeft size={16} />Back to {teacher.display_name}
      </Link>
      <header>
        <div><small>{teacher.display_name}</small><h1>{config.title}</h1><p>{config.description}</p></div>
      </header>
      {key === "exams" && query.submitted && (
        <p className="form-success">Your exam was submitted successfully.</p>
      )}
      {key === "exams" && query.error && (
        <p className="form-error">{examErrors[query.error] ?? examErrors.start}</p>
      )}
      <section className="panel section-list">
        {items.length === 0 ? (
          <div className="empty-state">
            <span><Icon /></span><h2>No {config.title.toLowerCase()} assigned</h2>
            <p>New assignments will appear here.</p>
          </div>
        ) : items.map((item, index) => {
          const body = (
            <>
              <span className="activity-icon"><Icon /></span>
              <div>
                <b>{item.title}</b>
                <small>
                  {item.description || `${config.title} item ${index + 1}`}
                  {item.durationMinutes ? ` · ${item.durationMinutes} minutes` : ""}
                </small>
              </div>
            </>
          );
          if (key === "videos") {
            if (item.viewLimitReached) {
              return <article className="activity locked-activity" key={item.id}>{body}<span>View limit reached</span></article>;
            }
            return <Link className="activity" href={`/student/videos/${item.id}`} key={item.id}>{body}<span>{item.remainingViews==null?"Open":`${item.remainingViews} views left`}</span></Link>;
          }
          if (key === "exams" && item.assignmentId) {
            const attempt = attemptsByAssignment.get(item.assignmentId);
            const completed = attempt && attempt.status !== "in_progress";
            const reviewAvailable = completed && item.endsAt && Date.parse(item.endsAt) <= renderedAt;
            return (
              <article className="activity" key={item.assignmentId}>
                {body}
                {completed ? (
                  <div className="exam-result-actions">
                    <span className="exam-score">Score: {attempt.score ?? 0}</span>
                    {reviewAvailable && (
                      <Link className="button secondary small" href={`/student/exams/attempts/${attempt.id}/results`}>
                        View mistakes
                      </Link>
                    )}
                  </div>
                ) : (
                  <form action={startAttempt}>
                    <input type="hidden" name="assignmentId" value={item.assignmentId} />
                    <input type="hidden" name="teacherId" value={teacherId} />
                    <button className="button small" type="submit">
                      {attempt?.status === "in_progress" ? "Resume exam" : "Start exam"}
                    </button>
                  </form>
                )}
              </article>
            );
          }
          if (key === "materials"||key === "studyNotes") return <Link className="activity" href={`/student/${key==="studyNotes"?"study-notes":"materials"}/${item.assignmentId}?teacherId=${teacherId}${american?`&category=${category}`:""}`} key={item.assignmentId}>{body}<span>Open</span></Link>;
          return <article className="activity" key={item.assignmentId}>{body}</article>;
        })}
      </section>
    </main>
  );
}
