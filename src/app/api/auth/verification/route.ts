import { appUrl, sendVerification } from "@/server/account";
import { requireUser } from "@/server/auth";
import { overLimit } from "@/server/rate-limit";
import { apiError, clientIp, crossSite, handleError, ok, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";

/** POST /api/auth/verification — email a fresh verification link to the signed-in player. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 6);
  if (blocked) return blocked;
  try {
  if (await overLimit(`verify:${clientIp(req)}`, 10, 3600000)) return apiError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
    const user = await requireUser();
    const result = await sendVerification(user, appUrl(req));
    if (result.sent) return ok(result);
    if (result.reason === "VERIFIED") return ok({ sent: false, verified: true });
    if (result.reason === "COOLDOWN") return apiError(429, "COOLDOWN", "We just sent one — give it a minute before asking again.");
    return apiError(503, "EMAIL_UNAVAILABLE", "We couldn't send the email right now. Please try again later.");
  } catch (err) {
    return handleError(err);
  }
}
