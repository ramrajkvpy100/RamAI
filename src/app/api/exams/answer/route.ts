import { z } from "zod";

import { requireUser } from "@/server/auth";
import { answer, ExamError } from "@/server/exam-practice";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";

const AnswerRequest = z.object({ setId: z.string().uuid(), q: z.number().int().min(0).max(20), choice: z.number().int().min(0).max(5) });

/** POST /api/exams/answer — checks an answer (the first one counts) and returns the key and explanation. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 60);
  if (blocked) return blocked;
  const body = await parseBody(req, AnswerRequest);
  if (body instanceof Response) return body;
  try {
    return ok(await answer(await requireUser(), body.setId, body.q, body.choice));
  } catch (err) {
    if (err instanceof ExamError) return apiError(err.code === "NOT_FOUND" ? 404 : 400, err.code, err.message);
    return handleError(err);
  }
}
