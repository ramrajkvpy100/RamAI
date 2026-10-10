import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { authCookieOptions, hasAuthCookie, supabaseConfig } from "@/lib/server/supabase-env";

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
  await supabase.auth.getClaims();
  return out;
}

/**
 * Content-Security-Policy with a fresh nonce for every page: only RamAI's own
 * scripts — and the scripts they load, such as Razorpay's checkout — can run,
 * so injected markup can't execute code. Next.js reads the nonce from the
 * request header and stamps it on its own scripts.
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV === "development";
  const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://checkout.razorpay.com${dev ? " 'unsafe-eval'" : ""}`,
    // React sets inline style attributes (gradients, animation timing); scripts stay locked down.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://cdn.razorpay.com",
    "font-src 'self' data:",
    `connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com${dev ? " ws: wss:" : ""}`,
    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  // First, so the refreshed cookies are in the headers passed on to the page.
  const session = await refreshSession(request).catch((err) => {
    console.error("[ramai] session refresh failed:", err instanceof Error ? err.message : err);
    return null;
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  // Session cookies, and the no-cache headers that must travel with them (a CDN must never share them).
  for (const c of session?.cookies ?? []) response.cookies.set(c.name, c.value, c.options);
  for (const [k, v] of Object.entries(session?.headers ?? {})) response.headers.set(k, v);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API routes return JSON, and static files don't need a policy.
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|\\.well-known).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
