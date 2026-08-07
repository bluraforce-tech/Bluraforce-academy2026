"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, Eye, FileQuestion, Plus, Trash2, Users, X } from "lucide-react";
import { createExam } from "./actions";
import {QuestionImageUpload} from "@/components/question-image-upload";

type Choice = { text: string; isCorrect: boolean };
type Question = { text: string; imageUrl: string; points: number; choices: Choice[]; sourceId?: string; imageGroupIndex?: number; questionNumber?: number };
export type BankQuestion = Question & { sourceId: string; sourceTitle: string };
const blank = (questionNumber = 1): Question => ({ text: "", imageUrl: "", points: 1, questionNumber, choices: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] });
const abcd=():Choice[]=>["A","B","C","D"].map((_,index)=>({text:"",isCorrect:index===0}));

export function ExamBuilder({ students = [], questionBank = [] }: { students?: Array<{ id:string;name:string }>; questionBank?:BankQuestion[] }) {
  const [questions, setQuestions] = useState<Question[]>([{...blank(),imageGroupIndex:0}]);
  const [imageGroups,setImageGroups]=useState<number[]>([0]);
  const [assignAll, setAssignAll] = useState(true);
  const [title,setTitle]=useState("");
  const [previewOpen,setPreviewOpen]=useState(false);
  const [groupPreviews,setGroupPreviews]=useState<Record<number,string>>({});
  const changeQ = (i: number, patch: Partial<Question>) => setQuestions((value) => value.map((question, index) => index === i ? { ...question, ...patch } : question));
  const changeC = (qi: number, ci: number, patch: Partial<Choice>) => setQuestions((value) => value.map((question, index) => index === qi ? { ...question, choices: question.choices.map((choice, choiceIndex) => choiceIndex === ci ? { ...choice, ...patch } : choice) } : question));
  const selectedSources=new Set(questions.flatMap((question)=>question.sourceId?[question.sourceId]:[]));
  const totalPoints=questions.reduce((sum,question)=>sum+(Number(question.points)||0),0);
  const bankPages=Object.values(questionBank.reduce<Record<string,{id:string;title:string;imageUrl:string;questions:BankQuestion[]}>>((pages,question)=>{
    const id=`${question.sourceTitle}::${question.imageUrl||question.sourceId}`;
    if(!pages[id])pages[id]={id,title:question.sourceTitle,imageUrl:question.imageUrl,questions:[]};
    pages[id].questions.push(question);
    return pages;
  },{}));
  const toggleBankPage=(page:(typeof bankPages)[number])=>{
    const pageSelected=page.questions.every(question=>selectedSources.has(question.sourceId));
    if(pageSelected)setQuestions(value=>value.filter(question=>!page.questions.some(item=>item.sourceId===question.sourceId)));
    else setQuestions(value=>{
      const existing=new Set(value.flatMap(question=>question.sourceId?[question.sourceId]:[]));
      const additions=page.questions.filter(question=>!existing.has(question.sourceId)).map((question,index)=>({text:question.text,imageUrl:question.imageUrl,points:question.points,choices:question.choices.map(choice=>({...choice})),sourceId:question.sourceId,questionNumber:value.length+index+1}));
      return [...value,...additions];
    });
  };

  return <form action={createExam} className="exam-builder" onSubmit={(event) => {
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const publish = submitter?.value === "publish";
    const payload = {
      title: form.get("title"), description: form.get("description"), instructions: form.get("instructions"),
      durationMinutes: Number(form.get("durationMinutes")), startsAt: form.get("startsAt"), endsAt: form.get("endsAt"),
      maxAttempts: Number(form.get("maxAttempts")), passingScore: form.get("passingScore"),
      randomizeQuestions: form.get("randomizeQuestions") === "on", randomizeChoices: form.get("randomizeChoices") === "on",
      publish, assignAll, studentIds: form.getAll("studentIds"),
      questions: questions.map((question, index) => ({ ...question, position: question.questionNumber ?? index + 1, choices: question.choices.map((choice, choiceIndex) => ({ ...choice, text:choice.text.trim()||String.fromCharCode(65+choiceIndex), position: choiceIndex + 1 })) })),
    };
    (event.currentTarget.elements.namedItem("payload") as HTMLInputElement).value = JSON.stringify(payload);
  }}>
    <input type="hidden" name="payload" />
    <section className="builder-overview" aria-label="Exam overview">
      <div><FileQuestion /><span><strong>{questions.length}</strong><small>Questions</small></span></div>
      <div><CheckCircle2 /><span><strong>{totalPoints}</strong><small>Total points</small></span></div>
      <div><Clock3 /><span><strong>30 min</strong><small>Default duration</small></span></div>
      <div><Users /><span><strong>{assignAll ? "All" : "Selected"}</strong><small>Audience</small></span></div>
    </section>
    <section className="panel form-grid exam-settings">
      <div className="form-section-title full"><span>1</span><div><h2>Exam details</h2><p>Set the schedule, scoring, and student access.</p></div></div>
      <div className="field"><label>Title</label><input name="title" value={title} onChange={event=>setTitle(event.target.value)} required minLength={3} /></div>
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

    {questionBank.length>0&&<section className="panel question-bank"><div className="panel-head"><div><h2>Old exam pages</h2><p>Select a complete page to reuse its uploaded image and all questions.</p></div></div><div className="question-bank-pages">{bankPages.map(page=>{const selected=page.questions.every(question=>selectedSources.has(question.sourceId));return <article className={selected?"selected":""} key={page.id}><button type="button" className="bank-page-select" onClick={()=>toggleBankPage(page)} aria-pressed={selected}><span className="bank-page-check">{selected?<CheckCircle2/>:<Plus/>}</span><span><b>{selected?"Page added":"Add this page"}</b><small>{page.questions.length} questions · {page.questions.reduce((sum,question)=>sum+question.points,0)} points</small></span></button>{page.imageUrl?<div className="bank-page-image"><img src={page.imageUrl} alt={`Page from ${page.title}`}/></div>:<div className="bank-page-image empty">No uploaded page image</div>}<div className="bank-page-details"><strong>{page.title}</strong>{page.questions.map((question,index)=><div key={question.sourceId}><span>{question.questionNumber||index+1}</span><p>{question.text}</p></div>)}</div></article>})}</div></section>}

    <div className="builder-heading"><div><h2>Question pages</h2><p>Upload a page, then add all of its questions directly underneath.</p></div></div>
    {imageGroups.map((groupId,pageIndex)=><section className="panel question-page-group" key={groupId}>
      <div className="question-page-heading"><div><small>QUESTION PAGE {pageIndex+1}</small><h2>Upload image, then add its questions</h2></div>{imageGroups.length>1&&<button type="button" className="text-action danger" onClick={()=>{setImageGroups(v=>v.filter(id=>id!==groupId));setQuestions(v=>v.filter(q=>q.imageGroupIndex!==groupId))}}><Trash2/>Remove page</button>}</div>
      <QuestionImageUpload fileName={`questionGroupImage_${groupId}`} onPreviewChange={url=>setGroupPreviews(value=>({...value,[groupId]:url}))}/>
      <div className="questions-under-image">{questions.map((question, questionIndex) => question.imageGroupIndex===groupId&&<section className="question-editor" key={questionIndex}>
      <div className="question-top"><label className="question-number-input"><span>Question number</span><input type="number" min="1" value={question.questionNumber ?? ""} onChange={(event)=>changeQ(questionIndex,{questionNumber:Number(event.target.value)})} required /></label>{questions.length > 1 && <button type="button" aria-label={`Delete question ${question.questionNumber ?? questionIndex + 1}`} onClick={() => setQuestions((value) => value.filter((_, index) => index !== questionIndex))}><Trash2 /></button>}</div>
      <div className="field"><label>Question name or text</label><textarea value={question.text} onChange={(event) => changeQ(questionIndex, { text: event.target.value })} rows={3} required /></div>
      <div className="form-grid">
        <div className="field"><label>Points</label><input type="number" min=".01" step=".01" value={question.points} onChange={(event) => changeQ(questionIndex, { points: Number(event.target.value) })} /></div>
      </div>
      <div className="choice-tools"><b>Answer choices</b><button className="button secondary small generate-choices-button" type="button" onClick={()=>changeQ(questionIndex,{choices:abcd()})}>Generate A–D choices</button></div>
      <div className="choices">{question.choices.map((choice, choiceIndex) => <div className="choice-row" key={choiceIndex}>
        <span className="choice-letter">{String.fromCharCode(65+choiceIndex)}</span><input value={choice.text} onChange={(event) => changeC(questionIndex, choiceIndex, { text: event.target.value })} placeholder="Optional answer text" />
        {question.choices.length > 2 && <button type="button" className="choice-delete" aria-label={`Delete option ${String.fromCharCode(65+choiceIndex)}`} onClick={() => changeQ(questionIndex, { choices: question.choices.filter((_, index) => index !== choiceIndex) })}><Trash2 /></button>}
        <label className="correct-toggle"><input type="checkbox" checked={choice.isCorrect} onChange={(event) => changeC(questionIndex, choiceIndex, { isCorrect: event.target.checked })} /><span><CheckCircle2 />Correct answer</span></label>
      </div>)}</div>
      <button className="text-action" type="button" onClick={() => changeQ(questionIndex, { choices: [...question.choices, { text: "", isCorrect: false }] })}><Plus />Add choice</button>
      </section>)}</div>
      <button type="button" className="button secondary small add-question-bottom" onClick={()=>setQuestions(v=>[...v,{...blank(v.length+1),imageGroupIndex:groupId}])}><Plus/>Add question under this image</button>
    </section>)}
    <div className="exam-page-actions">
      <button type="button" className="button secondary add-image-bottom" onClick={()=>{const id=Math.max(-1,...imageGroups)+1;setImageGroups(v=>[...v,id]);setQuestions(v=>[...v,{...blank(v.length+1),imageGroupIndex:id}])}}><Plus/>Add another page</button>
      <button type="button" className="button exam-preview-launch" onClick={()=>setPreviewOpen(true)}><Eye/>Preview full student exam</button>
    </div>

    {previewOpen&&<div className="exam-preview-overlay" role="dialog" aria-modal="true" aria-label="Student exam preview">
      <div className="exam-preview-shell">
        <header className="exam-preview-header"><div><small>STUDENT VIEW · LIVE PREVIEW</small><h1>{title.trim()||"Untitled exam"}</h1><p>{questions.length} questions · {totalPoints} total points</p></div><button type="button" aria-label="Close preview" onClick={()=>setPreviewOpen(false)}><X/></button></header>
        <main className="exam-preview-content">
          {imageGroups.map((groupId,pageIndex)=><section className="exam-preview-page" key={groupId}>
            <div className="preview-page-label"><span>Page {pageIndex+1}</span><small>{questions.filter(question=>question.imageGroupIndex===groupId).length} questions</small></div>
            {groupPreviews[groupId]?<div className="question-media-page"><img src={groupPreviews[groupId]} alt={`Uploaded exam page ${pageIndex+1}`}/></div>:<div className="preview-image-empty">No image uploaded for this page yet</div>}
            <div className="preview-question-list">{questions.filter(question=>question.imageGroupIndex===groupId).map((question,index)=><article className="panel preview-question" key={`${groupId}-${index}`}><div><b>Question {question.questionNumber||"—"}</b><span>{question.points} points</span></div><h2>{question.text||"Question text will appear here"}</h2><div className="preview-choices">{question.choices.map((choice,choiceIndex)=><div key={choiceIndex}><b>{String.fromCharCode(65+choiceIndex)}</b><span>{choice.text||`Answer ${String.fromCharCode(65+choiceIndex)}`}</span></div>)}</div></article>)}</div>
          </section>)}
          {questions.some(question=>question.imageGroupIndex===undefined)&&<section className="exam-preview-page"><div className="preview-page-label"><span>Question bank</span></div><div className="preview-question-list">{questions.filter(question=>question.imageGroupIndex===undefined).map((question,index)=><article className="panel preview-question" key={`bank-${index}`}><div><b>Question {question.questionNumber||"—"}</b><span>{question.points} points</span></div><h2>{question.text||"Question text will appear here"}</h2>{question.imageUrl&&<div className="question-media-page"><img src={question.imageUrl} alt="Question"/></div>}<div className="preview-choices">{question.choices.map((choice,choiceIndex)=><div key={choiceIndex}><b>{String.fromCharCode(65+choiceIndex)}</b><span>{choice.text||`Answer ${String.fromCharCode(65+choiceIndex)}`}</span></div>)}</div></article>)}</div></section>}
        </main>
      </div>
    </div>}

    {questions.some(q=>q.imageGroupIndex===undefined)&&<><div className="builder-heading"><h2>Questions from your bank</h2></div>{questions.map((question,questionIndex)=>question.imageGroupIndex===undefined&&<section className="panel question-editor" key={questionIndex}><div className="question-top"><b>Question {questionIndex+1}</b><button type="button" onClick={()=>setQuestions(v=>v.filter((_,i)=>i!==questionIndex))}><Trash2/></button></div><div className="field"><label>Question name or text</label><textarea value={question.text} onChange={e=>changeQ(questionIndex,{text:e.target.value})} required/></div><QuestionImageUpload value={question.imageUrl} fileName={`questionImage_${questionIndex}`} onChange={imageUrl=>changeQ(questionIndex,{imageUrl})}/><div className="field"><label>Points</label><input type="number" min=".01" step=".01" value={question.points} onChange={e=>changeQ(questionIndex,{points:Number(e.target.value)})}/></div><div className="choice-tools"><b>Answer choices</b><button className="button secondary small generate-choices-button" type="button" onClick={()=>changeQ(questionIndex,{choices:abcd()})}>Generate A–D choices</button></div><div className="choices">{question.choices.map((choice,choiceIndex)=><div className="choice-row" key={choiceIndex}><span className="choice-letter">{String.fromCharCode(65+choiceIndex)}</span><input value={choice.text} placeholder={`Option ${String.fromCharCode(65+choiceIndex)}`} onChange={e=>changeC(questionIndex,choiceIndex,{text:e.target.value})} required/><label><input type="checkbox" checked={choice.isCorrect} onChange={e=>changeC(questionIndex,choiceIndex,{isCorrect:e.target.checked})}/>Correct</label></div>)}</div></section>)}</>}
    <div className="builder-actions panel">
      <p><strong>Ready to finish?</strong><span>Save a draft to continue later, or publish it to your students now.</span></p>
      <button type="submit" name="publishIntent" value="draft" className="button secondary">Save draft</button>
      <button type="submit" name="publishIntent" value="publish" className="button">Publish & assign</button>
    </div>
  </form>;
}
