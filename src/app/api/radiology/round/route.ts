import { after } from "next/server";
import { z } from "zod";

import { withUsage } from "@/engine/providers/usage";

import { addPicture, missingPictures, picturesAvailable, round } from "@/server/practice";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { RADIOLOGY_BRIEFS, RADIOLOGY_MODALITIES } from "@/lib/radiology";
import type { Modality } from "@/lib/practice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Room for the background search for more studies. */
export const maxDuration = 60;

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
    // The bank fills in the background: a few more real studies (from Wikimedia Commons, checked) for next time.
    if (picturesAvailable() && items.length < 12) {
      after(() =>
        withUsage({ kind: "practice" }, async () => {
          const ids = (await missingPictures(body.modality, 4)).filter((x) => RADIOLOGY_BRIEFS[x]);
          await Promise.all(ids.map((id) => addPicture(body.modality, id).catch(() => false)));
        }).catch(() => undefined),
      );
    }
    return ok({ items, filling: items.length < 12 });
  } catch (err) {
    return handleError(err);
  }
}
