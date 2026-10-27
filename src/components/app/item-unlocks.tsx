"use client";

import { useEffect } from "react";

import { ITEMS, itemUnlocked } from "@/lib/avatar-style";
import { success } from "@/lib/haptics";
import type { Me } from "@/lib/me-store";
import { toast } from "@/lib/toast";

const KEY = "ramai.bag.seen";

/** A new item in the doctor's bag: say so once, with a way to wear it. */
export function ItemUnlocks({ me }: { me: Me }) {
  const p = me.progress;
  useEffect(() => {
    if (me.user.isGuest && !p.casesCompleted) return;
    const have = ITEMS.filter((i) => itemUnlocked(i.id, p)).map((i) => i.id as string);
    let seen: string[] | null = null;
    try {
      seen = JSON.parse(localStorage.getItem(KEY) ?? "null") as string[] | null;
      localStorage.setItem(KEY, JSON.stringify(have));
    } catch {
      return;
    }
    if (!seen) return; // The first time on this phone: what's already collected isn't news.
    const fresh = ITEMS.filter((i) => have.includes(i.id) && !seen.includes(i.id));
    if (!fresh.length) return;
    const last = fresh[fresh.length - 1]!;
    success();
    toast(`🎒 New item collected: ${last.emoji} ${last.name}!`, { tone: "success", action: { label: "Wear it", run: () => void (window.location.href = "/achievements#bag") } });
  }, [me.user.isGuest, p]);
  return null;
}
