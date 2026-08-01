"use client";

import {useEffect} from "react";
import {useRouter} from "next/navigation";

// Browser back/forward may restore an old React tree from the bfcache. Refresh
// server components so they read the current shared cookie, but never create a
// second Supabase client or rotate tokens in the browser.
export function SessionHistoryGuard(){
 const router=useRouter();
 useEffect(()=>{
  const restore=(event:PageTransitionEvent)=>{if(event.persisted)router.refresh()};
  window.addEventListener("pageshow",restore);
  return ()=>window.removeEventListener("pageshow",restore);
 },[router]);
 return null;
}
