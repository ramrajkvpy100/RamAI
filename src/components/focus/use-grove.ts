"use client";

import { useEffect, useSyncExternalStore } from "react";

import { emptyGrove, getGrove, mergeRecords, setGrove, subscribeGrove, type GroveRecord } from "@/lib/grove";
import { useMe } from "@/lib/me-store";

const OWNER = "ramai.grove.owner";
let synced = -1;

/** Adds this phone's garden to the account's and brings back the rest. Offline, or if it fails, the next visit tries again. */
async function sync(userId: string) {
  try {
    const owner = localStorage.getItem(OWNER);
    // Another doctor signed in on this phone: their garden, not the last one's. A guest's garden comes along on signing up.
    if (owner && owner !== userId) setGrove([]);
    localStorage.setItem(OWNER, userId);
    const local = getGrove();
    synced = local.length;
    const res = await fetch("/api/focus/grove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: local }) });
    if (!res.ok) return;
    const { records } = (await res.json()) as { records: GroveRecord[] };
    const merged = mergeRecords(getGrove(), records);
    synced = merged.length;
    if (merged.length !== getGrove().length) setGrove(merged);
  } catch {}
}

/** The garden, kept up to date. Guests stay on this phone; a signed-in doctor's also lives on the account. */
export function useGrove(): GroveRecord[] {
  const records = useSyncExternalStore(subscribeGrove, getGrove, emptyGrove);
  const me = useMe();
  const userId = me && !me.user.isGuest ? me.user.id : null;
  const count = records.length;
  useEffect(() => {
    if (userId && count !== synced) void sync(userId);
  }, [userId, count]);
  return records;
}
