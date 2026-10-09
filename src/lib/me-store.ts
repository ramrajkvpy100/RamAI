"use client";

/**
 * The signed-in player — profile, plan, progress and today's usage.
 * Progress is computed on the server from recorded results; the client only
 * caches and renders it.
 */
import { useSyncExternalStore } from "react";

import type { Country } from "@/engine/countries";
import type { PatientLang, PlayerProgress } from "@/engine/types";

import type { PlanId } from "./plans";

export interface Me {
  user: { id: string; email: string; username: string; name: string; plan: PlanId; planExpiresAt: number | null; patientLang: PatientLang; createdAt: number; emailVerified: boolean; isGuest: boolean; leagueTier: number; country: Country };
  progress: PlayerProgress;
  usage: { casesToday: number; dailyLimit: number | null };
  /** Whether this server can send email (verification, password reset). */
  emailReady?: boolean;
}

let snapshot: Me | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Seeds the store with server-rendered data (called on every server render). */
export function primeMe(me: Me) {
  if (snapshot === me) return;
  snapshot = me;
  emit();
}

export function clearMe() {
  snapshot = null;
  emit();
}

export async function refreshMe(): Promise<Me | null> {
  const res = await fetch("/api/me", { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return snapshot;
  snapshot = (await res.json()) as Me;
  emit();
  return snapshot;
}

export function useMe(initial?: Me): Me | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (snapshot && (!initial || snapshot.user.id === initial.user.id) ? snapshot : (initial ?? null)),
    () => initial ?? null,
  );
}
