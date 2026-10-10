import { currentGuest, endGuestSession, identityOf, linkProfile } from "@/server/auth";
import { authFailure } from "@/server/auth-errors";
import { clearLimit, overLimit } from "@/server/rate-limit";
import { supabaseServer } from "@/server/supabase";
import { apiError, clientIp, crossSite, handleError, ok, rateLimited } from "@/lib/server/http";
import { ConfirmLinkSchema, VerifyCodeSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/**
 * POST /api/auth/verify — the six-digit code from the sign-up email (Supabase
 * verifyOtp, type "email"). Also accepts the code a confirmation link carries,
 * for Supabase's default email template. On success the player is signed in.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const json = await req.json().catch(() => null);
  const otp = VerifyCodeSchema.safeParse(json);
  const link = otp.success ? null : ConfirmLinkSchema.safeParse(json);
  if (!otp.success && !link?.success) return apiError(400, "BAD_INPUT", otp.error?.issues.find((i) => i.path[0] === "code")?.message ?? "Enter the 6-digit code from the email.");
  try {
    if (await overLimit(`verify-ip:${clientIp(req)}`, 40, 900_000)) return apiError(429, "RATE_LIMITED", "Too many attempts from this network. Please wait 15 minutes.");
    // Six digits can't be guessed in ten tries.
    if (otp.success && (await overLimit(`verify:${otp.data.email}`, 10, 900_000))) return apiError(429, "RATE_LIMITED", "Too many wrong codes. Wait 15 minutes, or send yourself a new code.");
    const guest = await currentGuest();
    const supabase = await supabaseServer();
    const { data, error } = otp.success
      ? await supabase.auth.verifyOtp({ email: otp.data.email, token: otp.data.code, type: "email" })
      : await supabase.auth.exchangeCodeForSession(link!.data!.code);
    if (error) return authFailure(error);
    const user = data.user ? await linkProfile(identityOf(data.user), { guestId: guest?.id }) : null;
    if (!user) return apiError(400, "CODE_INVALID", "That code is wrong or has expired.");
    if (guest) await endGuestSession();
    if (otp.success) await clearLimit(`verify:${otp.data.email}`);
    return ok({ user });
  } catch (err) {
    return handleError(err);
  }
}
