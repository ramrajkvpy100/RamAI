import { z } from "zod";

import { mergeRecords, PLANT_IDS, STAGE_IDS, type GroveRecord } from "@/lib/grove";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RECORDS = 5000;

const Body = z.object({
  records: z
    .array(
      z.object({
        id: z.string().regex(/^\d{1,16}$/),
        plant: z.enum(PLANT_IDS),
        status: z.enum(["planted", "withered"]),
        stage: z.enum(STAGE_IDS),
        minutes: z.number().int().min(0).max(120),
        planned: z.number().int().min(0).max(120),
        at: z.number().int().positive(),
      }),
    )
    .max(MAX_RECORDS),
});

/**
 * POST /api/focus/grove: adds this phone's garden to the account's and returns the whole of it. Kept as one document
 * in planner_docs, so it needs no table of its own. Nothing here touches the clinical rating.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const body = await parseBody(req, Body);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const row = await db.get<{ data: string }>("SELECT data FROM planner_docs WHERE user_id = ? AND doc = 'grove'", user.id);
    let saved: GroveRecord[] = [];
    try {
      saved = row ? (JSON.parse(row.data) as GroveRecord[]) : [];
    } catch {}
    const merged = mergeRecords(saved, body.records).slice(-MAX_RECORDS);
    if (merged.length !== saved.length) {
      await db.run("INSERT INTO planner_docs (user_id, doc, data, updated_at) VALUES (?, 'grove', ?, ?) ON CONFLICT(user_id, doc) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at", user.id, JSON.stringify(merged), Date.now());
    }
    return ok({ records: merged });
  } catch (err) {
    return handleError(err);
  }
}
