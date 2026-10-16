import { requireUser } from "@/server/auth";
import { duelView } from "@/server/duels";
import { apiError, handleError, ok } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/duel/:id — your score and your opponent's (or the computer's), for a player in it. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{12}$/.test(id)) return apiError(404, "NOT_FOUND", "Not found.");
  try {
    const user = await requireUser();
    const view = await duelView(id, user.id);
    return view ? ok(view) : apiError(404, "NOT_FOUND", "Not found.");
  } catch (err) {
    return handleError(err);
  }
}
