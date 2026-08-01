import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import {AUTH_SCOPE_HEADER,authCookieName,scopeForPath} from "@/lib/supabase/auth-scope";

export async function proxy(request: NextRequest) {
  const scope=scopeForPath(request.nextUrl.pathname,request.headers.get("referer"));
  request.headers.set(AUTH_SCOPE_HEADER,scope);
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions:{name:authCookieName(scope),path:"/",sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:60*60*24*400},
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies, headers) {
          for (const { name, value } of cookies) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookies) {
            response.cookies.set(name, value, options);
          }
          for (const [name, value] of Object.entries(headers)) {
            response.headers.set(name, value);
          }
        },
      },
    },
  );

  // This is the only automatic session-refresh owner. Do not add a global
  // browser auth client/listener: competing refreshes can rotate the same token
  // from different tabs and let an older response overwrite the latest cookie.
  await supabase.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
