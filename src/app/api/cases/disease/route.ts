import { z } from "zod";

import { diseaseTopic, sessionInfo } from "@/engine/engine";
import { requireUser } from "@/server/auth";
import { explainDisease } from "@/server/disease";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DiseaseRequest = z.object({ token: z.string().min(20).max(400_000) });

/** POST /api/cases/disease — the case's condition explained, once the case has ended. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, DiseaseRequest);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    if (sessionInfo(body.token).userId !== user.id) return apiError(404, "NOT_FOUND", "Not found.");
    const topic = await diseaseTopic(body.token, user.id);
    if (!topic) return apiError(409, "NOT_CLOSED", "Finish the case first.");
    return ok({ disease: await explainDisease(topic) });
  } catch (err) {
    return handleError(err);
  }
}
