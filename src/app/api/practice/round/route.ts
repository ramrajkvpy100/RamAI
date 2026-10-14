import { after } from "next/server";
import { z } from "zod";

import { withUsage } from "@/engine/providers/usage";
import { aiAnswering } from "@/server/ai-health";
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
    let r: Awaited<ReturnType<typeof round>> & { offline?: boolean } = await round(body.modality, body.mode);
    // Nothing kept yet for this modality: find the first few now (the progress bar covers it).
    if (r.ready < 4 && picturesAvailable()) {
      const first = withUsage({ kind: "practice" }, async () => Promise.all((await missingPictures(body.modality, 4)).map((id) => addPicture(body.modality, id).catch(() => false)))).catch((err) => {
        console.error("[ramai] practice pictures:", err instanceof Error ? err.message : err);
        return [] as boolean[];
      });
      // Whatever is ready by 35 s (well inside the minute the function has); the rest carries on in the background.
      const found = await Promise.race([first, new Promise<null>((resolve) => setTimeout(() => resolve(null), 35_000))]);
      r = await round(body.modality, body.mode);
      // Every search came back with nothing: the picture checker (the AI) isn't answering.
      if (r.items.length === 0 && found !== null && !found.some(Boolean)) r = { ...r, offline: !(await aiAnswering()) };
    }
    // More pictures, found in the background, for the next round.
    if (picturesAvailable()) {
      after(() =>
        withUsage({ kind: "practice" }, async () => {
          const next = await missingPictures(body.modality, 3);
          await Promise.all(next.map((id) => addPicture(body.modality, id).catch(() => false)));
        }),
      );
    }
    return ok(r);
  } catch (err) {
    return handleError(err);
  }
}
