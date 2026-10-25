import { z } from "zod";

import { withUsage } from "@/engine/providers/usage";
import { guideFor, sessionInfo } from "@/engine/engine";
import { requireUser } from "@/server/auth";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const GuideRequest = z.object({ token: z.string().min(20).max(400_000) });

/** POST /api/cases/guide — learning mode: the next step as four choices, each with why or why not. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 60);
  if (blocked) return blocked;
  const body = await parseBody(req, GuideRequest);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const info = sessionInfo(body.token);
    if (info.userId !== user.id) return apiError(404, "NOT_FOUND", "Not found.");
    const guide = await withUsage({ kind: "turn", sessionId: info.sessionId }, () => guideFor(body.token, user.id, user.patientLang));
    return ok({ guide });
  } catch (err) {
    return handleError(err);
  }
}
