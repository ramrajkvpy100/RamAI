import { createHash, timingSafeEqual } from "node:crypto";

import { sendDailyReminders } from "@/server/reminders";
import { apiError, handleError, ok, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * GET /api/cron/reminders — Vercel Cron calls this every evening (vercel.json).
 * With CRON_SECRET set, only Vercel can. Without it, a stray call is harmless:
 * reminders still go out only in the evening and at most once a day.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const trusted = !!secret && timingSafeEqual(digest(req.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
  if (secret && !trusted) return apiError(401, "UNAUTHENTICATED", "Not allowed.");
  const blocked = rateLimited(req, 10);
  if (blocked) return blocked;
  try {
    const run = await sendDailyReminders();
    console.info("[ramai] reminders:", JSON.stringify(run));
    return ok(trusted ? run : { ok: true });
  } catch (err) {
    return handleError(err);
  }
}
