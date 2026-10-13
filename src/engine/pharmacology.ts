/**
 * Pharmacology — every drug given acts, over time, in proportion to the dose.
 *
 * Each drug has a profile, by class (or its own): when it starts to act, when
 * it peaks and how long it lasts, by route; and what a usual adult dose does at
 * its peak — to the pulse, pressure, breathing, saturation, temperature, sugar,
 * consciousness, pain and urine. What the monitor shows is the patient's own
 * course (the illness, set by the case) plus every drug's effect at this
 * minute. Doses far beyond the usual arm toxicity hazards instead
 * (physiology.ts), which play out through the nurse, the patient and the monitor.
 *
 * Pure functions of the order list and the clock, so a case replays exactly.
 */

import { formularyDrug, type DrugClass, type FormularyDrug } from "./formulary";
import type { DrugRoute, VitalKey, VitalPatch } from "./types";

/** When a drug starts to act, peaks, and has worn off — minutes after it's given. */
export interface Kinetics {
  onset: number;
  peak: number;
  duration: number;
}

/** What the effect is on: the vitals, with blood pressure split into its two numbers. */
export type EffectKey = "hr" | "sbp" | "dbp" | "rr" | "spo2" | "temp" | "rbs" | "gcs" | "pain" | "urine";

/** What was troubling the patient, that a drug can relieve (and they'd mention). */
export type Trouble = "pain" | "fever" | "breathing" | "nausea" | "itch" | "urine";

/**
 * One effect of a usual dose at its peak: a change (−12 beats a minute), or a
 * share of the way back to normal ({ toward: 98.6, by: 0.55 } — a fever comes
 * down, a normal temperature doesn't), optionally only when the vital is out of range.
 */
export type Effect = number | { toward: number; by: number; above?: number; below?: number };

export interface Profile {
  /** By route; "default" for any route not listed. */
  kinetics: Partial<Record<DrugRoute | "default", Kinetics>>;
  effects: Partial<Record<EffectKey, Effect>>;
  /** What the patient notices once it acts — said only if it's what troubled them. */
  feels?: { when: Trouble; says: string };
  /** Undoes these classes' effects while it acts (naloxone, flumazenil). */
  reverses?: DrugClass[];
}

const IV: Kinetics = { onset: 2, peak: 10, duration: 120 };
const IM: Kinetics = { onset: 10, peak: 30, duration: 180 };
const SC: Kinetics = { onset: 15, peak: 60, duration: 240 };
const PO: Kinetics = { onset: 30, peak: 90, duration: 360 };
const SLOW: Kinetics = { onset: 60, peak: 240, duration: 1440 };

const FEVER = { toward: 98.6, by: 0.55, above: 99.5 };

/** Class profiles, most specific first (a drug takes the first of its classes listed here). */
const BY_CLASS: [DrugClass, Profile][] = [
  ["opioid-antagonist", { kinetics: { IV: { onset: 1, peak: 2, duration: 45 }, IM: { onset: 3, peak: 10, duration: 60 }, default: { onset: 2, peak: 5, duration: 45 } }, effects: {}, reverses: ["opioid"] }],
  ["benzodiazepine-antagonist", { kinetics: { default: { onset: 1, peak: 3, duration: 45 } }, effects: {}, reverses: ["benzodiazepine"] }],
  ["opioid", {
    kinetics: { IV: { onset: 3, peak: 10, duration: 180 }, IM: { onset: 15, peak: 40, duration: 240 }, SC: { onset: 15, peak: 45, duration: 240 }, PO: { onset: 30, peak: 75, duration: 300 }, default: IM },
    effects: { pain: -4, rr: -2, hr: -4, sbp: -6 },
    feels: { when: "pain", says: "The pain has eased a lot, doctor." },
  }],
  ["glucose", { kinetics: { IV: { onset: 1, peak: 3, duration: 60 }, IM: { onset: 10, peak: 30, duration: 90 }, default: { onset: 10, peak: 30, duration: 90 } }, effects: { rbs: 100 } }],
  ["insulin", { kinetics: { IV: { onset: 10, peak: 30, duration: 90 }, SC: { onset: 30, peak: 120, duration: 360 }, default: SC }, effects: { rbs: -50 } }],
  ["sulfonylurea", { kinetics: { default: { onset: 60, peak: 240, duration: 720 } }, effects: { rbs: -30 } }],
  ["hypoglycaemic", { kinetics: { default: SLOW }, effects: { rbs: -15 } }],
  ["vasopressor", { kinetics: { IV: { onset: 1, peak: 3, duration: 20 }, IM: { onset: 3, peak: 10, duration: 30 }, default: { onset: 3, peak: 10, duration: 30 } }, effects: { hr: 20, sbp: 25, dbp: 10, rbs: 20 } }],
  ["inotrope", { kinetics: { default: { onset: 2, peak: 10, duration: 60 } }, effects: { hr: 12, sbp: 10 } }],
  ["anticholinergic", { kinetics: { IV: { onset: 1, peak: 3, duration: 60 }, NEB: { onset: 5, peak: 30, duration: 240 }, default: { onset: 5, peak: 20, duration: 120 } }, effects: { hr: 20 } }],
  ["bronchodilator", {
    kinetics: { NEB: { onset: 3, peak: 15, duration: 240 }, INH: { onset: 3, peak: 15, duration: 240 }, default: { onset: 5, peak: 20, duration: 240 } },
    effects: { hr: 10, rr: { toward: 18, by: 0.25, above: 20 }, spo2: { toward: 96, by: 0.3, below: 95 } },
    feels: { when: "breathing", says: "Breathing is a little easier now." },
  }],
  ["nitrate", { kinetics: { SL: { onset: 1, peak: 4, duration: 30 }, IV: { onset: 1, peak: 3, duration: 30 }, PO: { onset: 30, peak: 60, duration: 480 }, default: { onset: 2, peak: 5, duration: 30 } }, effects: { sbp: -18, dbp: -8, hr: 8, pain: -1 } }],
  ["loop-diuretic", { kinetics: { IV: { onset: 5, peak: 30, duration: 360 }, PO: { onset: 60, peak: 120, duration: 480 }, default: { onset: 30, peak: 90, duration: 480 } }, effects: { urine: 150, sbp: -5 }, feels: { when: "urine", says: "I need to pass urine, doctor." } }],
  ["thiazide", { kinetics: { default: { onset: 120, peak: 360, duration: 1440 } }, effects: { urine: 30, sbp: -4 } }],
  ["mra", { kinetics: { default: SLOW }, effects: { urine: 15 } }],
  ["beta-blocker", { kinetics: { IV: { onset: 5, peak: 20, duration: 360 }, PO: { onset: 60, peak: 120, duration: 720 }, default: { onset: 60, peak: 120, duration: 720 } }, effects: { hr: -12, sbp: -10, dbp: -6 } }],
  ["digoxin", { kinetics: { IV: { onset: 15, peak: 120, duration: 1440 }, default: { onset: 60, peak: 360, duration: 1440 } }, effects: { hr: -8 } }],
  ["antiarrhythmic", { kinetics: { IV: { onset: 5, peak: 20, duration: 240 }, default: { onset: 60, peak: 240, duration: 720 } }, effects: { hr: -12, sbp: -8 } }],
  ["ccb", { kinetics: { IV: { onset: 3, peak: 10, duration: 180 }, PO: { onset: 60, peak: 240, duration: 1440 }, default: { onset: 60, peak: 240, duration: 1440 } }, effects: { sbp: -12, dbp: -6, hr: 3 } }],
  ["arni", { kinetics: { default: SLOW }, effects: { sbp: -10, dbp: -5 } }],
  ["acei", { kinetics: { default: SLOW }, effects: { sbp: -10, dbp: -6 } }],
  ["arb", { kinetics: { default: SLOW }, effects: { sbp: -10, dbp: -6 } }],
  ["benzodiazepine", { kinetics: { IV: { onset: 2, peak: 5, duration: 120 }, IM: { onset: 15, peak: 30, duration: 240 }, PO: { onset: 30, peak: 60, duration: 360 }, default: { onset: 15, peak: 30, duration: 240 } }, effects: { gcs: -1, rr: -1, sbp: -5 } }],
  ["antipsychotic", { kinetics: { IM: { onset: 15, peak: 40, duration: 360 }, IV: { onset: 5, peak: 15, duration: 240 }, default: { onset: 60, peak: 180, duration: 720 } }, effects: { gcs: -1, hr: 4 } }],
  ["sedating-antihistamine", { kinetics: { IV: { onset: 5, peak: 20, duration: 240 }, default: { onset: 30, peak: 90, duration: 360 } }, effects: { hr: 3 }, feels: { when: "itch", says: "The itching is much less now — I feel a bit sleepy." } }],
  ["antihistamine", { kinetics: { IV: { onset: 5, peak: 20, duration: 240 }, default: { onset: 30, peak: 90, duration: 720 } }, effects: {}, feels: { when: "itch", says: "The itching has settled down." } }],
  ["steroid-systemic", { kinetics: { default: { onset: 60, peak: 240, duration: 720 } }, effects: { rbs: 40 } }],
  ["blood-product", { kinetics: { default: { onset: 10, peak: 60, duration: 360 } }, effects: { sbp: { toward: 118, by: 0.25, below: 105 }, hr: { toward: 88, by: 0.2, above: 100 } } }],
  ["colloid", { kinetics: { default: { onset: 5, peak: 20, duration: 240 } }, effects: { sbp: { toward: 118, by: 0.2, below: 105 } } }],
  ["fluid", {
    kinetics: { default: { onset: 2, peak: 20, duration: 150 } },
    effects: { sbp: { toward: 118, by: 0.2, below: 105 }, hr: { toward: 90, by: 0.12, above: 100 }, urine: 20 },
  }],
  ["antipyretic", {
    kinetics: { IV: { onset: 10, peak: 30, duration: 240 }, PO: { onset: 30, peak: 60, duration: 300 }, PR: { onset: 30, peak: 90, duration: 300 }, default: { onset: 30, peak: 60, duration: 300 } },
    effects: { temp: FEVER, pain: -2 },
    feels: { when: "fever", says: "I feel a little cooler now, doctor." },
  }],
  ["nsaid", {
    kinetics: { IV: { onset: 10, peak: 45, duration: 300 }, IM: { onset: 15, peak: 45, duration: 300 }, PO: { onset: 30, peak: 90, duration: 360 }, default: { onset: 30, peak: 90, duration: 360 } },
    effects: { pain: -3, temp: { toward: 98.6, by: 0.4, above: 99.5 } },
    feels: { when: "pain", says: "The pain is better than before." },
  }],
  ["antispasmodic", { kinetics: { IV: { onset: 3, peak: 10, duration: 120 }, default: { onset: 20, peak: 60, duration: 240 } }, effects: { pain: -2 }, feels: { when: "pain", says: "The cramps have settled a bit." } }],
  ["analgesic", { kinetics: { default: PO }, effects: { pain: -2 }, feels: { when: "pain", says: "The pain is a bit better." } }],
  ["antiemetic", { kinetics: { IV: { onset: 3, peak: 15, duration: 360 }, default: { onset: 20, peak: 60, duration: 480 } }, effects: {}, feels: { when: "nausea", says: "The vomiting feeling has settled, doctor." } }],
  ["electrolyte", { kinetics: { default: { onset: 5, peak: 30, duration: 240 } }, effects: {} }],
];

/** A drug's profile: its first class with one (by the order above), or none (it acts on nothing the monitor shows). */
export function profileFor(drug: FormularyDrug): Profile | undefined {
  for (const [cls, profile] of BY_CLASS) if (drug.classes.includes(cls)) return profile;
  return undefined;
}

export function kineticsFor(drug: FormularyDrug, route: DrugRoute): Kinetics {
  const k = profileFor(drug)?.kinetics;
  return k?.[route] ?? k?.default ?? (route === "IV" ? IV : route === "IM" ? IM : route === "SC" ? SC : PO);
}

/* -------------------------------------------------------------------------- */
/* Dose                                                                        */
/* -------------------------------------------------------------------------- */

const TO_BASE: Record<string, { base: string; factor: number }> = {
  g: { base: "mg", factor: 1000 }, mg: { base: "mg", factor: 1 }, mcg: { base: "mg", factor: 0.001 }, µg: { base: "mg", factor: 0.001 }, ug: { base: "mg", factor: 0.001 },
  l: { base: "ml", factor: 1000 }, ml: { base: "ml", factor: 1 },
  units: { base: "units", factor: 1 }, iu: { base: "units", factor: 1 },
  meq: { base: "meq", factor: 1 }, mmol: { base: "meq", factor: 1 },
  vials: { base: "vials", factor: 1 },
};

function inBase(amount: number, unit: string): { base: string; value: number } | null {
  const u = TO_BASE[unit.toLowerCase().replace(/s$/, "") === "unit" ? "units" : unit.toLowerCase()];
  return u ? { base: u.base, value: amount * u.factor } : null;
}

/** The usual adult dose, from the formulary ("650 mg", "50 mcg", "20 mg/kg", "500 mL"). */
export function usualDose(drug: FormularyDrug, weightKg = 60): { base: string; value: number } | null {
  const m = drug.dose?.match(/^([\d.,]+)\s*(mg|mcg|µg|ug|g|units?|iu|meq|mmol|ml|l|vials?)(\s*\/\s*kg)?\b/i);
  if (!m?.[1] || !m[2]) return null;
  const amount = parseFloat(m[1].replace(",", "")) * (m[3] ? weightKg : 1);
  return inBase(amount, m[2]);
}

/**
 * How many usual doses an order is: 1 for the usual dose, 10 for ten times it.
 * Fluids by volume (500 mL a usual bag). Unknown amounts count as one dose.
 */
export function doseMultiple(drug: FormularyDrug, order: { amount?: number; unit?: string; volumeMl?: number }, weightKg = 60): number {
  if (drug.fluid) {
    const usual = usualDose(drug, weightKg);
    const per = usual?.base === "ml" ? usual.value : 500;
    return order.volumeMl ? order.volumeMl / per : 1;
  }
  if (order.amount === undefined || !order.unit) return 1;
  const usual = usualDose(drug, weightKg);
  const given = inBase(order.amount, order.unit);
  if (!usual || !given || usual.base !== given.base || usual.value <= 0) {
    // "2 tablets", "3 respules": counted as that many usual doses.
    return /^(tab|tablet|cap|capsule|respule|puff|sachet|ampoule|amp)s?$/i.test(order.unit) ? order.amount : 1;
  }
  return given.value / usual.value;
}

/** How strongly a dose acts: in proportion below the usual dose, levelling off above it. */
export const doseResponse = (multiple: number) => (multiple <= 1 ? Math.max(0, multiple) : Math.min(3, 1 + 0.6 * Math.log2(multiple)));

/* -------------------------------------------------------------------------- */
/* Time course                                                                 */
/* -------------------------------------------------------------------------- */

const smoothstep = (a: number, b: number, x: number) => {
  if (b <= a) return x >= a ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How much of its peak effect a drug has `minutes` after it was given (0…1): rising from onset to peak, fading by the end. */
export function timeCourse(k: Kinetics, minutes: number, overMin = 0): number {
  if (minutes <= 0) return 0;
  // An infusion builds while it runs, then fades as a bolus would from its end.
  const peak = Math.max(k.peak, overMin);
  const end = Math.max(k.duration, peak + (k.duration - k.peak));
  if (minutes >= end) return 0;
  const rise = smoothstep(Math.min(k.onset, peak), peak, minutes);
  if (minutes <= peak) return rise;
  return 0.5 * (1 + Math.cos((Math.PI * (minutes - peak)) / (end - peak)));
}

/* -------------------------------------------------------------------------- */
/* What the monitor shows                                                      */
/* -------------------------------------------------------------------------- */

/** A drug given, as the effect layer needs it. */
export interface ActingDrug {
  drugId: string;
  at: number;
  route: DrugRoute;
  mode: "given" | "prescribed";
  multiple: number;
  overMin?: number;
  /** Its effects are played by a toxicity hazard instead, or are the case's own (already in its course). */
  skip?: EffectKey[] | "all";
}

const LIMITS: Record<EffectKey, [number, number]> = {
  hr: [0, 250], sbp: [0, 280], dbp: [0, 180], rr: [0, 60], spo2: [0, 100], temp: [86, 108], rbs: [10, 900], gcs: [3, 15], pain: [0, 10], urine: [0, 1500],
};

function readEffectKeys(vitals: Record<VitalKey, VitalPatch>): Partial<Record<EffectKey, number>> {
  const out: Partial<Record<EffectKey, number>> = {};
  const [s, d] = (vitals.bp?.value ?? "").split("/").map((x) => parseFloat(x));
  if (Number.isFinite(s)) out.sbp = s;
  if (Number.isFinite(d)) out.dbp = d;
  for (const k of ["hr", "rr", "spo2", "temp", "rbs", "gcs", "pain", "urine"] as const) {
    const n = parseFloat(vitals[k]?.value ?? "");
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function deltaOf(effect: Effect, current: number, strength: number): number {
  if (typeof effect === "number") return effect * strength;
  if (effect.above !== undefined && current <= effect.above) return 0;
  if (effect.below !== undefined && current >= effect.below) return 0;
  return (effect.toward - current) * Math.min(0.95, effect.by * strength);
}

/**
 * The drugs' effects at this minute, added to the patient's own vitals. A
 * reversal agent (naloxone) takes back the effects of what it reverses.
 */
export function drugEffects(drugs: readonly ActingDrug[], vitals: Record<VitalKey, VitalPatch>, clock: number): Partial<Record<EffectKey, number>> {
  const base = readEffectKeys(vitals);
  const deltas: Partial<Record<EffectKey, number>> = {};
  const given = drugs.filter((d) => d.mode === "given" && d.skip !== "all");
  // How much of each class is being reversed right now (0…0.9).
  const reversal = new Map<DrugClass, number>();
  for (const d of given) {
    const drug = formularyDrug(d.drugId);
    const p = drug && profileFor(drug);
    if (!drug || !p?.reverses) continue;
    const on = timeCourse(kineticsFor(drug, d.route), clock - d.at);
    for (const cls of p.reverses) reversal.set(cls, Math.max(reversal.get(cls) ?? 0, 0.9 * on));
  }
  for (const d of given) {
    const drug = formularyDrug(d.drugId);
    const p = drug && profileFor(drug);
    if (!drug || !p) continue;
    const on = timeCourse(kineticsFor(drug, d.route), clock - d.at, d.overMin);
    if (on <= 0) continue;
    const undone = Math.max(0, ...drug.classes.map((c) => reversal.get(c) ?? 0));
    const strength = doseResponse(d.multiple) * on * (1 - undone);
    for (const [key, effect] of Object.entries(p.effects) as [EffectKey, Effect][]) {
      if (Array.isArray(d.skip) && d.skip.includes(key)) continue;
      const current = base[key];
      if (current === undefined) continue;
      deltas[key] = (deltas[key] ?? 0) + deltaOf(effect, current + (deltas[key] ?? 0), strength);
    }
  }
  return deltas;
}

/** The vitals as they are now: the patient's own, moved by the drugs acting at this minute. */
export function withDrugEffects(vitals: Record<VitalKey, VitalPatch>, drugs: readonly ActingDrug[], clock: number): Record<VitalKey, VitalPatch> {
  const deltas = drugEffects(drugs, vitals, clock);
  if (Object.keys(deltas).length === 0) return vitals;
  const base = readEffectKeys(vitals);
  const out = { ...vitals };
  const value = (k: EffectKey) => {
    const [lo, hi] = LIMITS[k];
    return Math.min(hi, Math.max(lo, (base[k] ?? 0) + (deltas[k] ?? 0)));
  };
  if ((deltas.sbp || deltas.dbp) && base.sbp !== undefined && base.dbp !== undefined) {
    const s = Math.round(value("sbp"));
    const d = Math.round(Math.min(value("dbp"), s - 10));
    out.bp = { ...vitals.bp, value: s <= 0 ? "0/0" : `${s}/${Math.max(0, d)}` };
  }
  for (const k of ["hr", "rr", "spo2", "rbs", "gcs", "pain", "urine"] as const) {
    if (deltas[k] && base[k] !== undefined) out[k] = { ...vitals[k], value: String(Math.round(value(k))) };
  }
  if (deltas.temp && base.temp !== undefined) out.temp = { ...vitals.temp, value: value("temp").toFixed(1) };
  return out;
}

/** What the patient notices of the drugs acting now: the strongest relief of something that troubled them, if any. */
export function drugFeeling(drugs: readonly ActingDrug[], troubles: ReadonlySet<Trouble>, clock: number): string | undefined {
  let best: { says: string; on: number } | undefined;
  for (const d of drugs) {
    if (d.mode !== "given" || d.skip === "all") continue;
    const drug = formularyDrug(d.drugId);
    const p = drug && profileFor(drug);
    if (!drug || !p?.feels || !troubles.has(p.feels.when)) continue;
    const on = timeCourse(kineticsFor(drug, d.route), clock - d.at, d.overMin);
    if (on >= 0.4 && (!best || on > best.on)) best = { says: p.feels.says, on };
  }
  return best?.says;
}
