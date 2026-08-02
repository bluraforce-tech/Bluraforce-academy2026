import Link from "next/link";
import {redirect} from "next/navigation";
import {ArrowLeft, BookOpen, ClipboardCheck} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {getTeacherEducationTarget} from "@/lib/teacher-education-context";
import {ActivityForm} from "@/features/question-bank/activity-form";
import {ModuleControls} from "@/features/question-bank/module-controls";

type Kind = "self_practice" | "homework";
export default async function TeacherActivityGroupPage({params, searchParams}: {params: Promise<{unitId: string; kind: string}>; searchParams: Promise<{error?: string; created?: string; updated?: string; deleted?: string; visibility?: string}>}) {
  const [{unitId, kind: rawKind}, query] = await Promise.all([params, searchParams]);
  if (rawKind !== "self_practice" && rawKind !== "homework") redirect(`/teacher/question-bank/${unitId}`);
  const kind: Kind = rawKind;
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect("/auth/teacher/login");
  const target = await getTeacherEducationTarget();
  if (!target) redirect("/teacher/dashboard?error=environment-required");
  let unitQuery = supabase.from("question_bank_units").select("id,title,question_bank_questions(id,text,points,position)").eq("id", unitId).eq("teacher_id", user.id).eq("education_system", target.educationSystem);
  unitQuery = target.educationSystem === "national" ? unitQuery.eq("national_grade", target.nationalGrade) : unitQuery.is("national_grade", null);
  unitQuery=target.educationSystem==="american"?unitQuery.eq("american_category",target.americanCategory):unitQuery.eq("national_grade",target.nationalGrade);
  const [{data: unit}, {data: modules}] = await Promise.all([
    unitQuery.single(),
    supabase.from("exams")
      .select("id,title,status,ends_at,created_at,exam_assignments(id,exam_attempts(id,status,score,submitted_at))")
      .eq("teacher_id", user.id).eq("source_unit_id", unitId).eq("kind", kind)
      .order("created_at", {ascending: false}),
  ]);
  if (!unit) redirect("/teacher/question-bank");
  const questions = unit.question_bank_questions.sort((a, b) => a.position - b.position);
  const homework = kind === "homework";
  const label = homework ? "Homework" : "Self Practice";
  const Icon = homework ? ClipboardCheck : BookOpen;
  return <main className="app-content question-bank-page">
    <Link className="back-link" href={`/teacher/question-bank/${unit.id}`}><ArrowLeft/>Back to Unit</Link>
    <header><div><small>{unit.title}</small><h1>{label}</h1><p>View existing modules or create a new one using old and new questions.</p></div></header>
    {query.error && <p className="form-error">Check the questions, correct answers, and {homework ? "homework deadline" : "activity details"}.</p>}
    {query.created && <p className="form-success">{label} created successfully.</p>}
    {query.updated && <p className="form-success">Module updated successfully.</p>}
    {query.deleted && <p className="form-success">Module deleted successfully.</p>}
    {query.visibility && <p className="form-success">Module {query.visibility === "shown" ? "shown to" : "hidden from"} students.</p>}
    <section className="panel section-list"><div className="panel-head"><div><h2>Available modules</h2><p>{modules?.length ?? 0} {label.toLowerCase()} modules in this Unit.</p></div></div>
      {(modules ?? []).map(module => {
        const attempts = module.exam_assignments.flatMap(assignment => assignment.exam_attempts);
        const submitted = attempts.filter(attempt => attempt.status !== "in_progress");
        return <article className="activity" key={module.id}>
          <span className="activity-icon"><Icon/></span>
          <div><b>{module.title}</b><small>{homework && module.ends_at ? `Due ${new Date(module.ends_at).toLocaleString()}` : "No deadline"} · {submitted.length} of {module.exam_assignments.length} submitted</small></div>
          <div className="module-actions"><Link className="button secondary small" href={`/teacher/exams/${module.id}/results`}>View students & scores</Link><ModuleControls id={module.id} title={module.title} status={module.status} editHref={`/teacher/question-bank/${unit.id}/${kind}/${module.id}/edit`}/></div>
        </article>;
      })}
      {!modules?.length && <div className="empty-state"><Icon/><h2>No {label} modules yet</h2></div>}
    </section>
    <section className="panel teacher-activity-create"><h2>Create {label}</h2><ActivityForm unitId={unit.id} oldQuestions={questions.map(question => ({id: question.id, text: question.text, points: Number(question.points)}))} initialKind={kind}/></section>
  </main>;
}
