"use client";
import { useEffect,useId,useRef } from "react";
export function VideoPlayer({videoId,assignmentId}:{videoId:string;assignmentId:string}){
 const frameId=useId().replaceAll(":",""),started=useRef(false);
 useEffect(()=>{let player:{destroy?:()=>void}|undefined; const begin=()=>{if(started.current)return;started.current=true;fetch(`/api/videos/${assignmentId}/start`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:crypto.randomUUID()})})};
 const win=window as Window&{YT?:{Player:new(id:string,options:{events:{onStateChange:(e:{data:number})=>void}})=>typeof player};onYouTubeIframeAPIReady?:()=>void};
 const init=()=>{if(win.YT)player=new win.YT.Player(frameId,{events:{onStateChange:e=>{if(e.data===1)begin()}}})}; win.onYouTubeIframeAPIReady=init;
 if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')){const s=document.createElement("script");s.src="https://www.youtube.com/iframe_api";document.head.appendChild(s)}else init();
 return()=>player?.destroy?.()},[assignmentId,frameId]);
 return <div className="aspect-video overflow-hidden rounded-xl bg-black"><iframe id={frameId} className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1&enablejsapi=1`} title="Lesson video" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-presentation" allowFullScreen/></div>
}
