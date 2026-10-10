import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { identityOf, linkProfile } from "@/server/auth";
import { authFailure, LINK_EXPIRED } from "@/server/auth-errors";
import { passwordProblem } from "@/server/passwords";
import { overLimit } from "@/server/rate-limit";
import { supabaseServer } from "@/server/supabase";
import { apiError, clientIp, crossSite, handleError, ok, rateLimited } from "@/lib/server/http";
import { ResetSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

const expired = () => apiError(400, "LINK_EXPIRED", LINK_EXPIRED);
const LINK_CODES = new Set(["otp_expired", "flow_state_not_found", "flow_state_expired", "bad_code_verifier", "pkce_code_verifier_not_found", "validation_failed"]);

/**
 * A link is spent the moment it's proven. If Supabase then turns the new
 * password down, this cookie lets the same link — and only that link — be
 * used again for a few minutes, in the recovery session it already opened.
 */
const RETRY_COOKIE = "ramai_reset";
const proofHash = (proof: string) => createHash("sha256").update(proof).digest("base64url");

/** A recovery session made in the last 15 minutes. */
async function recentRecovery(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.auth.getClaims();
  const amr = (data?.claims?.amr ?? []) as { method?: string; timestamp?: number }[];
  return amr.some((a) => (a.method === "recovery" || a.method === "otp") && typeof a.timestamp === "number" && Date.now() / 1000 - a.timestamp < 900);
}

/**
 * POST /api/auth/reset — proves the emailed link (Supabase verifyOtp with the
 * token hash, or the PKCE code from its default link), then sets the new
 * password with updateUser in that recovery session.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const parsed = ResetSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "BAD_INPUT", parsed.error.issues[0]?.message ?? "Check the form.");
  const { password, tokenHash, code } = parsed.data;
  const weak = passwordProblem(password);
  if (weak) return apiError(400, "BAD_INPUT", weak);
  try {
    if (await overLimit(`reset:${clientIp(req)}`, 10, 3_600_000)) return apiError(429, "RATE_LIMITED", "Too many attempts. Please try again in an hour.");
    const supabase = await supabaseServer();
    if (!tokenHash && !code) return expired();
    const proof = proofHash(tokenHash ?? code!);
    const jar = await cookies();
    const { error } = tokenHash ? await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash }) : await supabase.auth.exchangeCodeForSession(code!);
    if (error) {
      if (!LINK_CODES.has(error.code ?? "")) return authFailure(error);
      const retry = jar.get(RETRY_COOKIE)?.value === proof && (await recentRecovery(supabase));
      if (!retry) return expired();
    }
    const { data, error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      jar.set(RETRY_COOKIE, proof, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/auth/reset", maxAge: 900 });
      return authFailure(updateError);
    }
    jar.set(RETRY_COOKIE, "", { path: "/api/auth/reset", maxAge: 0 });
    // Whoever knew the old password is signed out everywhere else.
    await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);
    const user = data.user ? await linkProfile(identityOf(data.user)) : null;
    return ok({ user });
  } catch (err) {
    return handleError(err);
  }
}
