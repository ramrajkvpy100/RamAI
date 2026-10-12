import { z } from "zod";

import { requireUser } from "@/server/auth";
import { communityFailure, CommunityError, hiddenItems, remove, report, restore, toggleLike } from "@/server/community";
import { isAdmin } from "@/server/suggestions";
import { crossSite, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Target = z.string().regex(/^[pr]:[0-9a-f-]{36}$/);
const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("like"), target: Target }),
  z.object({ action: z.literal("report"), target: Target, reason: z.string().max(200).optional() }),
  z.object({ action: z.literal("remove"), target: Target }),
  z.object({ action: z.literal("restore"), target: Target }),
  z.object({ action: z.literal("hidden") }),
]);

/** POST /api/community/action — like, report, remove your own; admins restore and see what reports have hidden. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 60);
  if (blocked) return blocked;
  const body = await parseBody(req, ActionSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    switch (body.action) {
      case "like":
        return ok(await toggleLike(user, body.target));
      case "report":
        if (user.isGuest) throw new CommunityError("SIGNUP_REQUIRED", "Create a free account to report posts.");
        await report(user, body.target, body.reason);
        return ok({ ok: true });
      case "remove":
        await remove(user, body.target, !user.isGuest && (await isAdmin(user)));
        return ok({ ok: true });
      case "restore":
        if (user.isGuest || !(await isAdmin(user))) throw new CommunityError("FORBIDDEN", "Not allowed.");
        await restore(body.target);
        return ok({ ok: true });
      case "hidden":
        if (user.isGuest || !(await isAdmin(user))) throw new CommunityError("FORBIDDEN", "Not allowed.");
        return ok({ items: await hiddenItems() });
    }
  } catch (err) {
    return communityFailure(err);
  }
}
