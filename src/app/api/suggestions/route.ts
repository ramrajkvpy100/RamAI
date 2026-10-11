import { z } from "zod";

import { requireUser } from "@/server/auth";
import { overLimit } from "@/server/rate-limit";
import { mySuggestions, sendSuggestion, SUGGESTION_CATEGORIES } from "@/server/suggestions";
import { apiError, crossSite, handleError, ok, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SuggestSchema = z.object({
  category: z.enum(SUGGESTION_CATEGORIES),
  message: z.string().trim().min(10, "Please write at least 10 characters.").max(2000, "Please keep it under 2,000 characters."),
  page: z.string().max(200).regex(/^\/[^\s]*$/).optional(),
});

const signUpFirst = () => apiError(403, "SIGNUP_REQUIRED", "Create a free account to send suggestions — so we can answer you.");

/** GET /api/suggestions — the player's own suggestions, with answers. */
export async function GET(req: Request) {
  const blocked = rateLimited(req, 60);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    if (user.isGuest) return ok({ items: [] });
    return ok({ items: await mySuggestions() });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/suggestions — sends one, stored in Supabase as the player. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const parsed = SuggestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "BAD_INPUT", parsed.error.issues[0]?.message ?? "Check the form.");
  try {
    const user = await requireUser();
    if (user.isGuest) return signUpFirst();
    if (await overLimit(`suggest:${user.id}`, 6, 3_600_000)) return apiError(429, "RATE_LIMITED", "Thanks — that's plenty for one hour. Please send more later.");
    return ok({ suggestion: await sendSuggestion(user, parsed.data) });
  } catch (err) {
    return handleError(err);
  }
}
