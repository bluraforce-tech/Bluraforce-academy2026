import Link from "next/link";
import {redirect} from "next/navigation";
import {ArrowLeft, BookOpen} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {getTeacherEducationTarget} from "@/lib/teacher-education-context";
import {EducationTargetBadge} from "@/components/education-target-badge";
import {createCategorizedUnit as createUnit} from "@/features/question-bank/unit-actions";

export default async function QuestionBankPage({searchParams}: {searchParams: Promise<{error?: string; created?: string}>}) {
  const query = await searchParams;
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect("/auth/teacher/login");
  const target = await getTeacherEducationTarget();
  if (!target) redirect("/teacher/dashboard?error=environment-required");

  let unitsQuery = supabase.from("question_bank_units").select("id,title,description,question_bank_questions(id)")
    .eq("teacher_id", user.id).eq("education_system", target.educationSystem).order("created_at", {ascending: false});
  unitsQuery = target.educationSystem === "national" ? unitsQuery.eq("national_grade", target.nationalGrade) : unitsQuery.is("national_grade", null);
  if(target.educationSystem==="american")unitsQuery=unitsQuery.eq("american_category",target.americanCategory);
  const {data: units} = await unitsQuery;

  return <main className="app-content question-bank-page">
    <Link className="back-link" href="/teacher/dashboard"><ArrowLeft/>Back to dashboard</Link>
    <header><div><small>Teacher workspace</small><h1>Question Bank</h1><p>Choose a Unit to manage its Self Practice and Homework.</p></div><EducationTargetBadge educationSystem={target.educationSystem} americanCategory={target.americanCategory} nationalGrade={target.nationalGrade}/></header>
    {query.error && <p className="form-error">The Unit could not be saved. Please check its details.</p>}
    {query.created && <p className="form-success">Unit created successfully.</p>}
    <section className="panel"><h2>Create Unit</h2><form action={createUnit} className="unit-create form-grid"><div className="field"><label>Unit title</label><input name="title" required/></div><div className="field"><label>Description</label><input name="description"/></div><button className="button small">Create Unit</button></form></section>
    <section className="unit-student-grid">
      {(units ?? []).map(unit => <Link className="panel student-unit-card" href={`/teacher/question-bank/${unit.id}`} key={unit.id}><span><BookOpen/></span><div><h2>{unit.title}</h2><p>{unit.description || "No description"} · {unit.question_bank_questions.length} saved questions</p></div><b>Open Unit</b></Link>)}
      {!units?.length && <div className="empty-state"><BookOpen/><h2>No Units yet</h2><p>Create the first Unit for this environment.</p></div>}
    </section>
  </main>;
}
