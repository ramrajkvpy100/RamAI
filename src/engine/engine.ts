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
import type { ClinicalProvider } from "./providers/types";
import { applyEffects, createInitialState } from "./reducer";
import { seal, SessionError, unseal, type SessionPayload } from "./session";
import { dailyCase, TUTORIAL_CASE } from "./cases";
import { createHiddenState, openingEffects, runTurn, type HiddenState } from "./simulator";
import { NoCaseError } from "./providers/mock";
import type { ActionRecord, CareLevel, CaseDebrief, CaseSession, CaseState, CaseTrack, PatientLang, Specialty, TurnResponse } from "./types";

export const MAX_INPUT_LENGTH = 1000;
export const MAX_ACTIONS = 300;

export type EngineErrorCode = "BAD_INPUT" | "BAD_SESSION" | "CASE_CLOSED" | "LIMIT" | "NO_CASES";

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

/** Deterministically rebuilds hidden and visible state from a sealed payload. */
function rebuild(payload: SessionPayload, provider: ClinicalProvider): Rebuilt {
  const country = payload.c ?? "IN";
  const def = localizeCase(provider.resolveCase(payload.src), country);
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
  return presentState(localizeState(state, def.id, speechIn(country, lang)), country);
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

/** The library reference and owner of a sealed session (server use only). */
export function sessionInfo(token: string): { sessionId: string; userId: string; daily?: string } {
  const p = unseal(token);
  return { sessionId: p.sid, userId: p.u, daily: p.d };
}

/** Re-renders a session; also how a language switch takes effect mid-case. */
export async function resumeCase(token: string, userId: string, lang: PatientLang = "en"): Promise<CaseSession> {
  const provider = await getProvider();
  const payload = open(token, userId);
  const { def, hidden, state, country } = rebuild(payload, provider);
  return { token, state: render(state, def, country, lang), debrief: hidden.closed ? presentDebrief(generateDebrief(def, hidden, state), country) : undefined };
}

export async function submitDoctorAction(token: string, input: string, userId: string, lang: PatientLang = "en"): Promise<TurnResponse> {
  const text = input.replace(/\s+$/g, "").replace(/^\s+/g, "");
  if (!text) throw new EngineError("BAD_INPUT", "Say or order something.");
  if (text.length > MAX_INPUT_LENGTH) throw new EngineError("BAD_INPUT", "That instruction is too long.");

  const provider = await getProvider();
  const payload = open(token, userId);
  if (payload.a.length >= MAX_ACTIONS) throw new EngineError("LIMIT", "This case has reached its action limit. Close the case to review it.");

  const { def, hidden, state, country } = rebuild(payload, provider);
  if (hidden.closed) throw new EngineError("CASE_CLOSED", "This case is already closed.");

  const interpretation = await provider.interpret(text, { def, hidden, transcript: state.messages.slice(-12), country });
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
    debrief = presentDebrief(generateDebrief(def, hidden, next), country);
  }
  const shown = speechIn(country, lang);
  return {
    token: seal(payload),
    state: render(next, def, country, lang),
    effects: presentEffects(localizeEffects(effects, def.id, def.patient, shown), country),
    debrief,
  };
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
