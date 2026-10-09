import { describe, expect, it } from "vitest";

import type { ClinicalCaseDefinition } from "@/engine/case-definition";
import { ALL_CASES, filterCases, libraryAvailability, TUTORIAL_CASE } from "@/engine/cases";
import { phAcs } from "@/engine/cases/ph-acs";
import { formatMoney, localPrice } from "@/engine/countries";
import { simulateCase, submitDoctorAction } from "@/engine/engine";
import { CASE_LOCALES } from "@/engine/i18n/country-content";
import { localizeCase, presentState, text } from "@/engine/i18n/country";
import { levelMeta } from "@/engine/levels";

import { messagesOf, play } from "./helpers";

/** Every player-visible string in a case: what localisation must get right. */
function strings(value: unknown, key = "", out: string[] = []): string[] {
  const skip = new Set(["id", "match", "drugIds", "drugClasses", "measureIds", "concernsDrugs", "rescues", "rescue", "preventedBy", "idealTreatment", "diagnosisAccept", "diagnosisPartial", "differentials", "arms", "ifHazard", "patientBand", "ids", "spec", "rows", "vitals", "vitalsAfter", "baselineVitals", "profile", "setting", "settingAfter", "countries"]);
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, key, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) if (!skip.has(k)) strings(v, k, out);
  return out;
}

const INDIA = /\b(India|Indian|Delhi|Kota|Talwandi|Lucknow|Pune|Kanpur|Uttar Pradesh|lakh|OPD|Dolo|Combiflam|Sorbitrate|Manforce|Ecosprin|Telma|Metolar|Panderm|Ovral|Monocef|Taxim|Azee|Meftal|Electral|namkeen|papad|paratha|parathas|dal|PG|scooty|dupatta|parlour|bidis?|pegs|auto|Namaste|monsoon|HCQS|Mycept|Endoxan|Vymada|Millisrol|Clopilet|Atorva|Folitrax|Itaspor|Isotroin|Metrogyl|Emeset|Elaxim)\b|₹|call 108|\(108\)/;

const abroad = ALL_CASES.filter((c) => !c.countries || c.countries.length > 1);

describe("countries — case content", () => {
  it("every rewritten line still exists in its case", () => {
    for (const [id, byCountry] of Object.entries(CASE_LOCALES)) {
      const def = ALL_CASES.find((c) => c.id === id);
      expect(def, id).toBeDefined();
      const all = new Set(strings(def));
      for (const [country, loc] of Object.entries(byCountry)) {
        for (const key of Object.keys(loc.lines ?? {})) expect(all.has(key), `${id} ${country}: ${key.slice(0, 70)}`).toBe(true);
      }
    }
  });

  it.each(["US", "UK"] as const)("no India left in the %s cases", (country) => {
    const leaks = abroad.flatMap((def) => strings(localizeCase(def, country)).map((s) => text(s, country)).filter((s) => INDIA.test(s)).map((s) => `${def.id}: ${s}`));
    expect(leaks).toEqual([]);
    for (const def of abroad) {
      const local = localizeCase(def, country);
      expect(CASE_LOCALES[def.id]?.[country]?.patient.city, `${def.id} has a ${country} patient`).toBeTruthy();
      expect(local.patient.city).not.toMatch(/Delhi|Kota|Lucknow|Pune|Kanpur/);
    }
  });

  it("keeps the clinical machinery identical", () => {
    const us = localizeCase(phAcs, "US");
    expect(us.therapeutics.map((t) => t.id)).toEqual(phAcs.therapeutics.map((t) => t.id));
    expect(us.therapeutics.map((t) => t.match)).toEqual(phAcs.therapeutics.map((t) => t.match));
    expect(us.rubric.idealTreatment).toEqual(phAcs.rubric.idealTreatment);
    expect(us.baselineVitals).toEqual(phAcs.baselineVitals);
    expect(us.facility).toBe(levelMeta(phAcs.level, "US").label);
    expect(localizeCase(phAcs, "IN")).toBe(phAcs);
  });

  it("the snakebite case stays in India", () => {
    const ids = (country: "IN" | "US" | "UK") => filterCases({ country }).map((c) => c.id);
    expect(ids("IN")).toContain("em-viper-phc-01");
    expect(ids("US")).not.toContain("em-viper-phc-01");
    expect(ids("UK")).not.toContain("em-viper-phc-01");
    const count = (a: ReturnType<typeof libraryAvailability>) => Object.values(a.tracks).reduce((x, y) => x + (y ?? 0), 0);
    expect(count(libraryAvailability("IN")) - count(libraryAvailability("UK"))).toBe(1);
  });
});

describe("countries — units, money, names", () => {
  it("converts glucose, creatinine, haemoglobin and platelets to SI for the UK", () => {
    expect(text("Capillary blood glucose 42 mg/dL. ECG: sinus tachycardia.", "UK")).toBe("Capillary blood glucose 2.3 mmol/L. ECG: sinus tachycardia.");
    expect(text("UPCR 0.6 g/g; creatinine 1.0 mg/dL; C3 82 mg/dL; Hb 11.2 g/dL.", "UK")).toBe("UPCR 0.6 g/g; creatinine 88 µmol/L; C3 0.82 g/L; Hb 112 g/L.");
    expect(text("Fasting sugars 110–140 mg/dL.", "UK")).toBe("Fasting sugars 6.1–7.8 mmol/L.");
    expect(text("Platelets 1.1 lakh/µL and rising.", "UK")).toBe("Platelets 110 ×10⁹/L and rising.");
    expect(text("Platelets 1.1 lakh/µL and rising.", "US")).toBe("Platelets 110 ×10³/µL and rising.");
    expect(text("Fever 100.6 °F, HR 104.", "UK")).toBe("Fever 38.1 °C, HR 104.");
    expect(text("Fever 100.6 °F, HR 104.", "US")).toBe("Fever 100.6 °F, HR 104.");
  });

  it("leaves numbers alone when it can't tell what they measure", () => {
    expect(text("BP 172/108, SpO₂ 88%.", "UK")).toBe("BP 172/108, SpO₂ 88%.");
    expect(text("Haematocrit 42%.", "UK")).toBe("Haematocrit 42%.");
  });

  it("prices in local money", () => {
    expect(localPrice(150, "US")).toBe(45);
    expect(localPrice(150, "UK")).toBe(8);
    expect(formatMoney(localPrice(1200, "US"), "US")).toBe("$360");
    expect(text("A ₹150, 15-minute bedside test.", "UK")).toBe("A £8, 15-minute bedside test.");
    expect(text("Ordered CT head (₹2,500).", "IN")).toBe("Ordered CT head (₹2,500).");
  });

  it("speaks American in the USA", () => {
    expect(text("Paracetamol 650 mg TDS; pedal oedema; haemoglobin low; anaemia.", "US")).toBe("Acetaminophen 650 mg TID; pedal edema; hemoglobin low; anemia.");
    expect(text("Hypoglycaemia recognised early; colour change; 2 litres.", "US")).toBe("Hypoglycemia recognized early; color change; 2 liters.");
    expect(text("Urea 32 mg/dL", "US")).toBe("BUN 15 mg/dL");
    expect(text("Complete blood count", "UK")).toBe("Full blood count");
  });
});

describe("countries — playing a case", () => {
  it("the phone heart attack in the USA: 911, nitroglycerin, dollars", () => {
    const def = localizeCase(phAcs, "US");
    const { turns } = play(def, ["What medicines does he take?", "Call 911 now", "Chew an aspirin 325 mg"]);
    const said = turns.flatMap((t) => messagesOf(t.effects)).join("\n");
    expect(said).toContain("Viagra");
    expect(said).toContain("calling 911");
    expect(said).not.toMatch(/108|Manforce|Telma/);
  });

  it("a UK case renders SI vitals and English speech, even when Hinglish is chosen", async () => {
    const session = await simulateCase({ userId: "u-uk", caseNumber: 1, tutorial: true, lang: "hinglish", country: "UK" });
    expect(session.state.country).toBe("UK");
    expect(session.state.lang).toBe("en");
    expect(session.state.patient.city).toBe("Leeds");
    const turn = await submitDoctorAction(session.token, "Check RBS", "u-uk", "hinglish");
    expect(turn.state.vitals.rbs?.current.unit).toBe("mmol/L");
    expect(turn.state.vitals.rbs?.current.label).toBe("CBG");
    expect(Number(turn.state.vitals.rbs?.current.value)).toBeLessThan(4);
    const shout = turn.state.messages.filter((m) => m.role !== "doctor").map((m) => m.text).join("\n");
    expect(shout).not.toMatch(/mg\/dL|RBS/);
  });

  it("India is untouched", async () => {
    const session = await simulateCase({ userId: "u-in", caseNumber: 1, tutorial: true, lang: "hinglish" });
    expect(session.state.country).toBe("IN");
    expect(session.state.lang).toBe("hinglish");
    expect(session.state.patient.city).toBe(TUTORIAL_CASE.patient.city);
    expect(presentState(session.state, "IN").briefing).toBe(TUTORIAL_CASE.briefing);
  });

  it("a guest's case keeps its country after the player changes theirs", async () => {
    const session = await simulateCase({ userId: "u-x", caseNumber: 1, tutorial: true, country: "US" });
    const turn = await submitDoctorAction(session.token, "Check RBS", "u-x");
    expect(turn.state.country).toBe("US");
    expect(turn.state.vitals.rbs?.current.label).toBe("Glucose");
    expect(turn.state.vitals.rbs?.current.unit).toBe("mg/dL");
  });
});

/** Keeps the helper type-checked against the definitions it walks. */
export type _Def = ClinicalCaseDefinition;

describe("countries — a whole encounter", () => {
  const inputs = [
    "Hello", "What brings you here?", "Since when?", "Any medicines?", "Any allergies?", "Past medical history?", "Family history?",
    "Diet?", "Smoking or alcohol?", "Check vitals", "Check RBS", "General examination", "Examine the chest", "Examine the abdomen",
    "Order CBC, RFT, LFT, electrolytes, ECG, chest X-ray, urine routine, USG abdomen", "Order patch test and KOH mount",
    "Wait 60 minutes", "Give paracetamol 650 mg", "Give normal saline 500 mL IV", "Case close",
  ];

  it.each(["US", "UK"] as const)("shows no India anywhere in %s play, results or debrief", async (country) => {
    const { generateDebrief } = await import("@/engine/debrief");
    const { presentDebrief, presentEffects } = await import("@/engine/i18n/country");
    const leaks: string[] = [];
    for (const def of abroad) {
      const local = localizeCase(def, country);
      const { hidden, state, turns } = play(local, inputs);
      const shown = [
        ...strings({ ...presentState(state, country), messages: presentState(state, country).messages.filter((m) => m.role !== "doctor") }),
        ...turns.flatMap((t) => strings(presentEffects(t.effects, country).filter((e) => !(e.type === "message" && e.role === "doctor")))),
        ...(hidden.closed ? strings(presentDebrief(generateDebrief(local, hidden, state), country)) : []),
      ];
      for (const s of shown) if (INDIA.test(s)) leaks.push(`${def.id}: ${s}`);
    }
    expect([...new Set(leaks)]).toEqual([]);
  });
});
