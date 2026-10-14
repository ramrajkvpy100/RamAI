import { after } from "next/server";
import { z } from "zod";

import { addPicture, missingPictures, picturesAvailable, round } from "@/server/practice";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { MODALITY_IDS, type Modality } from "@/lib/practice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** The very first round of a modality may wait for its first pictures. */
export const maxDuration = 60;

const RoundRequest = z.object({ modality: z.enum(MODALITY_IDS as [Modality, ...Modality[]]), mode: z.enum(["spot", "rapid"]) });

/** POST /api/practice/round — a round of pictures to name. Open to everyone; scores are recorded only with a session. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, RoundRequest);
  if (body instanceof Response) return body;
  try {
    let r = await round(body.modality, body.mode);
    // Nothing kept yet for this modality: find the first few now (the progress bar covers it).
    if (r.ready < 4 && picturesAvailable()) {
      await Promise.all((await missingPictures(body.modality, 4)).map((id) => addPicture(body.modality, id).catch(() => false)));
      r = await round(body.modality, body.mode);
    }
    // More pictures, found in the background, for the next round.
    if (picturesAvailable()) {
      after(async () => {
        const next = await missingPictures(body.modality, 3);
        await Promise.all(next.map((id) => addPicture(body.modality, id).catch(() => false)));
      });
    }
    return ok(r);
  } catch (err) {
    return handleError(err);
  }
}
