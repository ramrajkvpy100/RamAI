/**
 * Labs that follow what was done to the patient. Whoever wrote a result, code moves it by what has gone in since:
 * crystalloid dilutes haemoglobin and albumin, saline's chloride lowers bicarbonate, red cells raise haemoglobin, and CO₂
 * retained on too much oxygen raises PaCO₂. pH and the anion gap then follow by calculation (abg-check.ts).
 *
 * These are teaching approximations, pure functions of the case and the orders so a case replays exactly: blood volume
 * 70 mL/kg, about a quarter of isotonic crystalloid staying in the vessels, extracellular fluid 20% of body weight, and the
 * Boston rules for how PaCO₂ follows a metabolic change (Winter's formula below 24 mEq/L).
 */
import type { LabRow } from "./types";

export interface FluidGiven {
  drugId: string;
  /** mL that have run in so far. */
  ml: number;
  /** Minutes since it ran. */
  ago: number;
}

export interface LabContext {
  weightKg: number;
  fluids: readonly FluidGiven[];
  /** Units of red cells that have gone in. */
  redCellUnits: number;
  /** How far PaCO₂ has risen from too much oxygen in someone who retains CO₂ (mmHg). */
  co2Retained: number;
  age: number;
  sex: string;
  heightCm?: number;
}

const SALINE = new Set(["ns", "saline-3", "normal-saline"]);
const CRYSTALLOID = new Set(["ns", "rl", "normal-saline", "ringer-lactate", "dns"]);
/** The kidneys clear what was infused with a half-life of some hours. */
const left = (ago: number) => Math.exp(-Math.max(0, ago) / 480);

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

export function followLabs(written: readonly LabRow[], ctx: LabContext): LabRow[] {
  return withEgfr(moved(childLabs(written, ctx.age), ctx), ctx);
}

function moved(rows: readonly LabRow[], ctx: LabContext): LabRow[] {
  const weight = ctx.weightKg > 0 ? ctx.weightKg : 60;
  const crystalloid = ctx.fluids.filter((f) => CRYSTALLOID.has(f.drugId)).reduce((sum, f) => sum + f.ml * left(f.ago), 0);
  const saline = ctx.fluids.filter((f) => SALINE.has(f.drugId)).reduce((sum, f) => sum + f.ml * left(f.ago), 0);
  if (crystalloid < 250 && ctx.redCellUnits === 0 && ctx.co2Retained < 1) return [...rows];
  const out = new Map<LabRow, LabRow>();

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
  const hco3After = hco3Now === undefined ? undefined : Math.max(4, hco3Now - 0.6 * (clAfter - clBase));
  if (hco3 && hco3After !== undefined && hco3After !== hco3Now) set(out, hco3, hco3After, 1);
  if (pco2 && pco2Now !== undefined && !kpa) {
    // Breathing follows the bicarbonate (about 1.2 mmHg per mEq/L, Winter's range); retained CO₂ adds to it.
    const compensated = hco3Now !== undefined && hco3After !== undefined ? pco2Now - 1.2 * (hco3Now - hco3After) : pco2Now;
    set(out, pco2, compensated + ctx.co2Retained, 0);
    // Retained CO₂ raises bicarbonate a little at once (about 1 per 10 mmHg).
    if (ctx.co2Retained >= 10 && hco3 && hco3After !== undefined) set(out, hco3, hco3After + ctx.co2Retained / 10, 1);
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
