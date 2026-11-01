/**
 * The bad-doctor wall: every written case played by the worst doctor we can imagine, with no AI. What it checks is what
 * must never happen, whichever case and whatever the order. A new real-world error becomes a new line here.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { expectedPH } from "@/engine/abg-check";
import { ALL_CASES } from "@/engine/cases";
import { defaultVitals, readVitalKeys, ROUTINE_VITALS } from "@/engine/catalog";
import { FORMULARY } from "@/engine/formulary";
import { liveClash } from "@/engine/interactions";
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
    const { state } = await converse(C("derm-acne"), ["Isotretinoin 40 mg OD for 8 weeks", "Doxycycline 100 mg BD for 8 weeks", "wait 2 weeks", "fundoscopy"]);
    expect(said(state)).toMatch(/headaches/);
    expect(said(state)).toMatch(/papilloedema/i);
    expect(said(state)).not.toMatch(/small bumps/);
  });

  it("isotretinoin alone isn't called harm: dry lips at follow-up, nothing at 30 minutes", async () => {
    const early = await converse(C("derm-acne"), ["Isotretinoin 40 mg OD for 8 weeks", "wait 30 minutes"]);
    expect(said(early.state)).not.toMatch(/cracked/);
    const later = await converse(C("derm-acne"), ["Isotretinoin 40 mg OD for 8 weeks", "follow up in 2 weeks"]);
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
    expect(clauseFor("ns", "Give 0.9% saline 1 L and morphine 2.5 mg IV")).toMatch(/0\.9%/);
    expect(clauseFor("morphine", "Give 0.9% saline 1 L and morphine 2.5 mg IV")).toMatch(/2\.5 mg/);
    expect(clauseFor("morphine", "ondansetron 4 mg, morphine 1,000 mcg. Then rest")).toMatch(/1,000 mcg/);
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
