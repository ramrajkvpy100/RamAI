import { z } from "zod";

import { requireUser } from "@/server/auth";
import { answerRequest, pendingRequests } from "@/server/nearby";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/duels/requests — challenges from doctors near you, waiting for an answer. */
export async function GET() {
  try {
    const user = await requireUser();
    return ok({ requests: user.isGuest ? [] : await pendingRequests(user.id) });
  } catch (err) {
    return handleError(err);
  }
}

const Answer = z.object({ id: z.string().uuid(), accept: z.boolean() });

/** POST /api/duels/requests — play it (the duel's link comes back) or not now. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const body = await parseBody(req, Answer);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const duel = await answerRequest(user.id, body.id, body.accept);
    if (!duel) return apiError(404, "NOT_FOUND", "That challenge isn't there any more.");
    return ok({ duel });
  } catch (err) {
    return handleError(err);
  }
}
