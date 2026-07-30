"use client";
import { useRef } from "react";

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
export function MaterialBookViewer({url,title,studentName}:{url:string;title:string;studentName:string}){
 const container=useRef<HTMLDivElement>(null),source=embeddableUrl(url);
 async function fullscreen(){if(document.fullscreenElement)await document.exitFullscreen();else await container.current?.requestFullscreen()}
 return <div className="material-reader" ref={container}><iframe src={source} title={title} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" allow="fullscreen"/><div className="material-watermarks" aria-hidden="true"><span>{studentName}</span><span>{studentName}</span><span>{studentName}</span></div><button type="button" className="video-fullscreen-button" onClick={fullscreen} aria-label="Toggle fullscreen">⛶</button></div>;
}
