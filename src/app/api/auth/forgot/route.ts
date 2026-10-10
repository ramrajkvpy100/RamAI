import { appUrl } from "@/server/app-url";
import { authFailure } from "@/server/auth-errors";
import { overLimit } from "@/server/rate-limit";
import { supabaseServer } from "@/server/supabase";
import { apiError, clientIp, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { ForgotSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/** POST /api/auth/forgot — Supabase emails a reset link. The answer never reveals whether the account exists. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 5);
  if (blocked) return blocked;
  const body = await parseBody(req, ForgotSchema);
  if (body instanceof Response) return body;
  try {
    if (await overLimit(`forgot:${clientIp(req)}`, 5, 3_600_000)) return apiError(429, "RATE_LIMITED", "Too many reset requests from this network. Please try again in an hour.");
    const base = appUrl(req);
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.resetPasswordForEmail(body.email, base ? { redirectTo: `${base}/reset-password` } : undefined);
    if (error) {
      if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") return authFailure(error);
      console.error("[ramai] password reset email failed:", error.code ?? error.name, error.message);
    }
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
