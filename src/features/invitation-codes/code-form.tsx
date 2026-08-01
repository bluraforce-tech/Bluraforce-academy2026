"use client";

import {useActionState,useEffect,useRef,useState} from "react";
import {Check,Copy,Download,Printer} from "lucide-react";
import {generateInvitationCode,type CodeState} from "./actions";
import {EducationTargetSelector} from "@/components/education-target-selector";

const initial:CodeState={};

async function makePdf(state:CodeState){
 const {jsPDF}=await import("jspdf"),pdf=new jsPDF({unit:"mm",format:"a4",orientation:"portrait"});
 const codes=state.codes??[],pageWidth=210,pageHeight=297,margin=12,cardWidth=89,cardHeight=43,gapX=8,gapY=5,startY=43;
 for(let page=0;page<Math.ceil(codes.length/10);page++){
  if(page)pdf.addPage();
  pdf.setFillColor(5,55,88);pdf.rect(0,0,pageWidth,31,"F");
  pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(18);pdf.text("ACADEMY ACCESS CODES",margin,14);
  pdf.setFont("helvetica","normal");pdf.setFontSize(9);pdf.text(`${state.teacherName}  |  ${state.targetLabel}`,margin,22);
  pdf.setTextColor(62,83,99);pdf.setFontSize(8);pdf.text("Give one card to each student. Every code can be redeemed once.",margin,37);
  for(let index=0;index<10;index++){
   const code=codes[page*10+index];if(!code)break;
   const col=index%2,row=Math.floor(index/2),x=margin+col*(cardWidth+gapX),y=startY+row*(cardHeight+gapY);
   pdf.setDrawColor(188,211,224);pdf.setLineWidth(.35);pdf.setFillColor(250,253,255);pdf.roundedRect(x,y,cardWidth,cardHeight,3,3,"FD");
   pdf.setFillColor(8,145,204);pdf.roundedRect(x,y,4,cardHeight,2,2,"F");
   pdf.setTextColor(5,55,88);pdf.setFont("helvetica","bold");pdf.setFontSize(8);pdf.text("STUDENT INVITATION",x+9,y+8);
   pdf.setFillColor(state.targetLabel?.startsWith("American")?225:237,state.targetLabel?.startsWith("American")?246:243,state.targetLabel?.startsWith("American")?255:232);pdf.roundedRect(x+51,y+3.5,32,7,2,2,"F");
   pdf.setTextColor(5,93,142);pdf.setFontSize(7);pdf.text(state.targetLabel??"Student",x+67,y+8,{align:"center",maxWidth:29});
   pdf.setTextColor(5,55,88);pdf.setFontSize(19);pdf.setCharSpace(1.2);pdf.text(code,x+44.5,y+21,{align:"center"});pdf.setCharSpace(0);
   pdf.setDrawColor(218,230,237);pdf.line(x+9,y+26,x+80,y+26);
   pdf.setFont("helvetica","normal");pdf.setFontSize(7.5);pdf.setTextColor(75,94,108);pdf.text("Valid for 2 days - 30 days teacher access",x+9,y+32);
   pdf.text(`Code ${page*10+index+1} of ${codes.length}`,x+9,y+38);
   pdf.setFont("helvetica","bold");pdf.text("academy.com",x+80,y+38,{align:"right"});
  }
  pdf.setTextColor(105,121,132);pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.text(`Generated ${new Date().toLocaleDateString()}  |  Page ${page+1} of ${Math.ceil(codes.length/10)}`,pageWidth/2,pageHeight-6,{align:"center"});
 }
 return pdf.output("blob");
}

export function InvitationCodeForm(){
 const [state,action,pending]=useActionState(generateInvitationCode,initial),[copied,setCopied]=useState(false),[pdfUrl,setPdfUrl]=useState(""),preview=useRef<HTMLIFrameElement>(null);
 useEffect(()=>{let active=true,url="";if(!state.codes?.length)return;makePdf(state).then(blob=>{if(!active)return;url=URL.createObjectURL(blob);setPdfUrl(url)});return()=>{active=false;if(url)URL.revokeObjectURL(url)}},[state]);
 async function copy(){if(!state.codes)return;await navigator.clipboard.writeText(state.codes.join("\n"));setCopied(true);setTimeout(()=>setCopied(false),1800)}
 function download(){if(!pdfUrl)return;const link=document.createElement("a");link.href=pdfUrl;link.download=`academy-${state.targetLabel?.toLowerCase().replaceAll(" ","-")}-codes.pdf`;link.click()}
 function print(){preview.current?.contentWindow?.print()}
 return <>
  <form action={action} className="panel teacher-form invitation-batch-form">
   <EducationTargetSelector selectAmericanCategory={false}/>
   <div className="field"><label htmlFor="codeCount">Number of codes</label><input id="codeCount" name="count" type="number" min={1} max={20} defaultValue={20} required/><small>Generate up to 20 secure one-time codes together.</small></div>
   <div className="field"><label>Teacher access duration</label><div className="fixed-duration"><strong>30 days</strong><span>Fixed for every invitation code</span></div><small>Codes expire after two days. Student access lasts exactly 30 days after redemption.</small></div>
   {state.error&&<p className="form-error" role="alert">{state.error}</p>}
   <div className="form-actions"><button className="button" type="submit" disabled={pending}>{pending?"Generating codes...":"Generate codes & PDF"}</button></div>
  </form>
  {state.codes&&<section className="panel invitation-pdf-section"><div className="panel-head"><div><small>Live PDF preview</small><h2>{state.codes.length} invitation codes</h2><p>{state.targetLabel} - ready to print or download</p></div><div className="pdf-actions"><button className="button secondary small" type="button" onClick={copy}>{copied?<Check/>:<Copy/>}{copied?"Copied":"Copy all"}</button><button className="button secondary small" type="button" onClick={download} disabled={!pdfUrl}><Download/>Download PDF</button><button className="button small" type="button" onClick={print} disabled={!pdfUrl}><Printer/>Print PDF</button></div></div>{pdfUrl?<iframe ref={preview} className="invitation-pdf-preview" src={pdfUrl} title="Invitation codes PDF preview"/>:<div className="pdf-loading">Preparing PDF preview...</div>}</section>}
 </>;
}
