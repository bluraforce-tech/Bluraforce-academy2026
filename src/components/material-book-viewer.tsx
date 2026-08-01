"use client";
import {useRef,useState} from "react";
import {Maximize,Printer} from "lucide-react";

function embeddableUrl(input:string){
  try{
    const url=new URL(input);
    if(url.hostname==="drive.google.com"){
      const file=url.pathname.match(/^\/file\/d\/([^/]+)/);
      if(file)return `https://drive.google.com/file/d/${file[1]}/preview`;
      const doc=url.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([^/]+)/);
      if(doc)return `https://docs.google.com/${doc[1]}/d/${doc[2]}/preview`;
    }
    return input;
  }catch{return input}
}

export function MaterialBookViewer({assignmentId,url,title,studentName}:{assignmentId:string;url:string;title:string;studentName:string}){
  const container=useRef<HTMLDivElement>(null),source=embeddableUrl(url),[printing,setPrinting]=useState(false),[printError,setPrintError]=useState("");
  async function fullscreen(){if(document.fullscreenElement)await document.exitFullscreen();else await container.current?.requestFullscreen()}
  async function printBook(){setPrinting(true);setPrintError("");try{const response=await fetch(`/api/materials/${assignmentId}`,{cache:"no-store"});if(!response.ok){const body=await response.json().catch(()=>null) as {message?:string}|null;throw new Error(body?.message??"The printable book could not be loaded.")}const blobUrl=URL.createObjectURL(await response.blob()),printFrame=document.createElement("iframe");printFrame.className="material-print-frame";printFrame.title=`Print ${title}`;printFrame.src=blobUrl;document.body.appendChild(printFrame);printFrame.onload=()=>{setPrinting(false);setTimeout(()=>{try{printFrame.contentWindow?.focus();printFrame.contentWindow?.print()}catch{setPrintError("Your browser blocked the print dialog.")}},350)};setTimeout(()=>{URL.revokeObjectURL(blobUrl);printFrame.remove()},60000)}catch(error){setPrinting(false);setPrintError(error instanceof Error?error.message:"The printable book could not be loaded.")}}
  return <><div className="material-reader-toolbar"><div><p>Read online or print a personal copy.</p>{printError&&<small className="material-print-error" role="alert">{printError}</small>}</div><div><button type="button" className="button secondary small" onClick={printBook} disabled={printing}><Printer size={17}/>{printing?"Preparing…":"Print book"}</button><button type="button" className="button secondary small" onClick={fullscreen}><Maximize size={17}/>Full screen</button></div></div><div className="material-reader" ref={container}><iframe src={source} title={title} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals" allow="fullscreen"/><div className="material-watermarks" aria-hidden="true"><span>{studentName}</span><span>{studentName}</span><span>{studentName}</span></div></div></>;
}
