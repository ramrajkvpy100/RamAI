import { checkOpenAI } from "@/lib/server/openai-check";
import { apiError, handleError, ok, rateLimited } from "@/lib/server/http";
import { requireUser } from "@/server/auth";
import { isAdmin } from "@/server/suggestions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/openai — admins only: is the live site's OpenAI key working?
 * Answers yes or no with the reason; never the key.
 */
export async function GET(req: Request) {
  const blocked = rateLimited(req, 6);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    if (!(await isAdmin(user))) return apiError(404, "NOT_FOUND", "Not found.");
    const { OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL } = process.env;
    const result = await checkOpenAI({ OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL });
    return ok({ ...result, models: result.models?.slice(0, 40) });
  } catch (err) {
    return handleError(err);
  }
}
