import { requireUser } from "@/server/auth";
import { exportData } from "@/server/privacy";
import { apiError, handleError, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/me/export — a copy of everything RamAI holds about you, as a JSON file. */
export async function GET(req: Request) {
  const blocked = rateLimited(req, 10);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const data = await exportData(user.id);
    if (!data) return apiError(404, "UNAUTHENTICATED", "Please log in.");
    const day = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="ramai-my-data-${day}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
