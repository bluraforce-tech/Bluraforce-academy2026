"use client";
import Link from "next/link";
import {deleteModule,toggleModuleVisibility} from "./module-actions";

export function ModuleControls({id,title,status,editHref}:{id:string;title:string;status:string;editHref:string}){
 return <div className="module-controls">
  <Link className="button secondary small" href={editHref}>Edit</Link>
  <form action={toggleModuleVisibility}><input type="hidden" name="moduleId" value={id}/><button className={`visibility-action ${status==="published"?"hide":"show"}`}>{status==="published"?"Hide":"Show"}</button></form>
  <form action={deleteModule} onSubmit={event=>{if(!window.confirm(`Delete “${title}”? This permanently removes its assignments, attempts, and scores.`))event.preventDefault()}}><input type="hidden" name="moduleId" value={id}/><button className="danger-link">Delete</button></form>
 </div>
}
