import Link from "next/link";
import { GraduationCap, LogOut, Menu } from "lucide-react";
import { logout } from "@/features/auth/actions";

type MobileNavItem = { href: string; label: string; icon?: React.ComponentType<{ size?: number }>; active?: boolean };

export function MobileAppNav({items,showLogout=true}:{items:MobileNavItem[];showLogout?:boolean}) {
 return <div className="mobile-app-nav">
  <Link href="/" className="brand"><span className="brand-mark"><GraduationCap/></span>Academy</Link>
  <details><summary aria-label="Open navigation menu"><Menu size={23}/><span>Menu</span></summary><div className="mobile-nav-menu">
   <nav aria-label="Mobile navigation">{items.map(({href,label,icon:Icon,active})=><Link key={href} href={href} className={active?"active":""} aria-current={active?"page":undefined}>{Icon&&<Icon size={19}/>} {label}</Link>)}</nav>
   {showLogout&&<form action={logout}><button className="logout" type="submit"><LogOut size={18}/>Sign out</button></form>}
  </div></details>
 </div>;
}
