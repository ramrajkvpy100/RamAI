import { z } from "zod";

import { requireUser } from "@/server/auth";
import { answerSuggestion, deleteSuggestion, isAdmin, SUGGESTION_STATUSES } from "@/server/suggestions";
import { apiError, crossSite, handleError, ok, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Supabase's suggestions have UUIDs; those from guests and visitors (RamAI's own database) "g-" + a UUID. */
const Id = z.string().regex(/^(g-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const AnswerSchema = z
  .object({ status: z.enum(SUGGESTION_STATUSES).optional(), reply: z.string().max(2000, "Please keep the answer under 2,000 characters.").nullable().optional() })
  .refine((v) => v.status !== undefined || v.reply !== undefined, "Nothing to change.");

async function guard(req: Request, params: Promise<{ id: string }>) {
  const blocked = crossSite(req) ?? rateLimited(req, 120);
  if (blocked) return { blocked };
  const id = Id.safeParse((await params).id);
  if (!id.success) return { blocked: apiError(404, "NOT_FOUND", "Not found.") };
  const user = await requireUser();
  if (!(await isAdmin(user))) return { blocked: apiError(404, "NOT_FOUND", "Not found.") };
  return { id: id.data };
}

/** PATCH /api/admin/suggestions/:id — answer it, or change its status. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, params);
    if ("blocked" in g) return g.blocked;
    const body = AnswerSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return apiError(400, "BAD_INPUT", body.error.issues[0]?.message ?? "Check the form.");
    return ok({ suggestion: await answerSuggestion(g.id, body.data) });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/admin/suggestions/:id */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, params);
    if ("blocked" in g) return g.blocked;
    await deleteSuggestion(g.id);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
