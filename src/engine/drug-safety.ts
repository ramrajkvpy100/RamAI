/**
 * Harm that a drug's dose alone doesn't show: a liver-toxic paracetamol dose by weight, a negative inotrope in a failing
 * heart, and what only appears over weeks of a course. Sources: StatPearls "Acetaminophen Toxicity" (NBK441917) for the
 * 150 mg/kg threshold and the staged course; FDA isotretinoin label (pseudotumor cerebri with tetracyclines, triglycerides
 * within 4 weeks); FDA clobetasol label (not on the face, 2 weeks at most, atrophy and telangiectasia).
 * Source-checked, not yet reviewed by a clinician.
 */
import { formularyDrug } from "./formulary";
import type { LabRow } from "./types";
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
  build: () => ({
    id: `${EXPECTED_COURSE}isotretinoin`,
    label: "Expected effects of isotretinoin",
    stages: [
      {
        afterMin: 7 * 1440, status: "stable", interrupts: false, vitals: [],
        examFindings: { ent: "Dry, cracked lips (cheilitis); dry nasal mucosa." },
        patientSays: "My lips have got very dry and cracked, doctor, and my skin feels dry too.",
      },
      {
        afterMin: 28 * 1440, status: "stable", interrupts: false, vitals: [],
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

export const DRUG_SAFETY: GlobalHazardTemplate[] = [paracetamolOverdose, negativeInotrope, retinoidTetracycline, steroidOnFace, isotretinoinCourse];
