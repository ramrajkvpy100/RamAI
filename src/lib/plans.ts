/**
 * Plans — the freemium model. Isomorphic: the client shows it, the server enforces it.
 */
import type { Country } from "@/engine/countries";
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
    dailyCases: 5,
    levels: ["phc", "chc", "district"],
    features: ["5 cases a day", "The first three care levels", "OPD, phone and emergency modes", "Full debrief and score", "Weekly leaderboards"],
  },
  pro: {
    id: "pro",
    label: "Pro",
    dailyCases: null,
    levels: ["phc", "chc", "district", "college", "apex", "grandrounds"],
    features: ["Unlimited cases", "Teaching hospital, national referral and global excellence levels", "Every leaderboard, including Hard cases", "Generated clinical images (when enabled)", "Priority access to new cases"],
  },
};

/**
 * For now, Pro is open to everyone: every level and mode, and unlimited cases
 * for anyone with an account. Turn this off to bring the paid plan back.
 */
export const PRO_FOR_EVERYONE = true;

/** No account needed: the demo, then this many real cases a day. Signing up keeps the progress. */
export const GUEST_DAILY_CASES = 10;

/** The plan a player actually has: their own, or Pro while it's open to everyone (guests keep their daily allowance). */
export function planFor(user: { plan: PlanId; isGuest: boolean }): Plan {
  if (!PRO_FOR_EVERYONE) return PLANS[user.plan];
  return user.isGuest ? { ...PLANS.pro, dailyCases: GUEST_DAILY_CASES } : PLANS.pro;
}

/** How many cases this player can start today (null = unlimited). The daily case and the demo don't count. */
export const dailyLimitFor = (user: { plan: PlanId; isGuest: boolean }): number | null =>
  PRO_FOR_EVERYONE ? planFor(user).dailyCases : user.isGuest ? GUEST_DAILY_CASES : PLANS[user.plan].dailyCases;

/**
 * What Pro costs, in the currency of the country the doctor practises in
 * (Razorpay charges it in the same currency). Amounts in major units.
 */
export const PRICE_BOOK: Record<Country, { currency: "INR" | "USD" | "GBP"; locale: string; monthly: number }> = {
  IN: { currency: "INR", locale: "en-IN", monthly: 299 },
  US: { currency: "USD", locale: "en-US", monthly: 4.99 },
  UK: { currency: "GBP", locale: "en-GB", monthly: 3.99 },
};

/** Pro is bought a month at a time. */
export const PERIODS = {
  monthly: { per: "month", days: 30 },
} as const;

export type BillingPeriod = keyof typeof PERIODS;

export interface Price {
  period: BillingPeriod;
  /** Major units: 299 (rupees), 4.99 (dollars). */
  amount: number;
  /** Smallest units, for the payment provider: paise, cents, pence. */
  minor: number;
  currency: "INR" | "USD" | "GBP";
  /** "₹299", "$4.99", "£3.99". */
  label: string;
  per: string;
  days: number;
}

/** An amount in the country's currency: "₹299", "$4.99", "£3.99". */
export function formatPrice(amount: number, country: Country): string {
  const b = PRICE_BOOK[country] ?? PRICE_BOOK.IN;
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(b.locale, { style: "currency", currency: b.currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(amount);
}

export function priceFor(country: Country, period: BillingPeriod): Price {
  const b = PRICE_BOOK[country] ?? PRICE_BOOK.IN;
  const amount = b[period];
  return {
    period,
    amount,
    minor: Math.round(amount * 100),
    currency: b.currency,
    label: formatPrice(amount, country),
    per: PERIODS[period].per,
    days: PERIODS[period].days,
  };
}

/** Every country's price for a period, for the terms and policies: "₹299 (India), $4.99 (USA) or £3.99 (UK)". */
export function priceList(period: BillingPeriod): string {
  const where: Record<Country, string> = { IN: "India", US: "USA", UK: "UK" };
  const parts = (Object.keys(PRICE_BOOK) as Country[]).map((c) => `${priceFor(c, period).label} (${where[c]})`);
  return `${parts.slice(0, -1).join(", ")} or ${parts.at(-1)}`;
}

/** Where a visitor without an account is browsing from (Vercel's country header): India, the UK, or else US dollars. */
export const countryFromIp = (code: string | null | undefined): Country => (code === "IN" ? "IN" : code === "GB" ? "UK" : code ? "US" : "IN");
