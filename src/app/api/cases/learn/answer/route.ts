import { z } from "zod";

import { caseClosed, sessionInfo } from "@/engine/engine";
import type { LearnPack } from "@/engine/types";
import { requireUser } from "@/server/auth";
import { getCaseAI } from "@/server/case-ai";
import { db } from "@/server/db";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AnswerRequest = z.object({ token: z.string().min(20).max(400_000), q: z.number().int().min(0).max(9), choice: z.number().int().min(0).max(5) });

/** POST /api/cases/learn/answer — marks a practice answer against the kept key (the first answer to each question counts). */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 60);
  if (blocked) return blocked;
  const body = await parseBody(req, AnswerRequest);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const info = sessionInfo(body.token);
    if (info.userId !== user.id || !(await caseClosed(body.token, user.id))) return apiError(404, "NOT_FOUND", "Not found.");
    const kept = await getCaseAI(info.learnKey, "learn");
    const q = kept ? (JSON.parse(kept.data) as LearnPack).mcqs[body.q] : undefined;
    if (!q) return apiError(404, "NOT_FOUND", "That question isn't there.");
    const correct = body.choice === q.answer;
    await db.run("INSERT OR IGNORE INTO mcq_answers (user_id, session_id, q, topic, correct, created_at) VALUES (?, ?, ?, ?, ?, ?)", user.id, info.sessionId, body.q, q.topic.slice(0, 80), correct ? 1 : 0, Date.now());
    return ok({ correct, answer: q.answer });
  } catch (err) {
    return handleError(err);
  }
}
