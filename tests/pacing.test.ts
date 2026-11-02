/** 1–10 minute cases: bundles with no model, routine orders with no stops, complete panels, trends, a closure cue, a useful debrief. */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ALL_CASES } from "@/engine/cases";
import { generateDebrief } from "@/engine/debrief";
import { parseOrderDetails } from "@/engine/formulary";
import { bundleOf } from "@/engine/simulator";
import { withTrend } from "@/engine/lab-model";

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

describe("the debrief", () => {
  it("gives time to treatment and tests that changed nothing", async () => {
    const def = C("surg-cholecystitis");
    const { state, hidden } = await converse(def, ["plain ct abdomen", "ceftriaxone 1 g iv", "dx acute cholecystitis. admit"]);
    const d = generateDebrief(def, hidden, state);
    expect(d.timeToTreatment?.label).toBe("IV antibiotic");
    expect(d.unneededTests?.names.join()).toMatch(/CT/);
  });
});
