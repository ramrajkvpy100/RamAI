import { z } from "zod";

import { withUsage } from "@/engine/providers/usage";
import { pictureFor, sessionInfo } from "@/engine/engine";
import { libraryPicture } from "@/server/ai-images";
import { requireUser } from "@/server/auth";
import { getCaseAI, picturesDrawn, putCaseAI } from "@/server/case-ai";
import { apiError, crossSite, handleError, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Drawing a picture takes a while. */
export const maxDuration = 60;

/** p1…: an invented case's own pictures · i-inv-N: a scan, drawn from its result · e-<exam>: a written case's skin photograph · o-N: its opening photograph. */
const ImageSchema = z.object({ token: z.string().min(20).max(400_000), ref: z.string().regex(/^(p\d{1,2}|i-inv-\d{1,3}|e-[a-z0-9-]{1,40}|o-\d{1,2}|portrait)$/) });
/** No case needs more than this many pictures; a ceiling on spending. */
const MAX_PICTURES = 8;

/**
 * POST /api/cases/image — a case's picture, made the first time the case
 * reaches it, then kept with the case. Says whether it was drawn by AI or is a
 * real image, and whom to credit.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, ImageSchema);
  if (body instanceof Response) return body;
  // Without the image model (a local copy with no key), the page keeps its drawn stand-in.
  if (!process.env.OPENAI_API_KEY) return apiError(503, "PICTURES_OFF", "Pictures aren't switched on here.");
  try {
    const user = await requireUser();
    const info = sessionInfo(body.token);
    const key = `img:${body.ref}`;
    const mine = info.userId === user.id;
    let [stored, credit] = mine ? await Promise.all([getCaseAI(info.sessionId, key), getCaseAI(info.sessionId, `credit:${body.ref}`)]) : [undefined, undefined];
    if (!stored) {
      // Owner and progress checked here: a picture exists only once the case has reached it.
      const picture = await pictureFor(body.token, user.id, body.ref);
      if (!picture) return apiError(404, "NOT_FOUND", "There's no picture there yet.");
      if ((await picturesDrawn(info.sessionId)) >= MAX_PICTURES) return apiError(429, "LIMIT", "This case has all the pictures it can have.");
      const made = await withUsage({ kind: "picture", sessionId: info.sessionId }, () => libraryPicture(picture));
      stored = { mime: made.mime, data: made.base64 };
      credit = made.credit ? { mime: "application/json", data: JSON.stringify(made.credit) } : undefined;
      await Promise.all([putCaseAI(info.sessionId, key, user.id, stored.mime, stored.data), credit && putCaseAI(info.sessionId, `credit:${body.ref}`, user.id, credit.mime, credit.data)]);
    }
    return new Response(new Uint8Array(Buffer.from(stored.data, "base64")), {
      headers: {
        "Content-Type": stored.mime,
        "Cache-Control": "private, max-age=86400",
        "X-Picture-Source": credit ? "commons" : "ai",
        ...(credit ? { "X-Picture-Credit": encodeURIComponent(credit.data) } : {}),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
