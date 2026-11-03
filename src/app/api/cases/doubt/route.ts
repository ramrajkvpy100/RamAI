import { z } from "zod";

import { doubtFor, sessionInfo } from "@/engine/engine";
import { withUsage } from "@/engine/providers/usage";
import { requireUser } from "@/server/auth";
import { overLimit } from "@/server/rate-limit";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Doubt = z.object({ token: z.string().min(20).max(400_000), question: z.string().trim().min(3).max(600) });
const DOUBTS_A_DAY = 15;

/** POST /api/cases/doubt — ask a senior about the case just played. Each answer is a paid model call, so accounts only, and capped. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 15);
  if (blocked) return blocked;
  const body = await parseBody(req, Doubt);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    if (user.isGuest) return apiError(403, "SIGNUP_REQUIRED", "Sign in free to ask a senior about this case.");
    const info = sessionInfo(body.token);
    if (info.userId !== user.id) return apiError(404, "NOT_FOUND", "Not found.");
    if (user.plan !== "pro" && (await overLimit(`doubt:${user.id}`, DOUBTS_A_DAY, 86_400_000))) return apiError(429, "RATE_LIMITED", `That's today's ${DOUBTS_A_DAY} doubts. Come back tomorrow, or go Pro for more.`);
    const answer = await withUsage({ kind: "coach", sessionId: info.sessionId }, () => doubtFor(body.token, user.id, body.question));
    return answer ? ok({ answer }) : apiError(503, "UNAVAILABLE", "The senior can't answer just now. Please try again in a moment.");
  } catch (err) {
    return handleError(err);
  }
}
