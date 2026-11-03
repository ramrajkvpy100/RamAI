import { requireUser } from "@/server/auth";
import { progressDetail } from "@/server/progress-detail";
import { savedReport } from "@/server/report";
import { handleError, ok } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/progress/detail — the progress page's numbers, read after the page has been drawn. */
export async function GET() {
  try {
    const user = await requireUser();
    const [detail, report] = await Promise.all([progressDetail(user.id), savedReport(user.id)]);
    return ok({ detail, report });
  } catch (err) {
    return handleError(err);
  }
}
