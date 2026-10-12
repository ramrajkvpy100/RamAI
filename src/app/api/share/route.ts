import { z } from "zod";

import { requireUser } from "@/server/auth";
import { ownResultId, shareIdFor } from "@/server/share";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ShareSchema = z.discriminatedUnion("kind", [z.object({ kind: z.literal("result"), sessionId: z.string().min(4).max(100) }), z.object({ kind: z.literal("progress") })]);

/** POST /api/share — a link and pictures for one of your results, or your progress. Only your own. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const body = await parseBody(req, ShareSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    let id: string;
    if (body.kind === "result") {
      const resultId = await ownResultId(user.id, body.sessionId);
      if (!resultId) return apiError(404, "NOT_FOUND", "Finish the case first — then share it.");
      id = shareIdFor("r", resultId);
    } else {
      id = shareIdFor("u", user.id);
    }
    const image = (f: "story" | "square" | "wide") => `/api/share/${id}/card?f=${f}`;
    return ok({ id, url: `${SITE.url}/s/${id}`, images: { story: image("story"), square: image("square"), wide: image("wide") } });
  } catch (err) {
    return handleError(err);
  }
}
