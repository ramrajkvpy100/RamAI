import { requireUser } from "@/server/auth";
import { overLimit } from "@/server/rate-limit";
import { writeReport } from "@/server/report";
import { apiError, crossSite, handleError, ok, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/progress/report — writes (or rewrites) your personal report from your cases. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    if (await overLimit(`report:${user.id}`, 8, 3_600_000)) return apiError(429, "RATE_LIMITED", "Your report was just written — play another case, then refresh it.");
    return ok({ report: await writeReport(user) });
  } catch (err) {
    return handleError(err);
  }
}
