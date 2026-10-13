import { z } from "zod";

import { caseClosed, learnFor, sessionInfo } from "@/engine/engine";
import type { LearnPack } from "@/engine/types";
import { requireUser } from "@/server/auth";
import { getCaseAI, putCaseAI } from "@/server/case-ai";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Writing and examining the questions can take most of a minute (an invented case's are usually ready). */
export const maxDuration = 60;

const LearnRequest = z.object({ token: z.string().min(20).max(400_000) });

/**
 * POST /api/cases/learn — the case's clinical pearls and exam-style questions,
 * once it has ended. An invented case's were written while it was played; a
 * written case's are made once per country and kept for everyone.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const body = await parseBody(req, LearnRequest);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const info = sessionInfo(body.token);
    if (info.userId !== user.id) return apiError(404, "NOT_FOUND", "Not found.");
    if (!(await caseClosed(body.token, user.id))) return apiError(409, "NOT_CLOSED", "Finish the case first.");
    const kept = await getCaseAI(info.learnKey, "learn");
    if (kept) return ok({ pack: JSON.parse(kept.data) as LearnPack });
    const pack = await learnFor(body.token, user.id);
    if (pack) await putCaseAI(info.learnKey, "learn", info.generated ? user.id : "system", "application/json", JSON.stringify(pack));
    return ok({ pack: pack ?? null });
  } catch (err) {
    return handleError(err);
  }
}
