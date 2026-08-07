import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExamAttempt } from "@/components/exam-attempt";

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/student/login");

  const [{ data, error }, { data: attempt }] = await Promise.all([
    supabase.rpc("get_attempt_payload", { p_attempt_id: attemptId }),
    supabase
      .from("exam_attempts")
      .select("exam_assignments(exams(teacher_id,kind,education_system,american_category))")
      .eq("id", attemptId)
      .single(),
  ]);
  if (error || !data || !attempt) redirect("/student/teachers");

  const relation = attempt.exam_assignments as unknown as {
    exams: { teacher_id: string; kind: string;education_system:string;american_category:string|null };
  };
  const payload = data as {
    attemptId: string;
    expiresAt: string;
    status: string;
    exam: {
      title: string;
      description: string | null;
      instructions: string | null;
      questions: Array<{
        id: string;
        text: string;
        imageUrl: string | null;
        pageImageUrl?: string | null;
        points: number;
        multiple: boolean;
        choices: Array<{ id: string; text: string }>;
      }>;
    };
    answers: Record<string, string[]>;
  };
  return (
    <ExamAttempt
      {...payload}
      teacherId={relation.exams.teacher_id}
      returnSection={relation.exams.kind === "mistakes" ? "mistakes-exams" : ["self_practice","homework"].includes(relation.exams.kind) ? relation.exams.education_system==="american"?`assignments?category=${relation.exams.american_category??"classified"}`:"activities" : "exams"}
      untimed={["self_practice","homework"].includes(relation.exams.kind)}
      serverNow={new Date().toISOString()}
      initialAnswers={payload.answers ?? {}}
    />
  );
}
