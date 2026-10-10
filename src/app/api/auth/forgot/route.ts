import { appUrl, requestPasswordReset } from "@/server/account";
import { overLimit } from "@/server/rate-limit";
import { apiError, clientIp, crossSite, ok, parseBody, rateLimited } from "@/lib/server/http";
import { ForgotSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/** POST /api/auth/forgot — emails a reset link. The answer never reveals whether the account exists. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 5);
  if (blocked) return blocked;
  const body = await parseBody(req, ForgotSchema);
  if (body instanceof Response) return body;
  if (await overLimit(`forgot:${clientIp(req)}`, 5, 3600000)) return apiError(429, "RATE_LIMITED", "Too many reset requests from this network. Please try again in an hour.");
  await requestPasswordReset(body.email, appUrl(req)).catch((err) => console.error("[ramai] reset request failed:", err));
  return ok({ ok: true });
}
