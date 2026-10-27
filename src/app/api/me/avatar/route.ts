import { z } from "zod";

import { itemUnlocked, parseAvatar } from "@/lib/avatar-style";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { progressFor } from "@/server/progress";
import { rankFor } from "@/engine/progression";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";

const Schema = z.object({ style: z.record(z.string(), z.union([z.string().max(20), z.number()])) });

/** POST /api/me/avatar — saves the avatar the doctor made (each piece checked). */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const body = await parseBody(req, Schema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const parsed = parseAvatar(body.style)!;
    // An outfit is only worn once its rank is reached.
    const progress = await progressFor(user.id);
    const tier = rankFor(progress.percent).tier;
    // And an item from the doctor's bag only once it's collected.
    const style = { ...parsed, outfit: parsed.outfit !== undefined && parsed.outfit > tier - 1 ? -1 : parsed.outfit, extra: itemUnlocked(parsed.extra, progress) ? parsed.extra : "stethoscope" as const };
    await db.run("INSERT INTO user_avatars (user_id, style, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET style = excluded.style, updated_at = excluded.updated_at", user.id, JSON.stringify(style), Date.now());
    return ok({ style });
  } catch (err) {
    return handleError(err);
  }
}
