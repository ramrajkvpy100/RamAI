import { cookies } from "next/headers";

import { ACCESS_COOKIE, inviteOnly, validAccessCookie } from "@/lib/server/access-cookie";
import { db } from "@/server/db";
import { appUrl } from "@/server/app-url";
import { currentGuest, endGuestSession, identityOf, linkProfile, signupProblem } from "@/server/auth";
import { authFailure } from "@/server/auth-errors";
import { passwordProblem } from "@/server/passwords";
import { overLimit } from "@/server/rate-limit";
import { supabaseServer } from "@/server/supabase";
import { apiError, clientIp, crossSite, handleError, ok, rateLimited } from "@/lib/server/http";
import { SignupSchema } from "@/lib/server/schemas";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";

/**
 * POST /api/auth/signup — creates the Supabase account, and Supabase emails a
 * six-digit code. Nothing opens up until that code is entered (/api/auth/verify).
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const parsed = SignupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "BAD_INPUT", parsed.error.issues[0]?.message ?? "Check the form.");
  const { name, username, email, password, country } = parsed.data;
  const weak = passwordProblem(password, parsed.data);
  if (weak) return apiError(400, "BAD_INPUT", weak);
  // Invite-only: a new account needs an invite code (redeemed on this browser) or an invited email.
  if (inviteOnly() && !(await validAccessCookie((await cookies()).get(ACCESS_COOKIE)?.value)) && !(await db.get("SELECT 1 AS ok FROM access_emails WHERE email = ?", email.trim().toLowerCase()))) {
    return apiError(403, "INVITE", "RamAI is invite-only — enter your invite code first.");
  }
  try {
    if (await overLimit(`signup:${clientIp(req)}`, 10, 3_600_000)) return apiError(429, "RATE_LIMITED", "Too many sign-ups from this network. Please try again in an hour.");
    const problem = await signupProblem(email, username);
    if (problem) return apiError(409, "EXISTS", problem);
    const base = appUrl(req);
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...(base ? { emailRedirectTo: `${base}/verify-email` } : {}),
        // Used once, to build the profile after verification. Never trusted for anything else.
        data: { name, username, country: country ?? null, terms_version: SITE.termsVersion, terms_accepted_at: Date.now() },
      },
    });
    if (error) return authFailure(error);
    // Supabase doesn't say outright that a verified account already has this email: it returns no identities.
    if (data.user && data.user.identities?.length === 0) return apiError(409, "EXISTS", "An account with this email already exists. Log in instead.");
    if (data.session && data.user) {
      console.warn("[ramai] Supabase 'Confirm email' is off — new accounts aren't being verified. Turn it on in Authentication → Sign In / Providers → Email.");
      const guest = await currentGuest();
      const user = await linkProfile(identityOf(data.user), { guestId: guest?.id });
      if (guest) await endGuestSession();
      return ok({ status: "signed-in" as const, user });
    }
    return ok({ status: "verify" as const, email });
  } catch (err) {
    return handleError(err);
  }
}
