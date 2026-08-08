"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { QuestionImageUpload } from "@/components/question-image-upload";
import { QuestionTextEditor } from "@/components/question-text-editor";
import { addBankQuestionWithUploadedImage as addBankQuestion } from "./image-actions";
export function BankQuestionForm({ unitId }: { unitId: string }) {
  const [choices, setChoices] = useState([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ]);
  const [text,setText]=useState("");
  return (
    <form
      action={addBankQuestion}
      className="bank-question-form"
      onSubmit={(e) => {
        const f = new FormData(e.currentTarget);
        (
          e.currentTarget.elements.namedItem("payload") as HTMLInputElement
        ).value = JSON.stringify({
          unitId,
          text,
          imageUrl: f.get("imageUrl"),
          points: Number(f.get("points")),
          choices: choices.map((choice, index) => ({
            ...choice,
            text: choice.text.trim() || String.fromCharCode(65 + index),
          })),
        });
      }}
    >
      <input type="hidden" name="payload" />
      <div className="field">
        <label>Question name or text <small>Optional</small></label>
        <QuestionTextEditor value={text} onChange={setText}/>
      </div>
      <div className="form-grid">
        <QuestionImageUpload name="imageUrl" fileName="questionImage" />
        <div className="field">
          <label>Points</label>
          <input
            name="points"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue="1"
            required
          />
        </div>
      </div>
      <div className="choice-tools"><b>Answer choices</b><button className="button secondary small generate-choices-button" type="button" onClick={()=>setChoices(["A","B","C","D"].map((_,index)=>({text:"",isCorrect:index===0})))}>Generate A–D choices</button></div>
      {choices.map((c, i) => (
        <div className="choice-row" key={i}>
          <span className="choice-letter">{String.fromCharCode(65+i)}</span>
          <input
            value={c.text}
            onChange={(e) =>
              setChoices((v) =>
                v.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
              )
            }
            placeholder="Optional answer text"
          />
          {choices.length > 2 && (
            <button
              type="button"
              className="choice-delete"
              aria-label={`Delete choice ${i + 1}`}
              onClick={() => setChoices((v) => v.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </button>
          )}
          <label>
            <input
              type="checkbox"
              checked={c.isCorrect}
              onChange={(e) =>
                setChoices((v) =>
                  v.map((x, j) =>
                    j === i ? { ...x, isCorrect: e.target.checked } : x,
                  ),
                )
              }
            />
            Correct
          </label>
        </div>
      ))}
      <button
        className="text-action"
        type="button"
        onClick={() =>
          setChoices((v) => [...v, { text: "", isCorrect: false }])
        }
      >
        <Plus />
        Add choice
      </button>
      <button className="button small">Add question</button>
    </form>
  );
}
