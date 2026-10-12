import { NextResponse } from "next/server";

import { appUrl } from "@/server/app-url";
import { authProviders, supabaseServer } from "@/server/supabase";
import { rateLimited } from "@/lib/server/http";
import { safeNext } from "@/lib/safe-next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google?next=/… — "Continue with Google": off to Google's consent
 * screen (Supabase OAuth, PKCE), back to /auth/callback. No email to wait for.
 */
export async function GET(req: Request) {
  const blocked = rateLimited(req, 20);
  if (blocked) return blocked;
  const url = new URL(req.url);
  const base = appUrl(req) ?? url.origin;
  const next = safeNext(url.searchParams.get("next") ?? undefined);
  const back = (error: string) => NextResponse.redirect(`${base}/login?error=${error}${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`, 303);
  if (!(await authProviders()).google) return back("google-off");
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}`, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
    });
    if (error || !data.url) {
      console.error("[ramai] Google sign-in couldn't start:", error?.message);
      return back("google");
    }
    return NextResponse.redirect(data.url, 303);
  } catch (err) {
    console.error("[ramai] Google sign-in couldn't start:", err instanceof Error ? err.message : err);
    return back("google");
  }
}
