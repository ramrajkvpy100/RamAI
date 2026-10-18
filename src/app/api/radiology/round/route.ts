import { z } from "zod";

import { round } from "@/server/practice";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { RADIOLOGY_BRIEFS, RADIOLOGY_MODALITIES } from "@/lib/radiology";
import type { Modality } from "@/lib/practice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Request = z.object({ modality: z.enum(RADIOLOGY_MODALITIES as [Modality, ...Modality[]]) });

/**
 * POST /api/radiology/round — reporting cases: a request form (history, question) and a real study
 * from the practice bank (freely licensed, never AI-made). Only studies already kept; no AI is called.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, Request);
  if (body instanceof Response) return body;
  try {
    const r = await round(body.modality, "spot");
    const items = r.items.filter((i) => i.image && RADIOLOGY_BRIEFS[i.item]).map((i) => ({ ...i, brief: RADIOLOGY_BRIEFS[i.item]! }));
    return ok({ items });
  } catch (err) {
    return handleError(err);
  }
}
