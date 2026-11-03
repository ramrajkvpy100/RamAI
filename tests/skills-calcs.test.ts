import { describe, expect, it } from "vitest";
import * as F from "@/lib/banks/calcs";
import { ADVANCED_CALCS, CALC_BANK, CALC_CATEGORY_IDS, NON_RATIO_CALCS } from "@/lib/banks/calcs";
import { CALC_CATS, CALC_IDS, CALCULATION_COUNT, calculationQuestions, catOf } from "@/lib/skills";
import baseline from "./fixtures/skills-baseline.json";

const RUNS = 250;
const nums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
const value = (opt: string) => parseFloat(opt);
const isoDay = (t: string) => Date.parse(`${t} UTC`) / 86_400_000;

/**
 * Each answer worked out again from the numbers in the stem, with the formula written out here rather than
 * imported, so a wrong formula in the bank can't pass by agreeing with itself.
 */
const recompute: Record<string, (n: number[], stem: string) => number> = {
  ag: ([na, , cl, h]) => na! - cl! - h!,
  delta: ([na, cl, h]) => (na! - cl! - h! - 12) / (24 - h!),
  winters: ([h]) => 1.5 * h! + 8,
  na: ([na, g]) => na! + (1.6 * (g! - 100)) / 100,
  fwd: ([age, wt, na], s) => (/woman/.test(s) ? (age! > 65 ? 0.45 : 0.5) : age! > 65 ? 0.5 : 0.6) * wt! * (na! / 140 - 1),
  fena: ([pna, pcr, una, ucr]) => ((una! * pcr!) / (pna! * ucr!)) * 100,
  crcl: ([age, wt, cr], s) => ((140 - age!) * wt! * (/woman/.test(s) ? 0.85 : 1)) / (72 * cr!),
  osm: ([na, g, u]) => 2 * na! + g! / 18 + u! / 6,
  "osm-gap": ([m, na, g, u]) => m! - (2 * na! + g! / 18 + u! / 6),
  "k-deficit": ([k]) => 300 * (4 - k!),
  ca: ([ca, alb]) => ca! + 0.8 * (4 - alb!),
  parkland: ([wt, t]) => 2 * wt! * t!,
  "parkland-rate": ([wt, t, late], s) => (/arrives/.test(s) ? (2 * wt! * t!) / (8 - late!) : (2 * wt! * t!) / 16),
  hs: ([w]) => (w! <= 10 ? 100 * w! : w! <= 20 ? 1000 + 50 * (w! - 10) : 1500 + 20 * (w! - 20)),
  maint: ([w]) => (w! <= 10 ? 4 * w! : w! <= 20 ? 40 + 2 * (w! - 10) : 60 + w! - 20),
  pcm: ([w]) => Math.round((15 * w!) / 10) * 10,
  "adr-paed": ([w]) => w! * 0.01,
  "drug-dose": ([w, perKg]) => w! * perKg!,
  defib: ([w], s) => w! * (/first/.test(s) ? 2 : 4),
  drip: ([mg, ml, w, dose]) => (dose! * w! * 60) / ((mg! * 1000) / ml!),
  ganzoni: ([w, hb]) => w! * (15 - hb!) * 2.4 + 500,
  abl: ([w, perKg, hi, lo]) => (w! * perKg! * (hi! - lo!)) / hi!,
  ors: ([w]) => 75 * w!,
  map: ([s, d]) => (s! + 2 * d!) / 3,
  qtc: ([qt, hr]) => qt! / Math.sqrt(60 / hr!),
  pf: ([p, f]) => p! / (f! / 100),
  aa: ([, f, pao2, paco2]) => (f! / 100) * 713 - paco2! / 0.8 - pao2!,
  "ardsnet-vt": ([h], s) => 6 * ((/woman/.test(s) ? 45.5 : 50) + 0.91 * (h! - 152.4)),
  rsbi: ([rr, vt]) => rr! / (vt! / 1000),
  "shock-index": ([hr, s]) => hr! / s!,
  maddrey: ([pt, c, b]) => 4.6 * (pt! - c!) + b!,
  saag: ([s, a]) => s! - a!,
  phenytoin: ([l, alb]) => l! / (0.2 * alb! + 0.1),
  cpp: ([s, d, icp]) => (s! + 2 * d!) / 3 - icp!,
  bmi: ([w, h]) => w! / (h! / 100) ** 2,
  bsa: ([h, w]) => Math.sqrt((h! * w!) / 3600),
  "sens-spec": ([tp, fp, fn, tn], s) => (/sensitivity/.test(s) ? (100 * tp!) / (tp! + fn!) : (100 * tn!) / (tn! + fp!)),
  "ppv-npv": ([tp, fp, fn, tn], s) => (/positive predictive/.test(s) ? (100 * tp!) / (tp! + fp!) : (100 * tn!) / (tn! + fn!)),
  nnt: ([c, t]) => Math.ceil(100 / (c! - t!) - 1e-9),
  "odds-ratio": ([ce, cu, ctlE, ctlU]) => (ce! * ctlU!) / (ctlE! * cu!),
  "rel-risk": ([e1, n1, e2, n2]) => e1! / n1! / (e2! / n2!),
  lr: ([se, sp], s) => (/positive/.test(s) ? se! / (100 - sp!) : (100 - se!) / sp!),
  curb: ([urea, , rr, s, d, age], stem) => (/confused/.test(stem) ? 1 : 0) + (urea! > 42 ? 1 : 0) + (rr! >= 30 ? 1 : 0) + (s! < 90 || d! <= 60 ? 1 : 0) + (age! >= 65 ? 1 : 0),
  "meld-na": ([cr, b, inr, na]) => {
    const m = Math.round(10 * (0.957 * Math.log(Math.min(4, Math.max(1, cr!))) + 0.378 * Math.log(Math.max(1, b!)) + 1.12 * Math.log(Math.max(1, inr!)) + 0.643));
    const d = 137 - Math.min(137, Math.max(125, na!));
    return Math.min(40, Math.max(6, Math.round(m > 11 ? m + 1.32 * d - 0.033 * m * d : m)));
  },
  "child-pugh": ([bi, alb, inr], s) => (bi! < 2 ? 1 : bi! <= 3 ? 2 : 3) + (alb! > 3.5 ? 1 : alb! >= 2.8 ? 2 : 3) + (inr! < 1.7 ? 1 : inr! <= 2.3 ? 2 : 3) + (/no ascites/.test(s) ? 1 : /mild ascites/.test(s) ? 2 : 3) + (/no encephalopathy/.test(s) ? 1 : /grade II enc/.test(s) ? 2 : 3),
  bisap: ([age, bun, , gcs, t, hr, rr, wbc], s) => (bun! > 25 ? 1 : 0) + (gcs! < 15 ? 1 : 0) + ((t! > 38 || t! < 36 ? 1 : 0) + (hr! > 90 ? 1 : 0) + (rr! > 20 ? 1 : 0) + (wbc! > 12 || wbc! < 4 ? 1 : 0) >= 2 ? 1 : 0) + (age! > 60 ? 1 : 0) + (/a pleural effusion/.test(s) ? 1 : 0),
  gcs: (_, s) => (/open spontaneously/.test(s) ? 4 : /open to voice/.test(s) ? 3 : /open to pain/.test(s) ? 2 : 1) + (/speech is oriented/.test(s) ? 5 : /speech is confused/.test(s) ? 4 : /inappropriate/.test(s) ? 3 : /incomprehensible/.test(s) ? 2 : 1) + (/obeys/.test(s) ? 6 : /localises/.test(s) ? 5 : /withdraws/.test(s) ? 4 : /flexes/.test(s) ? 3 : /extends/.test(s) ? 2 : 1),
  "wells-pe": ([hr], s) => (/swollen/.test(s) ? 3 : 0) + (/PE is the likeliest/.test(s) ? 3 : 0) + (hr! > 100 ? 1.5 : 0) + (/knee surgery/.test(s) ? 1.5 : 0) + (/past DVT/.test(s) ? 1.5 : 0) + (/, haemoptysis/.test(s) ? 1 : 0) + (/cancer on/.test(s) ? 1 : 0),
};

/** How far a shown answer may sit from the exact value, where options are held to a measurable step. */
const TOLERANCE: Record<string, number> = { winters: 0.25, "k-deficit": 5, hs: 5 };

describe("clinical calculations: the set", () => {
  const made = CALC_IDS();
  it("keeps all the baseline calculators", () => {
    const ids = new Set(made.map((x) => x.id));
    for (const id of baseline.calculations) expect(ids, id).toContain(id);
  });
  it("has at least 40, in 5 categories of 8 to 35, each in exactly one", () => {
    expect(CALCULATION_COUNT).toBeGreaterThanOrEqual(40);
    expect(new Set(made.map((x) => x.id)).size).toBe(made.length);
    expect(CALC_CATS).toHaveLength(5);
    for (const [cat] of CALC_CATS) {
      const n = made.filter((x) => x.cat === cat).length;
      expect(n, cat).toBeGreaterThanOrEqual(8);
      expect(n, cat).toBeLessThanOrEqual(35);
    }
    expect(made.filter((x) => x.cat === "Other")).toEqual([]);
    expect(CALC_CATEGORY_IDS.flatMap(([, ids]) => ids).length).toBe(made.length);
  });
  it("puts each calculator where it clinically belongs", () => {
    const at = (id: string) => catOf(CALC_CATS, id);
    expect(at("ca")).toBe("Kidney, Acid-Base & Salts");
    expect(at("na")).toBe("Kidney, Acid-Base & Salts");
    expect(at("ag")).toBe("Kidney, Acid-Base & Salts");
    expect(at("maint")).toBe("Fluids, Burns & Dosing");
    expect(at("hs")).toBe("Fluids, Burns & Dosing");
    expect(at("shock-index")).toBe("Heart, Lungs & ICU");
    expect(at("gcs")).toBe("Brain, Liver & GI");
    expect(at("bmi")).toBe("Biostatistics, OB & Body Indices");
  });
  it("serves 8 fresh questions, at both levels, from any category and from all", () => {
    for (const level of ["basic", "full"] as const) {
      expect(calculationQuestions(level)).toHaveLength(8);
      for (const [cat] of CALC_CATS) {
        const qs = calculationQuestions(level, null, cat);
        expect(qs.length, cat).toBe(8);
        for (const q of qs) expect(catOf(CALC_CATS, q.id), q.id).toBe(cat);
        if (level === "basic") for (const q of qs) expect(ADVANCED_CALCS, q.id).not.toContain(q.id);
      }
    }
  });
  it("reaches every calculator of a category across repeated sets", () => {
    for (const [cat, ids] of CALC_CATEGORY_IDS) {
      const seen = new Set<string>();
      for (let i = 0; i < 40; i++) for (const q of calculationQuestions("full", null, cat)) seen.add(q.id.replace(/^calc-/, ""));
      expect([...seen].sort(), cat).toEqual([...ids].sort());
    }
  });
});

describe("clinical calculations: every question", () => {
  for (const make of CALC_BANK) {
    const id = make().id;
    it(id, () => {
      let extreme = 0;
      let named = 0;
      const stems = new Set<string>();
      for (let run = 0; run < RUNS; run++) {
        const q = make();
        stems.add(q.stem);
        const where = `${id}: ${q.stem} → ${q.options.join(" | ")}`;
        expect(q.options, where).toHaveLength(4);
        expect(new Set(q.options).size, where).toBe(4);
        expect(q.answer, where).toBeGreaterThanOrEqual(0);
        expect(q.answer, where).toBeLessThan(4);
        expect(q.source.length, where).toBeGreaterThan(3);
        expect(q.whyNot, where).toHaveLength(4);
        q.whyNot!.forEach((why, i) => (i === q.answer ? expect(why, where).toBe("") : expect(why.length, where).toBeGreaterThan(5)));
        if (q.whyNot!.some((w) => w && !w.startsWith("A slip"))) named++;
        expect(q.explain, where).not.toMatch(/NaN|Infinity|undefined/);
        expect(q.stem, where).not.toMatch(/NaN|Infinity|undefined/);
        expect(q.stem, where).not.toMatch(/\b[Aa] (8|11|18|8\d)[ -]/);

        const right = q.options[q.answer]!;
        if (id === "naegele") {
          for (const o of q.options) expect(o, where).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
          const days = q.options.map(isoDay);
          expect(Math.max(...days) - Math.min(...days), where).toBeLessThanOrEqual(70);
          const [lmp] = q.stem.match(/\d{1,2} [A-Z][a-z]{2} \d{4}/)!;
          const d = new Date(Date.parse(`${lmp} UTC`));
          const cycle = Number(q.stem.match(/(\d+)-day/)![1]);
          const expected = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 9, d.getUTCDate()) / 86_400_000 + 7 + cycle - 28;
          expect(isoDay(right), where).toBe(expected);
        } else if (id === "gest-age") {
          for (const o of q.options) expect(o, where).toMatch(/^\d+ weeks \d days?$/);
          const [lmp, visit] = q.stem.match(/\d{1,2} [A-Z][a-z]{2} \d{4}/g)!;
          const diff = isoDay(visit!) - isoDay(lmp!);
          expect(right, where).toBe(`${Math.floor(diff / 7)} weeks ${diff % 7} ${diff % 7 === 1 ? "day" : "days"}`);
        } else {
          const vals = q.options.map(value);
          for (const v of vals) {
            expect(Number.isFinite(v), where).toBe(true);
            expect(v, where).toBeGreaterThanOrEqual(0);
          }
          // One format: same decimals, same unit — the answer can't stand out by how it looks.
          const decimals = q.options.map((o) => (o.match(/^\d+\.(\d+)/)?.[1] ?? "").length);
          expect(new Set(decimals).size, where).toBe(1);
          const units = q.options.map((o) => o.replace(/^[\d.]+/, ""));
          expect(new Set(units).size, where).toBe(1);
          // Close together. Scores have their own scale: options are simply kept on it.
          if (!NON_RATIO_CALCS.has(id)) {
            expect(Math.min(...vals), where).toBeGreaterThan(0);
            expect(Math.max(...vals) / Math.min(...vals), where).toBeLessThanOrEqual(3);
            const v = vals[q.answer]!;
            if (v === Math.max(...vals) || v === Math.min(...vals)) extreme++;
          }
          const redo = recompute[id];
          expect(redo, `no independent check for ${id}`).toBeDefined();
          const exact = redo!(nums(q.stem), q.stem);
          const dp = decimals[0]!;
          const tol = TOLERANCE[id] ?? 0.5 * 10 ** -dp + 1e-9;
          expect(Math.abs(vals[q.answer]! - exact), where).toBeLessThanOrEqual(tol);
        }
        // The worked answer must show the same number the option does.
        const shown = right.replace(/ (mmol\/L|mmHg|mg\/dL|mL\/min|mL\/day|mL\/h|mOsm\/kg|mcg\/mL|g\/dL|breaths\/min\/L|kg\/m²|mmol|mL|mg|ms|m²|J|L)$/, "").replace(/%$/, "");
        expect(q.explain, where).toContain(shown);
      }
      // Fresh numbers each time (the few fixed-range sums still vary).
      expect(stems.size, id).toBeGreaterThan(10);
      // The answer can't be spotted by always being the largest or the smallest.
      if (!NON_RATIO_CALCS.has(id) && id !== "gest-age" && id !== "naegele") expect(extreme / RUNS, `${id} answer is an extreme`).toBeLessThan(0.85);
      // Most sets carry at least one wrong answer that names its mistake.
      expect(named / RUNS, `${id} named errors`).toBeGreaterThan(0.5);
    });
  }
});

describe("clinical calculations: worked examples", () => {
  const close = (a: number, b: number, tol = 0.01) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
  it("kidney, acid-base and salts", () => {
    expect(F.anionGap(140, 100, 24)).toBe(16);
    expect(F.deltaRatio(24, 12)).toBe(1);
    expect(F.wintersPaCO2(12)).toBe(26);
    close(F.correctedNa(130, 500), 136.4);
    close(F.freeWaterDeficit(70, F.tbwFraction(false, false), 160), 6);
    expect(F.tbwFraction(true, true)).toBe(0.45);
    close(F.fena(40, 2, 140, 40), 1.4286);
    close(F.cockcroftGault(60, 72, 1, false), 80);
    close(F.cockcroftGault(60, 72, 1, true), 68);
    close(F.osmolality(140, 180, 30), 295);
    close(F.osmolarGap(315, 140, 180, 30), 20);
    close(F.potassiumDeficit(3), 300);
    close(F.correctedCa(8, 2), 9.6);
  });
  it("fluids, burns and dosing", () => {
    expect(F.parklandTotal(70, 30)).toBe(8400);
    expect(F.hollidayDaily(25)).toBe(1600);
    expect(F.hollidayDaily(8)).toBe(800);
    expect(F.hollidayHourly(25)).toBe(65);
    expect(F.hollidayHourly(15)).toBe(50);
    close(F.ganzoni(60, 8), 1508);
    expect(F.allowableBloodLoss(5000, 40, 25)).toBe(1875);
    close(F.dripRate(0.1, 70, 80), 5.25);
  });
  it("heart, lungs and ICU", () => {
    close(F.meanArterial(120, 80), 93.33);
    close(F.aaGradient(0.21, 40, 90), 9.73);
    close(F.pfRatio(80, 0.4), 200);
    close(F.qtcBazett(400, 60), 400);
    close(F.qtcBazett(400, 100), 516.4, 0.1);
    close(F.predictedBodyWeight(170, false), 66.02);
    close(F.predictedBodyWeight(160, true), 52.42);
    expect(F.rsbi(30, 300)).toBeCloseTo(100);
    expect(F.wellsPE({ dvtSigns: true, peLikeliest: true, hrOver100: true, immobileOrSurgery: true, priorVte: true, haemoptysis: true, malignancy: true })).toBe(12.5);
    expect(F.curb65(true, 50, 32, 85, 55, 70)).toBe(5);
    expect(F.curb65(false, 30, 20, 130, 80, 50)).toBe(0);
    expect(F.curb65(false, 42, 29, 120, 60, 64)).toBe(1);
    close(F.shockIndex(120, 100), 1.2);
  });
  it("brain, liver and GI", () => {
    close(F.maddrey(25, 12, 10), 69.8);
    close(F.saag(3, 1.5), 1.5);
    expect(F.childPugh(3.5, 2.5, 1.5, 2, 1)).toBe(10);
    expect(F.childPugh(1, 4, 1, 1, 1)).toBe(5);
    expect(F.childPugh(4, 2, 3, 3, 3)).toBe(15);
    // Hand-worked: 10 × (0.957 ln 2 + 0.378 ln 4 + 1.12 ln 2 + 0.643) = 26; 26 + 1.32 × 12 − 0.033 × 26 × 12 = 31.54.
    expect(F.meldI(2, 4, 2)).toBe(26);
    expect(F.meldNa(2, 4, 2, 125)).toBe(32);
    expect(F.meldNa(2, 4, 2, 115)).toBe(32); // sodium floored at 125
    expect(F.meldNa(2, 4, 2, 140)).toBe(26); // sodium capped at 137
    expect(F.meldNa(1, 1, 1, 125)).toBe(6); // MELD(i) of 11 or less: no sodium term
    close(F.correctedPhenytoin(8, 2), 16);
    expect(F.bisap(30, 14, 2, 65, true)).toBe(5);
    expect(F.bisap(25, 15, 1, 60, false)).toBe(0);
    close(F.cerebralPerfusion(90, 20), 70);
  });
  it("biostatistics, OB and body indices", () => {
    close(F.bmi(70, 175), 22.86);
    close(F.bsaMosteller(170, 70), 1.818, 0.001);
    close(F.sensitivity(90, 10), 90);
    close(F.specificity(80, 20), 80);
    close(F.ppv(90, 10), 90);
    close(F.npv(80, 20), 80);
    expect(F.nnt(20, 10)).toBe(10);
    expect(F.nnt(20, 12)).toBe(13);
    close(F.oddsRatio(30, 20, 70, 80), 1.714);
    close(F.relativeRisk(30, 100, 10, 100), 3);
    close(F.lrPositive(90, 80), 4.5);
    close(F.lrNegative(90, 80), 0.125);
    expect(F.dateText(F.naegele(2027, 0, 1))).toBe("8 Oct 2027");
    expect(F.dateText(F.naegele(2026, 5, 20))).toBe("27 Mar 2027");
    expect(F.dateText(F.naegele(2027, 0, 1, 32))).toBe("12 Oct 2027");
    expect(F.weeksDays(168)).toBe("24 weeks 0 days");
    expect(F.weeksDays(169)).toBe("24 weeks 1 day");
  });
});
