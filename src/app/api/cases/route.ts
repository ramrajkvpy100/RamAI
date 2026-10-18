import { after } from "next/server";

import type { CaseSource } from "@/engine/providers/types";
import { withUsage, type UsageScope } from "@/engine/providers/usage";
import { learnFor, sessionInfo, simulateCase, teachingFor } from "@/engine/engine";
import { putCaseAI } from "@/server/case-ai";
import type { CareLevel, CaseTrack, Specialty } from "@/engine/types";
import { requireUser } from "@/server/auth";
import { TRIAL, useCredit } from "@/server/credits";
import { db } from "@/server/db";
import { createDuel, findOpenDuel, joinDuel, newDuelId, type DuelMode } from "@/server/duels";
import { bankCase, takeFromBank, takeReady, type PoolChoice } from "@/server/case-pool";
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
    const lockedLevel = !tutorial && !daily && !!body.level && !plan.levels.includes(body.level as CareLevel);
    const overLimit = !tutorial && !daily && limit !== null && today >= limit;
    // A free Pro case (the trial, or a friend's referral) opens either gate — for accounts, not guests.
    if ((lockedLevel || overLimit) && !user.isGuest && (await useCredit(user.id))) {
      // allowed: one free Pro case used
    } else if (lockedLevel) {
      return apiError(402, "PRO_REQUIRED", "This level is part of RamAI Pro.");
    } else if (overLimit) {
      // Guests get a few real cases a day; accounts a free Pro trial; Pro is unlimited.
      if (user.isGuest) return apiError(403, "SIGNUP_REQUIRED", `That's your ${limit} free cases for today. Sign up free for ${TRIAL} Pro cases — or come back after midnight.`);
      return apiError(402, "DAILY_LIMIT", "Your free Pro cases are used up. Go Pro for unlimited cases at every level — or invite a friend for 5 more each.");
    }
    // Newcomers (guests, and anyone's first few cases) get an easy one — unless they picked something themselves.
    const picked = !!(body.specialty || body.track || body.level);
    // Students get classic presentations; everyone else after their first few cases gets the full range.
    const stage = (await db.get<{ stage: string }>("SELECT stage FROM user_prefs WHERE user_id = ?", user.id).catch(() => undefined))?.stage;
    const easy = !tutorial && !daily && !picked && (user.isGuest || total <= 3 || stage === "student");
    // Their own specialty, unless they chose one (or "any") for this case. "mixed" (or not said): every specialty.
    const own = user.specialty && user.specialty !== "mixed" ? user.specialty : undefined;
    const specialty = body.specialty === "any" ? undefined : ((body.specialty as Specialty | undefined) ?? own);
    // A patient invented ahead of time for exactly this choice starts at once.
    const choice: PoolChoice = { specialty, track: body.track as CaseTrack | undefined, level: body.level as CareLevel | undefined, easy, country: user.country, lang: user.patientLang };
    // Two doctors, one patient: joining plays the other doctor's case; starting one shares yours.
    let duelId: string | undefined;
    let shared: CaseSource | null = null;
    let host: DuelMode | null = null;
    // "Retry this case": the same patient again, for another approach.
    if (body.retry && !tutorial && !daily) {
      const was = sessionInfo(body.retry);
      if (was.userId === user.id) shared = was.src;
    }
    if (body.duel && !tutorial && !daily && !shared) {
      const me = { id: user.id, name: user.name || user.username || "Doctor" };
      if (body.duel === "find") {
        const open = await findOpenDuel(me);
        if (open) ({ id: duelId, src: shared } = open);
        else host = "find";
      } else if (body.duel === "invite" || body.duel === "computer") host = body.duel;
      else {
        shared = await joinDuel(body.duel, me);
        if (!shared) return apiError(409, "BAD_REQUEST", "That game has already been taken — start one of your own.");
        duelId = body.duel;
      }
      if (host) duelId = newDuelId();
    }
    // Free first: the other doctor's case, one written ahead for this doctor, or one from the bank they haven't met.
    const fresh = tutorial || daily || body.disease || shared;
    const pooled = fresh ? null : await takeReady(user.id, choice).catch(() => null);
    const banked = fresh || pooled ? null : await takeFromBank(user.id, choice).catch(() => null);
    const ready = shared ?? pooled ?? banked;
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
      unlimited: body.unlimited,
      disease: body.disease,
      duel: duelId,
    }));
    usage.sessionId = session.state.sessionId;
    // A patient invented just now is kept for other doctors.
    if (!shared && !banked && !tutorial && !daily) {
      await bankCase(user.id, sessionInfo(session.token).src, { specialty: specialty, track: session.state.track, level: session.state.level, easy, country: user.country, lang: user.patientLang }).catch(() => undefined);
    }
    if (host && duelId) await createDuel(duelId, host, { id: user.id, name: user.name || user.username || "Doctor" }, sessionInfo(session.token).src);
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
