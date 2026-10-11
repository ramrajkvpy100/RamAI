import "server-only";

import type { Me } from "@/lib/me-store";
import { dailyLimitFor } from "@/lib/plans";

import { getCurrentUser, type User } from "./auth";
import { casesStartedToday, progressFor } from "./results";
import { isAdmin, newSuggestionCount } from "./suggestions";

/** Recent history sent to the browser — progress itself is computed from all of it. */
const HISTORY_SENT = 30;

export async function meFor(user: User): Promise<Me> {
  const [progress, casesToday, admin] = await Promise.all([progressFor(user.id), casesStartedToday(user.id), user.isGuest ? false : isAdmin(user).catch(() => false)]);
  return {
    user,
    progress: { ...progress, history: progress.history.slice(-HISTORY_SENT) },
    usage: { casesToday, dailyLimit: dailyLimitFor(user) },
    ...(admin ? { admin: true, newSuggestions: await newSuggestionCount() } : {}),
  };
}

export async function getMe(): Promise<Me | null> {
  const user = await getCurrentUser();
  return user ? meFor(user) : null;
}
