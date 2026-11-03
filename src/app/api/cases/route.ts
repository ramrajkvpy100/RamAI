
import { randomUUID } from "node:crypto";

import { after } from "next/server";
import { checkCase } from "@/server/case-check";
import type { CaseSource } from "@/engine/providers/types";
import { timingLine, withUsage, type UsageScope } from "@/engine/providers/usage";
import { learnFor, sessionInfo, simulateCase, teachingFor } from "@/engine/engine";
import { putCaseAI } from "@/server/case-ai";
import type { CareLevel, CaseTrack, Specialty } from "@/engine/types";
import { mockProvider } from "@/engine/providers/mock";
import { requireUser } from "@/server/auth";
import { TRIAL, useCredit } from "@/server/credits";
import { bumpMe } from "@/server/me";
import { createDuel, findOpenDuel, joinDuel, newDuelId, type DuelMode } from "@/server/duels";
import { requestDuel } from "@/server/nearby";
import { bankCase, takeFromBank, takeLiveSlot, takeReady, type PoolChoice, prepareNext, unbankCase, waitForWriting } from "@/server/case-pool";
import { db } from "@/server/db";
import { dailyBoard, recordCaseStart, startFacts } from "@/server/results";
import { dailyKeyFor } from "@/lib/daily";
import { ensureDemoPlayers } from "@/server/seed";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { StartSchema } from "@/lib/server/schemas";
import { dailyLimitFor, planFor } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Inventing a new patient can take most of a minute. */
export const maxDuration = 240;

/** POST /api/cases — start a case within the player's plan, or the free guided demo case. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const body = await parseBody(req, StartSchema);
  if (body instanceof Response) return body;
  try {
    const began = Date.now();
    const timing: Record<string, number> = {};
    const user = await requireUser();
    const tutorial = body.tutorial === true;
    const daily = !tutorial && body.daily === true ? dailyKeyFor() : undefined;
    const plan = planFor(user);
    const limit = dailyLimitFor(user);
    // Everything the start depends on, read at once rather than one round trip after another.
    timing.auth = Date.now() - began;
    const [, played, facts] = await Promise.all([
      ensureDemoPlayers(),
      daily ? dailyBoard(daily, user.id, 0) : null,
      startFacts(user.id),
    ]);
    timing.facts = Date.now() - began - timing.auth;
    const { total, recent: exclude, stage, poolRows } = facts;
    const today = !tutorial && !daily && limit !== null ? facts.today : 0;
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
      if (user.isGuest) return apiError(403, "SIGNUP_REQUIRED", `That's your ${limit} free cases for today. Sign in with Google to save your Clinical Rating and get ${TRIAL} Pro cases — or come back after midnight.`);
      return apiError(402, "DAILY_LIMIT", "That's today's free cases. Invite a colleague for +2 cases a day and 3 days of Pro, or go Pro for unlimited cases.");
    }
    // Newcomers (guests, and anyone's first few cases) get an easy one — unless they picked something themselves.
    const picked = !!(body.specialty || body.track || body.level);
    // Students get classic presentations; everyone else after their first few cases gets the full range.
    // The first three cases are always easy and winnable — even ones picked from the menu; students and interns keep classic cases.
    // The doctor's own choice of difficulty wins; without one, newcomers and students get easy cases.
    const difficulty = body.difficulty;
    const easy = !tutorial && !daily && (difficulty ? difficulty === "easy" : total < 3 || (!picked && (user.isGuest || stage === "student" || stage === "intern")));
    const hard = !tutorial && !daily && difficulty === "hard";
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
    // (A hard case is always written fresh: the ready ones are easy or standard.)
    // "Near me": a patient from the doctor's own city, always written fresh.
    // (Only letters, spaces and simple punctuation reach the case writer.)
    const place = body.nearMe && !tutorial && !daily && !shared ? (body.city || user.city)?.replace(/[^\p{L}\p{M} ,.'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60) || undefined : undefined;
    const fresh = tutorial || daily || body.disease || shared || hard || place;
    const pooled = fresh || poolRows === 0 ? null : await takeReady(user.id, choice).catch(() => null);
    const banked = fresh || pooled ? null : await takeFromBank(user.id, choice).catch(() => null);
    // Neither: a written case they haven't met starts at once, and a new patient is written for their next game.
    // (Asked for something fresh, or a duel: that waits. Nothing written fits: the one being written, if any, then a new one.)
    const pickedWritten = fresh || host || shared || pooled || banked ? null : await mockProvider.createCase({ easy, specialty, track: body.track as CaseTrack | undefined, level: body.level as CareLevel | undefined, allowedLevels: plan.levels, exclude, country: user.country } as never).catch(() => null);
    // (Only one they haven't met: the picker can still choose a recent one when little else fits.)
    const written = pickedWritten?.kind === "library" && !exclude.includes(pickedWritten.id) ? pickedWritten : null;
    // Nothing for that specialty just now: another case they haven't met, at once, rather than a minute's wait. Theirs is written for next time.
    // (Only when no particular kind of case was the point of asking: a disease, a place, a duel or a retry still waits.)
    const anyOther = fresh || host || shared || pooled || banked || written || !specialty ? null : await mockProvider.createCase({ easy, track: body.track as CaseTrack | undefined, level: body.level as CareLevel | undefined, allowedLevels: plan.levels, exclude, country: user.country } as never).catch(() => null);
    const stopgap = anyOther?.kind === "library" && !exclude.includes(anyOther.id) ? anyOther : null;
    const awaited = fresh || host || shared || pooled || banked || written || stopgap ? null : await waitForWriting(user.id, choice, 50_000).catch(() => null);
    timing.lookup = Date.now() - began;
    // Nothing ready, so one must be invented while they wait: only a few at once, across every server. Past that, the nearest case now.
    const toWrite = !(shared ?? pooled ?? banked ?? written ?? stopgap ?? awaited) && !tutorial && !daily;
    const release = toWrite ? await takeLiveSlot(randomUUID()).catch(() => async () => undefined) : null;
    const busy = toWrite && !release ? await mockProvider.createCase({ easy, allowedLevels: plan.levels, exclude, country: user.country } as never).catch(() => null) : null;
    const ready = shared ?? pooled ?? banked ?? written ?? stopgap ?? awaited ?? busy;
    const usage: UsageScope = { kind: "case-start", timing };
    if (toWrite && !release && !busy) return apiError(503, "BUSY", "Lots of doctors are starting cases just now. Try again in a minute.");
    const session = await withUsage(usage, async () => simulateCase({
      ready,
      userId: user.id,
      easy,
      hard,
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
      learning: body.learning,
      disease: body.disease,
      place,
      duel: duelId,
    })).finally(() => release?.().catch(() => undefined));
    usage.sessionId = session.state.sessionId;
    // A patient invented just now is kept for other doctors.
    if (!shared && !banked && !written && !stopgap && !busy && !tutorial && !daily && !place) {
      // Banked at once: it passed its reviews while being written, and a slow second opinion mustn't lose it. Taken out only if that finds it wrong.
      const invented = sessionInfo(session.token).src;
      after(async () => {
        const id = await bankCase(user.id, invented, { specialty: specialty, track: session.state.track, level: session.state.level, easy, country: user.country, lang: user.patientLang }).catch(() => undefined);
        const check = await checkCase(invented).catch(() => ({ status: "unchecked" as const, errors: [] }));
        if (check.status === "rejected" && id) {
          console.warn("[ramai] an invented case was taken out of the bank; the second opinion rejected it:", check.errors.join(" | ").slice(0, 400));
          await unbankCase(id).catch(() => undefined);
        }
      });
    }
    // A written case now means a new patient ready for next time.
    if (written || stopgap || busy) {
      after(() => withUsage({ kind: "case-start" }, () => prepareNext(user.id, choice, { allowedLevels: plan.levels, exclude, lang: user.patientLang } as never)).then(() => undefined).catch((err) => console.warn("[ramai] the next patient wasn't written:", err instanceof Error ? err.message : err)));
    }
    console.info(timingLine("/api/cases", timing, ["auth", "facts", "lookup", "rules", "llm_primary", "llm_fallback"], Date.now() - began));
    await bumpMe();
    if (host && duelId) await createDuel(duelId, host, { id: user.id, name: user.name || user.username || "Doctor" }, sessionInfo(session.token).src);
    // "Near me": the doctors chosen are asked to play the same patient.
    if (host === "invite" && duelId && body.invite?.length && !user.isGuest) await requestDuel(user, duelId, body.invite).catch(() => 0);
    await recordCaseStart(user.id, session.state.sessionId, tutorial, daily);
    // The same written patient again within the week won't count: said before it starts.
    const started = sessionInfo(session.token).src;
    if (started.kind !== "generated" && !session.state.unrated && (await db.get("SELECT 1 FROM results WHERE user_id = ? AND case_ref = ? AND created_at > ? LIMIT 1", user.id, started.id, Date.now() - 7 * 86_400_000).catch(() => null))) {
      session.state = { ...session.state, unrated: "repeat" };
    }
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
    // Said on screen, so a doctor who asked for one specialty knows why this is another.
    if (busy) return ok({ ...session, notice: "Lots of doctors are starting cases, so here's one ready now. Ask again in a minute for what you wanted." });
    return ok(stopgap && specialty ? { ...session, notice: `No ${specialty} patient is ready just now, so here's another. Yours is being written for your next case.` } : session);
  } catch (err) {
    return handleError(err);
  }
}
