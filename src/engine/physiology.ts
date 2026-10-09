/**
 * Physiology & safety layer.
 *
 * Global hazard templates make the "execute every order, live with the
 * consequence" rule work in every case without per-case authoring: the case
 * declares a hidden `PatientProfile`, and these templates arm themselves when
 * an order collides with it. Cases may override any template by reusing its id.
 *
 * Stages expose ONLY observable information: vitals (visible if monitored or
 * measured), what the patient/nurse says, and examination findings that the
 * player must go and elicit.
 */

import type { ClinicalCaseDefinition, HazardDefinition, PatientProfile } from "./case-definition";
import { formularyDrug, type FormularyDrug } from "./formulary";
import type { DrugRoute } from "./types";

export interface DrugOrderContext {
  drug: FormularyDrug;
  mode: "given" | "prescribed";
  route: DrugRoute;
  frequency?: string;
  amount?: number;
  unit?: string;
  volumeMl?: number;
}

export interface PhysiologySnapshot {
  /** Cumulative IV fluid volume (mL), including this order. */
  fluidMl: number;
  /** Morphine-milligram-equivalents given IV/IM in the last 60 minutes, including this order. */
  recentOpioidMme: number;
  /** Current underlying random blood sugar. */
  rbs: number;
  /** Drug ids given or prescribed so far, including this order. */
  drugIds: string[];
  age: number;
}

interface GlobalHazardTemplate {
  id: string;
  applies(profile: PatientProfile): boolean;
  triggers(order: DrugOrderContext, profile: PatientProfile, snap: PhysiologySnapshot): boolean;
  build(def: ClinicalCaseDefinition): HazardDefinition;
}

const hasClass = (drugId: string, cls: string) => formularyDrug(drugId)?.classes.includes(cls as never) ?? false;

/* -------------------------------------------------------------------------- */
/* Templates                                                                   */
/* -------------------------------------------------------------------------- */

const anaphylaxis: GlobalHazardTemplate = {
  id: "anaphylaxis",
  applies: (p) => (p.allergies?.length ?? 0) > 0,
  triggers: (o, p) => (p.allergies ?? []).some((a) => a === o.drug.id || o.drug.classes.includes(a as never)),
  build: () => ({
    id: "anaphylaxis",
    label: "Anaphylaxis",
    prescribedOnsetMin: 180,
    stages: [
      {
        afterMin: 3, status: "deteriorating",
        vitals: [{ key: "hr", value: "118" }, { key: "bp", value: "102/64" }, { key: "rr", value: "24" }, { key: "spo2", value: "94" }],
        observation: { role: "patient", text: "Doctor… my whole body has started itching. My throat feels tight." },
        examFindings: { skin: "Generalised urticarial wheals over trunk and limbs. Swelling of both lips.", rs: "Scattered expiratory wheeze bilaterally." },
        patientSays: "I can't swallow properly… everything is itching.",
      },
      {
        afterMin: 9, status: "critical",
        vitals: [{ key: "hr", value: "136" }, { key: "bp", value: "78/44" }, { key: "rr", value: "30" }, { key: "spo2", value: "88" }],
        observation: { role: "nurse", text: "Doctor, the patient is wheezing loudly and looks very unwell." },
        examFindings: { rs: "Marked bilateral wheeze. Inspiratory stridor audible.", general: "Anxious, flushed, sweating. Lips and eyelids swollen." },
        patientSays: "(Speaks in single words.) Can't… breathe.",
      },
      {
        afterMin: 24, status: "critical",
        vitals: [{ key: "hr", value: "152" }, { key: "bp", value: "60/32" }, { key: "rr", value: "34" }, { key: "spo2", value: "80" }, { key: "gcs", value: "11" }],
        observation: { role: "nurse", text: "BP barely recordable. Patient is drowsy." },
        patientSays: "(No meaningful response.)",
      },
      {
        afterMin: 40, status: "deceased",
        vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }, { key: "spo2", value: "0" }, { key: "rr", value: "0" }, { key: "gcs", value: "3" }],
        observation: { role: "nurse", text: "No palpable pulse. The patient is unresponsive." },
      },
    ],
    rescue: [["drug:adrenaline"]],
    fullRecoveryWindowMin: 12,
    lastRescueMin: 34,
    recovery: [
      { afterMin: 5, status: "guarded", vitals: [{ key: "hr", value: "108" }, { key: "bp", value: "104/66" }, { key: "rr", value: "22" }, { key: "spo2", value: "95" }], observation: { role: "patient", text: "The tightness is easing a little…" }, patientSays: "Better than before, doctor. Still itchy." },
      { afterMin: 40, status: "improving", vitals: [{ key: "hr", value: "92" }, { key: "bp", value: "116/74" }, { key: "rr", value: "18" }, { key: "spo2", value: "97" }], examFindings: { skin: "Wheals fading. Lip swelling reduced.", rs: "Air entry good. No wheeze." }, patientSays: "I can breathe normally now." },
    ],
    review: {
      cause: "A drug was given to a patient with a known allergy to it (or to its class).",
      whyItCausedHarm: "IgE-mediated mast-cell degranulation → histamine and leukotriene release → vasodilatation, capillary leak and bronchospasm → distributive shock and airway compromise within minutes.",
      earliestRescueWindow: "Before the prescription: an allergy history takes ten seconds and prevents this entirely.",
      correctRescueSequence: [
        "Stop the trigger; call for help",
        "Adrenaline 0.5 mg IM (1:1000) into the anterolateral thigh — repeat every 5 min if no response",
        "Lie flat with legs raised (sit up if breathing is the main problem); high-flow oxygen",
        "IV access; 500–1000 mL crystalloid bolus for hypotension",
        "Adjuncts only after adrenaline: chlorphenamine, hydrocortisone, salbutamol for wheeze",
        "Observe 6–12 h for a biphasic reaction; document the allergy prominently",
      ],
      lastRealisticRescueWindow: "Within roughly 30 minutes of onset. Beyond that, refractory shock and hypoxic arrest.",
    },
  }),
};

const pde5Nitrate: GlobalHazardTemplate = {
  id: "pde5-nitrate",
  applies: (p) => (p.currentDrugs ?? []).some((d) => hasClass(d, "nitrate")),
  triggers: (o) => o.drug.classes.includes("pde5"),
  build: () => ({
    id: "pde5-nitrate",
    label: "PDE-5 inhibitor with nitrate — profound hypotension",
    prescribedOnsetMin: 420,
    stages: [
      {
        afterMin: 0, status: "critical", setting: "ER", interrupts: true,
        vitals: [{ key: "bp", value: "74/42" }, { key: "hr", value: "122" }, { key: "rr", value: "22" }, { key: "spo2", value: "96" }, { key: "gcs", value: "14" }],
        observation: { role: "attendant", text: "Doctor, please help — he collapsed at home last night. He took the new tablet you gave, then had some chest heaviness and put his usual tablet under the tongue. He fainted after that." },
        examFindings: { general: "Pale, cold and clammy. Drowsy but rousable.", crt: "Capillary refill 4 s. Peripheries cold." },
        patientSays: "I feel very dizzy… everything goes dark when I lift my head.",
      },
      {
        afterMin: 35, status: "critical",
        vitals: [{ key: "bp", value: "66/38" }, { key: "hr", value: "132" }, { key: "gcs", value: "12" }],
        observation: { role: "nurse", text: "BP is still falling. He is becoming drowsy." },
        investigations: { ecg: { report: "Rate 132/min. ST depression 1.5 mm in V4–V6.", media: { spec: { kind: "ecg", rate: 132, rhythm: "sinus", morphology: { st: { V4: -1.5, V5: -1.5, V6: -1, I: -0.5, aVL: -0.5 } } }, alt: "Twelve-lead ECG at 132 per minute.", caption: "12-lead · 25 mm/s · 10 mm/mV" } } },
        patientSays: "(Mumbles.) Chest… heavy.",
      },
      {
        afterMin: 110, status: "deceased",
        vitals: [{ key: "bp", value: "0/0" }, { key: "hr", value: "0" }, { key: "gcs", value: "3" }],
        observation: { role: "nurse", text: "Ventricular fibrillation on the monitor — no pulse." },
      },
    ],
    rescue: [["drug:ns", "drug:rl"]],
    fullRecoveryWindowMin: 45,
    lastRescueMin: 100,
    recovery: [
      { afterMin: 20, status: "guarded", vitals: [{ key: "bp", value: "92/58" }, { key: "hr", value: "106" }, { key: "gcs", value: "15" }], patientSays: "A little better. Still weak." },
      { afterMin: 120, status: "improving", vitals: [{ key: "bp", value: "112/72" }, { key: "hr", value: "88" }], examFindings: { general: "Alert. Warm peripheries." }, patientSays: "I feel much more like myself." },
    ],
    review: {
      cause: "A PDE-5 inhibitor was prescribed to a man who keeps sublingual isosorbide dinitrate for chest pain.",
      whyItCausedHarm: "Nitrates raise cGMP via nitric oxide; PDE-5 inhibitors stop cGMP breakdown. Together they cause profound, sustained vasodilatation → hypotension → myocardial hypoperfusion. The interaction persists ~24 h after sildenafil and ~48 h after tadalafil.",
      earliestRescueWindow: "At prescription: ask specifically about tablets taken for chest pain — patients rarely volunteer SOS medicines.",
      correctRescueSequence: [
        "Lie flat with legs raised",
        "IV access; 500 mL crystalloid boluses titrated to blood pressure",
        "Withhold all nitrates for at least 24–48 h",
        "Continuous monitoring and 12-lead ECG — exclude ischaemia",
        "Refractory hypotension: vasopressor (noradrenaline) in ICU",
      ],
      lastRealisticRescueWindow: "Within the first 1–1½ hours of collapse; prolonged hypotension risks infarction and arrhythmia.",
    },
  }),
};

const fluidOverload: GlobalHazardTemplate = {
  id: "fluid-overload",
  applies: (p) => typeof p.fluidToleranceMl === "number",
  triggers: (o, p, snap) => o.drug.classes.includes("fluid") && o.route === "IV" && snap.fluidMl > (p.fluidToleranceMl ?? Infinity),
  build: () => ({
    id: "fluid-overload",
    label: "Acute pulmonary oedema after IV fluid",
    stages: [
      {
        afterMin: 10, status: "deteriorating",
        vitals: [{ key: "rr", value: "28" }, { key: "spo2", value: "90" }, { key: "hr", value: "116" }, { key: "bp", value: "170/98" }],
        observation: { role: "nurse", text: "Doctor, the patient can't lie back — breathing very fast." },
        examFindings: { rs: "Bilateral fine end-inspiratory crepitations up to the mid-zones.", jvp: "JVP raised to the angle of the jaw.", cvs: "S3 gallop audible." },
        patientSays: "I can't breathe… please let me sit up.",
      },
      {
        afterMin: 28, status: "critical",
        vitals: [{ key: "rr", value: "34" }, { key: "spo2", value: "83" }, { key: "hr", value: "128" }, { key: "bp", value: "176/102" }],
        observation: { role: "nurse", text: "Pink frothy sputum. Saturation keeps dropping." },
        examFindings: { rs: "Coarse crepitations throughout both lung fields." },
        investigations: {
          cxr: { report: "Bilateral perihilar alveolar opacities. Upper-lobe venous diversion. Kerley B lines. Small bilateral effusions.", media: { spec: { kind: "xray", view: "AP", features: [{ id: "bat-wing-oedema", severity: 3 }, { id: "cardiomegaly", severity: 1 }, { id: "pleural-effusion", side: "bilateral", severity: 1 }], seed: 7 }, alt: "Anteroposterior chest radiograph.", caption: "AP portable · supine-ish" } },
          abg: { rows: [
            { analyte: "pH", value: "7.26", reference: "7.35–7.45", flag: "low" },
            { analyte: "pCO₂", value: "48", unit: "mmHg", reference: "35–45", flag: "high" },
            { analyte: "pO₂", value: "54", unit: "mmHg", reference: "80–100", flag: "critical" },
            { analyte: "HCO₃⁻", value: "21", unit: "mEq/L", reference: "22–26", flag: "low" },
            { analyte: "Lactate", value: "3.1", unit: "mmol/L", reference: "< 2.0", flag: "high" },
          ] },
        },
        patientSays: "(Gasping, too breathless to speak.)",
      },
      {
        afterMin: 52, status: "critical",
        vitals: [{ key: "rr", value: "38" }, { key: "spo2", value: "74" }, { key: "hr", value: "136" }, { key: "bp", value: "86/50" }, { key: "gcs", value: "10" }],
        observation: { role: "nurse", text: "Patient is drowsy and sweating. BP has started to fall." },
        patientSays: "(No meaningful response.)",
      },
      {
        afterMin: 75, status: "deceased",
        vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }, { key: "spo2", value: "0" }, { key: "rr", value: "0" }, { key: "gcs", value: "3" }],
        observation: { role: "nurse", text: "Bradycardia, then no pulse. The patient has arrested." },
      },
    ],
    rescue: [["drug:furosemide", "drug:torsemide"], ["measure:oxygen", "measure:niv"]],
    fullRecoveryWindowMin: 25,
    lastRescueMin: 64,
    recovery: [
      { afterMin: 15, status: "guarded", vitals: [{ key: "rr", value: "24" }, { key: "spo2", value: "93" }, { key: "hr", value: "108" }, { key: "bp", value: "148/88" }], patientSays: "Breathing is a little easier now.", examFindings: { rs: "Crepitations at both bases only." } },
      { afterMin: 70, status: "improving", vitals: [{ key: "rr", value: "19" }, { key: "spo2", value: "96" }, { key: "hr", value: "92" }, { key: "bp", value: "136/82" }], patientSays: "Much better. I passed a lot of urine.", examFindings: { rs: "Few basal crepitations." } },
    ],
    review: {
      cause: "IV crystalloid was given beyond what this patient's heart and kidneys could handle.",
      whyItCausedHarm: "A stiff or failing left ventricle cannot accommodate the added preload. Left atrial pressure rises → pulmonary capillary hydrostatic pressure exceeds oncotic pressure → fluid floods the alveoli → shunt and hypoxaemia.",
      earliestRescueWindow: "Before the order: assess volume status (JVP, crepitations, oedema) and give fluid in small boluses with reassessment after each.",
      correctRescueSequence: [
        "Stop all IV fluids",
        "Sit the patient upright, legs dependent",
        "Oxygen to SpO₂ 94–98%; CPAP/NIV early if hypoxic or distressed",
        "IV furosemide 40–80 mg (higher if already on diuretics)",
        "GTN (sublingual / infusion) if systolic BP > 110 mmHg",
        "Catheterise and chart urine output; repeat ABG; ICU if not improving",
      ],
      lastRealisticRescueWindow: "Roughly within the first hour. Once hypotension and drowsiness set in, intubation is likely and the prognosis falls sharply.",
    },
  }),
};

const opioidRespiratory: GlobalHazardTemplate = {
  id: "opioid-respiratory-depression",
  applies: () => true,
  triggers: (o, _p, snap) => o.drug.classes.includes("opioid") && o.mode === "given" && snap.recentOpioidMme > (snap.age >= 65 ? 10 : 15),
  build: () => ({
    id: "opioid-respiratory-depression",
    label: "Opioid-induced respiratory depression",
    stages: [
      {
        afterMin: 10, status: "deteriorating",
        vitals: [{ key: "rr", value: "9" }, { key: "spo2", value: "90" }, { key: "hr", value: "62" }, { key: "gcs", value: "12" }],
        observation: { role: "nurse", text: "Doctor, the patient is very drowsy and hard to wake." },
        examFindings: { cns: "Rousable only to loud voice. Pupils pinpoint and sluggish.", eyes: "Pupils 1 mm, sluggishly reactive." },
        patientSays: "(Drowsy, mumbles.) Let me sleep…",
      },
      {
        afterMin: 25, status: "critical",
        vitals: [{ key: "rr", value: "6" }, { key: "spo2", value: "81" }, { key: "hr", value: "54" }, { key: "gcs", value: "8" }],
        observation: { role: "nurse", text: "Breathing is very shallow. Saturation is falling." },
        patientSays: "(No response.)",
      },
      {
        afterMin: 45, status: "deceased",
        vitals: [{ key: "rr", value: "0" }, { key: "spo2", value: "0" }, { key: "hr", value: "0" }, { key: "gcs", value: "3" }],
        observation: { role: "nurse", text: "Apnoeic. No pulse." },
      },
    ],
    rescue: [["drug:naloxone"]],
    fullRecoveryWindowMin: 18,
    lastRescueMin: 40,
    recovery: [
      { afterMin: 3, status: "guarded", vitals: [{ key: "rr", value: "14" }, { key: "spo2", value: "95" }, { key: "gcs", value: "14" }], patientSays: "Hmm? What happened?" },
      { afterMin: 60, status: "stable", vitals: [{ key: "rr", value: "16" }, { key: "spo2", value: "97" }, { key: "gcs", value: "15" }], patientSays: "I'm awake now. The pain is back a bit." },
    ],
    review: {
      cause: "Cumulative opioid dosing exceeded what this patient could tolerate.",
      whyItCausedHarm: "μ-opioid agonism in the brainstem blunts the respiratory response to CO₂ → hypoventilation → hypercapnia and hypoxaemia; sedation precedes apnoea.",
      earliestRescueWindow: "Titrate IV opioids in small increments (e.g. morphine 1–2 mg every 5–10 min) and watch sedation, not just respiratory rate.",
      correctRescueSequence: [
        "Stimulate; open the airway; bag-valve-mask ventilation if apnoeic",
        "Oxygen",
        "Naloxone 0.1–0.4 mg IV, repeated every 2–3 min to effect (it wears off before morphine — watch for re-sedation)",
        "Consider naloxone infusion; continuous SpO₂ and sedation scoring",
      ],
      lastRealisticRescueWindow: "Minutes once apnoea begins; within ~40 minutes from the first signs here.",
    },
  }),
};

const hypoglycaemia: GlobalHazardTemplate = {
  id: "hypoglycaemia",
  applies: () => true,
  triggers: (o, _p, snap) => o.drug.classes.includes("insulin") && o.mode === "given" && snap.rbs < 180,
  build: () => ({
    id: "hypoglycaemia",
    label: "Iatrogenic hypoglycaemia",
    stages: [
      {
        afterMin: 35, status: "deteriorating",
        vitals: [{ key: "rbs", value: "51" }, { key: "hr", value: "108" }],
        observation: { role: "patient", text: "Doctor, I'm feeling shaky… and sweating a lot suddenly." },
        examFindings: { general: "Sweaty, tremulous, anxious." },
        patientSays: "I feel shaky and strange, doctor.",
      },
      {
        afterMin: 70, status: "critical",
        vitals: [{ key: "rbs", value: "32" }, { key: "hr", value: "118" }, { key: "gcs", value: "10" }],
        observation: { role: "nurse", text: "The patient is confused and not answering properly." },
        examFindings: { cns: "Confused, GCS 10. Moving all four limbs." },
        patientSays: "(Confused, irrelevant speech.)",
      },
      {
        afterMin: 170, status: "deceased",
        vitals: [{ key: "rbs", value: "18" }, { key: "gcs", value: "3" }, { key: "hr", value: "0" }],
        observation: { role: "nurse", text: "Seizure, then no pulse." },
      },
    ],
    rescue: [["drug:dextrose-25", "drug:glucagon", "measure:oral-glucose"]],
    fullRecoveryWindowMin: 80,
    lastRescueMin: 160,
    recovery: [
      { afterMin: 10, status: "guarded", vitals: [{ key: "rbs", value: "118" }, { key: "gcs", value: "15" }, { key: "hr", value: "94" }], patientSays: "I feel better. What happened?" },
      { afterMin: 60, status: "stable", vitals: [{ key: "rbs", value: "132" }, { key: "hr", value: "84" }], patientSays: "I'm fine now." },
    ],
    review: {
      cause: "Insulin was given to a patient whose blood glucose did not need it.",
      whyItCausedHarm: "Insulin drives glucose into muscle and fat and suppresses hepatic glucose output. Without carbohydrate cover, plasma glucose falls → autonomic symptoms, then neuroglycopenia, seizures and coma.",
      earliestRescueWindow: "Check a capillary glucose before any insulin dose.",
      correctRescueSequence: [
        "Confirm with a capillary glucose",
        "Conscious and able to swallow: 15–20 g oral glucose, recheck in 15 min",
        "Drowsy / unsafe swallow: 25% dextrose 100 mL IV (or glucagon 1 mg IM)",
        "Recheck glucose every 15 min until > 100 mg/dL, then give a meal",
        "Review and adjust the insulin plan",
      ],
      lastRealisticRescueWindow: "Before seizures or prolonged coma — within roughly two hours here.",
    },
  }),
};

const nsaidBleed: GlobalHazardTemplate = {
  id: "nsaid-bleed",
  applies: (p) => !!p.thrombocytopenia,
  triggers: (o) => o.drug.classes.includes("nsaid") || o.drug.classes.includes("anticoagulant"),
  build: () => ({
    id: "nsaid-bleed",
    label: "Gastrointestinal bleeding on an NSAID with thrombocytopenia",
    prescribedOnsetMin: 960,
    stages: [
      {
        afterMin: 0, status: "deteriorating", setting: "ER", interrupts: true,
        vitals: [{ key: "hr", value: "116" }, { key: "bp", value: "98/62" }, { key: "rr", value: "22" }],
        observation: { role: "attendant", text: "Doctor, he vomited twice this morning — dark, like coffee grounds. And his stools are black." },
        examFindings: { general: "Pale, anxious. Cold peripheries.", abdomen: "Mild epigastric tenderness. No guarding.", pr: "Black, tarry stool on the glove." },
        patientSays: "I feel very weak and dizzy, doctor.",
        investigations: { cbc: { rows: [
          { analyte: "Haemoglobin", value: "9.6", unit: "g/dL", reference: "13.0–17.0", flag: "low" },
          { analyte: "Total leucocyte count", value: "3,100", unit: "/µL", reference: "4,000–11,000", flag: "low" },
          { analyte: "Platelets", value: "0.18", unit: "lakh/µL", reference: "1.5–4.5", flag: "critical" },
          { analyte: "Haematocrit", value: "29", unit: "%", reference: "40–50", flag: "low" },
        ] } },
      },
      {
        afterMin: 150, status: "critical",
        vitals: [{ key: "hr", value: "132" }, { key: "bp", value: "80/50" }, { key: "rr", value: "26" }],
        observation: { role: "nurse", text: "Another large dark vomit. BP is dropping." },
        patientSays: "(Drowsy.) So thirsty…",
      },
      {
        afterMin: 420, status: "deceased",
        vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }],
        observation: { role: "nurse", text: "No pulse." },
      },
    ],
    rescue: [["drug:ns", "drug:rl", "drug:prbc"], ["measure:stop-drug", "drug:pantoprazole", "drug:esomeprazole"]],
    fullRecoveryWindowMin: 120,
    lastRescueMin: 380,
    recovery: [
      { afterMin: 30, status: "guarded", vitals: [{ key: "hr", value: "104" }, { key: "bp", value: "104/66" }], patientSays: "A little better." },
      { afterMin: 240, status: "improving", vitals: [{ key: "hr", value: "90" }, { key: "bp", value: "112/72" }], patientSays: "No more vomiting." },
    ],
    review: {
      cause: "An NSAID (or anticoagulant) was prescribed to a patient with a falling platelet count.",
      whyItCausedHarm: "NSAIDs inhibit platelet COX-1 (impairing the few platelets left) and injure gastric mucosa; with thrombocytopenia and capillary fragility, mucosal bleeding becomes brisk and difficult to stop.",
      earliestRescueWindow: "At prescription: paracetamol only for fever and pain whenever platelets may fall (dengue, sepsis, chemotherapy).",
      correctRescueSequence: [
        "Stop the NSAID",
        "Two large-bore IV cannulae; crystalloid resuscitation",
        "Group & cross-match; transfuse packed cells (and platelets if actively bleeding with severe thrombocytopenia)",
        "IV pantoprazole 80 mg bolus",
        "Monitor haemodynamics; urgent endoscopy once stabilised",
      ],
      lastRealisticRescueWindow: "Within the first few hours of presentation; ongoing bleeding with hypotension is rapidly fatal.",
    },
  }),
};

const betaBlockerBronchospasm: GlobalHazardTemplate = {
  id: "bronchospasm",
  applies: (p) => !!p.asthma,
  triggers: (o) => o.drug.classes.includes("beta-blocker-nonselective"),
  build: () => ({
    id: "bronchospasm",
    label: "Bronchospasm after a non-selective β-blocker",
    prescribedOnsetMin: 240,
    stages: [
      {
        afterMin: 20, status: "deteriorating",
        vitals: [{ key: "rr", value: "28" }, { key: "spo2", value: "91" }, { key: "hr", value: "66" }],
        observation: { role: "patient", text: "Doctor, my chest feels very tight… I'm wheezing like before." },
        examFindings: { rs: "Bilateral polyphonic expiratory wheeze. Prolonged expiration." },
        patientSays: "Tight… chest.",
      },
      {
        afterMin: 50, status: "critical",
        vitals: [{ key: "rr", value: "34" }, { key: "spo2", value: "85" }, { key: "hr", value: "58" }],
        observation: { role: "nurse", text: "Using accessory muscles. Can only say a few words." },
        examFindings: { rs: "Markedly reduced air entry. Faint wheeze." },
      },
      {
        afterMin: 120, status: "deceased",
        vitals: [{ key: "rr", value: "0" }, { key: "spo2", value: "0" }, { key: "hr", value: "0" }],
        observation: { role: "nurse", text: "Silent chest. Respiratory arrest." },
      },
    ],
    rescue: [["drug:salbutamol", "drug:levosalbutamol-ipratropium"]],
    fullRecoveryWindowMin: 35,
    lastRescueMin: 100,
    recovery: [
      { afterMin: 15, status: "guarded", vitals: [{ key: "rr", value: "22" }, { key: "spo2", value: "94" }] },
      { afterMin: 60, status: "improving", vitals: [{ key: "rr", value: "18" }, { key: "spo2", value: "97" }], examFindings: { rs: "Occasional end-expiratory wheeze." } },
    ],
    review: {
      cause: "A non-selective β-blocker was given to a patient with asthma.",
      whyItCausedHarm: "β₂-receptor blockade removes sympathetic bronchodilator tone; airway smooth muscle constricts and β-agonist rescue becomes less effective.",
      earliestRescueWindow: "Ask about asthma before any β-blocker; if one is needed, use a cardioselective agent at low dose.",
      correctRescueSequence: [
        "Stop the β-blocker",
        "Salbutamol 5 mg nebulised, back-to-back; add ipratropium",
        "Oxygen to SpO₂ 94–98%",
        "Systemic steroid (hydrocortisone / prednisolone)",
        "IV magnesium if severe; glucagon can bypass β-blockade",
      ],
      lastRealisticRescueWindow: "Within the first hour or so; a silent chest is pre-arrest.",
    },
  }),
};

const methotrexateDaily: GlobalHazardTemplate = {
  id: "methotrexate-toxicity",
  applies: () => true,
  triggers: (o) => o.drug.id === "methotrexate" && !!o.frequency && !/week/i.test(o.frequency),
  build: () => ({
    id: "methotrexate-toxicity",
    label: "Methotrexate toxicity from daily dosing",
    prescribedOnsetMin: 7200,
    stages: [
      {
        afterMin: 0, status: "deteriorating", setting: "ER", interrupts: true,
        vitals: [{ key: "temp", value: "101.8" }, { key: "hr", value: "114" }, { key: "bp", value: "106/66" }, { key: "rr", value: "22" }],
        observation: { role: "attendant", text: "Doctor, he has had painful mouth ulcers for three days, can't eat anything, and has had fever since last night. He has been taking the tablets every day as written." },
        examFindings: { ent: "Multiple painful erosions over the buccal mucosa, tongue and palate.", general: "Ill-looking, febrile, mildly pale.", skin: "Psoriatic plaques eroded and raw in places." },
        patientSays: "My mouth is so painful I can't even drink water.",
        investigations: {
          cbc: { rows: [
            { analyte: "Haemoglobin", value: "8.9", unit: "g/dL", reference: "13.0–17.0", flag: "low" },
            { analyte: "Total leucocyte count", value: "1,100", unit: "/µL", reference: "4,000–11,000", flag: "critical" },
            { analyte: "Neutrophils", value: "36", unit: "%", reference: "40–75", flag: "low" },
            { analyte: "Platelets", value: "0.38", unit: "lakh/µL", reference: "1.5–4.5", flag: "critical" },
          ] },
          lft: { rows: [
            { analyte: "Total bilirubin", value: "1.4", unit: "mg/dL", reference: "0.3–1.2", flag: "high" },
            { analyte: "AST (SGOT)", value: "186", unit: "U/L", reference: "< 40", flag: "high" },
            { analyte: "ALT (SGPT)", value: "214", unit: "U/L", reference: "< 41", flag: "high" },
            { analyte: "Albumin", value: "3.2", unit: "g/dL", reference: "3.5–5.2", flag: "low" },
          ] },
        },
      },
      {
        afterMin: 720, status: "critical",
        vitals: [{ key: "temp", value: "103.1" }, { key: "hr", value: "128" }, { key: "bp", value: "86/52" }, { key: "rr", value: "26" }],
        observation: { role: "nurse", text: "Fever spiking, BP falling. Patient is drowsy." },
      },
      {
        afterMin: 2880, status: "deceased",
        vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }],
        observation: { role: "nurse", text: "The patient has died." },
      },
    ],
    rescue: [["drug:folinic-acid"], ["drug:pip-taz", "drug:meropenem", "drug:ceftriaxone"]],
    fullRecoveryWindowMin: 360,
    lastRescueMin: 2400,
    recovery: [
      { afterMin: 720, status: "guarded", vitals: [{ key: "temp", value: "99.8" }, { key: "hr", value: "98" }, { key: "bp", value: "112/70" }], patientSays: "The fever has come down." },
      { afterMin: 4320, status: "improving", vitals: [{ key: "temp", value: "98.4" }, { key: "hr", value: "84" }], examFindings: { ent: "Oral erosions re-epithelialising." }, patientSays: "I can eat a little now." },
    ],
    review: {
      cause: "Methotrexate was written to be taken daily instead of once weekly.",
      whyItCausedHarm: "Methotrexate inhibits dihydrofolate reductase. Weekly dosing lets rapidly dividing normal cells recover; daily dosing doesn't — mucosa and marrow fail first (mucositis, pancytopenia), then sepsis.",
      earliestRescueWindow: "At prescription: write the day of the week ('every Sunday'), the strength, and that folic acid is taken on the other days.",
      correctRescueSequence: [
        "Stop methotrexate",
        "Admit; folinic acid (leucovorin) 15 mg IV/PO 6-hourly until counts recover",
        "Febrile neutropenia: blood cultures, then broad-spectrum IV antibiotics within 1 hour (piperacillin–tazobactam or meropenem)",
        "Daily CBC, renal and liver function; transfuse as needed; G-CSF if neutropenia is profound",
        "Mucositis care and nutrition",
      ],
      lastRealisticRescueWindow: "Before septic shock is established — the first 12–24 hours after presentation.",
    },
  }),
};

export const GLOBAL_HAZARDS: GlobalHazardTemplate[] = [
  anaphylaxis,
  pde5Nitrate,
  fluidOverload,
  opioidRespiratory,
  hypoglycaemia,
  nsaidBleed,
  betaBlockerBronchospasm,
  methotrexateDaily,
];

/* -------------------------------------------------------------------------- */
/* Library                                                                     */
/* -------------------------------------------------------------------------- */

/** Case hazards plus every global template that applies to this patient. */
export function hazardLibrary(def: ClinicalCaseDefinition): Map<string, HazardDefinition> {
  const lib = new Map<string, HazardDefinition>();
  for (const t of GLOBAL_HAZARDS) {
    if (t.applies(def.profile)) lib.set(t.id, t.build(def));
  }
  for (const h of def.hazards) lib.set(h.id, h);
  return lib;
}

/** Global templates triggered by a drug order. */
export function globalTriggers(def: ClinicalCaseDefinition, order: DrugOrderContext, snap: PhysiologySnapshot): string[] {
  return GLOBAL_HAZARDS.filter((t) => t.applies(def.profile) && t.triggers(order, def.profile, snap)).map((t) => t.id);
}

/** Converts an opioid dose to IV morphine-milligram-equivalents. */
export function morphineEquivalent(drugId: string, amount?: number, unit?: string): number {
  if (amount === undefined) {
    const defaults: Record<string, number> = { morphine: 3, fentanyl: 5, pentazocine: 10, tramadol: 5 };
    return defaults[drugId] ?? 0;
  }
  const mg = unit === "mcg" ? amount / 1000 : amount;
  switch (drugId) {
    case "morphine": return mg;
    case "fentanyl": return mg * 100;
    case "pentazocine": return mg / 3;
    case "tramadol": return mg / 10;
    default: return 0;
  }
}
