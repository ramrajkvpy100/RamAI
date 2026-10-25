"use client";

/** The personal revision deck: key takeaways saved from debriefs, kept on this device. */
import { useEffect, useState } from "react";

export interface Card {
  id: string;
  text: string;
  /** Where it came from: "Dengue · Case #12". */
  from: string;
  at: number;
}
const KEY = "ramai.deck.v1";
const subs = new Set<() => void>();
const read = (): Card[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Card[];
  } catch {
    return [];
  }
};
const write = (cards: Card[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(cards.slice(-300)));
  } catch {}
  subs.forEach((f) => f());
};
const idOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 80);

export const inDeck = (text: string) => read().some((c) => c.id === idOf(text));
export function addCard(text: string, from: string) {
  if (inDeck(text)) return;
  write([...read(), { id: idOf(text), text, from, at: Date.now() }]);
}
export function removeCard(id: string) {
  write(read().filter((c) => c.id !== id));
}
export function restoreCard(card: Card) {
  if (!read().some((c) => c.id === card.id)) write([...read(), card].sort((a, b) => a.at - b.at));
}
export function useDeck(): Card[] {
  const [cards, setCards] = useState<Card[]>([]);
  useEffect(() => {
    const f = () => setCards(read());
    f();
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return cards;
}
