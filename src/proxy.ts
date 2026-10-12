import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Keeps the panel session fresh: refreshes the Supabase auth cookies on every
// panel request and sends signed-out visitors to the login page. Pages still
// check the session themselves; this is only the first line.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();

  const path = request.nextUrl.pathname;
  if (!data?.claims && path.startsWith("/panel") && !path.startsWith("/panel/entrar")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/panel/entrar";
    loginUrl.search = "";
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/panel/:path*", "/auth/:path*"],
};
