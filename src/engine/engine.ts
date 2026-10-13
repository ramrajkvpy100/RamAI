/**
 * RamAI engine — the public, server-side simulation API.
 *
 *   simulateCase()        start a case
 *   submitDoctorAction()  free-text turn (history, exam, orders, treatment…)
 *   getPatientResponse()  the patient's answer to a history intent
 *   orderInvestigation()  convenience wrapper → submitDoctorAction
 *   executeTreatment()    convenience wrapper → submitDoctorAction
 *   advanceTime()         convenience wrapper → submitDoctorAction
 *   closeCase()           convenience wrapper → submitDoctorAction
 *   generateDebrief()     teaching + score after closure
 *   calculateScore()      the /100 rubric
 *
 * Presentation never imports this module; the browser talks to it through
 * /api/cases/* (see src/lib/engine-client.ts).
 */
import "server-only";

import { randomUUID } from "node:crypto";

import type { ClinicalCaseDefinition } from "./case-definition";
import type { Country } from "./countries";
import { generateDebrief } from "./debrief";
import { localizeCase, presentDebrief, presentEffects, presentState } from "./i18n/country";
import { localizeEffects, localizeState } from "./i18n/hinglish";
import { getProvider } from "./providers";
import type { ClinicalProvider, TeachingPack } from "./providers/types";
import { applyEffects, createInitialState } from "./reducer";
import { seal, SessionError, unseal, type SessionPayload } from "./session";
import { dailyCase, TUTORIAL_CASE } from "./cases";
import { createHiddenState, examPicture, imagingPicture, isTick, openingEffects, runTurn, type HiddenState } from "./simulator";
import { NoCaseError } from "./providers/mock";
import type { ActionRecord, Auscultation, CareLevel, CaseDebrief, CaseSession, CaseState, CaseTrack, LearnPack, PatientLang, Specialty, TurnEffect, TurnResponse } from "./types";

export const MAX_INPUT_LENGTH = 1000;
export const MAX_ACTIONS = 300;
/** Real-time ticks don't use up the player's actions, but a case can't grow forever. */
export const MAX_RECORDS = 1200;
/** Real-time mode: one minute of case time per tick. */
export const TICK_MINUTES = 1;

export type EngineErrorCode = "BAD_INPUT" | "BAD_SESSION" | "CASE_CLOSED" | "NOT_CLOSED" | "LIMIT" | "NO_CASES";

export class EngineError extends Error {
  constructor(public readonly code: EngineErrorCode, message: string) {
    super(message);
    this.name = "EngineError";
  }
}

interface Rebuilt {
  def: ClinicalCaseDefinition;
  hidden: HiddenState;
  state: CaseState;
  country: Country;
}

/** Where an invented case's debrief teaching is kept once the case closes: on its closing action. */
const TEACH_KEY = "teach";

function storedTeaching(payload: SessionPayload): TeachingPack | undefined {
  for (let i = payload.a.length - 1; i >= 0; i--) {
    const raw = payload.a[i]!.generated?.[TEACH_KEY];
    if (!raw) continue;
    try {
      return JSON.parse(raw) as TeachingPack;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** An invented case with its teaching and misses filled in. */
function withTeaching(def: ClinicalCaseDefinition, pack: TeachingPack | undefined): ClinicalCaseDefinition {
  if (!pack) return def;
  return { ...def, teaching: { ...pack.teaching, treatmentByBand: {} } as ClinicalCaseDefinition["teaching"], rubric: { ...def.rubric, misses: pack.misses, strengths: pack.strengths } };
}

/** Deterministically rebuilds hidden and visible state from a sealed payload. */
function rebuild(payload: SessionPayload, provider: ClinicalProvider): Rebuilt {
  const country = payload.c ?? "IN";
  const def = localizeCase(withTeaching(provider.resolveCase(payload.src), storedTeaching(payload)), country);
  const hidden = createHiddenState(def);
  let state = createInitialState({
    sessionId: payload.sid,
    caseNumber: payload.n,
    briefing: def.briefing,
    track: def.track,
    level: def.level,
    setting: def.setting,
    patient: def.patient,
    arrivalMinuteOfDay: def.arrivalMinuteOfDay,
    specialty: payload.sp,
    guided: def.guided,
  });
  state = applyEffects(state, openingEffects(def, hidden));
  for (const record of payload.a) state = applyEffects(state, runTurn(def, hidden, record));
  if (hidden.closed) state = { ...state, specialty: def.specialty };
  if (payload.d) state = { ...state, daily: payload.d };
  return { def, hidden, state, country };
}

/** Hinglish is how patients speak in India; elsewhere they speak English. */
const speechIn = (country: Country, lang: PatientLang): PatientLang => (country === "IN" ? lang : "en");

/** What the player sees: the patient's language, then the country's units, money and names. */
function render(state: CaseState, def: ClinicalCaseDefinition, country: Country, lang: PatientLang): CaseState {
  return withoutSoundParams(presentState(localizeState(state, def.id, speechIn(country, lang)), country));
}

/**
 * The stethoscope's sound parameters stay on the server: the browser only
 * learns where it was placed, and fetches the sound itself (stethoscopeSounds).
 */
function withoutSoundParams(state: CaseState): CaseState {
  if (!state.messages.some((m) => m.sounds)) return state;
  return { ...state, messages: state.messages.map(({ sounds: _hidden, ...m }) => m) };
}
const effectsForPlayer = (effects: TurnEffect[]): TurnEffect[] =>
  effects.map((e) => (e.type === "message" && e.sounds ? (({ sounds: _hidden, ...m }) => m)(e) : e));

/** The sounds a stethoscope message plays — rendered to audio on the server, never sent as parameters. */
export async function stethoscopeSounds(token: string, userId: string, messageId: string): Promise<Auscultation[] | null> {
  const payload = open(token, userId);
  const { state } = rebuild(payload, await getProvider());
  return state.messages.find((m) => m.id === messageId)?.sounds ?? null;
}

function open(token: string, userId: string): SessionPayload {
  let payload: SessionPayload;
  try {
    payload = unseal(token);
  } catch (err) {
    if (err instanceof SessionError) throw new EngineError("BAD_SESSION", err.message);
    throw err;
  }
  if (payload.u !== userId) throw new EngineError("BAD_SESSION", "This case belongs to another account.");
  return payload;
}

export interface StartCaseOptions {
  userId: string;
  caseNumber: number;
  specialty?: Specialty;
  track?: CaseTrack;
  level?: CareLevel;
  allowedLevels?: readonly CareLevel[];
  exclude?: string[];
  /** Language patient and family speak; English when omitted. */
  lang?: PatientLang;
  /** The guided demo case instead of a pick from the library. */
  tutorial?: boolean;
  /** A newcomer: an easy, classic case. */
  easy?: boolean;
  /** Where the player practises; fixed for the life of the case. */
  country?: Country;
  /** Today's daily case (IST day key) instead of a pick from the library. */
  daily?: string;
}

export async function simulateCase(opts: StartCaseOptions): Promise<CaseSession> {
  const provider = await getProvider();
  let src;
  try {
    src = opts.tutorial
      ? ({ kind: "library", id: TUTORIAL_CASE.id } as const)
      : opts.daily
        ? ({ kind: "library", id: dailyCase(opts.daily).id } as const)
        : await provider.createCase(opts);
  } catch (err) {
    if (err instanceof NoCaseError) throw new EngineError("NO_CASES", err.message);
    throw err;
  }
  const country = opts.country ?? "IN";
  const payload: SessionPayload = { v: 1, sid: randomUUID(), u: opts.userId, n: opts.caseNumber, sp: opts.specialty, src, a: [], t: Date.now(), ...(country !== "IN" && { c: country }), ...(opts.daily && { d: opts.daily }) };
  const { def, state } = rebuild(payload, provider);
  return { token: seal(payload), state: render(state, def, country, opts.lang ?? "en") };
}

/**
 * The library reference and owner of a sealed session (server use only).
 * `learnKey`: where its pearls and questions are kept — an invented case's
 * with the session; a written case's once per country, for everyone.
 */
export function sessionInfo(token: string): { sessionId: string; userId: string; daily?: string; generated: boolean; learnKey: string } {
  const p = unseal(token);
  return { sessionId: p.sid, userId: p.u, daily: p.d, generated: p.src.kind === "generated", learnKey: p.src.kind === "generated" ? p.sid : `library:${p.src.id}:${p.c ?? "IN"}` };
}

/**
 * Clinical pearls and exam-style questions on the case. Only once it's closed —
 * they name the diagnosis — except `early`, for writing them in the background
 * while an invented case is played (kept on the server until the case ends).
 */
export async function learnFor(token: string, userId: string, opts: { early?: boolean } = {}): Promise<LearnPack | undefined> {
  const provider = await getProvider();
  if (!provider.learn) return undefined;
  const payload = open(token, userId);
  const { def, hidden, country } = rebuild(payload, provider);
  if (!hidden.closed && !opts.early) throw new EngineError("NOT_CLOSED", "Finish the case first.");
  return provider.learn(def, country);
}

/** Whether the doctor has ended this case — before then nothing that names the diagnosis is handed out. */
export async function caseClosed(token: string, userId: string): Promise<boolean> {
  return rebuild(open(token, userId), await getProvider()).hidden.closed;
}

/** The debrief's feedback in words, written by the model once the case has ended (the score never depends on it). */
export async function coachFor(token: string, userId: string): Promise<CaseDebrief["coach"]> {
  const provider = await getProvider();
  if (!provider.feedback) return undefined;
  const payload = open(token, userId);
  const { def, hidden, state, country } = rebuild(payload, provider);
  if (!hidden.closed) throw new EngineError("NOT_CLOSED", "Finish the case first.");
  const stored = storedCoach(payload);
  if (stored) return stored;
  return provider.feedback({ def, hidden, transcript: state.messages, debrief: generateDebrief(def, hidden, state), country });
}

/** An invented case's debrief teaching, written while it's being played (server use: stored with the case). */
export async function teachingFor(token: string, userId: string): Promise<TeachingPack | undefined> {
  const provider = await getProvider();
  const payload = open(token, userId);
  if (payload.src.kind !== "generated" || !provider.teach) return undefined;
  return provider.teach(provider.resolveCase(payload.src));
}

/**
 * What an AI picture should show — only once the case has reached it (the
 * finding examined, the test resulted), so nothing can be seen early.
 */
export async function pictureFor(token: string, userId: string, ref: string): Promise<(NonNullable<ClinicalCaseDefinition["pictures"]>[string] & { topic: string }) | null> {
  const payload = open(token, userId);
  const { def, hidden, state } = rebuild(payload, await getProvider());
  // The diagnosis stays on the server: it only helps find a real image when a drawn one isn't good enough.
  const topic = def.truth.diagnosis;
  // Every scan, drawn from its own result; a written case's skin photograph, from its examination.
  if (ref.startsWith("i-")) {
    const inv = hidden.investigations.find((i) => i.delivered && `i-${i.instanceId}` === ref);
    const picture = inv ? imagingPicture(def, inv) : null;
    return picture && { ...picture, topic };
  }
  if (ref.startsWith("e-")) {
    const picture = examPicture(def, hidden, ref);
    return picture && { ...picture, topic };
  }
  const picture = def.pictures?.[ref];
  if (!picture) return null;
  const reached = state.messages.some((m) => m.media?.ai?.ref === ref) || state.investigations.some((i) => i.media?.ai?.ref === ref);
  return reached ? { ...picture, topic } : null;
}

/** Where the debrief's feedback in words is kept: on the closing action, so reopening a case never asks the model again. */
const COACH_KEY = "coach";

function storedCoach(payload: SessionPayload): CaseDebrief["coach"] {
  for (let i = payload.a.length - 1; i >= 0; i--) {
    const raw = payload.a[i]!.generated?.[COACH_KEY];
    if (!raw) continue;
    try {
      return JSON.parse(raw) as CaseDebrief["coach"];
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Re-renders a session; also how a language switch takes effect mid-case. */
export async function resumeCase(token: string, userId: string, lang: PatientLang = "en", kept?: CaseDebrief["coach"]): Promise<CaseSession> {
  const provider = await getProvider();
  const payload = open(token, userId);
  const { def, hidden, state, country } = rebuild(payload, provider);
  // The feedback in words: on the closing action (older cases), or kept with the case on the server.
  const coach = hidden.closed ? (storedCoach(payload) ?? kept) : undefined;
  return { token, state: render(state, def, country, lang), debrief: hidden.closed ? presentDebrief({ ...generateDebrief(def, hidden, state), ...(coach ? { coach } : {}) }, country) : undefined };
}

export async function submitDoctorAction(token: string, input: string, userId: string, lang: PatientLang = "en", teaching?: TeachingPack): Promise<TurnResponse> {
  const text = input.replace(/\s+$/g, "").replace(/^\s+/g, "");
  if (!text) throw new EngineError("BAD_INPUT", "Say or order something.");
  if (text.length > MAX_INPUT_LENGTH) throw new EngineError("BAD_INPUT", "That instruction is too long.");

  const provider = await getProvider();
  const payload = open(token, userId);
  if (payload.a.filter((r) => !isTick(r)).length >= MAX_ACTIONS || payload.a.length >= MAX_RECORDS) {
    throw new EngineError("LIMIT", "This case has reached its action limit. Close the case to review it.");
  }

  const { def, hidden, state, country } = rebuild(payload, provider);
  if (hidden.closed) throw new EngineError("CASE_CLOSED", "This case is already closed.");

  const interpretation = await provider.interpret(text, { def, hidden, transcript: state.messages.slice(-12), country, lang });
  const record: ActionRecord = {
    id: `a${payload.a.length + 1}`,
    at: hidden.clock,
    raw: text,
    intents: interpretation.intents,
    generated: interpretation.generated,
  };
  const effects = runTurn(def, hidden, record);
  let next = applyEffects(state, effects);
  payload.a.push(record);

  let debrief: CaseDebrief | undefined;
  if (hidden.closed) {
    next = { ...next, specialty: def.specialty };
    // An invented case's teaching: written in the background while it was played, or now if that didn't finish.
    let full = def;
    if (payload.src.kind === "generated" && !storedTeaching(payload)) {
      const pack = teaching ?? (provider.teach ? await provider.teach(provider.resolveCase(payload.src)) : undefined);
      if (pack) {
        record.generated = { ...record.generated, [TEACH_KEY]: JSON.stringify(pack) };
        full = localizeCase(withTeaching(provider.resolveCase(payload.src), pack), country);
      }
    }
    // The score and the debrief come at once; the feedback in words follows from coachFor() — no waiting on the model here.
    debrief = presentDebrief(generateDebrief(full, hidden, next), country);
  }
  const shown = speechIn(country, lang);
  return {
    token: seal(payload),
    state: render(next, def, country, lang),
    effects: effectsForPlayer(presentEffects(localizeEffects(effects, def.id, def.patient, shown), country)),
    debrief,
  };
}

/**
 * Real-time mode: the clock moves on while the player thinks. The minute is
 * recorded like any action, so the case replays exactly.
 */
export async function advanceRealTime(token: string, userId: string, lang: PatientLang = "en"): Promise<TurnResponse> {
  const provider = await getProvider();
  const payload = open(token, userId);
  if (payload.a.length >= MAX_RECORDS) throw new EngineError("LIMIT", "This case has run for too long. Close it to review it.");
  const { def, hidden, state, country } = rebuild(payload, provider);
  if (hidden.closed) throw new EngineError("CASE_CLOSED", "This case is already closed.");
  const record: ActionRecord = {
    id: `a${payload.a.length + 1}`,
    at: hidden.clock,
    raw: "",
    intents: [{ kind: "wait", phrase: "", matched: true, payload: { minutes: TICK_MINUTES, silent: true } }],
  };
  const effects = runTurn(def, hidden, record);
  const next = applyEffects(state, effects);
  payload.a.push(record);
  const shown = speechIn(country, lang);
  return { token: seal(payload), state: render(next, def, country, lang), effects: effectsForPlayer(presentEffects(localizeEffects(effects, def.id, def.patient, shown), country)) };
}

/* Convenience wrappers — every action is natural language underneath. */
export const orderInvestigation = (token: string, investigation: string, userId: string) => submitDoctorAction(token, `Order ${investigation}`, userId);
export const executeTreatment = (token: string, order: string, userId: string) => submitDoctorAction(token, order, userId);
export const advanceTime = (token: string, minutes: number, userId: string) => submitDoctorAction(token, `Wait ${Math.max(1, Math.round(minutes))} minutes`, userId);
export const closeCase = (token: string, userId: string, finalDiagnosis?: string) =>
  submitDoctorAction(token, finalDiagnosis ? `Final diagnosis: ${finalDiagnosis}. Case close.` : "Case close.", userId);

export async function caseAvailability(country: Country = "IN") {
  const provider = await getProvider();
  return { engine: provider.id, ...(await provider.availability(country)) };
}

export { getPatientResponse } from "./simulator";
export { generateDebrief } from "./debrief";
export { calculateScore } from "./scoring";
