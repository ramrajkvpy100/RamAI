/** The second batch of pre-launch fixes: spoken durations, chart orders, joined answers, complete panels, live-invention limits, and written cases for every specialty. */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ALL_SPECIALTIES } from "@/engine/progression";
import { CASE_LIBRARY, getCase } from "@/engine/cases";
import { statedReviewDays } from "@/engine/intent";
import { toHinglish } from "@/engine/i18n/hinglish";

import { converse } from "./helpers";

const acne = () => getCase("derm-acne-moderate-01")!;
const er = () => getCase("em-adhf-01")!;
const text = (s: { messages: readonly { text: string }[] }) => s.messages.map((m) => m.text).join(" ");

describe("the time a review is booked for", () => {
  it.each([
    ["review in about 8 weeks", 56], ["We'll review in about 8 weeks, sooner if you develop severe irritation", 56], ["follow up after 6 weeks", 42],
    ["come back in 2 months", 60], ["review in 10 days", 10], ["see you around 4 weeks later", 28], ["It takes 6-8 weeks. We'll review in about 8 weeks", 56],
    ["refer to neurology, review response and side effects in 4–6 weeks, and advise exercise", 42], ["review and continue amoxicillin for 5 days", null], ["she will return to work in 2 weeks", null],
  ])("%s", (line, days) => expect(statedReviewDays(line)).toBe(days));

  it("eight weeks really pass, in minutes, however the sentence reads", async () => {
    const { hidden, state } = await converse(acne(), ["It's too soon yet; acne takes 6-8 weeks. We'll review in about 8 weeks, sooner if you develop severe irritation"]);
    expect(text(state)).toMatch(/8 weeks/);
    expect(hidden.clock).toBeGreaterThanOrEqual(80_640);
    expect(hidden.clock).toBeLessThan(80_640 + 60);
  });
});

describe("chart orders are not the cardiac monitor", () => {
  it.each(["monitor temperature", "temp chart", "4-hourly temperature charting", "monitor urine output", "strict input output chart", "monitor temperature and urine output"])("%s", async (line) => {
    const { hidden, state } = await converse(acne(), [line]);
    expect(hidden.monitored).toBeFalsy();
    expect(text(state)).not.toMatch(/Multipara/);
    expect(text(state)).toMatch(/Temp|Urine/i);
  });

  it("a model reading it as monitoring gets the chart too", async () => {
    const { runTurn, createHiddenState } = await import("@/engine/simulator");
    const hidden = createHiddenState(acne());
    const fx = runTurn(acne(), hidden, { id: "a", at: 0, raw: "monitor temperature", intents: [{ kind: "action", targetId: "measure:monitor", phrase: "monitor temperature", matched: true }] });
    expect(hidden.monitored).toBeFalsy();
    expect(JSON.stringify(fx)).toMatch(/Temp/);
  });

  it("monitoring how the patient does isn't a machine", async () => {
    const { runTurn, createHiddenState } = await import("@/engine/simulator");
    const hidden = createHiddenState(acne());
    runTurn(acne(), hidden, { id: "a", at: 0, raw: "we can start and monitor your response", intents: [{ kind: "action", targetId: "measure:monitor", phrase: "we can start and monitor your response", matched: true }] });
    expect(hidden.monitored).toBeFalsy();
  });

  it("the real monitor still attaches", async () => {
    expect((await converse(acne(), ["cardiac monitor"])).hidden.monitored).toBe(true);
    expect((await converse(acne(), ["put on monitor"])).hidden.monitored).toBe(true);
  });
});

describe("several questions, one answer", () => {
  it("joins the same person's replies", async () => {
    const { state } = await converse(er(), ["Since when did this breathlessness start and does lying flat make it worse?"]);
    const said = state.messages.filter((m) => m.role === "attendant" && m.kind === "speech").at(-1)!;
    expect(said.text).toMatch(/Three days/);
    expect(said.text).toMatch(/three pillows/);
  });

  it("Hinglish translates a joined reply line by line", () => {
    const def = getCase("uro-colic-district-01")!;
    const joined = "No fever or shivering. My father had a kidney stone removed.";
    const out = toHinglish(joined, def.id, "patient", def.patient);
    expect(out).toMatch(/Na bukhar/);
    expect(out).toMatch(/pathri/);
    expect(out).not.toMatch(/shivering/);
  });
});

describe("routine panels are complete, and worked out", () => {
  const rows = async (def = er(), order = "cbc") => (await converse(def, [order])).state.investigations.at(-1)!.rows ?? [];

  it("CBC has MCV and platelets, RFT has chloride, with what the case wrote kept", async () => {
    const cbc = (await rows(er(), "cbc")).map((r) => r.analyte).join(" ");
    expect(cbc).toMatch(/MCV/);
    expect(cbc).toMatch(/Platelet/);
    const rft = (await rows(er(), "rft")).map((r) => r.analyte).join(" ");
    expect(rft).toMatch(/Chloride/);
    expect(rft).toMatch(/Creatinine/);
  });

  it("MCV fits the anaemia, haematocrit fits the haemoglobin, chloride fits the sodium", async () => {
    const { alignedPanel } = await import("@/engine/lab-model");
    const base = [{ analyte: "MCV", value: "88", unit: "fL", reference: "80–100", flag: "normal" as const }, { analyte: "Haematocrit", value: "40", unit: "%", reference: "36–46", flag: "normal" as const }, { analyte: "Chloride", value: "102", unit: "mEq/L", reference: "98–107", flag: "normal" as const }];
    const hb = [{ analyte: "Haemoglobin", value: "8.0", unit: "g/dL", reference: "12–15", flag: "low" as const }];
    const out = alignedPanel(base, hb, "Iron deficiency anaemia");
    expect(out[0]).toMatchObject({ value: "70", flag: "low" });
    expect(out[1]).toMatchObject({ value: "24", flag: "low" });
    expect(alignedPanel(base, hb, "Vitamin B12 deficiency")[0]).toMatchObject({ value: "106", flag: "high" });
    const chem = [{ analyte: "Sodium", value: "150", unit: "mEq/L", reference: "135–145", flag: "high" as const }, { analyte: "Bicarbonate", value: "24", unit: "mEq/L", reference: "22–26", flag: "normal" as const }];
    expect(alignedPanel(base, chem, "x")[2]).toMatchObject({ value: "114", flag: "high" });
  });

  it("no model is needed for a panel the case lists", async () => {
    const { labGap, createHiddenState } = await import("@/engine/simulator");
    expect(labGap(er(), createHiddenState(er()), "cbc", "cbc")).toBeNull();
    expect(labGap(er(), createHiddenState(er()), "rft", "rft")).toBeNull();
  });
});

describe("a written case for every specialty", () => {
  it.each([...ALL_SPECIALTIES])("%s", (specialty) => {
    expect(CASE_LIBRARY.filter((c) => c.specialty === specialty).length).toBeGreaterThan(0);
  });

  it("all can be played on the free plan's levels, with a sensible doctor reaching recovery", async () => {
    const games: [string, string[], RegExp][] = [
      ["card-stemi-district-01", ["ecg", "aspirin 325 mg", "clopidogrel 300 mg", "tenecteplase 40 mg iv", "enoxaparin 30 mg iv"], /weight on my chest has lifted/],
      ["resp-asthma-district-01", ["oxygen face mask 6 l/min", "salbutamol 5 mg neb", "hydrocortisone 100 mg iv"], /easier now/],
      ["uro-colic-district-01", ["diclofenac 75 mg im"], /pain has eased/],
    ];
    for (const [id, orders, said] of games) {
      const { state, hidden } = await converse(getCase(id)!, orders);
      expect(text(state)).toMatch(said);
      expect(text(state)).not.toMatch(/Do you still want/);
      expect(["improving", "stable", "recovered"]).toContain(hidden.status);
    }
  });

  it("an untreated emergency gets worse", async () => {
    for (const id of ["card-stemi-district-01", "resp-asthma-district-01"]) {
      const { hidden } = await converse(getCase(id)!, ["wait 60 min", "wait 60 min", "wait 60 min"]);
      expect(["critical", "deceased", "deteriorating"]).toContain(hidden.status);
    }
  });

  it("a plain order isn't mistaken for advice in these cases", async () => {
    const levo = await converse(getCase("endo-hypothyroid-district-01")!, ["levothyroxine 100 mcg od for 8 weeks"]);
    expect(text(levo.state)).not.toMatch(/may be for life/);
    const para = await converse(getCase("ent-aom-phc-01")!, ["paracetamol 300 mg sos for 3 days"]);
    expect(text(para.state)).not.toMatch(/I'll bring him back/);
  });
});
