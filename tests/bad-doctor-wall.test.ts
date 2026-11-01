/**
 * The bad-doctor wall: every written case played by the worst doctor we can imagine, with no AI. What it checks is what
 * must never happen, whichever case and whatever the order. A new real-world error becomes a new line here.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { alveolarPO2, consistentLabs, expectedPH, oxygenCeiling } from "@/engine/abg-check";
import { ALL_CASES } from "@/engine/cases";
import { defaultVitals, normalVitals, readVitalKeys, ROUTINE_VITALS } from "@/engine/catalog";
import { FORMULARY, parseOrderDetails } from "@/engine/formulary";
import { contraindication, gestationFrom, pregnancyRisk, storyOf, strengthProblem, tabletStrengths } from "@/engine/contraindications";
import { liveClash } from "@/engine/interactions";
import { givesReason, stateOfMind } from "@/engine/behaviour";
import { kineticsFor, profileFor } from "@/engine/pharmacology";
import { lumbarPuncture, runProcedure, tubeProblem } from "@/engine/procedures";
import { ckdEpi, compensated, creatinineClearance, followLabs, LAB_PENDING, pao2ForSaturation, severinghaus, wintersPaCO2 } from "@/engine/lab-model";
import { expectedPH as hh } from "@/engine/abg-check";
import { generateDebrief } from "@/engine/debrief";
import { clauseFor, courseOf, onlyFindings, saidNotTo, stockedSpelling, withoutFindings } from "@/engine/providers/openai";
import { createHiddenState, runTurn } from "@/engine/simulator";
import type { ActionRecord } from "@/engine/types";

import { converse } from "./helpers";

const C = (prefix: string) => ALL_CASES.find((c) => c.id.startsWith(prefix))!;
const said = (state: { messages: readonly { role: string; text: string }[] }) => state.messages.map((m) => `${m.role}: ${m.text}`).join("\n");

const CHAOS = [
  "asdf", "?", "ok", "yes", "no", "hmm", "you are fine go home", "give medicine", "give something strong", "give the usual", "give fluids", "give antibiotics and painkiller",
  "paracetmol 650 tds", "amoxycilin 500 tds x 5 days", "ceftriaxon 1g iv", "diclofenec 75 im", "tab ceftriaxone", "iv tab paracetamol", "inj amoxicillin tablet",
  "amoxicillin 5 g tds", "paracetamol 20 g stat", "ondansetron 80 mg iv", "morphine 50 mg iv", "insulin 100 units iv", "kcl 40 meq iv stat", "ns 5 litre over 10 min", "adrenaline 1 mg iv", "digoxin 25 mg", "atropine 10 mg iv", "phenytoin 1 g iv push", "metoprolol 50 mg iv", "warfarin 50 mg", "isotretinoin 40 mg od", "doxycycline 100 mg bd", "clobetasol on the face bd",
  "order all tests", "mri brain", "pet scan", "ct whole body", "lft rft tft hba1c lipid profile abg", "cbc", "cbc", "abg", "morning cortisol",
  "any vomitng", "h/o fevr", "bukhar kab se hai", "what is the diagnosis", "senior mam what is the diagnosis", "stop all medicines", "discharge the patient", "admit", "refer", "wait 30 min", "wait 2 weeks", "follow up in 1 month", "how is the patient", "repeat vitals",
  "start cpr", "shock", "yes I'm sure",
];

const shuffled = <T,>(xs: T[], seed: number) => {
  const a = [...xs];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

describe("whatever the order, in every case", () => {
  for (const def of ALL_CASES) {
    for (const seed of [3, 11, 29]) {
      it(`${def.id} survives chaos (order ${seed})`, { timeout: 30_000 }, async () => {
        const { state, hidden } = await converse(def, [...shuffled(CHAOS, seed + def.id.length), "dx anxiety. close"]);
        const text = said(state);
        // No broken words.
        expect(text).not.toMatch(/undefined|\bNaN\b|\[object|\bnull\b/);
        // A patient who has died doesn't talk.
        const dead = state.messages.findIndex((m) => /The patient has died/.test(m.text));
        if (dead >= 0) expect(state.messages.slice(dead).some((m) => m.role === "patient" || m.role === "attendant")).toBe(false);
        // Numbers that must agree, in every result shown.
        for (const inv of state.investigations) {
          const rows = inv.rows ?? [];
          const get = (re: RegExp) => Number(rows.find((r) => re.test(r.analyte))?.value);
          const ph = get(/^ph$/i), h = get(/hco3|bicarb/i), p = get(/pa?co2/i);
          if (ph && h && p) expect(Math.abs(expectedPH(h, p) - ph)).toBeLessThanOrEqual(0.035);
        }
        // The case always ends, the wrong diagnosis is never rewarded.
        expect(hidden.closed).toBe(true);
        const debrief = generateDebrief(def, hidden, state);
        expect(debrief.verdict).not.toBe("correct");
        expect(debrief.score.total).toBeLessThanOrEqual(50);
        expect(Number.isFinite(debrief.score.total)).toBe(true);
      });
    }
  }
});

describe("the dangerous orders", () => {
  it("a child's paracetamol overdose: queried, then liver failure unfolds, and NAC in time rescues", async () => {
    const asked = await converse(C("ped-diarrhoea"), ["Paracetamol 5 g PO stat"]);
    expect(said(asked.state)).toMatch(/liver-toxic/);
    const left = await converse(C("ped-diarrhoea"), ["Paracetamol 5 g PO stat", "yes"]);
    expect(left.hidden.hazards.some((h) => h.id === "paracetamol-overdose")).toBe(true);
    expect(said(left.state)).not.toMatch(/feel a little cooler/);
    const saved = await converse(C("ped-diarrhoea"), ["Paracetamol 5 g PO stat", "yes", "N-acetylcysteine 1500 mg IV over 1 hour", "yes"]);
    expect(saved.hidden.hazards.find((h) => h.id === "paracetamol-overdose")?.rescue).toBe("full");
  });

  it("a normal child's dose isn't queried", async () => {
    const { state } = await converse(C("ped-diarrhoea"), ["Paracetamol 150 mg PO stat"]);
    expect(said(state)).not.toMatch(/liver-toxic|times the usual/);
  });

  it("left alone, an adult's overdose reaches the liver a day later, on the tests too", async () => {
    const { hidden, state } = await converse(C("derm-acne"), ["Paracetamol 8 g PO stat", "yes", "wait 24 hours", "wait 24 hours", "lft"]);
    expect(hidden.hazards.some((h) => h.id === "paracetamol-overdose" && h.stageIdx >= 1)).toBe(true);
    expect(state.investigations.find((i) => i.defId === "lft")?.rows?.find((r) => r.analyte === "ALT")?.flag).toBe("critical");
  });

  it("an adult's 8 g is toxic; 1 g isn't", async () => {
    expect(said((await converse(C("surg-appendicitis"), ["Paracetamol 8 g PO stat"])).state)).toMatch(/liver-toxic/);
    expect(said((await converse(C("surg-appendicitis"), ["Paracetamol 1 g PO stat"])).state)).not.toMatch(/liver-toxic/);
  });

  it("a beta-blocker into acute pulmonary oedema: queried, then pump failure", async () => {
    const asked = await converse(C("em-adhf"), ["Metoprolol 5 mg IV stat"]);
    expect(said(asked.state)).toMatch(/failing heart/);
    const { hidden, state } = await converse(C("em-adhf"), ["Metoprolol 5 mg IV stat", "yes", "wait 10 minutes"]);
    expect(hidden.hazards.some((h) => h.id === "negative-inotrope")).toBe(true);
    expect(said(state)).toMatch(/pressure is falling/);
  });

  it("isotretinoin with doxycycline: weeks later, headache and papilloedema", async () => {
    const { state } = await converse(C("derm-acne"), ["Isotretinoin 40 mg OD long term", "Doxycycline 100 mg BD long term", "wait 2 weeks", "fundoscopy"]);
    expect(said(state)).toMatch(/headaches/);
    expect(said(state)).toMatch(/papilloedema/i);
    expect(said(state)).not.toMatch(/small bumps/);
  });

  it("isotretinoin alone isn't called harm: dry lips at follow-up, nothing at 30 minutes", async () => {
    const early = await converse(C("derm-acne"), ["Isotretinoin 40 mg OD long term", "wait 30 minutes"]);
    expect(said(early.state)).not.toMatch(/cracked/);
    const later = await converse(C("derm-acne"), ["Isotretinoin 40 mg OD long term", "follow up in 2 weeks"]);
    expect(said(later.state)).toMatch(/cracked/);
    expect(later.state.patientStatus).not.toBe("guarded");
  });

  it("a super-potent steroid on the face: redness, thinning and telangiectasia weeks later", async () => {
    const { state } = await converse(C("derm-acne"), ["Clobetasol cream on the face BD for 4 weeks", "wait 4 weeks", "examine the skin"]);
    expect(said(state)).toMatch(/burning/);
    expect(said(state)).toMatch(/telangiectasia/i);
  });

  it("'wait 2 weeks' in clinic really is 2 weeks", async () => {
    const { hidden } = await converse(C("derm-acne"), ["wait 2 weeks"]);
    expect(hidden.clock).toBeGreaterThanOrEqual(14 * 1440);
  });

  it("vague orders are asked about, not guessed", async () => {
    for (const order of ["Give antibiotics and painkiller", "Give fluids", "Give something strong"]) {
      const { state, hidden } = await converse(C("derm-acne"), [order]);
      expect(hidden.drugs).toHaveLength(0);
      expect(said(state)).toMatch(/\?/);
    }
  });

  it("tests have no bearing on the wrong organ: MRI brain stays normal, the chest film shows the flood", async () => {
    const { state } = await converse(C("em-adhf"), ["NS 3 L IV over 30 min", "yes", "wait 30 minutes"]);
    expect(said(state)).toMatch(/froth/i);
  });
});

describe("Code Blue", () => {
  const arrest = ["Attach monitor", "Give KCl 40 mEq IV push", "yes", "wait 5 minutes"];

  it("the heart stopping is an arrest, not yet a death, and chat stops", async () => {
    const { state, hidden } = await converse(C("surg-appendicitis"), arrest);
    expect(hidden.code?.active).toBe(true);
    expect(state.codeBlue).toBe(true);
    expect(state.patientStatus).toBe("critical");
    expect(said(state)).toMatch(/CODE BLUE/);
    expect(hidden.code?.rhythm).toBe("VF");
    const asked = await converse(C("surg-appendicitis"), [...arrest, "do you have any allergies?"]);
    expect(asked.state.messages.slice(-3).some((m) => m.role === "nurse" && /no pulse/i.test(m.text))).toBe(true);
    expect(asked.state.messages.slice(-3).some((m) => m.role === "patient")).toBe(false);
  });

  it("nobody doing CPR: the patient dies", async () => {
    const { state, hidden } = await converse(C("surg-appendicitis"), [...arrest, "wait 10 minutes"]);
    expect(state.patientStatus).toBe("deceased");
    expect(hidden.code?.outcome).toBe("died");
  });

  it("the algorithm plus the cause brings a pulse back, with harm", async () => {
    const { state, hidden } = await converse(C("surg-appendicitis"), [...arrest, "Start CPR", "Shock now", "Adrenaline 1 mg IV", "Shock now", "Calcium gluconate 10 mL IV"]);
    expect(hidden.code?.outcome).toBe("rosc");
    expect(state.codeBlue).toBe(false);
    expect(state.patientStatus).toBe("critical");
    expect(said(state)).toMatch(/Pulse is back/);
  });

  it("the cause untreated: no pulse after 20 minutes, however good the CPR", async () => {
    const { hidden } = await converse(C("surg-appendicitis"), [...arrest, "Start CPR", "Shock now", "Adrenaline 1 mg IV", "Shock now", ...Array(10).fill("Adrenaline 1 mg IV")]);
    expect(hidden.code?.outcome).toBe("died");
    expect(hidden.status).toBe("deceased");
  });

  it("a shock for a non-shockable rhythm is refused and marked", async () => {
    const untilArrest = ["Metoprolol 5 mg IV stat", "yes"];
    for (let i = 0; i < 12 && !(await converse(C("em-adhf"), untilArrest)).hidden.code?.active; i++) untilArrest.push("wait 15 minutes");
    const { hidden, state } = await converse(C("em-adhf"), [...untilArrest, "Shock now"]);
    expect(hidden.code?.rhythm).toBe("PEA");
    expect(said(state)).toMatch(/isn't shockable/);
    expect(hidden.code?.errors.length).toBeGreaterThan(0);
  });

  it("closing the case ends the arrest", async () => {
    const { hidden, state } = await converse(C("surg-appendicitis"), [...arrest, "dx sepsis. close"]);
    expect(hidden.closed).toBe(true);
    expect(state.patientStatus).toBe("deceased");
  });
});

describe("what new cases with the worst doctor showed", () => {
  const woman = () => ALL_CASES.find((c) => c.track === "emergency" && c.patient.sex === "Female" && c.patient.age >= 18 && c.patient.age <= 45 && !c.profile?.pregnant)!;
  const opd = () => ALL_CASES.find((c) => c.track === "opd" && c.patient.age >= 18)!;

  it("metoprolol 25 mg into a vein is five times the IV dose, though it's the tablet's dose", async () => {
    const asked = await converse(opd(), ["metoprolol 25 mg iv stat"]);
    expect(said(asked.state)).toMatch(/Do you still want it/);
    const tablet = await converse(opd(), ["metoprolol 25 mg po od for 7 days"]);
    expect(said(tablet.state)).not.toMatch(/heart rate and pressure dangerously/);
    const usual = await converse(opd(), ["metoprolol 5 mg iv stat"]);
    expect(said(usual.state)).not.toMatch(/heart rate and pressure dangerously/);
  });

  it("isotretinoin in an emergency for a woman who could be pregnant is queried, without saying she is", async () => {
    const text = said((await converse(woman(), ["isotretinoin 40 mg po stat"])).state);
    expect(text).toMatch(/Pregnancy hasn't been ruled out/);
    expect(text).not.toMatch(/She's pregnant/);
  });

  it("15 g of paracetamol at a clinic is still queried once the doctor says how often", async () => {
    const text = said((await converse(opd(), ["paracetamol 15 g po", "once"])).state);
    expect(text).toMatch(/liver-toxic/);
  });

  it("isotretinoin doesn't promise a full effect within hours", async () => {
    const text = said((await converse(opd(), ["isotretinoin 20 mg po stat", "yes", "yes"])).state);
    expect(text).not.toMatch(/Isotretinoin[^\n]*Full effect by about/);
  });

  it("too much fluid doesn't make a shocked patient hypertensive, or a small child's pressure an adult's", async () => {
    const shocked = C("obg-pph");
    const adult = await converse(shocked, ["ns 5 litres fast", "yes", "wait 15 minutes"]);
    expect(parseFloat(adult.hidden.vitals.bp.value)).toBeLessThan(130);
    const child = ALL_CASES.find((c) => c.patient.age < 5 && c.track !== "phone")!;
    const small = await converse(child, ["ns 5 litres fast", "yes", "wait 15 minutes"]);
    expect(parseFloat(small.hidden.vitals.bp.value)).toBeLessThan(140);
  });

  it("potassium's unit is written mEq", async () => {
    const text = said((await converse(opd(), ["kcl 40 meq iv push"])).state).split("\n").filter((l) => !l.startsWith("doctor:")).join("\n");
    expect(text).toMatch(/40 mEq/);
    expect(text).not.toMatch(/40 meq/);
  });
});

describe("what a wasted order costs in an arrest", () => {
  const arrest = ["morphine 50 mg iv", "yes", "wait 30 minutes", "wait 30 minutes"];
  const em = () => ALL_CASES.find((c) => c.track === "emergency" && c.patient.age >= 18)!;

  it("an order that isn't for the arrest costs a minute, and enough of them cost the patient", async () => {
    const start = await converse(em(), arrest);
    if (!start.hidden.code) return;
    const wasted = await converse(em(), [...arrest, "abg", "chest xray", "serum cortisol", "mri brain", "cbc", "lft", "rft", "kcl 40 meq iv"]);
    expect(wasted.hidden.clock).toBeGreaterThan(start.hidden.clock);
    expect(said(wasted.state)).not.toMatch(/Nobody can answer/);
    expect(wasted.hidden.code!.outcome).toBe("died");
  });

  it("CPR after the arrest is over doesn't read as if it had just begun", async () => {
    const start = await converse(em(), arrest);
    if (!start.hidden.code) return;
    const text = said((await converse(em(), [...arrest, "stop resuscitation", "start cpr"])).state);
    expect(text).not.toMatch(/CPR continued for 20 minutes/);
  });
});

describe("what new cases with an average doctor showed", () => {
  const em = () => ALL_CASES.find((c) => c.track === "emergency" && c.patient.age >= 18)!;
  const turn = (def: (typeof ALL_CASES)[number], intents: ActionRecord["intents"], generated?: ActionRecord["generated"]) => {
    const hidden = createHiddenState(def);
    const effects = runTurn(def, hidden, { id: "a1", at: 0, raw: "order", intents, generated });
    const words = effects.flatMap((e) => (e.type === "message" ? [`${e.role}: ${e.text}`] : []));
    return { hidden, effects, words };
  };

  it("a vital by any name the reading gives it never crashes the game", () => {
    for (const name of ["temperature", "vitals", "respiratory-rate", "observations", "general", "pulse", "nonsense"]) {
      const { words } = turn(em(), [{ kind: "vitals", targetId: name, phrase: "check", matched: true }]);
      expect(words.join("\n")).not.toMatch(/undefined/);
      expect(words.length).toBeGreaterThan(1);
    }
    expect(readVitalKeys(["temperature"])).toEqual(["temp"]);
    expect(readVitalKeys(["respiratory-rate", "bp"])).toEqual(["rr", "bp"]);
    expect(readVitalKeys(["observations"])).toEqual(ROUTINE_VITALS);
  });

  it("an order that can't be carried out doesn't take the turn down", () => {
    for (const intent of [
      { kind: "action", targetId: "measure:oxygen", phrase: "continue resuscitation", matched: true },
      { kind: "action", targetId: "measure:hfnc", phrase: "high flow", matched: true },
      { kind: "action", targetId: "nonsense", phrase: "do it", matched: true },
      { kind: "drug", targetId: "nonsense", phrase: "give it", matched: true },
      { kind: "exam", targetId: "nonsense", phrase: "look", matched: true },
      { kind: "investigation", targetId: "nonsense", phrase: "send", matched: true },
      { kind: "reassess", targetId: "nonsense", phrase: "again", matched: true },
      { kind: "results", targetId: "nonsense", phrase: "report", matched: true },
    ] as ActionRecord["intents"]) expect(() => turn(em(), [intent, { kind: "vitals", targetId: "hr", phrase: "pulse", matched: true }])).not.toThrow();
  });

  it("several questions with one written reply are answered once, the facts still noted", () => {
    const def = em();
    const entry = def.history[0]!;
    const { words, hidden } = turn(def, [
      { kind: "history", targetId: entry.id, phrase: "a", matched: true },
      { kind: "history", targetId: "generated", phrase: "b", matched: true },
      { kind: "history", targetId: "generated", phrase: "c", matched: true },
    ], { "1": "The one whole reply." });
    expect(words.filter((w) => /^(patient|attendant):/.test(w))).toEqual([expect.stringContaining("The one whole reply.")]);
    expect(hidden.history[entry.id]).toBeDefined();
  });

  it("a patient doesn't report what only the doctor or the lab can find", () => {
    expect(withoutFindings("He's had one wet nappy. The glucose was 88 mg/dL. On listening, there are crackles on both sides.")).toBe("He's had one wet nappy.");
    expect(withoutFindings("On examination, crackles.")).toBe("I'm not sure, doctor.");
  });

  it("a litre in ten minutes in shock is resuscitation, not an alarm; five litres still is", async () => {
    const shocked = C("obg-pph");
    const low = await converse(shocked, ["wait 60 minutes", "ns 1 litre iv over 10 minutes"]);
    if (parseFloat(low.hidden.vitals.bp.value) < 100) expect(said(low.state)).not.toMatch(/far faster than a bolus/);
    const huge = await converse(shocked, ["ns 5 litres iv over 50 minutes"]);
    expect(said(huge.state)).toMatch(/Do you still want it/);
  });

  it("a baby's numbers aren't an adult's where the case doesn't say", () => {
    expect(parseFloat(defaultVitals({ ...em().patient, age: 0 }).hr.value)).toBeGreaterThan(110);
    expect(parseFloat(defaultVitals({ ...em().patient, age: 0 }).rr.value)).toBeGreaterThan(30);
    expect(defaultVitals({ ...em().patient, age: 40 }).hr.value).toBe("78");
  });

  it("'continue oxygen' isn't more oxygen, and things already done aren't started again", async () => {
    const def = em();
    const a = await converse(def, ["oxygen 2 l nasal prongs", "monitor", "refer"]);
    const before = a.hidden.vitals.spo2.value;
    const b = await converse(def, ["oxygen 2 l nasal prongs", "monitor", "refer", "oxygen 2 l nasal prongs", "monitor", "refer"]);
    expect(said(b.state)).toMatch(/Oxygen continues/);
    expect(said(b.state)).toMatch(/Still on the monitor/);
    expect(said(b.state)).toMatch(/Referral already sent/);
    expect(parseFloat(b.hidden.vitals.spo2.value)).toBeLessThanOrEqual(parseFloat(before));
  });

  it("the route check is only for the drug named beside it", () => {
    const near = (name: string, text: string) => new RegExp(`\\b(?:po|by mouth)\\b[^.,;]{0,20}\\b${name}\\b|\\b${name}\\b[^.,;]{0,25}\\b(?:po|by mouth)\\b`, "i").test(text);
    expect(near("secukinumab", "secukinumab 150 mg po daily")).toBe(true);
    expect(near("ciprofloxacin", "Continue ciprofloxacin at 2 L. Don't force anything by mouth.")).toBe(false);
  });
});

describe("what an illness does in an invented case", () => {
  const concept = { patient: { age: 26, sex: "Male" }, diagnosis: "Paroxysmal supraventricular tachycardia", qualifier: "AVNRT" } as never;
  const therapeutics = [
    { id: "adenosine-rule", kind: "drug", appropriateness: "ideal", drugIds: ["adenosine"], measureIds: [] },
    { id: "cardiovert", kind: "procedure", appropriateness: "ideal", drugIds: [], measureIds: ["defib"] },
    { id: "bad", kind: "drug", appropriateness: "dangerous", drugIds: ["verapamil"], measureIds: [] },
  ];
  const management = (course: unknown) => ({ course, rubric: { diagnosisAccept: ["SVT"] } }) as never;
  const written = {
    definitive: ["adenosine-rule", "cardiovert", "bad", "made-up"], byMinute: 20, label: "Stopping the rhythm",
    response: { vitals: [{ key: "hr", value: "84" }, { key: "bp", value: "118/74" }, { key: "nonsense", value: "1" }, { key: "hr", value: "900" }], says: "It has stopped, doctor.", ecgAfter: "Sinus rhythm, rate 84." },
    untreated: [
      { afterMin: 30, status: "deteriorating", vitals: [{ key: "bp", value: "92/60" }], nurse: "Doctor, he looks pale." },
      { afterMin: 60, status: "critical", vitals: [{ key: "bp", value: "70/40" }], nurse: "Doctor, it's SVT and he's crashing." },
      { afterMin: 10, status: "deceased", vitals: [], nurse: "" },
      { afterMin: 300, status: "critical", vitals: [], nurse: "" },
    ],
  };

  it("only the case's right treatments count, each however it's ordered, and impossible numbers are dropped", () => {
    const { definitiveTreatment, onResponse } = courseOf(concept, management(written), therapeutics, "emergency");
    expect(definitiveTreatment!.ids).toEqual(["adenosine-rule", "drug:adenosine", "cardiovert", "measure:defib"]);
    expect(onResponse!.vitals).toEqual([{ key: "hr", value: "84" }, { key: "bp", value: "118/74" }]);
  });

  it("no death in the first 45 minutes, nothing after one, and the nurse never names it", () => {
    const { hazards } = courseOf(concept, management(written), therapeutics, "emergency");
    const stages = hazards[0]!.stages;
    expect(stages.at(-1)!.status).toBe("deceased");
    expect(hazards[0]!.omission!.byMinute + stages.at(-1)!.afterMin).toBeGreaterThanOrEqual(45);
    expect(stages.some((s) => /SVT/.test(s.observation!.text))).toBe(false);
  });

  it("a temperature comes out in the app's unit", () => {
    const { onResponse } = courseOf(concept, management({ ...written, response: { vitals: [{ key: "temp", value: "37" }, { key: "temp", value: "99.1" }] } }), therapeutics, "emergency");
    expect(onResponse!.vitals!.map((v) => v.value)).toEqual(["98.6", "99.1"]);
  });

  it("an operation's disease is cured by the operation, not the antibiotics on the way", () => {
    const list = [{ id: "ceftriaxone-rule", kind: "drug", label: "Antibiotics", appropriateness: "ideal", drugIds: ["ceftriaxone"], measureIds: [] }, { id: "appendicectomy", kind: "procedure", label: "Laparoscopic appendicectomy", appropriateness: "ideal", drugIds: [], measureIds: [] }];
    const { definitiveTreatment } = courseOf(concept, management({ ...written, definitive: ["ceftriaxone-rule", "appendicectomy"] }), list, "emergency");
    expect(definitiveTreatment!.ids).toEqual(["appendicectomy"]);
  });

  it("aspirin or a painkiller isn't what cures it", () => {
    const list = [{ id: "aspirin-rule", kind: "drug", label: "Aspirin", appropriateness: "ideal", drugIds: ["aspirin"], measureIds: [] }, { id: "lysis", kind: "drug", label: "Thrombolysis", appropriateness: "ideal", drugIds: ["tenecteplase"], measureIds: [] }];
    expect(courseOf(concept, management({ ...written, definitive: ["aspirin-rule", "lysis"] }), list, "emergency").definitiveTreatment!.ids).toEqual(["lysis", "drug:tenecteplase"]);
    expect(courseOf(concept, management({ ...written, definitive: ["aspirin-rule"] }), list, "emergency")).toEqual({ hazards: [] });
  });

  it("aspirin alone doesn't take away an infarct's pain", () => {
    const aspirin = FORMULARY.find((d) => d.id === "aspirin")!;
    expect(profileFor(aspirin)!.effects.pain).toBe(-1);
    expect(kineticsFor(aspirin, "PO").peak).toBe(30);
  });

  it("a clinic case is on no clock, and a case without a course runs as before", () => {
    expect(courseOf(concept, management(written), therapeutics, "opd").hazards).toEqual([]);
    expect(courseOf(concept, management(undefined), therapeutics, "emergency")).toEqual({ hazards: [] });
  });

  it("right treatment brings them back, the ECG follows; no treatment and the illness takes its course", async () => {
    const base = ALL_CASES.find((c) => c.track === "emergency" && c.patient.age >= 18)!;
    const course = courseOf(concept, management(written), therapeutics, "emergency");
    const def = {
      ...base, hazards: course.hazards, onResponse: course.onResponse,
      therapeutics: [{ id: "adenosine-rule", kind: "drug", drugIds: ["adenosine"], label: "Adenosine", appropriateness: "ideal" }, ...base.therapeutics.filter((t) => t.appropriateness !== "ideal")],
      rubric: { ...base.rubric, definitiveTreatment: course.definitiveTreatment },
    } as typeof base;
    const treated = await converse(def, ["adenosine 6 mg iv"]);
    expect(said(treated.state)).toMatch(/adenosine 6 mg iv/i);
    expect(said(treated.state)).not.toMatch(/Adenosine[^\n]*Full effect by about 20/);
    expect(treated.hidden.status).toBe("improving");
    expect(treated.hidden.vitals.hr.value).toBe("84");
    const left = await converse(def, ["wait 60 minutes", "wait 60 minutes"]);
    expect(left.hidden.hazards.some((h) => h.id === "untreated-course")).toBe(true);
    expect(left.state.messages.map((m) => m.text).join(" ")).toMatch(/he looks pale/);
  });
});

describe("what the doctor wrote, in a long order", () => {
  it("each drug keeps its own dose", () => {
    const text = "Give morphine 2 mg IV slowly and ondansetron 4 mg IV; repeat observations";
    expect(clauseFor("morphine", text)).toMatch(/2 mg/);
    expect(clauseFor("ondansetron", text)).toMatch(/4 mg/);
    // A decimal isn't the end of a sentence.
    expect(clauseFor("ns", "Give 0.9% saline 1 L and morphine 2.5 mg IV")).toMatch(/1 L/);
    expect(clauseFor("morphine", "Give 0.9% saline 1 L and morphine 2.5 mg IV")).toMatch(/2\.5 mg/);
    expect(clauseFor("morphine", "ondansetron 4 mg, morphine 1,000 mcg. Then rest")).toMatch(/1,000 mcg/);
    expect(clauseFor("folic-acid", "Start methotrexate 15 mg orally once weekly with folic acid 1 mg orally daily")).toMatch(/^folic acid 1 mg/i);
    expect(clauseFor("methotrexate", "Start methotrexate 15 mg orally once weekly with folic acid 1 mg orally daily")).toMatch(/^methotrexate 15 mg/i);
    expect(clauseFor("paracetamol", "give 500 mg paracetamol")).toMatch(/500 mg/);
    expect(clauseFor("cefixime", "An organism susceptible to cefixime; discharge on cefixime 400 mg by mouth once daily")).toMatch(/400 mg/);
  });
  it("what they said not to do isn't ordered", () => {
    expect(saidNotTo("measure:oxygen", "No supplemental oxygen, she's at 99%")).toBe(true);
    expect(saidNotTo("unknown", "No further medicine now")).toBe(true);
    expect(saidNotTo("measure:oral-fluids", "give no oral fluids if she can't keep them down")).toBe(true);
    expect(saidNotTo("aspirin", "avoid aspirin")).toBe(true);
    expect(saidNotTo("measure:oxygen", "start oxygen 2 L by prongs")).toBe(false);
    expect(saidNotTo("aspirin", "aspirin 300 mg chewed now")).toBe(false);
  });
  it("an examination doesn't tell the doctor what to do next", () => {
    expect(onlyFindings("Tender in the right upper quadrant. Pregnancy status is not established. Obtain urine hCG.")).toBe("Tender in the right upper quadrant.");
    expect(onlyFindings("Anxious and sweaty. Pulse 96/min, regular; blood pressure 148/88 mmHg; respiratory rate 20/min; oxygen saturation 97% on room air.")).toBe("Anxious and sweaty.");
    expect(onlyFindings("Respiratory rate 58/min with subcostal recession and nasal flaring.")).toBe("With subcostal recession and nasal flaring.");
    expect(onlyFindings("Temperature 37.4 °C, alert.")).toMatch(/alert/i);
  });
});

describe("two drugs that clash", () => {
  const adult = () => ALL_CASES.find((c) => c.track === "emergency" && c.patient.age >= 18 && !c.profile?.currentDrugs?.length)!;
  const onOwn = (drug: string) => { const base = adult(); return { ...base, profile: { ...base.profile, currentDrugs: [drug] } } as typeof base; };

  it("the nurse queries the pair before it's given, whichever came first, or if it's the patient's own medicine", async () => {
    const pairs: [string, string][] = [["ondansetron 4 mg iv", "azithromycin 500 mg iv"], ["morphine 2 mg iv", "midazolam 2 mg iv"], ["metoprolol 5 mg iv", "diltiazem 20 mg iv"]];
    for (const [first, second] of pairs) {
      const text = said((await converse(adult(), [first, second])).state);
      expect(text).toMatch(/Do you still want it/);
    }
    expect(said((await converse(onOwn("sildenafil"), ["gtn 0.4 mg sl"])).state)).toMatch(/Do you still want it/);
    expect(said((await converse(onOwn("warfarin"), ["ibuprofen 400 mg po stat"])).state)).toMatch(/warfarin/i);
  });

  it("said again, it's given and the harm follows; the right rescue reverses it", async () => {
    const hurt = await converse(adult(), ["ondansetron 4 mg iv", "azithromycin 500 mg iv", "yes", "wait 30 minutes"]);
    expect(hurt.hidden.hazards.some((h) => h.id === "clash-qt")).toBe(true);
    expect(said(hurt.state)).toMatch(/QT is very long/);
    const saved = await converse(adult(), ["ondansetron 4 mg iv", "azithromycin 500 mg iv", "yes", "wait 30 minutes", "magnesium sulphate 2 g iv over 15 minutes"]);
    expect(saved.hidden.hazards.find((h) => h.id === "clash-qt")?.rescuedAt).toBeDefined();
  });

  it("a safe pair isn't queried, and every drug the rules name is in the formulary or is a known outside name", async () => {
    expect(said((await converse(adult(), ["paracetamol 1 g iv", "ondansetron 4 mg iv"])).state)).not.toMatch(/QT-prolonging|Do you still want it/);
    expect(liveClash("paracetamol", ["ondansetron", "warfarin"])).toBeNull();
    expect(liveClash("ibuprofen", ["warfarin"])?.other).toBe("warfarin");
    expect(liveClash("warfarin", ["ibuprofen"])?.other).toBe("ibuprofen");
  });
});

describe("a misspelt drug", () => {
  it("is put right once, and a right name is never 'corrected'", () => {
    expect(stockedSpelling("morfine 50 mg iv")).toBe("Morphine 50 mg iv");
    expect(stockedSpelling("Morphine 50 mg iv")).toBeUndefined();
    // Reading its own correction again finds nothing to change, for every stocked drug: no endless loop.
    for (const d of FORMULARY) for (const name of [d.generic, d.id, ...(d.aliases ?? []), ...d.brands]) expect(stockedSpelling(`give ${name} now`) ?? "", name).not.toContain(`${d.generic} ${d.generic}`);
    expect(stockedSpelling("give levosalbutamol neb now")).toBeUndefined();
  });
});

describe("labs follow what was done", () => {
  const r = (analyte: string, value: string, reference?: string, unit?: string) => ({ analyte, value, reference, unit, flag: "normal" as const });
  const base = [r("Haemoglobin", "13.0", "12.0–16.0"), r("Albumin", "4.0", "3.5–5.2"), r("Sodium", "138", "135–145"), r("Chloride", "102", "98–107"), r("HCO₃⁻", "24", "22–26"), r("pCO₂", "40", "35–45", "mmHg"), r("pH", "7.40", "7.35–7.45")];
  const adultCtx = { weightKg: 60, fluids: [], redCellUnits: 0, co2Retained: 0, age: 40, sex: "Male" };
  const val = (rows: readonly { analyte: string; value: string }[], a: string) => Number(rows.find((x) => x.analyte === a)!.value);

  it("saline dilutes haemoglobin and albumin, raises chloride and lowers bicarbonate, in proportion", () => {
    const small = followLabs(base, { ...adultCtx, fluids: [{ drugId: "ns", ml: 1000, ago: 0 }] });
    const large = followLabs(base, { ...adultCtx, fluids: [{ drugId: "ns", ml: 5000, ago: 0 }] });
    expect(val(small, "Haemoglobin")).toBeLessThan(13);
    expect(val(large, "Haemoglobin")).toBeLessThan(val(small, "Haemoglobin"));
    expect(val(large, "Albumin")).toBeLessThan(4);
    expect(val(large, "Chloride")).toBeGreaterThan(110);
    expect(val(large, "HCO₃⁻")).toBeLessThan(val(small, "HCO₃⁻"));
    expect(large.find((x) => x.analyte === "Chloride")!.flag).toBe("high");
  });

  it("Ringer lactate dilutes without the chloride; red cells raise haemoglobin; a small flush changes nothing", () => {
    const rl = followLabs(base, { ...adultCtx, fluids: [{ drugId: "rl", ml: 3000, ago: 0 }] });
    expect(val(rl, "Haemoglobin")).toBeLessThan(13);
    expect(val(rl, "Chloride")).toBe(102);
    expect(val(followLabs(base, { ...adultCtx, weightKg: 70, redCellUnits: 2 }), "Haemoglobin")).toBe(15);
    expect(followLabs(base, { ...adultCtx, fluids: [{ drugId: "ns", ml: 100, ago: 0 }] })).toEqual(base);
  });

  it("Winter's formula corrects a written PaCO₂ only where no lung illness explains it", () => {
    const dka = [r("HCO₃⁻", "10"), r("pCO₂", "40", undefined, "mmHg")];
    expect(wintersPaCO2(10)).toBe(23);
    expect(val(compensated(dka, "Diabetic ketoacidosis"), "pCO₂")).toBe(23);
    expect(val(compensated(dka, "Severe pneumonia with sepsis"), "pCO₂")).toBe(40);
    expect(val(compensated([r("HCO₃⁻", "10"), r("pCO₂", "25", undefined, "mmHg")], "Diabetic ketoacidosis"), "pCO₂")).toBe(25);
  });

  it("played through: a large saline load shows on the repeat bloods, with a pH that agrees", async () => {
    const def = C("em-adhf");
    const { state } = await converse(def, ["ns 3 litres iv over 3 hours", "yes", "wait 60 minutes", "wait 60 minutes", "wait 60 minutes", "abg", "cbc", "electrolytes"]);
    const abg = [...state.investigations].reverse().find((i) => /abg|blood gas/i.test(i.name));
    const rows = abg?.rows ?? [];
    const get = (re: RegExp) => Number(rows.find((x) => re.test(x.analyte))?.value);
    if (get(/^ph$/i) && get(/hco/i) && get(/co/i)) expect(Math.abs(hh(get(/hco/i), get(/pco/i)) - get(/^ph$/i))).toBeLessThanOrEqual(0.035);
  });

  it("high-flow oxygen in a CO₂ retainer brings narcosis and a rising PaCO₂; controlled oxygen stops it", async () => {
    const base2 = ALL_CASES.find((c) => c.track === "emergency" && c.patient.age >= 18)!;
    const copd = { ...base2, truth: { ...base2.truth, diagnosis: "Acute exacerbation of COPD" }, hazards: [], rubric: { ...base2.rubric, definitiveTreatment: undefined } } as typeof base2;
    const hurt = await converse(copd, ["oxygen 15 l non rebreather", "wait 60 minutes", "abg"]);
    expect(hurt.hidden.hazards.some((h) => h.id === "co2-narcosis")).toBe(true);
    expect(said(hurt.state)).toMatch(/getting sleepy/);
    const pco2 = (s: typeof hurt.state) => Number(([...s.investigations].reverse().find((i) => /abg|blood gas/i.test(i.name))?.rows ?? []).find((x) => /pco/i.test(x.analyte))?.value);
    const fine = await converse(copd, ["oxygen 2 l nasal prongs", "wait 60 minutes", "abg"]);
    expect(fine.hidden.hazards.some((h) => h.id === "co2-narcosis")).toBe(false);
    expect(pco2(hurt.state)).toBeGreaterThan(pco2(fine.state));
    const saved = await converse(copd, ["oxygen 15 l non rebreather", "wait 60 minutes", "oxygen 2 l nasal prongs"]);
    expect(saved.hidden.hazards.find((h) => h.id === "co2-narcosis")?.rescuedAt).toBeDefined();
    // Someone who doesn't retain CO₂ is unharmed by the same oxygen.
    const plain = await converse(base2, ["oxygen 15 l non rebreather"]);
    expect(plain.hidden.hazards.some((h) => h.id === "co2-narcosis")).toBe(false);
  });
});

describe("what a drug must not be given in, and what it comes in", () => {
  const facts = (over = {}) => ({ age: 40, story: "", ckd: false, plateletsLow: false, ...over });
  const drug = (id: string) => FORMULARY.find((d) => d.id === id)!;

  it("each rule fires where it should, and not otherwise", () => {
    expect(contraindication(drug("ibuprofen"), facts({ story: "I have vomited fresh blood twice" }))).toMatch(/bleeding/);
    expect(contraindication(drug("ibuprofen"), facts({ story: "my knee hurts" }))).toBeNull();
    expect(contraindication(drug("aspirin"), facts({ age: 6, story: "fever for 3 days" }))).toMatch(/Reye/);
    expect(contraindication(drug("aspirin"), facts({ age: 6, story: "fever, Kawasaki" }))).toBeNull();
    expect(contraindication(drug("doxycycline"), facts({ age: 6 }))).toMatch(/teeth/);
    expect(contraindication(drug("doxycycline"), facts({ age: 20 }))).toBeNull();
    expect(contraindication(drug("tramadol"), facts({ age: 9 }))).toMatch(/breathing/);
    expect(contraindication(drug("metformin"), facts({ ckd: true }))).toMatch(/lactic/);
    expect(contraindication(drug("ciprofloxacin"), facts({ story: "I have myasthenia" }))).toMatch(/myasthenia/);
    expect(contraindication(drug("metoprolol"), facts({ pulse: 44 }))).toMatch(/under 50/);
    expect(contraindication(drug("metoprolol"), facts({ pulse: 88 }))).toBeNull();
  });

  it("no written case's right treatment is queried", () => {
    const wrong: string[] = [];
    for (const def of ALL_CASES) for (const rule of def.therapeutics.filter((t) => t.appropriateness === "ideal")) for (const id of rule.drugIds ?? []) {
      const d = FORMULARY.find((x) => x.id === id);
      const said2 = d && contraindication(d, facts({ age: def.patient.age, story: storyOf(def), ckd: !!def.profile?.ckd }));
      if (said2) wrong.push(`${def.id}: ${id}: ${said2}`);
    }
    expect(wrong).toEqual([]);
  });

  it("every usual dose in the formulary can be made up, and an impossible one can't", () => {
    const wrong = FORMULARY.flatMap((d) => {
      const m = d.dose?.match(/^([\d.]+)\s*mg\b/i);
      return m && strengthProblem(d, Number(m[1]), "mg", "PO") ? [`${d.id} ${d.dose}`] : [];
    });
    expect(wrong).toEqual([]);
    expect(tabletStrengths("atorvastatin")).toContain(40);
    expect(strengthProblem(drug("atorvastatin"), 33, "mg", "PO")).toMatch(/comes as/);
    expect(strengthProblem(drug("atorvastatin"), 80, "mg", "PO")).toBeNull();
    expect(strengthProblem(drug("atorvastatin"), 33, "mg", "IV")).toBeNull();
    expect(strengthProblem(drug("aspirin"), 75, "mg", "PO")).toBeNull();
    expect(strengthProblem(drug("metformin"), 1000, "mg", "PO")).toBeNull();
  });
});

describe("by age", () => {
  const facts = (over = {}) => ({ age: 40, story: "", ckd: false, plateletsLow: false, ...over });
  const drug = (id: string) => FORMULARY.find((d) => d.id === id)!;
  const r = (analyte: string, value: string, reference?: string, flag: "normal" | "low" | "high" = "normal") => ({ analyte, value, reference, flag });
  const ctx = { weightKg: 12, fluids: [], redCellUnits: 0, co2Retained: 0, age: 2, sex: "Female", heightCm: 85 };

  it("a child's vitals are read against a child's chart", () => {
    expect(normalVitals(0).hr).toEqual([100, 160]);
    expect(normalVitals(4).rr).toEqual([22, 34]);
    expect(normalVitals(40).hr).toEqual([60, 100]);
    expect(normalVitals(40).lowSbp).toBe(90);
    expect(normalVitals(5).lowSbp).toBe(80);
  });

  it("a feverish 2-year-old with a pulse of 132 isn't called unwell for it at the door", async () => {
    const child = ALL_CASES.find((c) => c.patient.age >= 1 && c.patient.age < 5 && c.track !== "phone")!;
    const def = { ...child, baselineVitals: { ...child.baselineVitals, hr: { key: "hr", value: "132" }, bp: { key: "bp", value: "95/60" }, spo2: { key: "spo2", value: "99" }, rr: { key: "rr", value: "28" } }, initialStatus: "stable" } as typeof child;
    expect(said((await converse(def, ["discharge"])).state)).not.toMatch(/pulse 132/);
  });

  it("a child's labs use a child's ranges, and a normal result is normal for the age", () => {
    const rows = followLabs([r("Creatinine", "0.9", "0.7–1.3"), r("Haemoglobin", "8.0", "13–17", "low"), r("eGFR", "> 90", "> 90")], ctx);
    expect(Number(rows[0]!.value)).toBeLessThanOrEqual(0.5);
    expect(rows[0]!.flag).toBe("normal");
    expect(rows[1]).toMatchObject({ value: "8.0", flag: "low", reference: "11–14" });
    expect(rows[2]!.value).toBe("> 90");
  });

  it("eGFR follows the creatinine shown; clearance matches the worked example", () => {
    expect(Math.round(ckdEpi(1.0, 50, "Male"))).toBe(92);
    expect(Math.round(ckdEpi(3.0, 70, "Female"))).toBe(16);
    expect(Math.round(creatinineClearance(80, 60, 2, "Male"))).toBe(25);
    expect(followLabs([r("Creatinine", "3.0"), r("eGFR", "> 90")], { ...ctx, age: 70, weightKg: 60 })[1]).toMatchObject({ value: "16", flag: "critical" });
  });

  it("failing kidneys and older age are queried, from a creatinine that's back or the history", () => {
    expect(contraindication(drug("metformin"), facts({ crcl: 22 }))).toMatch(/lactic/);
    expect(contraindication(drug("metformin"), facts({ crcl: 60 }))).toBeNull();
    expect(contraindication(drug("ibuprofen"), facts({ crcl: 20 }))).toMatch(/kidneys/);
    expect(contraindication(drug("enoxaparin"), facts({ ckd: true }))).toMatch(/accumulates/);
    expect(contraindication(drug("diazepam"), facts({ age: 78 }))).toMatch(/falls/);
    expect(contraindication(drug("diazepam"), facts({ age: 78, story: "he is having seizures" }))).toBeNull();
    expect(contraindication(drug("diazepam"), facts({ age: 40 }))).toBeNull();
    expect(contraindication(drug("glimepiride"), facts({ age: 70 }))).toMatch(/low sugars/);
  });
});

describe("in pregnancy", () => {
  const drug = (id: string) => FORMULARY.find((d) => d.id === id)!;
  it("every drug is read against the gestation", () => {
    expect(pregnancyRisk(drug("isotretinoin"), 8)).toMatch(/harm the baby/);
    expect(pregnancyRisk(drug("enalapril"), 30)).toMatch(/kidney failure/);
    expect(pregnancyRisk(drug("ibuprofen"), 10)).toBeNull();
    expect(pregnancyRisk(drug("ibuprofen"), 24)).toMatch(/amniotic/);
    expect(pregnancyRisk(drug("ibuprofen"), 33)).toMatch(/ductus/);
    expect(pregnancyRisk(drug("doxycycline"), 8)).toBeNull();
    expect(pregnancyRisk(drug("doxycycline"), 20)).toMatch(/teeth/);
    expect(pregnancyRisk(drug("paracetamol"), 30)).toBeNull();
    expect(pregnancyRisk(drug("cotrimoxazole"), 10)).toMatch(/neural tube/);
  });
  it("reads the gestation from the story", () => {
    expect(gestationFrom("She is 32 weeks pregnant with a headache")).toBe(32);
    expect(gestationFrom("G2P1, POG 28 wks")).toBe(28);
    expect(gestationFrom("at 10 weeks' gestation")).toBe(10);
    expect(gestationFrom("cough for 3 weeks")).toBeUndefined();
  });
  it("played through, with no hint before she's known to be pregnant", async () => {
    const base = ALL_CASES.find((c) => c.track === "emergency" && c.patient.sex === "Female" && c.patient.age >= 18 && !c.profile?.pregnant)!;
    const known = { ...base, profile: { ...base.profile, pregnant: true, gestationWeeks: 33 }, therapeutics: base.therapeutics.filter((t) => !(t.drugIds ?? []).includes("ibuprofen")) } as typeof base;
    expect(said((await converse(known, ["ibuprofen 400 mg po stat"])).state)).toMatch(/She's pregnant, 33 weeks — after 30 weeks/);
    expect(said((await converse(base, ["ibuprofen 400 mg po stat"])).state)).not.toMatch(/pregnant/i);
  });
});

describe("procedures can go wrong", () => {
  const c = (over = {}) => ({ phrase: "", age: 50, preoxygenated: false, sedated: false, plateletsLow: false, roll: 50, raisedIcpSigns: false, headScanBack: false, ...over });
  const good = { phrase: "RSI with ketamine and rocuronium, size 7.5 tube, confirm with capnography", preoxygenated: true };

  it("technique decides most of it: careful intubation fails far less often than careless", () => {
    const fails = (over: object) => Array.from({ length: 100 }, (_, roll) => runProcedure("intubation", c({ ...over, roll }))!).filter((o) => o.hazard || o.spo2Drop).length;
    expect(fails(good)).toBeLessThan(25);
    expect(fails({ phrase: "intubate" })).toBeGreaterThan(fails(good) + 25);
  });

  it("each lapse is named", () => {
    expect(runProcedure("intubation", c({ phrase: "intubate" }))!.lapses).toContain("no pre-oxygenation");
    expect(runProcedure("intubation", c({ phrase: "intubate" }))!.lapses).toContain("no induction drugs or paralysis");
    expect(runProcedure("central-line", c({ phrase: "central line" }))!.lapses).toEqual(["no ultrasound guidance", "no sterile technique stated"]);
    expect(tubeProblem("size 10 tube", 40)).toMatch(/wrong/);
    expect(tubeProblem("size 7.5 tube", 40)).toBeUndefined();
    expect(tubeProblem("size 7.5 tube", 2)).toMatch(/wrong/);
    expect(tubeProblem("size 4.5 tube", 2)).toBeUndefined();
  });

  it("no capnography can mean an oesophageal tube; bad luck with good technique costs no marks", () => {
    expect(runProcedure("intubation", c({ phrase: "intubate", roll: 2 }))!.hazard).toBe("proc-oesophageal");
    expect(runProcedure("intubation", c({ ...good, roll: 2 }))!.hazard).toBeUndefined();
    const unlucky = runProcedure("intubation", c({ ...good, roll: 95 }))!;
    expect(unlucky.hazard).toBe("proc-mainstem");
    expect(unlucky.unavoidable).toBe(true);
  });

  it("sterile technique and ultrasound protect a line; albumin protects a big tap", () => {
    const infected = Array.from({ length: 100 }, (_, roll) => runProcedure("central-line", c({ phrase: "central line", roll }))!).filter((o) => o.hazard === "proc-line-infection").length;
    const clean = Array.from({ length: 100 }, (_, roll) => runProcedure("central-line", c({ phrase: "sterile central line under ultrasound", roll }))!).filter((o) => o.hazard === "proc-line-infection").length;
    expect(infected).toBeGreaterThan(20);
    expect(clean).toBe(0);
    expect(runProcedure("paracentesis", c({ phrase: "paracentesis, drain 6 litres" }))!.hazard).toBe("proc-para-hypotension");
    expect(runProcedure("paracentesis", c({ phrase: "paracentesis, drain 6 litres with albumin" }))!.hazard).toBeUndefined();
  });

  it("an LP with raised-pressure signs and no scan can herniate; with the scan back it doesn't", () => {
    expect(lumbarPuncture(c({ raisedIcpSigns: true }))!.hazard).toBe("proc-lp-herniation");
    expect(lumbarPuncture(c({ raisedIcpSigns: true, headScanBack: true }))).toBeUndefined();
    expect(lumbarPuncture(c({ plateletsLow: true }))!.hazard).toBe("proc-spinal-haematoma");
  });

  it("played through: replays the same, the tube can be pulled back, and the demo never fails", async () => {
    const def = ALL_CASES.find((d) => d.track === "emergency" && d.patient.age >= 18)!;
    const a = await converse(def, ["intubate", "yes"]);
    const b = await converse(def, ["intubate", "yes"]);
    expect(said(a.state)).toBe(said(b.state));
    expect(said(a.state)).toMatch(/ntubat|Tube|attempt/);
    const demo = ALL_CASES.find((d) => d.guided);
    if (demo) {
      const d = await converse(demo, ["intubate", "yes"]);
      expect(d.hidden.hazards.some((h) => h.id.startsWith("proc-"))).toBe(false);
    }
  });
});

describe("how the patient behaves", () => {
  const f = (over = {}) => ({ diagnosis: "Appendicitis", age: 40, gcs: 15, pain: 3, status: "stable", ...over });
  const base = () => ALL_CASES.find((c) => c.track === "emergency" && c.patient.age >= 18)!;

  it("speech follows the illness and the numbers", () => {
    expect(stateOfMind(f())).toBeUndefined();
    expect(stateOfMind(f({ gcs: 13 }))).toMatch(/Confused/);
    expect(stateOfMind(f({ gcs: 8 }))).toMatch(/Too drowsy/);
    expect(stateOfMind(f({ pain: 9 }))).toMatch(/severe pain/);
    expect(stateOfMind(f({ diagnosis: "Paranoid schizophrenia, acute relapse" }))).toMatch(/Paranoid/);
    expect(stateOfMind(f({ diagnosis: "Major depressive disorder with suicidal ideation" }))).toMatch(/Flat/);
    expect(stateOfMind(f({ diagnosis: "Acute mania" }))).toMatch(/Pressured/);
  });

  it("someone too drowsy can't give a history", async () => {
    const def = { ...base(), baselineVitals: { ...base().baselineVitals, gcs: { key: "gcs", value: "8" } } } as ReturnType<typeof base>;
    const text = said((await converse(def, ["how long has this been going on"])).state);
    expect(text).toMatch(/Too drowsy to answer/);
  });

  it("a reluctant patient refuses until told why; told, they agree; pushed, they leave and it costs the marks", async () => {
    const def = { ...base(), persona: "reluctant — doesn't want tests or admission" } as ReturnType<typeof base>;
    expect(said((await converse(def, ["admit the patient"])).state)).toMatch(/I want to go home/);
    const told = await converse(def, ["admit the patient", "admit him, because this could be dangerous if we leave it"]);
    expect(said(told.state)).toMatch(/go ahead/);
    expect(told.hidden.discharged).toBeFalsy();
    const pushed = await converse(def, ["admit the patient", "just admit"]);
    expect(said(pushed.state)).toMatch(/Left against medical advice/);
    expect(pushed.hidden.leftAma).toBe(true);
    expect(givesReason("admit")).toBe(false);
    const after = generateDebrief(def, pushed.hidden, pushed.state);
    expect(after.score.lines.find((l) => l.category === "outcome")!.notes.join(" ")).toMatch(/against medical advice/);
  });

  it("no refusal from someone not reluctant, or in the demo", async () => {
    expect(said((await converse(base(), ["admit the patient"])).state)).not.toMatch(/I want to go home/);
  });
});

describe("more from the new games", () => {
  const base = () => ALL_CASES.find((c) => c.track === "emergency" && c.patient.age >= 18)!;
  const copd = () => ({ ...base(), truth: { ...base().truth, diagnosis: "Acute exacerbation of COPD" }, hazards: [] }) as ReturnType<typeof base>;

  it("'continue oxygen' doesn't speed up CO₂ narcosis", async () => {
    const once = await converse(copd(), ["oxygen 15 l non rebreather"]);
    const twice = await converse(copd(), ["oxygen 15 l non rebreather", "oxygen 15 l non rebreather"]);
    expect(said(twice.state)).not.toMatch(/getting sleepy/);
    expect(once.hidden.hazards.find((h) => h.id === "co2-narcosis")?.armedAt).toBe(twice.hidden.hazards.find((h) => h.id === "co2-narcosis")?.armedAt);
  });

  it("a case's own treatment read as a drug gives that drug, not 'which medicine?'", () => {
    const def = { ...base(), therapeutics: [{ id: "nebulised-bronchodilators", kind: "drug", drugIds: ["salbutamol"], label: "Nebulised bronchodilators", appropriateness: "ideal" }, ...base().therapeutics] } as ReturnType<typeof base>;
    const fx = runTurn(def, createHiddenState(def), { id: "a", at: 0, raw: "x", intents: [{ kind: "drug", targetId: "nebulised-bronchodilators", phrase: "salbutamol 2.5 mg nebulised", matched: true, payload: { amount: 2.5, unit: "mg", route: "NEB" } }] });
    expect(fx.flatMap((e) => (e.type === "message" ? [e.text] : [])).join(" ")).not.toMatch(/Which medicine/);
  });

  it("'by nebuliser' is a route", () => {
    expect(parseOrderDetails("salbutamol 2.5 mg by nebuliser", { weightKg: 60 }).route).toBe("NEB");
  });
});

describe("how fast treatment works", () => {
  it("an infection doesn't settle within minutes of the antibiotic, but does within hours", async () => {
    const base = ALL_CASES.find((c) => c.track === "emergency" && c.patient.age >= 18)!;
    const def = { ...base, hazards: [], initialStatus: "guarded", onResponse: { vitals: [{ key: "hr", value: "90" }], says: "I feel better." }, therapeutics: [{ id: "abx", kind: "drug", drugIds: ["ceftriaxone"], label: "Antibiotics", appropriateness: "ideal" }, ...base.therapeutics.filter((t) => t.appropriateness !== "ideal")], rubric: { ...base.rubric, definitiveTreatment: { ids: ["abx", "drug:ceftriaxone"], byMinute: 60, label: "Antibiotics" } } } as typeof base;
    const soon = await converse(def, ["ceftriaxone 2 g iv"]);
    expect(soon.hidden.responded).toBeUndefined();
    const later = await converse(def, ["ceftriaxone 2 g iv", "wait 60 minutes", "wait 60 minutes", "wait 60 minutes", "wait 60 minutes"]);
    expect(later.hidden.responded).toBeDefined();
    expect(later.hidden.status).toBe("improving");
  });
});

describe("from the last new games", () => {
  it("a sound-alike is a different drug, not a misspelling", () => {
    expect(stockedSpelling("nimodipin 60 mg po")).toBe("Nimodipine 60 mg po");
    expect(stockedSpelling("nimodipine 60 mg po")).toBeUndefined();
    expect(stockedSpelling("paracetmol 500 mg")).toBe("Paracetamol 500 mg");
    expect(stockedSpelling("morfine 5 mg iv")).toBe("Morphine 5 mg iv");
    expect(stockedSpelling("hydroxyzin 25 mg")).toBe("Hydroxyzine 25 mg");
  });
  it("a child's dose by weight isn't queried for its tablet size", async () => {
    const child = ALL_CASES.find((c) => c.patient.age >= 1 && c.patient.age < 8 && c.track !== "phone")!;
    expect(said((await converse(child, ["amoxicillin 45 mg/kg po tds for 5 days"])).state)).not.toMatch(/can't be made up/);
  });
  it("a doctor plainly explaining isn't taken for no reason", () => {
    expect(givesReason("Your pulse and pressure have improved but we should watch you here tonight to make sure it stays that way")).toBe(true);
    expect(givesReason("your blood count is low")).toBe(true);
    expect(givesReason("just admit")).toBe(false);
  });
});

describe("case report: fluid in someone who isn't short of it (Case #47)", () => {
  const def = () => {
    const base = ALL_CASES.find((c) => c.track === "opd" && c.patient.age >= 18)!;
    return { ...base, baselineVitals: { ...base.baselineVitals, bp: { key: "bp", value: "164/100" } }, profile: { ...base.profile, volume: "normal" } } as typeof base;
  };
  const sbp = (bp: string) => parseFloat(bp);

  it("a rapid litre raises the pressure, in proportion, and it fades", async () => {
    const one = await converse(def(), ["iv ns 500 ml in 50 sec", "bp"]);
    expect(sbp(one.hidden.vitals.bp.value)).toBe(164);
    const shown = said(one.state);
    const after = Number(shown.match(/BP (\d+)\/\d+ mmHg/)?.[1]);
    expect(after).toBeGreaterThan(164);
    const two = await converse(def(), ["iv ns 500 ml in 50 sec", "give 500 ml rl iv in 10 sec", "bp"]);
    const afterTwo = [...said(two.state).matchAll(/BP (\d+)\/\d+ mmHg/g)].map((m) => Number(m[1])).at(-1)!;
    expect(afterTwo).toBeGreaterThan(after);
    const later = await converse(def(), ["iv ns 500 ml in 50 sec", "wait 4 hours", "bp"]);
    const faded = [...said(later.state).matchAll(/BP (\d+)\/\d+ mmHg/g)].map((m) => Number(m[1])).at(-1)!;
    expect(faded).toBeLessThanOrEqual(165);
  });

  it("no order runs faster than a cannula can, and it says so", async () => {
    const text = said((await converse(def(), ["give 500 ml rl iv in 10 sec"])).state);
    expect(text).toMatch(/can't run in 10 sec/);
    expect(text).toMatch(/over 2 min/);
    expect(text).not.toMatch(/over 0 min/);
  });

  it("someone short of fluid still gets the benefit, not a false rise", async () => {
    const shocked = C("obg-pph");
    const given = await converse(shocked, ["ns 500 ml iv over 15 minutes"]);
    expect(given.hidden.drugs[0]?.pressureLoad ?? 0).toBeLessThan(10);
  });
});

describe("the seven fixes", () => {
  const r = (analyte: string, value: string, reference?: string, unit?: string) => ({ analyte, value, reference, unit, flag: "normal" as const });
  it("pH follows HCO₃ and pCO₂ with subscripts in the names", () => {
    const rows = consistentLabs([r("pH", "7.33", "7.35–7.45"), r("pCO₂", "40", "35–45", "mmHg"), r("HCO₃⁻", "18", "22–26", "mEq/L")]);
    expect(rows[0]!.value).toBe("7.28");
    expect(consistentLabs([r("pH", "7.28"), r("PaCO2", "40"), r("Bicarbonate", "18")])[0]!.value).toBe("7.28");
  });
  it("Severinghaus: PaO₂ follows SpO₂ along the curve", () => {
    expect(Math.round(severinghaus(60))).toBe(91);
    expect(Math.round(pao2ForSaturation(80))).toBeGreaterThanOrEqual(44);
    expect(Math.round(pao2ForSaturation(80))).toBeLessThanOrEqual(50);
    const ctx = { weightKg: 60, fluids: [], redCellUnits: 0, co2Retained: 0, age: 40, sex: "Male", spo2Base: 88, spo2Now: 80 };
    expect(Number(followLabs([r("pO₂", "56", "80–100", "mmHg")], ctx)[0]!.value)).toBeLessThan(50);
  });
  it("too much fluid in someone already hypoxic drops the saturation further, and the film follows", async () => {
    const def = C("em-adhf");
    const { hidden, state } = await converse(def, ["3000 mL 0.9% NaCl IV rapid bolus", "yes", "check vitals", "chest xray pa"]);
    expect(parseFloat(hidden.vitals.spo2.value)).toBeLessThan(88);
    const film = [...state.investigations].reverse().find((i) => /x-?ray/i.test(i.name))!;
    expect(film.report).toMatch(/Kerley B/);
  });
  it("isotretinoin for acne shows at the visit and on the skin, with one consistent story", async () => {
    const def = ALL_CASES.find((c) => c.id.startsWith("derm-acne"))!;
    const { state } = await converse(def, ["Isotroin 40mg PO OD long term", "Follow up after 6 weeks", "examine the skin"]);
    const text = said(state);
    expect(text).toMatch(/spots are getting better/);
    expect(text).toMatch(/40% fewer/);
    expect(text).not.toMatch(/After 6 months/);
    expect(text).not.toMatch(/It's worse/);
  });
  it("a vagal manoeuvre doesn't always work, replays the same, and a failed one changes nothing", async () => {
    const base = ALL_CASES.find((c) => c.track === "emergency" && c.patient.age >= 18)!;
    const results = await Promise.all(Array.from({ length: 40 }, async (_, k) => {
      const def = { ...base, id: `svt-${k}`, hazards: [], therapeutics: [{ id: "valsalva", kind: "procedure", label: "Valsalva manoeuvre", match: ["valsalva"], appropriateness: "ideal" }, ...base.therapeutics], onResponse: { vitals: [{ key: "hr", value: "78" }], ecgAfter: "Normal sinus rhythm." }, rubric: { ...base.rubric, definitiveTreatment: { ids: ["valsalva"], byMinute: 30, label: "Stop the rhythm" } } } as typeof base;
      return (await converse(def, ["valsalva"])).hidden.vagalConverted === true;
    }));
    const worked = results.filter(Boolean).length;
    expect(worked).toBeGreaterThan(2);
    expect(worked).toBeLessThan(22);
  });
  it("a pending lab shows no invented normals, and doesn't hide what the course already shows", () => {
    const def = ALL_CASES.find((c) => c.id.startsWith("derm-acne"))!;
    const hidden = createHiddenState(def);
    const order = (raw: string, targetId: string, generated?: Record<string, string>) => runTurn(def, hidden, { id: raw, at: hidden.clock, raw, intents: [{ kind: "investigation", targetId, phrase: raw, matched: true }], generated });
    const busy = { "lab:lipid": JSON.stringify({ report: LAB_PENDING }) };
    order("lipid profile", "lipid", busy);
    const first = hidden.investigations.find((i) => i.defId === "lipid")!;
    expect(first.result.report).toBe(LAB_PENDING);
    expect(first.result.rows ?? []).toEqual([]);
    // Ordered again, it runs again rather than showing the same pending.
    order("lipid profile again", "lipid");
    expect(hidden.investigations.filter((i) => i.defId === "lipid").length).toBe(2);
  });

  it("a tablet's daily ceiling isn't a rate", () => {
    const base = ALL_CASES.find((c) => c.track === "opd" && c.patient.age >= 18)!;
    const fx = runTurn(base, createHiddenState(base), { id: "a", at: 0, raw: "x", intents: [{ kind: "drug", targetId: "paracetamol", phrase: "paracetamol 1 g", matched: true, payload: { mode: "given", amount: 1, unit: "g", route: "PO", overMin: 1440, dose: "1 g" } }] });
    expect(fx.flatMap((e) => (e.type === "message" ? [e.text] : [])).join(" ")).not.toMatch(/about 1 day/);
  });

  it("a test the lab couldn't report is pending, never a false normal", async () => {
    const base = ALL_CASES.find((c) => c.track === "opd" && c.patient.age >= 18)!;
    const text = said((await converse(base, ["anti ccp antibodies"])).state);
    expect(text).not.toMatch(/Within normal limits/);
    expect(LAB_PENDING).toMatch(/Pending/);
  });
});

describe("orders that take time, and the organs together", () => {
  const rows = (state: { investigations: readonly { name: string; rows?: readonly { analyte: string; value: string }[] }[] }, re: RegExp) => [...state.investigations].reverse().find((i) => re.test(i.name))?.rows ?? [];
  const val = (r: readonly { analyte: string; value: string }[], re: RegExp) => Number(r.find((x) => re.test(x.analyte))?.value);
  const stable = () => ALL_CASES.find((c) => c.track === "opd" && c.patient.age >= 18)!;
  const adhf = () => C("em-adhf");
  const acne = () => ALL_CASES.find((c) => c.id.startsWith("derm-acne"))!;

  it("NS 500 mL in 20 hours: 20 hours pass in that one reply, losses counted, no pulmonary oedema", async () => {
    const { hidden, state } = await converse(stable(), ["NS IV 500 ml in 20 hours"]);
    expect(hidden.clock).toBeGreaterThanOrEqual(1200);
    expect(hidden.hazards.some((h) => h.id.startsWith("fluid-"))).toBe(false);
    const text = said(state);
    expect(text).toMatch(/\[\+20 h elapsed — .*infusion completed\]/);
    expect(text).toMatch(/Over 20 h: in 500 mL, urine [\d,]+ mL, insensible [\d,]+ mL\. Net −/);
    expect(text).not.toMatch(/fluids have gone in|flood/);
  });

  it("a rate gives the time: 1 L at 125 mL/h is 8 hours", async () => {
    const { hidden, state } = await converse(stable(), ["NS IV 1000 ml at 125 ml/hr"]);
    expect(hidden.clock).toBeGreaterThanOrEqual(480);
    expect(said(state)).toMatch(/\+8 h elapsed/);
  });

  it("3 L in 30 min in heart failure floods the lungs; furosemide then clears them, at its peak, in one reply", async () => {
    const first = await converse(adhf(), ["NS IV 3000 ml over 30 mins", "yes", "ABG"]);
    const spo2After = parseFloat(first.hidden.vitals.spo2.value);
    expect(spo2After).toBeLessThan(88);
    const flooded = rows(first.state, /abg/i);
    const second = await converse(adhf(), ["NS IV 3000 ml over 30 mins", "yes", "ABG", "Furosemide 80 mg IV", "repeat ABG", "examine the chest"]);
    const text = said(second.state);
    expect(text).toMatch(/peak effect of IV furosemide/);
    expect(text).toMatch(/urine [\d,]+ mL/);
    const urine = Number(text.match(/Over \d+ min: urine ([\d,]+) mL/)?.[1]?.replace(",", ""));
    expect(urine).toBeGreaterThanOrEqual(600);
    expect(val(rows(second.state, /abg/i), /^p\s*o/i) >= val(flooded, /^p\s*o/i)).toBe(true);
    expect(parseFloat(second.hidden.vitals.spo2.value)).toBeGreaterThanOrEqual(spo2After);
  });

  it("Isotroin for 8 weeks: one reply reports the 8 weeks, about 75% clearer, cheilitis, and the labs follow", async () => {
    const { hidden, state } = await converse(acne(), ["Isotroin 40mg PO OD for 8 weeks", "LFT", "Lipid Profile"]);
    expect(hidden.clock).toBeGreaterThanOrEqual(8 * 10080);
    const text = said(state);
    expect(text).toMatch(/\+8 weeks elapsed/);
    expect(text).toMatch(/75% fewer/);
    expect(text).toMatch(/cheilitis/i);
    expect(val(rows(state, /lipid/i), /triglyceride/i)).toBeGreaterThan(150);
    expect(val(rows(state, /lft|liver/i), /alt/i)).toBeGreaterThan(45);
  });

  it("the ABG and oxygen always agree, across a whole messy case", async () => {
    const { state } = await converse(adhf(), ["ABG", "oxygen 15 l non rebreather", "ABG", "NS IV 3000 ml over 30 mins", "yes", "repeat ABG", "Furosemide 80 mg IV", "repeat ABG"]);
    const gases = state.investigations.filter((i) => /abg/i.test(i.name));
    expect(gases.length).toBeGreaterThanOrEqual(1);
    for (const g of gases) {
      const r = g.rows ?? [];
      const [ph, h, p, o] = [val(r, /^ph$/i), val(r, /^hco/i), val(r, /^p\s*co/i), val(r, /^p\s*o/i)];
      expect(Math.abs(ph - expectedPH(h, p))).toBeLessThanOrEqual(0.03);
      expect(o).toBeLessThan(alveolarPO2(85, p));
    }
    expect(oxygenCeiling([{ analyte: "pO₂", value: "300", flag: "normal" }, { analyte: "pCO₂", value: "40", flag: "normal" }], 21)[0]!.value).toBe("94");
  });

  it("potassium follows pH and the drugs; the ECG follows potassium", () => {
    const ctx = { weightKg: 60, fluids: [], redCellUnits: 0, co2Retained: 0, age: 40, sex: "Male" };
    const r = (analyte: string, value: string) => ({ analyte, value, flag: "normal" as const });
    const base = [r("Potassium", "4.0"), r("HCO₃⁻", "24"), r("pCO₂", "40")];
    expect(Number(followLabs(base, { ...ctx, potassiumShift: -1 })[0]!.value)).toBe(3);
    const shocked = followLabs([...base, r("Lactate", "1.0"), r("Creatinine", "1.0")], { ...ctx, shockMinutes: 240 });
    expect(val(shocked, /lactate/i)).toBeGreaterThan(6);
    expect(val(shocked, /^hco/i)).toBeLessThan(20);
    expect(val(shocked, /^p/i)).toBeLessThan(40);
    expect(val(shocked, /potassium/i)).toBeGreaterThan(4);
    expect(val(shocked, /creatinine/i)).toBeGreaterThan(1.2);
    const after = followLabs([...base, r("Lactate", "1.0")], { ...ctx, shockMinutes: 240, hoursSinceShock: 8 });
    expect(val(after, /lactate/i)).toBeLessThan(val(shocked, /lactate/i));
  });

  it("naloxone wears off before a large opioid does, unless repeated", async () => {
    const em = ALL_CASES.find((c) => c.track === "emergency" && c.patient.age >= 18)!;
    const once = await converse(em, ["morphine 50 mg iv", "yes", "naloxone 0.4 mg iv", "wait 2 hours"]);
    expect(said(once.state)).toMatch(/naloxone has worn off/);
    const again = await converse(em, ["morphine 50 mg iv", "yes", "naloxone 0.4 mg iv", "wait 60 minutes", "naloxone 0.4 mg iv", "wait 30 minutes"]);
    expect(said(again.state)).not.toMatch(/naloxone has worn off/);
  });

  it("insulin in a normal sugar without dextrose brings hypoglycaemia", async () => {
    const { hidden } = await converse(stable(), ["insulin regular 10 units iv", "yes", "wait 60 minutes"]);
    expect(hidden.hazards.some((h) => /hypoglyc/i.test(h.id))).toBe(true);
  });

  it("positive pressure on an undrained pneumothorax brings tension; a drain prevents it", async () => {
    const base = ALL_CASES.find((c) => c.track === "emergency" && c.patient.age >= 18)!;
    const ptx = { ...base, truth: { ...base.truth, diagnosis: "Spontaneous pneumothorax" }, hazards: [], rubric: { ...base.rubric, definitiveTreatment: undefined } } as typeof base;
    const hurt = await converse(ptx, ["bipap", "yes", "wait 5 minutes"]);
    expect(hurt.hidden.hazards.some((h) => h.id === "tension-pneumothorax")).toBe(true);
    const safe = await converse(ptx, ["needle decompression", "bipap", "yes", "wait 5 minutes"]);
    expect(safe.hidden.hazards.some((h) => h.id === "tension-pneumothorax")).toBe(false);
  });
});

describe("a timed order interrupted", () => {
  it("doesn't claim to have completed, and counts only what ran in", async () => {
    const def = C("em-adhf");
    const text = said((await converse(def, ["NS 5 litres over 5 hours", "yes"])).state);
    expect(text).toMatch(/infusion still running: something has changed/);
    expect(text).not.toMatch(/infusion completed/);
  });
});

describe("a course of any length, in any case", () => {
  const pick = (p: string) => ALL_CASES.find((c) => c.id.startsWith(p))!;
  const lastWords = (state: { messages: readonly { role: string; text: string }[] }) => state.messages.filter((m) => m.role === "patient" || m.role === "attendant").at(-1)?.text ?? "";

  for (const [order, minutes] of [["doxycycline 100 mg BD for 3 days", 3 * 1440], ["doxycycline 100 mg BD for 2 weeks", 2 * 10080], ["doxycycline 100 mg BD for 3 months", 3 * 43200], ["doxycycline 100 mg BD for 2 years", 2 * 525600]] as const) {
    it(`"${order}": that time passes, and the patient says how it went, in one reply`, async () => {
      const def = pick("derm-acne");
      const opening = lastWords((await converse(def, [])).state);
      const { hidden, state } = await converse(def, [order]);
      expect(hidden.clock).toBeGreaterThanOrEqual(minutes);
      expect(said(state)).toMatch(/elapsed — doxycycline course completed/);
      expect(lastWords(state)).not.toBe(opening);
    });
  }

  it("in an emergency case and on the phone too", async () => {
    for (const p of ["em-adhf", "ph-acs"]) {
      const { state } = await converse(pick(p), ["aspirin 75 mg OD for 5 days"]);
      expect(said(state)).toMatch(/course/);
    }
  });

  it("if a complication stops it early, it doesn't claim the whole course", async () => {
    const { state } = await converse(pick("id-dengue"), ["Paracetamol 500 mg TDS for 8 weeks"]);
    const text = said(state);
    expect(text).toMatch(/of the 8 weeks paracetamol course — something has happened/);
    expect(text).not.toMatch(/course completed/);
  });

  it("the visit afterwards doesn't repeat what they've just said", async () => {
    const { state } = await converse(pick("derm-acne"), ["doxycycline 100 mg BD for 2 weeks", "follow up in 2 weeks"]);
    const lines = state.messages.filter((m) => m.role === "patient").map((m) => m.text);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it("no course length means no jump", async () => {
    const { hidden } = await converse(pick("derm-acne"), ["doxycycline 100 mg BD long term"]);
    expect(hidden.clock).toBeLessThan(1440);
  });
});
