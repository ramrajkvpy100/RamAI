/**
 * Browser-side client for the clinical engine.
 *
 * Mirrors the engine's public API, but every call goes through the backend —
 * the browser never sees a case definition or an API key. Errors are reduced
 * to user-safe messages; raw API errors are never shown (spec §36).
 */
import type { Country } from "@/engine/countries";
import type { CareLevel, CaseSession, CaseTrack, PatientLang, Specialty, TurnResponse } from "@/engine/types";

export const UNAVAILABLE_MESSAGE = "Clinical engine temporarily unavailable.";

/** Codes whose server message is written for players and safe to show. */
const SAFE_CODES = new Set(["BAD_INPUT", "BAD_SESSION", "CASE_CLOSED", "LIMIT", "RATE_LIMITED", "NO_CASES", "PRO_REQUIRED", "DAILY_LIMIT", "SIGNUP_REQUIRED", "UNAUTHENTICATED", "INVALID", "EXISTS", "BAD_REQUEST", "PAYMENTS_UNAVAILABLE", "PAYMENT_ERROR", "PAYMENT_UNVERIFIED", "COOLDOWN", "EMAIL_UNAVAILABLE", "LINK_EXPIRED", "VERIFY_REQUIRED"]);

export class ClinicalEngineError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable: boolean) {
    super(message);
    this.name = "ClinicalEngineError";
  }
}

async function call<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
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
    throw new ClinicalEngineError("NETWORK", UNAVAILABLE_MESSAGE, true);
  }
  const json = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  if (!res.ok) {
    const code = json?.error?.code ?? "ENGINE_UNAVAILABLE";
    const message = SAFE_CODES.has(code) && json?.error?.message ? json.error.message : UNAVAILABLE_MESSAGE;
    throw new ClinicalEngineError(code, message, code === "ENGINE_UNAVAILABLE" || code === "NETWORK" || code === "RATE_LIMITED");
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
  specialty?: Specialty;
  track?: CaseTrack;
  level?: CareLevel;
}

export const simulateCase = (choice: CaseChoice) => call<CaseSession>("/api/cases", choice);
export const submitDoctorAction = (token: string, input: string) => call<TurnResponse>("/api/cases/turn", { token, input });
export const resumeCase = (token: string) => call<CaseSession>("/api/cases/resume", { token });
export const getLibrary = () => call<LibraryInfo>("/api/cases/library");

/* Convenience wrappers — all are natural-language actions underneath. */
export const orderInvestigation = (token: string, investigation: string) => submitDoctorAction(token, `Order ${investigation}`);
export const executeTreatment = (token: string, order: string) => submitDoctorAction(token, order);
export const advanceTime = (token: string, minutes: number) => submitDoctorAction(token, `Wait ${minutes} minutes`);
export const closeCase = (token: string, finalDiagnosis?: string) =>
  submitDoctorAction(token, finalDiagnosis ? `Final diagnosis: ${finalDiagnosis}. Case close.` : "Case close.");

/* Accounts & billing ------------------------------------------------------- */
export const signup = (body: { name: string; username: string; email: string; password: string; country?: Country }) => call<{ user: unknown }>("/api/auth/signup", body);
export const login = (body: { login: string; password: string }) => call<{ user: unknown }>("/api/auth/login", body);
export const logout = () => call<{ ok: true }>("/api/auth/logout", {});
export const checkout = (period: "monthly" | "yearly") => call<{ mode: "demo" } | { mode: "razorpay"; order: { orderId: string; amount: number; currency: string; keyId: string; name: string; email: string } }>("/api/billing/checkout", { period });
export const verifyPayment = (body: { orderId: string; paymentId: string; signature: string }) => call<{ ok: true }>("/api/billing/verify", body);
export const demoUpgrade = () => call<{ ok: true }>("/api/billing/demo-upgrade", {});
export const startGuest = (country?: Country) => call<{ user: { id: string } }>("/api/auth/guest", country ? { country } : {});
export const requestVerification = () => call<{ sent: boolean; verified?: boolean; devLink?: string }>("/api/auth/verification", {});
export const forgotPassword = (email: string) => call<{ ok: true }>("/api/auth/forgot", { email });
export const resetPassword = (token: string, password: string) => call<{ user: unknown }>("/api/auth/reset", { token, password });

/* Preferences --------------------------------------------------------------- */
export const updateSettings = (body: { patientLang?: PatientLang; country?: Country }) => call<unknown>("/api/me/settings", body);
