import { z } from "zod";

import { currentGuest, endGuestSession, identityOf, linkProfile } from "@/server/auth";
import { authFailure } from "@/server/auth-errors";
import { supabaseServer } from "@/server/supabase";
import { apiError, crossSite, handleError, ok, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";

const GoogleTokenSchema = z.object({ credential: z.string().min(100).max(4096), nonce: z.string().min(16).max(128) });

/**
 * POST /api/auth/google/token — Google's own "Sign in with Google" button hands
 * back a signed ID token; Supabase checks it (and the nonce) and signs the
 * player in. Google's screen then names this site, not the Supabase project.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = GoogleTokenSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return apiError(400, "BAD_INPUT", "Google sign-in didn't finish. Please try again.");
  try {
    const guest = await currentGuest();
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: body.data.credential, nonce: body.data.nonce });
    if (error) return authFailure(error);
    const user = data.user ? await linkProfile(identityOf(data.user), { guestId: guest?.id }) : null;
    if (!user) return apiError(400, "CODE_INVALID", "Google sign-in didn't finish. Please try again.");
    if (guest) await endGuestSession();
    return ok({ user });
  } catch (err) {
    return handleError(err);
  }
}
