/**
 * The Skills Lab's clinical calculations: 50 calculators in 5 categories, fresh numbers every time.
 *
 * Every question goes through `numeric()`, which builds its 4 options the same way: the right answer plus
 * wrong answers that come from a named mistake (a forgotten factor, the wrong constant, an inverted ratio),
 * topped up with near neighbours. All options share one format and one number of decimals, stay within a
 * narrow band of each other, and are shuffled — so the answer can't be picked out by its size or its look.
 *
 * Formulas are pure functions, exported so tests/skills-calcs.test.ts can check them against worked examples.
 * Units are those used in India: mg/dL unless a stem says otherwise.
 */
import type { QuizQuestion } from "../skills";

/* The formulas ------------------------------------------------------------- */

export const anionGap = (na: number, cl: number, hco3: number) => na - (cl + hco3);
export const deltaRatio = (ag: number, hco3: number) => (ag - 12) / (24 - hco3);
export const wintersPaCO2 = (hco3: number) => 1.5 * hco3 + 8;
export const correctedNa = (na: number, glucose: number, factor = 1.6) => na + (factor * (glucose - 100)) / 100;
/** Fraction of body weight that is water (Adrogué & Madias). */
export const tbwFraction = (female: boolean, elderly: boolean) => (female ? (elderly ? 0.45 : 0.5) : elderly ? 0.5 : 0.6);
export const freeWaterDeficit = (weight: number, fraction: number, na: number, target = 140) => fraction * weight * (na / target - 1);
export const fena = (uNa: number, pCr: number, pNa: number, uCr: number) => ((uNa * pCr) / (pNa * uCr)) * 100;
export const cockcroftGault = (age: number, weight: number, cr: number, female: boolean, k = 140) => ((k - age) * weight * (female ? 0.85 : 1)) / (72 * cr);
export const osmolality = (na: number, glucose: number, urea: number) => 2 * na + glucose / 18 + urea / 6;
export const osmolarGap = (measured: number, na: number, glucose: number, urea: number) => measured - osmolality(na, glucose, urea);
/** Rule of thumb: about 300 mmol for each 1 mmol/L below 4.0 (Harrison's range: 200–400). */
export const potassiumDeficit = (k: number, perUnit = 300, target = 4) => perUnit * (target - k);
export const correctedCa = (ca: number, albumin: number, factor = 0.8, normal = 4) => ca + factor * (normal - albumin);

export const parklandTotal = (weight: number, tbsa: number, perKg = 4) => perKg * weight * tbsa;
export const hollidayDaily = (w: number) => Math.min(w, 10) * 100 + Math.max(0, Math.min(w, 20) - 10) * 50 + Math.max(0, w - 20) * 20;
export const hollidayHourly = (w: number) => (w <= 10 ? 4 * w : w <= 20 ? 40 + 2 * (w - 10) : 60 + (w - 20));
export const ganzoni = (weight: number, hb: number, target = 15, stores = 500, factor = 2.4) => weight * (target - hb) * factor + stores;
export const allowableBloodLoss = (ebv: number, hctStart: number, hctLowest: number) => (ebv * (hctStart - hctLowest)) / hctStart;
/** mL/h from a dose in mcg/kg/min and a concentration in mcg/mL. */
export const dripRate = (dose: number, weight: number, mcgPerMl: number) => (dose * weight * 60) / mcgPerMl;

export const meanArterial = (sbp: number, dbp: number) => (sbp + 2 * dbp) / 3;
export const alveolarO2 = (fio2: number, paco2: number, patm = 760, ph2o = 47, r = 0.8) => fio2 * (patm - ph2o) - paco2 / r;
export const aaGradient = (fio2: number, paco2: number, pao2: number) => alveolarO2(fio2, paco2) - pao2;
export const pfRatio = (pao2: number, fio2: number) => pao2 / fio2;
export const qtcBazett = (qt: number, hr: number) => qt / Math.sqrt(60 / hr);
export const qtcFridericia = (qt: number, hr: number) => qt / Math.cbrt(60 / hr);
export const predictedBodyWeight = (heightCm: number, female: boolean) => (female ? 45.5 : 50) + 0.91 * (heightCm - 152.4);
export const rsbi = (rr: number, vtMl: number) => rr / (vtMl / 1000);
export const shockIndex = (hr: number, sbp: number) => hr / sbp;
export interface WellsFlags { dvtSigns: boolean; peLikeliest: boolean; hrOver100: boolean; immobileOrSurgery: boolean; priorVte: boolean; haemoptysis: boolean; malignancy: boolean }
export const wellsPE = (f: WellsFlags) => (f.dvtSigns ? 3 : 0) + (f.peLikeliest ? 3 : 0) + (f.hrOver100 ? 1.5 : 0) + (f.immobileOrSurgery ? 1.5 : 0) + (f.priorVte ? 1.5 : 0) + (f.haemoptysis ? 1 : 0) + (f.malignancy ? 1 : 0);
export const curb65 = (confused: boolean, ureaMgDl: number, rr: number, sbp: number, dbp: number, age: number) => (confused ? 1 : 0) + (ureaMgDl > 42 ? 1 : 0) + (rr >= 30 ? 1 : 0) + (sbp < 90 || dbp <= 60 ? 1 : 0) + (age >= 65 ? 1 : 0);

export const maddrey = (pt: number, control: number, bilirubin: number, factor = 4.6) => factor * (pt - control) + bilirubin;
export const saag = (serumAlbumin: number, asciticAlbumin: number) => serumAlbumin - asciticAlbumin;
export const childPughPoints = (bili: number, alb: number, inr: number, ascites: 1 | 2 | 3, enceph: 1 | 2 | 3) => [bili < 2 ? 1 : bili <= 3 ? 2 : 3, alb > 3.5 ? 1 : alb >= 2.8 ? 2 : 3, inr < 1.7 ? 1 : inr <= 2.3 ? 2 : 3, ascites, enceph] as const;
export const childPugh = (bili: number, alb: number, inr: number, ascites: 1 | 2 | 3, enceph: 1 | 2 | 3) => childPughPoints(bili, alb, inr, ascites, enceph).reduce<number>((a, b) => a + b, 0);
/** MELD before sodium, UNOS 2016: creatinine, bilirubin and INR floored at 1, creatinine capped at 4, ×10 after rounding to a tenth. */
export const meldI = (cr: number, bili: number, inr: number) => Math.round(10 * (0.957 * Math.log(Math.min(4, Math.max(1, cr))) + 0.378 * Math.log(Math.max(1, bili)) + 1.12 * Math.log(Math.max(1, inr)) + 0.643));
/** MELD-Na, UNOS 2016: the sodium term only when MELD(i) > 11; sodium bounded to 125–137; final score 6–40. */
export const meldNa = (cr: number, bili: number, inr: number, na: number) => {
  const m = meldI(cr, bili, inr);
  const dNa = 137 - Math.min(137, Math.max(125, na));
  const out = m > 11 ? m + 1.32 * dNa - 0.033 * m * dNa : m;
  return Math.min(40, Math.max(6, Math.round(out)));
};
/** Sheiner–Tozer, normal kidney function (0.2); in end-stage kidney disease the factor is 0.1. */
export const correctedPhenytoin = (level: number, albumin: number, factor = 0.2) => level / (factor * albumin + 0.1);
export const bisap = (bun: number, gcs: number, sirs: number, age: number, effusion: boolean) => (bun > 25 ? 1 : 0) + (gcs < 15 ? 1 : 0) + (sirs >= 2 ? 1 : 0) + (age > 60 ? 1 : 0) + (effusion ? 1 : 0);
export const cerebralPerfusion = (map: number, icp: number) => map - icp;

export const bmi = (kg: number, cm: number) => kg / (cm / 100) ** 2;
export const bsaMosteller = (cm: number, kg: number) => Math.sqrt((cm * kg) / 3600);
export const sensitivity = (tp: number, fn: number) => (100 * tp) / (tp + fn);
export const specificity = (tn: number, fp: number) => (100 * tn) / (tn + fp);
export const ppv = (tp: number, fp: number) => (100 * tp) / (tp + fp);
export const npv = (tn: number, fn: number) => (100 * tn) / (tn + fn);
/** Number needed to treat, always rounded up. Event rates in %. */
export const nnt = (controlPct: number, treatedPct: number) => Math.ceil(100 / (controlPct - treatedPct) - 1e-9);
export const oddsRatio = (a: number, b: number, c: number, d: number) => (a * d) / (b * c);
export const relativeRisk = (eventsExp: number, totalExp: number, eventsUn: number, totalUn: number) => eventsExp / totalExp / (eventsUn / totalUn);
export const lrPositive = (sensPct: number, specPct: number) => sensPct / (100 - specPct);
export const lrNegative = (sensPct: number, specPct: number) => (100 - sensPct) / specPct;

const DAY = 86_400_000;
/** Dates as whole days since 1970 (UTC), so the arithmetic never meets a time zone. */
const dayOf = (y: number, m: number, d: number) => Date.UTC(y, m, d) / DAY;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dateText = (day: number) => {
  const d = new Date(day * DAY);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
/** Naegele's rule: LMP + 9 calendar months + 7 days, plus (cycle − 28) days. Works for LMP days 1–28. */
export const naegele = (y: number, m: number, d: number, cycle = 28) => dayOf(y, m + 9, d) + 7 + (cycle - 28);
export const weeksDays = (days: number) => `${Math.floor(days / 7)} weeks ${days % 7} ${days % 7 === 1 ? "day" : "days"}`;

/* Building a question ------------------------------------------------------ */

const rint = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const rdec = (lo: number, hi: number, dp = 1) => rint(Math.round(lo * 10 ** dp), Math.round(hi * 10 ** dp)) / 10 ** dp;
const coin = (p = 0.5) => Math.random() < p;
const pick = <T,>(xs: readonly T[]): T => xs[rint(0, xs.length - 1)]!;
const shuffle = <T,>(xs: readonly T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rint(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};
/** A worked answer, line by line. */
const steps = (...lines: (string | false)[]) => lines.filter(Boolean).join("\n");
const fx = (v: number, dp = 1) => v.toFixed(dp);

/** A wrong answer and the mistake that produces it. */
type Err = [number, string];

interface Spec {
  id: string;
  stem: string;
  right: number;
  errors: Err[];
  explain: string;
  source: string;
  unit?: string;
  /** Decimals shown; every option has exactly this many. */
  dp?: number;
  /** All options sit on multiples of this (a measurable dose, half points on a score). */
  snap?: number;
  lo?: number;
  hi?: number;
  /** Spacing of the near-neighbour options. */
  grain?: number;
  /** Largest ÷ smallest allowed among the options; 0 for scores and dates, where a ratio means nothing. */
  ratio?: number;
  /** Shows a value in full, instead of number + unit (dates, weeks and days). */
  show?: (v: number) => string;
}

/** Options from the outermost allowed band: largest ÷ smallest stays under this unless a calculator says otherwise. */
const MAX_RATIO = 2.8;

function numeric(s: Spec): QuizQuestion {
  const dp = s.dp ?? 0;
  const unit = s.unit ?? "";
  const ratio = s.ratio ?? MAX_RATIO;
  const clean = (v: number) => {
    const snapped = s.snap ? Math.round(v / s.snap) * s.snap : v;
    return Number(snapped.toFixed(dp));
  };
  const show = s.show ?? ((v: number) => `${v.toFixed(dp)}${unit}`);
  const step = s.snap ?? 10 ** -dp;
  const lo = s.lo ?? step;
  const hi = s.hi ?? Infinity;
  const rightV = clean(s.right);
  const rightT = show(rightV);
  const grain = Math.max(step, s.grain ?? Math.abs(rightV) * 0.08);
  const slip = `A slip in the arithmetic — worked step by step it comes to ${rightT}.`;

  type Opt = { v: number; t: string; why: string };
  const right: Opt = { v: rightV, t: rightT, why: "" };
  let chosen: Opt[] = [right];
  const fits = (v: number, others: Opt[]) => {
    if (!Number.isFinite(v) || v < lo || v > hi) return false;
    if (others.some((o) => o.t === show(v))) return false;
    if (!ratio) return true;
    const vs = [v, ...others.map((o) => o.v)];
    return Math.min(...vs) > 0 && Math.max(...vs) / Math.min(...vs) <= ratio;
  };
  const add = (raw: number, why: string) => {
    const v = clean(raw);
    if (chosen.length < 4 && fits(v, chosen)) chosen.push({ v, t: show(v), why });
  };
  for (const [v, why] of shuffle(s.errors)) add(v, why);
  for (let spread = 1; chosen.length < 4 && spread < 40; spread++) {
    const k = coin() ? spread : -spread;
    for (const dir of [k, -k]) add(rightV + dir * grain + (Math.random() - 0.5) * grain * 0.6, slip);
  }
  // Small numbers on a coarse grain can run out of room: fall back to the smallest step.
  for (let spread = 1; chosen.length < 4 && spread < 200; spread++) for (const dir of [spread, -spread]) add(rightV + dir * step, slip);
  // Keep the right answer from always being the biggest or the smallest: move one option to its other side.
  const below = chosen.filter((o) => o.v < rightV).length;
  if ((below === 0 || below === 3) && coin(0.6)) {
    const drop = chosen.filter((o) => o !== right).sort((a, b) => Math.abs(b.v - rightV) - Math.abs(a.v - rightV))[0]!;
    const rest = chosen.filter((o) => o !== drop);
    for (let spread = 1; spread <= 4; spread++) {
      const v = clean(rightV + (below === 0 ? -1 : 1) * spread * grain);
      if (fits(v, rest) && (below === 0 ? v < rightV : v > rightV)) {
        chosen = [...rest, { v, t: show(v), why: slip }];
        break;
      }
    }
  }
  const opts = shuffle(chosen);
  return { id: s.id, stem: s.stem.replace(/\b([Aa]) (8|11|18|8\d)(?=[ -])/g, "$1n $2"), options: opts.map((o) => o.t), answer: opts.indexOf(right), explain: s.explain, whyNot: opts.map((o) => o.why), source: s.source };
}

/** Wrong totals from a scored list: a point missed, or a point given that isn't earned. */
const scoreErrors = (total: number, items: { name: string; pts: number; on: boolean }[]): Err[] =>
  items.map((i) => (i.on ? [total - i.pts, `Missed ${i.name} (${i.pts} ${i.pts === 1 ? "point" : "points"}).`] : [total + i.pts, `Counted ${i.name}, which isn't met here.`]));

/* Kidney, acid-base & salts ------------------------------------------------ */

const kidney: (() => QuizQuestion)[] = [
  () => {
    let na = 0, cl = 0, hco3 = 0, ag = 0;
    do {
      na = rint(128, 146); hco3 = rint(8, 26); ag = rint(6, 30); cl = na - hco3 - ag;
    } while (cl < 90 || cl > 114);
    const k = rdec(3.2, 5.8);
    return numeric({ id: "ag", stem: `Sodium ${na}, potassium ${fx(k)}, chloride ${cl}, bicarbonate ${hco3} mmol/L. The anion gap (standard form, without potassium)?`, right: anionGap(na, cl, hco3), unit: " mmol/L", lo: 2, grain: 2, errors: [
      [ag + k, "Added potassium — the (Na + K) form runs about 4 higher and has a different normal range."],
      [ag + 2.5, "Added an albumin correction, but no albumin was given to correct for."],
    ], source: "Harrison's Principles of Internal Medicine", explain: steps(
      `Anion gap = Na − (Cl + HCO₃).`,
      `= ${na} − (${cl} + ${hco3}) = ${na} − ${cl + hco3} = **${ag} mmol/L**.`,
      `Normal is about 8–12 mmol/L.`,
      ag > 12 ? `What it means: a raised gap — unmeasured acids. Think DKA, lactic acidosis, renal failure, or toxins (methanol, ethylene glycol, salicylates).` : hco3 < 22 ? `What it means: a normal gap with a low bicarbonate — a hyperchloraemic acidosis: diarrhoea, renal tubular acidosis, or large volumes of saline.` : `What it means: a normal gap, and the bicarbonate isn't low — no metabolic acidosis on these numbers.`,
      `Trap: a low albumin hides a raised gap. Correct it: add 2.5 for every 1 g/dL that albumin is below 4.`,
    ) });
  },
  () => {
    let na = 0, cl = 0, hco3 = 0, ag = 0, dr = 0;
    do {
      na = rint(128, 146); hco3 = rint(5, 20); ag = rint(17, 36); cl = na - hco3 - ag; dr = deltaRatio(ag, hco3);
    } while (cl < 88 || cl > 112 || dr < 0.3 || dr > 3.5);
    return numeric({ id: "delta", stem: `Sodium ${na}, chloride ${cl}, bicarbonate ${hco3} mmol/L, normal albumin. The delta ratio?`, right: dr, dp: 2, lo: 0.1, grain: 0.15, errors: [
      [(ag - 8) / (24 - hco3), "Took the normal gap as 8 instead of 12."],
      [(ag - 12) / (28 - hco3), "Took the normal bicarbonate as 28 instead of 24."],
      [(24 - hco3) / (ag - 12), "Inverted the ratio — it is the rise in gap over the fall in bicarbonate."],
      [(ag - 10) / (24 - hco3), "Took the normal gap as 10 instead of 12."],
    ], source: "Harrison's; Rastegar, J Am Soc Nephrol 2007", explain: steps(
      `Anion gap = Na − (Cl + HCO₃) = ${na} − (${cl} + ${hco3}) = ${ag}.`,
      `Delta ratio = (AG − 12) ÷ (24 − HCO₃).`,
      `= (${ag} − 12) ÷ (24 − ${hco3}) = ${ag - 12} ÷ ${24 - hco3} = **${fx(dr, 2)}**.`,
      `What it means: ${dr < 0.4 ? "under 0.4 — mostly a normal-gap (hyperchloraemic) acidosis." : dr < 1 ? "0.4–1 — a raised-gap acidosis mixed with a normal-gap acidosis." : dr <= 2 ? "1–2 — a pure raised-gap acidosis." : "over 2 — a raised-gap acidosis with bicarbonate higher than expected: a metabolic alkalosis on top, or a chronic respiratory acidosis."}`,
      `Trap: it's a guide, not a diagnosis — the normal values vary, and a low albumin must be corrected first.`,
    ) });
  },
  () => {
    const hco3 = rint(5, 20);
    const pa = wintersPaCO2(hco3);
    return numeric({ id: "winters", stem: `Metabolic acidosis with bicarbonate ${hco3} mmol/L. The expected PaCO₂ (central value, Winter's formula)?`, right: pa, dp: 1, snap: 0.5, unit: " mmHg", grain: 1.5, errors: [
      [pa + 2, "That's the top of the ±2 range, not the central value."],
      [pa - 2, "That's the bottom of the ±2 range, not the central value."],
      [0.7 * hco3 + 20, "Used the metabolic alkalosis formula (0.7 × HCO₃ + 20)."],
      [1.5 * hco3 + 2, "Added 2 instead of 8 — the 2 is the allowed range, not the constant."],
      [1.2 * hco3 + 8, "Used 1.2 as the multiplier instead of 1.5."],
    ], source: "Albert, Dell & Winters 1967; Harrison's", explain: steps(
      `Winter's formula: expected PaCO₂ = 1.5 × HCO₃ + 8 (± 2).`,
      `= 1.5 × ${hco3} + 8 = ${fx(1.5 * hco3)} + 8 = **${fx(pa)} mmHg** (range ${fx(pa - 2)}–${fx(pa + 2)}).`,
      `What it means: a measured PaCO₂ above the range is a respiratory acidosis as well; below it, a respiratory alkalosis as well.`,
      `Trap: a "normal" PaCO₂ of 40 in severe acidosis is not normal — the patient is tiring.`,
    ) });
  },
  () => {
    const na = rint(126, 136), glu = rint(300, 900);
    const add = 1.6 * ((glu - 100) / 100);
    const corr = Math.round(na + add);
    return numeric({ id: "na", stem: `Sodium ${na} mmol/L with glucose ${glu} mg/dL. The corrected sodium (Katz, factor 1.6)?`, right: correctedNa(na, glu), unit: " mmol/L", grain: 3, errors: [
      [correctedNa(na, glu, 2.4), "Used the Hillier factor 2.4 — the question asks for Katz's 1.6."],
      [na + (1.6 * glu) / 100, "Forgot to subtract the normal glucose of 100 first."],
      [correctedNa(na, glu, 1), "Used a factor of 1 instead of 1.6."],
      [na - add, "Subtracted the correction — high glucose lowers the measured sodium, so the correction is added."],
    ], source: "Katz correction; JBDS DKA guideline", explain: steps(
      `Corrected Na = measured Na + 1.6 × (glucose − 100) ÷ 100 (glucose in mg/dL).`,
      `= ${na} + 1.6 × (${glu} − 100) ÷ 100 = ${na} + 1.6 × ${fx((glu - 100) / 100)} = ${na} + ${fx(add)} ≈ **${corr} mmol/L**.`,
      `Why: high glucose pulls water out of cells and dilutes the sodium — the low reading isn't a true sodium deficit.`,
      `What it means: ${corr > 145 ? "the true sodium is high — there's a large water deficit; correct slowly." : corr >= 135 ? "the true sodium is normal — the low reading was dilution from the glucose." : "the true sodium is still low — a real hyponatraemia on top of the hyperglycaemia."}`,
      `Trap: when glucose is above about 400 mg/dL, a factor of 2.4 (Hillier) fits better; and the corrected sodium should not fall during treatment — a fall raises the risk of cerebral oedema.`,
    ) });
  },
  () => {
    const female = coin(), elderly = coin(), age = elderly ? rint(66, 88) : rint(25, 60), wt = rint(45, 85), na = rint(150, 172);
    const f = tbwFraction(female, elderly);
    const d = freeWaterDeficit(wt, f, na);
    const alt = f === 0.6 ? 0.5 : 0.6;
    return numeric({ id: "fwd", stem: `A ${age}-year-old ${female ? "woman" : "man"}, ${wt} kg, sodium ${na} mmol/L. Free water deficit (target sodium 140)?`, right: d, dp: 1, unit: " L", lo: 0.5, grain: 0.5, errors: [
      [freeWaterDeficit(wt, alt, na), `Used ${alt} of body weight as total body water; ${elderly ? "an older" : "a younger"} ${female ? "woman" : "man"} is ${f}.`],
      [freeWaterDeficit(wt, f, na, 145), "Aimed for a sodium of 145 instead of 140."],
      [freeWaterDeficit(wt, f === 0.45 ? 0.5 : 0.45, na), `Used ${f === 0.45 ? 0.5 : 0.45} of body weight instead of ${f}.`],
      [f * wt * ((na - 140) / na), "Divided by the patient's sodium instead of 140."],
    ], source: "Adrogué & Madias, NEJM 2000", explain: steps(
      `Free water deficit = total body water × (Na ÷ 140 − 1).`,
      `Total body water = ${f} × weight (${elderly ? "older" : "younger"} ${female ? "woman" : "man"}) = ${f} × ${wt} = ${fx(f * wt)} L.`,
      `Na ÷ 140 − 1 = ${na} ÷ 140 − 1 = ${fx(na / 140 - 1, 3)}.`,
      `${fx(f * wt)} × ${fx(na / 140 - 1, 3)} = **${fx(d)} L**.`,
      `Trap: this doesn't count ongoing losses — add them. In chronic hypernatraemia, lower the sodium by no more than about 10–12 mmol/L in 24 hours.`,
    ) });
  },
  () => {
    const prerenal = coin();
    let una = 0, pcr = 0, pna = 0, ucr = 0, v = 0;
    do {
      pna = rint(128, 148);
      una = prerenal ? rint(8, 25) : rint(35, 90);
      pcr = prerenal ? rdec(1.3, 3) : rdec(2, 6);
      ucr = prerenal ? rint(70, 200) : rint(20, 70);
      v = fena(una, pcr, pna, ucr);
    } while (v < 0.45 || v > 12);
    return numeric({ id: "fena", stem: `Plasma Na ${pna} mmol/L, creatinine ${fx(pcr)} mg/dL; urine Na ${una} mmol/L, urine creatinine ${ucr} mg/dL. FENa?`, right: v, dp: 1, unit: "%", grain: Math.max(0.1, v * 0.15), errors: [
      [fena(una, Math.round(pcr), pna, ucr), "Rounded the plasma creatinine to a whole number first."],
      [fena(una, pcr, 100, ucr), "Left out the plasma sodium (took it as 100)."],
    ], source: "KDIGO AKI guideline", explain: steps(
      `FENa = (urine Na × plasma Cr) ÷ (plasma Na × urine Cr) × 100.`,
      `Top: ${una} × ${fx(pcr)} = ${fx(una * pcr)}.`,
      `Bottom: ${pna} × ${ucr} = ${pna * ucr}.`,
      `${fx(una * pcr)} ÷ ${pna * ucr} × 100 = **${fx(v)}%**.`,
      `What it means: ${v < 1 ? "under 1% — prerenal (the kidney is holding salt)." : v > 2 ? "over 2% — intrinsic renal injury (ATN)." : "1–2% — indeterminate."}`,
      `Trap: diuretics raise FENa — use FEUrea (under 35% suggests prerenal) instead.`,
    ) });
  },
  () => {
    const age = rint(40, 85), wt = rint(45, 90), cr = rdec(0.9, 3), female = coin();
    const top = (140 - age) * wt * (female ? 0.85 : 1);
    const crcl = cockcroftGault(age, wt, cr, female);
    const r = Math.round(crcl);
    return numeric({ id: "crcl", stem: `A ${age}-year-old ${female ? "woman" : "man"}, ${wt} kg, serum creatinine ${fx(cr)} mg/dL. Creatinine clearance (Cockcroft–Gault)?`, right: crcl, unit: " mL/min", errors: [
      [cockcroftGault(age, wt, cr, !female), female ? "Forgot the × 0.85 for a woman." : "Applied the × 0.85 that is only for women."],
      [cockcroftGault(age, wt, cr, female, 130), "Used 130 instead of 140 in (140 − age)."],
      [cockcroftGault(age, wt, cr, female, 150), "Used 150 instead of 140 in (140 − age)."],
      [(top / (60 * cr)), "Divided by 60 instead of 72."],
      [(top / (85 * cr)), "Divided by 85 instead of 72."],
    ], source: "Cockcroft & Gault 1976; BNF", explain: steps(
      `Cockcroft–Gault: CrCl = (140 − age) × weight (kg)${female ? " × 0.85 (female)" : ""} ÷ (72 × creatinine in mg/dL).`,
      `Top: (140 − ${age}) × ${wt}${female ? " × 0.85" : ""} = ${Math.round(top)}.`,
      `Bottom: 72 × ${fx(cr)} = ${fx(72 * cr)}.`,
      `${Math.round(top)} ÷ ${fx(72 * cr)} ≈ **${r} mL/min**.`,
      `What it means: ${r >= 60 ? "60 or more — most drugs at normal doses." : r >= 30 ? "30–59 — many drugs need a lower dose or longer interval (e.g. some antibiotics, DOACs); check the BNF." : r >= 15 ? "15–29 — severe impairment: reduce or avoid renally cleared drugs (metformin, nitrofurantoin, some DOACs)." : "below 15 — kidney failure: specialist dosing, many drugs contraindicated."}`,
      `Trap: it's only valid when creatinine is stable (not in AKI), and it overestimates in the very obese and in frail elderly people with little muscle.`,
    ) });
  },
  () => {
    const na = rint(130, 150), glu = rint(80, 600), urea = rint(15, 120);
    const osm = osmolality(na, glu, urea);
    const r = Math.round(osm);
    return numeric({ id: "osm", stem: `Na ${na} mmol/L, glucose ${glu} mg/dL, urea ${urea} mg/dL. Calculated serum osmolality?`, right: osm, unit: " mOsm/kg", grain: 6, errors: [
      [2 * na + glu / 18 + urea / 2.8, "Divided urea by 2.8 — that divisor is for BUN; urea in mg/dL is divided by 6."],
      [2 * na + glu / 18, "Left out urea (that's effective osmolality, or tonicity)."],
      [2 * na + glu / 10 + urea / 6, "Divided glucose by 10 instead of 18."],
      [2 * na + urea / 6, "Left out glucose."],
    ], source: "JBDS HHS guideline", explain: steps(
      `Osmolality = 2 × Na + glucose ÷ 18 + urea ÷ 6 (glucose and urea in mg/dL).`,
      `= 2 × ${na} + ${glu} ÷ 18 + ${urea} ÷ 6 = ${2 * na} + ${fx(glu / 18)} + ${fx(urea / 6)} ≈ **${r} mOsm/kg**.`,
      `What it means: ${r > 320 ? "above 320 — think HHS; correct slowly." : r < 275 ? "low — a true hypotonic state." : "the normal range is 275–295."}`,
      `Trap: if measured osmolality is more than 10 above this, think toxic alcohols (osmolar gap).`,
    ) });
  },
  () => {
    const na = rint(130, 148), glu = rint(80, 300), urea = rint(15, 70), gap = rint(14, 60);
    const calc = osmolality(na, glu, urea);
    const meas = Math.round(calc + gap);
    const g = osmolarGap(meas, na, glu, urea);
    return numeric({ id: "osm-gap", stem: `Illicit liquor drinker: measured osmolality ${meas} mOsm/kg; Na ${na} mmol/L, glucose ${glu} mg/dL, urea ${urea} mg/dL. The osmolar gap?`, right: g, unit: " mOsm/kg", lo: 2, grain: 4, errors: [
      [meas - (2 * na + glu / 18 + urea / 2.8), "Divided urea by 2.8 — that's for BUN."],
      [meas - (2 * na + glu / 18), "Left urea out of the calculated osmolality."],
      [meas - (2 * na + urea / 6), "Left glucose out of the calculated osmolality."],
      [meas - (2 * na + glu / 10 + urea / 6), "Divided glucose by 10 instead of 18."],
    ], source: "Harrison's; EXTRIP toxic alcohol recommendations", explain: steps(
      `Calculated osmolality = 2 × Na + glucose ÷ 18 + urea ÷ 6.`,
      `= ${2 * na} + ${fx(glu / 18)} + ${fx(urea / 6)} = ${fx(calc)}.`,
      `Osmolar gap = measured − calculated = ${meas} − ${fx(calc)} ≈ **${Math.round(g)} mOsm/kg**.`,
      `What it means: ${g > 10 ? "above 10 — an unmeasured osmole: methanol, ethylene glycol, ethanol, isopropanol, mannitol." : "10 or less — normal."}`,
      `Trap: a normal gap does not rule out late toxic alcohol poisoning — the parent alcohol has already become acid, so the anion gap rises as the osmolar gap falls.`,
    ) });
  },
  () => {
    const k = rdec(2, 3.4);
    const d = potassiumDeficit(k);
    return numeric({ id: "k-deficit", stem: `Potassium ${fx(k)} mmol/L with a normal pH. Using the rule of thumb of 300 mmol for each 1 mmol/L below 4.0, the approximate total potassium deficit?`, right: d, unit: " mmol", snap: 10, errors: [
      [potassiumDeficit(k, 200), "Used 200 mmol per 1 mmol/L — the low end of the range, not the rule stated."],
      [potassiumDeficit(k, 400), "Used 400 mmol per 1 mmol/L — the high end of the range, not the rule stated."],
      [potassiumDeficit(k, 300, 3.5), "Counted down from 3.5 instead of 4.0."],
      [potassiumDeficit(k, 300, 5), "Counted down from 5.0 instead of 4.0."],
    ], source: "Harrison's: deficit about 200–400 mmol per 1 mmol/L fall", explain: steps(
      `Rule of thumb (approximate): deficit ≈ 300 mmol × (4.0 − K).`,
      `= 300 × (4.0 − ${fx(k)}) = 300 × ${fx(4 - k)} = **${Math.round(d / 10) * 10} mmol**.`,
      `This is an estimate only: the true range is about 200–400 mmol per 1 mmol/L, and it depends on muscle mass and acid-base state.`,
      `Giving it: repeat the level and replace in stages — usually no faster than 10 mmol/h by a peripheral line (up to 20 mmol/h with cardiac monitoring).`,
      `Trap: check and correct magnesium, or the potassium won't hold; and in DKA the serum level hides a far larger deficit.`,
    ) });
  },
  () => {
    const ca = rdec(7, 9), alb = rdec(1.8, 3.4);
    const add = 0.8 * (4 - alb);
    const v = correctedCa(ca, alb);
    const corr = Number(fx(v));
    return numeric({ id: "ca", stem: `Calcium ${fx(ca)} mg/dL with albumin ${fx(alb)} g/dL. The corrected calcium?`, right: v, dp: 1, unit: " mg/dL", grain: 0.3, errors: [
      [ca, "Didn't correct at all — that's the measured value."],
      [correctedCa(ca, alb, 0.4), "Used 0.4 per g/dL instead of 0.8."],
      [correctedCa(ca, alb, 1), "Used 1.0 per g/dL instead of 0.8."],
      [correctedCa(ca, alb, 0.8, 3.5), "Took the normal albumin as 3.5 instead of 4."],
      [correctedCa(ca, alb, 0.8, 4.5), "Took the normal albumin as 4.5 instead of 4."],
    ], source: "Harrison's Principles of Internal Medicine", explain: steps(
      `Corrected Ca = measured Ca + 0.8 × (4 − albumin in g/dL).`,
      `= ${fx(ca)} + 0.8 × (4 − ${fx(alb)}) = ${fx(ca)} + 0.8 × ${fx(4 - alb)} = ${fx(ca)} + ${fx(add, 2)} ≈ **${fx(corr)} mg/dL**.`,
      `Normal is about 8.5–10.5 mg/dL.`,
      `What it means: ${corr < 8.5 ? "true hypocalcaemia even after correction — look for tetany and a long QT, and check magnesium, phosphate and PTH." : corr > 10.5 ? "hypercalcaemia once corrected — think of hyperparathyroidism or malignancy." : "normal once corrected — the low total calcium was mostly from the low albumin."}`,
      `Trap: in the critically ill, and with acid–base disturbance, the formula is unreliable — measure ionised calcium.`,
    ) });
  },
];

/* Fluids, burns & dosing --------------------------------------------------- */

/** Weight-based doses. Each alternative is a per-kg figure someone could mistake for the right one. */
const DRUG_DOSES: { drug: string; use: string; perKg: number; lo: number; hi: number; dp: number; alts: [number, string][]; src: string; note: string }[] = [
  { drug: "phenytoin", use: "a loading dose in status epilepticus", perKg: 20, lo: 45, hi: 90, dp: 0, src: "ILAE; AES status epilepticus guideline 2016", note: "Give no faster than 50 mg/min, on a monitor.", alts: [[15, "the low end of the range, not the dose asked"], [25, "more than the dose asked"], [18, "not the dose asked"]] },
  { drug: "levetiracetam", use: "second-line treatment of status epilepticus", perKg: 60, lo: 40, hi: 70, dp: 0, src: "ESETT, NEJM 2019; AES 2016", note: "The maximum is 4500 mg.", alts: [[40, "an older, lower regimen"], [50, "not the dose asked"], [80, "more than the dose asked"]] },
  { drug: "amikacin", use: "a once-daily dose", perKg: 15, lo: 40, hi: 80, dp: 0, src: "BNF; National Treatment Guidelines for Antimicrobial Use (NCDC India)", note: "Adjust to creatinine clearance and to levels.", alts: [[10, "the lower range, not the dose asked"], [20, "the higher range, not the dose asked"], [12, "not the dose asked"]] },
  { drug: "ceftriaxone", use: "a child's daily dose", perKg: 50, lo: 6, hi: 30, dp: 0, src: "IAP; BNF for Children", note: "Meningitis doses are higher, up to 100 mg/kg/day.", alts: [[75, "a higher regimen, not the dose asked"], [100, "the meningitis dose, not the dose asked"], [40, "not the dose asked"]] },
  { drug: "alteplase", use: "the total dose in ischaemic stroke", perKg: 0.9, lo: 45, hi: 90, dp: 1, src: "AHA/ASA acute ischaemic stroke guideline 2019", note: "The maximum is 90 mg; 10% as a bolus, the rest over 60 minutes.", alts: [[0.6, "the low-dose trial regimen, not the dose asked"], [1, "more than the dose asked"], [0.8, "not the dose asked"]] },
  { drug: "artesunate", use: "a dose in severe malaria", perKg: 2.4, lo: 40, hi: 80, dp: 1, src: "WHO Guidelines for malaria; NVBDCP India", note: "Children under 20 kg get 3 mg/kg.", alts: [[3, "the dose for children under 20 kg"], [2, "not the dose asked"], [1.2, "half the dose asked"]] },
  { drug: "vancomycin", use: "a loading dose in a seriously ill patient", perKg: 25, lo: 45, hi: 90, dp: 0, src: "ASHP/IDSA vancomycin guideline 2020", note: "Then dose by levels or AUC.", alts: [[15, "the usual maintenance dose, not the load"], [20, "the low end of the range, not the dose asked"], [30, "more than the dose asked"]] },
];

const fluids: (() => QuizQuestion)[] = [
  () => {
    const wt = rint(50, 90), tbsa = rint(15, 50);
    const total = parklandTotal(wt, tbsa), first = total / 2;
    return numeric({ id: "parkland", stem: `A ${wt} kg adult with ${tbsa}% burns. Parkland fluid in the first 8 hours from the burn?`, right: first, unit: " mL", errors: [
      [total, "That's the full 24-hour volume; only half goes in the first 8 hours."],
      [parklandTotal(wt, tbsa, 3) / 2, "Used 3 mL/kg/% instead of Parkland's 4."],
      [total / 3, "Gave a third in the first 8 hours instead of half."],
      [total * 0.75, "Gave three-quarters in the first 8 hours instead of half."],
    ], source: "ATLS; ANZBA EMSB", explain: steps(
      `Parkland = 4 mL × kg × %TBSA in 24 h; half in the first 8 h from the time of the burn.`,
      `4 × ${wt} × ${tbsa} = ${total} mL; half = **${first} mL**.`,
      `The other ${first} mL goes in over the next 16 h.`,
      `Trap: count from the time of injury, not arrival — and titrate to urine output (0.5 mL/kg/h). ATLS 10th edition uses 2 mL/kg/%TBSA for adult thermal burns; this question asks for classic Parkland.`,
    ) });
  },
  () => {
    const wt = rint(50, 90), tbsa = rint(15, 50), early = coin(), late = rint(1, 3);
    const total = parklandTotal(wt, tbsa);
    const half = total / 2;
    const r = early ? half / (8 - late) : half / 16;
    const errors: Err[] = early
      ? [[half / 8, `Ignored the ${late} hours already lost; the 8 hours count from the burn, so it goes in over ${8 - late} h.`], [total / 24, "Spread the whole volume evenly over 24 hours."], [half / (8 - late + 1), "Miscounted the hours left by one."], [half / (8 + late), `Added the ${late} hours instead of taking them away.`]]
      : [[half / 8, "That's the rate for the first 8 hours, not the next 16."], [total / 24, "Spread the whole volume evenly over 24 hours."], [half / 12, "Divided by 12 hours instead of 16."]];
    return numeric({ id: "parkland-rate", stem: early
      ? `A ${wt} kg adult with ${tbsa}% burns arrives ${late} ${late === 1 ? "hour" : "hours"} after the burn, with no fluid given yet. The Parkland rate until the 8-hour mark?`
      : `A ${wt} kg adult with ${tbsa}% burns has had the first 8 hours of Parkland fluid on time. The rate for the next 16 hours?`, right: r, unit: " mL/h", errors, source: "ATLS; ANZBA EMSB", explain: steps(
      `Parkland total = 4 × ${wt} × ${tbsa} = ${total} mL; half = ${half} mL.`,
      early ? `The first half is due by 8 h from the burn, and ${late} ${late === 1 ? "hour has" : "hours have"} gone: ${half} ÷ (8 − ${late}) = ${half} ÷ ${8 - late} ≈ **${Math.round(r)} mL/h**.` : `The second half runs over the next 16 h: ${half} ÷ 16 ≈ **${Math.round(r)} mL/h**.`,
      `Trap: the formula only sets the starting rate — adjust hourly to urine output (0.5 mL/kg/h in adults). Both halves are the same volume, but the second rate is half the first.`,
    ) });
  },
  () => {
    const wt = rint(4, 40);
    const a = Math.min(wt, 10) * 100, b = Math.max(0, Math.min(wt, 20) - 10) * 50, c = Math.max(0, wt - 20) * 20;
    const ml = hollidayDaily(wt);
    const errors: Err[] = wt <= 10
      ? [[wt * 80, "Used 80 mL/kg instead of 100."], [wt * 120, "Used 120 mL/kg instead of 100."], [wt * 150, "Used a neonatal 150 mL/kg."]]
      : [[wt * 100, "Used 100 mL/kg for all the weight, not just the first 10 kg."], [1000 + (wt - 10) * 20, "Used 20 mL/kg straight after the first 10 kg, skipping the 50 mL/kg band."], [wt <= 20 ? wt * 80 : 1500 + (wt - 20) * 50, wt <= 20 ? "Used a flat 80 mL/kg." : "Kept 50 mL/kg above 20 kg instead of dropping to 20."]];
    return numeric({ id: "hs", stem: `A ${wt} kg child needs maintenance fluids. Daily volume (Holliday–Segar)?`, right: ml, unit: " mL/day", snap: 10, errors, source: "Holliday & Segar; NICE NG29; IAP", explain: steps(
      `Holliday–Segar: 100 mL/kg/day for the first 10 kg, 50 mL/kg/day for the next 10 kg, 20 mL/kg/day for every kg above 20.`,
      `• First ${Math.min(wt, 10)} kg × 100 = ${a} mL`,
      wt > 10 && `• Next ${Math.min(wt, 20) - 10} kg × 50 = ${b} mL`,
      wt > 20 && `• Remaining ${wt - 20} kg × 20 = ${c} mL`,
      `Total: **${ml} mL/day** ≈ ${Math.round(ml / 24)} mL/hour.`,
      `Fluid: an isotonic solution (e.g. 0.9% saline with 5% dextrose), checking sodium and glucose at least daily.`,
      `Trap: this is maintenance only — add any deficit and ongoing losses separately, and restrict to about two-thirds in meningitis, pneumonia or after surgery (risk of low sodium).`,
    ) });
  },
  () => {
    const wt = rint(4, 40);
    const rate = hollidayHourly(wt);
    const errors: Err[] = wt <= 10
      ? [[wt * 3, "Used 3 mL/kg/h instead of 4."], [wt * 5, "Used 5 mL/kg/h instead of 4."], [wt * 6, "Used 6 mL/kg/h instead of 4."]]
      : [[wt * 4, "Used 4 mL/kg/h for all the weight, not just the first 10 kg."], [40 + (wt - 10), "Used 1 mL/kg/h straight after the first 10 kg, skipping the 2 mL/kg/h band."], [wt <= 20 ? wt * 3 : 60 + (wt - 20) * 2, wt <= 20 ? "Used a flat 3 mL/kg/h." : "Kept 2 mL/kg/h above 20 kg instead of dropping to 1."], [wt > 20 ? wt + 30 : wt * 5, wt > 20 ? "Added 30 to the weight — the shortcut above 20 kg is weight + 40." : "Used 5 mL/kg/h for all the weight."]];
    return numeric({ id: "maint", stem: `A ${wt} kg child is nil by mouth. Maintenance fluid rate (Holliday–Segar, 4-2-1)?`, right: rate, unit: " mL/h", errors, source: "NICE NG29 IV fluids in children", explain: steps(
      `4-2-1 rule: 4 mL/kg/h for the first 10 kg, 2 mL/kg/h for the next 10 kg, 1 mL/kg/h for each kg above 20.`,
      wt <= 10 ? `${wt} × 4 = **${rate} mL/h**.` : wt <= 20 ? `40 + (${wt} − 10) × 2 = **${rate} mL/h**.` : `40 + 20 + (${wt} − 20) × 1 = **${rate} mL/h**.`,
      `Fluid: an isotonic one (0.9% saline with 5% dextrose).`,
      `Trap: many sick children (meningitis, pneumonia, post-op) need less — they hold water (ADH).`,
    ) });
  },
  () => {
    const wt = rint(6, 30);
    const dose = Math.round((15 * wt) / 10) * 10;
    return numeric({ id: "pcm", stem: `A ${wt} kg child with fever. One dose of paracetamol at 15 mg/kg, rounded to the nearest 10 mg?`, right: dose, unit: " mg", snap: 10, grain: 20, errors: [
      [10 * wt, "Used 10 mg/kg instead of the 15 mg/kg asked."],
      [20 * wt, "Used 20 mg/kg, above a safe single dose."],
      [12.5 * wt, "Used 12.5 mg/kg instead of 15."],
    ], source: "IAP; BNF for Children", explain: steps(
      `Dose = 15 mg/kg × weight.`,
      15 * wt === dose ? `15 × ${wt} kg = **${dose} mg**.` : `15 × ${wt} kg = ${15 * wt} mg → rounded to a measurable **${dose} mg**.`,
      `As syrup: 120 mg/5 mL → ${fx(dose / 24)} mL; 250 mg/5 mL → ${fx(dose / 50)} mL.`,
      `How often: every 4–6 hours, no more than 4 doses in 24 hours (at most 60 mg/kg/day).`,
      `Trap: check the strength on the bottle (drops, 120 and 250 mg/5 mL syrups differ), and ask what was already given at home — overdose is usually from double-dosing.`,
    ) });
  },
  () => {
    const wt = rint(8, 30);
    const dose = wt * 0.01;
    return numeric({ id: "adr-paed", stem: `A ${wt} kg child in anaphylaxis. IM adrenaline dose (1 mg/mL)?`, right: dose, dp: 2, unit: " mg", lo: 0.02, errors: [
      [wt * 0.015, "Used 0.015 mg/kg instead of 0.01."],
      [wt * 0.02, "Used 0.02 mg/kg — double the dose."],
      [wt * 0.005, "Used 0.005 mg/kg — half the dose."],
      [wt * 0.0075, "Used 0.0075 mg/kg instead of 0.01."],
    ], source: "Resuscitation Council UK 2021", explain: steps(
      `IM adrenaline = 0.01 mg/kg of 1 mg/mL (1:1000), max 0.5 mg.`,
      `${wt} × 0.01 = **${fx(dose, 2)} mg** = ${fx(dose, 2)} mL of 1:1000.`,
      `Trap: the ten-times error — 1:10,000 is the IV arrest strength, never for IM use.`,
    ) });
  },
  () => {
    const d = pick(DRUG_DOSES);
    const wt = rint(d.lo, d.hi);
    const dose = d.perKg * wt;
    return numeric({ id: "drug-dose", stem: `${d.drug[0]!.toUpperCase()}${d.drug.slice(1)}, ${d.use}, for a ${wt} kg patient, at ${d.perKg} mg/kg. How much?`, right: dose, dp: d.dp, unit: " mg", errors: d.alts.map(([kg, why]): Err => [kg * wt, `Used ${kg} mg/kg — ${why}.`]), source: d.src, explain: steps(
      `Dose = mg/kg × weight.`,
      `${d.perKg} × ${wt} kg = **${fx(dose, d.dp)} mg**.`,
      d.note,
      `Trap: check the maximum dose and the weight actually used (in obesity some drugs dose on ideal or adjusted weight); round to what can be measured.`,
    ) });
  },
  () => {
    const wt = rint(5, 40), first = coin();
    const perKg = first ? 2 : 4;
    return numeric({ id: "defib", stem: `A ${wt} kg child in VF arrest. The ${first ? "first" : "second"} defibrillation dose (AHA PALS 2020)?`, right: perKg * wt, unit: " J", lo: 2, errors: [
      [(first ? 4 : 2) * wt, first ? "Used 4 J/kg — that's the second dose (and ERC's every dose), not AHA's first." : "Used 2 J/kg — that's the first dose."],
      [3 * wt, "Used 3 J/kg, which isn't a PALS step."],
      [(first ? 1 : 6) * wt, first ? "Used 1 J/kg — a synchronised cardioversion dose, not defibrillation." : "Used 6 J/kg — a later escalated dose, not the second."],
      [(first ? 2.5 : 5) * wt, `Used ${first ? 2.5 : 5} J/kg instead of ${perKg}.`],
    ], source: "AHA PALS 2020", explain: steps(
      `AHA PALS: first shock 2 J/kg, second 4 J/kg, later ones at least 4 J/kg (up to 10 J/kg or the adult dose).`,
      `${perKg} × ${wt} kg = **${perKg * wt} J**.`,
      `Trap: European (ERC) guidance uses 4 J/kg for every shock; and synchronised cardioversion is a different, lower dose (0.5–1 J/kg, then 2 J/kg).`,
    ) });
  },
  () => {
    const s = pick<{ drug: string; mg: number; ml: number; doses: number[] }>([
      { drug: "noradrenaline", mg: 4, ml: 50, doses: [0.05, 0.1, 0.15, 0.2, 0.3] },
      { drug: "noradrenaline", mg: 8, ml: 50, doses: [0.1, 0.2, 0.3, 0.4, 0.5] },
      { drug: "dopamine", mg: 200, ml: 50, doses: [5, 7.5, 10, 15] },
      { drug: "dobutamine", mg: 250, ml: 50, doses: [2.5, 5, 7.5, 10] },
    ]);
    const wt = rint(45, 90), dose = pick(s.doses);
    const conc = (s.mg * 1000) / s.ml;
    const r = dripRate(dose, wt, conc);
    return numeric({ id: "drip", stem: `${s.drug[0]!.toUpperCase()}${s.drug.slice(1)} ${s.mg} mg in ${s.ml} mL, for a ${wt} kg patient at ${dose} mcg/kg/min. The syringe pump rate?`, right: r, dp: 1, unit: " mL/h", grain: Math.max(0.3, r * 0.12), errors: [
      [dripRate(dose, wt, conc) * 0.5, "Read the syringe as twice as strong as it is."],
      [(dose * wt * 50) / conc, "Multiplied by 50 instead of 60 minutes in an hour."],
      [dripRate(dose, 70, conc), "Used a standard 70 kg instead of the patient's weight."],
      [(dose * wt * 60) / ((s.mg * 1000) / (s.ml + 10)), "Counted 10 mL more diluent than the syringe holds."],
    ], source: "Surviving Sepsis Campaign 2021; BNF infusion tables", explain: steps(
      `mL/h = dose (mcg/kg/min) × weight (kg) × 60 ÷ concentration (mcg/mL).`,
      `Concentration: ${s.mg} mg = ${s.mg * 1000} mcg in ${s.ml} mL = ${conc} mcg/mL.`,
      `${dose} × ${wt} × 60 = ${fx(dose * wt * 60, dose * wt * 60 % 1 ? 1 : 0)} mcg/h.`,
      `÷ ${conc} = **${fx(r)} mL/h**.`,
      `Trap: the two commonest errors are the mg-to-mcg step (a thousand-fold) and leaving out the 60. Label every syringe with its strength.`,
    ) });
  },
  () => {
    const wt = rint(40, 85), hb = rdec(5, 10);
    const v = ganzoni(wt, hb);
    return numeric({ id: "ganzoni", stem: `A ${wt} kg adult with Hb ${fx(hb)} g/dL. Total iron deficit (Ganzoni; target Hb 15 g/dL, iron stores 500 mg)?`, right: v, unit: " mg", grain: 90, errors: [
      [ganzoni(wt, hb, 15, 0), "Left out the 500 mg of iron stores."],
      [ganzoni(wt, hb, 13), "Used a target Hb of 13 instead of 15."],
      [ganzoni(wt, hb, 15, 1000), "Used stores of 1000 mg instead of 500."],
      [ganzoni(wt, hb, 15, 500, 2), "Used a factor of 2 instead of 2.4."],
      [ganzoni(wt, hb, 15, 500, 3), "Used a factor of 3 instead of 2.4."],
    ], source: "Ganzoni 1970; ferric carboxymaltose and iron sucrose product information", explain: steps(
      `Ganzoni: iron deficit (mg) = weight (kg) × (target Hb − actual Hb) × 2.4 + iron stores.`,
      `= ${wt} × (15 − ${fx(hb)}) × 2.4 + 500`,
      `= ${wt} × ${fx(15 - hb)} × 2.4 + 500 = ${Math.round(wt * (15 - hb) * 2.4)} + 500 ≈ **${Math.round(v)} mg**.`,
      `Giving it: divide across doses by the product's single-dose limit.`,
      `Trap: below 35 kg the target (13 g/dL) and stores (15 mg/kg) change; in obesity use ideal weight, and in pregnancy use pre-pregnancy weight.`,
    ) });
  },
  () => {
    const female = coin(), wt = rint(50, 90), hi = rint(32, 48), hf = rint(21, 30);
    const perKg = female ? 65 : 70;
    const ebv = perKg * wt;
    const v = allowableBloodLoss(ebv, hi, hf);
    return numeric({ id: "abl", stem: `A ${wt} kg ${female ? "woman" : "man"} (estimated blood volume ${perKg} mL/kg), starting haematocrit ${hi}%, lowest acceptable ${hf}%. Allowable blood loss?`, right: v, unit: " mL", errors: [
      [(ebv * (hi - hf)) / hf, "Divided by the lowest haematocrit instead of the starting one."],
      [(ebv * (hi - hf)) / ((hi + hf) / 2), "Divided by the average haematocrit — a different form; this question uses the starting one."],
      [allowableBloodLoss((female ? 70 : 65) * wt, hi, hf), `Used ${female ? 70 : 65} mL/kg instead of the ${perKg} given.`],
      [allowableBloodLoss(75 * wt, hi, hf), "Used 75 mL/kg instead of the figure given."],
      [allowableBloodLoss(60 * wt, hi, hf), "Used 60 mL/kg instead of the figure given."],
    ], source: "Gross, Anesthesiology 1983; Miller's Anesthesia", explain: steps(
      `Allowable blood loss = EBV × (Hct start − Hct lowest) ÷ Hct start.`,
      `EBV = ${perKg} × ${wt} = ${ebv} mL.`,
      `= ${ebv} × (${hi} − ${hf}) ÷ ${hi} = ${ebv} × ${hi - hf} ÷ ${hi} ≈ **${Math.round(v)} mL**.`,
      `Trap: this assumes the volume lost is replaced to keep normovolaemia; the decision to transfuse rests on the patient, not on this number.`,
    ) });
  },
  () => {
    const wt = rint(6, 25);
    return numeric({ id: "ors", stem: `A ${wt} kg child has some dehydration from diarrhoea (WHO plan B). How much ORS over the first 4 hours?`, right: 75 * wt, unit: " mL", errors: [
      [50 * wt, "Used 50 mL/kg instead of 75."],
      [100 * wt, "Used 100 mL/kg — the IV volume of plan C, for severe dehydration."],
      [60 * wt, "Used 60 mL/kg instead of 75."],
      [90 * wt, "Used 90 mL/kg instead of 75."],
    ], source: "WHO Treatment of Diarrhoea 2005; IAP", explain: steps(
      `WHO plan B: ORS 75 mL/kg over 4 hours.`,
      `75 × ${wt} kg = **${75 * wt} mL** (about ${Math.round((75 * wt) / 4)} mL/hour).`,
      `Then reassess: move to plan A, repeat plan B, or go to plan C by what you find. Give zinc as well.`,
      `Trap: give more if the child wants more; give small, frequent sips if vomiting, and pause for 10 minutes rather than stopping.`,
    ) });
  },
];

/* Heart, lungs & ICU ------------------------------------------------------- */

const heart: (() => QuizQuestion)[] = [
  () => {
    const sbp = rint(80, 180);
    const dbp = Math.min(rint(45, 110), sbp - 25);
    const map = meanArterial(sbp, dbp);
    const r = Math.round(map);
    return numeric({ id: "map", stem: `BP ${sbp}/${dbp} mmHg. Mean arterial pressure?`, right: map, unit: " mmHg", grain: 4, errors: [
      [(sbp + dbp) / 2, "Took the simple average; diastole lasts longer, so it counts twice."],
      [(2 * sbp + dbp) / 3, "Doubled the systolic instead of the diastolic."],
      [dbp + (sbp - dbp) / 2, "Added half the pulse pressure to the diastolic — it's a third."],
      [(sbp + 2 * dbp) / 2.5, "Divided by 2.5 instead of 3."],
    ], source: "Surviving Sepsis Campaign 2021", explain: steps(
      `MAP = (systolic + 2 × diastolic) ÷ 3.`,
      `= (${sbp} + 2 × ${dbp}) ÷ 3 = ${sbp + 2 * dbp} ÷ 3 ≈ **${r} mmHg**.`,
      `What it means: ${r < 65 ? "below 65 — organs are under-perfused; in sepsis, start a vasopressor if fluids haven't fixed it." : "65 or more — the usual target in shock."}`,
      `Trap: diastole lasts twice as long as systole, so it counts twice.`,
    ) });
  },
  () => {
    const hr = rint(50, 120);
    const rr = 60 / hr;
    const qt = Math.round((rint(400, 540) * Math.sqrt(rr)) / 10) * 10;
    const qtc = qtcBazett(qt, hr);
    const r = Math.round(qtc);
    const sq = Math.sqrt(rr);
    return numeric({ id: "qtc", stem: `QT ${qt} ms at a heart rate of ${hr}/min. QTc (Bazett)?`, right: qtc, unit: " ms", grain: 15, errors: [
      [qtcFridericia(qt, hr), "Used the Fridericia cube root — the question asks for Bazett."],
      [qt, "Left the QT uncorrected."],
      [qt / rr, "Divided by RR without taking its square root."],
      [qt + 154 * (1 - rr), "Used the Framingham formula, not Bazett."],
      [qt + 1.75 * (hr - 60), "Used the Hodges formula, not Bazett."],
    ], source: "AHA/ACCF QT guidance", explain: steps(
      `QTc = QT ÷ √RR, with RR in seconds = 60 ÷ HR.`,
      `RR = 60 ÷ ${hr} = ${fx(rr, 2)} s; √RR = ${fx(sq, 2)}.`,
      `${qt} ÷ ${fx(sq, 2)} ≈ **${r} ms**.`,
      `What it means: ${r > 500 ? "over 500 — high risk of torsades; stop QT-prolonging drugs, check K and Mg." : r > 450 ? "prolonged (over 450 in men, 460 in women)." : "normal."}`,
      `Trap: Bazett over-corrects at fast heart rates — use Fridericia above about 100/min.`,
    ) });
  },
  () => {
    const pao2 = rint(55, 100), fio2 = pick([21, 28, 35, 40, 50, 60, 80]);
    const f = fio2 / 100;
    const pf = pfRatio(pao2, f);
    const r = Math.round(pf);
    return numeric({ id: "pf", stem: `PaO₂ ${pao2} mmHg on FiO₂ ${fio2}%. P/F ratio?`, right: pf, errors: [
      [pao2 / (f + 0.1), "Used an FiO₂ 10% higher than the one given."],
      [f > 0.3 ? pao2 / (f - 0.1) : pao2 / (f + 0.05), f > 0.3 ? "Used an FiO₂ 10% lower than the one given." : "Used an FiO₂ 5% higher than the one given."],
      [pao2 / (f + 0.05), "Used an FiO₂ 5% higher than the one given."],
    ], source: "Berlin ARDS definition 2012", explain: steps(
      `P/F = PaO₂ ÷ FiO₂ (as a fraction).`,
      `${pao2} ÷ ${fx(f, 2)} ≈ **${r}**.`,
      `What it means: ${r <= 100 ? "severe ARDS range (100 or less)." : r <= 200 ? "moderate ARDS range (100–200)." : r <= 300 ? "mild ARDS range (200–300)." : "above 300 — not in the ARDS range."}`,
      `Trap: ARDS also needs PEEP of at least 5, bilateral opacities and no heart-failure cause (Berlin definition).`,
    ) });
  },
  () => {
    let fio2 = 21, paco2 = 40, pao2 = 80, g = 0;
    do {
      fio2 = pick([21, 21, 21, 28, 35]); paco2 = rint(25, 55); pao2 = rint(50, 95);
      g = aaGradient(fio2 / 100, paco2, pao2);
    } while (g < 8 || g > 70);
    const f = fio2 / 100;
    const pA = alveolarO2(f, paco2);
    const age = rint(25, 75);
    return numeric({ id: "aa", stem: `A ${age}-year-old at sea level on FiO₂ ${fio2}%: PaO₂ ${pao2}, PaCO₂ ${paco2} mmHg. A–a gradient?`, right: g, unit: " mmHg", lo: 2, grain: 4, errors: [
      [f * 760 - paco2 / 0.8 - pao2, "Forgot to take off water vapour (47 mmHg)."],
      [f * 713 - paco2 - pao2, "Forgot to divide PaCO₂ by 0.8."],
      [f * 713 - paco2 * 0.8 - pao2, "Multiplied PaCO₂ by 0.8 instead of dividing."],
      [f * 713 - paco2 * 1.5 - pao2, "Multiplied PaCO₂ by 1.5 instead of dividing by 0.8."],
    ], source: "West's Respiratory Physiology; Harrison's", explain: steps(
      `PAO₂ = FiO₂ × (760 − 47) − PaCO₂ ÷ 0.8.`,
      `= ${fx(f, 2)} × 713 − ${paco2} ÷ 0.8 = ${fx(f * 713)} − ${fx(paco2 / 0.8)} = ${fx(pA)} mmHg.`,
      `A–a gradient = PAO₂ − PaO₂ = ${fx(pA)} − ${pao2} ≈ **${Math.round(g)} mmHg**.`,
      `Expected for age ≈ age ÷ 4 + 4 = ${fx(age / 4 + 4)} mmHg. ${g > age / 4 + 4 ? "This is raised — a lung problem: V/Q mismatch, shunt or diffusion (PE, pneumonia, ARDS)." : "This is within range — low oxygen would then come from hypoventilation or low inspired oxygen."}`,
      `Trap: the gradient widens on high FiO₂, so the expected value only holds on room air.`,
    ) });
  },
  () => {
    const female = coin(), h = rint(150, 185), actual = rint(60, 110);
    const p = predictedBodyWeight(h, female);
    const vt = 6 * p;
    return numeric({ id: "ardsnet-vt", stem: `ARDS: a ${female ? "woman" : "man"}, height ${h} cm, actual weight ${actual} kg. The starting tidal volume at 6 mL/kg predicted body weight?`, right: vt, unit: " mL", grain: 25, errors: [
      [6 * actual, "Used actual weight — lungs don't grow with fat; use predicted weight."],
      [6 * predictedBodyWeight(h, !female), `Used the ${female ? "male (50)" : "female (45.5)"} constant instead of ${female ? "45.5" : "50"}.`],
      [8 * p, "Used 8 mL/kg — the upper limit, not the starting target."],
      [7 * p, "Used 7 mL/kg instead of 6."],
      [5 * p, "Used 5 mL/kg instead of 6."],
    ], source: "ARDSNet ARMA, NEJM 2000", explain: steps(
      `Predicted body weight: ${female ? "women 45.5" : "men 50"} + 0.91 × (height in cm − 152.4).`,
      `= ${female ? "45.5" : "50"} + 0.91 × (${h} − 152.4) = ${female ? "45.5" : "50"} + 0.91 × ${fx(h - 152.4)} = ${fx(p)} kg.`,
      `Tidal volume = 6 × ${fx(p)} ≈ **${Math.round(vt)} mL**.`,
      `Then: keep plateau pressure at 30 cmH₂O or below; go down to 4 mL/kg if it's higher.`,
      `Trap: use height, never actual weight — a heavy patient has the same lungs.`,
    ) });
  },
  () => {
    const rr = rint(14, 38), vt = rint(20, 55) * 10;
    const v = rsbi(rr, vt);
    const r = Math.round(v);
    return numeric({ id: "rsbi", stem: `On a spontaneous breathing trial: respiratory rate ${rr}/min, tidal volume ${vt} mL. Rapid shallow breathing index?`, right: v, unit: " breaths/min/L", grain: 8, errors: [
      [rr / ((vt + 100) / 1000), "Added 100 mL to the tidal volume."],
      [rr / ((vt - 50) / 1000), "Took 50 mL off the tidal volume for dead space."],
    ], source: "Yang & Tobin, NEJM 1991", explain: steps(
      `RSBI = respiratory rate ÷ tidal volume in litres.`,
      `${vt} mL = ${fx(vt / 1000, 2)} L.`,
      `${rr} ÷ ${fx(vt / 1000, 2)} ≈ **${r} breaths/min/L**.`,
      `What it means: ${r < 105 ? "under 105 — extubation is more likely to succeed." : "105 or above — rapid shallow breathing; weaning is likely to fail."}`,
      `Trap: it's measured off pressure support, or on very little; and it's one piece of the decision, with the airway, secretions and the cough.`,
    ) });
  },
  () => {
    const flags: WellsFlags = { dvtSigns: coin(0.4), peLikeliest: coin(), hrOver100: coin(), immobileOrSurgery: coin(0.4), priorVte: coin(0.35), haemoptysis: coin(0.3), malignancy: coin(0.3) };
    if (!Object.values(flags).some(Boolean)) flags.peLikeliest = true;
    const hr = flags.hrOver100 ? rint(102, 136) : rint(72, 100);
    const s = wellsPE(flags);
    const parts = [
      flags.dvtSigns ? "a swollen, tender calf" : "no leg signs",
      flags.peLikeliest ? "PE is the likeliest diagnosis" : "another diagnosis is at least as likely",
      `heart rate ${hr}/min`,
      flags.immobileOrSurgery ? "knee surgery 2 weeks ago" : "no recent surgery or bed rest",
      flags.priorVte ? "a past DVT" : "no past clot",
      flags.haemoptysis ? "haemoptysis" : "no haemoptysis",
      flags.malignancy ? "cancer on chemotherapy" : "no cancer",
    ];
    return numeric({ id: "wells-pe", stem: `Breathless patient: ${parts.join(", ")}. Wells PE score?`, right: s, dp: 1, snap: 0.5, lo: 0, hi: 12.5, ratio: 0, grain: 1, errors: scoreErrors(s, [
      { name: "clinical signs of DVT", pts: 3, on: flags.dvtSigns },
      { name: "PE as the likeliest diagnosis", pts: 3, on: flags.peLikeliest },
      { name: "heart rate above 100", pts: 1.5, on: flags.hrOver100 },
      { name: "immobilisation or surgery", pts: 1.5, on: flags.immobileOrSurgery },
      { name: "previous DVT or PE", pts: 1.5, on: flags.priorVte },
      { name: "haemoptysis", pts: 1, on: flags.haemoptysis },
      { name: "malignancy", pts: 1, on: flags.malignancy },
    ]), source: "Wells et al. 2000; ESC PE guideline 2019", explain: steps(
      `Wells PE: DVT signs 3; PE likeliest 3; HR above 100 1.5; immobilisation or surgery in 4 weeks 1.5; past DVT/PE 1.5; haemoptysis 1; malignancy 1.`,
      `• DVT signs → ${flags.dvtSigns ? 3 : 0}`,
      `• PE likeliest → ${flags.peLikeliest ? 3 : 0}`,
      `• Heart rate ${hr} → ${flags.hrOver100 ? 1.5 : 0}`,
      `• Immobilisation or surgery → ${flags.immobileOrSurgery ? 1.5 : 0}`,
      `• Past DVT/PE → ${flags.priorVte ? 1.5 : 0}`,
      `• Haemoptysis → ${flags.haemoptysis ? 1 : 0}`,
      `• Malignancy → ${flags.malignancy ? 1 : 0}`,
      `Total: **${fx(s)}**.`,
      `What it means: ${s > 4 ? "above 4 — PE likely: go to CT pulmonary angiography." : "4 or less — PE unlikely: a D-dimer can rule it out."}`,
      `Trap: a heart rate of exactly 100 doesn't score. And a D-dimer is no use once PE is likely.`,
    ) });
  },
  () => {
    const c = coin(), u = coin(), r = coin(), b = coin(), a = coin(0.6);
    const urea = u ? rint(44, 95) : rint(18, 41), rr = r ? rint(30, 42) : rint(16, 29), sbp = b ? rint(78, 110) : rint(112, 150), dbp = b ? (sbp < 90 ? rint(48, 62) : rint(48, 60)) : rint(64, 90), age = a ? rint(65, 88) : rint(25, 64);
    const score = curb65(c, urea, rr, sbp, dbp, age);
    const mark = (on: boolean) => (on ? "1" : "0");
    return numeric({ id: "curb", stem: `Pneumonia: ${c ? "confused" : "alert"}, urea ${urea} mg/dL (BUN ${Math.round(urea / 2.14)}), RR ${rr}/min, BP ${sbp}/${dbp}, aged ${age}. CURB-65?`, right: score, lo: 0, hi: 5, ratio: 0, grain: 1, errors: scoreErrors(score, [
      { name: "confusion", pts: 1, on: c },
      { name: "urea above 42 mg/dL", pts: 1, on: u },
      { name: "RR of 30 or more", pts: 1, on: r },
      { name: "low BP", pts: 1, on: b },
      { name: "age 65 or over", pts: 1, on: a },
    ]), source: "BTS community-acquired pneumonia guideline", explain: steps(
      `CURB-65: one point each.`,
      `• Confusion — ${c ? "confused" : "alert"} → ${mark(c)}`,
      `• Urea > 7 mmol/L (> 42 mg/dL; BUN > 19 mg/dL) — urea ${urea} → ${mark(u)}`,
      `• Respiratory rate ≥ 30 — ${rr} → ${mark(r)}`,
      `• BP: systolic < 90 or diastolic ≤ 60 — ${sbp}/${dbp} → ${mark(b)}`,
      `• Age ≥ 65 — ${age} → ${mark(a)}`,
      `Total: **${score}/5**.`,
      `What it means: ${score <= 1 ? "low risk (30-day mortality under 3%) — usually treat at home with oral antibiotics." : score === 2 ? "moderate risk (about 9%) — consider admission or close follow-up." : "high risk (15–40%) — admit; with 4–5, assess for ICU."}`,
      `Trap: the score supports, not replaces, judgement — low oxygen saturation, a frail patient or poor home support can still mean admission.`,
    ) });
  },
  () => {
    const hr = rint(70, 150), sbp = rint(72, 130), dbp = Math.round(sbp * 0.62) + rint(-4, 4);
    const si = shockIndex(hr, sbp);
    const map = meanArterial(sbp, dbp);
    return numeric({ id: "shock-index", stem: `Heart rate ${hr}/min, BP ${sbp}/${dbp} mmHg. Shock index?`, right: si, dp: 2, grain: 0.08, errors: [
      [hr / map, "Divided by the mean arterial pressure — that's the modified shock index."],
      [hr / dbp, "Divided by the diastolic instead of the systolic."],
      [sbp / hr, "Inverted the ratio."],
      [hr / (sbp + 20), "Added 20 to the systolic."],
    ], source: "Allgöwer & Burri 1967; Koch, Sci Rep 2019", explain: steps(
      `Shock index = heart rate ÷ systolic BP.`,
      `${hr} ÷ ${sbp} = **${fx(si, 2)}**.`,
      `What it means: ${si < 0.7 ? "under 0.7 — normal (about 0.5–0.7)." : si < 1 ? "0.7–1 — raised: keep looking for bleeding or sepsis." : "1 or above — serious: expect a need for blood or critical care."}`,
      `Trap: beta-blockers, pacing, pregnancy and old age all change it — and a normal BP doesn't exclude shock.`,
    ) });
  },
];

/* Brain, liver & GI -------------------------------------------------------- */

const brainLiver: (() => QuizQuestion)[] = [
  () => {
    const e = rint(1, 4), v = rint(1, 5), m = rint(1, 6);
    const gcs = e + v + m;
    const E = ["", "no eye opening", "opens to pain", "opens to voice", "opens spontaneously"][e];
    const V = ["", "no speech", "incomprehensible sounds", "inappropriate words", "confused", "oriented"][v];
    const M = ["", "no movement", "extension (decerebrate)", "abnormal flexion (decorticate)", "withdraws from pain", "localises pain", "obeys commands"][m];
    return numeric({ id: "gcs", stem: `Eyes open ${["", "not at all", "to pain", "to voice", "spontaneously"][e]}, speech is ${["", "absent", "incomprehensible sounds", "inappropriate words", "confused", "oriented"][v]}, and to pain he ${["", "doesn't move", "extends", "flexes abnormally", "withdraws", "localises", "obeys commands"][m]}. GCS?`, right: gcs, lo: 3, hi: 15, ratio: 0, grain: 1, errors: [
      [gcs + 1, m === 3 || m === 4 ? "Scored the motor response one too high: withdrawal is 4, abnormal flexion 3." : "Scored one component one too high."],
      [gcs - 1, v === 4 || v === 3 ? "Scored speech one too low: confused is 4, inappropriate words 3." : "Scored one component one too low."],
      [gcs + 2, "Scored two components one too high."],
      [gcs - 2, "Scored two components one too low."],
    ], source: "Teasdale & Jennett; ATLS", explain: steps(
      `GCS = Eyes (1–4) + Verbal (1–5) + Motor (1–6); 3 to 15.`,
      `• Eyes: ${E} → E${e}`,
      `• Verbal: ${V} → V${v}`,
      `• Motor: ${M} → M${m}`,
      `Total: E${e} V${v} M${m} = **${gcs}/15**.`,
      `What it means: ${gcs <= 8 ? "severe brain injury (8 or less) — he may not protect his airway; call for help to secure it." : gcs <= 12 ? "moderate (9–12) — close neurological observation and imaging if trauma." : "mild (13–15) — keep reassessing; a fall of 2 or more points is a red flag."}`,
      `Trap: always write the components (E${e}V${v}M${m}), not just the total — and score the best motor response; if intubated, record verbal as "T".`,
    ) });
  },
  () => {
    const control = rint(11, 14), pt = control + rint(3, 22), bili = rdec(4, 35);
    const v = maddrey(pt, control, bili);
    return numeric({ id: "maddrey", stem: `Alcohol-related hepatitis: PT ${pt} s (control ${control} s), bilirubin ${fx(bili)} mg/dL. Maddrey's discriminant function?`, right: v, dp: 1, grain: Math.max(1.5, v * 0.08), errors: [
      [maddrey(pt, control, bili, 4), "Used 4 as the multiplier instead of 4.6."],
      [maddrey(pt, control, bili, 5), "Used 5 as the multiplier instead of 4.6."],
      [maddrey(pt, control, 0), "Left out the bilirubin."],
      [maddrey(pt, control + 2, bili), "Took the control as 2 s higher than given."],
    ], source: "Maddrey 1978; AASLD alcohol-associated liver disease guidance 2019", explain: steps(
      `Maddrey's DF = 4.6 × (PT − control PT) + bilirubin (mg/dL).`,
      `= 4.6 × (${pt} − ${control}) + ${fx(bili)} = 4.6 × ${pt - control} + ${fx(bili)} = ${fx(4.6 * (pt - control))} + ${fx(bili)} = **${fx(v)}**.`,
      `What it means: ${v >= 32 ? "32 or more — severe, with high short-term mortality: consider prednisolone if there's no infection or bleeding." : "under 32 — not severe by this score: supportive care, nutrition and abstinence."}`,
      `Trap: PT is in seconds, not INR; and bilirubin must be in mg/dL — in µmol/L, divide by 17.1 first.`,
    ) });
  },
  () => {
    let s = 0, a = 0;
    do {
      s = rdec(1.8, 3.8); a = rdec(0.3, 2.6);
    } while (s - a < 0.4);
    const protein = rdec(Math.min(a + 0.3, 3), 4.5);
    const v = saag(s, a);
    return numeric({ id: "saag", stem: `Ascites: serum albumin ${fx(s)} g/dL, ascitic albumin ${fx(a)} g/dL, ascitic total protein ${fx(protein)} g/dL. The serum-ascites albumin gradient?`, right: v, dp: 1, unit: " g/dL", grain: 0.2, errors: [
      [s - protein, "Subtracted the ascitic total protein instead of the ascitic albumin."],
      [(s + a) / 2, "Took the average instead of the difference."],
      [s - a / 2, "Halved the ascitic albumin before subtracting."],
    ], source: "AASLD ascites guidance 2021", explain: steps(
      `SAAG = serum albumin − ascitic albumin (same day).`,
      `= ${fx(s)} − ${fx(a)} = **${fx(v)} g/dL**.`,
      `What it means: ${v >= 1.1 ? "1.1 or more — portal hypertension (cirrhosis, heart failure, Budd–Chiari)." : "under 1.1 — not portal hypertension (peritoneal TB, cancer, nephrotic syndrome, pancreatitis)."}`,
      `Trap: the total protein helps a different question: with SAAG 1.1 or above, protein of 2.5 g/dL or more suggests a cardiac cause.`,
    ) });
  },
  () => {
    const bili = rdec(0.8, 6), alb = rdec(2, 4.2), inr = rdec(1, 3);
    const asc = rint(1, 3) as 1 | 2 | 3, enc = rint(1, 3) as 1 | 2 | 3;
    const pts = childPughPoints(bili, alb, inr, asc, enc);
    const s = childPugh(bili, alb, inr, asc, enc);
    const cls = s <= 6 ? "A" : s <= 9 ? "B" : "C";
    const ascT = ["", "no ascites", "mild ascites controlled with diuretics", "tense ascites despite diuretics"][asc];
    const encT = ["", "no encephalopathy", "grade II encephalopathy", "grade III encephalopathy"][enc];
    return numeric({ id: "child-pugh", stem: `Cirrhosis: bilirubin ${fx(bili)} mg/dL, albumin ${fx(alb)} g/dL, INR ${fx(inr)}, ${ascT}, ${encT}. Child–Pugh score?`, right: s, lo: 5, hi: 15, ratio: 0, grain: 1, errors: [
      [s + 1, "Graded one item a band too high — recheck against the cut-offs."],
      [s - 1, "Graded one item a band too low — recheck against the cut-offs."],
      [s + 2, "Graded two items a band too high."],
      [s - 2, "Graded two items a band too low."],
    ], source: "Pugh 1973; EASL decompensated cirrhosis guideline 2018", explain: steps(
      `Child–Pugh: five items, each 1 to 3 points.`,
      `• Bilirubin ${fx(bili)} (under 2 = 1; 2–3 = 2; over 3 = 3) → ${pts[0]}`,
      `• Albumin ${fx(alb)} (over 3.5 = 1; 2.8–3.5 = 2; under 2.8 = 3) → ${pts[1]}`,
      `• INR ${fx(inr)} (under 1.7 = 1; 1.7–2.3 = 2; over 2.3 = 3) → ${pts[2]}`,
      `• Ascites: ${ascT} → ${pts[3]}`,
      `• Encephalopathy: ${encT} → ${pts[4]}`,
      `Total: **${s}** — class ${cls} (A 5–6, B 7–9, C 10–15).`,
      `Trap: in primary biliary or sclerosing disease, the bilirubin bands are higher (under 4, 4–10, over 10).`,
    ) });
  },
  () => {
    const cr = rdec(0.7, 5), bili = rdec(0.8, 25), inr = rdec(1, 3.5), na = rint(120, 140);
    const m = meldI(cr, bili, inr);
    const s = meldNa(cr, bili, inr, na);
    const dNa = 137 - Math.min(137, Math.max(125, na));
    return numeric({ id: "meld-na", stem: `Creatinine ${fx(cr)} mg/dL, bilirubin ${fx(bili)} mg/dL, INR ${fx(inr)}, sodium ${na} mmol/L, no dialysis. MELD-Na (UNOS 2016)?`, right: s, lo: 6, hi: 40, ratio: 0, grain: 2, errors: [
      [m, "Stopped at MELD(i) — that leaves out the sodium."],
      [m + 1.32 * dNa, "Left out the last term, 0.033 × MELD × (137 − Na)."],
      [m > 11 ? m + 1.32 * (137 - na) - 0.033 * m * (137 - na) : m + 2, m > 11 ? "Didn't bound the sodium to 125–137." : "Applied a sodium adjustment, which only counts when MELD(i) is above 11."],
      [Math.round(10 * (0.957 * Math.log(cr) + 0.378 * Math.log(Math.max(1, bili)) + 1.12 * Math.log(Math.max(1, inr)) + 0.643)), "Didn't apply the creatinine limits: at least 1.0, at most 4.0."],
      [s + 3, "A slip in the logarithms — recheck each term."],
      [s - 3, "A slip in the logarithms — recheck each term."],
    ], source: "OPTN/UNOS MELD-Na policy, 2016", explain: steps(
      `MELD(i) = 10 × [0.957 × ln(Cr) + 0.378 × ln(bilirubin) + 1.120 × ln(INR) + 0.643]; values under 1 count as 1, creatinine is capped at 4.`,
      `= 10 × [0.957 × ln(${fx(Math.min(4, Math.max(1, cr)))}) + 0.378 × ln(${fx(Math.max(1, bili))}) + 1.120 × ln(${fx(Math.max(1, inr))}) + 0.643] ≈ ${m}.`,
      m > 11
        ? `MELD-Na = MELD(i) + 1.32 × (137 − Na) − 0.033 × MELD(i) × (137 − Na), with Na held between 125 and 137 (here ${137 - dNa}).`
        : `MELD(i) is 11 or less, so the sodium term doesn't apply.`,
      m > 11 && `= ${m} + 1.32 × ${dNa} − 0.033 × ${m} × ${dNa} = ${m} + ${fx(1.32 * dNa)} − ${fx(0.033 * m * dNa)}.`,
      `Rounded, and held between 6 and 40: **${s}**.`,
      `Trap: the score only ranks 90-day transplant-list mortality. Two dialysis sessions in a week set creatinine to 4. The US list moved to MELD 3.0 in 2023 — a different formula from this one.`,
    ) });
  },
  () => {
    const level = rdec(4, 16), alb = rdec(1.8, 3.6);
    const v = correctedPhenytoin(level, alb);
    return numeric({ id: "phenytoin", stem: `Phenytoin level ${fx(level)} mcg/mL, albumin ${fx(alb)} g/dL, normal kidney function. Corrected phenytoin (Sheiner–Tozer)?`, right: v, dp: 1, unit: " mcg/mL", grain: Math.max(0.5, v * 0.08), errors: [
      [correctedPhenytoin(level, alb, 0.1), "Used 0.1 × albumin — that's for end-stage kidney disease."],
      [correctedPhenytoin(level, alb, 0.25), "Used 0.25 × albumin instead of 0.2."],
      [level, "Left the level uncorrected."],
      [(level * 4) / alb, "Scaled it by 4 ÷ albumin — a calcium-style shortcut, not this formula."],
      [level / (0.2 * alb), "Left out the + 0.1."],
    ], source: "Winter & Tozer, Basic Clinical Pharmacokinetics", explain: steps(
      `Corrected phenytoin = measured ÷ (0.2 × albumin + 0.1).`,
      `0.2 × ${fx(alb)} + 0.1 = ${fx(0.2 * alb + 0.1, 2)}.`,
      `${fx(level)} ÷ ${fx(0.2 * alb + 0.1, 2)} ≈ **${fx(v)} mcg/mL**.`,
      `What it means: ${v > 20 ? "above the 10–20 mcg/mL range, though the measured level looks acceptable — watch for toxicity (ataxia, nystagmus)." : v < 10 ? "below the 10–20 mcg/mL range." : "within the 10–20 mcg/mL range."}`,
      `Trap: the formula is unreliable in the critically ill and the old — measure free phenytoin if you can.`,
    ) });
  },
  () => {
    const bun = coin() ? rint(26, 60) : rint(9, 25), gcs = coin(0.3) ? rint(12, 14) : 15, age = coin() ? rint(61, 85) : rint(25, 60), eff = coin(0.4);
    const t = coin() ? rdec(38.2, 39.5) : rdec(36.4, 37.8), hr = coin() ? rint(92, 130) : rint(68, 90), rr = coin() ? rint(21, 32) : rint(14, 20), wbc = coin() ? rint(13, 22) : rint(5, 11);
    const sirs = (t > 38 || t < 36 ? 1 : 0) + (hr > 90 ? 1 : 0) + (rr > 20 ? 1 : 0) + (wbc > 12 || wbc < 4 ? 1 : 0);
    const s = bisap(bun, gcs, sirs, age, eff);
    return numeric({ id: "bisap", stem: `Acute pancreatitis, aged ${age}: BUN ${bun} mg/dL (urea ${Math.round(bun * 2.14)}), GCS ${gcs}, temp ${fx(t)} °C, HR ${hr}, RR ${rr}, WBC ${wbc} × 10⁹/L, ${eff ? "a pleural effusion" : "clear chest film"}. BISAP?`, right: s, lo: 0, hi: 5, ratio: 0, grain: 1, errors: scoreErrors(s, [
      { name: "BUN above 25 mg/dL", pts: 1, on: bun > 25 },
      { name: "impaired mental status", pts: 1, on: gcs < 15 },
      { name: "2 or more SIRS criteria", pts: 1, on: sirs >= 2 },
      { name: "age above 60", pts: 1, on: age > 60 },
      { name: "pleural effusion", pts: 1, on: eff },
    ]), source: "Wu et al., Gut 2008", explain: steps(
      `BISAP: one point each.`,
      `• BUN > 25 mg/dL — ${bun} → ${bun > 25 ? 1 : 0}`,
      `• Impaired mental status (GCS under 15) — ${gcs} → ${gcs < 15 ? 1 : 0}`,
      `• SIRS, 2 or more — temp, HR, RR and WBC meet ${sirs} → ${sirs >= 2 ? 1 : 0}`,
      `• Age > 60 — ${age} → ${age > 60 ? 1 : 0}`,
      `• Pleural effusion → ${eff ? 1 : 0}`,
      `Total: **${s}/5**.`,
      `What it means: ${s >= 3 ? "3 or more — much higher mortality risk: consider HDU or ICU." : "under 3 — lower risk, but keep reassessing in the first 48 hours."}`,
      `Trap: labs in India often report urea, not BUN: BUN = urea ÷ 2.14. SIRS needs temp over 38 or under 36, HR over 90, RR over 20, WBC over 12 or under 4.`,
    ) });
  },
  () => {
    const sbp = rint(100, 180), dbp = Math.round(sbp * 0.58) + rint(-6, 6), icp = rint(10, 38);
    const map = meanArterial(sbp, dbp);
    const v = cerebralPerfusion(map, icp);
    const r = Math.round(v);
    return numeric({ id: "cpp", stem: `Head injury: BP ${sbp}/${dbp} mmHg, intracranial pressure ${icp} mmHg. Cerebral perfusion pressure?`, right: v, unit: " mmHg", grain: 5, errors: [
      [dbp - icp, "Used the diastolic instead of the MAP."],
      [(sbp + dbp) / 2 - icp, "Took the simple average of the BP instead of the MAP."],
      [map - icp / 2, "Took off only half of the ICP."],
      [sbp - icp, "Used the systolic instead of the MAP."],
    ], source: "Brain Trauma Foundation guidelines, 4th ed. 2016", explain: steps(
      `CPP = MAP − ICP.`,
      `MAP = (${sbp} + 2 × ${dbp}) ÷ 3 = ${sbp + 2 * dbp} ÷ 3 ≈ ${fx(map)} mmHg.`,
      `CPP = ${fx(map)} − ${icp} ≈ **${r} mmHg**.`,
      `What it means: ${r < 60 ? "below 60 — the brain is under-perfused: lower the ICP and raise the MAP." : r > 70 ? "above 70 — above the 60–70 target; pushing it higher risks ARDS." : "within the 60–70 mmHg target."}`,
      `Trap: for a true value, zero the arterial line at the level of the ear (the foramen of Monro).`,
    ) });
  },
];

/* Biostatistics, OB & body indices ----------------------------------------- */

const bio: (() => QuizQuestion)[] = [
  () => {
    const wt = rint(50, 100), ht = rint(150, 190);
    const m = ht / 100;
    const v = bmi(wt, ht);
    const r = Number(fx(v));
    const asian = r < 18.5 ? "underweight" : r < 23 ? "normal" : r < 25 ? "overweight" : "obese";
    const who = r < 18.5 ? "underweight" : r < 25 ? "normal" : r < 30 ? "overweight" : "obese";
    return numeric({ id: "bmi", stem: `${wt} kg, ${ht} cm. BMI?`, right: v, dp: 1, unit: " kg/m²", grain: 2, errors: [
      [wt / (2 * m), "Doubled the height instead of squaring it."],
      [wt / Math.round(m * 10) ** 2 * 100, "Rounded the height to one decimal before squaring."],
      [wt / (m + 0.1) ** 2, "Added 10 cm to the height — a slip in copying it."],
      [wt / (m - 0.1) ** 2, "Took 10 cm off the height — a slip in copying it."],
    ], source: "WHO; ICMR Asian BMI cut-offs", explain: steps(
      `BMI = weight (kg) ÷ height (m)².`,
      `Height ${ht} cm = ${fx(m, 2)} m; squared = ${fx(m ** 2, 2)}.`,
      `${wt} ÷ ${fx(m ** 2, 2)} = **${fx(r)} kg/m²**.`,
      `What it means: ${asian} by the Asian cut-offs (normal 18.5–22.9, overweight 23–24.9, obese 25 or more)${asian !== who ? ` — but ${who} by the WHO global ones (overweight 25–29.9, obese 30 or more)` : ""}.`,
      `Trap: South Asians carry more risk at a lower BMI, so use the Asian cut-offs in India — and BMI misjudges muscular people; waist circumference adds to it.`,
    ) });
  },
  () => {
    const ht = rint(150, 190), wt = rint(45, 100);
    const v = bsaMosteller(ht, wt);
    const product = ht * wt;
    return numeric({ id: "bsa", stem: `Height ${ht} cm, weight ${wt} kg. Body surface area (Mosteller)?`, right: v, dp: 2, unit: " m²", grain: 0.12, errors: [
      [Math.sqrt(product / 3000), "Divided by 3000 instead of 3600."],
      [Math.sqrt(product / 4000), "Divided by 4000 instead of 3600."],
      [product / 3600 / 2, "Halved instead of taking the square root."],
    ], source: "Mosteller, NEJM 1987", explain: steps(
      `Mosteller: BSA = √(height in cm × weight in kg ÷ 3600).`,
      `${ht} × ${wt} = ${product}; ÷ 3600 = ${fx(product / 3600, 3)}.`,
      `√${fx(product / 3600, 3)} = **${fx(v, 2)} m²**.`,
      `Trap: chemotherapy doses rest on this — recheck after real weight change, and many protocols cap the BSA or the dose.`,
    ) });
  },
  () => {
    const tp = rint(40, 180), fn = rint(6, 40), tn = rint(80, 300), fp = rint(6, 60);
    const askSens = coin();
    const v = askSens ? sensitivity(tp, fn) : specificity(tn, fp);
    const se = sensitivity(tp, fn), sp = specificity(tn, fp), pv = ppv(tp, fp), nv = npv(tn, fn);
    const acc = (100 * (tp + tn)) / (tp + fp + fn + tn);
    return numeric({ id: "sens-spec", stem: `A new test against the gold standard: true positives ${tp}, false positives ${fp}, false negatives ${fn}, true negatives ${tn}. Its ${askSens ? "sensitivity" : "specificity"}?`, right: v, dp: 1, unit: "%", hi: 99.9, grain: 3, errors: [
      [askSens ? sp : se, `That's the ${askSens ? "specificity" : "sensitivity"}.`],
      [pv, "That's the positive predictive value."],
      [nv, "That's the negative predictive value."],
      [acc, "That's the overall accuracy."],
    ], source: "Altman & Bland, BMJ 1994", explain: steps(
      askSens ? `Sensitivity = TP ÷ (TP + FN): of those with the disease, how many test positive.` : `Specificity = TN ÷ (TN + FP): of those without the disease, how many test negative.`,
      askSens ? `= ${tp} ÷ (${tp} + ${fn}) = ${tp} ÷ ${tp + fn} = **${fx(v)}%**.` : `= ${tn} ÷ (${tn} + ${fp}) = ${tn} ÷ ${tn + fp} = **${fx(v)}%**.`,
      `Memory: SnNout — a highly sensitive test, when negative, rules out. SpPin — a highly specific test, when positive, rules in.`,
      `Trap: neither changes with prevalence; predictive values do.`,
    ) });
  },
  () => {
    const tp = rint(30, 180), fn = rint(6, 40), tn = rint(80, 300), fp = rint(8, 60);
    const askP = coin();
    const v = askP ? ppv(tp, fp) : npv(tn, fn);
    return numeric({ id: "ppv-npv", stem: `Screening results: true positives ${tp}, false positives ${fp}, false negatives ${fn}, true negatives ${tn}. The ${askP ? "positive" : "negative"} predictive value?`, right: v, dp: 1, unit: "%", hi: 99.9, grain: 3, errors: [
      [askP ? npv(tn, fn) : ppv(tp, fp), `That's the ${askP ? "negative" : "positive"} predictive value.`],
      [sensitivity(tp, fn), "That's the sensitivity — it reads down the disease column, not across the test row."],
      [specificity(tn, fp), "That's the specificity — it reads down the no-disease column, not across the test row."],
      [(100 * (tp + tn)) / (tp + fp + fn + tn), "That's the overall accuracy."],
    ], source: "Altman & Bland, BMJ 1994", explain: steps(
      askP ? `PPV = TP ÷ (TP + FP): of those who test positive, how many have the disease.` : `NPV = TN ÷ (TN + FN): of those who test negative, how many don't have the disease.`,
      askP ? `= ${tp} ÷ (${tp} + ${fp}) = ${tp} ÷ ${tp + fp} = **${fx(v)}%**.` : `= ${tn} ÷ (${tn} + ${fn}) = ${tn} ÷ ${tn + fn} = **${fx(v)}%**.`,
      `Trap: predictive values shift with prevalence — the same test has a far lower PPV in a low-risk population.`,
    ) });
  },
  () => {
    let cer = 0, ter = 0;
    do {
      cer = rint(8, 40); ter = rint(3, cer - 2);
    } while (cer - ter > 18);
    const n = nnt(cer, ter), arr = cer - ter;
    return numeric({ id: "nnt", stem: `In a trial, ${cer}% of controls and ${ter}% of treated patients had the event. Number needed to treat?`, right: n, grain: Math.max(1, n * 0.15), lo: 2, errors: [
      [Math.floor(100 / arr), "Rounded down — NNT is always rounded up."],
      [100 / cer, "Used the control event rate alone, not the difference."],
      [100 / ter, "Used the treated event rate alone, not the difference."],
      [100 / (arr + 1), "Miscounted the risk difference by 1."],
      [Math.ceil(100 / Math.max(1, arr - 1)), "Miscounted the risk difference by 1."],
    ], source: "Laupacis, Sackett & Roberts, NEJM 1988", explain: steps(
      `NNT = 1 ÷ absolute risk reduction (ARR); ARR = control rate − treated rate.`,
      `ARR = ${cer}% − ${ter}% = ${arr}% = ${fx(arr / 100, 2)}.`,
      `1 ÷ ${fx(arr / 100, 2)} = ${fx(100 / arr, 2)} → rounded up to **${n}**.`,
      `What it means: treat ${n} patients for the trial's time to prevent one event.`,
      `Trap: the relative risk reduction (${Math.round((100 * arr) / cer)}% here) looks bigger and isn't what NNT uses; and an NNT only holds for that trial's time and population.`,
    ) });
  },
  () => {
    let a = 0, b = 0, c = 0, d = 0, v = 0;
    do {
      a = rint(20, 90); b = rint(20, 90); c = rint(15, 70); d = rint(30, 120); v = oddsRatio(a, b, c, d);
    } while (v < 1.3 || v > 6);
    const rr = relativeRisk(a, a + c, b, b + d);
    return numeric({ id: "odds-ratio", stem: `Case-control study: cases ${a} exposed, ${c} unexposed; controls ${b} exposed, ${d} unexposed. The odds ratio?`, right: v, dp: 2, grain: Math.max(0.1, v * 0.1), errors: [
      [(b * c) / (a * d), "Inverted the ratio."],
      [rr, "Worked out a risk-style ratio of proportions — that's not an odds ratio."],
      [(a * b) / (c * d), "Multiplied the wrong pairs — it's exposed cases × unexposed controls over the other two."],
      [a / c, "Stopped at the odds in cases, without dividing by the odds in controls."],
    ], source: "Bland & Altman, BMJ 2000", explain: steps(
      `Odds ratio = (exposed cases × unexposed controls) ÷ (exposed controls × unexposed cases).`,
      `= (${a} × ${d}) ÷ (${b} × ${c}) = ${a * d} ÷ ${b * c} = **${fx(v, 2)}**.`,
      `What it means: the odds of exposure are ${fx(v, 2)} times as high in cases as in controls.`,
      `Trap: case-control studies choose how many cases to take, so risk can't be worked out — only odds. The OR comes near the RR only when the disease is rare.`,
    ) });
  },
  () => {
    const n1 = rint(10, 40) * 10, n2 = rint(10, 40) * 10;
    let e1 = 0, e2 = 0, v = 0;
    do {
      e1 = Math.round((n1 * rint(10, 45)) / 100); e2 = Math.round((n2 * rint(6, 30)) / 100); v = relativeRisk(e1, n1, e2, n2);
    } while (v < 1.2 || v > 5 || e1 < 1 || e2 < 1);
    const or = oddsRatio(e1, n1 - e1, e2, n2 - e2);
    return numeric({ id: "rel-risk", stem: `Cohort study: ${e1} of ${n1} exposed and ${e2} of ${n2} unexposed people got the disease. The relative risk?`, right: v, dp: 2, grain: Math.max(0.1, v * 0.1), errors: [
      [or, "That's the odds ratio — it uses people without the disease as the bottom line."],
      [1 / v, "Inverted the ratio."],
      [e1 / e2, "Compared the event counts without dividing by group size."],
      [(e1 / n1) / ((e1 + e2) / (n1 + n2)), "Compared the exposed with everyone, not with the unexposed."],
    ], source: "Sackett, Evidence-Based Medicine", explain: steps(
      `Relative risk = risk in the exposed ÷ risk in the unexposed.`,
      `Exposed: ${e1} ÷ ${n1} = ${fx(e1 / n1, 3)}. Unexposed: ${e2} ÷ ${n2} = ${fx(e2 / n2, 3)}.`,
      `${fx(e1 / n1, 3)} ÷ ${fx(e2 / n2, 3)} = **${fx(v, 2)}**.`,
      `What it means: the exposed are ${fx(v, 2)} times as likely to get the disease.`,
      `Trap: RR needs follow-up from exposure to outcome — cohort studies and trials. A case-control study gives an odds ratio.`,
    ) });
  },
  () => {
    const se = rint(60, 95), sp = rint(70, 95), plus = coin();
    const v = plus ? lrPositive(se, sp) : lrNegative(se, sp);
    return numeric({ id: "lr", stem: `A test has sensitivity ${se}% and specificity ${sp}%. Its ${plus ? "positive" : "negative"} likelihood ratio?`, right: v, dp: 2, lo: 0.01, grain: Math.max(0.02, v * 0.12), errors: plus
      ? [[se / sp, "Divided sensitivity by specificity; the bottom line is 1 − specificity."], [se / (100 - sp + 5), "Took 1 − specificity as 5% higher than it is."], [(se + 5) / (100 - sp), "Took sensitivity as 5% higher than it is."], [(se - 5) / (100 - sp), "Took sensitivity as 5% lower than it is."]]
      : [[(100 - sp) / se, "Swapped the two — that's (1 − specificity) ÷ sensitivity, the inverse of LR+."], [(100 - se) / se, "Divided by sensitivity instead of specificity."], [(100 - se) / (sp - 10), "Took specificity as 10% lower than it is."], [(105 - se) / sp, "Took 1 − sensitivity as 5% higher than it is."]],
      source: "Deeks & Altman, BMJ 2004", explain: steps(
      plus ? `LR+ = sensitivity ÷ (1 − specificity).` : `LR− = (1 − sensitivity) ÷ specificity.`,
      plus ? `= ${fx(se / 100, 2)} ÷ (1 − ${fx(sp / 100, 2)}) = ${fx(se / 100, 2)} ÷ ${fx((100 - sp) / 100, 2)} = **${fx(v, 2)}**.` : `= (1 − ${fx(se / 100, 2)}) ÷ ${fx(sp / 100, 2)} = ${fx((100 - se) / 100, 2)} ÷ ${fx(sp / 100, 2)} = **${fx(v, 2)}**.`,
      plus ? `What it means: ${v >= 10 ? "10 or more — a large rise in the probability of disease." : v >= 5 ? "5–10 — a moderate rise." : "under 5 — a small rise."}` : `What it means: ${v <= 0.1 ? "0.1 or less — a large fall in the probability of disease." : v <= 0.2 ? "0.1–0.2 — a moderate fall." : "above 0.2 — a small fall."}`,
      `Trap: unlike predictive values, likelihood ratios don't shift with prevalence — apply them to pre-test odds, not to a percentage.`,
    ) });
  },
  () => {
    const y = rint(2026, 2027), m = rint(0, 11), d = rint(1, 28), cycle = coin(0.7) ? 28 : pick([30, 32, 35]);
    const edd = naegele(y, m, d, cycle);
    const errors: Err[] = [
      [edd - 7, "Forgot to add the 7 days."],
      [edd - 14, "Took 7 days away instead of adding them."],
      [edd + 3, "Added 10 days instead of 7."],
      [dayOf(y, m + 8, d) + 7 + (cycle - 28), "Added 8 months instead of 9."],
      [dayOf(y, m + 10, d) + 7 + (cycle - 28), "Added 10 months instead of 9."],
      ...(cycle === 28 ? [] : ([[edd - (cycle - 28), "Ignored the longer cycle — add the days beyond 28."], [edd - 2 * (cycle - 28), "Took the extra cycle days away instead of adding them."]] as Err[])),
    ];
    return numeric({ id: "naegele", stem: `First day of the last period: ${dateText(dayOf(y, m, d))}, with regular ${cycle}-day cycles. Expected date of delivery (Naegele's rule)?`, right: edd, ratio: 0, lo: 0, grain: 3, show: dateText, errors, source: "Williams Obstetrics; FOGSI", explain: steps(
      `Naegele's rule: LMP + 9 months + 7 days (for a 28-day cycle)${cycle === 28 ? "" : `, then add the days beyond 28`}.`,
      `${dateText(dayOf(y, m, d))} + 9 months = ${dateText(dayOf(y, m + 9, d))}.`,
      `+ 7 days = ${dateText(dayOf(y, m + 9, d) + 7)}.`,
      cycle !== 28 && `+ ${cycle - 28} days for a ${cycle}-day cycle = ${dateText(edd)}.`,
      `Answer: **${dateText(edd)}**.`,
      `Trap: this assumes ovulation on day 14. A first-trimester dating scan is better, and replaces the LMP date if they differ by more than 7 days.`,
    ) });
  },
  () => {
    const y = rint(2026, 2027), m = rint(0, 11), d = rint(1, 28), days = rint(42, 287);
    const lmp = dayOf(y, m, d);
    const visit = lmp + days;
    return numeric({ id: "gest-age", stem: `First day of the last period: ${dateText(lmp)}; regular 28-day cycles. On ${dateText(visit)}, the gestational age?`, right: days, ratio: 0, lo: 0, grain: 2, show: weeksDays, errors: [
      [days - 14, "Counted from conception — gestational age counts from the LMP."],
      [days + 7, "Counted a week too many."],
      [days - 7, "Counted a week too few."],
      [days + 1, "Counted both the first day and the last."],
      [Math.round(days / 30) * 28 + (days % 7), "Took each month as exactly 4 weeks."],
    ], source: "Williams Obstetrics; ACOG Committee Opinion 700", explain: steps(
      `Gestational age = days from the first day of the LMP to today, ÷ 7.`,
      `${dateText(lmp)} to ${dateText(visit)} = ${days} days.`,
      `${days} ÷ 7 = ${Math.floor(days / 7)} weeks, remainder ${days % 7} = **${weeksDays(days)}**.`,
      `What it means: ${days < 98 ? "first trimester (up to 13 weeks 6 days)." : days < 196 ? "second trimester (14 to 27 weeks 6 days)." : "third trimester (from 28 weeks)."}`,
      `Trap: it's two weeks more than the age from conception. Each month isn't 4 weeks — count the actual days.`,
    ) });
  },
];

/* What skills.ts picks up -------------------------------------------------- */

/** Every calculator, in category order — this order sets the order of the chips. */
export const CALC_BANK: (() => QuizQuestion)[] = [...kidney, ...fluids, ...heart, ...brainLiver, ...bio];

const idsOf = (makers: (() => QuizQuestion)[]) => makers.map((m) => m().id);

/** Each calculator's id, by the category it clinically belongs to. */
export const CALC_CATEGORY_IDS: [string, string[]][] = [
  ["Kidney, Acid-Base & Salts", idsOf(kidney)],
  ["Fluids, Burns & Dosing", idsOf(fluids)],
  ["Heart, Lungs & ICU", idsOf(heart)],
  ["Brain, Liver & GI", idsOf(brainLiver)],
  ["Biostatistics, OB & Body Indices", idsOf(bio)],
];

/** The same as `[category, exact-id pattern]`, the shape catOf reads. */
export const CALC_CATEGORY_PATTERNS: [string, RegExp][] = CALC_CATEGORY_IDS.map(([cat, ids]) => [cat, new RegExp(`^(calc-)?(${ids.join("|")})$`)]);

/** Scores and dates: no ratio of options means anything, so the closeness test treats them separately. */
export const NON_RATIO_CALCS = new Set(["curb", "gcs", "wells-pe", "child-pugh", "meld-na", "bisap", "naegele", "gest-age"]);

/** The harder calculators — left out at the basic level, as the first five already were. */
export const ADVANCED_CALCS = [
  "calc-ag", "calc-crcl", "calc-hs", "calc-ca", "calc-na",
  "calc-delta", "calc-fwd", "calc-osm-gap", "calc-k-deficit",
  "calc-parkland-rate", "calc-drip", "calc-ganzoni", "calc-abl",
  "calc-aa", "calc-ardsnet-vt", "calc-rsbi",
  "calc-maddrey", "calc-meld-na", "calc-phenytoin", "calc-bisap",
  "calc-lr", "calc-odds-ratio",
];

/** Which specialty each new calculator belongs to — a doctor's own come first. */
export const CALC_OWNER: Record<string, string[]> = {
  "calc-hs": ["Pediatrics", "Gastroenterology"], "calc-delta": ["Nephrology", "Medicine"], "calc-winters": ["Nephrology", "Respiratory", "Medicine"], "calc-fwd": ["Nephrology", "Endocrinology"], "calc-fena": ["Nephrology"], "calc-osm": ["Endocrinology", "Emergency"],
  "calc-osm-gap": ["Emergency", "Nephrology"], "calc-k-deficit": ["Nephrology", "Medicine"], "calc-ca": ["Endocrinology"],
  "calc-parkland": ["Surgery", "Emergency"], "calc-parkland-rate": ["Surgery", "Emergency"], "calc-maint": ["Pediatrics"], "calc-adr-paed": ["Pediatrics", "Emergency"], "calc-defib": ["Pediatrics", "Emergency"],
  "calc-drip": ["Emergency", "Cardiology"], "calc-ganzoni": ["OBGYN", "Medicine"], "calc-abl": ["Surgery"], "calc-ors": ["Pediatrics", "General Practice"], "calc-drug-dose": ["Emergency", "Medicine"],
  "calc-map": ["Emergency", "Cardiology"], "calc-qtc": ["Cardiology"], "calc-pf": ["Respiratory"], "calc-aa": ["Respiratory"], "calc-ardsnet-vt": ["Respiratory", "Emergency"], "calc-rsbi": ["Respiratory"], "calc-wells-pe": ["Respiratory", "Emergency", "Cardiology"], "calc-shock-index": ["Emergency", "Surgery"],
  "calc-maddrey": ["Gastroenterology"], "calc-saag": ["Gastroenterology"], "calc-child-pugh": ["Gastroenterology", "Surgery"], "calc-meld-na": ["Gastroenterology"], "calc-phenytoin": ["Neurology"], "calc-bisap": ["Gastroenterology", "Surgery"], "calc-cpp": ["Neurology", "Surgery"],
  "calc-naegele": ["OBGYN", "General Practice"], "calc-gest-age": ["OBGYN"], "calc-bmi": ["General Practice", "Endocrinology"], "calc-nnt": ["General Practice"],
};
