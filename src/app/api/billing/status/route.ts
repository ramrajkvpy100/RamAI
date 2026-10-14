import { requireUser } from "@/server/auth";
import { orderStatus } from "@/server/billing";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { OrderStatusSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/** POST /api/billing/status — where one of the buyer's own orders stands (created, paid, failed, refunded). */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 40);
  if (blocked) return blocked;
  const body = await parseBody(req, OrderStatusSchema);
  if (body instanceof Response) return body;
  try {
    const status = await orderStatus(await requireUser(), body.orderId);
    return status ? ok({ status }) : apiError(404, "NOT_FOUND", "Unknown order.");
  } catch (err) {
    return handleError(err);
  }
}
