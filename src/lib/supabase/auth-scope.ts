export type AuthScope="student"|"teacher"|"admin";
export const AUTH_SCOPE_HEADER="x-bluraforce-auth-scope";
export function authCookieName(scope:AuthScope){return `bluraforce-${scope}-auth`}

export function scopeForPath(pathname:string,referer?:string|null):AuthScope{
 if(pathname.startsWith("/teacher")||pathname.startsWith("/auth/teacher"))return "teacher";
 if(pathname.startsWith("/admin")||pathname.startsWith("/auth/admin"))return "admin";
 if(pathname.startsWith("/student")||pathname.startsWith("/auth/student")||pathname.startsWith("/api/"))return "student";
 if(referer){try{return scopeForPath(new URL(referer).pathname)}catch{}}
 return "student";
}
