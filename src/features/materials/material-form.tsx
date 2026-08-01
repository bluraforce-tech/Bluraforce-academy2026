import { createMaterialBook } from "./actions";

type Student = { id: string; full_name: string };

export function MaterialForm({kind,students}:{kind:"material_book"|"study_note";students:Student[]}) {
  return <form action={createMaterialBook} className="panel teacher-form">
    <input type="hidden" name="contentKind" value={kind}/>
    <div className="form-grid">
      <div className="field"><label>Title</label><input name="title" required minLength={3}/></div>
      <div className="field"><label>Material type</label><input name="materialType" required/></div>
      <div className="field full"><label>Description</label><textarea name="description"/></div>
      <div className="field full"><label>Resource URL</label><input name="externalUrl" type="url" required/></div>
      <div className="field full"><label>Cover image URL</label><input name="coverImageUrl" type="url"/></div>
      <div className="field"><label>Available from</label><input name="availableFrom" type="datetime-local"/></div>
      <div className="field"><label>Available until</label><input name="availableUntil" type="datetime-local"/></div>
      <label className="check"><input name="publish" type="checkbox" defaultChecked/>Publish now</label>
      <label className="check"><input name="assignAll" type="checkbox" defaultChecked/>Assign all matching students</label>
      <div className="student-selector full">{students.map(student=><label key={student.id}><input name="studentIds" type="checkbox" value={student.id}/>{student.full_name}</label>)}</div>
    </div>
    <div className="form-actions"><button className="button">Create {kind==="study_note"?"study note":"material book"}</button></div>
  </form>;
}
