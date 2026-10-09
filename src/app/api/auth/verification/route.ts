import { appUrl, sendVerification } from "@/server/account";
import { requireUser } from "@/server/auth";
import { apiError, crossSite, handleError, ok, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";

/** POST /api/auth/verification — email a fresh verification link to the signed-in player. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 6);
  if (blocked) return blocked;
  try {
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
