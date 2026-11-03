import { z } from "zod";

import { cleanPhoto, DEFAULT_AVATAR, isPersona, parseAvatar, PHOTO, type AvatarStyle } from "@/lib/avatar-style";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { supabaseServer } from "@/server/supabase";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";

/** A persona's id, "photo", or null for "not this any more". */
const Schema = z.object({ persona: z.string().max(40).nullable() });

/** The Google picture on the signed-in account, from Supabase itself: never an address the browser sends. */
async function accountPhoto(): Promise<string | null> {
  try {
    const { data } = await (await supabaseServer()).auth.getUser();
    const u = data.user;
    if (!u) return null;
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const google = (u.identities ?? []).find((i) => i.provider === "google")?.identity_data ?? {};
    return cleanPhoto(meta.avatar_url) ?? cleanPhoto(meta.picture) ?? cleanPhoto(google.avatar_url) ?? cleanPhoto(google.picture) ?? null;
  } catch {
    return null;
  }
}

/** GET /api/me/avatar: the Google photo this account could use, if it has one. */
export async function GET() {
  try {
    const user = await requireUser();
    return ok({ photo: user.isGuest ? null : await accountPhoto() });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/me/avatar: choose a persona or the Google photo. Everything already stored (an old cartoon too) stays in the row. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const body = await parseBody(req, Schema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const row = await db.get<{ style: string }>("SELECT style FROM user_avatars WHERE user_id = ?", user.id);
    let stored: AvatarStyle | null = null;
    try {
      stored = row ? parseAvatar(JSON.parse(row.style)) : null;
    } catch {
      // Unreadable: start again from the defaults.
    }
    const { persona: _persona, photo: _photo, ...base } = stored ?? { ...DEFAULT_AVATAR, auto: true };

    let chosen: Pick<AvatarStyle, "persona" | "photo"> = {};
    if (body.persona === PHOTO) {
      const photo = user.isGuest ? null : await accountPhoto();
      if (!photo) return apiError(409, "NO_PHOTO", "This account has no Google photo to use.");
      chosen = { persona: PHOTO, photo };
    } else if (body.persona !== null) {
      if (!isPersona(body.persona)) return apiError(400, "UNKNOWN_PERSONA", "That avatar doesn't exist.");
      chosen = { persona: body.persona };
    } else if (base.auto) {
      // Never made a cartoon, so nothing goes back: only the defaults this route filled in are removed.
      await db.run("DELETE FROM user_avatars WHERE user_id = ?", user.id);
      return ok({ style: null });
    }
    const style: AvatarStyle = { ...base, ...chosen };
    await db.run("INSERT INTO user_avatars (user_id, style, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET style = excluded.style, updated_at = excluded.updated_at", user.id, JSON.stringify(style), Date.now());
    return ok({ style });
  } catch (err) {
    return handleError(err);
  }
}
