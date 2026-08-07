"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Clock3, Send } from "lucide-react";
import { FormattedQuestionText } from "@/components/formatted-question-text";

type Choice = { id: string; text: string };
type Question = {
  id: string;
  text: string;
  imageUrl: string | null;
  pageImageUrl?: string | null;
  points: number;
  multiple: boolean;
  choices: Choice[];
};
type Props = {
  attemptId: string;
  teacherId: string;
  returnSection: string;
  untimed?: boolean;
  expiresAt: string;
  serverNow: string;
  status: string;
  exam: { title: string; instructions: string | null; questions: Question[] };
  initialAnswers: Record<string, string[]>;
};

export function ExamAttempt({
  attemptId,
  teacherId,
  returnSection,
  expiresAt,
  serverNow,
  status,
  exam,
  initialAnswers,
  untimed = false,
}: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState(initialAnswers);
  const [remaining, setRemaining] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const deadline = useMemo(() => Date.parse(expiresAt), [expiresAt]);
  const serverBase = useMemo(() => Date.parse(serverNow), [serverNow]);

  useEffect(() => {
    if (untimed) return;
    const begun = performance.now();
    const controller = new AbortController();
    let submitted = false;
    const tick = () => {
      const serverTime = serverBase + performance.now() - begun;
      const value = Math.max(0, Math.ceil((deadline - serverTime) / 1000));
      setRemaining(value);
      if (value === 0 && status === "in_progress" && !submitted) {
        submitted = true;
        fetch(`/api/exams/attempts/${attemptId}/submit`, {
          method: "POST",
          signal: controller.signal,
        })
          .then(async (response) => {
            const result = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(result?.message ?? "Unable to submit the exam.");
            }
            router.push(`/student/teachers/${teacherId}/${returnSection}${returnSection.includes("?")?"&":"?"}submitted=1`);
          })
          .catch((error) => {
            if (error.name !== "AbortError") {
              submitted = false;
              setSubmitError(
                error instanceof Error ? error.message : "Unable to submit the exam.",
              );
            }
          });
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [attemptId, deadline, router, serverBase, status, teacherId, returnSection, untimed]);

  async function choose(questionId: string, choiceId: string, multiple: boolean) {
    const current = answers[questionId] ?? [];
    const next = multiple
      ? current.includes(choiceId)
        ? current.filter((id) => id !== choiceId)
        : [...current, choiceId]
      : [choiceId];
    setAnswers((value) => ({ ...value, [questionId]: next }));
    setSaving(questionId);
    setSaveError(null);
    try {
      const response = await fetch(`/api/exams/attempts/${attemptId}/answers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId, choiceIds: next }),
      });
      if (!response.ok) throw new Error("Your answer could not be saved.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Your answer could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  async function submitExam() {
    if (submitting) return;
    const unanswered = exam.questions.filter((question) => !(answers[question.id]?.length)).length;
    if (unanswered > 0 && !window.confirm(`You still have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Submit anyway?`)) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/exams/attempts/${attemptId}/submit`, {
        method: "POST",
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.message ?? "Unable to submit the exam.");
      }
      router.push(`/student/teachers/${teacherId}/${returnSection}${returnSection.includes("?")?"&":"?"}submitted=1`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to submit the exam.",
      );
      setSubmitting(false);
    }
  }

  const closed = status !== "in_progress";
  const answeredCount = exam.questions.filter((question) => (answers[question.id]?.length ?? 0) > 0).length;
  const progress = exam.questions.length ? Math.round((answeredCount / exam.questions.length) * 100) : 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <main className="attempt-page">
      <header className="attempt-header">
        <div>
          <small>{untimed ? "Practice exam" : "Timed exam"}</small>
          <h1>{exam.title}</h1>
          <p>{exam.instructions}</p>
        </div>
        {!untimed&&<div className={`exam-timer ${remaining < 300 ? "warning" : ""}`}>
          <small><Clock3 size={14} /> Time remaining</small>
          <strong>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </strong>
          <span>Server controlled</span>
        </div>}
      </header>

      <aside className="exam-sidebar">
      <section className="exam-progress panel" aria-label="Exam progress">
        <div className="exam-progress-copy">
          <div><CheckCircle2 size={18} /><strong>{answeredCount} of {exam.questions.length} answered</strong></div>
          <span>{progress}% complete</span>
        </div>
        <div className="exam-progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <nav className="question-jump" aria-label="Jump to a question">
          {exam.questions.map((question, index) => <a className={(answers[question.id]?.length ?? 0) > 0 ? "answered" : ""} href={`#question-${index + 1}`} key={question.id} aria-label={`Question ${index + 1}${(answers[question.id]?.length ?? 0) > 0 ? ", answered" : ", unanswered"}`}>{(answers[question.id]?.length ?? 0) > 0 && <Check size={12} />}{index + 1}</a>)}
        </nav>
        {saveError && <p className="inline-save-error" role="alert">{saveError} Select the answer again to retry.</p>}
      </section>
      <div className="attempt-submit sidebar-submit">
        {submitError && <p role="alert" className="form-error">{submitError}</p>}
        {closed ? <p>This attempt has been submitted.</p> : <button className="button" disabled={submitting || saving !== null || closed} onClick={submitExam}><Send size={17} />{submitting ? "Submitting…" : "Submit exam"}</button>}
      </div>
      </aside>

      {exam.questions.map((question, index) => (
        <section className="panel attempt-question" id={`question-${index + 1}`} key={question.id}>
          <div className="question-number">
            Question {index + 1} · {question.points} points{" "}
            {saving === question.id && <span>Saving…</span>}
          </div>
          {question.pageImageUrl && <div className="question-media-page"><img src={question.pageImageUrl} alt={`Page for question ${index + 1}`} /></div>}
          {question.imageUrl && <div className="question-media-page question-specific-image"><img src={question.imageUrl} alt={`Question ${index + 1}`} /></div>}
          <h2><FormattedQuestionText text={question.text}/></h2>
          {saving !== question.id && (answers[question.id]?.length ?? 0) > 0 && <span className="answer-saved"><Check size={13} /> Answer saved</span>}
          <div className="attempt-choices">
            {question.choices.map((choice,choiceIndex) => {
              const letter=String.fromCharCode(65+choiceIndex);
              return (
              <label key={choice.id}>
                <input
                  type={question.multiple ? "checkbox" : "radio"}
                  name={question.id}
                  checked={(answers[question.id] ?? []).includes(choice.id)}
                  disabled={closed || submitting}
                  onChange={() => choose(question.id, choice.id, question.multiple)}
                />
                <span><b className="student-choice-letter">{letter}</b>{choice.text!==letter&&choice.text}</span>
              </label>
            )})}
          </div>
        </section>
      ))}

    </main>
  );
}
