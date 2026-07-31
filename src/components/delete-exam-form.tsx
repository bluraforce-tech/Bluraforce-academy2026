"use client";

import { deleteExam } from "@/features/exams/actions";

export function DeleteExamForm({ examId, title }: { examId: string; title: string }) {
  return (
    <form
      action={deleteExam}
      onSubmit={(event) => {
        if (!window.confirm(`Delete “${title}”? This will permanently remove its assignments, attempts, and results.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="examId" value={examId} />
      <button className="danger-link" type="submit">Delete</button>
    </form>
  );
}
