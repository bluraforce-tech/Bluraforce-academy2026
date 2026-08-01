"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createExam } from "./actions";
import {QuestionImageUpload} from "@/components/question-image-upload";

type Choice = { text: string; isCorrect: boolean };
type Question = { text: string; imageUrl: string; points: number; choices: Choice[]; sourceId?: string };
export type BankQuestion = Question & { sourceId: string; sourceTitle: string };
const blank = (): Question => ({ text: "", imageUrl: "", points: 1, choices: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] });

export function ExamBuilder({ students = [], questionBank = [] }: { students?: Array<{ id:string;name:string }>; questionBank?:BankQuestion[] }) {
  const [questions, setQuestions] = useState<Question[]>([blank()]);
  const [publish, setPublish] = useState(false);
  const [assignAll, setAssignAll] = useState(true);
  const changeQ = (i: number, patch: Partial<Question>) => setQuestions((value) => value.map((question, index) => index === i ? { ...question, ...patch } : question));
  const changeC = (qi: number, ci: number, patch: Partial<Choice>) => setQuestions((value) => value.map((question, index) => index === qi ? { ...question, choices: question.choices.map((choice, choiceIndex) => choiceIndex === ci ? { ...choice, ...patch } : choice) } : question));
  const selectedSources=new Set(questions.flatMap((question)=>question.sourceId?[question.sourceId]:[]));
  const toggleBankQuestion=(bankQuestion:BankQuestion)=>{
    if(selectedSources.has(bankQuestion.sourceId))setQuestions((value)=>value.filter((question)=>question.sourceId!==bankQuestion.sourceId));
    else setQuestions((value)=>[...value,{text:bankQuestion.text,imageUrl:bankQuestion.imageUrl,points:bankQuestion.points,choices:bankQuestion.choices.map((choice)=>({...choice})),sourceId:bankQuestion.sourceId}]);
  };

  return <form action={createExam} className="exam-builder" onSubmit={(event) => {
    const form = new FormData(event.currentTarget);
    const payload = {
      title: form.get("title"), description: form.get("description"), instructions: form.get("instructions"),
      durationMinutes: Number(form.get("durationMinutes")), startsAt: form.get("startsAt"), endsAt: form.get("endsAt"),
      maxAttempts: Number(form.get("maxAttempts")), passingScore: form.get("passingScore"),
      randomizeQuestions: form.get("randomizeQuestions") === "on", randomizeChoices: form.get("randomizeChoices") === "on",
      publish, assignAll, studentIds: form.getAll("studentIds"),
      questions: questions.map((question, index) => ({ ...question, position: index + 1, choices: question.choices.map((choice, choiceIndex) => ({ ...choice, position: choiceIndex + 1 })) })),
    };
    (event.currentTarget.elements.namedItem("payload") as HTMLInputElement).value = JSON.stringify(payload);
  }}>
    <input type="hidden" name="payload" />
    <section className="panel form-grid">
      <div className="field"><label>Title</label><input name="title" required minLength={3} /></div>
      <div className="field"><label>Duration (minutes)</label><input name="durationMinutes" type="number" min={1} max={600} defaultValue={30} required /></div>
      <div className="field full"><label>Description</label><textarea name="description" rows={3} /></div>
      <div className="field full"><label>Instructions</label><textarea name="instructions" rows={3} /></div>
      <div className="field"><label>Starts at</label><input name="startsAt" type="datetime-local" /></div>
      <div className="field"><label>Ends at</label><input name="endsAt" type="datetime-local" /></div>
      <div className="field"><label>Maximum attempts</label><input name="maxAttempts" type="number" min={1} max={20} defaultValue={1} /></div>
      <div className="field"><label>Passing score</label><input name="passingScore" type="number" min={0} step=".01" /></div>
      <label className="check"><input name="randomizeQuestions" type="checkbox" /><span><b>Randomize questions</b></span></label>
      <label className="check"><input name="randomizeChoices" type="checkbox" /><span><b>Randomize choices</b></span></label>
      <label className="check full"><input type="checkbox" checked={assignAll} onChange={(event) => setAssignAll(event.target.checked)} /><span><b>Assign to all active students</b></span></label>
      {!assignAll && <div className="student-selector full">{students.map((student) => <label key={student.id}><input type="checkbox" name="studentIds" value={student.id} />{student.name}</label>)}{!students.length && <small>No active students are enrolled.</small>}</div>}
    </section>

    {questionBank.length>0&&<section className="panel question-bank"><div className="panel-head"><div><h2>Old question bank</h2><p>Select questions to copy into this exam, then edit them if needed.</p></div></div><div className="question-bank-list">{questionBank.map((bankQuestion)=><label key={bankQuestion.sourceId}><input type="checkbox" checked={selectedSources.has(bankQuestion.sourceId)} onChange={()=>toggleBankQuestion(bankQuestion)}/><span><b>{bankQuestion.text}</b><small>{bankQuestion.sourceTitle} · {bankQuestion.points} points</small></span></label>)}</div></section>}

    <div className="builder-heading"><h2>Questions</h2></div>
    {questions.map((question, questionIndex) => <section className="panel question-editor" key={questionIndex}>
      <div className="question-top"><b>Question {questionIndex + 1}</b>{questions.length > 1 && <button type="button" onClick={() => setQuestions((value) => value.filter((_, index) => index !== questionIndex))}><Trash2 /></button>}</div>
      <div className="field"><label>Question text</label><textarea value={question.text} onChange={(event) => changeQ(questionIndex, { text: event.target.value })} rows={3} required /></div>
      <div className="form-grid">
        <QuestionImageUpload value={question.imageUrl} fileName={`questionImage_${questionIndex}`} onChange={(imageUrl)=>changeQ(questionIndex,{imageUrl})}/>
        <div className="field"><label>Points</label><input type="number" min=".01" step=".01" value={question.points} onChange={(event) => changeQ(questionIndex, { points: Number(event.target.value) })} /></div>
      </div>
      <div className="choices">{question.choices.map((choice, choiceIndex) => <div className="choice-row" key={choiceIndex}>
        <input value={choice.text} onChange={(event) => changeC(questionIndex, choiceIndex, { text: event.target.value })} placeholder={`Choice ${choiceIndex + 1}`} required />
        <label><input type="checkbox" checked={choice.isCorrect} onChange={(event) => changeC(questionIndex, choiceIndex, { isCorrect: event.target.checked })} />Correct</label>
        {question.choices.length > 2 && <button type="button" onClick={() => changeQ(questionIndex, { choices: question.choices.filter((_, index) => index !== choiceIndex) })}><Trash2 /></button>}
      </div>)}</div>
      <button className="text-action" type="button" onClick={() => changeQ(questionIndex, { choices: [...question.choices, { text: "", isCorrect: false }] })}><Plus />Add choice</button>
    </section>)}

    <button type="button" className="button secondary small add-question-bottom" onClick={() => setQuestions((value) => [...value, blank()])}><Plus />Add question</button>
    <div className="builder-actions">
      <button type="submit" className="button secondary" onClick={() => setPublish(false)}>Save draft</button>
      <button type="submit" className="button" onClick={() => setPublish(true)}>Publish & assign</button>
    </div>
  </form>;
}
