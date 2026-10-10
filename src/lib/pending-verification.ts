/**
 * The sign-up waiting for its emailed code, kept in this tab only
 * (sessionStorage) — so a refresh doesn't lose it, and the email address
 * never goes into a URL.
 */
export interface PendingVerification {
  email: string;
  /** When the latest code was sent (0 if unknown — e.g. coming from the log-in page). */
  sentAt: number;
  /** Where to go once verified. */
  next: string;
}

const KEY = "ramai.verify";
const PREFILL = "ramai.signup.email";

export function savePending(p: PendingVerification) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

export function readPending(): PendingVerification | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as PendingVerification | null;
    return p && typeof p.email === "string" && p.email.includes("@") ? { email: p.email, sentAt: Number(p.sentAt) || 0, next: typeof p.next === "string" && p.next.startsWith("/") ? p.next : "/" } : null;
  } catch {
    return null;
  }
}

export function clearPending() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

/** An email to start the sign-up form with (an account from before the new sign-in). */
export function savePrefillEmail(email: string) {
  try {
    sessionStorage.setItem(PREFILL, email);
  } catch {}
}

export function takePrefillEmail(): string {
  try {
    const email = sessionStorage.getItem(PREFILL) ?? "";
    sessionStorage.removeItem(PREFILL);
    return email;
  } catch {
    return "";
  }
}
