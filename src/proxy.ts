import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isScraper } from "@/lib/server/scrapers";
import { NextResponse, type NextRequest } from "next/server";

import { AUTH_JWKS, authCookieOptions, hasAuthCookie, supabaseConfig } from "@/lib/server/supabase-env";

/** Pages anyone may open: the invite page, signing in, the legal pages and shared result cards. */
// "/" for signed-out visitors is the public landing page (search engines must see it); the app behind it stays invite-only.

/**
 * Keeps a Supabase session alive: its access token lasts an hour, so an
 * expired one is refreshed here — the new cookies go to the page being
 * rendered (Server Components can't write cookies) and back to the browser.
 */
async function refreshSession(request: NextRequest) {
  const config = supabaseConfig();
  if (!config || !hasAuthCookie(request.cookies.getAll().map((c) => c.name))) return null;
  const out = { cookies: [] as { name: string; value: string; options: CookieOptions }[], headers: {} as Record<string, string> };
  const supabase = createServerClient(config.url, config.key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const c of list) {
          request.cookies.set(c.name, c.value);
          out.cookies.push(c);
        }
        Object.assign(out.headers, headers);
      },
    },
  });
  // Verifies the token (and refreshes it when it has expired). Nothing may run in between.
  await supabase.auth.getClaims(undefined, { keys: AUTH_JWKS.keys });
  return out;
}

export async function proxy(request: NextRequest) {

  // Scrapers and AI crawlers get nothing but robots.txt (which tells them so).
  if (isScraper(request.headers.get("user-agent")) && request.nextUrl.pathname !== "/robots.txt") return new NextResponse("Not available.", { status: 403 });

  // One site only: an old deployment's own address (ram-ai-<id>.vercel.app) sends the visitor to the live site.
  const live = process.env.RAMAI_SITE_HOST ?? "ram-ai-liard.vercel.app";
  const host = request.headers.get("host") ?? "";
  if (process.env.VERCEL_ENV === "production" && live && host.endsWith(".vercel.app") && host !== live) {
    const to = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${live}`);
    return NextResponse.redirect(to, 308);
  }

  // First, so the refreshed cookies are in the headers passed on to the page.
  const session = await refreshSession(request).catch((err) => {
    console.error("[ramai] session refresh failed:", err instanceof Error ? err.message : err);
    return null;
  });

  const response = NextResponse.next({ request });
  // Session cookies, and the no-cache headers that must travel with them (a CDN must never share them).
  for (const c of session?.cookies ?? []) response.cookies.set(c.name, c.value, c.options);
  for (const [k, v] of Object.entries(session?.headers ?? {})) response.headers.set(k, v);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API routes return JSON, and static files don't need a policy.
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|manifest.json|sw.js|\\.well-known).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
