import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpen, Brain, FileText, GraduationCap, LayoutDashboard, Library, PlayCircle, Shuffle, Ticket, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { revokeInvitationCode } from "@/features/invitation-codes/actions";
import { toggleExamVisibility, toggleMistakesExamVisibility } from "@/features/exams/actions";
import { DeleteExamForm } from "@/components/delete-exam-form";
import { EducationTargetBadge } from "@/components/education-target-badge";
import { getTeacherEducationTarget } from "@/lib/teacher-education-context";
import { toggleMaterialVisibility } from "@/features/materials/actions";
import { MobileAppNav } from "@/components/mobile-app-nav";

export const dynamic = "force-dynamic";

const sections = {
  teachers: ["Teachers", "Manage teacher accounts.", "teacher_profiles", "user_id,display_name,biography,is_active,created_at"],
  students: ["Students", "View students available to your role.", "profiles", "id,full_name,created_at"],
  "invitation-codes": ["Invitation codes", "Review secure enrolment codes.", "student_invitation_codes", "id,code_masked,status,expires_at,access_duration_days,education_system,american_category,national_grade,created_at"],
  exams: ["Exams", "Create, publish, assign, and review assessments.", "exams", "id,title,status,duration_minutes,education_system,american_category,national_grade,created_at"],
  "mistakes-exams": ["Mistakes exams", "Review automatically generated student revision exams and their results.", "exams", "id,title,status,duration_minutes,created_at"],
  videos: ["Lesson videos", "Manage internal lesson playback.", "lesson_videos", "id,title,status,lesson_name,education_system,american_category,national_grade,created_at"],
  materials: ["Material Books", "Manage assigned books and learning resources.", "materials", "id,title,status,material_type,education_system,american_category,national_grade,created_at"],
  "study-notes": ["Study Notes", "Manage assigned study notes and learning resources.", "materials", "id,title,status,material_type,education_system,american_category,national_grade,created_at"],
  activity: ["Recent activity", "Review platform actions.", "audit_logs", "id,action,entity_type,created_at"],
} as const;

const nav = [
  ["Dashboard", "dashboard", LayoutDashboard], ["Teachers", "teachers", GraduationCap],
  ["Students", "students", Users], ["Invitation codes", "invitation-codes", Ticket],
  ["Question Bank", "question-bank", Library],
  ["Assignments", "assignments", Library],
  ["Exams", "exams", BookOpen], ["Mistakes exams", "mistakes-exams", Brain],
  ["Random exam", "exams/random", Shuffle], ["Exam from old questions", "exams/from-bank", Library],
  ["Lesson videos", "videos", PlayCircle], ["Material Books", "materials", FileText],
  ["Study Notes", "study-notes", FileText],
] as const;

export default async function SectionPage({ params }: { params: Promise<{ role: string; section: string }> }) {
  const { role, section } = await params;
  if (!["admin", "teacher", "student"].includes(role) || !(section in sections)) redirect("/");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/${role}/login`);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== role) redirect("/");
  const teacherTarget=role==="teacher"?await getTeacherEducationTarget():null;

  const [title, description, table, select] = sections[section as keyof typeof sections];
  let rows: Record<string, unknown>[] = [];
  if (section === "mistakes-exams" && role === "teacher") {
    if(!teacherTarget)redirect("/teacher/dashboard?error=environment-required");
    let mistakesQuery=supabase.from("exams").select("id,title,status,duration_minutes,created_at").eq("teacher_id", user.id).eq("kind", "mistakes").eq("education_system",teacherTarget.educationSystem);
    mistakesQuery=teacherTarget.educationSystem==="american"?mistakesQuery.eq("american_category",teacherTarget.americanCategory):mistakesQuery.eq("national_grade",teacherTarget.nationalGrade);
    const { data: exams } = await mistakesQuery.order("created_at", { ascending: false });
    const examIds = (exams ?? []).map((exam) => exam.id);
    const { data: assignments } = examIds.length ? await supabase.from("exam_assignments").select("id,exam_id,student_id,revoked_at").in("exam_id", examIds) : { data: [] };
    const studentIds = [...new Set((assignments ?? []).map((assignment) => assignment.student_id))];
    const { data: students } = studentIds.length ? await supabase.from("profiles").select("id,full_name").in("id", studentIds) : { data: [] };
    const names = new Map((students ?? []).map((student) => [student.id, student.full_name]));
    const byExam = new Map((assignments ?? []).map((assignment) => [assignment.exam_id, assignment]));
    rows = (exams ?? []).map((exam) => {
      const assignment = byExam.get(exam.id);
      return { ...exam, assignment_id: assignment?.id, student_name: assignment ? names.get(assignment.student_id) ?? "Student" : "Student", visible: Boolean(assignment && !assignment.revoked_at) };
    });
  } else if (section === "students" && role !== "admin") {
    const teacher = role === "teacher";
    const field = teacher ? "student_id" : "teacher_id";
    const owner = teacher ? "teacher_id" : "student_id";
    const { data: enrollments } = await supabase.from("teacher_student_enrollments").select(`${field},status,enrolled_at`).eq(owner, user.id).eq("status", "active");
    const ids = (enrollments ?? []).map((item) => String(item[field as keyof typeof item]));
    const target = teacher ? "profiles" : "teacher_profiles";
    const idField = teacher ? "id" : "user_id";
    const { data } = ids.length ? await supabase.from(target).select(teacher ? "id,full_name,created_at" : "user_id,display_name,biography,is_active,created_at").in(idField, ids) : { data: [] };
    rows = (data ?? []) as unknown as Record<string, unknown>[];
  } else {
    let query = supabase.from(table).select(select).order("created_at", { ascending: false }).limit(50);
    if (section === "students" && role === "admin") query = query.eq("role", "student");
    else if (role === "teacher" && ["exams", "mistakes-exams", "videos", "materials", "study-notes", "invitation-codes"].includes(section)) {
      if(!teacherTarget)redirect("/teacher/dashboard?error=environment-required");
      query=query.eq("teacher_id",user.id).eq("education_system",teacherTarget.educationSystem);
      if(section!=="invitation-codes")query=teacherTarget.educationSystem==="american"?query.eq("american_category",teacherTarget.americanCategory):query.eq("national_grade",teacherTarget.nationalGrade);
      else if(teacherTarget.educationSystem==="national")query=query.eq("national_grade",teacherTarget.nationalGrade);
    }
    if (section === "exams") query = query.eq("kind", "standard");
    if (section === "mistakes-exams") query = query.eq("kind", "mistakes");
    if (section === "materials") query = query.eq("resource_kind", "material_book");
    if (section === "study-notes") query = query.eq("resource_kind", "study_note");
    const { data } = await query;
    rows = (data ?? []) as unknown as Record<string, unknown>[];
  }

  const createTeacher = role === "admin" && section === "teachers";
  const generateCode = role === "teacher" && section === "invitation-codes";
  const createExam = role === "teacher" && section === "exams";
  const createVideo = role === "teacher" && section === "videos";
  const createMaterial = role === "teacher" && section === "materials";
  const createStudyNote = role === "teacher" && section === "study-notes";
  const reviewExam = role === "teacher" && ["exams", "mistakes-exams"].includes(section);
  const manageStudentPassword = role === "admin" && section === "students";
  const action = manageStudentPassword ? <Link className="button small" href="/admin/students/password">Change student password</Link>
    : createTeacher ? <Link className="button small" href="/admin/teachers/new">Add teacher</Link>
    : generateCode ? <Link className="button small" href="/teacher/invitation-codes/new">Generate code</Link>
    : createExam ? <Link className="button small" href="/teacher/exams/new">Add exam</Link>
    : createVideo ? <Link className="button small" href="/teacher/videos/new">Add video</Link>
    : createMaterial ? <Link className="button small" href="/teacher/materials/new">Add material book</Link>
    : createStudyNote ? <Link className="button small" href="/teacher/study-notes/new">Add study note</Link> : null;

  const visibleNav=nav.filter(([label]) => role === "admin" ? ["Dashboard","Teachers","Students"].includes(label) : label !== "Teachers"&&(teacherTarget?.educationSystem==="american"?label!=="Question Bank":label!=="Assignments"));
  return <main className="app-frame"><MobileAppNav items={visibleNav.map(([label,path])=>({label,href:`/${role}/${path}`,active:path===section}))}/>
    <aside>
      <Link href="/" className="brand"><span className="brand-mark"><GraduationCap /></span>Academy</Link>
      <nav>{visibleNav.map(([label, path, Icon]) => <Link key={path} className={path === section ? "active" : ""} href={`/${role}/${path}`}><Icon size={19} />{label}</Link>)}</nav>
    </aside>
    <section className="app-content">
      <Link className="back-link" href={`/${role}/dashboard`}><ArrowLeft size={16} />Back to dashboard</Link>
      <header className="section-title"><div><small>{role} workspace</small><h1>{title}</h1><p>{description}</p></div>{action}</header>
      <section className="panel records-panel">
        {rows.length === 0 ? <div className="empty-state"><span><FileText /></span><h2>No records yet</h2><p>Records you are authorized to access will appear here.</p>{action && <div className="empty-action">{action}</div>}</div>
          : <div className="records">{rows.map((row, index) => {
            const status = String(row.status ?? "");
            return <article key={String(row.id ?? row.user_id ?? index)}>
              <div>
                <b>{String(row.display_name ?? row.full_name ?? row.title ?? row.code_masked ?? row.action ?? "Record")}</b>
                <small>{status === "archived" ? "Hidden" : String(row.status ?? row.entity_type ?? row.biography ?? (row.is_active === true ? "Active" : "Inactive"))}{row.duration_minutes ? ` · ${row.duration_minutes} minutes` : ""}</small>
                {["invitation-codes","exams","videos","materials","study-notes"].includes(section)&&<EducationTargetBadge educationSystem={row.education_system} americanCategory={row.american_category} nationalGrade={row.national_grade}/>}
                {section === "mistakes-exams" && Boolean(row.student_name) && <small>Student: {String(row.student_name)} · {Boolean(row.visible) ? "Visible" : "Hidden"}</small>}
              </div>
              <div className="record-actions">
                <time>{row.created_at ? new Date(String(row.created_at)).toLocaleDateString() : ""}</time>
                {createTeacher && <Link className="text-action" href={`/admin/teachers/${String(row.user_id)}/edit`}>Edit</Link>}
                {reviewExam && <Link className="text-action" href={`/teacher/exams/${String(row.id)}/results`}>Results</Link>}
                {createExam && <Link className="text-action" href={`/teacher/exams/${String(row.id)}/edit`}>Edit</Link>}
                {createExam && ["published", "archived"].includes(status) && <form action={toggleExamVisibility}><input type="hidden" name="examId" value={String(row.id)} /><button className={`visibility-action ${status === "published" ? "hide" : "show"}`}>{status === "published" ? "Hide" : "Show"}</button></form>}
                {section === "mistakes-exams" && Boolean(row.assignment_id) && <form action={toggleMistakesExamVisibility}><input type="hidden" name="assignmentId" value={String(row.assignment_id)} /><input type="hidden" name="visible" value={Boolean(row.visible) ? "false" : "true"} /><button className={`visibility-action ${Boolean(row.visible) ? "hide" : "show"}`}>{Boolean(row.visible) ? "Hide from student" : "Show to student"}</button></form>}
                {reviewExam && <DeleteExamForm examId={String(row.id)} title={String(row.title ?? "exam")} />}
                {createVideo && <Link className="text-action" href={`/teacher/videos/${String(row.id)}/edit`}>Edit</Link>}
                {(createMaterial||createStudyNote)&&<Link className="text-action" href={`/teacher/${section}/${String(row.id)}/edit`}>Edit</Link>}
                {(createMaterial||createStudyNote)&&["published","archived"].includes(status)&&<form action={toggleMaterialVisibility}><input type="hidden" name="materialId" value={String(row.id)}/><input type="hidden" name="contentKind" value={createStudyNote?"study_note":"material_book"}/><input type="hidden" name="show" value={status==="archived"?"true":"false"}/><button className={`visibility-action ${status==="published"?"hide":"show"}`}>{status==="published"?"Hide":"Show"}</button></form>}
                {generateCode && status === "active" && <form action={revokeInvitationCode}><input type="hidden" name="codeId" value={String(row.id)} /><button className="danger-link">Revoke</button></form>}
              </div>
            </article>;
          })}</div>}
      </section>
    </section>
  </main>;
}
