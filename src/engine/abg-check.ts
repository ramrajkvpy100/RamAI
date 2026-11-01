/**
 * Numbers that must agree, whoever wrote them. pH follows from HCO3 and PaCO2 (Henderson–Hasselbalch) and the anion gap
 * from Na, Cl and HCO3: when a result disagrees by more than rounding, the worked-out value replaces it.
 */
import type { LabRow } from "./types";

const PH_TOLERANCE = 0.03;
const GAP_TOLERANCE = 1;

const find = (rows: readonly LabRow[], re: RegExp) => rows.find((r) => re.test(r.analyte.trim()));
const num = (row?: LabRow) => {
  // A plain number only: "<7.0" or "pending" is left alone.
  const v = row && /^\d+(?:\.\d+)?$/.test(row.value.trim()) ? Number(row.value) : NaN;
  return Number.isFinite(v) ? v : undefined;
};

export const expectedPH = (hco3: number, paco2: number) => 6.1 + Math.log10(hco3 / (0.03 * paco2));

export function consistentLabs(rows: readonly LabRow[]): LabRow[] {
  const ph = find(rows, /^(?:arterial |venous |blood )?ph$/i);
  const hco3 = find(rows, /hco3|hco₃|bicarb/i);
  const paco2 = find(rows, /^(?:p\s*a?\s*co2|pco₂|paco₂|pco2)\b|carbon dioxide/i);
  const na = find(rows, /^(?:serum )?(?:sodium|na\+?)\b/i);
  const cl = find(rows, /^(?:serum )?(?:chloride|cl-?)\b/i);
  const gap = find(rows, /anion gap/i);
  const changed = new Map<LabRow, LabRow>();

  const [h, p] = [num(hco3), num(paco2)];
  const shown = num(ph);
  if (h && p && shown !== undefined) {
    const right = expectedPH(h, p);
    if (Math.abs(right - shown) > PH_TOLERANCE) changed.set(ph!, { ...ph!, value: right.toFixed(2), flag: right < 7.35 ? "low" : right > 7.45 ? "high" : "normal" });
  }
  const [n, c, g] = [num(na), num(cl), num(gap)];
  if (n && c && h && g !== undefined && Math.abs(n - c - h - g) > GAP_TOLERANCE) {
    const right = n - c - h;
    changed.set(gap!, { ...gap!, value: String(Math.round(right * 10) / 10), flag: right > 12 ? "high" : "normal" });
  }
  return changed.size ? rows.map((r) => changed.get(r) ?? r) : [...rows];
}
