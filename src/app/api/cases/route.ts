import { after } from "next/server";

import { sessionInfo, simulateCase, teachingFor } from "@/engine/engine";
import { putCaseAI } from "@/server/case-ai";
import type { CareLevel, CaseTrack, Specialty } from "@/engine/types";
import { requireUser } from "@/server/auth";
import { casesStartedToday, dailyBoard, recentCaseRefs, recordCaseStart, totalCasesStarted } from "@/server/results";
import { dailyKeyFor } from "@/lib/daily";
import { ensureDemoPlayers } from "@/server/seed";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { StartSchema } from "@/lib/server/schemas";
import { dailyLimitFor, PLANS } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Inventing a new patient can take most of a minute. */
export const maxDuration = 60;

/** POST /api/cases — start a case within the player's plan, or the free guided demo case. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const body = await parseBody(req, StartSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    await ensureDemoPlayers();
    const tutorial = body.tutorial === true;
    const daily = !tutorial && body.daily === true ? dailyKeyFor() : undefined;
    if (daily && (await dailyBoard(daily, user.id, 0)).me) {
      return apiError(409, "DAILY_DONE", "You've played today's case. A new one unlocks at midnight IST.");
    }
    const plan = PLANS[user.plan];
    // The daily case is free for everyone, whatever its level, and doesn't use up the day's cases.
    if (!tutorial && !daily && body.level && !plan.levels.includes(body.level as CareLevel)) {
      return apiError(402, "PRO_REQUIRED", "This level is part of RamAI Pro.");
    }
    // Guests get as many real cases a day as a free account; Pro is unlimited.
    const limit = dailyLimitFor(user);
    if (!tutorial && !daily && limit !== null && (await casesStartedToday(user.id)) >= limit) {
      if (user.isGuest) return apiError(403, "SIGNUP_REQUIRED", `That's today's ${limit} free cases — new ones at midnight. Create a free account to keep your progress on every device.`);
      return apiError(402, "DAILY_LIMIT", `You've used today's ${limit} free cases. They refresh at midnight — or go Pro for unlimited cases.`);
    }
    // Newcomers (guests, and anyone's first few cases) get an easy one — unless they picked something themselves.
    const picked = !!(body.specialty || body.track || body.level);
    const easy = !tutorial && !daily && !picked && (user.isGuest || (await totalCasesStarted(user.id)) <= 3);
    // Their own specialty, unless they chose one (or "any") for this case. "mixed" (or not said): every specialty.
    const own = user.specialty && user.specialty !== "mixed" ? user.specialty : undefined;
    const specialty = body.specialty === "any" ? undefined : ((body.specialty as Specialty | undefined) ?? own);
    const session = await simulateCase({
      userId: user.id,
      easy,
      caseNumber: (await totalCasesStarted(user.id)) + 1,
      specialty,
      track: body.track as CaseTrack | undefined,
      level: body.level as CareLevel | undefined,
      allowedLevels: plan.levels,
      exclude: await recentCaseRefs(user.id),
      lang: user.patientLang,
      tutorial,
      country: user.country,
      daily,
    });
    await recordCaseStart(user.id, session.state.sessionId, tutorial, daily);
    // An invented patient: write its debrief teaching now, in the background, so the debrief is ready when the case ends.
    if (sessionInfo(session.token).generated) {
      after(async () => {
        const pack = await teachingFor(session.token, user.id).catch(() => undefined);
        if (pack) await putCaseAI(session.state.sessionId, "teaching", user.id, "application/json", JSON.stringify(pack)).catch(() => undefined);
      });
    }
    return ok(session);
  } catch (err) {
    return handleError(err);
  }
}
