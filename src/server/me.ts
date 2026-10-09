import "server-only";

import type { Me } from "@/lib/me-store";
import { PLANS } from "@/lib/plans";

import { getCurrentUser, type User } from "./auth";
import { emailDelivery } from "./mailer";
import { casesStartedToday, progressFor } from "./results";

/** Recent history sent to the browser — progress itself is computed from all of it. */
const HISTORY_SENT = 30;

export async function meFor(user: User): Promise<Me> {
  const [progress, casesToday] = await Promise.all([progressFor(user.id), casesStartedToday(user.id)]);
  return {
    user,
    progress: { ...progress, history: progress.history.slice(-HISTORY_SENT) },
    usage: { casesToday, dailyLimit: PLANS[user.plan].dailyCases },
    // Locally, emails land in the outbox and the link is offered on screen; in production they need a provider.
    emailReady: emailDelivery() === "live" || process.env.NODE_ENV !== "production",
  };
}

export async function getMe(): Promise<Me | null> {
  const user = await getCurrentUser();
  return user ? meFor(user) : null;
}
