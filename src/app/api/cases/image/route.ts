import { z } from "zod";

import { pictureFor, sessionInfo } from "@/engine/engine";
import { drawPicture } from "@/server/ai-images";
import { requireUser } from "@/server/auth";
import { getCaseAI, picturesDrawn, putCaseAI } from "@/server/case-ai";
import { apiError, crossSite, handleError, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Drawing a picture takes a while. */
export const maxDuration = 60;

const ImageSchema = z.object({ token: z.string().min(20).max(400_000), ref: z.string().regex(/^p\d{1,2}$/) });
/** No case needs more than this many pictures; a ceiling on spending. */
const MAX_PICTURES = 8;

/**
 * POST /api/cases/image — an invented case's picture, drawn by the image model
 * the first time the case reaches it, then kept with the case.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, ImageSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const info = sessionInfo(body.token);
    const key = `img:${body.ref}`;
    let stored = info.userId === user.id ? await getCaseAI(info.sessionId, key) : undefined;
    if (!stored) {
      // Owner and progress checked here: a picture exists only once the case has reached it.
      const picture = await pictureFor(body.token, user.id, body.ref);
      if (!picture) return apiError(404, "NOT_FOUND", "There's no picture there yet.");
      if ((await picturesDrawn(info.sessionId)) >= MAX_PICTURES) return apiError(429, "LIMIT", "This case has all the pictures it can have.");
      const drawn = await drawPicture(picture);
      await putCaseAI(info.sessionId, key, user.id, drawn.mime, drawn.base64);
      stored = { mime: drawn.mime, data: drawn.base64 };
    }
    return new Response(new Uint8Array(Buffer.from(stored.data, "base64")), { headers: { "Content-Type": stored.mime, "Cache-Control": "private, max-age=86400" } });
  } catch (err) {
    return handleError(err);
  }
}
