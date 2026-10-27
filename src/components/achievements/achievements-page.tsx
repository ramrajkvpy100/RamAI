"use client";

import { useMe } from "@/lib/me-store";

import { Achievements } from "./achievements";

/** Drawn at once from the account this phone already has. */
export function AchievementsPage() {
  const me = useMe();
  return me ? <Achievements initial={me} /> : null;
}
