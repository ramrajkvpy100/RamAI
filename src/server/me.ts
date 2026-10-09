import "server-only";

import type { Me } from "@/lib/me-store";
import { PLANS } from "@/lib/plans";

import { getCurrentUser, type User } from "./auth";
import { casesStartedToday, progressFor } from "./results";

/** Recent history sent to the browser — progress itself is computed from all of it. */
const HISTORY_SENT = 30;

export function meFor(user: User): Me {
  const progress = progressFor(user.id);
  return {
    user,
    progress: { ...progress, history: progress.history.slice(-HISTORY_SENT) },
    usage: { casesToday: casesStartedToday(user.id), dailyLimit: PLANS[user.plan].dailyCases },
  };
}

export async function getMe(): Promise<Me | null> {
  const user = await getCurrentUser();
  return user ? meFor(user) : null;
}
