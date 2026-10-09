import { appUrl, requestPasswordReset } from "@/server/account";
import { crossSite, ok, parseBody, rateLimited } from "@/lib/server/http";
import { ForgotSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/** POST /api/auth/forgot — emails a reset link. The answer never reveals whether the account exists. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 5);
  if (blocked) return blocked;
  const body = await parseBody(req, ForgotSchema);
  if (body instanceof Response) return body;
  await requestPasswordReset(body.email, appUrl(req)).catch((err) => console.error("[ramai] reset request failed:", err));
  return ok({ ok: true });
}
