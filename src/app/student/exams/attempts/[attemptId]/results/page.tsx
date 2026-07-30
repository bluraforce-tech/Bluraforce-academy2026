import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Result = {
  teacherId: string; title: string; score: number; totalPoints: number;
  questions: Array<{
    id: string; text: string; imageUrl: string | null; points: number;
    awardedPoints: number; isCorrect: boolean;
    choices: Array<{ id: string; text: string; isCorrect: boolean; selected: boolean }>;
  }>;
};

export default async function ExamResultsPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/student/login");
  const { data, error } = await supabase.rpc("get_student_exam_result", { p_attempt_id: attemptId });
  if (error || !data) redirect("/student/teachers");
  const result = data as Result;
  return (
    <main className="attempt-page result-page">
      <Link className="back-link" href={`/student/teachers/${result.teacherId}/exams`}>
        <ArrowLeft size={16} /> Back to exams
      </Link>
      <header>
        <small>Exam review</small><h1>{result.title}</h1>
        <p className="result-score">Score: <strong>{result.score} / {result.totalPoints}</strong></p>
      </header>
      {result.questions.map((question, index) => (
        <section className={`panel result-question ${question.isCorrect ? "correct" : "incorrect"}`} key={question.id}>
          <div className="result-heading">
            <span>{question.isCorrect ? <CheckCircle2 /> : <XCircle />}Question {index + 1}</span>
            <b>{question.awardedPoints} / {question.points} points</b>
          </div>
          <h2>{question.text}</h2>
          {question.imageUrl && <img src={question.imageUrl} alt="Question" />}
          <div className="result-choices">
            {question.choices.map((choice) => (
              <div className={`${choice.isCorrect ? "correct-choice" : ""} ${choice.selected ? "selected-choice" : ""}`} key={choice.id}>
                <span>{choice.text}</span>
                <small>
                  {choice.isCorrect ? "Correct answer" : ""}
                  {choice.selected ? `${choice.isCorrect ? " · " : ""}Your answer` : ""}
                </small>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
