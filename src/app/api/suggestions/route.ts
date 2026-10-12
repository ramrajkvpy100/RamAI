import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { overLimit } from "@/server/rate-limit";
import { mySuggestions, sendOpenSuggestion, sendSuggestion, SUGGESTION_CATEGORIES } from "@/server/suggestions";
import { apiError, clientIp, crossSite, handleError, ok, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SuggestSchema = z.object({
  category: z.enum(SUGGESTION_CATEGORIES),
  message: z.string().trim().min(10, "Please write at least 10 characters.").max(2000, "Please keep it under 2,000 characters."),
  page: z.string().max(200).regex(/^\/[^\s]*$/).optional(),
  /** Without an account: where to answer, if they'd like one. */
  email: z.union([z.literal(""), z.string().trim().email("That email doesn't look right.").max(200)]).optional(),
});

/** GET /api/suggestions — your own suggestions, with answers (none for a visitor without a session). */
export async function GET(req: Request) {
  const blocked = rateLimited(req, 60);
  if (blocked) return blocked;
  try {
    const user = await getCurrentUser();
    return ok({ items: user ? await mySuggestions(user) : [] });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/suggestions — no account needed. Accounts' go to Supabase; guests' and visitors' to RamAI's own database. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const parsed = SuggestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "BAD_INPUT", parsed.error.issues[0]?.message ?? "Check the form.");
  try {
    const user = await getCurrentUser();
    const who = user && !user.isGuest ? `suggest:${user.id}` : `suggest-ip:${clientIp(req)}`;
    if (await overLimit(who, 6, 3_600_000)) return apiError(429, "RATE_LIMITED", "Thanks — that's plenty for one hour. Please send more later.");
    const { email, ...input } = parsed.data;
    if (user && !user.isGuest) return ok({ suggestion: await sendSuggestion(user, input) });
    return ok({ suggestion: await sendOpenSuggestion(user, { ...input, email: email || null }) });
  } catch (err) {
    return handleError(err);
  }
}
