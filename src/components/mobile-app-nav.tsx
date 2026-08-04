"use client";

import Link from "next/link";
import { GraduationCap, LogOut, Menu, X } from "lucide-react";
import { logout } from "@/features/auth/actions";
import { useState } from "react";

type MobileNavItem = { href: string; label: string; active?: boolean };

export function MobileAppNav({items,showLogout=true}:{items:MobileNavItem[];showLogout?:boolean}) {
 const [open,setOpen]=useState(false);
 return <div className="mobile-app-nav">
  <Link href="/" className="brand"><span className="brand-mark"><GraduationCap/></span>Academy</Link>
  <button className="mobile-menu-toggle" type="button" aria-label={open?"Close navigation menu":"Open navigation menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={()=>setOpen(value=>!value)}>{open?<X size={23}/>:<Menu size={23}/>}<span>Menu</span></button>
  {open&&<><button className="mobile-nav-backdrop" type="button" aria-label="Close navigation menu" onClick={()=>setOpen(false)}/><div className="mobile-nav-menu" id="mobile-navigation">
   <nav aria-label="Mobile navigation">{items.map(({href,label,active})=><Link key={href} href={href} onClick={()=>setOpen(false)} className={active?"active":""} aria-current={active?"page":undefined}>{label}</Link>)}</nav>
   {showLogout&&<form action={logout}><button className="logout" type="submit"><LogOut size={18}/>Sign out</button></form>}
  </div></>}
 </div>;
}
