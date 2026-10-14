import { after } from "next/server";
import { z } from "zod";

import { userOrGuest } from "@/server/auth";
import { ExamError, nextSet, writeSet } from "@/server/exam-practice";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { EXAM_IDS, EXAMS, MIXED, type ExamId } from "@/lib/exams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Writing and examining a set takes most of a minute (a kept set is instant). */
export const maxDuration = 60;

const SetRequest = z.object({ exam: z.enum(EXAM_IDS as [ExamId, ...ExamId[]]), subject: z.string().trim().min(2).max(80) });

/** POST /api/exams/set — a set of questions the doctor hasn't answered, for an exam and subject. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 12);
  if (blocked) return blocked;
  const body = await parseBody(req, SetRequest);
  if (body instanceof Response) return body;
  const exam = EXAMS[body.exam];
  if (body.subject !== MIXED && !exam.subjects.includes(body.subject)) return apiError(400, "BAD_REQUEST", "Pick one of the exam's subjects.");
  try {
    const user = await userOrGuest(exam.country);
    const { set, another } = await nextSet(user, body.exam, body.subject);
    // The next set is written while they answer this one, so "Next set" is instant.
    if (!another) after(() => writeSet(body.exam, body.subject).then(() => undefined).catch(() => undefined));
    return ok({ set });
  } catch (err) {
    if (err instanceof ExamError) return apiError(err.code === "NOT_FOUND" ? 404 : 503, err.code === "UNAVAILABLE" ? "EXAMS_UNAVAILABLE" : err.code, err.message);
    return handleError(err);
  }
}
