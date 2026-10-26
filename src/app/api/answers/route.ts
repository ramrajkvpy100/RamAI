import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { voteAndCount } from "@/server/answer-stats";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Vote = z.object({
  key: z.string().min(3).max(200),
  choice: z.string().min(1).max(300),
  correct: z.boolean(),
  options: z.array(z.string().min(1).max(300)).min(2).max(8),
});

/** POST /api/answers — one answer to a Skills Lab or exam question; returns how every doctor answered it. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 120);
  if (blocked) return blocked;
  const body = await parseBody(req, Vote);
  if (body instanceof Response) return body;
  try {
    const user = await getCurrentUser();
    if (!user) return apiError(401, "UNAUTHENTICATED", "Please log in.");
    if (!body.options.includes(body.choice)) return apiError(400, "BAD_REQUEST", "Unknown option.");
    return ok(await voteAndCount(user.id, body.key, body.choice, body.correct, body.options));
  } catch (err) {
    return handleError(err);
  }
}
