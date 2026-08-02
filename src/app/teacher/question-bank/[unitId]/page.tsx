import Link from "next/link";
import {redirect} from "next/navigation";
import {ArrowLeft, BookOpen, ClipboardCheck, Trash2} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {getTeacherEducationTarget} from "@/lib/teacher-education-context";
import {deleteUnit} from "@/features/question-bank/actions";

export default async function TeacherUnitPage({params}: {params: Promise<{unitId: string}>}) {
  const {unitId} = await params;
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect("/auth/teacher/login");
  const target = await getTeacherEducationTarget();
  if (!target) redirect("/teacher/dashboard?error=environment-required");
  let unitQuery = supabase.from("question_bank_units").select("id,title,description,question_bank_questions(id)").eq("id", unitId).eq("teacher_id", user.id).eq("education_system", target.educationSystem);
  unitQuery = target.educationSystem === "national" ? unitQuery.eq("national_grade", target.nationalGrade) : unitQuery.is("national_grade", null);
  unitQuery=target.educationSystem==="american"?unitQuery.eq("american_category",target.americanCategory):unitQuery.eq("national_grade",target.nationalGrade);
  const [{data: unit}, {data: activities}] = await Promise.all([unitQuery.single(), supabase.from("exams").select("id,kind").eq("teacher_id", user.id).eq("source_unit_id", unitId).in("kind", ["self_practice", "homework"])]);
  if (!unit) redirect("/teacher/question-bank");
  const practice = activities?.filter(item => item.kind === "self_practice").length ?? 0;
  const homework = activities?.filter(item => item.kind === "homework").length ?? 0;
  return <main className="app-content portal-section">
    <Link className="back-link" href="/teacher/question-bank"><ArrowLeft/>Back to Units</Link>
    <header><div><small>Unit</small><h1>{unit.title}</h1><p>{unit.description || "Choose the activity type you want to manage."}</p></div><form action={deleteUnit}><input type="hidden" name="unitId" value={unit.id}/><button className="danger-link"><Trash2/>Delete Unit</button></form></header>
    <div className="activity-type-grid">
      <Link className="panel activity-type-card" href={`/teacher/question-bank/${unit.id}/self_practice`}><BookOpen/><div><h2>Self Practice</h2><p>Create and manage untimed practice modules.</p></div><strong>{practice} modules</strong></Link>
      <Link className="panel activity-type-card homework" href={`/teacher/question-bank/${unit.id}/homework`}><ClipboardCheck/><div><h2>Homework</h2><p>Create and manage homework with deadlines.</p></div><strong>{homework} modules</strong></Link>
    </div>
    <p className="unit-question-summary">{unit.question_bank_questions.length} saved questions are available to reuse in this Unit.</p>
  </main>;
}
