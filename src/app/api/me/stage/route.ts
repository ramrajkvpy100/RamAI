import { z } from "zod";

import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";

const STAGES = ["student", "intern", "resident", "specialist", "radiologist"] as const;
const Schema = z.object({ stage: z.enum(STAGES) });

/** POST /api/me/stage — the doctor's career stage: students get classic cases, residents and specialists harder ones. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, Schema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    await db.run("INSERT INTO user_prefs (user_id, stage, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET stage = excluded.stage, updated_at = excluded.updated_at", user.id, body.stage, Date.now());
    return ok({ stage: body.stage });
  } catch (err) {
    return handleError(err);
  }
}
