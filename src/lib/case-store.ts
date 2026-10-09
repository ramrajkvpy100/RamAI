"use client";

/**
 * The active-case store — shared by every screen.
 *
 * Holds the sealed session token and the revealed state returned by the
 * server, persisted per user so a refresh resumes the case. The server
 * re-validates the token (and its owner) on resume.
 */
import { useSyncExternalStore } from "react";

import type { Country } from "@/engine/countries";
import type { CaseDebrief, CaseRewards, CaseState, PatientLang, TurnEffect } from "@/engine/types";

import { ClinicalEngineError, resumeCase, simulateCase, submitDoctorAction, UNAVAILABLE_MESSAGE, updateSettings, type CaseChoice } from "./engine-client";
import { primeMe, refreshMe, type Me } from "./me-store";
import { readJSON, writeJSON } from "./storage";

export interface ActiveSession {
  token: string;
  state: CaseState;
  debrief?: CaseDebrief;
  rewards?: CaseRewards;
  /** The player has dismissed the briefing and entered the encounter. */
  begun: boolean;
}

export interface CaseError {
  code: string;
  message: string;
  retryable: boolean;
  action?: { kind: "start"; choice: CaseChoice } | { kind: "send"; input: string };
}

export interface CaseSnapshot {
  hydrated: boolean;
  userId: string | null;
  session: ActiveSession | null;
  starting: boolean;
  sending: { input: string } | null;
  error: CaseError | null;
  lastEffects: TurnEffect[];
  turn: number;
}

let snapshot: CaseSnapshot = { hydrated: false, userId: null, session: null, starting: false, sending: null, error: null, lastEffects: [], turn: 0 };
const listeners = new Set<() => void>();
const key = () => (snapshot.userId ? `ramai.session.${snapshot.userId}` : null);

function update(patch: Partial<CaseSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  const k = key();
  if ("session" in patch && k) writeJSON(k, snapshot.session);
  for (const l of listeners) l();
}

function toError(err: unknown, action?: CaseError["action"]): CaseError {
  if (err instanceof ClinicalEngineError) return { code: err.code, message: err.message, retryable: err.retryable, action };
  return { code: "UNKNOWN", message: UNAVAILABLE_MESSAGE, retryable: true, action };
}

export function hydrate(userId: string) {
  if (typeof window === "undefined") return;
  if (snapshot.hydrated && snapshot.userId === userId) return;
  snapshot = { ...snapshot, userId, hydrated: true, session: null, error: null };
  const stored = readJSON<ActiveSession>(`ramai.session.${userId}`);
  update({ session: stored?.token && stored.state ? stored : null });
  if (stored?.token) {
    resumeCase(stored.token)
      .then((s) => {
        if (snapshot.session?.token === stored.token) update({ session: { ...stored, token: s.token, state: s.state, debrief: s.debrief } });
      })
      .catch((err) => {
        if (err instanceof ClinicalEngineError && (err.code === "BAD_SESSION" || err.code === "UNAUTHENTICATED")) update({ session: null });
      });
  }
}

export async function startCase(choice: CaseChoice = {}): Promise<boolean> {
  if (snapshot.starting) return false;
  update({ starting: true, error: null });
  try {
    const session = await simulateCase(choice);
    update({ session: { ...session, begun: false }, starting: false, sending: null, lastEffects: [], turn: 0 });
    void refreshMe();
    return true;
  } catch (err) {
    update({ starting: false, error: toError(err, { kind: "start", choice }) });
    return false;
  }
}

export function beginEncounter() {
  if (snapshot.session) update({ session: { ...snapshot.session, begun: true } });
}

export async function send(input: string): Promise<boolean> {
  const session = snapshot.session;
  const text = input.trim();
  if (!session || !text || snapshot.sending || session.debrief) return false;
  update({ sending: { input: text }, error: null });
  try {
    const res = await submitDoctorAction(session.token, text);
    update({ session: { token: res.token, state: res.state, debrief: res.debrief, rewards: res.rewards, begun: true }, sending: null, lastEffects: res.effects, turn: snapshot.turn + 1 });
    if (res.debrief) void refreshMe();
    return true;
  } catch (err) {
    const error = toError(err, { kind: "send", input: text });
    update({ sending: null, error });
    if (error.code === "BAD_SESSION") update({ session: null });
    return false;
  }
}

export async function retry() {
  const action = snapshot.error?.action;
  if (!action) return update({ error: null });
  if (action.kind === "start") return void startCase(action.choice);
  return void send(action.input);
}

/**
 * Saves the patient-language preference and, if a case is open, re-renders it
 * in that language (the server replays the case, so nothing is lost).
 */
export async function setPatientLanguage(lang: PatientLang): Promise<boolean> {
  try {
    const me = (await updateSettings({ patientLang: lang })) as Me;
    if (me?.user) primeMe(me);
  } catch {
    return false;
  }
  const session = snapshot.session;
  if (!session) return true;
  try {
    const s = await resumeCase(session.token);
    if (snapshot.session?.token === session.token) update({ session: { ...snapshot.session, state: s.state } });
  } catch {
    /* the next turn renders in the new language anyway */
  }
  return true;
}

/** Where the player practises. An open case keeps the country it started in; the next one follows the new choice. */
export async function setPracticeCountry(country: Country): Promise<boolean> {
  try {
    const me = (await updateSettings({ country })) as Me;
    if (me?.user) primeMe(me);
    return true;
  } catch {
    return false;
  }
}

export function dismissError() {
  update({ error: null });
}

export function abandonCase() {
  update({ session: null, sending: null, error: null, lastEffects: [], turn: 0 });
}

/** The current snapshot, outside React (e.g. right after an awaited action). */
export const caseSnapshot = () => snapshot;

const SERVER: CaseSnapshot = { ...snapshot };

export function useCase(): CaseSnapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => SERVER,
  );
}
