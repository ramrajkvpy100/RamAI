import { z } from "zod";

import { requireUser } from "@/server/auth";
import { vapidPublicKey } from "@/server/push";
import { removeSubscription, saveSubscription, subscriptionProblem } from "@/server/reminders";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const b64url = z.string().max(200).regex(/^[A-Za-z0-9_-]+={0,2}$/);
const SubscribeSchema = z.object({ endpoint: z.string().max(1000), keys: z.object({ p256dh: b64url, auth: b64url }) });
const UnsubscribeSchema = z.object({ endpoint: z.string().max(1000) });

/** GET /api/push — the key browsers subscribe with. */
export async function GET(req: Request) {
  // Fetched on page loads, so generous: many doctors can share one hospital network.
  const blocked = rateLimited(req, 120);
  if (blocked) return blocked;
  try {
    return ok({ key: vapidPublicKey() });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/push — this browser wants the daily reminder. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, SubscribeSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    if (user.isGuest) return apiError(403, "GUEST", "Create a free account to get daily reminders.");
    const sub = { endpoint: body.endpoint, p256dh: body.keys.p256dh.replace(/=+$/, ""), auth: body.keys.auth.replace(/=+$/, "") };
    const problem = subscriptionProblem(sub);
    if (problem) return apiError(400, "BAD_REQUEST", problem);
    await saveSubscription(user.id, sub);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/push — reminders off for this browser. */
export async function DELETE(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, UnsubscribeSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    await removeSubscription(user.id, body.endpoint);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
