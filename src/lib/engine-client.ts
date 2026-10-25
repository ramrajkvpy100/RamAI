/**
 * Browser-side client for the clinical engine.
 *
 * Mirrors the engine's public API, but every call goes through the backend —
 * the browser never sees a case definition or an API key. Errors are reduced
 * to user-safe messages; raw API errors are never shown (spec §36).
 */
import type { Country } from "@/engine/countries";
import type { CareLevel, CaseDebrief, CaseSession, CaseTrack, LearnPack, PatientLang, Specialty, TurnResponse } from "@/engine/types";

import type { PreferredSpecialty } from "./specialty";

export const UNAVAILABLE_MESSAGE = "Clinical engine temporarily unavailable.";

/** Codes whose server message is written for players and safe to show. */
const SAFE_CODES = new Set(["INVITE", "BAD_INPUT", "BAD_SESSION", "CASE_CLOSED", "NOT_CLOSED", "LIMIT", "RATE_LIMITED", "NO_CASES", "PRO_REQUIRED", "DAILY_LIMIT", "SIGNUP_REQUIRED", "UNAUTHENTICATED", "INVALID", "EXISTS", "BAD_REQUEST", "PAYMENTS_UNAVAILABLE", "PAYMENT_ERROR", "PAYMENT_UNVERIFIED", "PAYMENT_PENDING", "PAYMENT_AUTH", "BAD_AMOUNT", "INTERNATIONAL_UNAVAILABLE", "GUEST", "UNAVAILABLE", "EXAMS_UNAVAILABLE", "NOT_FOUND", "COOLDOWN", "EMAIL_UNAVAILABLE", "LINK_EXPIRED", "VERIFY_REQUIRED", "DAILY_DONE", "CODE_INVALID", "LEGACY_ACCOUNT", "SIGNUP_CLOSED", "AUTH_UNAVAILABLE"]);

export class ClinicalEngineError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable: boolean) {
    super(message);
    this.name = "ClinicalEngineError";
  }
}

/** Turns are safe to send twice (the case lives in the token), so a failed one is quietly tried once more. */
const RETRIED = new Set(["/api/cases/turn", "/api/cases/tick", "/api/cases/resume"]);

async function call<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await callOnce<T>(path, body, signal);
    } catch (err) {
      if (attempt >= 2 || !RETRIED.has(path) || signal?.aborted || !(err instanceof ClinicalEngineError) || (err.code !== "NETWORK" && err.code !== "ENGINE_UNAVAILABLE")) throw err;
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
}

async function callOnce<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch {
    throw new ClinicalEngineError("NETWORK", `${UNAVAILABLE_MESSAGE} (no connection)`, true);
  }
  const json = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string; ref?: string } } | null;
  if (!res.ok) {
    const code = json?.error?.code ?? "ENGINE_UNAVAILABLE";
    // The status code, so a report of the problem says what it was (never the server's own words).
    const message = SAFE_CODES.has(code) && json?.error?.message ? json.error.message : `${UNAVAILABLE_MESSAGE} (code ${res.status}${json?.error?.ref && /^[a-z]{2,8}$/.test(json.error.ref) ? ` · ${json.error.ref}` : ""})`;
    throw new ClinicalEngineError(code, message, code === "ENGINE_UNAVAILABLE" || code === "NETWORK" || code === "RATE_LIMITED" || code === "AUTH_UNAVAILABLE");
  }
  return json as T;
}

export interface LibraryInfo {
  engine: "mock" | "openai";
  specialties: Partial<Record<Specialty, number>>;
  tracks: Partial<Record<CaseTrack, number>>;
  levels: Partial<Record<CareLevel, number>>;
}

export interface CaseChoice {
  /** The guided demo case. */
  tutorial?: boolean;
  /** Today's daily case. */
  daily?: boolean;
  /** "any": every specialty this time, whatever the doctor's own. */
  specialty?: Specialty | "any";
  track?: CaseTrack;
  level?: CareLevel;
  /** "All resources": every test and treatment available. */
  unlimited?: boolean;
  /** Easy (very easy, classic), medium or hard. */
  difficulty?: "easy" | "medium" | "hard";
  /** A disease to practise. */
  disease?: string;
  /** The same patient again: the finished case's token. */
  retry?: string;
  /** Two-player: "invite", "find", "computer", or a duel id to join. */
  duel?: string;
}

export const simulateCase = (choice: CaseChoice) => call<CaseSession>("/api/cases", choice);
export const submitDoctorAction = (token: string, input: string) => call<TurnResponse>("/api/cases/turn", { token, input });
/** Real-time mode: one minute of case time passes. */
export const tickCase = (token: string) => call<TurnResponse>("/api/cases/tick", { token });
export const resumeCase = (token: string) => call<CaseSession>("/api/cases/resume", { token });
export const getLibrary = () => call<LibraryInfo>("/api/cases/library");

/* Convenience wrappers — all are natural-language actions underneath. */
export const orderInvestigation = (token: string, investigation: string) => submitDoctorAction(token, `Order ${investigation}`);
export const executeTreatment = (token: string, order: string) => submitDoctorAction(token, order);
export const advanceTime = (token: string, minutes: number) => submitDoctorAction(token, `Wait ${minutes} minutes`);
export const closeCase = (token: string, finalDiagnosis?: string) =>
  submitDoctorAction(token, finalDiagnosis ? `Final diagnosis: ${finalDiagnosis}. Case close.` : "Case close.");

/* Accounts & billing ------------------------------------------------------- */
/** Supabase emails a six-digit code; the account opens once it's entered (verifyCode). */
export const signup = (body: { name: string; username: string; email: string; password: string; country?: Country; acceptTerms: true }) =>
  call<{ status: "verify"; email: string } | { status: "signed-in"; user: unknown }>("/api/auth/signup", body);
export const verifyCode = (email: string, code: string) => call<{ user: unknown }>("/api/auth/verify", { email, code });
/** The code in a confirmation link (Supabase's default email template). */
export const confirmLink = (code: string) => call<{ user: unknown }>("/api/auth/verify", { code });
export const googleSignIn = (credential: string, nonce: string) => call<{ user: unknown }>("/api/auth/google/token", { credential, nonce });
/** After the case: pearls and exam-style questions; marking one answer; the AI's feedback in words. */
export const fetchLearn = (token: string) => call<{ pack: LearnPack | null }>("/api/cases/learn", { token });
export const answerMcq = (token: string, q: number, choice: number) => call<{ correct: boolean; answer: number }>("/api/cases/learn/answer", { token, q, choice });
export const fetchCoach = (token: string) => call<{ coach: CaseDebrief["coach"] | null }>("/api/cases/coach", { token });
export const resendCode = (email: string) => call<{ ok: true; cooldown: number }>("/api/auth/resend", { email });
export const login = (body: { login: string; password: string }) => call<{ user: unknown }>("/api/auth/login", body);
export const logout = () => call<{ ok: true }>("/api/auth/logout", {});
export const deleteAccount = (password?: string) => call<{ ok: true }>("/api/me/delete", password ? { password } : {});
export interface CheckoutOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  mode: "test" | "live";
  description: string;
  name: string;
  email: string;
}
export const checkout = (period: "monthly" | "yearly", startNow: true) => call<{ mode: "demo" } | { mode: "razorpay"; order: CheckoutOrder }>("/api/billing/checkout", { period, startNow });
export const verifyPayment = (body: { orderId: string; paymentId: string; signature: string }) => call<{ status: "paid" }>("/api/billing/verify", body);
export const orderStatus = (orderId: string) => call<{ status: "created" | "paid" | "failed" | "refunded" }>("/api/billing/status", { orderId });
export interface DonationOrder {
  orderId: string;
  amount: number;
  currency: "INR";
  keyId: string;
  mode: "test" | "live";
}
export const donate = (body: { rupees: number; name?: string; message?: string }) => call<{ order: DonationOrder }>("/api/donate", body);
export const verifyDonation = (body: { orderId: string; paymentId: string; signature: string }) => call<{ status: "paid" }>("/api/donate/verify", body);
export const demoUpgrade = () => call<{ ok: true }>("/api/billing/demo-upgrade", {});
/** Asks the server to write the next patient ahead of time (fire and forget). */
export const prepareCase = () => call<{ status: string }>("/api/cases/prepare", {});
export const startGuest = (country?: Country) => call<{ user: { id: string; specialty?: string | null } }>("/api/auth/guest", country ? { country } : {});
export const forgotPassword = (email: string) => call<{ ok: true }>("/api/auth/forgot", { email });
/** The new password, with the proof from the reset link: its token hash, or Supabase's PKCE code. */
export const resetPassword = (body: { password: string; tokenHash?: string; code?: string }) => call<{ user: unknown }>("/api/auth/reset", body);

/* Preferences --------------------------------------------------------------- */
export const updateSettings = (body: { patientLang?: PatientLang; country?: Country; specialty?: PreferredSpecialty }) => call<unknown>("/api/me/settings", body);

export interface DailyInfo {
  dayKey: string;
  number: number;
  endsAt: number;
  track: CaseTrack;
  level: CareLevel;
  started: boolean;
  me: { position: number; score: number; minutes: number; grid: string | null } | null;
  top: { position: number; userId: string; name: string; username: string; score: number; minutes: number }[];
  total: number;
}

export async function fetchDaily(): Promise<DailyInfo | null> {
  const res = await fetch("/api/daily", { cache: "no-store" }).catch(() => null);
  return res?.ok ? ((await res.json()) as DailyInfo) : null;
}

/* Exam practice -------------------------------------------------------------- */

export const examSet = (exam: string, subject: string, style: "pyq" | "concept" = "pyq") => call<{ set: import("./exams").ExamSet }>("/api/exams/set", { exam, subject, style });
export const examAnswer = (setId: string, q: number, choice: number) => call<{ correct: boolean; answer: number; explanation: string }>("/api/exams/answer", { setId, q, choice });
