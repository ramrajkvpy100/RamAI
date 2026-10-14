/**
 * Tells RamAI's owner straight away when something needs them (a new suggestion): an email through
 * Resend (RESEND_API_KEY; from RESEND_FROM, default Resend's test sender, which may only write to the
 * Resend account's own address) and a push notification on every device where the owner turned on
 * RamAI's notifications. Either can be missing; neither ever blocks the person who wrote in.
 */
import "server-only";

import { SITE } from "@/lib/site";

import { db } from "./db";
import { sendPush, type PushTarget } from "./push";

const ownerEmails = () =>
  (process.env.RAMAI_ADMIN_EMAILS ?? SITE.ownerAccounts.join(","))
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export async function notifyOwner(message: { subject: string; text: string; url: string }): Promise<{ email: boolean; pushes: number }> {
  const to = ownerEmails();
  const link = new URL(message.url, SITE.url).toString();
  const [email, pushes] = await Promise.all([
    (async () => {
      const key = process.env.RESEND_API_KEY;
      if (!key || to.length === 0) return false;
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: process.env.RESEND_FROM || "RamAI <onboarding@resend.dev>", to, subject: message.subject, text: `${message.text}\n\nOpen: ${link}` }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) console.warn("[ramai] owner email failed:", res.status, (await res.text().catch(() => "")).slice(0, 200));
        return res.ok;
      } catch (err) {
        console.warn("[ramai] owner email failed:", err instanceof Error ? err.message : err);
        return false;
      }
    })(),
    (async () => {
      const targets = await db.all<PushTarget>(
        `SELECT p.endpoint, p.p256dh, p.auth FROM push_subscriptions p JOIN users u ON u.id = p.user_id WHERE lower(u.email) IN (${to.map(() => "?").join(", ")}) AND u.is_guest = 0`,
        ...to,
      ).catch(() => [] as PushTarget[]);
      const sent = await Promise.all(targets.map((t) => sendPush(t, { title: message.subject, body: message.text.slice(0, 180), url: message.url }, 86_400, "owner").catch(() => "failed" as const)));
      return sent.filter((s) => s === "sent").length;
    })(),
  ]);
  return { email, pushes };
}
