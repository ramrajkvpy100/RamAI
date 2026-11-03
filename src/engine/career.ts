/**
 * The four career indices beside the rating, from each unassisted case's stored score lines. Pure, like the rating.
 * Each stays blank until there are enough cases for the number to mean something.
 */
export interface CareerRow {
  verdict: string | null;
  failed: number | null;
  track: string;
  /** CaseDetail as stored: l = [category, earned, max], lost = [category, reason]. */
  detail: string | null;
}

export interface CareerIndices {
  /** Correct diagnoses, a partly right one counting half. */
  diagnosticPrecision: number | null;
  /** Cases with no harmful or contraindicated order and nobody left harmed. */
  zeroHarm: number | null;
  /** Emergencies where definitive treatment came in time. */
  stabilisationSpeed: number | null;
  /** How well tests were chosen: high yield, nothing wasted. */
  stewardship: number | null;
  cases: number;
}

/** Fewer than this, and an index isn't shown. */
export const INDEX_MIN_CASES = 3;

const parse = (raw: string | null): { l?: [string, number, number][]; lost?: [string, string][] } => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const pct = (n: number, of: number) => (of >= INDEX_MIN_CASES ? Math.round((n / of) * 100) : null);

export function careerIndices(rows: readonly CareerRow[]): CareerIndices {
  let dx = 0, dxOf = 0, safe = 0, safeOf = 0, fast = 0, fastOf = 0, tests = 0, testsOf = 0;
  for (const r of rows) {
    const d = parse(r.detail);
    if (r.verdict) {
      dxOf += 1;
      dx += r.verdict === "correct" ? 1 : r.verdict === "partial" ? 0.5 : 0;
    }
    const safety = d.l?.find((x) => x[0] === "drugSafety");
    safeOf += 1;
    if (!r.failed && (!safety || safety[1] >= safety[2]) && !d.lost?.some((x) => /could harm/i.test(x[1]))) safe += 1;
    if (r.track === "emergency") {
      fastOf += 1;
      if (!r.failed && !d.lost?.some((x) => x[0] === "treatment" && /never given|came after the first/i.test(x[1]))) fast += 1;
    }
    const chosen = d.l?.find((x) => x[0] === "investigationSelection");
    if (chosen && chosen[2] > 0) {
      testsOf += 1;
      tests += chosen[1] / chosen[2];
    }
  }
  return { diagnosticPrecision: pct(dx, dxOf), zeroHarm: pct(safe, safeOf), stabilisationSpeed: pct(fast, fastOf), stewardship: pct(tests, testsOf), cases: rows.length };
}

/** The line a doctor can paste on a CV. Says what it is: a simulation score. */
export function cvBullet(c: { rating: number; rank: string; top: number | null; cases: number; indices: CareerIndices; link?: string | null }): string {
  const parts = [
    c.indices.zeroHarm !== null ? `Patient Safety Index ${c.indices.zeroHarm}%` : "",
    c.indices.diagnosticPrecision !== null ? `Diagnostic Precision ${c.indices.diagnosticPrecision}%` : "",
  ].filter(Boolean);
  return `RamAI Clinical Rating ${c.rating} (${c.rank}${c.top !== null ? `, top ${c.top}% of rated doctors` : ""}) across ${c.cases} unassisted simulated cases${parts.length ? `; ${parts.join(", ")}` : ""}. Simulation-based self-assessment.${c.link ? ` Verify: ${c.link}` : ""}`;
}
