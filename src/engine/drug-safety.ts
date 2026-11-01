/**
 * Harm that a drug's dose alone doesn't show: a liver-toxic paracetamol dose by weight, a negative inotrope in a failing
 * heart, and what only appears over weeks of a course. Sources: StatPearls "Acetaminophen Toxicity" (NBK441917) for the
 * 150 mg/kg threshold and the staged course; FDA isotretinoin label (pseudotumor cerebri with tetracyclines, triglycerides
 * within 4 weeks); FDA clobetasol label (not on the face, 2 weeks at most, atrophy and telangiectasia).
 * Source-checked, not yet reviewed by a clinician.
 */
import { formularyDrug } from "./formulary";
import { QT } from "./interactions";
import type { LabRow } from "./types";
import type { HazardStage } from "./case-definition";
import type { DrugOrderContext, GlobalHazardTemplate } from "./physiology";

const lab = (analyte: string, value: string, unit: string, reference: string, flag: LabRow["flag"]): LabRow => ({ analyte, value, unit, reference, flag });

/** The milligrams an order comes to, when it says. */
const milligrams = (o: Pick<DrugOrderContext, "amount" | "unit">, tablet = 500) =>
  o.amount === undefined ? undefined : o.unit === "g" ? o.amount * 1000 : o.unit === "mg" ? o.amount : /^tab/i.test(o.unit ?? "") ? o.amount * tablet : undefined;

/** A hazard whose id starts with this is a drug's expected course: reported, never counted as harm. */
export const EXPECTED_COURSE = "course-";

const paracetamolOverdose: GlobalHazardTemplate = {
  id: "paracetamol-overdose",
  applies: () => true,
  triggers: (o, _p, snap) => {
    if (o.drug.id !== "paracetamol") return false;
    const mg = milligrams(o);
    return mg !== undefined && (mg >= 7500 || (!!snap.weightKg && mg / snap.weightKg >= 150));
  },
  build: () => ({
    id: "paracetamol-overdose",
    label: "Paracetamol poisoning — liver failure",
    stages: [
      {
        afterMin: 240, status: "guarded", interrupts: false, vitals: [],
        observation: { role: "nurse", text: "Doctor, the patient has vomited twice and looks unwell." },
        patientSays: "I feel sick, doctor.",
      },
      {
        afterMin: 1440, status: "deteriorating", vitals: [{ key: "hr", value: "118" }],
        observation: { role: "nurse", text: "Doctor, pain under the right ribs now, and still vomiting." },
        examFindings: { abdomen: "Tender liver edge in the right upper quadrant." },
        patientSays: "It hurts here, under my ribs on the right.",
        investigations: {
          lft: { rows: [lab("Total bilirubin", "2.4", "mg/dL", "0.2–1.2", "high"), lab("ALT", "2650", "U/L", "7–56", "critical"), lab("AST", "2140", "U/L", "10–40", "critical"), lab("ALP", "140", "U/L", "44–147", "normal"), lab("Albumin", "3.6", "g/dL", "3.5–5.0", "normal")] },
          coag: { rows: [lab("PT", "24", "s", "11–14", "high"), lab("INR", "2.1", "", "0.8–1.2", "high")] },
        },
      },
      {
        afterMin: 4320, status: "critical", vitals: [{ key: "hr", value: "128" }, { key: "bp", value: "86/52" }, { key: "gcs", value: "10" }, { key: "rbs", value: "52" }],
        observation: { role: "nurse", text: "Doctor, jaundiced, drowsy and confused, oozing from the IV site, and the sugar is low." },
        examFindings: { abdomen: "Icterus; tender liver; asterixis." },
        patientSays: "(Confused; does not answer properly.)",
        investigations: {
          lft: { rows: [lab("Total bilirubin", "6.8", "mg/dL", "0.2–1.2", "high"), lab("ALT", "9800", "U/L", "7–56", "critical"), lab("AST", "8700", "U/L", "10–40", "critical"), lab("ALP", "190", "U/L", "44–147", "high"), lab("Albumin", "3.0", "g/dL", "3.5–5.0", "low")] },
          coag: { rows: [lab("PT", "48", "s", "11–14", "critical"), lab("INR", "4.6", "", "0.8–1.2", "critical")] },
        },
      },
      {
        afterMin: 7200, status: "deceased", vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }, { key: "spo2", value: "0" }, { key: "rr", value: "0" }, { key: "gcs", value: "3" }],
        observation: { role: "nurse", text: "No pulse, doctor. The patient has arrested." },
      },
    ],
    rescue: [["drug:acetylcysteine"]],
    fullRecoveryWindowMin: 480,
    lastRescueMin: 5760,
    recovery: [
      { afterMin: 720, status: "guarded", vitals: [{ key: "hr", value: "104" }], patientSays: "A little less sick now." },
      { afterMin: 4320, status: "improving", vitals: [{ key: "hr", value: "92" }, { key: "bp", value: "108/68" }], patientSays: "I'm feeling better." },
    ],
    review: {
      cause: "Paracetamol was given at or above the liver-toxic dose (150 mg/kg, or about 7.5 g in an adult).",
      whyItCausedHarm: "Above that dose, the toxic metabolite NAPQI overwhelms the liver's glutathione and destroys hepatocytes. The patient may look fine for the first day, then liver failure develops over 2–4 days.",
      earliestRescueWindow: "Start N-acetylcysteine within 8 hours of the dose, when it protects best. Check a 4-hour paracetamol level against the nomogram.",
      correctRescueSequence: ["Stop paracetamol", "IV N-acetylcysteine — don't wait for a level if the dose was clearly toxic", "Paracetamol level, LFT, INR, glucose, creatinine, blood gas", "Treat low glucose; refer to a liver unit if INR rises or the patient becomes encephalopathic"],
      lastRealisticRescueWindow: "N-acetylcysteine still helps late, but outcomes fall sharply once encephalopathy has begun.",
    },
  }),
};

const NEGATIVE_INOTROPES = new Set(["verapamil", "diltiazem"]);

const negativeInotrope: GlobalHazardTemplate = {
  id: "negative-inotrope",
  applies: () => true,
  triggers: (o, p, snap) => {
    if (o.mode !== "given" || !(o.drug.classes.includes("beta-blocker") || NEGATIVE_INOTROPES.has(o.drug.id))) return false;
    if ((o.multiple ?? 1) >= 5) return false; // The overdose has its own course.
    const failing = !!p.heartFailure || /\b(heart failure|cardiogenic|pulmonary o?edema)\b/i.test(snap.diagnosis ?? "");
    return !!snap.unstable && failing;
  },
  build: () => ({
    id: "negative-inotrope",
    label: "Pump failure after a negative inotrope in decompensated heart failure",
    stages: [
      {
        afterMin: 10, status: "critical", vitals: [{ key: "bp", value: "92/58" }, { key: "spo2", value: "82" }, { key: "rr", value: "36" }],
        observation: { role: "nurse", text: "Doctor, the pressure is falling and the breathing is much worse since that injection." },
        examFindings: { rs: "Coarse crepitations up to both apices.", cvs: "S3 gallop; cold, clammy peripheries." },
        patientSays: "(Too breathless to speak.)",
      },
      {
        afterMin: 30, status: "critical", vitals: [{ key: "bp", value: "72/40" }, { key: "hr", value: "54" }, { key: "spo2", value: "74" }, { key: "gcs", value: "9" }],
        observation: { role: "nurse", text: "BP 72 systolic, pulse dropping, she's barely rousable." },
      },
      {
        afterMin: 60, status: "deceased", vitals: [{ key: "hr", value: "0" }, { key: "bp", value: "0/0" }, { key: "spo2", value: "0" }, { key: "rr", value: "0" }, { key: "gcs", value: "3" }],
        observation: { role: "nurse", text: "No pulse on the monitor, doctor. Pulseless electrical activity." },
      },
    ],
    rescue: [["drug:dobutamine", "drug:noradrenaline", "drug:adrenaline"]],
    fullRecoveryWindowMin: 20,
    lastRescueMin: 50,
    recovery: [
      { afterMin: 30, status: "guarded", vitals: [{ key: "bp", value: "98/62" }, { key: "hr", value: "96" }, { key: "spo2", value: "90" }], patientSays: "(Breathing a little easier.)" },
    ],
    review: {
      cause: "A beta-blocker or rate-limiting calcium-channel blocker was given IV during acute decompensated heart failure.",
      whyItCausedHarm: "A failing ventricle depends on its heart rate and contractility; blocking them drops cardiac output, so pressure falls and pulmonary congestion worsens.",
      earliestRescueWindow: "Before the order: in acute pulmonary oedema, tachycardia is a compensation. Treat congestion with nitrates, diuretics and NIV, and don't start beta-blockers until the patient is stable.",
      correctRescueSequence: ["Stop the drug", "Oxygen and NIV; prepare to intubate", "Inotrope or vasopressor (dobutamine, noradrenaline)", "ICU care"],
      lastRealisticRescueWindow: "Before the arrest, within about 50 minutes.",
    },
  }),
};

const hasClass = (id: string, cls: string) => formularyDrug(id)?.classes.includes(cls as never) ?? false;

const retinoidTetracycline: GlobalHazardTemplate = {
  id: "retinoid-tetracycline",
  applies: () => true,
  triggers: (_o, _p, snap) => snap.drugIds.some((d) => hasClass(d, "retinoid-systemic")) && snap.drugIds.some((d) => hasClass(d, "tetracycline")),
  build: () => ({
    id: "retinoid-tetracycline",
    label: "Raised intracranial pressure (pseudotumor cerebri) from isotretinoin with a tetracycline",
    stages: [
      {
        afterMin: 10 * 1440, status: "guarded", interrupts: false, vitals: [],
        examFindings: { eyes: "Bilateral papilloedema with blurred disc margins. Visual acuity slightly reduced; blind spots enlarged." },
        patientSays: "Doctor, I've been getting bad headaches every morning, and sometimes I feel sick and my vision goes blurry.",
      },
      {
        afterMin: 21 * 1440, status: "deteriorating", interrupts: false, vitals: [],
        examFindings: { eyes: "Marked bilateral papilloedema with haemorrhages at the disc margins. Right lateral rectus weakness. Peripheral fields constricted." },
        patientSays: "The headaches are terrible now, doctor, and I'm seeing double.",
      },
    ],
    rescue: [["measure:stop-drug"]],
    fullRecoveryWindowMin: 21 * 1440,
    lastRescueMin: 120 * 1440,
    recovery: [{ afterMin: 7 * 1440, status: "improving", vitals: [], patientSays: "The headaches are easing since you stopped the tablets." }],
    review: {
      cause: "Isotretinoin was combined with a tetracycline; the FDA label says to avoid this.",
      whyItCausedHarm: "Both can cause pseudotumor cerebri, and together the risk rises. Raised pressure damages the optic nerves, and untreated papilloedema can cause permanent vision loss.",
      earliestRescueWindow: "At the prescription: never combine them.",
      correctRescueSequence: ["Stop both drugs", "Fundoscopy and visual fields", "Urgent neuroimaging including venography, then lumbar puncture with opening pressure", "Neurology and ophthalmology; acetazolamide if not pregnant"],
      lastRealisticRescueWindow: "Before vision is lost.",
    },
  }),
};

const steroidOnFace: GlobalHazardTemplate = {
  id: "steroid-on-face",
  applies: () => true,
  triggers: (o, _p, snap) => o.drug.classes.includes("topical-steroid-potent") && (/\b(face|facial|cheeks?|forehead|chin|nose)\b/i.test(o.phrase ?? "") || /\bface\b/i.test(snap.complaint ?? "")),
  build: (def) => ({
    id: "steroid-on-face",
    label: "Steroid damage to the face from a potent topical steroid",
    stages: [
      {
        afterMin: 14 * 1440, status: "guarded", interrupts: false, vitals: [],
        examFindings: { [def.exam.find((e) => e.group === "local-exam")?.id ?? "skin"]: "Red, thinned facial skin with visible telangiectasia and small uniform papulopustules around the treated areas." },
        patientSays: "It looked better at first, doctor, but now my face is red and burning, the skin looks thin, and small pimples keep coming.",
      },
    ],
    rescue: [["measure:stop-drug"]],
    fullRecoveryWindowMin: 60 * 1440,
    lastRescueMin: 365 * 1440,
    recovery: [{ afterMin: 21 * 1440, status: "improving", vitals: [], patientSays: "It flared when I stopped, but it's slowly settling now." }],
    review: {
      cause: "A super-potent topical steroid was used on the face; the FDA label says not to, and limits treatment to 2 weeks.",
      whyItCausedHarm: "Facial skin is thin and absorbs steroid readily, causing atrophy, telangiectasia and steroid-induced rosacea or acneiform eruption.",
      earliestRescueWindow: "At the prescription: avoid potent steroids on the face.",
      correctRescueSequence: ["Stop the steroid, warning of a rebound flare", "Gentle skin care and sun protection", "Treat the underlying problem correctly"],
      lastRealisticRescueWindow: "Atrophy may last, so stop as soon as it's noticed.",
    },
  }),
};

/** What isotretinoin is expected to do: reported at follow-up and on the tests, and not counted as harm. */
const isotretinoinCourse: GlobalHazardTemplate = {
  id: `${EXPECTED_COURSE}isotretinoin`,
  applies: () => true,
  triggers: (o) => o.drug.id === "isotretinoin",
  build: (def) => ({
    id: `${EXPECTED_COURSE}isotretinoin`,
    label: "Expected effects of isotretinoin",
    stages: [
      {
        afterMin: 7 * 1440, status: "stable", interrupts: false, vitals: [],
        examFindings: { ent: "Dry, cracked lips (cheilitis); dry nasal mucosa." },
        patientSays: "My lips have got very dry and cracked, doctor, and my skin feels dry too. A few more spots came at first.",
      },
      {
        afterMin: 28 * 1440, status: "stable", interrupts: false, vitals: [],
        // Acne answers it by now; the dryness stays.
        ...(/\bacne\b/i.test(def.truth.diagnosis)
          ? {
              examFindings: { [def.exam.find((e) => e.group === "local-exam")?.id ?? "skin"]: "About 70% fewer inflammatory papules, pustules and nodules. Residual post-inflammatory hyperpigmentation. Dry, flaking skin and cheilitis.", ent: "Dry, cracked lips (cheilitis); dry nasal mucosa." },
              patientSays: "The spots are much better, doctor. My skin and lips are very dry, though.",
            }
          : {}),
        investigations: { lipid: { rows: [lab("Total cholesterol", "218", "mg/dL", "<200", "high"), lab("Triglycerides", "245", "mg/dL", "<150", "high"), lab("HDL", "42", "mg/dL", ">40", "normal"), lab("LDL", "127", "mg/dL", "<100", "high")] } },
      },
    ],
    rescue: [["measure:stop-drug"]],
    fullRecoveryWindowMin: 0,
    lastRescueMin: 0,
    recovery: [],
    review: { cause: "", whyItCausedHarm: "", earliestRescueWindow: "", correctRescueSequence: [], lastRealisticRescueWindow: "" },
  }),
};

/** The two sides of a pair, whichever came first, counting the patient's own medicines. */
const pairs = (o: DrugOrderContext, p: { currentDrugs?: string[] }, drugIds: readonly string[], a: readonly string[], b: readonly string[]) => {
  const rest = [...drugIds, ...(p.currentDrugs ?? [])].map((d) => d.toLowerCase()).filter((d) => d !== o.drug.id);
  const within = (list: readonly string[]) => rest.some((d) => list.some((x) => d === x || d.startsWith(`${x} `) || d.startsWith(`${x}-`)));
  return (a.includes(o.drug.id) && within(b)) || (b.includes(o.drug.id) && within(a));
};

const SSRIS = ["sertraline", "fluoxetine", "escitalopram"];
const STOPPED_HEART = { vitals: [{ key: "hr" as const, value: "0" }, { key: "bp" as const, value: "0/0" }, { key: "spo2" as const, value: "0" }, { key: "rr" as const, value: "0" }, { key: "gcs" as const, value: "3" }] };

const clashQt: GlobalHazardTemplate = {
  id: "clash-qt",
  applies: () => true,
  // Into a vein, where levels rise at once. (By mouth it's queried, and named in the debrief.)
  triggers: (o, p, snap) => o.mode === "given" && o.route === "IV" && pairs(o, p, snap.drugIds, QT, QT),
  build: () => ({
    id: "clash-qt",
    label: "Torsades de pointes from two QT-prolonging drugs",
    stages: [
      { afterMin: 20, status: "deteriorating", vitals: [{ key: "hr", value: "58" }], observation: { role: "nurse", text: "Doctor, the monitor shows the QT is very long now, and there are extra beats." }, investigations: { ecg: { report: "Sinus bradycardia with frequent ventricular ectopics. QTc about 560 ms." } } },
      { afterMin: 50, status: "critical", vitals: [{ key: "hr", value: "190" }, { key: "bp", value: "74/40" }, { key: "gcs", value: "11" }], observation: { role: "nurse", text: "Runs of a twisting, wide-complex rhythm on the monitor — they keep passing out!" }, investigations: { ecg: { report: "Polymorphic VT with a twisting axis (torsades de pointes); QTc about 600 ms between runs." } } },
      { afterMin: 90, status: "deceased", ...STOPPED_HEART, observation: { role: "nurse", text: "It's gone into ventricular fibrillation. No pulse." } },
    ],
    rescue: [["drug:magnesium-sulphate"]],
    fullRecoveryWindowMin: 40,
    lastRescueMin: 85,
    recovery: [{ afterMin: 20, status: "guarded", vitals: [{ key: "hr", value: "84" }, { key: "bp", value: "108/68" }, { key: "gcs", value: "15" }], patientSays: "I feel more with it." }],
    review: {
      cause: "Two QT-prolonging drugs were given together.",
      whyItCausedHarm: "Each delays repolarisation; together they prolong the QT enough for early after-depolarisations and torsades.",
      earliestRescueWindow: "At the order: check the ECG, potassium and magnesium, and choose a drug that doesn't prolong the QT.",
      correctRescueSequence: ["Stop both drugs", "IV magnesium 2 g", "Correct potassium", "Defibrillate if it degenerates to VF"],
      lastRealisticRescueWindow: "Before it degenerates into VF.",
    },
  }),
};

const clashAvBlock: GlobalHazardTemplate = {
  id: "clash-av-block",
  applies: () => true,
  triggers: (o, p, snap) => o.mode === "given" && o.route === "IV" && pairs(o, p, snap.drugIds, ["metoprolol", "atenolol", "propranolol", "labetalol", "esmolol"], ["diltiazem", "verapamil"]),
  build: () => ({
    id: "clash-av-block",
    label: "Heart block from a beta-blocker with a rate-limiting calcium-channel blocker",
    stages: [
      { afterMin: 10, status: "critical", vitals: [{ key: "hr", value: "38" }, { key: "bp", value: "78/46" }], observation: { role: "nurse", text: "Doctor, the pulse has dropped into the 30s and the BP is falling." }, investigations: { ecg: { report: "Complete heart block, ventricular rate about 38." } } },
      { afterMin: 40, status: "critical", vitals: [{ key: "hr", value: "28" }, { key: "bp", value: "60/32" }, { key: "gcs", value: "10" }], observation: { role: "nurse", text: "Pulse in the 20s, and they're barely rousable." } },
      { afterMin: 80, status: "deceased", ...STOPPED_HEART, observation: { role: "nurse", text: "Asystole. No pulse." } },
    ],
    rescue: [["drug:atropine", "drug:adrenaline", "drug:calcium-gluconate", "drug:glucagon"]],
    fullRecoveryWindowMin: 30,
    lastRescueMin: 70,
    recovery: [{ afterMin: 20, status: "guarded", vitals: [{ key: "hr", value: "62" }, { key: "bp", value: "98/60" }, { key: "gcs", value: "15" }], patientSays: "I feel less faint." }],
    review: {
      cause: "A beta-blocker and a rate-limiting calcium-channel blocker were given together into a vein.",
      whyItCausedHarm: "Both slow the AV node and depress the heart muscle: together they can cause complete heart block and shock.",
      earliestRescueWindow: "At the order: use one or the other, never both IV.",
      correctRescueSequence: ["Stop both", "Atropine", "IV calcium and glucagon", "Adrenaline infusion or pacing"],
      lastRealisticRescueWindow: "Before asystole.",
    },
  }),
};

const clashOpioidBenzo: GlobalHazardTemplate = {
  id: "clash-opioid-benzo",
  applies: () => true,
  triggers: (o, p, snap) => o.mode === "given" && (o.route === "IV" || o.route === "IM") && !snap.unstable && pairs(o, p, snap.drugIds, ["morphine", "tramadol", "fentanyl", "pethidine"], ["diazepam", "midazolam", "lorazepam", "alprazolam"]),
  build: () => ({
    id: "clash-opioid-benzo",
    label: "Respiratory depression from an opioid with a benzodiazepine",
    stages: [
      { afterMin: 8, status: "deteriorating", vitals: [{ key: "rr", value: "8" }, { key: "spo2", value: "86" }, { key: "gcs", value: "10" }], observation: { role: "nurse", text: "Doctor, they're very drowsy and hardly breathing." }, patientSays: "(Mumbles, can't stay awake.)" },
      { afterMin: 25, status: "critical", vitals: [{ key: "rr", value: "5" }, { key: "spo2", value: "70" }, { key: "gcs", value: "7" }], observation: { role: "nurse", text: "Breathing is very shallow. Saturation is falling." } },
      { afterMin: 50, status: "deceased", ...STOPPED_HEART, observation: { role: "nurse", text: "Apnoeic. No pulse." } },
    ],
    rescue: [["drug:naloxone", "drug:flumazenil", "measure:intubation"]],
    fullRecoveryWindowMin: 25,
    lastRescueMin: 45,
    recovery: [{ afterMin: 15, status: "guarded", vitals: [{ key: "rr", value: "14" }, { key: "spo2", value: "95" }, { key: "gcs", value: "14" }], patientSays: "(Waking up.)" }],
    review: {
      cause: "An opioid and a benzodiazepine were given together.",
      whyItCausedHarm: "Each depresses the brainstem's drive to breathe, and together far more than either alone.",
      earliestRescueWindow: "At the order: lowest doses, with monitoring and oxygen ready.",
      correctRescueSequence: ["Open the airway, bag-mask ventilate", "Naloxone", "Intubate if it doesn't respond"],
      lastRealisticRescueWindow: "Before the arrest.",
    },
  }),
};

const clashSerotonin: GlobalHazardTemplate = {
  id: "clash-serotonin",
  applies: () => true,
  triggers: (o, p, snap) => pairs(o, p, snap.drugIds, SSRIS, ["tramadol", "linezolid"]),
  build: () => ({
    id: "clash-serotonin",
    label: "Serotonin syndrome",
    prescribedOnsetMin: 720,
    stages: [
      { afterMin: 120, status: "deteriorating", vitals: [{ key: "hr", value: "122" }, { key: "temp", value: "101.8" }, { key: "bp", value: "158/96" }], observation: { role: "nurse", text: "Doctor, they're agitated and sweating, with a tremor and jerking legs." }, examFindings: { neuro: "Tremor, inducible ankle clonus, brisk reflexes, worse in the legs. Dilated pupils." }, patientSays: "I can't keep still. I'm shaking." },
      { afterMin: 300, status: "critical", vitals: [{ key: "hr", value: "138" }, { key: "temp", value: "104.5" }, { key: "gcs", value: "11" }], observation: { role: "nurse", text: "Temperature is climbing fast, they're rigid and confused." } },
    ],
    rescue: [["measure:stop-drug"], ["drug:lorazepam", "drug:diazepam", "drug:midazolam"]],
    fullRecoveryWindowMin: 240,
    lastRescueMin: 600,
    recovery: [{ afterMin: 180, status: "improving", vitals: [{ key: "hr", value: "94" }, { key: "temp", value: "99.2" }, { key: "bp", value: "132/80" }, { key: "gcs", value: "15" }], patientSays: "The shaking has settled." }],
    review: {
      cause: "An SSRI was combined with another serotonergic drug.",
      whyItCausedHarm: "Too much serotonin at central and peripheral receptors causes clonus, agitation and hyperthermia.",
      earliestRescueWindow: "At the order: check what they're already taking.",
      correctRescueSequence: ["Stop the serotonergic drugs", "Benzodiazepines", "Active cooling", "Cyproheptadine if available"],
      lastRealisticRescueWindow: "Before severe hyperthermia.",
    },
  }),
};

export const CO2_NARCOSIS = "co2-narcosis";

/** Too much oxygen in someone who retains CO₂: set off by the oxygen order, not by a drug. */
const co2Narcosis: GlobalHazardTemplate = {
  id: CO2_NARCOSIS,
  applies: () => true,
  triggers: () => false,
  build: () => ({
    id: CO2_NARCOSIS,
    label: "CO₂ narcosis from too much oxygen in a CO₂ retainer",
    stages: [
      { afterMin: 30, status: "deteriorating", vitals: [{ key: "gcs", value: "13" }, { key: "rr", value: "14" }], observation: { role: "nurse", text: "Doctor, the saturation looks good, but they're getting sleepy." }, patientSays: "(Sleepy, slow to answer.)" },
      { afterMin: 75, status: "critical", vitals: [{ key: "gcs", value: "10" }, { key: "rr", value: "10" }], observation: { role: "nurse", text: "They're hard to wake now, with a flapping tremor, and the breathing is slow." }, examFindings: { neuro: "Drowsy. Flapping tremor of the outstretched hands." } },
      { afterMin: 130, status: "critical", vitals: [{ key: "gcs", value: "7" }, { key: "rr", value: "7" }], observation: { role: "nurse", text: "They barely respond to pain, and the breathing is very slow." } },
      { afterMin: 190, status: "deceased", ...STOPPED_HEART, observation: { role: "nurse", text: "Respiratory arrest, then no pulse." } },
    ],
    rescue: [["measure:oxygen-controlled", "measure:niv", "measure:intubation"]],
    fullRecoveryWindowMin: 90,
    lastRescueMin: 180,
    recovery: [{ afterMin: 60, status: "guarded", vitals: [{ key: "gcs", value: "14" }, { key: "rr", value: "20" }], patientSays: "(More awake.)" }],
    review: {
      cause: "High-flow oxygen was given to someone who retains CO₂.",
      whyItCausedHarm: "More oxygen worsens ventilation–perfusion matching and the Haldane effect releases CO₂ from haemoglobin, while breathing falls: PaCO₂ climbs, pH falls, and CO₂ narcosis follows.",
      earliestRescueWindow: "At the order: controlled oxygen (24–28%), target SpO₂ 88–92%, and an ABG.",
      correctRescueSequence: ["Reduce to controlled oxygen, SpO₂ 88–92%", "Repeat the ABG", "NIV if pH below 7.35 with a raised PaCO₂", "Intubate if NIV fails or they can't protect the airway"],
      lastRealisticRescueWindow: "Before respiratory arrest.",
    },
  }),
};

const procedureHazard = (id: string, label: string, stages: HazardStage[], rescue: string[][], lastRescueMin: number, recovery: HazardStage[], cause: string, why: string, sequence: string[]): GlobalHazardTemplate => ({
  id,
  applies: () => true,
  triggers: () => false,
  build: () => ({ id, label, stages, rescue, fullRecoveryWindowMin: Math.round(lastRescueMin / 2), lastRescueMin, recovery, review: { cause, whyItCausedHarm: why, earliestRescueWindow: "At the procedure: the technique, and checking straight afterwards.", correctRescueSequence: sequence, lastRealisticRescueWindow: `Within about ${lastRescueMin} minutes.` } }),
});

const PROCEDURE_HAZARDS: GlobalHazardTemplate[] = [
  procedureHazard("proc-mainstem", "Right mainstem intubation",
    [{ afterMin: 3, status: "deteriorating", vitals: [{ key: "spo2", value: "86" }], observation: { role: "nurse", text: "Doctor, the saturation is stuck in the 80s, and the left side of the chest isn't moving as well." }, examFindings: { rs: "Air entry much reduced on the left; good on the right. Tube at 26 cm at the lips." } },
     { afterMin: 25, status: "critical", vitals: [{ key: "spo2", value: "78" }], observation: { role: "nurse", text: "Saturation is in the 70s and the airway pressures are high." } }],
    [["measure:withdraw-tube", "measure:intubation"]], 120, [{ afterMin: 5, status: "guarded", vitals: [{ key: "spo2", value: "96" }] }],
    "The tube went too far, into the right main bronchus.", "Only the right lung is ventilated, so the left is shunted and collapses.", ["Listen to both sides", "Pull the tube back until air entry is equal", "Check depth: about 21 cm at the lips in women, 23 cm in men", "Chest X-ray"]),
  procedureHazard("proc-oesophageal", "Unrecognised oesophageal intubation",
    [{ afterMin: 2, status: "critical", vitals: [{ key: "spo2", value: "74" }, { key: "hr", value: "136" }], observation: { role: "nurse", text: "Doctor, the saturation is dropping fast, and I can hear gurgling over the stomach. There's no CO₂ trace!" }, examFindings: { rs: "No breath sounds on either side. Gurgling over the epigastrium." } },
     { afterMin: 6, status: "critical", vitals: [{ key: "spo2", value: "52" }, { key: "hr", value: "48" }, { key: "bp", value: "70/40" }], observation: { role: "nurse", text: "Saturation in the 50s, pulse dropping!" } },
     { afterMin: 11, status: "deceased", ...STOPPED_HEART, observation: { role: "nurse", text: "No pulse, doctor." } }],
    [["measure:intubation"]], 10, [{ afterMin: 4, status: "guarded", vitals: [{ key: "spo2", value: "94" }, { key: "hr", value: "108" }, { key: "bp", value: "108/64" }] }],
    "The tube was in the oesophagus, and placement wasn't confirmed.", "Nothing reaches the lungs: profound hypoxia, then bradycardia and arrest within minutes.", ["No CO₂ trace means the tube isn't in: pull it out", "Bag-mask ventilate", "Re-intubate, and confirm with waveform capnography"]),
  procedureHazard("proc-pneumothorax", "Pneumothorax from line insertion",
    [{ afterMin: 10, status: "deteriorating", vitals: [{ key: "spo2", value: "88" }, { key: "rr", value: "30" }, { key: "hr", value: "118" }], observation: { role: "nurse", text: "Doctor, they're more breathless since the line, and the saturation is falling." }, examFindings: { rs: "Reduced air entry and a hyper-resonant note on the side of the line." } },
     { afterMin: 40, status: "critical", vitals: [{ key: "spo2", value: "76" }, { key: "bp", value: "78/46" }, { key: "hr", value: "142" }], observation: { role: "nurse", text: "BP is falling, the neck veins are full, and the trachea looks pushed over." } },
     { afterMin: 70, status: "deceased", ...STOPPED_HEART, observation: { role: "nurse", text: "No pulse, doctor." } }],
    [["measure:chest-tube"]], 65, [{ afterMin: 10, status: "guarded", vitals: [{ key: "spo2", value: "95" }, { key: "rr", value: "20" }, { key: "hr", value: "98" }, { key: "bp", value: "110/68" }] }],
    "The needle entered the pleura during a neck or subclavian line.", "Air under pressure collapses the lung and, if it builds, stops venous return.", ["Listen, and get a chest X-ray if stable", "Needle decompression if tension", "Chest tube"]),
  procedureHazard("proc-arterial", "Arterial injury and bleeding",
    [{ afterMin: 15, status: "deteriorating", vitals: [{ key: "hr", value: "118" }, { key: "bp", value: "98/60" }], observation: { role: "nurse", text: "Doctor, there's a swelling growing at the site, and the pulse is rising." } }],
    [["drug:ns", "drug:rl", "drug:prbc", "measure:refer"]], 240, [{ afterMin: 30, status: "guarded", vitals: [{ key: "hr", value: "98" }, { key: "bp", value: "112/70" }] }],
    "An artery was hit during the procedure.", "Bleeding collects at the site; low platelets or no ultrasound make it likelier.", ["Firm pressure", "Fluids or blood as needed", "Get the surgeons if it keeps growing"]),
  procedureHazard("proc-line-infection", "Central line infection",
    [{ afterMin: 1440, status: "deteriorating", vitals: [{ key: "temp", value: "102.6" }, { key: "hr", value: "116" }, { key: "bp", value: "102/60" }], observation: { role: "nurse", text: "Doctor, they've spiked a fever with rigors, and the line site is red." }, examFindings: { skin: "Redness and pus at the central line site." } }],
    [["measure:remove-line"], ["drug:vancomycin", "drug:meropenem", "drug:ceftriaxone", "drug:pip-taz"]], 2880, [{ afterMin: 720, status: "improving", vitals: [{ key: "temp", value: "99.2" }, { key: "hr", value: "92" }, { key: "bp", value: "118/72" }] }],
    "The line was placed without full sterile technique.", "Skin organisms track along the catheter into the blood.", ["Blood cultures, from the line and a vein", "Take the line out", "Antibiotics covering skin organisms"]),
  procedureHazard("proc-tube-misplaced", "Misplaced chest tube",
    [{ afterMin: 5, status: "deteriorating", vitals: [{ key: "spo2", value: "86" }, { key: "hr", value: "124" }], observation: { role: "nurse", text: "Doctor, the tube isn't swinging or bubbling, and they're no better." } },
     { afterMin: 45, status: "critical", vitals: [{ key: "spo2", value: "76" }, { key: "bp", value: "82/50" }], observation: { role: "nurse", text: "They're getting worse, and the BP is dropping." } }],
    [["measure:chest-tube"]], 120, [{ afterMin: 10, status: "guarded", vitals: [{ key: "spo2", value: "95" }, { key: "hr", value: "100" }, { key: "bp", value: "112/70" }] }],
    "The tube sat outside the pleura, or wasn't in the safe triangle.", "An undrained chest stays compressed; a misplaced tube can injure the lung, liver or spleen.", ["Check for swing and bubbling, and an X-ray", "Replace it through the safe triangle, 5th space, mid-axillary line"]),
  procedureHazard("proc-para-hypotension", "Circulatory dysfunction after large-volume paracentesis",
    [{ afterMin: 120, status: "deteriorating", vitals: [{ key: "bp", value: "88/50" }, { key: "hr", value: "118" }, { key: "urine", value: "15" }], observation: { role: "nurse", text: "Doctor, the BP has dropped since the tap, and there's hardly any urine." } }],
    [["drug:albumin", "drug:ns"]], 480, [{ afterMin: 60, status: "guarded", vitals: [{ key: "bp", value: "108/64" }, { key: "hr", value: "96" }, { key: "urine", value: "40" }] }],
    "A large-volume tap was done without albumin.", "Taking off 5 L or more without albumin (6–8 g per litre) drops the effective circulating volume, and can bring on renal failure.", ["Albumin 6–8 g per litre removed", "Watch BP, urine and creatinine"]),
  procedureHazard("proc-lp-herniation", "Brain herniation after lumbar puncture",
    [{ afterMin: 20, status: "critical", vitals: [{ key: "gcs", value: "7" }, { key: "hr", value: "48" }, { key: "bp", value: "188/104" }, { key: "rr", value: "9" }], observation: { role: "nurse", text: "Doctor, they've suddenly gone unresponsive, with one big pupil, a slow pulse and a high BP!" }, examFindings: { neuro: "GCS 7. Right pupil fixed and dilated. Extensor posturing." } },
     { afterMin: 90, status: "deceased", ...STOPPED_HEART, observation: { role: "nurse", text: "Respiratory arrest, then no pulse." } }],
    [["drug:hypertonic-saline", "measure:intubation"]], 80, [{ afterMin: 40, status: "guarded", vitals: [{ key: "gcs", value: "10" }, { key: "hr", value: "78" }, { key: "bp", value: "150/88" }, { key: "rr", value: "16" }] }],
    "An LP was done with signs of raised intracranial pressure and no head scan first.", "Lowering pressure below the block pulls the brain down through the tentorium or foramen magnum.", ["CT head before LP with focal signs, papilloedema or a low GCS", "Head up, secure the airway", "Hypertonic saline or mannitol; get the neurosurgeons"]),
  procedureHazard("proc-spinal-haematoma", "Spinal haematoma after lumbar puncture",
    [{ afterMin: 240, status: "deteriorating", vitals: [], observation: { role: "nurse", text: "Doctor, they have back pain, and now can't move their legs properly or pass urine." }, examFindings: { neuro: "Bilateral leg weakness, a sensory level, and a palpable bladder." } }],
    [["measure:refer"]], 720, [{ afterMin: 720, status: "guarded", vitals: [] }],
    "An LP was done with low platelets.", "Bleeding into the spinal canal compresses the cord.", ["Correct platelets before an LP", "Urgent MRI spine", "Neurosurgery within hours"]),
];

/** A topical steroid on a fungal rash: it looks better at first, then spreads and loses its edge. */
const tineaIncognito: GlobalHazardTemplate = {
  id: "tinea-incognito",
  applies: () => true,
  triggers: (o, _p, snap) => o.drug.classes.some((c) => c === "topical-steroid" || c === "topical-steroid-potent" || c === "steroid-combination") && /\b(?:tinea|ringworm|dermatophyt)/i.test(snap.diagnosis ?? ""),
  build: (def) => ({
    id: "tinea-incognito",
    label: "Tinea incognito from a topical steroid on a fungal rash",
    stages: [{ afterMin: 14 * 1440, status: "guarded", interrupts: false, vitals: [], examFindings: { [def.exam.find((e) => e.group === "local-exam")?.id ?? "skin"]: "Larger, ill-defined red patches with pustules and little scale; the raised advancing edge is lost, and there is skin thinning." } }],
    rescue: [["measure:stop-drug"], ["drug:terbinafine", "drug:itraconazole", "drug:fluconazole", "drug:griseofulvin", "drug:clotrimazole"]],
    fullRecoveryWindowMin: 28 * 1440,
    lastRescueMin: 120 * 1440,
    recovery: [],
    review: { cause: "A topical steroid was put on a fungal rash.", whyItCausedHarm: "It suppresses the inflammation that showed the edge, and lets the fungus spread.", earliestRescueWindow: "At the order: scrape for KOH before treating a scaly rash.", correctRescueSequence: ["Stop the steroid", "KOH scraping", "An antifungal, oral if widespread"], lastRealisticRescueWindow: "Any time: it stays treatable." },
  }),
};

export const DRUG_SAFETY: GlobalHazardTemplate[] = [tineaIncognito, ...PROCEDURE_HAZARDS, co2Narcosis, paracetamolOverdose, negativeInotrope, retinoidTetracycline, steroidOnFace, isotretinoinCourse, clashQt, clashAvBlock, clashOpioidBenzo, clashSerotonin];
