/**
 * Outgoing email.
 *
 *   RAMAI_EMAIL_PROVIDER=resend + RESEND_API_KEY   → delivered through Resend
 *   (anything else)                                → saved to data/outbox and
 *                                                    printed in the server log
 *
 * The outbox lets the whole sign-up / reset flow be tried locally without an
 * email account. Configure a provider before real users sign up.
 */
import "server-only";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type Delivery = "live" | "outbox";

export function emailDelivery(): Delivery {
  return process.env.RAMAI_EMAIL_PROVIDER === "resend" && process.env.RESEND_API_KEY ? "live" : "outbox";
}

const FROM = () => process.env.RAMAI_EMAIL_FROM || "RamAI <no-reply@ramai.app>";

/** Sends (or, without a provider, files) one email. Never throws; returns whether it went out. */
export async function sendEmail(email: Email): Promise<boolean> {
  try {
    return emailDelivery() === "live" ? await viaResend(email) : toOutbox(email);
  } catch (err) {
    console.error("[ramai] email failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

async function viaResend(email: Email): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM(), to: [email.to], subject: email.subject, html: email.html, text: email.text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) console.error(`[ramai] email provider returned ${res.status}`);
  return res.ok;
}

function toOutbox(email: Email): boolean {
  const dir = process.env.RAMAI_OUTBOX_DIR || path.join(process.cwd(), "data", "outbox");
  mkdirSync(dir, { recursive: true });
  const slug = email.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug}.html`);
  writeFileSync(file, `<!-- To: ${email.to} | Subject: ${email.subject} -->\n${email.html}`);
  console.log(`[ramai] Email not sent (no provider configured) — saved to ${file}\n  To: ${email.to}\n  Subject: ${email.subject}\n${email.text.replace(/^/gm, "  | ")}`);
  return true;
}
