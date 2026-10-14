import { z } from "zod";

import { requireUser } from "@/server/auth";
import { achievementCard, achievementValue, ownResultId, shareIdFor } from "@/server/share";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ShareSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("result"), sessionId: z.string().min(4).max(100) }),
  z.object({ kind: z.literal("progress") }),
  // A badge they've unlocked (by id), or — without one — their rank.
  z.object({ kind: z.literal("achievement"), badge: z.string().regex(/^[a-z0-9-]{1,40}$/).optional() }),
]);

/** POST /api/share — a link and pictures for one of your results, your progress, or an achievement. Only your own. */
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
    } else if (body.kind === "achievement") {
      const value = achievementValue(user.id, body.badge);
      if (!(await achievementCard(value))) return apiError(404, "NOT_FOUND", "Unlock it first — then share it.");
      id = shareIdFor("a", value);
    } else {
      id = shareIdFor("u", user.id);
    }
    const image = (f: "story" | "square" | "wide") => `/api/share/${id}/card?f=${f}`;
    return ok({ id, url: `${SITE.url}/s/${id}`, images: { story: image("story"), square: image("square"), wide: image("wide") } });
  } catch (err) {
    return handleError(err);
  }
}
