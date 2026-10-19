import { randomUUID } from "node:crypto";

import { after } from "next/server";
import { z } from "zod";

import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { notifyOwner } from "@/server/notify-owner";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";

const Schema = z.object({
  /** Where: "skills" (a Skills Lab drill) or "exam" (an exam question). */
  area: z.enum(["skills", "exam"]),
  /** What exactly — the drill and question, e.g. "Spot the diagnosis · ECG · Atrial fibrillation". */
  ref: z.string().trim().min(1).max(300),
  category: z.enum(["fact", "result", "understanding", "broken", "other"]),
  reason: z.string().trim().max(600).default(""),
  /** The question as shown, its options and the key — so the report can be checked without the screen. */
  details: z.string().max(8000).optional(),
  screenshot: z.string().max(1_600_000).regex(/^data:image\/(jpeg|png);base64,/).optional(),
});

const CATEGORY: Record<string, string> = { fact: "Wrong medical fact", result: "Wrong answer or picture", understanding: "Unclear question", broken: "Something broke", other: "Other" };

/** POST /api/report — a problem in a Skills Lab drill or an exam question, with a screenshot. The owner is told at once. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, Schema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const id = randomUUID();
    await db.run(
      "INSERT INTO case_feedback (id, user_id, session_id, case_ref, kind, rating, reason, created_at, screenshot, transcript, category, case_number) VALUES (?, ?, ?, ?, 'report', NULL, ?, ?, ?, ?, ?, NULL)",
      id, user.id, "", `${body.area}: ${body.ref}`, body.reason, Date.now(), body.screenshot ?? null, body.details ?? null, body.category,
    );
    after(() =>
      notifyOwner({
        subject: `${body.area === "exam" ? "Exam question" : "Skills Lab"} problem · ${CATEGORY[body.category]}`,
        text: `${user.name} (${user.email}) reported a problem in ${body.ref}:\n\n${body.reason || "(no note)"}`,
        url: `/admin/reports#${id}`,
      })
        .then(() => undefined)
        .catch(() => undefined),
    );
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
