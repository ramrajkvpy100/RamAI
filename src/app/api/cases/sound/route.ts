import { z } from "zod";

import { sessionInfo, stethoscopeSounds } from "@/engine/engine";
import { loud, renderAuscultation, seedOf, toWav } from "@/engine/stethoscope-audio";
import { requireUser } from "@/server/auth";
import { apiError, crossSite, handleError, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SoundSchema = z.object({ token: z.string().min(20).max(400_000), messageId: z.string().regex(/^m\d{1,6}$/) });

/**
 * POST /api/cases/sound — what the stethoscope picks up, as audio. The
 * browser gets the sound only: what it represents stays on the server.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 60);
  if (blocked) return blocked;
  const body = await parseBody(req, SoundSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const sounds = await stethoscopeSounds(body.token, user.id, body.messageId);
    if (!sounds?.length) return apiError(404, "NOT_FOUND", "Nothing to listen to there.");
    const wav = toWav(loud(renderAuscultation(sounds, seedOf(`${sessionInfo(body.token).sessionId}:${body.messageId}`))));
    return new Response(new Uint8Array(wav), { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, no-store" } });
  } catch (err) {
    return handleError(err);
  }
}
