import { z } from "zod";

import { requireUser } from "@/server/auth";
import { isAdmin, listSuggestions, SUGGESTION_CATEGORIES, SUGGESTION_STATUSES } from "@/server/suggestions";
import { apiError, handleError, ok, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FilterSchema = z.object({
  status: z.enum(SUGGESTION_STATUSES).optional(),
  category: z.enum(SUGGESTION_CATEGORIES).optional(),
  q: z.string().max(100).optional(),
});

/** GET /api/admin/suggestions — admins only (and the database checks again). */
export async function GET(req: Request) {
  const blocked = rateLimited(req, 120);
  if (blocked) return blocked;
  const params = Object.fromEntries([...new URL(req.url).searchParams].filter(([, v]) => v !== ""));
  const filter = FilterSchema.safeParse(params);
  if (!filter.success) return apiError(400, "BAD_INPUT", "Invalid filter.");
  try {
    const user = await requireUser();
    if (!(await isAdmin(user))) return apiError(404, "NOT_FOUND", "Not found.");
    return ok(await listSuggestions(filter.data));
  } catch (err) {
    return handleError(err);
  }
}
