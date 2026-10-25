"use client";

/**
 * Skills Lab progress, kept on this device: for each item, whether the last answer was right. "Mastered" = answered
 * right last time. Sections and subcategories show mastered / total, like a question bank's tracker.
 */
import { useEffect, useState } from "react";

const KEY = "ramai.skills.v1";
type Store = Record<string, 1 | 0>;

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

const subs = new Set<() => void>();

export function recordSkill(key: string, right: boolean) {
  try {
    const s = read();
    s[key] = right ? 1 : 0;
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
  subs.forEach((f) => f());
}

/** How many keys starting with `prefix` (or in `keys`) are mastered, and how many tried. */
export function useSkillProgress(): (prefix: string, keys?: readonly string[]) => { mastered: number; tried: number } {
  const [store, setStore] = useState<Store>({});
  useEffect(() => {
    const f = () => setStore(read());
    f();
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return (prefix, keys) => {
    const entries = Object.entries(store).filter(([k]) => (keys ? keys.some((x) => `${prefix}${x}` === k) : k.startsWith(prefix)));
    return { mastered: entries.filter(([, v]) => v === 1).length, tried: entries.length };
  };
}

/** A thin progress bar with "12/50". */
export function progressLabel(mastered: number, total: number) {
  return `${Math.min(mastered, total)}/${total}`;
}
