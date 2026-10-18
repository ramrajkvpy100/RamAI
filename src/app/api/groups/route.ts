import { z } from "zod";

import { requireUser } from "@/server/auth";
import { createGroup, joinGroup, leaveGroup, myGroups } from "@/server/groups";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().trim().min(2).max(60) }),
  z.object({ action: z.literal("join"), code: z.string().trim().regex(/^[A-Za-z2-9]{6}$/) }),
  z.object({ action: z.literal("leave"), code: z.string().trim().regex(/^[A-Za-z2-9]{6}$/) }),
]);

/** GET /api/groups — the doctor's private leaderboards, this week. */
export async function GET() {
  try {
    const user = await requireUser();
    return ok({ groups: await myGroups(user.id) });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/groups — start a group, join one by its code, or leave it. Guests sign up first. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, Action);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    if (user.isGuest) return apiError(403, "SIGNUP_REQUIRED", "Sign up free to start or join a group.");
    if (body.action === "create") return ok({ code: await createGroup(user.id, body.name) });
    if (body.action === "join") return (await joinGroup(user.id, body.code)) ? ok({ ok: true }) : apiError(404, "NOT_FOUND", "No group has that code.");
    await leaveGroup(user.id, body.code);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
