/**
 * Fluids — what an IV fluid does depends on the patient, not on the bag.
 *
 * A patient who is short of fluid (dehydration, bleeding, sepsis, DKA…) is
 * helped by it — pulse down, pressure and urine up — in proportion to how much
 * of the deficit it fills, and no further: past the deficit, fluid helps
 * nothing. What goes in beyond it, less what the kidneys clear, collects in the
 * lungs: interstitial then alveolar oedema, sooner in a failing heart, failing
 * kidneys, old age or lungs already in trouble, and sooner the faster it runs.
 *
 * Each fluid counts by what it adds to the circulation: isotonic crystalloid
 * (saline, Ringer lactate) in full; 5% dextrose about a third (the water goes
 * into the cells); 3% saline and 20% albumin several times their volume (they
 * draw water into the vessels).
 *
 * Pure functions of the case and the orders, so a case replays exactly.
 */

import type { ClinicalCaseDefinition, PatientProfile } from "./case-definition";
import type { DrugOrderContext, PhysiologySnapshot } from "./physiology";

/** IV fluid that takes the patient into overload tier `tier` — or more of it, in quantity, once they're there. */
export const fluidTier = (tier: number) => (o: DrugOrderContext, _p: PatientProfile, snap: PhysiologySnapshot) =>
  (o.drug.classes.includes("fluid") || o.drug.classes.includes("crystalloid")) && o.route === "IV" && o.mode === "given" && snap.fluid?.tier === tier && (snap.fluid.tierBefore < tier || snap.fluid.large);

/** How much of a fluid's volume ends up expanding the circulation (per mL infused). */
export function volumeFactor(drugId: string): number {
  switch (drugId) {
    case "d5":
    case "d10":
    case "dextrose-25":
      return 0.35;
    case "hypertonic-saline":
      return 3.3;
    case "albumin":
      return 4;
    default:
      return 1;
  }
}

export interface VolumeState {
  weightKg: number;
  /** What the patient is short of, in mL of circulating volume. */
  deficitMl: number;
  /** Excess (mL, beyond the deficit) at which oedema starts, floods the lungs, and becomes catastrophic. */
  mildMl: number;
  floodMl: number;
  catastropheMl: number;
  /** What the kidneys clear of an excess, mL an hour. */
  clearMlPerH: number;
  /** A heart, kidneys or lungs that won't take much fluid. */
  atRisk: boolean;
}

/** Illnesses that leave a patient short of fluid, and by how much (mL/kg) when severe. */
const DEPLETION: [RegExp, number][] = [
  [/\b(diabetic ketoacidosis|dka|hyperosmolar|hhs)\b/i, 80],
  [/\bcholera\b|\bsevere dehydration\b|\brice[- ]water\b/i, 80],
  [/\bburns?\b/i, 60],
  [/\b(haemorrhag|hemorrhag|bleed|haematemesis|hematemesis|melaena|melena|ruptured|ectopic|trauma|polytrauma|hypovol)\w*/i, 40],
  [/\b(gastroenteritis|diarrh\w*|dysentery|dehydrat\w*|vomiting|hyperemesis|intestinal obstruction|bowel obstruction|pancreatitis|peritonitis|perforat\w*)\b/i, 40],
  [/\b(septic shock|sepsis|septic|severe malaria|leptospir\w*|adrenal crisis|addisonian|heat ?stroke|anaphyla\w*|dengue shock)\b/i, 30],
  [/\bdengue\b/i, 20],
];

/** Illnesses in which fluid floods the lungs early. */
const OVERLOADING = /\b(heart failure|cardiac failure|lvf|ccf|adhf|pulmonary o?edema|cardiogenic|cardiomyopath\w*|mitral stenosis|aortic stenosis|renal failure|kidney (?:injury|failure|disease)|aki|ckd|esrd|nephrotic|nephritis|glomerulonephritis|cirrhosis|ascites|pre-?eclampsia|eclampsia|hellp|ards|respiratory distress syndrome|hypoalbumin\w*|siadh|salt poisoning|fluid overload)\b/i;
const CAPILLARY_LEAK = /\b(sepsis|septic|dengue|pancreatitis|burns?)\b/i;

/** The case's own words about the illness, for reading its fluid state when it doesn't say. */
const illness = (def: ClinicalCaseDefinition) => [def.truth.diagnosis, def.truth.qualifier ?? "", def.briefing].join(" ");

/**
 * The patient's fluid state, as the case sets it or as its illness and
 * arrival vitals show it. `extraRisk`: something since arrival makes the
 * lungs fill sooner (a salt load, oedema already started).
 */
export function volumeState(def: ClinicalCaseDefinition, vitals: { weight?: string; bp?: string; hr?: string; spo2?: string; rr?: string }, extraRisk = false): VolumeState {
  const weightKg = Math.max(3, parseFloat(vitals.weight ?? "") || 60);
  const text = illness(def);
  const sbp = parseFloat((vitals.bp ?? "").split("/")[0] ?? "") || 120;
  const hr = parseFloat(vitals.hr ?? "") || 80;
  const spo2 = parseFloat(vitals.spo2 ?? "") || 98;
  const rr = parseFloat(vitals.rr ?? "") || 16;
  const p = def.profile;

  const overloading = p.volume === "overloaded" || !!p.heartFailure || !!p.ckd || OVERLOADING.test(text);
  let deficitPerKg = 0;
  if (typeof p.fluidDeficitMlPerKg === "number") deficitPerKg = Math.max(0, p.fluidDeficitMlPerKg);
  else if (p.volume !== "overloaded" && p.volume !== "normal" && !overloading) {
    const severe = DEPLETION.find(([re]) => re.test(text))?.[1];
    const shocked = sbp < 90 || (sbp < 100 && hr > 110);
    if (severe !== undefined) deficitPerKg = shocked || /severe|shock/i.test(text) ? severe : severe / 2;
    else if (p.volume === "depleted" || shocked) deficitPerKg = 20;
  }

  const lungsInTrouble = spo2 < 92 || rr >= 28;
  const atRisk = overloading || extraRisk || def.patient.age >= 75 || lungsInTrouble;
  const leak = !atRisk && CAPILLARY_LEAK.test(text);
  const perKg = atRisk ? { mild: 10, flood: 25, catastrophe: 60 } : leak ? { mild: 25, flood: 45, catastrophe: 100 } : { mild: 35, flood: 60, catastrophe: 120 };
  const state: VolumeState = {
    weightKg,
    deficitMl: Math.round(deficitPerKg * weightKg),
    mildMl: perKg.mild * weightKg,
    floodMl: perKg.flood * weightKg,
    catastropheMl: perKg.catastrophe * weightKg,
    clearMlPerH: (p.ckd || /\b(renal failure|kidney (?:injury|failure)|aki|esrd|anuria|oliguria)\b/i.test(text) ? 0.3 : atRisk ? 0.6 : 1.6) * weightKg,
    atRisk,
  };
  // The case's own tolerance (the total a patient like this can take) is where the oedema starts.
  if (typeof p.fluidToleranceMl === "number") {
    const mild = Math.max(0, p.fluidToleranceMl - state.deficitMl);
    state.mildMl = mild;
    state.floodMl = Math.max(state.floodMl, mild + 15 * weightKg);
    state.catastropheMl = Math.max(state.catastropheMl, mild + 50 * weightKg);
  }
  return state;
}

/** One IV fluid given: when, how much, of what, and over how long. */
export interface FluidGiven {
  at: number;
  volumeMl: number;
  drugId: string;
  overMin?: number;
}

export interface FluidOutcome {
  /** How much of this order went to filling the deficit (mL, effective). */
  filledMl: number;
  /** The share of the whole deficit this order filled (0–1) — what it does for the circulation. */
  benefit: number;
  /** Excess in the circulation once this order is in, before and after it (mL). */
  excessBefore: number;
  excessAfter: number;
  /** 0 none · 1 oedema starting · 2 pulmonary oedema · 3 catastrophic — before and after this order. */
  tierBefore: number;
  tier: number;
  /** Minutes after this order started when it crossed into its tier (for the hazard's clock). */
  crossAfterMin: number;
  /** This order on its own is a large load (≥ 10 mL/kg effective). */
  large: boolean;
}

/** When a fluid is all in: a bolus in about 15 minutes unless the order said. */
const runsFor = (f: FluidGiven) => Math.max(1, f.overMin ?? 15);

/** The excess in the circulation at minute `t`, from everything given up to then. */
function excessAt(state: VolumeState, fluids: readonly FluidGiven[], t: number): number {
  const started = fluids.filter((f) => f.at <= t);
  if (started.length === 0) return 0;
  const effective = started.reduce((s, f) => s + f.volumeMl * volumeFactor(f.drugId) * Math.min(1, (t - f.at) / runsFor(f)), 0);
  const first = Math.min(...started.map((f) => f.at));
  // The kidneys only clear what's beyond the deficit, from when there is some.
  const cleared = state.clearMlPerH * (Math.max(0, t - first) / 60);
  return Math.max(0, effective - state.deficitMl - cleared);
}

/** How far into overload the patient is at minute `t` (0 none … 3 catastrophic), from what has gone in. */
export const tierAt = (state: VolumeState, fluids: readonly FluidGiven[], t: number) => tierOf(state, excessAt(state, fluids, t));

const tierOf = (state: VolumeState, excess: number) => (excess >= state.catastropheMl ? 3 : excess >= state.floodMl ? 2 : excess >= state.mildMl && excess > 0 ? 1 : 0);

/**
 * What a new IV fluid order does, given everything before it: how much of
 * the deficit it fills, and how far into overload it takes the patient.
 */
export function fluidOutcome(state: VolumeState, before: readonly FluidGiven[], order: FluidGiven): FluidOutcome {
  const factor = volumeFactor(order.drugId);
  const effective = order.volumeMl * factor;
  const givenBefore = before.reduce((s, f) => s + f.volumeMl * volumeFactor(f.drugId), 0);
  const remaining = Math.max(0, state.deficitMl - givenBefore);
  const filledMl = Math.min(effective, remaining);
  const benefit = state.deficitMl > 0 ? filledMl / state.deficitMl : 0;

  const all = [...before, order];
  const end = order.at + runsFor(order);
  const excessBefore = excessAt(state, before, order.at);
  const tierBefore = tierOf(state, excessBefore);
  // The worst point is when this order is all in.
  let excessAfter = excessAt(state, all, end);
  let tier = tierOf(state, excessAfter);
  // A large volume poured in within minutes is worse than the same volume over hours.
  const fast = runsFor(order) <= 10 && effective >= (state.atRisk ? 20 : 30) * state.weightKg;
  if (fast && tier > 0) tier = Math.min(3, tier + 1);
  if (fast && tier === 0 && excessAfter >= state.mildMl * 0.6) tier = 1;
  // When, during the infusion, the excess crossed into that tier.
  let crossAfterMin = 0;
  if (tier > tierBefore && runsFor(order) > 3) {
    const threshold = tier === 3 ? state.catastropheMl : tier === 2 ? state.floodMl : state.mildMl;
    const span = runsFor(order);
    for (let m = 1; m <= span; m += Math.max(1, Math.round(span / 30))) {
      if (excessAt(state, all, order.at + m) >= threshold * (fast ? 0.7 : 1)) {
        crossAfterMin = m;
        break;
      }
      crossAfterMin = m;
    }
  }
  excessAfter = Math.round(excessAfter);
  return { filledMl: Math.round(filledMl), benefit, excessBefore: Math.round(excessBefore), excessAfter, tierBefore, tier, crossAfterMin, large: effective >= 10 * state.weightKg };
}
