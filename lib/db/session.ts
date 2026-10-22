import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv, HOME_PATH, PUBLIC_PATHS, SIGN_IN_PATH } from "@/lib/config";
import type { Database } from "@/types/database";

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Runs in proxy.ts: refreshes the Supabase session cookie and redirects
 * signed-out requests to sign-in. Pages still check the user themselves.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const env = getEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Must run before any other logic: validates and refreshes the token.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims.sub);

  const { pathname } = request.nextUrl;
  const target = !signedIn && !isPublicPath(pathname)
    ? SIGN_IN_PATH
    : signedIn && pathname === SIGN_IN_PATH
      ? HOME_PATH
      : null;

  if (target) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Keep any refreshed/cleared auth cookies on the redirect.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}
