/**
 * Countries RamAI plays in. A country changes who the patients are (names,
 * places, food, brands), the units and money on screen, the emergency number
 * and the names of the care levels — never the clinical logic or the scoring.
 * Isomorphic: the client formats with it, the server localises with it.
 */

export type Country = "IN" | "US" | "UK";
export const COUNTRIES: readonly Country[] = ["IN", "US", "UK"];

export interface CountryInfo {
  id: Country;
  name: string;
  short: string;
  flag: string;
  /** Ambulance number. */
  emergency: string;
  currency: {
    symbol: string;
    code: string;
    /** Typical local price per rupee of the Indian price (not an exchange rate). */
    rate: number;
    /** Prices round to this step. */
    step: number;
    locale: string;
  };
  /** SI lab units, kPa blood gases and °C (UK); conventional units and °F otherwise. */
  si: boolean;
  /** What the bedside fingerstick glucose is called. */
  glucoseLabel: string;
}

export const COUNTRY: Record<Country, CountryInfo> = {
  IN: { id: "IN", name: "India", short: "India", flag: "🇮🇳", emergency: "108", currency: { symbol: "₹", code: "INR", rate: 1, step: 1, locale: "en-IN" }, si: false, glucoseLabel: "RBS" },
  US: { id: "US", name: "United States", short: "USA", flag: "🇺🇸", emergency: "911", currency: { symbol: "$", code: "USD", rate: 0.3, step: 5, locale: "en-US" }, si: false, glucoseLabel: "Glucose" },
  UK: { id: "UK", name: "United Kingdom", short: "UK", flag: "🇬🇧", emergency: "999", currency: { symbol: "£", code: "GBP", rate: 0.05, step: 1, locale: "en-GB" }, si: true, glucoseLabel: "CBG" },
};

export const isCountry = (x: unknown): x is Country => x === "IN" || x === "US" || x === "UK";

/** A rupee price as a typical local price, rounded to a sensible step. */
export function localPrice(inr: number, country: Country): number {
  const c = COUNTRY[country].currency;
  if (c.rate === 1) return inr;
  return Math.max(c.step, Math.round((inr * c.rate) / c.step) * c.step);
}

/** An amount already in the country's money, e.g. "₹1,200", "$360", "£60". */
export function formatMoney(amount: number, country: Country = "IN"): string {
  const c = COUNTRY[country].currency;
  return `${c.symbol}${Math.round(amount).toLocaleString(c.locale)}`;
}

/** A best guess from the browser's language: en-US → USA, en-GB → UK, otherwise India. */
export function countryFromLocale(locale: string | undefined): Country {
  const l = (locale ?? "").toLowerCase();
  if (/-us$/.test(l)) return "US";
  if (/-(gb|uk)$/.test(l)) return "UK";
  return "IN";
}
