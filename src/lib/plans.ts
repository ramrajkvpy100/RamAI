/**
 * Plans — the freemium model. Isomorphic: the client shows it, the server enforces it.
 */
import type { CareLevel } from "@/engine/types";

export type PlanId = "free" | "pro";

export interface Plan {
  id: PlanId;
  label: string;
  /** null = unlimited. */
  dailyCases: number | null;
  levels: readonly CareLevel[];
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    label: "Free",
    dailyCases: 10,
    levels: ["phc", "chc", "district"],
    features: ["10 cases a day", "The first three care levels", "OPD, phone and emergency modes", "Full debrief and score", "Weekly leaderboards"],
  },
  pro: {
    id: "pro",
    label: "Pro",
    dailyCases: null,
    levels: ["phc", "chc", "district", "college", "apex", "grandrounds"],
    features: ["Unlimited cases", "Teaching hospital, national referral and global excellence levels", "Every leaderboard, including Hard cases", "Generated clinical images (when enabled)", "Priority access to new cases"],
  },
};

/** Before signing up: the demo, then a few real cases a day — enough to see what RamAI is like. */
export const GUEST_DAILY_CASES = 3;

/** How many cases this player can start today (null = unlimited). The daily case and the demo don't count. */
export const dailyLimitFor = (user: { plan: PlanId; isGuest: boolean }): number | null => (user.isGuest ? GUEST_DAILY_CASES : PLANS[user.plan].dailyCases);

/** Prices in INR. */
export const PRICES = {
  monthly: { amount: 299, label: "₹299", per: "month", days: 30 },
  yearly: { amount: 2499, label: "₹2,499", per: "year", days: 365, note: "Save 30%" },
} as const;

export type BillingPeriod = keyof typeof PRICES;
