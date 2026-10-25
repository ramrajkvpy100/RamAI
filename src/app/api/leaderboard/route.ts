import { getCurrentUser } from "@/server/auth";
import { leagueView } from "@/server/leagues";
import { BOARDS, leaderboard, type BoardId, type Period } from "@/server/results";
import { ensureDemoPlayers } from "@/server/seed";
import { apiError, ok } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard?view=league            the player's weekly league group
 * GET /api/leaderboard?board=overall&period=all   a global board
 */
export async function GET(req: Request) {
  await ensureDemoPlayers();
  const url = new URL(req.url);
  const user = await getCurrentUser();
  if (url.searchParams.get("view") === "league") {
    if (!user) return apiError(401, "UNAUTHENTICATED", "Please log in.");
    return ok(await leagueView(user));
  }
  const board = (url.searchParams.get("board") ?? "overall") as BoardId;
  const period = (url.searchParams.get("period") === "week" ? "week" : "all") as Period;
  const id = board in BOARDS ? board : "overall";
  // Near me / my college: the viewer's own city or college (chosen in their profile).
  const by = url.searchParams.get("scope");
  const value = by === "city" ? user?.city : by === "college" ? user?.college : null;
  if ((by === "city" || by === "college") && !value) return ok({ board: id, period, scope: by, needs: by, rows: [], total: 0 });
  const scope = (by === "city" || by === "college") && value ? { by, value } as const : null;
  return ok({ board: id, period, ...(scope ? { scope: scope.by, place: scope.value } : {}), ...(await leaderboard(id, period, user?.id, 50, scope)) });
}
