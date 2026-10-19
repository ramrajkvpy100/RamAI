import { randomUUID } from "node:crypto";

import { after } from "next/server";
import { z } from "zod";

import { sessionInfo } from "@/engine/engine";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { notifyOwner } from "@/server/notify-owner";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";

const Schema = z.object({
  token: z.string().min(20).max(400_000),
  kind: z.enum(["report", "feedback"]),
  rating: z.union([z.literal(1), z.literal(-1)]).optional(),
  reason: z.string().trim().max(600).default(""),
  /** During a case: what kind of problem, the screen as a JPEG, and the conversation so far. */
  category: z.enum(["fact", "result", "understanding", "broken", "other"]).optional(),
  screenshot: z.string().max(1_600_000).regex(/^data:image\/(jpeg|png);base64,/).optional(),
  transcript: z.string().max(8000).optional(),
  caseNumber: z.number().int().min(0).max(1_000_000).optional(),
});

const CATEGORY: Record<string, string> = { fact: "Wrong medical fact", result: "Wrong result or picture", understanding: "Didn't understand me", broken: "Something broke", other: "Other" };

/** POST /api/cases/feedback — "Report this case" (an error in it) or thumbs up/down after the debrief. Kept for the weekly review. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, Schema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const info = sessionInfo(body.token);
    if (info.userId !== user.id) return apiError(404, "NOT_FOUND", "Not found.");
    // A reason, or at least a kind of problem (the screenshot shows the rest).
    if (body.kind === "report" && body.reason.length < 3 && !body.category) return apiError(400, "BAD_REQUEST", "Say what's wrong, in a few words.");
    const id = randomUUID();
    await db.run(
      "INSERT INTO case_feedback (id, user_id, session_id, case_ref, kind, rating, reason, created_at, screenshot, transcript, category, case_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, user.id, info.sessionId, info.learnKey, body.kind, body.rating ?? null, body.reason, Date.now(), body.screenshot ?? null, body.transcript ?? null, body.category ?? null, body.caseNumber ?? null,
    );
    if (body.kind === "report") {
      // It reaches the owner at once — email and phone.
      after(() =>
        notifyOwner({
          subject: `Case problem · ${body.category ? CATEGORY[body.category] : "report"}`,
          text: `${user.name} (${user.email}) reported a problem${body.caseNumber ? ` in case #${body.caseNumber}` : ""}:\n\n${body.reason || "(no note)"}${body.screenshot ? "\n\nScreenshot attached on the reports page." : ""}`,
          url: `/admin/reports#${id}`,
        })
          .then(() => undefined)
          .catch(() => undefined),
      );
    }
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
