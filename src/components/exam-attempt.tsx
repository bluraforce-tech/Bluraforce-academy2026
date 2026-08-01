"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Choice = { id: string; text: string };
type Question = {
  id: string;
  text: string;
  imageUrl: string | null;
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
    await fetch(`/api/exams/attempts/${attemptId}/answers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId, choiceIds: next }),
    });
    setSaving(null);
  }

  async function submitExam() {
    if (submitting) return;
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
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const imageQuestions = new Map<string, number[]>();
  exam.questions.forEach((question, index) => {
    if (question.imageUrl) imageQuestions.set(question.imageUrl, [...(imageQuestions.get(question.imageUrl) ?? []), index + 1]);
  });
  const sharedImages = [...imageQuestions.entries()].filter(([, numbers]) => numbers.length > 1);
  const sharedImageUrls = new Set(sharedImages.map(([url]) => url));

  return (
    <main className="attempt-page">
      <header className="attempt-header">
        <div>
          <small>Timed exam</small>
          <h1>{exam.title}</h1>
          <p>{exam.instructions}</p>
        </div>
        {!untimed&&<div className={`exam-timer ${remaining < 300 ? "warning" : ""}`}>
          <small>Time remaining</small>
          <strong>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </strong>
          <span>Server controlled</span>
        </div>}
      </header>

      {sharedImages.map(([url, numbers]) => (
        <section className="panel shared-question-stimulus" key={url}>
          <div className="shared-question-label">Use this page for questions {numbers.join(", ")}</div>
          <div className="question-media-page"><img src={url} alt={`Shared page for questions ${numbers.join(", ")}`} /></div>
        </section>
      ))}

      {exam.questions.map((question, index) => (
        <section className="panel attempt-question" key={question.id}>
          <div className="question-number">
            Question {index + 1} · {question.points} points{" "}
            {saving === question.id && <span>Saving…</span>}
          </div>
          <h2>{question.text}</h2>
          {question.imageUrl && !sharedImageUrls.has(question.imageUrl) && <div className="question-media-page"><img src={question.imageUrl} alt="Question" /></div>}
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

      <div className="attempt-submit">
        {submitError && (
          <p role="alert" className="form-error">
            {submitError}
          </p>
        )}
        {closed ? (
          <p>This attempt has been submitted.</p>
        ) : (
          <button
            className="button"
            disabled={submitting || saving !== null}
            onClick={submitExam}
          >
            {submitting ? "Submitting…" : "Submit exam"}
          </button>
        )}
      </div>
    </main>
  );
}
