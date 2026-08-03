import Link from "next/link";
import { createMaterialBook, updateMaterialBook } from "./actions";

type Student = { id: string; full_name: string };
type InitialMaterial = {id:string;title:string;description:string|null;materialType:string;externalUrl:string;coverImageUrl:string|null;availableFrom:string;availableUntil:string;published:boolean;studentIds:string[]};

export function MaterialForm({kind,students,initial}:{kind:"material_book"|"study_note";students:Student[];initial?:InitialMaterial}) {
  return <form action={initial?updateMaterialBook:createMaterialBook} className="panel teacher-form">
    <input type="hidden" name="contentKind" value={kind}/>
    {initial&&<input type="hidden" name="materialId" value={initial.id}/>}
    <div className="form-grid">
      <div className="field"><label>Title</label><input name="title" required minLength={3} defaultValue={initial?.title}/></div>
      <div className="field"><label>Material type</label><input name="materialType" required defaultValue={initial?.materialType}/></div>
      <div className="field full"><label>Description</label><textarea name="description" defaultValue={initial?.description??""}/></div>
      <div className="field full"><label>Resource URL</label><input name="externalUrl" type="url" required defaultValue={initial?.externalUrl}/></div>
      <div className="field full"><label>Cover image URL</label><input name="coverImageUrl" type="url" defaultValue={initial?.coverImageUrl??""}/></div>
      <div className="field"><label>Available from</label><input name="availableFrom" type="datetime-local" defaultValue={initial?.availableFrom}/></div>
      <div className="field"><label>Available until</label><input name="availableUntil" type="datetime-local" defaultValue={initial?.availableUntil}/></div>
      <label className="check"><input name="publish" type="checkbox" defaultChecked={initial?.published??true}/>Published</label>
      <label className="check"><input name="assignAll" type="checkbox" defaultChecked={!initial}/>Assign all matching students</label>
      <div className="student-selector full">{students.map(student=><label key={student.id}><input name="studentIds" type="checkbox" value={student.id} defaultChecked={initial?.studentIds.includes(student.id)}/>{student.full_name}</label>)}</div>
    </div>
    <div className="form-actions">{initial&&<Link className="button secondary" href={`/teacher/${kind==="study_note"?"study-notes":"materials"}`}>Cancel</Link>}<button className="button">{initial?"Save changes":`Create ${kind==="study_note"?"study note":"material book"}`}</button></div>
  </form>;
}
