/**
 * Labs that follow what was done to the patient. Whoever wrote a result, code moves it by what has gone in since:
 * crystalloid dilutes haemoglobin and albumin, saline's chloride lowers bicarbonate, red cells raise haemoglobin, and CO₂
 * retained on too much oxygen raises PaCO₂. pH and the anion gap then follow by calculation (abg-check.ts).
 *
 * These are teaching approximations, pure functions of the case and the orders so a case replays exactly: blood volume
 * 70 mL/kg, about a quarter of isotonic crystalloid staying in the vessels, extracellular fluid 20% of body weight, and the
 * Boston rules for how PaCO₂ follows a metabolic change (Winter's formula below 24 mEq/L).
 */
import { alveolarPO2, expectedPH } from "./abg-check";
import type { LabRow } from "./types";

export interface FluidGiven {
  drugId: string;
  /** mL that have run in so far. */
  ml: number;
  /** Minutes since it ran. */
  ago: number;
}

export interface LabContext {
  /** Hours since the patient began answering treatment. */
  recoveryHours?: number;
  /** Hours on an antibiotic; hours since fluids that restored the pressure (0 if neither). */
  antibioticHours?: number;
  rehydratedHours?: number;
  weightKg: number;
  fluids: readonly FluidGiven[];
  /** Units of red cells that have gone in. */
  redCellUnits: number;
  /** How far PaCO₂ has risen from too much oxygen in someone who retains CO₂ (mmHg). */
  co2Retained: number;
  age: number;
  sex: string;
  heightCm?: number;
  /** SpO₂ on arrival and now, for PaO₂ to follow. */
  spo2Base?: number;
  spo2Now?: number;
  /** Oxygen being breathed (%), 21 on room air. */
  fio2?: number;
  /** Time in shock so far, and hours since it ended. */
  shockMinutes?: number;
  hoursSinceShock?: number;
  /** What the drugs on board have done to potassium (mEq/L). */
  potassiumShift?: number;
  /** Breathing can't compensate: opioids, sedatives, CO₂ retention, fatigue. */
  blunted?: boolean;
}

const SALINE = new Set(["ns", "saline-3", "normal-saline"]);
const CRYSTALLOID = new Set(["ns", "rl", "normal-saline", "ringer-lactate", "dns"]);
/** What a lab shows while the analyser couldn't answer: never a false normal. */
export const LAB_PENDING = "Pending: lab analyser busy. Order it again to re-run.";

/** The kidneys clear what was infused with a half-life of some hours. */
const left = (ago: number) => Math.exp(-Math.max(0, ago) / 480);

/** Severinghaus: oxygen saturation (%) from PaO₂ (mmHg). */
export const severinghaus = (pao2: number, pH = 7.4) => {
  // The Bohr shift: acid moves the curve right, so the same PaO₂ carries less.
  const p = pao2 * 10 ** (0.48 * (pH - 7.4));
  return 100 / (23400 / (p ** 3 + 150 * p) + 1);
};

/** The PaO₂ that gives this saturation. */
export function pao2ForSaturation(saturation: number, pH = 7.4): number {
  let [lo, hi] = [5, 600];
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (severinghaus(mid, pH) < saturation) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Winter's formula: the PaCO₂ a metabolic acidosis should bring. */
export const wintersPaCO2 = (hco3: number) => 1.5 * hco3 + 8;

const analyte = (rows: readonly LabRow[], re: RegExp) => rows.find((r) => re.test(r.analyte.trim()));
const plain = (row?: LabRow) => {
  const v = row && /^\d+(?:\.\d+)?$/.test(row.value.trim()) ? Number(row.value) : NaN;
  return Number.isFinite(v) ? v : undefined;
};

/** The flag a value earns against the row's own printed range. */
export function flagFor(row: LabRow, value: number): LabRow["flag"] {
  const range = row.reference?.replace(/[−–—]/g, "-").match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (!range) return row.flag;
  const [lo, hi] = [Number(range[1]), Number(range[2])];
  return value < lo ? "low" : value > hi ? "high" : "normal";
}

function set(out: Map<LabRow, LabRow>, row: LabRow | undefined, value: number, places: number) {
  if (!row) return;
  out.set(row, { ...row, value: value.toFixed(places), flag: flagFor(row, value) });
}

/** CKD-EPI 2021 (adults). */
export function ckdEpi(creatinine: number, age: number, sex: string): number {
  const female = sex === "Female";
  const k = female ? 0.7 : 0.9;
  const a = female ? -0.241 : -0.302;
  return 142 * Math.min(creatinine / k, 1) ** a * Math.max(creatinine / k, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1);
}

/** Cockcroft–Gault, the clearance drug doses go by. */
export const creatinineClearance = (age: number, weightKg: number, creatinine: number, sex: string) => (((140 - age) * weightKg) / (72 * creatinine)) * (sex === "Female" ? 0.85 : 1);

/** eGFR worked out from the creatinine shown, so the two always agree: CKD-EPI in adults, bedside Schwartz in children. */
function withEgfr(rows: readonly LabRow[], ctx: LabContext): LabRow[] {
  const egfr = analyte(rows, /^e?gfr\b/i);
  const cr = plain(analyte(rows, /^(?:serum )?creatinine\b/i));
  if (!egfr || cr === undefined || cr <= 0) return [...rows];
  const value = ctx.age >= 18 ? ckdEpi(cr, ctx.age, ctx.sex) : ctx.heightCm ? (0.413 * ctx.heightCm) / cr : undefined;
  if (value === undefined) return [...rows];
  return rows.map((r) => (r === egfr ? { ...r, value: value >= 90 ? "> 90" : String(Math.round(value)), flag: value >= 90 ? "normal" : value < 30 ? "critical" : "low" } : r));
}

/** Children's reference ranges, by age. */
function childRange(name: string, age: number): [number, number] | undefined {
  if (/^(?:hb|hgb|ha?emoglobin)\b/i.test(name)) return age < 1 ? [10, 14] : age < 6 ? [11, 14] : [11.5, 15];
  if (/^(?:serum )?creatinine\b/i.test(name)) return age < 1 ? [0.2, 0.4] : age < 6 ? [0.2, 0.5] : [0.3, 0.7];
  if (/^(?:wbc|tlc|white|total leu)/i.test(name)) return age < 2 ? [6, 17.5] : age < 6 ? [5.5, 15.5] : [4.5, 13.5];
  return undefined;
}

/**
 * A child's result against a child's range. A number written as normal is a normal one, so it's put within the child's range
 * (an adult's creatinine of 0.9 isn't a normal 2-year-old's); one written as abnormal keeps its value and is judged afresh.
 */
function childLabs(rows: readonly LabRow[], age: number): LabRow[] {
  if (age >= 13) return [...rows];
  return rows.map((r) => {
    const range = childRange(r.analyte.trim(), age);
    const v = plain(r);
    if (!range || v === undefined) return r;
    // White cells may be written in thousands or in units per microlitre.
    const scale = /^(?:wbc|tlc|white|total leu)/i.test(r.analyte.trim()) && v > 200 ? 1000 : 1;
    const [lo, hi] = [range[0] * scale, range[1] * scale];
    const reference = scale === 1 ? `${range[0]}–${range[1]}` : `${lo.toLocaleString("en-US")}–${hi.toLocaleString("en-US")}`;
    if (r.flag === "normal" && (v < lo || v > hi)) {
      const mid = (lo + hi) / 2;
      return { ...r, value: scale === 1 ? mid.toFixed(1) : String(Math.round(mid / 100) * 100), reference, flag: "normal" as const };
    }
    return { ...r, reference, flag: v < lo ? "low" : v > hi ? "high" : "normal" };
  });
}

/**
 * A routine panel's other rows, from what the case wrote and the diagnosis: red-cell indices that fit the anaemia, a haematocrit that
 * fits the haemoglobin, and a chloride that fits the sodium and bicarbonate (followLabs then moves them for what's been given).
 */
export function alignedPanel(baseline: readonly LabRow[], written: readonly LabRow[], diagnosis: string): LabRow[] {
  const value = (name: RegExp) => {
    const v = parseFloat(written.find((r) => name.test(r.analyte))?.value.replace(/,/g, "") ?? "");
    return Number.isFinite(v) ? v : undefined;
  };
  const hb = value(/^(?:haemoglobin|hemoglobin|hb)\b/i);
  const na = value(/^(?:sodium|na)\b/i);
  const hco3 = value(/^(?:bicarbonate|hco3|hco₃|tco2)/i);
  const small = /iron|thalass|chronic (?:blood|gi) loss|menorrhagia|haemorrhoid|ulcer/i.test(diagnosis);
  const big = /b12|folate|megaloblast|alcohol|hypothyroid|pernicious/i.test(diagnosis);
  const anaemic = hb !== undefined && hb < 11.5;
  const mcv = anaemic && small ? 70 : anaemic && big ? 106 : undefined;
  return baseline.map((r) => {
    const set = (n: number, digits = 0) => {
      const out = { ...r, value: n.toFixed(digits) };
      return { ...out, flag: flagFor(out, n) };
    };
    if (/^mcv\b/i.test(r.analyte) && mcv !== undefined) return set(mcv);
    if (/^mch\b/i.test(r.analyte) && mcv !== undefined) return set(mcv / 3.3, 1);
    if (/^(?:haematocrit|hematocrit|pcv)\b/i.test(r.analyte) && hb !== undefined) return set(hb * 3);
    if (/^base excess\b/i.test(r.analyte) && hco3 !== undefined) {
      const be = hco3 - 24;
      return { ...r, value: String(be), flag: be < -2 ? ("low" as const) : be > 2 ? ("high" as const) : ("normal" as const) };
    }
    if (/^(?:chloride|cl)\b/i.test(r.analyte) && na !== undefined) return set(hco3 !== undefined ? na - hco3 - 12 : na - 38);
    return r;
  });
}

/** Glucose and oxygen saturation on a panel are the patient's own numbers, unless the case wrote them. */
export function fromVitals(rows: readonly LabRow[], written: ReadonlyMap<string, unknown>, glucose?: string, spo2?: string, glucoseBase?: string): LabRow[] {
  return rows.map((r) => {
    const isGlucose = /^(?:(?:random|blood|plasma|serum) )?glucose$/i.test(r.analyte);
    const now = parseFloat(glucose ?? ""), base = parseFloat(glucoseBase ?? "");
    // A written glucose moves as the sugar has since (insulin down, dextrose up).
    if (isGlucose && written.has(r.analyte.toLowerCase())) {
      const was = parseFloat(r.value.replace(/,/g, ""));
      if (!Number.isFinite(was) || !Number.isFinite(now) || !Number.isFinite(base) || Math.abs(now - base) < 1) return r;
      const out = { ...r, value: String(Math.max(20, Math.round(was + now - base))) };
      return { ...out, flag: flagFor(out, parseFloat(out.value)) };
    }
    const n = isGlucose ? now : /^sao₂$/i.test(r.analyte) ? parseFloat(spo2 ?? "") : NaN;
    if (!Number.isFinite(n) || written.has(r.analyte.toLowerCase())) return r;
    const out = { ...r, value: String(Math.round(n)) };
    return { ...out, flag: flagFor(out, n) };
  });
}

const CRITICAL: [RegExp, number, number][] = [[/^potassium\b/i, 2.5, 6.5], [/^sodium\b/i, 120, 160], [/^ph\b/i, 7.2, 7.6], [/^(?:haemoglobin|hemoglobin)\b/i, 7, 22], [/^lactate\b/i, 0, 4], [/^glucose\b/i, 50, 400], [/^platelets?\b/i, 0.2, 10]];

/** A value that can kill today is marked as critical, not just high or low. */
export function criticalFlags(rows: readonly LabRow[]): LabRow[] {
  return rows.map((r) => {
    const limit = CRITICAL.find(([name]) => name.test(r.analyte));
    const n = parseFloat(r.value.replace(/,/g, ""));
    return limit && Number.isFinite(n) && (n < limit[1] || n >= limit[2]) ? { ...r, flag: "critical" as const } : r;
  });
}

/** On a repeat, each value that moved says what it was. */
export function withTrend(rows: readonly LabRow[], earlier?: readonly LabRow[]): LabRow[] {
  if (!earlier?.length) return [...rows];
  return rows.map((r) => {
    const was = earlier.find((e) => e.analyte === r.analyte)?.value;
    const a = parseFloat(String(was ?? "").replace(/,/g, "")), b = parseFloat(r.value.replace(/,/g, ""));
    return was !== undefined && Number.isFinite(a) && Number.isFinite(b) && a !== b ? { ...r, was, trend: b > a ? ("up" as const) : ("down" as const) } : r;
  });
}

export function followLabs(written: readonly LabRow[], ctx: LabContext): LabRow[] {
  return withEgfr(moved(childLabs(written, ctx.age), ctx), ctx);
}

function moved(rows: readonly LabRow[], ctx: LabContext): LabRow[] {
  const weight = ctx.weightKg > 0 ? ctx.weightKg : 60;
  const crystalloid = ctx.fluids.filter((f) => CRYSTALLOID.has(f.drugId)).reduce((sum, f) => sum + f.ml * left(f.ago), 0);
  const saline = ctx.fluids.filter((f) => SALINE.has(f.drugId)).reduce((sum, f) => sum + f.ml * left(f.ago), 0);
  const out = new Map<LabRow, LabRow>();
  const shockHours = (ctx.shockMinutes ?? 0) / 60;
  const fio2 = ctx.fio2 ?? 21;
  const quiet = crystalloid < 250 && ctx.redCellUnits === 0 && ctx.co2Retained < 1 && shockHours === 0 && !ctx.potassiumShift;
  const oxygenMoved = (ctx.spo2Base && ctx.spo2Now && Math.abs(ctx.spo2Now - ctx.spo2Base) >= 1) || fio2 > 21;
  const recovering = (ctx.recoveryHours ?? 0) >= 0.25;
  if (quiet && !oxygenMoved && !recovering) return [...rows];

  // Dilution: the same red cells and albumin in more plasma water.
  const bloodMl = 70 * weight;
  const dilution = bloodMl / (bloodMl + 0.25 * crystalloid);
  const hb = analyte(rows, /^(?:hb|hgb|ha?emoglobin)\b/i);
  const hbNow = plain(hb);
  // One unit of red cells raises an adult's haemoglobin by about 1 g/dL; a smaller body by more.
  if (hbNow !== undefined) set(out, hb, hbNow * dilution + ctx.redCellUnits * (70 / Math.max(weight, 10)), 1);
  const hct = analyte(rows, /^(?:hct|pcv|ha?ematocrit)\b/i);
  const hctNow = plain(hct);
  if (hctNow !== undefined) set(out, hct, hctNow * dilution + ctx.redCellUnits * 3 * (70 / Math.max(weight, 10)), 1);
  const albumin = analyte(rows, /^(?:serum )?albumin\b/i);
  const albuminNow = plain(albumin);
  if (albuminNow !== undefined) set(out, albumin, albuminNow * dilution, 1);

  // Saline's chloride (154 mEq/L) mixes through the extracellular fluid, and bicarbonate falls by much of what chloride rises.
  const ecfMl = 200 * weight;
  const cl = analyte(rows, /^(?:serum )?(?:chloride|cl)\b/i);
  const clNow = plain(cl);
  const na = analyte(rows, /^(?:serum )?(?:sodium|na)\b/i);
  const naNow = plain(na);
  if (naNow !== undefined && saline >= 250) set(out, na, (naNow * ecfMl + 154 * saline) / (ecfMl + saline), 0);
  const clBase = clNow ?? 102;
  const clAfter = saline >= 250 ? (clBase * ecfMl + 154 * saline) / (ecfMl + saline) : clBase;
  if (clNow !== undefined && saline >= 250) set(out, cl, clAfter, 0);

  const hco3 = analyte(rows, /^(?:serum |standard |actual )?(?:hco3|hco₃|bicarb)/i);
  const hco3Now = plain(hco3);
  const pco2 = analyte(rows, /^(?:pa?co2|pa?co₂)/i);
  const pco2Now = plain(pco2);
  const kpa = pco2 ? /kpa/i.test(pco2.unit ?? "") : false;
  // Shock: lactate climbs with its duration and uses up bicarbonate one for one; once it's over, about 20% clears each hour.
  const clearing = 0.8 ** (ctx.hoursSinceShock ?? 0);
  const lactateUp = Math.min(12, shockHours * 1.5) * clearing;
  const lactate = analyte(rows, /^(?:serum |blood )?lactate\b/i);
  const lactateNow = plain(lactate);
  if (lactateUp > 0.05 && lactateNow !== undefined) set(out, lactate, lactateNow + lactateUp, 1);
  const hco3After = hco3Now === undefined ? undefined : Math.max(4, hco3Now - 0.6 * (clAfter - clBase) - lactateUp);
  if (hco3 && hco3After !== undefined && hco3After !== hco3Now) set(out, hco3, hco3After, 1);
  // Pre-renal injury from the hours of poor perfusion.
  const renal = 1 + Math.min(2.5, shockHours * 0.12) * clearing;
  if (renal > 1.01) {
    const creatinine = analyte(rows, /^(?:serum )?creatinine\b/i);
    const urea = analyte(rows, /^(?:serum |blood )?(?:urea|bun)\b/i);
    const [c, u] = [plain(creatinine), plain(urea)];
    if (c !== undefined) set(out, creatinine, c * renal, 1);
    if (u !== undefined) set(out, urea, u * (1 + (renal - 1) * 1.4), 0);
  }
  let pco2After = pco2Now;
  if (pco2 && pco2Now !== undefined && !kpa) {
    // Breathing follows the bicarbonate (about 1.2 mmHg per mEq/L, Winter's range), unless something blunts it; retained CO₂ adds to it.
    const compensated = hco3Now !== undefined && hco3After !== undefined && !ctx.blunted ? pco2Now - 1.2 * (hco3Now - hco3After) : pco2Now;
    pco2After = Math.max(10, compensated + ctx.co2Retained);
    if (Math.abs(pco2After - pco2Now) >= 0.5) set(out, pco2, pco2After, 0);
    // Retained CO₂ raises bicarbonate a little at once (about 1 per 10 mmHg).
    if (ctx.co2Retained >= 10 && hco3 && hco3After !== undefined) set(out, hco3, hco3After + ctx.co2Retained / 10, 1);
  }
  const shownHco3 = plain(hco3 ? out.get(hco3) ?? hco3 : undefined) ?? hco3Now;
  const shownPh = shownHco3 && pco2After ? expectedPH(shownHco3, pco2After) : 7.4;
  // Potassium: about 0.5 mEq/L against every 0.1 of pH, on top of what the drugs have done.
  const potassium = analyte(rows, /^(?:serum )?(?:potassium|k\+?)(?![a-z])/i);
  const kNow = plain(potassium);
  if (kNow !== undefined) {
    const startPh = hco3Now && pco2Now ? expectedPH(hco3Now, pco2Now) : shownPh;
    const k = kNow - 5 * (shownPh - startPh) + (ctx.potassiumShift ?? 0);
    if (Math.abs(k - kNow) >= 0.05) set(out, potassium, Math.max(1.5, k), 1);
  }
  // Oxygen: on air or with the saturation below the flat of the curve, PaO₂ moves with the saturation (Severinghaus);
  // on the flat, it's what the alveolus offers less a gap that widens with the oxygen given, as shunt does.
  const po2 = analyte(rows, /^(?:pa?o2|pa?o₂)(?![a-z0-9])/i);
  const po2Now = plain(po2);
  if (po2 && po2Now !== undefined && !/kpa/i.test(po2.unit ?? "")) {
    const [base, now] = [ctx.spo2Base, ctx.spo2Now];
    let target: number | undefined;
    if (base && now && now > 0 && Math.abs(now - base) >= 1 && now < 99) target = pao2ForSaturation(Math.max(30, severinghaus(po2Now) + now - base), shownPh);
    else if (fio2 > 21) {
      const gap = Math.max(5, alveolarPO2(21, pco2Now ?? 40) - po2Now) * (1 + (fio2 - 21) / 50);
      target = Math.max(po2Now, alveolarPO2(fio2, pco2After ?? 40) - gap);
    }
    if (target !== undefined) set(out, po2, target, 0);
  }
  // A patient answering treatment clears what the illness had upset: lactate, then the acid-base numbers (pH follows from them).
  // At most part of the way in these hours, so a chronically raised CO₂ isn't made normal.
  if (recovering) {
    const part = Math.min(0.6, 1 - 0.6 ** ctx.recoveryHours!);
    const toward = (row: LabRow | undefined, lo: number, hi: number, normal: number, digits: number) => {
      const v = plain(row ? out.get(row) ?? row : undefined);
      if (row && v !== undefined && (v < lo || v > hi)) set(out, row, v + (normal - v) * part, digits);
    };
    toward(lactate, 0, 2, 1.2, 1);
    if (!kpa) toward(pco2, 35, 45, 40, 0);
    toward(hco3, 22, 26, 24, 1);
    // Pre-renal injury mends over 12–24 h once fluids have restored the pressure and urine.
    if ((ctx.rehydratedHours ?? 0) >= 12) {
      const mend = Math.min(0.7, 0.3 + (ctx.rehydratedHours! - 12) / 30);
      const creatinine = analyte(rows, /^(?:serum )?creatinine\b/i);
      const urea = analyte(rows, /^(?:serum |blood )?(?:urea|bun)\b/i);
      const [c, u] = [plain(creatinine ? out.get(creatinine) ?? creatinine : undefined), plain(urea ? out.get(urea) ?? urea : undefined)];
      if (creatinine && c !== undefined && c > 1.2) set(out, creatinine, c + (1 - c) * mend, 1);
      if (urea && u !== undefined && u > 40) set(out, urea, u + (30 - u) * mend, 0);
    }
    // White cells and inflammatory markers fall from a day or two into an antibiotic that's working.
    if ((ctx.antibioticHours ?? 0) >= 24) {
      const fall = Math.min(0.7, 0.3 + (ctx.antibioticHours! - 24) / 96);
      const wbc = analyte(rows, /^(?:wbc|tlc|total leu)/i);
      const w = plain(wbc);
      if (wbc && w !== undefined) {
        const thousand = w > 200 ? 1000 : 1;
        if (w > 11 * thousand) set(out, wbc, Math.round((w + (8 * thousand - w) * fall) / (thousand === 1 ? 0.1 : 100)) * (thousand === 1 ? 0.1 : 100), thousand === 1 ? 1 : 0);
      }
      for (const name of [/^(?:hs-?)?crp\b|^c-reactive/i, /^procalcitonin\b|^pct\b/i]) {
        const row = analyte(rows, name);
        const v = plain(row);
        if (row && row.flag !== "normal" && v !== undefined) set(out, row, v * (1 - fall), 1);
      }
    }
  }
  return rows.map((r) => out.get(r) ?? r);
}

const BREATHING_TROUBLE = /pneumon|copd|chronic obstructive|emphysema|asthma|ards|pulmonary|aspirat|respiratory|embol|effusion|pneumothorax|sedat|opioid|overdose|poison|salicylate|aspirin|neuromuscular|guillain|myasthen|botul|snake|krait|organophosph|hypoventil|cardiac arrest/i;

/**
 * A metabolic acidosis with PaCO₂ that Winter's formula doesn't explain, in an illness that gives the lungs no reason for it,
 * is a written number that's wrong: it's brought into range. A lung or breathing illness can have a true mixed disorder, and is left.
 */
export function compensated(rows: readonly LabRow[], diagnosis: string): LabRow[] {
  if (BREATHING_TROUBLE.test(diagnosis)) return [...rows];
  const hco3 = analyte(rows, /^(?:serum |standard |actual )?(?:hco3|hco₃|bicarb)/i);
  const pco2 = analyte(rows, /^(?:pa?co2|pa?co₂)/i);
  const h = plain(hco3), p = plain(pco2);
  if (h === undefined || p === undefined || !pco2 || h >= 20 || /kpa/i.test(pco2.unit ?? "")) return [...rows];
  const expected = wintersPaCO2(h);
  if (Math.abs(p - expected) <= 5) return [...rows];
  const right = Math.max(10, Math.round(expected));
  return rows.map((r) => (r === pco2 ? { ...r, value: String(right), flag: flagFor(r, right) } : r));
}
