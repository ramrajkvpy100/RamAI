import { z } from "zod";

import { gameStats, recordGame } from "@/server/games";
import { getCurrentUser } from "@/server/auth";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Score = z.object({ game: z.enum(["rush", "synapses", "probe"]), score: z.number().int().min(0).max(1_000_000), xp: z.number().int().min(0).max(100) });

/** POST /api/games/score: a finished quick game. Kept for accounts; guests keep theirs on the phone. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const body = await parseBody(req, Score);
  if (body instanceof Response) return body;
  try {
    const user = await getCurrentUser();
    if (!user || user.isGuest) return ok({ saved: false });
    await recordGame(user.id, body.game, body.score, body.xp);
    return ok({ saved: true });
  } catch (err) {
    return handleError(err);
  }
}

/** GET /api/games/score: this account's XP and bests. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok(user && !user.isGuest ? await gameStats(user.id) : { xp: 0, best: {} });
  } catch (err) {
    return handleError(err);
  }
}
