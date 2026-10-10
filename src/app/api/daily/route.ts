import { dailyCase } from "@/engine/cases";
import { getCurrentUser } from "@/server/auth";
import { dailyBoard, dailyStarted } from "@/server/results";
import { dailyEndsAt, dailyKeyFor, dailyNumber } from "@/lib/daily";
import { handleError, ok } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/daily — today's case (mode and level only, never the diagnosis), your result and the ranking. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    const dayKey = dailyKeyFor();
    const def = dailyCase(dayKey);
    const [board, started] = await Promise.all([dailyBoard(dayKey, user?.id, 5), user ? dailyStarted(user.id, dayKey) : Promise.resolve(false)]);
    return ok({ dayKey, number: dailyNumber(dayKey), endsAt: dailyEndsAt(dayKey), track: def.track, level: def.level, started, me: board.me ?? null, top: board.top, total: board.total });
  } catch (err) {
    return handleError(err);
  }
}
