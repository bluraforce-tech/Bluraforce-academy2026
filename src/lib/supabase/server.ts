import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {headers} from "next/headers";
import { env } from "@/lib/env";
import {AUTH_SCOPE_HEADER,AuthScope,authCookieName} from "@/lib/supabase/auth-scope";
export async function createClient(explicitScope?:AuthScope){
  const [jar,requestHeaders]=await Promise.all([cookies(),headers()]);
  const headerScope=requestHeaders.get(AUTH_SCOPE_HEADER),scope=explicitScope??(headerScope==="teacher"||headerScope==="admin"?headerScope:"student");
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{
    cookieOptions:{name:authCookieName(scope),path:"/",sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:60*60*24*400},
    cookies:{getAll:()=>jar.getAll(),setAll(values,_headers){try{values.forEach(({name,value,options})=>jar.set(name,value,options))}catch{}}}
  });
}
