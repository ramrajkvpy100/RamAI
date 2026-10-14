import { after } from "next/server";

import { withUsage, type UsageScope } from "@/engine/providers/usage";
import { learnFor, sessionInfo, simulateCase, teachingFor } from "@/engine/engine";
import { putCaseAI } from "@/server/case-ai";
import type { CareLevel, CaseTrack, Specialty } from "@/engine/types";
import { requireUser } from "@/server/auth";
import { takeReady, type PoolChoice } from "@/server/case-pool";
import { casesStartedToday, dailyBoard, recentCaseRefs, recordCaseStart, totalCasesStarted } from "@/server/results";
import { dailyKeyFor } from "@/lib/daily";
import { ensureDemoPlayers } from "@/server/seed";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { StartSchema } from "@/lib/server/schemas";
import { dailyLimitFor, planFor } from "@/lib/plans";

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
    const tutorial = body.tutorial === true;
    const daily = !tutorial && body.daily === true ? dailyKeyFor() : undefined;
    const plan = planFor(user);
    const limit = dailyLimitFor(user);
    // Everything the start depends on, read at once rather than one round trip after another.
    const [, played, today, total, exclude] = await Promise.all([
      ensureDemoPlayers(),
      daily ? dailyBoard(daily, user.id, 0) : null,
      !tutorial && !daily && limit !== null ? casesStartedToday(user.id) : 0,
      totalCasesStarted(user.id),
      recentCaseRefs(user.id),
    ]);
    if (played?.me) {
      return apiError(409, "DAILY_DONE", "You've played today's case. A new one unlocks at midnight IST.");
    }
    // The daily case is free for everyone, whatever its level, and doesn't use up the day's cases.
    if (!tutorial && !daily && body.level && !plan.levels.includes(body.level as CareLevel)) {
      return apiError(402, "PRO_REQUIRED", "This level is part of RamAI Pro.");
    }
    // Guests get a few real cases a day; free accounts a few more; Pro is unlimited (and open to every account for now).
    if (!tutorial && !daily && limit !== null && today >= limit) {
      if (user.isGuest) return apiError(403, "SIGNUP_REQUIRED", `That's your ${limit} free cases for today. Log in and go Pro for unlimited cases — or come back after midnight.`);
      return apiError(402, "DAILY_LIMIT", "Go Pro for unlimited cases at every level.");
    }
    // Newcomers (guests, and anyone's first few cases) get an easy one — unless they picked something themselves.
    const picked = !!(body.specialty || body.track || body.level);
    const easy = !tutorial && !daily && !picked && (user.isGuest || total <= 3);
    // Their own specialty, unless they chose one (or "any") for this case. "mixed" (or not said): every specialty.
    const own = user.specialty && user.specialty !== "mixed" ? user.specialty : undefined;
    const specialty = body.specialty === "any" ? undefined : ((body.specialty as Specialty | undefined) ?? own);
    // A patient invented ahead of time for exactly this choice starts at once.
    const choice: PoolChoice = { specialty, track: body.track as CaseTrack | undefined, level: body.level as CareLevel | undefined, easy, country: user.country, lang: user.patientLang };
    const ready = tutorial || daily ? null : await takeReady(user.id, choice).catch(() => null);
    const usage: UsageScope = { kind: "case-start" };
    const session = await withUsage(usage, async () => simulateCase({
      ready,
      userId: user.id,
      easy,
      caseNumber: total + 1,
      specialty,
      track: body.track as CaseTrack | undefined,
      level: body.level as CareLevel | undefined,
      allowedLevels: plan.levels,
      exclude,
      lang: user.patientLang,
      tutorial,
      country: user.country,
      daily,
    }));
    usage.sessionId = session.state.sessionId;
    await recordCaseStart(user.id, session.state.sessionId, tutorial, daily);
    // An invented patient: its debrief teaching, pearls and exam questions are written now, in the background, ready for when the case ends.
    if (sessionInfo(session.token).generated) {
      after(() =>
        withUsage({ kind: "case-teaching", sessionId: session.state.sessionId }, () => Promise.all([
          teachingFor(session.token, user.id)
            .then((pack) => pack && putCaseAI(session.state.sessionId, "teaching", user.id, "application/json", JSON.stringify(pack)))
            .catch(() => undefined),
          // Pearls and exam questions too — kept on the server, handed out only once the case has ended.
          learnFor(session.token, user.id, { early: true })
            .then((pack) => pack && putCaseAI(session.state.sessionId, "learn", user.id, "application/json", JSON.stringify(pack)))
            .catch(() => undefined),
        ])),
      );
    }
    return ok(session);
  } catch (err) {
    return handleError(err);
  }
}
