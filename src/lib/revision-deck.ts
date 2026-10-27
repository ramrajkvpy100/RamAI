"use client";

/**
 * The personal revision deck, kept on this device: takeaways and pearls saved from debriefs, and questions from the
 * Skills Lab and exam practice (the ones answered wrong are added by themselves). Reviewed as flashcards with simple
 * spaced repetition: each card comes back sooner when it was hard and later when it was easy. Also kept with the
 * account (signed in), so it survives a new phone or browser: merged card by card, the most-reviewed copy winning.
 */
import { useEffect, useState } from "react";

export type CardSource = "case" | "skills" | "exam";

export interface Card {
  id: string;
  /** The front: a takeaway, or a question. */
  text: string;
  /** The back (questions): the answer and why. */
  back?: string;
  /** Where it came from: "Dengue · Case #12", "Antidotes", "NEET PG · Pharmacology". */
  from: string;
  source?: CardSource;
  at: number;
  /** When it's next due (ms); new cards are due at once. */
  due?: number;
  /** Days until the next review after a "Good". */
  interval?: number;
  ease?: number;
  reviews?: number;
}

const KEY = "ramai.deck.v1";
const DAY = 86_400_000;
const subs = new Set<() => void>();
const read = (): Card[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Card[];
  } catch {
    return [];
  }
};
const write = (cards: Card[], push = true) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(cards.slice(-500)));
  } catch {}
  subs.forEach((f) => f());
  if (push) schedulePush();
};

/* Kept with the account ------------------------------------------------------------------------------------- */
const REMOVED = "ramai.deck.removed";
const removed = (): string[] => {
  try { return JSON.parse(localStorage.getItem(REMOVED) ?? "[]") as string[]; } catch { return []; }
};
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let synced = false;
function schedulePush() {
  if (!synced) return; // nothing goes up before the account's copy has been merged in
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void fetch("/api/planner", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc: "deck", data: { cards: read().slice(-500), removed: removed().slice(-300) } }) }).catch(() => undefined);
  }, 1500);
}
const newer = (a: Card, b: Card) => ((a.reviews ?? 0) !== (b.reviews ?? 0) ? ((a.reviews ?? 0) > (b.reviews ?? 0) ? a : b) : (a.due ?? 0) >= (b.due ?? 0) ? a : b);
/** Once per page load: the account's deck merged with this phone's, then both kept the same. */
async function sync() {
  if (synced) return;
  const res = await fetch("/api/planner?docs=deck", { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return; // offline or signed out: this phone's deck as it is
  const remote = ((await res.json()) as { docs: { deck: { cards?: Card[]; removed?: string[] } | null } }).docs.deck;
  synced = true;
  const gone = new Set([...removed(), ...(remote?.removed ?? [])]);
  const byId = new Map<string, Card>();
  for (const c of [...(remote?.cards ?? []), ...read()]) {
    if (gone.has(c.id)) continue;
    const had = byId.get(c.id);
    byId.set(c.id, had ? newer(had, c) : c);
  }
  try { localStorage.setItem(REMOVED, JSON.stringify([...gone].slice(-300))); } catch {}
  write([...byId.values()].sort((a, b) => a.at - b.at));
}
const idOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 120);

export const inDeck = (text: string) => read().some((c) => c.id === idOf(text));
export function addCard(text: string, from: string, extra: { back?: string; source?: CardSource } = {}) {
  if (!text.trim() || inDeck(text)) return;
  try { localStorage.setItem(REMOVED, JSON.stringify(removed().filter((x) => x !== idOf(text)))); } catch {}
  void sync();
  write([...read(), { id: idOf(text), text, from, at: Date.now(), due: Date.now(), interval: 0, ease: 2.5, reviews: 0, source: extra.source ?? "case", ...(extra.back ? { back: extra.back } : {}) }]);
}
/** A question as a card: the stem (and its options) in front, the answer and explanation behind. */
export function addQuestion(stem: string, options: string[], answer: string, explanation: string, from: string, source: CardSource) {
  const front = (options.length ? `${stem}\n${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}` : stem);
  addCard(front, from, { back: `**Answer: ${answer}**\n${explanation}`, source });
}
export function removeCard(id: string) {
  try { localStorage.setItem(REMOVED, JSON.stringify([...removed().filter((x) => x !== id), id].slice(-300))); } catch {}
  write(read().filter((c) => c.id !== id));
}
export function restoreCard(card: Card) {
  try { localStorage.setItem(REMOVED, JSON.stringify(removed().filter((x) => x !== card.id))); } catch {}
  if (!read().some((c) => c.id === card.id)) write([...read(), card].sort((a, b) => a.at - b.at));
}

export type Grade = "again" | "hard" | "good" | "easy";
/** When each grade would bring the card back, for the buttons ("10 min", "3 d"). */
export function nextIn(card: Card, grade: Grade): number {
  const interval = card.interval ?? 0, ease = card.ease ?? 2.5;
  if (grade === "again") return 10 * 60_000;
  if (grade === "hard") return Math.max(1, Math.round(interval * 1.2)) * DAY;
  if (grade === "good") return (interval < 1 ? 1 : Math.round(interval * ease)) * DAY;
  return (interval < 1 ? 4 : Math.round(interval * ease * 1.3)) * DAY;
}
export function grade(id: string, g: Grade) {
  write(read().map((c) => {
    if (c.id !== id) return c;
    const wait = nextIn(c, g);
    const ease = Math.min(3, Math.max(1.3, (c.ease ?? 2.5) + (g === "again" ? -0.2 : g === "hard" ? -0.15 : g === "easy" ? 0.15 : 0)));
    return { ...c, due: Date.now() + wait, interval: g === "again" ? 0 : Math.round(wait / DAY), ease, reviews: (c.reviews ?? 0) + 1 };
  }));
}
export const isDue = (c: Card, now = Date.now()) => (c.due ?? 0) <= now;
export const wait = (ms: number) => (ms < 3_600_000 ? `${Math.round(ms / 60_000)} min` : ms < DAY ? `${Math.round(ms / 3_600_000)} h` : `${Math.round(ms / DAY)} d`);

// Back online: the account's copy and this phone's are merged again (reviews done offline go up).
if (typeof window !== "undefined") window.addEventListener("online", () => { if (synced) schedulePush(); else void sync(); });

export function useDeck(): Card[] {
  const [cards, setCards] = useState<Card[]>([]);
  useEffect(() => {
    const f = () => setCards(read());
    f();
    subs.add(f);
    void sync();
    return () => void subs.delete(f);
  }, []);
  return cards;
}
