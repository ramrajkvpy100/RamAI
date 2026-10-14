import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { recordRound } from "@/server/practice";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { MODALITY_IDS, type Modality } from "@/lib/practice";

export const runtime = "nodejs";

const ResultRequest = z
  .object({ modality: z.enum(MODALITY_IDS as [Modality, ...Modality[]]), mode: z.enum(["spot", "rapid"]), correct: z.number().int().min(0).max(200), total: z.number().int().min(1).max(200) })
  .refine((r) => r.correct <= r.total);

/** POST /api/practice/result — a finished round, kept for the doctor's own record (not XP or rank). */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, ResultRequest);
  if (body instanceof Response) return body;
  try {
    const user = await getCurrentUser();
    if (user) await recordRound(user.id, body);
    return ok({ recorded: !!user });
  } catch (err) {
    return handleError(err);
  }
}
