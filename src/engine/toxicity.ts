/**
 * Toxicity — what happens when an order is far beyond any usual dose or rate.
 *
 * Every order is carried out as given; these templates make the patient live
 * with it, in any case, without per-case authoring: ten litres run in over a
 * minute, a potassium push, IV adrenaline to a patient with a pulse, thirty
 * units of insulin as a bolus, ten times the dose of anything. Each plays out
 * in stages the player sees (the nurse, the patient, the monitor), can be
 * rescued in time, and is reviewed in the debrief.
 */

import { fluidTier } from "./fluids";
import type { GlobalHazardTemplate } from "./physiology";

/** Covered by a specific template (or not toxic in this sense) — the generic overdose templates leave these alone. */
const SPECIFIC = new Set(["fluid", "crystalloid", "colloid", "blood-product", "insulin", "opioid", "benzodiazepine", "beta-blocker", "ccb", "antiarrhythmic", "vasopressor", "glucose", "vaccine"]);
const specific = (classes: readonly string[], id: string) => classes.some((c) => SPECIFIC.has(c)) || id === "potassium-chloride" || id === "methotrexate" || id === "table-salt";

const fluidFlood: GlobalHazardTemplate = {
  id: "fluid-flood",
  applies: () => true,
  // Well beyond the deficit and what the kidneys clear (fluids.ts) — sooner in a failing heart or sick lungs.
  triggers: fluidTier(2),
  build: () => ({
    id: "fluid-flood",
    label: "Pulmonary oedema from a massive IV fluid load",
    stages: [
      {
        afterMin: 8, status: "deteriorating",
        vitals: [{ key: "rr", value: "28" }, { key: "spo2", value: "91" }, { key: "hr", value: "112" }, { key: "bp", value: "164/96" }],
        observation: { role: "nurse", text: "Doctor, the patient is getting breathless — the fluids have gone in very fast." },
        examFindings: { rs: "Fine end-inspiratory crepitations at both bases, rising.", jvp: "JVP raised to the angle of the jaw.", general: "Puffy face, pitting oedema of both legs." },
        patientSays: "My chest feels heavy… I can't lie flat.",
      },
      {
        afterMin: 25, status: "critical",
        vitals: [{ key: "rr", value: "34" }, { key: "spo2", value: "84" }, { key: "hr", value: "126" }, { key: "bp", value: "172/100" }],
        observation: { role: "nurse", text: "Pink frothy sputum — the saturation keeps dropping." },
        examFindings: { rs: "Coarse crepitations up to both apices." },
        patientSays: "(Gasping, too breathless to talk.)",
      },
      {
        afterMin: 50, status: "critical",
        vitals: [{ key: "rr", value: "38" }, { key: "spo2", value: "74" }, { key: "hr", value: "134" }, { key: "bp", value: "88/52" }, { key: "gcs", value: "10" }],
        observation: { role: "nurse", text: "BP is falling now and the patient is drowsy." },
        patientSays: "(No meaningful response.)",
      },
      {
        afterMin: 75, status: "deceased",
        vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }, { key: "spo2", value: "0" }, { key: "rr", value: "0" }, { key: "gcs", value: "3" }],
        observation: { role: "nurse", text: "Bradycardia, then no pulse. The patient has arrested." },
      },
    ],
    rescue: [["drug:furosemide", "drug:torsemide"], ["measure:oxygen", "measure:niv", "measure:intubation"]],
    fullRecoveryWindowMin: 25,
    lastRescueMin: 60,
    recovery: [
      { afterMin: 20, status: "guarded", vitals: [{ key: "rr", value: "24" }, { key: "spo2", value: "93" }, { key: "hr", value: "108" }, { key: "bp", value: "146/88" }], patientSays: "Breathing is a little easier.", examFindings: { rs: "Crepitations at both bases only." } },
      { afterMin: 80, status: "improving", vitals: [{ key: "rr", value: "19" }, { key: "spo2", value: "96" }, { key: "hr", value: "92" }, { key: "bp", value: "134/80" }], patientSays: "Much better — I've passed a lot of urine.", examFindings: { rs: "Few basal crepitations." } },
    ],
    review: {
      cause: "IV fluid was given in a volume and at a rate the circulation could not hold — far beyond any resuscitation target.",
      whyItCausedHarm: "Rapid volume loading raises left atrial and pulmonary capillary pressure faster than the lymphatics can clear the interstitium: fluid floods the alveoli (hydrostatic pulmonary oedema), with shunt and hypoxaemia, and dilution of the blood's sodium and haemoglobin.",
      earliestRescueWindow: "At the order: resuscitation fluid goes in as 250–500 mL boluses (20–30 mL/kg in shock), reassessing perfusion, lung bases and JVP after each.",
      correctRescueSequence: [
        "Stop all IV fluids",
        "Sit the patient upright; oxygen to SpO₂ 94–98%, CPAP/NIV early",
        "IV furosemide 40–80 mg",
        "GTN if systolic BP > 110 mmHg",
        "Catheterise; strict input–output; repeat electrolytes and ABG",
        "ICU review if not improving within the hour",
      ],
      lastRealisticRescueWindow: "Within the first hour, before hypotension and drowsiness — after that, intubation is likely and the outlook falls sharply.",
    },
  }),
};

const fluidCatastrophe: GlobalHazardTemplate = {
  id: "fluid-catastrophe",
  applies: () => true,
  triggers: fluidTier(3),
  build: () => ({
    id: "fluid-catastrophe",
    label: "Catastrophic IV fluid overload",
    stages: [
      {
        afterMin: 1, status: "critical",
        vitals: [{ key: "rr", value: "38" }, { key: "spo2", value: "80" }, { key: "hr", value: "142" }, { key: "bp", value: "196/118" }],
        observation: { role: "nurse", text: "Doctor! The fluid is pouring in — the patient is suddenly gasping, frothing at the mouth and swelling up." },
        examFindings: { general: "Gross oedema of face and limbs; pink frothy sputum.", rs: "Coarse crepitations throughout both lungs.", jvp: "Neck veins grossly distended." },
        patientSays: "(Gasping.) Can't… breathe…",
      },
      {
        afterMin: 3, status: "critical",
        vitals: [{ key: "rr", value: "44" }, { key: "spo2", value: "62" }, { key: "hr", value: "150" }, { key: "bp", value: "82/40" }, { key: "gcs", value: "7" }],
        observation: { role: "nurse", text: "Saturation in the 60s and the BP is crashing — the patient is going grey and unresponsive." },
        patientSays: "(Unresponsive.)",
      },
      {
        afterMin: 6, status: "deceased",
        vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }, { key: "spo2", value: "0" }, { key: "rr", value: "0" }, { key: "gcs", value: "3" }],
        observation: { role: "nurse", text: "Bradycardia, then asystole. No pulse." },
      },
    ],
    rescue: [["drug:furosemide"], ["measure:intubation"]],
    fullRecoveryWindowMin: 2,
    lastRescueMin: 4,
    recovery: [
      { afterMin: 30, status: "critical", vitals: [{ key: "spo2", value: "88" }, { key: "hr", value: "124" }, { key: "bp", value: "102/64" }], patientSays: "(Sedated and ventilated.)" },
      { afterMin: 240, status: "guarded", vitals: [{ key: "spo2", value: "94" }, { key: "hr", value: "104" }, { key: "bp", value: "118/72" }] },
    ],
    review: {
      cause: "A volume of IV fluid no circulation can hold was run in within minutes.",
      whyItCausedHarm: "Massive, near-instant volume loading overwhelms the heart and lungs: acute pulmonary oedema, right-heart failure, and severe dilution of sodium and haemoglobin — cardiac arrest follows within minutes.",
      earliestRescueWindow: "At the order: confirm the volume and the rate. Resuscitation fluid is given as 250–500 mL boluses with reassessment after each.",
      correctRescueSequence: [
        "Stop the infusion at once",
        "Airway: high-flow oxygen, early intubation with PEEP",
        "IV furosemide; consider ultrafiltration or dialysis",
        "Cardiac arrest: ALS",
        "ICU: correct sodium and haemodilution slowly",
      ],
      lastRealisticRescueWindow: "Only the first few minutes — once the saturation is in the 60s with hypotension, arrest follows.",
    },
  }),
};

/** Severe hypoglycaemia after an insulin overdose — faster from a vein than under the skin. */
function insulinOverdose(route: "iv" | "sc"): GlobalHazardTemplate {
  const t = route === "iv" ? [12, 25, 40, 120] : [40, 80, 120, 240];
  const id = `insulin-overdose-${route}`;
  return {
    id,
    applies: () => true,
    triggers: (o) => o.drug.classes.includes("insulin") && (o.mode === "given" || o.mode === "prescribed") && (o.multiple ?? 1) >= (route === "iv" ? 4 : 6) && (route === "iv" ? o.route === "IV" : o.route !== "IV"),
    build: () => ({
      id,
      label: "Severe hypoglycaemia from an insulin overdose",
      prescribedOnsetMin: 60,
      stages: [
        {
          afterMin: t[0]!, status: "deteriorating",
          vitals: [{ key: "rbs", value: "54" }, { key: "hr", value: "112" }, { key: "bp", value: "142/88" }],
          observation: { role: "nurse", text: "Doctor, the patient is sweating heavily and shaking." },
          examFindings: { general: "Pale, sweaty and tremulous." },
          patientSays: "I feel shaky and strange… my heart is pounding.",
        },
        {
          afterMin: t[1]!, status: "critical",
          vitals: [{ key: "rbs", value: "32" }, { key: "gcs", value: "12" }, { key: "hr", value: "118" }],
          observation: { role: "nurse", text: "Now confused and not making sense." },
          patientSays: "(Confused, slurred speech.)",
        },
        {
          afterMin: t[2]!, status: "critical",
          vitals: [{ key: "rbs", value: "21" }, { key: "gcs", value: "7" }],
          observation: { role: "nurse", text: "Doctor, the patient is having a seizure!" },
          patientSays: "(Convulsing, then unresponsive.)",
        },
        {
          afterMin: t[3]!, status: "deceased",
          vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }, { key: "spo2", value: "0" }, { key: "rr", value: "0" }, { key: "gcs", value: "3" }],
          observation: { role: "nurse", text: "No pulse — the patient has arrested." },
        },
      ],
      rescue: [["drug:dextrose-25", "drug:d10", "drug:glucagon", "measure:oral-glucose"]],
      fullRecoveryWindowMin: t[1]! + 5,
      lastRescueMin: t[3]! - 20,
      recovery: [
        { afterMin: 5, status: "improving", vitals: [{ key: "rbs", value: "142" }, { key: "gcs", value: "15" }, { key: "hr", value: "96" }], patientSays: "I feel better… what happened?" },
        { afterMin: 60, status: "improving", vitals: [{ key: "rbs", value: "118" }], patientSays: "I'm fine now, doctor." },
      ],
      review: {
        cause: "Insulin was given at many times the usual dose.",
        whyItCausedHarm: "Insulin drives glucose into cells and suppresses hepatic glucose output; an overdose drops blood glucose below what the brain can run on (neuroglycopenia: confusion, seizures, coma). It also shifts potassium into cells. Long-acting insulin keeps acting for a day.",
        earliestRescueWindow: "At the order: check the dose and units — in DKA, insulin is an infusion of 0.1 unit/kg/hour, with glucose checked hourly.",
        correctRescueSequence: [
          "Check capillary glucose at once",
          "IV glucose: 25% dextrose 100 mL (or 10% 150–200 mL); IM glucagon 1 mg if there's no IV access",
          "Then a 10% dextrose infusion; glucose every 15–30 minutes",
          "Check potassium; replace as needed",
          "Observe for at least the insulin's duration of action",
        ],
        lastRealisticRescueWindow: "Before prolonged coma or repeated seizures — brain injury follows sustained neuroglycopenia.",
      },
    }),
  };
}

const potassiumBolus: GlobalHazardTemplate = {
  id: "potassium-bolus",
  applies: () => true,
  triggers: (o) => o.drug.id === "potassium-chloride" && o.route === "IV" && o.mode === "given" && ((o.overMin !== undefined && o.overMin < 10) || (o.multiple ?? 1) >= 4),
  build: () => ({
    id: "potassium-bolus",
    label: "Cardiac arrest from rapid IV potassium",
    stages: [
      {
        afterMin: 1, status: "critical",
        vitals: [{ key: "hr", value: "38" }, { key: "bp", value: "64/34" }, { key: "gcs", value: "12" }],
        observation: { role: "nurse", text: "Doctor — wide, bizarre complexes on the monitor and the pulse is slowing!" },
        investigations: { ecg: { report: "Tall peaked T waves, no P waves, QRS widened to 0.20 s — sine-wave pattern." } },
        patientSays: "(Clutches the chest, then slumps.)",
      },
      {
        afterMin: 3, status: "deceased",
        vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }, { key: "spo2", value: "0" }, { key: "rr", value: "0" }, { key: "gcs", value: "3" }],
        observation: { role: "nurse", text: "Ventricular fibrillation — no pulse." },
      },
    ],
    rescue: [["drug:calcium-gluconate"]],
    fullRecoveryWindowMin: 1,
    lastRescueMin: 2,
    recovery: [
      { afterMin: 10, status: "guarded", vitals: [{ key: "hr", value: "64" }, { key: "bp", value: "98/62" }, { key: "gcs", value: "15" }], patientSays: "My chest felt very strange…" },
      { afterMin: 60, status: "improving", vitals: [{ key: "hr", value: "80" }, { key: "bp", value: "116/72" }] },
    ],
    review: {
      cause: "Potassium chloride was given as a fast IV push (or a very large dose at once).",
      whyItCausedHarm: "A bolus of potassium reaches the heart undiluted: the resting membrane potential rises, conduction slows (peaked T, lost P waves, widening QRS, sine wave) and the heart stops in VF or asystole. IV potassium is never given as a push.",
      earliestRescueWindow: "At the order: potassium is diluted and infused — usually no faster than 10 mmol/hour on a ward (20 mmol/hour with cardiac monitoring), never as a bolus.",
      correctRescueSequence: [
        "Stop the infusion",
        "10% calcium gluconate 30 mL IV over 5–10 minutes — protects the heart within minutes",
        "Insulin–dextrose (10 units with 25 g glucose) and nebulised salbutamol to shift potassium into cells",
        "Cardiac arrest: ALS; continue calcium",
        "Repeat potassium and continuous ECG",
      ],
      lastRealisticRescueWindow: "Seconds to a couple of minutes — the arrhythmia comes almost at once.",
    },
  }),
};

const adrenalineBolus: GlobalHazardTemplate = {
  id: "adrenaline-bolus",
  applies: () => true,
  triggers: (o, _p, snap) => o.drug.id === "adrenaline" && o.mode === "given" && !snap.arrested && ((o.route === "IV" && (o.multiple ?? 1) >= 0.2) || (o.multiple ?? 1) >= 4),
  build: () => ({
    id: "adrenaline-bolus",
    label: "Hypertensive crisis and ventricular tachycardia from adrenaline",
    stages: [
      {
        afterMin: 1, status: "critical",
        vitals: [{ key: "hr", value: "166" }, { key: "bp", value: "236/130" }, { key: "rr", value: "28" }],
        observation: { role: "nurse", text: "Doctor! The BP is over 230 and the heart rate is shooting up." },
        patientSays: "My head is bursting… my chest is pounding!",
      },
      {
        afterMin: 3, status: "critical",
        vitals: [{ key: "hr", value: "190" }, { key: "bp", value: "92/58" }, { key: "gcs", value: "13" }],
        observation: { role: "nurse", text: "Broad-complex tachycardia on the monitor!" },
        investigations: { ecg: { report: "Regular broad-complex tachycardia at 190/min — ventricular tachycardia." } },
        patientSays: "(Pale, sweaty, barely answering.)",
      },
      {
        afterMin: 12, status: "deceased",
        vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }, { key: "spo2", value: "0" }, { key: "rr", value: "0" }, { key: "gcs", value: "3" }],
        observation: { role: "nurse", text: "The VT has turned into ventricular fibrillation — no pulse." },
      },
    ],
    rescue: [["measure:defib", "drug:amiodarone"]],
    fullRecoveryWindowMin: 8,
    lastRescueMin: 11,
    recovery: [
      { afterMin: 10, status: "guarded", vitals: [{ key: "hr", value: "112" }, { key: "bp", value: "152/92" }, { key: "gcs", value: "15" }], patientSays: "My heart is still racing a bit…" },
      { afterMin: 40, status: "improving", vitals: [{ key: "hr", value: "92" }, { key: "bp", value: "132/80" }], patientSays: "I feel calmer now." },
    ],
    review: {
      cause: "Adrenaline was given as an IV bolus to a patient with a pulse (or at many times the usual dose).",
      whyItCausedHarm: "IV adrenaline reaches the heart and vessels at once: intense alpha- and beta-stimulation → hypertensive crisis, tachyarrhythmia and myocardial ischaemia; VT, VF and stroke can follow.",
      earliestRescueWindow: "At the order: in anaphylaxis, adrenaline is 0.5 mg IM (1 mg/mL) into the outer thigh; 1 mg IV is for cardiac arrest, and IV infusions are titrated by experienced hands.",
      correctRescueSequence: [
        "Give no more adrenaline",
        "Continuous ECG; synchronised cardioversion for unstable VT with a pulse; defibrillate pulseless VT/VF",
        "Amiodarone 300 mg IV for VT",
        "If severe hypertension persists, a short-acting vasodilator (e.g. GTN)",
        "12-lead ECG and troponin — exclude infarction",
      ],
      lastRealisticRescueWindow: "Minutes — VT degenerates into VF quickly.",
    },
  }),
};

const sedativeOverdose: GlobalHazardTemplate = {
  id: "sedative-overdose",
  applies: () => true,
  triggers: (o) => o.drug.classes.includes("benzodiazepine") && o.mode === "given" && ["IV", "IM"].includes(o.route) && (o.multiple ?? 1) >= 4,
  build: () => ({
    id: "sedative-overdose",
    label: "Respiratory arrest from a sedative overdose",
    stages: [
      {
        afterMin: 3, status: "deteriorating",
        vitals: [{ key: "gcs", value: "10" }, { key: "rr", value: "9" }, { key: "spo2", value: "91" }],
        observation: { role: "nurse", text: "Doctor, the patient is very drowsy and breathing slowly." },
        patientSays: "(Mumbles, eyes closed.)",
      },
      {
        afterMin: 8, status: "critical",
        vitals: [{ key: "gcs", value: "6" }, { key: "rr", value: "5" }, { key: "spo2", value: "78" }, { key: "hr", value: "58" }, { key: "bp", value: "92/56" }],
        observation: { role: "nurse", text: "Breathing is very shallow — the saturation is dropping!" },
        patientSays: "(Unrousable.)",
      },
      {
        afterMin: 20, status: "deceased",
        vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }, { key: "spo2", value: "0" }, { key: "rr", value: "0" }, { key: "gcs", value: "3" }],
        observation: { role: "nurse", text: "No breathing, no pulse — the patient has arrested." },
      },
    ],
    rescue: [["drug:flumazenil", "measure:intubation", "measure:niv"]],
    fullRecoveryWindowMin: 10,
    lastRescueMin: 18,
    recovery: [
      { afterMin: 5, status: "guarded", vitals: [{ key: "gcs", value: "13" }, { key: "rr", value: "14" }, { key: "spo2", value: "95" }] },
      { afterMin: 40, status: "improving", vitals: [{ key: "gcs", value: "15" }, { key: "rr", value: "16" }, { key: "spo2", value: "97" }], patientSays: "I feel so sleepy… what happened?" },
    ],
    review: {
      cause: "A benzodiazepine was given at several times the usual dose.",
      whyItCausedHarm: "Benzodiazepines enhance GABA-A inhibition; large IV doses depress the brainstem's drive to breathe, the airway is lost as consciousness falls, and hypoxia ends in arrest — worse with opioids or alcohol on board.",
      earliestRescueWindow: "At the order: titrate — midazolam 1–2 mg IV at a time (less in the elderly), with oxygen, monitoring and airway equipment ready.",
      correctRescueSequence: [
        "Airway: open it, high-flow oxygen, bag-mask ventilation",
        "Flumazenil 0.2 mg IV, repeated to effect (caution in seizure disorders and chronic users)",
        "Intubate if breathing doesn't recover",
        "Continuous monitoring until fully awake",
      ],
      lastRealisticRescueWindow: "Within minutes of apnoea — before hypoxic arrest.",
    },
  }),
};

const cardiodepressantOverdose: GlobalHazardTemplate = {
  id: "cardiodepressant-overdose",
  applies: () => true,
  triggers: (o) => (o.drug.classes.includes("beta-blocker") || o.drug.classes.includes("ccb") || (o.drug.classes.includes("antiarrhythmic") && o.drug.id !== "adenosine")) && (o.multiple ?? 1) >= 5,
  build: () => ({
    id: "cardiodepressant-overdose",
    label: "Bradycardia and shock from a cardiac drug overdose",
    prescribedOnsetMin: 90,
    stages: [
      {
        afterMin: 20, status: "deteriorating",
        vitals: [{ key: "hr", value: "46" }, { key: "bp", value: "84/50" }],
        observation: { role: "nurse", text: "Doctor, the pulse has dropped into the 40s and the BP is low." },
        patientSays: "I feel dizzy and faint.",
      },
      {
        afterMin: 45, status: "critical",
        vitals: [{ key: "hr", value: "34" }, { key: "bp", value: "62/34" }, { key: "gcs", value: "11" }],
        observation: { role: "nurse", text: "Pulse in the 30s, BP in the 60s — drowsy and cold." },
        patientSays: "(Barely answers.)",
      },
      {
        afterMin: 90, status: "deceased",
        vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }, { key: "spo2", value: "0" }, { key: "rr", value: "0" }, { key: "gcs", value: "3" }],
        observation: { role: "nurse", text: "Asystole — no pulse." },
      },
    ],
    rescue: [["drug:atropine", "drug:calcium-gluconate", "drug:glucagon", "drug:adrenaline", "drug:noradrenaline", "drug:dopamine"]],
    fullRecoveryWindowMin: 40,
    lastRescueMin: 80,
    recovery: [
      { afterMin: 15, status: "guarded", vitals: [{ key: "hr", value: "58" }, { key: "bp", value: "96/58" }, { key: "gcs", value: "15" }] },
      { afterMin: 90, status: "improving", vitals: [{ key: "hr", value: "70" }, { key: "bp", value: "112/70" }], patientSays: "I feel stronger now." },
    ],
    review: {
      cause: "A beta-blocker, calcium-channel blocker or antiarrhythmic was given at several times the usual dose.",
      whyItCausedHarm: "These drugs slow the sinus node and AV conduction and weaken contraction (calcium-channel blockers also dilate vessels): an overdose causes profound bradycardia, heart block and cardiogenic shock.",
      earliestRescueWindow: "At the order: check the dose against the formulary, especially when converting between oral and IV.",
      correctRescueSequence: [
        "Atropine 0.6 mg IV, repeated",
        "10% calcium gluconate (or chloride) IV",
        "Glucagon for beta-blocker overdose; high-dose insulin–dextrose therapy in severe cases",
        "Vasopressor/inotrope infusion; transcutaneous pacing if needed",
        "ICU care; poisons advice",
      ],
      lastRealisticRescueWindow: "Before refractory shock — within the first hour or so.",
    },
  }),
};

const drugToxicity: GlobalHazardTemplate = {
  id: "drug-toxicity",
  applies: () => true,
  triggers: (o) => !specific(o.drug.classes, o.drug.id) && o.route !== "TOP" && (o.multiple ?? 1) >= 10 && (o.multiple ?? 1) < 30,
  build: () => ({
    id: "drug-toxicity",
    label: "Toxicity from a massive overdose",
    prescribedOnsetMin: 120,
    stages: [
      {
        afterMin: 10, status: "deteriorating",
        vitals: [], shift: { hr: 16, rr: 4 },
        observation: { role: "nurse", text: "Doctor, the patient is vomiting and unwell since that dose." },
        patientSays: "I feel terrible… I keep throwing up.",
      },
      {
        afterMin: 40, status: "critical",
        vitals: [], shift: { hr: 12, gcs: -3, sbp: -10, dbp: -6 },
        observation: { role: "nurse", text: "Now drowsy and confused." },
        patientSays: "(Confused.)",
      },
    ],
    rescue: [["measure:stop-drug", "measure:iv-access", "measure:monitor", "measure:oxygen"]],
    fullRecoveryWindowMin: 60,
    lastRescueMin: 240,
    recovery: [
      { afterMin: 60, status: "guarded", vitals: [{ key: "hr", value: "104" }, { key: "gcs", value: "14" }], patientSays: "Still queasy…" },
      { afterMin: 180, status: "improving", vitals: [{ key: "hr", value: "90" }, { key: "gcs", value: "15" }, { key: "rr", value: "18" }], patientSays: "I feel better now." },
    ],
    review: {
      cause: "A drug was given at ten or more times the usual dose.",
      whyItCausedHarm: "Beyond its therapeutic range, almost any drug produces toxicity — here vomiting, agitation, tachycardia and confusion.",
      earliestRescueWindow: "At the order: check the dose and units against the formulary before it is given.",
      correctRescueSequence: ["Stop the drug", "ABC: oxygen, IV access, continuous monitoring", "Specific antidote where one exists; poisons advice", "Treat seizures and arrhythmias as they arise"],
      lastRealisticRescueWindow: "Within the first hours, with supportive care.",
    },
  }),
};

const drugToxicitySevere: GlobalHazardTemplate = {
  id: "drug-toxicity-severe",
  applies: () => true,
  triggers: (o) => !specific(o.drug.classes, o.drug.id) && o.route !== "TOP" && (o.multiple ?? 1) >= 30,
  build: () => ({
    id: "drug-toxicity-severe",
    label: "Life-threatening toxicity from an enormous overdose",
    prescribedOnsetMin: 120,
    stages: [
      {
        afterMin: 5, status: "deteriorating",
        vitals: [], shift: { hr: 22, rr: 6 },
        observation: { role: "nurse", text: "Doctor, the patient is vomiting, agitated and drenched in sweat." },
        patientSays: "Something's very wrong… I feel awful.",
      },
      {
        afterMin: 20, status: "critical",
        vitals: [{ key: "hr", value: "146" }, { key: "bp", value: "82/50" }, { key: "gcs", value: "7" }, { key: "spo2", value: "88" }],
        observation: { role: "nurse", text: "Seizing — and now unresponsive, with a low BP!" },
        patientSays: "(Unresponsive.)",
      },
      {
        afterMin: 45, status: "deceased",
        vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }, { key: "spo2", value: "0" }, { key: "rr", value: "0" }, { key: "gcs", value: "3" }],
        observation: { role: "nurse", text: "Ventricular fibrillation — no pulse." },
      },
    ],
    rescue: [["measure:intubation", "measure:oxygen"], ["measure:iv-access", "measure:monitor"]],
    fullRecoveryWindowMin: 15,
    lastRescueMin: 35,
    recovery: [
      { afterMin: 30, status: "critical", vitals: [{ key: "hr", value: "118" }, { key: "bp", value: "100/62" }, { key: "gcs", value: "9" }] },
      { afterMin: 240, status: "guarded", vitals: [{ key: "hr", value: "98" }, { key: "bp", value: "116/72" }, { key: "gcs", value: "14" }] },
    ],
    review: {
      cause: "A drug was given at thirty or more times the usual dose.",
      whyItCausedHarm: "At such doses most drugs cause seizures, arrhythmias and circulatory collapse.",
      earliestRescueWindow: "At the order: check the dose and units against the formulary before it is given.",
      correctRescueSequence: ["Stop the drug", "Airway and breathing: oxygen, intubation if GCS ≤ 8", "IV access, fluids, continuous ECG; treat arrhythmias", "Benzodiazepine for seizures", "Specific antidote; poisons advice; ICU"],
      lastRealisticRescueWindow: "Within half an hour — before seizures and shock become refractory.",
    },
  }),
};

/** Grams of salt in an order ("50 g", "5000 mg", "2 spoons" ≈ 6 g each). */
export const saltGrams = (o: { amount?: number; unit?: string; multiple?: number }) =>
  o.unit === "g" ? (o.amount ?? 0) : o.unit === "mg" ? (o.amount ?? 0) / 1000 : /spoon|tsp/i.test(o.unit ?? "") ? (o.amount ?? 0) * 6 : (o.multiple ?? 1);

/**
 * Salt eaten in this encounter crossing `perKg` g/kg — or, once over it, another large helping
 * (a quarter of a gram per kilo or more). A pinch more doesn't hasten anything.
 */
const saltCrosses = (perKg: number, below?: number) => (o: { drug: { id: string }; amount?: number; unit?: string; multiple?: number }, _p: unknown, snap: { salt?: { before: number; after: number; weightKg: number } }) => {
  if (o.drug.id !== "table-salt" || !snap.salt) return false;
  const { before, after, weightKg } = snap.salt;
  if (after / weightKg < perKg || (below !== undefined && after / weightKg >= below)) return false;
  return before / weightKg < perKg || saltGrams(o) / weightKg >= 0.25;
};

/** 0.2–0.5 g/kg of salt: thirsty and queasy, the sodium a little high — it passes with water. */
const saltLoad: GlobalHazardTemplate = {
  id: "salt-load",
  applies: () => true,
  triggers: saltCrosses(0.2, 0.5),
  build: (def) => {
    const kid = def.patient.age <= 12;
    const watcher = kid || def.track === "phone" ? "attendant" : "patient";
    return {
      id: "salt-load",
      label: "Salt load — mild hypernatraemia",
      stages: [
        {
          afterMin: 25, status: "guarded", vitals: [],
          observation: { role: watcher, text: watcher === "attendant" ? "Doctor, the child is very thirsty and feels like vomiting." : "I'm very thirsty, doctor… and I feel a little sick." },
          patientSays: "So thirsty… my stomach feels queasy.",
          investigations: { electrolytes: { rows: [{ analyte: "Sodium", value: "149", unit: "mEq/L", reference: "135–145", flag: "high" }] } },
        },
      ],
      rescue: [["measure:oral-fluids", "drug:d5", "drug:dextrose-25"]],
      fullRecoveryWindowMin: 720,
      lastRescueMin: 1440,
      recovery: [{ afterMin: 60, status: "stable", vitals: [], patientSays: "The thirst has settled, doctor." }],
      review: {
        cause: "Salt was ordered to be eaten — several grams of it.",
        whyItCausedHarm: "A salt load raises serum sodium; thirst and nausea follow. Below about 0.5 g/kg it settles with free water.",
        earliestRescueWindow: "At the order: salt is not a treatment given by mouth in grams.",
        correctRescueSequence: ["No more salt", "Water by mouth (or 5% dextrose IV if vomiting)", "Recheck the sodium"],
        lastRealisticRescueWindow: "Hours — mild salt loads correct easily.",
      },
    };
  },
};

/**
 * Salt poisoning: about 0.5–1 g/kg makes a child very ill and 1–3 g/kg can kill — acute
 * hypernatraemia shrinks the brain (thirst, vomiting, irritability, then seizures, coma, bleeding).
 */
const saltPoisoning: GlobalHazardTemplate = {
  id: "salt-poisoning",
  applies: () => true,
  triggers: saltCrosses(0.5),
  build: (def) => {
    const kid = def.patient.age <= 12;
    const he = def.patient.sex === "Female" ? "She" : "He";
    const watcher = kid || def.track === "phone" ? "attendant" : "patient";
    const na = (v: string, flag: "high" | "critical") => ({ rows: [{ analyte: "Sodium", value: v, unit: "mEq/L", reference: "135–145", flag }] });
    return {
      id: "salt-poisoning",
      label: "Acute salt poisoning — hypernatraemia",
      stages: [
        {
          afterMin: 15, status: "deteriorating",
          vitals: [{ key: "hr", value: kid ? "128" : "108" }, { key: "bp", value: kid ? "118/78" : "148/92" }],
          observation: { role: watcher, text: watcher === "attendant" ? `Doctor, ${he.toLowerCase()} has vomited twice and keeps asking for water!` : "I've vomited… I'm so thirsty, doctor." },
          patientSays: "I'm so thirsty… my stomach hurts.",
          investigations: { electrolytes: na("158", "high"), rft: na("158", "high") },
        },
        {
          afterMin: 60, status: "critical",
          vitals: [{ key: "hr", value: kid ? "146" : "124" }, { key: "bp", value: kid ? "126/84" : "156/96" }, { key: "temp", value: "100.8" }, { key: "gcs", value: "12" }],
          // What the family sees and says; in hospital, what anyone at the bedside sees.
          observation: watcher === "attendant" ? { role: "attendant", text: `${he}'s very irritable and confused now, and ${he.toLowerCase()}'s twitching.` } : { role: "system", text: `${he}'s irritable and confused now, and twitching.` },
          patientSays: "(Irritable, confused, crying out — muscles twitching.)",
          examFindings: { cns: "Irritable, disoriented; hyperreflexia and muscle twitching; GCS 12." },
          investigations: { electrolytes: na("176", "critical"), rft: na("176", "critical") },
        },
        {
          afterMin: 150, status: "critical",
          vitals: [{ key: "hr", value: kid ? "160" : "136" }, { key: "rr", value: "30" }, { key: "spo2", value: "90" }, { key: "gcs", value: "7" }],
          observation: watcher === "attendant" ? { role: "attendant", text: `${he}'s having a fit — ${he.toLowerCase()} isn't responding!` } : { role: "nurse", text: `Doctor, ${he.toLowerCase()}'s having a fit — not responding!` },
          patientSays: "(Generalised seizure; unresponsive.)",
          investigations: { electrolytes: na("188", "critical"), rft: na("188", "critical") },
          interrupts: true,
        },
        {
          afterMin: 300, status: "deceased",
          vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }, { key: "spo2", value: "0" }, { key: "rr", value: "0" }, { key: "gcs", value: "3" }],
          observation: { role: "system", text: "Cerebral oedema and intracranial bleeding from the sodium load — cardiorespiratory arrest." },
        },
      ],
      rescue: [["drug:d5", "drug:dextrose-25", "measure:dialysis", "measure:oral-fluids"]],
      fullRecoveryWindowMin: 60,
      lastRescueMin: 240,
      recovery: [
        { afterMin: 60, status: "guarded", vitals: [{ key: "hr", value: kid ? "112" : "98" }, { key: "gcs", value: "14" }], patientSays: "I feel a bit better… still thirsty." },
        { afterMin: 360, status: "improving", vitals: [{ key: "hr", value: kid ? "98" : "86" }, { key: "gcs", value: "15" }], patientSays: "I'm feeling better now." },
      ],
      review: {
        cause: "A large amount of salt was ordered to be eaten.",
        whyItCausedHarm: "Over about 0.5 g/kg of salt raises serum sodium within hours. Water leaves the brain cells: thirst, vomiting, irritability, then seizures, coma, and bleeding from torn bridging veins. 1–3 g/kg can be fatal, children most of all.",
        earliestRescueWindow: "At the order: salt is never given as a treatment by mouth in grams like this.",
        correctRescueSequence: [
          "Stop further salt; airway, breathing, circulation",
          "Serum sodium and osmolality urgently",
          "Free water: 5% dextrose IV (and water by mouth or NG if safe)",
          "Haemodialysis for severe acute salt poisoning (sodium over ~180, seizures)",
          "Benzodiazepine for seizures; ICU",
        ],
        lastRealisticRescueWindow: "Hours — before seizures and coma; acute salt poisoning can be corrected quickly, unlike chronic hypernatraemia.",
      },
    };
  },
};

export const TOXICITY: GlobalHazardTemplate[] = [
  saltPoisoning,
  saltLoad,
  fluidCatastrophe,
  fluidFlood,
  insulinOverdose("iv"),
  insulinOverdose("sc"),
  potassiumBolus,
  adrenalineBolus,
  sedativeOverdose,
  cardiodepressantOverdose,
  drugToxicitySevere,
  drugToxicity,
];
