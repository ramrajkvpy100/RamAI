import { requireUser } from "@/server/auth";
import { newWidgetToken } from "@/server/widget";
import { crossSite, handleError, ok, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/widget/token — a read-only key for this doctor's progress widget, handed to the Android app. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    return ok({ token: await newWidgetToken(user.id) });
  } catch (err) {
    return handleError(err);
  }
}
