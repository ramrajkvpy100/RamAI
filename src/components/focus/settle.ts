"use client";

import { complete, type Active, SIZES } from "@/lib/focus";
import { PLANTS } from "@/lib/grove";
import { success } from "@/lib/haptics";
import { playSfx } from "@/lib/sfx";
import { toast } from "@/lib/toast";

/** Only if notifications are already allowed: a quiet lock-screen line. Never asked for, never waited on. */
export async function lockScreen(title: string, body: string, loud = false) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.showNotification(title, { body, tag: "ramai-focus", silent: !loud, icon: "/icon-192.png", badge: "/icon-badge.png" });
  } catch {}
}

let handled: number | null = null;

/** Time's up for this phase (also after reopening the app): records it, once, and says so. Sound only on the timer's own page. */
export function settlePhase(active: Active, onTimerPage: boolean) {
  if (handled === active.endsAt) return;
  handled = active.endsAt;
  const what = complete();
  success();
  // A clear buzz so it's felt even with the phone face-down (where the device allows it).
  try { navigator.vibrate?.([400, 200, 400, 200, 700]); } catch {}
  if (onTimerPage) playSfx(what === "focus-done" ? "win" : "reveal");
  if (what === "focus-done") {
    if (active.plant) {
      const plant = PLANTS[active.plant];
      toast(`${active.minutes} minutes of focus: your ${plant.common} is in the garden.`);
      void lockScreen("Focus complete", `Your ${plant.common} is planted. ${active.minutes} minutes${active.name ? ` on “${active.name}”` : ""}.`, true);
      return;
    }
    toast(active.size === "flow" ? "5 minutes done — a 1-minute stretch" : `${SIZES[active.size].focus} minutes of focus — well done. Take your break.`);
    void lockScreen("Focus complete ☕", active.size === "flow" ? "1-minute break — then the next 5." : `${SIZES[active.size].focus} minutes on “${active.name || "your focus"}”. Time for a break.`, true);
  } else {
    toast(active.size === "flow" ? "Break over — back to studying. Every 5 minutes earns another minute." : "Break over — ready for another?");
    void lockScreen(active.size === "flow" ? "Back to it" : "Break over", active.size === "flow" ? "5 minutes of focus." : active.plant ? "Plant another when you're ready." : "Order another when you're ready.");
  }
}
