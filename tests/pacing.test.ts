/** 1–10 minute cases: bundles with no model, routine orders with no stops, complete panels, trends, a closure cue, a useful debrief. */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ALL_CASES } from "@/engine/cases";
import { generateDebrief } from "@/engine/debrief";
import { parseOrderDetails } from "@/engine/formulary";
import { bundleOf, createHiddenState, runTurn } from "@/engine/simulator";
import { withoutSounds } from "@/engine/auscultation";
import { diagnosisIn } from "@/engine/intent";
import { followLabs, fromVitals, withTrend } from "@/engine/lab-model";

import { converse } from "./helpers";

const C = (prefix: string) => ALL_CASES.find((c) => c.id.startsWith(prefix))!;
const said = (state: { messages: readonly { text: string }[] }) => state.messages.map((m) => m.text).join("\n");
const rowsOf = (state: { investigations: readonly { name: string; rows?: readonly { analyte: string }[] }[] }, id: string) =>
  (state.investigations.find((i) => i.name.toLowerCase() === id)?.rows ?? []).map((r) => r.analyte);

describe("bundles", () => {
  it.each([
    ["hpi", "hpi"], ["brief history", "hpi"], ["presenting complaint", "hpi"],
    ["pmh and meds", "pmh"], ["sample history", "pmh"],
    ["abcde", "abcde"], ["primary survey", "abcde"],
    ["general and systemic exam", "exam"], ["full exam", "exam"],
  ])("%s is the %s bundle", (raw, bundle) => expect(bundleOf(raw)).toBe(bundle));

  it("answers the bundles in one turn each", async () => {
    const { state, hidden } = await converse(C("em-adhf"), ["hpi", "pmh and meds", "abcde", "general and systemic exam"]);
    expect(hidden.actionCount).toBe(4);
    expect(said(state)).toMatch(/Primary survey/);
    expect(said(state)).toMatch(/stent/);
  });
});

describe("spoken shorthand", () => {
  it.each([["review in about 8 weeks", "8 weeks"], ["follow up after ~6 weeks", "6 weeks"], ["come back in around 2 months", "2 months"], ["review after 10 days", "10 days"]])("%s books %s", async (order, when) => {
    const { state } = await converse(C("derm-acne"), [order]);
    expect(said(state)).toContain(`Follow-up booked in ${when}`);
  });

  it.each([["monitor temperature", /Temp/], ["temp chart", /Temp/], ["hourly temp", /Temp/], ["monitor urine output", /Urine output/], ["uop chart", /Urine output/], ["input output chart", /Urine output/], ["monitor spo2", /SpO₂/], ["pulse ox", /SpO₂/]])("%s reads that chart", async (order, shown) => {
    const { state } = await converse(C("surg-cholecystitis"), [order]);
    expect(said(state)).toMatch(shown);
  });

  it("answers a question in several parts in one reply", async () => {
    const { state } = await converse(C("surg-cholecystitis"), ["Where is the pain, does it radiate, and when did it start?", "Any diabetes, hypertension, or asthma?"]);
    expect(said(state)).toMatch(/shoulder blade/);
    expect(said(state)).toMatch(/No sugar, BP or asthma/);
  });
});

describe("routine panels are complete", () => {
  it("in a case that wrote only some of the rows", async () => {
    const { state } = await converse(C("em-adhf"), ["cbc", "rft", "lft", "abg"]);
    for (const name of ["Haemoglobin", "Total leucocyte count", "Platelets", "MCV"]) expect(rowsOf(state, "cbc")).toContain(name);
    for (const name of ["Sodium", "Potassium", "Chloride", "Bicarbonate", "Urea", "Creatinine", "Glucose"]) expect(rowsOf(state, "rft")).toContain(name);
    expect(rowsOf(state, "lft").join()).toMatch(/ALT.*|AST.*/);
    for (const name of ["Alkaline phosphatase", "Total bilirubin", "Albumin"]) expect(rowsOf(state, "lft")).toContain(name);
    for (const name of ["pH", "pCO₂", "pO₂", "HCO₃⁻", "Lactate", "SaO₂"]) expect(rowsOf(state, "abg")).toContain(name);
  });

  it("a repeat says what each value was", () => {
    const [row] = withTrend([{ analyte: "pH", value: "7.38", reference: "7.35–7.45", flag: "normal" }], [{ analyte: "pH", value: "7.28", reference: "7.35–7.45", flag: "low" }]);
    expect(row).toMatchObject({ was: "7.28", trend: "up" });
  });
});

describe("no stops for routine orders", () => {
  it("a routine drug goes straight in, a potent one still asks", async () => {
    const plain = await converse(C("surg-cholecystitis"), ["give paracetamol"]);
    expect(plain.state.messages.at(-1)?.role).not.toBe("nurse");
    const potent = await converse(C("surg-cholecystitis"), ["give morphine"]);
    expect(said(potent.state)).toMatch(/dose|how much/i);
  });
});

describe("the new cases", () => {
  it("keeps India's first-line malaria drug: artesunate + SP counts as an ACT", async () => {
    const def = C("id-malaria");
    const { hidden } = await converse(def, ["act sp 200 mg od for 3 days"]);
    expect(hidden.actions["act"]?.length).toBeGreaterThan(0);
  });

  it("magnesium alone doesn't lower the pressure, and the case isn't called done while it stays severe", async () => {
    const { state, hidden } = await converse(C("obg-preeclampsia"), ["magnesium sulphate 4 g iv over 20 min"]);
    expect(hidden.vitals.bp.value).toMatch(/^17\d\//);
    expect(said(state)).not.toMatch(/Give your final diagnosis/);
  });

  it("an answer already given in a bundle isn't repeated word for word", async () => {
    const { state } = await converse(C("id-malaria"), ["hpi", "any confusion or vomiting?"]);
    const last = state.messages.at(-1)!;
    expect(last.text).toMatch(/^(As I told you|Like I said|I'll say it again|Same answer|Yes, as before)/);
  });

  it("rechecking the vitals after treating counts as reassessing", async () => {
    const def = C("surg-cholecystitis");
    const { state, hidden } = await converse(def, ["ceftriaxone 1 g iv", "wait 30 min", "check vitals"]);
    expect(hidden.reassessments.length).toBeGreaterThan(0);
    expect(state.messages.length).toBeGreaterThan(0);
  });
});

describe("running rates and repeat labs", () => {
  it("a usual GTN rate goes in; a huge one is questioned", async () => {
    const usual = await converse(C("em-adhf"), ["gtn 10 mcg/min iv"]);
    expect(said(usual.state)).toContain("Glyceryl trinitrate 10 mcg/min IV");
    const huge = await converse(C("em-adhf"), ["gtn 1000 mcg/min iv"]);
    expect(said(huge.state)).toMatch(/Do you still want it given/);
  });

  it("after a response, a repeat ABG shows what moved, and oxygen gained stays gained", async () => {
    const { state, hidden } = await converse(C("em-adhf"), ["oxygen 15 l via nrbm", "abg", "furosemide 80 mg iv", "wait 4 hours", "repeat abg"]);
    const abgs = state.investigations.filter((i) => i.name === "ABG");
    const lactate = abgs.at(-1)!.rows!.find((r) => r.analyte === "Lactate")!;
    expect(lactate).toMatchObject({ was: "2.4", trend: "down" });
    expect(parseFloat(hidden.vitals.spo2.value)).toBeGreaterThanOrEqual(97);
    expect(said(state)).toMatch(/ABG, repeat 1 — result available/);
  });
});

describe("how often, however it's written", () => {
  it.each([
    ["bd", "BD"], ["twice daily", "BD"], ["twice a day", "BD"], ["2 times daily", "BD"], ["two times a day", "BD"], ["every 12 hours", "BD"], ["q12h", "BD"], ["1-0-1", "BD"],
    ["tds", "TDS"], ["thrice daily", "TDS"], ["three times daily", "TDS"], ["3 times a day", "TDS"], ["every 8 hours", "TDS"], ["q8h", "TDS"],
    ["qid", "QID"], ["four times daily", "QID"], ["4 times a day", "QID"], ["every 6 hours", "QID"], ["q6h", "QID"],
    ["od", "OD"], ["once daily", "OD"], ["daily", "OD"], ["once a day", "OD"], ["every day", "OD"],
  ])("amoxicillin 500 mg %s is %s", (written, frequency) => {
    expect(parseOrderDetails(`amoxicillin 500 mg ${written}`, { weightKg: 60 }).frequency).toBe(frequency);
  });

  it("each drug in a list keeps its frequency", async () => {
    const { state } = await converse(C("gi-ulcer"), ["omeprazole 20 mg orally twice daily, amoxicillin 1 g orally twice daily, and clarithromycin 500 mg orally twice daily for 14 days"]);
    expect(said(state)).toContain("Amoxicillin · 1 g · oral · twice daily");
    expect(said(state)).toContain("Clarithromycin · 500 mg · oral · twice daily · 14 days");
  });
});

describe("combined bundles and the last audit bugs", () => {
  it.each(["hpi and pmh and meds", "brief history and sample history", "full history", "complete history", "hpi, pmh"])("%s takes the whole history in one turn", async (order) => {
    const def = C("em-adhf");
    const { hidden } = await converse(def, [order]);
    expect(hidden.actionCount).toBe(1);
    for (const h of def.history.filter((x) => x.importance === "essential")) expect(hidden.history[h.id], h.id).toBeDefined();
  });

  it("leaves a sentence that merely mentions a bundle alone", () => {
    expect(bundleOf("hpi of the patient's mother please")).toBeNull();
  });

  it("records a diagnosis inside a long closing order, and no question as one", async () => {
    const { hidden } = await converse(C("surg-cholecystitis"), ["Final diagnosis is acute cholecystitis with sepsis; admit to surgical ward, keep NPO, start IV fluids and ceftriaxone + metronidazole"]);
    expect(hidden.diagnosis?.text).toBe("acute cholecystitis with sepsis");
    expect(hidden.discharged).toBeFalsy();
    expect(diagnosisIn("senior, what is the diagnosis")).toBeUndefined();
    expect(diagnosisIn("Dx gastric ulcer with positive H. pylori stool antigen. Start eradication therapy.")).toBe("gastric ulcer with positive H. pylori stool antigen");
  });

  it("drops what's left of a sentence that lost its subject", () => {
    expect(withoutSounds("Pulse 80. Heart sounds normal. And regular.", "heart")).not.toMatch(/And regular/);
  });

  it("no new prescription after they've gone home; on the way out, or at a review, is fine", async () => {
    const after = await converse(C("id-malaria"), ["discharge", "paracetamol 650 mg sos"]);
    expect(after.hidden.drugs.length).toBe(0);
    const same = await converse(C("id-malaria"), ["paracetamol 650 mg sos, discharge"]);
    expect(same.hidden.drugs.length).toBe(1);
  });

  it("the bedside history isn't a delay while the patient holds, but past the window it is", async () => {
    const def = C("em-adhf");
    const held = { ...def, rubric: { ...def.rubric, definitiveTreatment: { ...def.rubric.definitiveTreatment!, byMinute: 1 } } };
    const { state, hidden } = await converse(held, ["hpi", "pmh and meds", "abcde", "furosemide 80 mg iv"]);
    expect(generateDebrief(held, hidden, state).score.penalties.some((p) => p.label === "Delayed treatment")).toBe(true);
  });
});

describe("a fluid rate said out loud", () => {
  it("stays the rate, even when the model reads 'no bolus' as a bolus", () => {
    const def = C("surg-cholecystitis");
    const hidden = createHiddenState(def);
    const raw = "Continue 0.9% saline at 100 mL/hour; avoid another bolus";
    const fx = runTurn(def, hidden, { id: "a1", at: 0, raw, intents: [{ kind: "drug", targetId: "ns", phrase: raw, matched: true, payload: { mode: "given", rapid: true, overMin: 5, volumeMl: 500 } }] });
    expect(fx.map((e) => (e.type === "message" ? e.text : "")).join(" ")).toContain("at 100 mL/h");
  });
});

describe("the five new cases, against the guidelines", () => {
  it("malaria: artesunate + SP, artemether-lumefantrine and primaquine all count", async () => {
    for (const act of ["act sp 200 mg od for 3 days", "artemether lumefantrine 80/480 mg bd for 3 days"]) {
      const { hidden } = await converse(C("id-malaria"), [act, "primaquine 45 mg stat"]);
      expect(hidden.actions["act"]?.length).toBeGreaterThan(0);
      expect(hidden.actions["primaquine-rule"]?.length).toBeGreaterThan(0);
    }
  });

  it("pre-eclampsia: both magnesium regimens and all three antihypertensives count; toxicity watch is recognised", async () => {
    for (const mg of ["magnesium sulphate 4 g iv over 20 min", "magnesium sulphate 4 g iv over 20 min then 1 g/hr"]) {
      const { hidden } = await converse(C("obg-preeclampsia"), [mg]);
      expect(hidden.actions["magnesium"]?.length, mg).toBeGreaterThan(0);
    }
    for (const bp of ["labetalol 20 mg iv", "nifedipine 10 mg po", "hydralazine 5 mg iv"]) {
      const { hidden } = await converse(C("obg-preeclampsia"), [bp]);
      expect(hidden.actions["antihypertensive"]?.length, bp).toBeGreaterThan(0);
    }
    const { hidden } = await converse(C("obg-preeclampsia"), ["check reflexes and keep calcium gluconate ready"]);
    expect(hidden.actions["mg-watch"]?.length).toBeGreaterThan(0);
  });

  it("hypertension: a CCB, ARB, ACE inhibitor or thiazide each count as first line", async () => {
    for (const drug of ["amlodipine 5 mg od", "telmisartan 40 mg od", "enalapril 5 mg od", "chlorthalidone 12.5 mg od"]) {
      const def = C("gp-hypertension");
      const { hidden } = await converse(def, [drug]);
      const first = hidden.drugs[0]!;
      expect(first.appropriateness, drug).toBe("ideal");
    }
  });
});

describe("labs that follow treatment", () => {
  it("a written glucose moves with the sugar", () => {
    const row = { analyte: "Glucose", value: "400", reference: "70–140", flag: "high" as const };
    const [out] = fromVitals([row], new Map([["glucose", 1]]), "300", undefined, "400");
    expect(out!.value).toBe("300");
  });

  it("creatinine and urea mend after fluids; white cells and CRP fall on an antibiotic", () => {
    const rows = [
      { analyte: "Creatinine", value: "2.0", reference: "0.7–1.3", flag: "high" as const },
      { analyte: "Urea", value: "90", reference: "15–40", flag: "high" as const },
      { analyte: "Total leucocyte count", value: "18000", reference: "4000–11000", flag: "high" as const },
      { analyte: "CRP", value: "120", reference: "< 6", flag: "high" as const },
    ];
    const out = followLabs(rows, { weightKg: 60, age: 40, sex: "Male", fluids: [], redCellUnits: 0, co2Retained: 0, recoveryHours: 24, rehydratedHours: 24, antibioticHours: 48 } as never);
    const v = (n: string) => parseFloat(out.find((r) => r.analyte === n)!.value);
    expect(v("Creatinine")).toBeLessThan(2);
    expect(v("Urea")).toBeLessThan(90);
    expect(v("Total leucocyte count")).toBeLessThan(18000);
    expect(v("CRP")).toBeLessThan(120);
  });
});

describe("the debrief", () => {
  it("gives time to treatment and tests that changed nothing", async () => {
    const def = C("surg-cholecystitis");
    const { state, hidden } = await converse(def, ["plain ct abdomen", "ceftriaxone 1 g iv", "dx acute cholecystitis. admit"]);
    const d = generateDebrief(def, hidden, state);
    expect(d.timeToTreatment?.label).toBe("IV antibiotic");
    expect(d.unneededTests?.names.join()).toMatch(/CT/);
  });
});
