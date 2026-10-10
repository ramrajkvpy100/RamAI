import { currentGuest, emailForLogin, endGuestSession, identityOf, isLegacyAccount, linkProfile } from "@/server/auth";
import { authFailure } from "@/server/auth-errors";
import { clearLimit, exhausted, overLimit } from "@/server/rate-limit";
import { supabaseServer } from "@/server/supabase";
import { apiError, clientIp, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { LoginSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

const WRONG = "Incorrect email or password.";

/** POST /api/auth/login — email (or username) and password, checked by Supabase. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 12);
  if (blocked) return blocked;
  const body = await parseBody(req, LoginSchema);
  if (body instanceof Response) return body;
  const account = `login:${body.login.trim().toLowerCase()}`;
  try {
    if (await overLimit(`login-ip:${clientIp(req)}`, 30, 900_000)) return apiError(429, "RATE_LIMITED", "Too many sign-in attempts. Please wait 15 minutes and try again.");
    // Ten wrong passwords lock the account for 15 minutes — guessing becomes impractical.
    if (await exhausted(account, 10, 900_000)) return apiError(429, "RATE_LIMITED", "Too many wrong passwords for this account. Please wait 15 minutes, or reset your password.");
    const email = await emailForLogin(body.login);
    if (!email) {
      await overLimit(account, 10, 900_000);
      return apiError(401, "INVALID", WRONG);
    }
    const guest = await currentGuest();
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: body.password });
    if (error) {
      if (error.code === "invalid_credentials") {
        await overLimit(account, 10, 900_000);
        // Signed up before sign-in moved to Supabase: their password didn't come along.
        if (await isLegacyAccount(email)) {
          return apiError(401, "LEGACY_ACCOUNT", "RamAI has a new, more secure sign-in. Sign up once more with this email to set your password — your progress, streak and plan are kept.");
        }
      }
      // Never echo the email back: a username must not reveal it.
      return authFailure(error);
    }
    await clearLimit(account);
    const user = await linkProfile(identityOf(data.user), { guestId: guest?.id });
    if (!user) {
      await supabase.auth.signOut({ scope: "local" });
      return apiError(403, "VERIFY_REQUIRED", "Your email isn't verified yet. Enter the code we emailed you — or send a new one.");
    }
    if (guest) await endGuestSession();
    return ok({ user });
  } catch (err) {
    return handleError(err);
  }
}
