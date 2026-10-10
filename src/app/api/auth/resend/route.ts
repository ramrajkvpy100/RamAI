import { appUrl } from "@/server/app-url";
import { authFailure } from "@/server/auth-errors";
import { overLimit } from "@/server/rate-limit";
import { supabaseServer } from "@/server/supabase";
import { apiError, clientIp, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { ResendSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/** Seconds between codes — Supabase's own minimum. */
const RESEND_COOLDOWN = 60;

/** POST /api/auth/resend — a fresh sign-up code. The answer never reveals whether the account exists. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 6);
  if (blocked) return blocked;
  const body = await parseBody(req, ResendSchema);
  if (body instanceof Response) return body;
  try {
    if (await overLimit(`resend:${clientIp(req)}`, 10, 3_600_000)) return apiError(429, "RATE_LIMITED", "Too many codes requested from this network. Please try again in an hour.");
    const base = appUrl(req);
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.resend({ type: "signup", email: body.email, ...(base ? { options: { emailRedirectTo: `${base}/verify-email` } } : {}) });
    if (error) return authFailure(error);
    return ok({ ok: true, cooldown: RESEND_COOLDOWN });
  } catch (err) {
    return handleError(err);
  }
}
