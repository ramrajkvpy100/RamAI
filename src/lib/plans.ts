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

/** No account needed: the demo, then as many real cases a day as a free account. Signing up keeps the progress. */
export const GUEST_DAILY_CASES = 5;

/** How many cases this player can start today (null = unlimited). The daily case and the demo don't count. */
export const dailyLimitFor = (user: { plan: PlanId; isGuest: boolean }): number | null => (user.isGuest ? GUEST_DAILY_CASES : PLANS[user.plan].dailyCases);

/**
 * What Pro costs, in the currency of the country the doctor practises in
 * (Razorpay charges it in the same currency). Amounts in major units.
 */
export const PRICE_BOOK: Record<Country, { currency: "INR" | "USD" | "GBP"; locale: string; monthly: number; yearly: number }> = {
  IN: { currency: "INR", locale: "en-IN", monthly: 299, yearly: 2499 },
  US: { currency: "USD", locale: "en-US", monthly: 4.99, yearly: 39.99 },
  UK: { currency: "GBP", locale: "en-GB", monthly: 3.99, yearly: 31.99 },
};

export const PERIODS = {
  monthly: { per: "month", days: 30 },
  yearly: { per: "year", days: 365 },
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
  /** The yearly plan's price per month, e.g. "$3.33". */
  perMonth: string;
  /** How much cheaper the yearly plan is, in per cent. */
  saving: number;
}

/** An amount in the country's currency: "₹2,499", "$39.99", "£31.99". */
export function formatPrice(amount: number, country: Country): string {
  const b = PRICE_BOOK[country] ?? PRICE_BOOK.IN;
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(b.locale, { style: "currency", currency: b.currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(amount);
}

export function priceFor(country: Country, period: BillingPeriod): Price {
  const b = PRICE_BOOK[country] ?? PRICE_BOOK.IN;
  const amount = b[period];
  const perMonth = b.currency === "INR" ? Math.round(b.yearly / 12) : Math.round((b.yearly / 12) * 100) / 100;
  return {
    period,
    amount,
    minor: Math.round(amount * 100),
    currency: b.currency,
    label: formatPrice(amount, country),
    per: PERIODS[period].per,
    days: PERIODS[period].days,
    perMonth: formatPrice(perMonth, country),
    saving: Math.round((1 - b.yearly / (b.monthly * 12)) * 100),
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
