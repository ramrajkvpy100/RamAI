/**
 * Global clinical catalogues.
 *
 * These define everything a player can ask for in ANY case, with normal
 * defaults. Case definitions override entries to make findings abnormal.
 * Nothing in this file is case-specific, so nothing here can leak a diagnosis.
 */

import type {
  Flag,
  InvestigationCategory,
  LabRow,
  MediaAsset,
  PatientIdentity,
  VitalKey,
  VitalPatch,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Vitals                                                                      */
/* -------------------------------------------------------------------------- */

export interface VitalDefinition {
  key: VitalKey;
  label: string;
  unit: string;
  match: string[];
  /** Minutes the measurement takes on the sim clock. */
  durationMin: number;
}

export const VITALS: VitalDefinition[] = [
  { key: "bp", label: "BP", unit: "mmHg", durationMin: 1, match: ["bp", "blood pressure", "b p"] },
  { key: "hr", label: "Pulse", unit: "/min", durationMin: 1, match: ["pulse", "heart rate", "hr", "pulse rate", "radial pulse"] },
  { key: "rr", label: "RR", unit: "/min", durationMin: 1, match: ["rr", "respiratory rate", "resp rate", "breathing rate", "respiration"] },
  { key: "temp", label: "Temp", unit: "°F", durationMin: 1, match: ["temperature", "temp", "thermometer"] },
  { key: "spo2", label: "SpO₂", unit: "%", durationMin: 1, match: ["spo2", "sp o2", "saturation", "saturations", "oxygen saturation", "sats", "pulse ox", "pulse oximetry", "oximetry", "o2 sat"] },
  { key: "rbs", label: "RBS", unit: "mg/dL", durationMin: 2, match: ["rbs", "random blood sugar", "random sugar", "blood sugar", "sugar", "glucometer", "capillary glucose", "cbg", "grbs", "blood glucose", "glucose"] },
  { key: "weight", label: "Weight", unit: "kg", durationMin: 1, match: ["weight", "weigh"] },
  { key: "height", label: "Height", unit: "cm", durationMin: 1, match: ["height"] },
  { key: "bmi", label: "BMI", unit: "kg/m²", durationMin: 1, match: ["bmi", "body mass index"] },
  { key: "gcs", label: "GCS", unit: "/15", durationMin: 1, match: ["gcs", "glasgow", "glasgow coma scale"] },
  { key: "pain", label: "Pain", unit: "/10", durationMin: 0, match: ["pain score", "pain scale", "rate the pain", "rate your pain", "vas score"] },
  { key: "urine", label: "Urine output", unit: "mL/h", durationMin: 1, match: ["urine output", "uo", "input output", "intake output", "io chart"] },
];

/** Phrases meaning "the routine set of vitals". */
export const ALL_VITALS_PHRASES = ["vitals", "vital signs", "all vitals", "vital parameters", "vitals check"];
export const ROUTINE_VITALS: VitalKey[] = ["hr", "bp", "rr", "temp", "spo2"];

export function vitalDefinition(key: VitalKey): VitalDefinition {
  const def = VITALS.find((v) => v.key === key);
  if (!def) throw new Error(`Unknown vital ${key}`);
  return def;
}

/** Objective, threshold-based flagging. Encodes ranges, never diagnoses. */
export function flagVital(key: VitalKey, value: string): { flag: Flag; numeric?: number } {
  const n = parseFloat(value);
  switch (key) {
    case "bp": {
      const [s, d] = value.split("/").map((x) => parseInt(x, 10));
      if (s === undefined || d === undefined || Number.isNaN(s) || Number.isNaN(d)) return { flag: "unknown" };
      if (s >= 180 || d >= 120 || s < 80) return { flag: "critical", numeric: s };
      if (s < 90 || d < 60) return { flag: "low", numeric: s };
      if (s >= 140 || d >= 90) return { flag: "high", numeric: s };
      return { flag: "normal", numeric: s };
    }
    case "hr":
      if (n > 130 || n < 40) return { flag: "critical", numeric: n };
      return { flag: n > 100 ? "high" : n < 60 ? "low" : "normal", numeric: n };
    case "rr":
      if (n >= 30 || n < 8) return { flag: "critical", numeric: n };
      return { flag: n > 20 ? "high" : n < 12 ? "low" : "normal", numeric: n };
    case "temp":
      if (n >= 104 || n < 95) return { flag: "critical", numeric: n };
      return { flag: n > 99.5 ? "high" : "normal", numeric: n };
    case "spo2":
      if (n < 90) return { flag: "critical", numeric: n };
      return { flag: n < 95 ? "low" : "normal", numeric: n };
    case "rbs":
      if (n < 54 || n > 400) return { flag: "critical", numeric: n };
      return { flag: n < 70 ? "low" : n > 180 ? "high" : "normal", numeric: n };
    case "bmi":
      return { flag: n >= 25 ? "high" : n < 18.5 ? "low" : "normal", numeric: n };
    case "gcs":
      if (n <= 8) return { flag: "critical", numeric: n };
      return { flag: n < 15 ? "low" : "normal", numeric: n };
    case "pain":
      return { flag: n >= 7 ? "high" : "normal", numeric: n };
    case "urine":
      return { flag: n < 30 ? "low" : "normal", numeric: n };
    default:
      return { flag: "normal", numeric: Number.isNaN(n) ? undefined : n };
  }
}

/** Sensible adult defaults when a case does not specify a vital. */
export function defaultVitals(patient: PatientIdentity): Record<VitalKey, VitalPatch> {
  const male = patient.sex === "Male";
  const weight = male ? 70 : 58;
  const height = male ? 170 : 157;
  return {
    bp: { key: "bp", value: "122/78" },
    hr: { key: "hr", value: "78" },
    rr: { key: "rr", value: "14" },
    temp: { key: "temp", value: "98.4" },
    spo2: { key: "spo2", value: "98" },
    rbs: { key: "rbs", value: "104" },
    weight: { key: "weight", value: String(weight) },
    height: { key: "height", value: String(height) },
    bmi: { key: "bmi", value: (weight / (height / 100) ** 2).toFixed(1) },
    gcs: { key: "gcs", value: "15" },
    pain: { key: "pain", value: "0" },
    urine: { key: "urine", value: "60" },
  };
}

/* -------------------------------------------------------------------------- */
/* Investigations                                                              */
/* -------------------------------------------------------------------------- */

export interface NormalContext {
  patient: PatientIdentity;
  /** Current underlying heart rate, for ECG rendering. */
  hr: number;
  seed: number;
}

export interface NormalResult {
  rows?: LabRow[];
  report?: string;
  media?: MediaAsset;
}

export type InvestigationMenu =
  | "Bedside"
  | "Blood"
  | "Urine & stool"
  | "Microbiology"
  | "Cardiac"
  | "Imaging"
  | "Dermatology";

export interface CatalogInvestigation {
  id: string;
  name: string;
  /** Compact label for result cards and menus. */
  short: string;
  category: InvestigationCategory;
  menu: InvestigationMenu;
  match: string[];
  /** Sim-clock minutes until resulted. */
  turnaroundMin: number;
  /** Typical private-lab cost in Delhi, INR. */
  cost: number;
  normal: (ctx: NormalContext) => NormalResult;
}

function row(analyte: string, value: string, unit?: string, reference?: string, flag: Flag = "normal"): LabRow {
  return { analyte, value, unit, reference, flag };
}

const male = (c: NormalContext) => c.patient.sex === "Male";
const female = (c: NormalContext) => c.patient.sex === "Female";

const BLOOD_GROUPS = ["B positive", "O positive", "A positive", "AB positive", "B positive", "O positive", "A negative"];

export const INVESTIGATIONS: CatalogInvestigation[] = [
  /* ---- Blood ---------------------------------------------------------- */
  {
    id: "cbc", name: "Complete blood count", short: "CBC", category: "lab", menu: "Blood",
    turnaroundMin: 30, cost: 350,
    match: ["cbc", "complete blood count", "hemogram", "haemogram", "blood count", "cbp", "fbc", "full blood count", "tlc", "dlc", "platelet count", "platelets", "hemoglobin", "haemoglobin", "hb"],
    normal: (c) => ({
      rows: [
        row("Haemoglobin", male(c) ? "14.6" : "12.9", "g/dL", male(c) ? "13.0–17.0" : "12.0–15.5"),
        row("Total leucocyte count", "7,400", "/µL", "4,000–11,000"),
        row("Neutrophils", "62", "%", "40–75"),
        row("Lymphocytes", "30", "%", "20–45"),
        row("Eosinophils", "3", "%", "1–6"),
        row("Monocytes", "5", "%", "2–10"),
        row("Platelets", "2.6", "lakh/µL", "1.5–4.5"),
        row("Haematocrit", male(c) ? "44" : "39", "%", male(c) ? "40–50" : "36–46"),
        row("MCV", "88", "fL", "80–100"),
      ],
    }),
  },
  {
    id: "lft", name: "Liver function tests", short: "LFT", category: "lab", menu: "Blood",
    turnaroundMin: 40, cost: 600,
    match: ["lft", "lfts", "liver function", "liver function test", "liver function tests", "liver panel", "bilirubin", "sgot", "sgpt", "ast", "alt", "liver enzymes"],
    normal: () => ({
      rows: [
        row("Total bilirubin", "0.7", "mg/dL", "0.3–1.2"),
        row("Direct bilirubin", "0.2", "mg/dL", "0.0–0.3"),
        row("AST (SGOT)", "24", "U/L", "< 40"),
        row("ALT (SGPT)", "22", "U/L", "< 41"),
        row("Alkaline phosphatase", "78", "U/L", "40–129"),
        row("Total protein", "7.2", "g/dL", "6.0–8.3"),
        row("Albumin", "4.3", "g/dL", "3.5–5.2"),
      ],
    }),
  },
  {
    id: "rft", name: "Renal function tests", short: "RFT", category: "lab", menu: "Blood",
    turnaroundMin: 40, cost: 550,
    match: ["rft", "rfts", "kft", "kfts", "renal function", "renal function test", "kidney function", "kidney function test", "urea", "creatinine", "s creatinine", "serum creatinine", "egfr"],
    normal: (c) => ({
      rows: [
        row("Urea", "24", "mg/dL", "15–40"),
        row("Creatinine", male(c) ? "0.9" : "0.7", "mg/dL", male(c) ? "0.7–1.3" : "0.5–1.1"),
        row("Sodium", "139", "mEq/L", "135–145"),
        row("Potassium", "4.2", "mEq/L", "3.5–5.1"),
        row("Chloride", "102", "mEq/L", "98–107"),
        row("eGFR", "> 90", "mL/min/1.73m²", "> 90"),
      ],
    }),
  },
  {
    id: "electrolytes", name: "Serum electrolytes", short: "Electrolytes", category: "lab", menu: "Blood",
    turnaroundMin: 30, cost: 400,
    match: ["electrolytes", "serum electrolytes", "s electrolytes", "sodium", "potassium", "na k", "lytes"],
    normal: () => ({
      rows: [
        row("Sodium", "139", "mEq/L", "135–145"),
        row("Potassium", "4.2", "mEq/L", "3.5–5.1"),
        row("Chloride", "102", "mEq/L", "98–107"),
      ],
    }),
  },
  {
    id: "fbs", name: "Fasting blood sugar", short: "FBS", category: "lab", menu: "Blood",
    turnaroundMin: 20, cost: 80,
    match: ["fbs", "fasting blood sugar", "fasting sugar", "fasting glucose", "fpg", "fasting plasma glucose"],
    normal: () => ({ rows: [row("Fasting plasma glucose", "92", "mg/dL", "70–99")] }),
  },
  {
    id: "ppbs", name: "Post-prandial blood sugar", short: "PPBS", category: "lab", menu: "Blood",
    turnaroundMin: 20, cost: 80,
    match: ["ppbs", "post prandial", "postprandial", "pp sugar", "post prandial blood sugar", "2 hour sugar"],
    normal: () => ({ rows: [row("2-h post-prandial glucose", "118", "mg/dL", "< 140")] }),
  },
  {
    id: "hba1c", name: "Glycated haemoglobin", short: "HbA1c", category: "lab", menu: "Blood",
    turnaroundMin: 60, cost: 500,
    match: ["hba1c", "hb a1c", "a1c", "glycated", "glycated hemoglobin", "glycosylated", "glycosylated hemoglobin", "glyco"],
    normal: () => ({ rows: [row("HbA1c", "5.4", "%", "< 5.7")] }),
  },
  {
    id: "lipid", name: "Lipid profile", short: "Lipids", category: "lab", menu: "Blood",
    turnaroundMin: 40, cost: 550,
    match: ["lipid", "lipids", "lipid profile", "cholesterol", "ldl", "triglycerides", "fasting lipid"],
    normal: (c) => ({
      rows: [
        row("Total cholesterol", "172", "mg/dL", "< 200"),
        row("LDL cholesterol", "98", "mg/dL", "< 100"),
        row("HDL cholesterol", male(c) ? "44" : "52", "mg/dL", male(c) ? "> 40" : "> 50"),
        row("Triglycerides", "132", "mg/dL", "< 150"),
        row("Non-HDL cholesterol", "128", "mg/dL", "< 130"),
      ],
    }),
  },
  {
    id: "tft", name: "Thyroid function", short: "TSH / FT4", category: "lab", menu: "Blood",
    turnaroundMin: 60, cost: 500,
    match: ["tsh", "tft", "thyroid", "thyroid function", "thyroid profile", "t3 t4 tsh", "ft4", "free t4"],
    normal: () => ({
      rows: [
        row("TSH", "2.1", "mIU/L", "0.4–4.5"),
        row("Free T4", "1.2", "ng/dL", "0.8–1.8"),
      ],
    }),
  },
  {
    id: "crp", name: "C-reactive protein", short: "CRP", category: "lab", menu: "Blood",
    turnaroundMin: 30, cost: 450,
    match: ["crp", "c reactive protein", "c-reactive protein", "hs crp"],
    normal: () => ({ rows: [row("CRP", "3", "mg/L", "< 6")] }),
  },
  {
    id: "esr", name: "Erythrocyte sedimentation rate", short: "ESR", category: "lab", menu: "Blood",
    turnaroundMin: 60, cost: 150,
    match: ["esr", "sedimentation", "erythrocyte sedimentation rate"],
    normal: (c) => ({ rows: [row("ESR", male(c) ? "10" : "14", "mm/1st h", male(c) ? "0–15" : "0–20")] }),
  },
  {
    id: "coag", name: "Coagulation profile", short: "PT/INR", category: "lab", menu: "Blood",
    turnaroundMin: 40, cost: 600,
    match: ["pt inr", "pt", "inr", "aptt", "coagulation", "coagulation profile", "clotting", "bt ct", "prothrombin"],
    normal: () => ({
      rows: [
        row("PT", "12.8", "s", "11.0–13.5"),
        row("INR", "1.0", undefined, "0.8–1.2"),
        row("aPTT", "30", "s", "25–35"),
      ],
    }),
  },
  {
    id: "amylase-lipase", name: "Serum amylase & lipase", short: "Amylase/Lipase", category: "lab", menu: "Blood",
    turnaroundMin: 40, cost: 900,
    match: ["amylase", "lipase", "serum amylase", "serum lipase", "pancreatic enzymes"],
    normal: () => ({
      rows: [
        row("Amylase", "62", "U/L", "28–100"),
        row("Lipase", "34", "U/L", "13–60"),
      ],
    }),
  },
  {
    id: "abg", name: "Arterial blood gas", short: "ABG", category: "bedside", menu: "Bedside",
    turnaroundMin: 10, cost: 1200,
    match: ["abg", "arterial blood gas", "blood gas", "vbg", "venous blood gas", "lactate", "serum lactate"],
    normal: () => ({
      rows: [
        row("pH", "7.40", undefined, "7.35–7.45"),
        row("pCO₂", "40", "mmHg", "35–45"),
        row("pO₂", "92", "mmHg", "80–100"),
        row("HCO₃⁻", "24", "mEq/L", "22–26"),
        row("Base excess", "0", "mEq/L", "−2 to +2"),
        row("Lactate", "1.1", "mmol/L", "< 2.0"),
      ],
      report: "Sample drawn on room air.",
    }),
  },
  {
    id: "d-dimer", name: "D-dimer", short: "D-dimer", category: "lab", menu: "Blood",
    turnaroundMin: 40, cost: 1100,
    match: ["d dimer", "d-dimer", "ddimer"],
    normal: () => ({ rows: [row("D-dimer", "0.3", "µg/mL FEU", "< 0.5")] }),
  },
  {
    id: "procalcitonin", name: "Procalcitonin", short: "PCT", category: "lab", menu: "Blood",
    turnaroundMin: 60, cost: 2200,
    match: ["procalcitonin", "pct"],
    normal: () => ({ rows: [row("Procalcitonin", "0.04", "ng/mL", "< 0.10")] }),
  },
  {
    id: "dengue", name: "Dengue NS1 antigen & serology", short: "Dengue NS1/IgM", category: "lab", menu: "Blood",
    turnaroundMin: 45, cost: 1200,
    match: ["ns1", "dengue", "dengue ns1", "dengue serology", "dengue igm", "dengue test", "dengue card"],
    normal: () => ({
      rows: [
        row("Dengue NS1 antigen", "Negative", undefined, "Negative"),
        row("Dengue IgM", "Negative", undefined, "Negative"),
        row("Dengue IgG", "Negative", undefined, "Negative"),
      ],
    }),
  },
  {
    id: "malaria", name: "Malaria antigen & smear", short: "Malaria", category: "lab", menu: "Blood",
    turnaroundMin: 30, cost: 500,
    match: ["malaria", "mp", "malarial parasite", "malaria antigen", "smear for mp", "peripheral smear for malaria", "rdt"],
    normal: () => ({
      rows: [
        row("P. falciparum antigen (HRP-2)", "Negative", undefined, "Negative"),
        row("P. vivax antigen (pLDH)", "Negative", undefined, "Negative"),
      ],
      report: "Thick and thin smears: no malarial parasites seen.",
    }),
  },
  {
    id: "widal", name: "Widal test", short: "Widal", category: "lab", menu: "Blood",
    turnaroundMin: 60, cost: 250,
    match: ["widal", "typhoid test", "typhidot", "enteric serology"],
    normal: () => ({
      rows: [
        row("S. Typhi O", "1:40", "titre", "< 1:80"),
        row("S. Typhi H", "1:40", "titre", "< 1:160"),
      ],
    }),
  },
  {
    id: "viral-markers", name: "Viral markers (HIV, HBsAg, HCV)", short: "Viral markers", category: "lab", menu: "Blood",
    turnaroundMin: 60, cost: 1100,
    match: ["viral markers", "hiv", "hbsag", "hcv", "anti hcv", "hiv hbsag hcv", "elisa"],
    normal: () => ({
      rows: [
        row("HIV 1 & 2", "Non-reactive", undefined, "Non-reactive"),
        row("HBsAg", "Non-reactive", undefined, "Non-reactive"),
        row("Anti-HCV", "Non-reactive", undefined, "Non-reactive"),
      ],
    }),
  },
  {
    id: "blood-group", name: "Blood grouping & cross-match", short: "Group & match", category: "lab", menu: "Blood",
    turnaroundMin: 45, cost: 300,
    match: ["blood group", "blood grouping", "grouping", "cross match", "crossmatch", "group and cross match", "gxm", "group and save"],
    normal: (c) => ({ rows: [row("ABO / Rh", BLOOD_GROUPS[c.seed % BLOOD_GROUPS.length] ?? "B positive")], report: "Two units cross-matched and reserved on request." }),
  },
  {
    id: "vit-b12", name: "Vitamin B12", short: "B12", category: "lab", menu: "Blood",
    turnaroundMin: 90, cost: 900,
    match: ["b12", "vitamin b12", "vit b12", "cobalamin"],
    normal: () => ({ rows: [row("Vitamin B12", "412", "pg/mL", "211–911")] }),
  },
  {
    id: "vit-d", name: "25-OH Vitamin D", short: "Vitamin D", category: "lab", menu: "Blood",
    turnaroundMin: 90, cost: 1200,
    match: ["vitamin d", "vit d", "25 oh vitamin d", "vitamin d3"],
    normal: () => ({ rows: [row("25-OH Vitamin D", "22", "ng/mL", "30–100", "low")] }),
  },
  {
    id: "iron", name: "Iron studies", short: "Iron studies", category: "lab", menu: "Blood",
    turnaroundMin: 90, cost: 1100,
    match: ["iron studies", "ferritin", "serum iron", "tibc", "iron profile", "transferrin"],
    normal: (c) => ({
      rows: [
        row("Serum ferritin", male(c) ? "110" : "48", "ng/mL", male(c) ? "30–400" : "13–150"),
        row("Serum iron", "92", "µg/dL", "60–170"),
        row("TIBC", "310", "µg/dL", "250–450"),
        row("Transferrin saturation", "30", "%", "20–50"),
      ],
    }),
  },
  {
    id: "uric-acid", name: "Serum uric acid", short: "Uric acid", category: "lab", menu: "Blood",
    turnaroundMin: 30, cost: 200,
    match: ["uric acid", "serum uric acid", "urate"],
    normal: (c) => ({ rows: [row("Uric acid", male(c) ? "5.6" : "4.4", "mg/dL", male(c) ? "3.5–7.2" : "2.6–6.0")] }),
  },
  {
    id: "calcium", name: "Serum calcium", short: "Calcium", category: "lab", menu: "Blood",
    turnaroundMin: 30, cost: 200,
    match: ["calcium", "serum calcium", "ionised calcium", "phosphate", "magnesium"],
    normal: () => ({ rows: [row("Calcium (total)", "9.4", "mg/dL", "8.6–10.2")] }),
  },
  {
    id: "peripheral-smear", name: "Peripheral blood smear", short: "Smear", category: "lab", menu: "Blood",
    turnaroundMin: 60, cost: 250,
    match: ["peripheral smear", "pbs", "blood smear", "general blood picture", "gbp"],
    normal: () => ({ report: "Normocytic normochromic red cells. White cells normal in number and morphology. Platelets adequate on smear. No haemoparasites seen." }),
  },
  {
    id: "ana", name: "Antinuclear antibody", short: "ANA", category: "lab", menu: "Blood",
    turnaroundMin: 180, cost: 1500,
    match: ["ana", "antinuclear", "ana ifa", "ana profile", "autoimmune profile"],
    normal: () => ({ rows: [row("ANA (IFA, HEp-2)", "Negative at 1:80", undefined, "Negative")] }),
  },

  /* ---- Bedside -------------------------------------------------------- */
  {
    id: "upt", name: "Urine pregnancy test", short: "UPT", category: "bedside", menu: "Bedside",
    turnaroundMin: 5, cost: 100,
    match: ["upt", "urine pregnancy", "pregnancy test", "urine hcg", "beta hcg", "bhcg", "serum hcg"],
    normal: (c) => (female(c)
      ? { rows: [row("Urine hCG", "Negative", undefined, "Negative")] }
      : { report: "Not performed — test not applicable to this patient." }),
  },
  {
    id: "urine-dip", name: "Urine dipstick", short: "Urine dipstick", category: "bedside", menu: "Bedside",
    turnaroundMin: 3, cost: 60,
    match: ["urine dipstick", "dipstick", "urine strip", "urine ketones", "ketones"],
    normal: () => ({
      rows: [
        row("Protein", "Negative", undefined, "Negative"),
        row("Glucose", "Negative", undefined, "Negative"),
        row("Ketones", "Negative", undefined, "Negative"),
        row("Blood", "Negative", undefined, "Negative"),
        row("Leucocyte esterase", "Negative", undefined, "Negative"),
        row("Nitrite", "Negative", undefined, "Negative"),
      ],
    }),
  },
  {
    id: "abi", name: "Ankle–brachial index", short: "ABI", category: "bedside", menu: "Bedside",
    turnaroundMin: 12, cost: 800,
    match: ["abi", "ankle brachial", "ankle brachial index", "ankle brachial pressure index", "abpi"],
    normal: () => ({
      rows: [
        row("Right ABI", "1.08", undefined, "1.00–1.40"),
        row("Left ABI", "1.10", undefined, "1.00–1.40"),
      ],
    }),
  },

  /* ---- Urine & stool -------------------------------------------------- */
  {
    id: "urine-rm", name: "Urine routine & microscopy", short: "Urine R/M", category: "lab", menu: "Urine & stool",
    turnaroundMin: 30, cost: 150,
    match: ["urine routine", "urine rm", "urine r m", "urine re", "urinalysis", "urine examination", "urine analysis", "urine micro", "urine microscopy", "routine urine"],
    normal: () => ({
      rows: [
        row("Appearance", "Pale yellow, clear"),
        row("pH", "6.0", undefined, "4.5–8.0"),
        row("Specific gravity", "1.015", undefined, "1.005–1.030"),
        row("Protein", "Nil", undefined, "Nil"),
        row("Glucose", "Nil", undefined, "Nil"),
        row("Ketones", "Nil", undefined, "Nil"),
        row("Pus cells", "1–2", "/hpf", "0–5"),
        row("Red cells", "Nil", "/hpf", "0–2"),
        row("Casts", "Nil", undefined, "Nil"),
      ],
    }),
  },
  {
    id: "uacr", name: "Urine albumin–creatinine ratio", short: "UACR", category: "lab", menu: "Urine & stool",
    turnaroundMin: 60, cost: 600,
    match: ["uacr", "acr", "albumin creatinine ratio", "microalbumin", "urine microalbumin", "spot urine albumin"],
    normal: () => ({ rows: [row("UACR", "12", "mg/g", "< 30")] }),
  },
  {
    id: "stool-rm", name: "Stool routine & microscopy", short: "Stool R/M", category: "lab", menu: "Urine & stool",
    turnaroundMin: 60, cost: 200,
    match: ["stool routine", "stool rm", "stool r m", "stool examination", "stool test", "stool for occult blood", "stool occult blood", "fobt"],
    normal: () => ({ report: "Brown, formed. No ova, cysts or trophozoites seen. Occult blood negative." }),
  },

  /* ---- Microbiology --------------------------------------------------- */
  {
    id: "blood-culture", name: "Blood culture & sensitivity", short: "Blood C/S", category: "micro", menu: "Microbiology",
    turnaroundMin: 2880, cost: 1200,
    match: ["blood culture", "blood c s", "blood cs", "culture sensitivity blood", "bc"],
    normal: () => ({ report: "No growth after 48 hours of incubation." }),
  },
  {
    id: "urine-culture", name: "Urine culture & sensitivity", short: "Urine C/S", category: "micro", menu: "Microbiology",
    turnaroundMin: 2880, cost: 800,
    match: ["urine culture", "urine c s", "urine cs"],
    normal: () => ({ report: "No significant growth." }),
  },
  {
    id: "pus-culture", name: "Pus / swab culture", short: "Swab C/S", category: "micro", menu: "Microbiology",
    turnaroundMin: 2880, cost: 900,
    match: ["pus culture", "swab culture", "wound swab", "pus c s", "swab"],
    normal: () => ({ report: "No pathogenic organisms isolated." }),
  },

  /* ---- Cardiac -------------------------------------------------------- */
  {
    id: "ecg", name: "12-lead ECG", short: "ECG", category: "ecg", menu: "Cardiac",
    turnaroundMin: 5, cost: 300,
    match: ["ecg", "ekg", "12 lead", "12 lead ecg", "electrocardiogram", "electrocardiography", "rhythm strip", "ecg tracing"],
    normal: (c) => ({
      media: {
        spec: { kind: "ecg", rate: c.hr, rhythm: "sinus" },
        alt: `Twelve-lead ECG tracing at ${c.hr} per minute.`,
        caption: "12-lead · 25 mm/s · 10 mm/mV",
      },
      report: `Rate ${c.hr}/min. PR 156 ms. QRS 86 ms. QTc 412 ms. Axis +45°.`,
    }),
  },
  {
    id: "troponin", name: "High-sensitivity troponin I", short: "hs-Trop I", category: "lab", menu: "Cardiac",
    turnaroundMin: 40, cost: 1400,
    match: ["troponin", "trop", "trop i", "trop t", "hs troponin", "cardiac enzymes", "cardiac markers", "ck mb", "cpk mb"],
    normal: () => ({ rows: [row("hs-Troponin I", "3.2", "ng/L", "< 19")] }),
  },
  {
    id: "bnp", name: "NT-proBNP", short: "NT-proBNP", category: "lab", menu: "Cardiac",
    turnaroundMin: 45, cost: 2200,
    match: ["bnp", "nt probnp", "nt pro bnp", "probnp", "natriuretic peptide"],
    normal: () => ({ rows: [row("NT-proBNP", "68", "pg/mL", "< 125")] }),
  },
  {
    id: "echo", name: "2D echocardiography", short: "Echo", category: "imaging", menu: "Cardiac",
    turnaroundMin: 40, cost: 2500,
    match: ["echo", "2d echo", "echocardiography", "echocardiogram", "2 d echo", "cardiac echo"],
    normal: () => ({ report: "LV dimensions normal. LVEF 60%. No regional wall motion abnormality. Valves structurally normal. No pericardial effusion. IVC 1.6 cm with > 50% inspiratory collapse." }),
  },
  {
    id: "arterial-doppler", name: "Lower-limb arterial Doppler", short: "Arterial Doppler", category: "imaging", menu: "Cardiac",
    turnaroundMin: 45, cost: 3500,
    match: ["arterial doppler", "doppler", "lower limb doppler", "arterial duplex", "peripheral doppler", "leg doppler", "duplex"],
    normal: () => ({ report: "Triphasic waveforms throughout the aorto-iliac, femoro-popliteal and tibial segments bilaterally. Peak systolic velocities within normal limits." }),
  },

  /* ---- Imaging -------------------------------------------------------- */
  {
    id: "cxr", name: "Chest X-ray PA", short: "CXR", category: "imaging", menu: "Imaging",
    turnaroundMin: 20, cost: 450,
    match: ["cxr", "chest x ray", "chest xray", "x ray chest", "xray chest", "chest radiograph", "chest film", "x ray chest pa", "chest pa", "x ray", "xray", "radiograph"],
    normal: (c) => ({
      media: {
        spec: { kind: "xray", view: "PA", features: [{ id: "normal" }], seed: c.seed },
        alt: "Posteroanterior chest radiograph.",
        caption: "PA erect · adequate inspiration",
      },
      report: "Trachea central. Cardiothoracic ratio 0.45. Lung fields clear. Costophrenic angles sharp. Domes of diaphragm normal. No gas under the diaphragm.",
    }),
  },
  {
    id: "xray-abdomen", name: "X-ray abdomen erect", short: "AXR", category: "imaging", menu: "Imaging",
    turnaroundMin: 20, cost: 450,
    match: ["xray abdomen", "x ray abdomen", "abdominal x ray", "erect abdomen", "axr", "plain abdomen", "x ray erect abdomen"],
    normal: () => ({ report: "Normal bowel gas pattern. No dilated loops. No air–fluid levels. No free gas under the diaphragm." }),
  },
  {
    id: "usg-abdomen", name: "USG abdomen & pelvis", short: "USG abdomen", category: "imaging", menu: "Imaging",
    turnaroundMin: 30, cost: 1200,
    match: ["usg", "usg abdomen", "ultrasound", "ultrasound abdomen", "sonography", "usg whole abdomen", "usg kub", "abdominal ultrasound", "pelvic ultrasound"],
    normal: (c) => ({
      media: {
        spec: { kind: "usg", view: "Right iliac fossa, linear probe", features: [{ id: "normal" }], seed: c.seed },
        alt: "Greyscale ultrasound image of the abdomen.",
        caption: "Curvilinear 3.5 MHz · survey",
      },
      report: "Liver 13.2 cm, normal echotexture. Gallbladder distended, wall 2 mm, no calculi. CBD 4 mm. Pancreas, spleen and both kidneys normal in size and echotexture. Urinary bladder normal. No free fluid. No collection.",
    }),
  },
  {
    id: "ct-abdomen", name: "CECT abdomen & pelvis", short: "CECT abdomen", category: "imaging", menu: "Imaging",
    turnaroundMin: 60, cost: 6500,
    match: ["ct abdomen", "cect abdomen", "ct scan abdomen", "ct abdomen pelvis", "cect", "ncct abdomen", "ct kub"],
    normal: () => ({ report: "Solid organs unremarkable. Bowel loops normal in calibre and wall thickness. No free fluid or free gas. No lymphadenopathy." }),
  },
  {
    id: "ct-head", name: "NCCT head", short: "CT head", category: "imaging", menu: "Imaging",
    turnaroundMin: 30, cost: 3000,
    match: ["ct head", "ncct head", "ct brain", "ncct brain", "head ct", "plain ct head"],
    normal: () => ({ report: "No intracranial haemorrhage. No mass effect or midline shift. Ventricles and sulci normal for age. Grey–white differentiation preserved." }),
  },
  {
    id: "hrct", name: "HRCT chest", short: "HRCT", category: "imaging", menu: "Imaging",
    turnaroundMin: 45, cost: 5000,
    match: ["hrct", "hrct chest", "ct chest", "cect chest"],
    normal: () => ({ report: "Lung parenchyma clear. No ground-glass opacity, consolidation or nodules. Mediastinum normal. No pleural effusion." }),
  },
  {
    id: "mri-brain", name: "MRI brain", short: "MRI brain", category: "imaging", menu: "Imaging",
    turnaroundMin: 120, cost: 8000,
    match: ["mri", "mri brain", "mri head", "brain mri"],
    normal: () => ({ report: "Brain parenchyma normal in signal intensity. No diffusion restriction. Ventricles normal. No mass lesion." }),
  },
  {
    id: "mri-spine", name: "MRI spine", short: "MRI spine", category: "imaging", menu: "Imaging",
    turnaroundMin: 120, cost: 8500,
    match: ["mri spine", "mri ls spine", "mri lumbar", "mri cervical", "spine mri", "mri lumbosacral"],
    normal: () => ({ report: "Normal vertebral alignment and marrow signal. Intervertebral discs preserved. No canal or foraminal stenosis." }),
  },
  {
    id: "fundoscopy-photo", name: "Fundus photography", short: "Fundus photo", category: "imaging", menu: "Imaging",
    turnaroundMin: 15, cost: 600,
    match: ["fundus photo", "fundus photography", "retinal photo", "fundus camera"],
    normal: (c) => ({
      media: { spec: { kind: "fundus", view: "Posterior pole, right eye", features: [{ id: "normal" }], seed: c.seed }, alt: "Colour fundus photograph of the posterior pole.", caption: "45° · posterior pole" },
    }),
  },

  /* ---- Dermatology ---------------------------------------------------- */
  {
    id: "koh", name: "KOH mount", short: "KOH mount", category: "bedside", menu: "Dermatology",
    turnaroundMin: 15, cost: 150,
    match: ["koh", "koh mount", "koh smear", "skin scraping", "potassium hydroxide", "scraping for fungus", "fungal scraping"],
    normal: () => ({ report: "10% KOH preparation of skin scrapings: no fungal elements seen." }),
  },
  {
    id: "fungal-culture", name: "Fungal culture", short: "Fungal C/S", category: "micro", menu: "Dermatology",
    turnaroundMin: 20160, cost: 900,
    match: ["fungal culture", "sda culture", "dermatophyte culture"],
    normal: () => ({ report: "No growth at 3 weeks." }),
  },
  {
    id: "tzanck", name: "Tzanck smear", short: "Tzanck", category: "bedside", menu: "Dermatology",
    turnaroundMin: 20, cost: 200,
    match: ["tzanck", "tzanck smear"],
    normal: () => ({ report: "No acantholytic or multinucleated giant cells seen." }),
  },
  {
    id: "skin-biopsy", name: "Skin biopsy (histopathology)", short: "Skin biopsy", category: "histopath", menu: "Dermatology",
    turnaroundMin: 7200, cost: 2500,
    match: ["skin biopsy", "punch biopsy", "biopsy", "histopathology", "hpe", "incisional biopsy"],
    normal: () => ({ report: "Epidermis and dermis within normal histological limits." }),
  },
  {
    id: "patch-test", name: "Patch test", short: "Patch test", category: "function", menu: "Dermatology",
    turnaroundMin: 2880, cost: 3000,
    match: ["patch test", "patch testing", "indian standard series"],
    normal: () => ({ report: "Indian Standard Series: no positive reactions at 48 and 96 hours." }),
  },
  {
    id: "hormonal-profile", name: "Hormonal profile (LH, FSH, testosterone, DHEAS)", short: "Hormones", category: "lab", menu: "Blood",
    turnaroundMin: 180, cost: 2800,
    match: ["hormonal profile", "hormone profile", "lh fsh", "testosterone", "dheas", "pcos profile", "free testosterone", "androgen"],
    normal: (c) => ({
      rows: female(c)
        ? [
            row("LH", "6.2", "mIU/mL", "2.4–12.6"),
            row("FSH", "5.8", "mIU/mL", "3.5–12.5"),
            row("Total testosterone", "28", "ng/dL", "8–48"),
            row("DHEA-S", "180", "µg/dL", "98–340"),
            row("Prolactin", "12", "ng/mL", "4.8–23.3"),
          ]
        : [row("Total testosterone", "520", "ng/dL", "264–916")],
    }),
  },
  {
    id: "spirometry", name: "Spirometry", short: "Spirometry", category: "function", menu: "Bedside",
    turnaroundMin: 20, cost: 900,
    match: ["spirometry", "pft", "pulmonary function", "lung function test"],
    normal: () => ({
      rows: [
        row("FEV₁", "92", "% predicted", "> 80"),
        row("FVC", "94", "% predicted", "> 80"),
        row("FEV₁/FVC", "0.80", undefined, "> 0.70"),
      ],
    }),
  },
];

export function catalogInvestigation(id: string): CatalogInvestigation | undefined {
  return INVESTIGATIONS.find((i) => i.id === id);
}

/* -------------------------------------------------------------------------- */
/* Examination                                                                 */
/* -------------------------------------------------------------------------- */

export interface CatalogExam {
  id: string;
  label: string;
  group: "general-exam" | "systemic-exam" | "local-exam";
  match: string[];
  finding: string;
  durationMin: number;
  /** Vitals revealed as part of this examination. */
  revealsVitals?: VitalKey[];
  /** Exam ids this composite examination also covers. */
  covers?: string[];
}

export const EXAMS: CatalogExam[] = [
  {
    id: "general", label: "General examination", group: "general-exam", durationMin: 3,
    match: ["general examination", "general exam", "gpe", "general physical examination", "general physical", "general appearance", "general survey", "look at the patient", "examine the patient", "examine patient", "examine him", "examine her", "examine the child", "examine the baby", "physical examination", "physical exam", "full examination", "complete examination", "head to toe"],
    finding: "Conscious, oriented, comfortable at rest. No pallor, icterus, cyanosis, clubbing, lymphadenopathy or pedal oedema.",
    covers: ["pallor", "icterus", "cyanosis", "clubbing", "lymph-nodes", "oedema"],
  },
  { id: "pallor", label: "Pallor", group: "general-exam", durationMin: 1, match: ["pallor", "pale", "anaemia", "anemia", "conjunctiva"], finding: "No pallor." },
  { id: "icterus", label: "Icterus", group: "general-exam", durationMin: 1, match: ["icterus", "jaundice", "sclera", "yellow eyes"], finding: "No icterus." },
  { id: "cyanosis", label: "Cyanosis", group: "general-exam", durationMin: 1, match: ["cyanosis", "cyanotic"], finding: "No central or peripheral cyanosis." },
  { id: "clubbing", label: "Clubbing", group: "general-exam", durationMin: 1, match: ["clubbing", "nails"], finding: "No clubbing." },
  { id: "lymph-nodes", label: "Lymph nodes", group: "general-exam", durationMin: 1, match: ["lymph nodes", "lymph node", "lymphadenopathy", "nodes", "neck nodes", "inguinal nodes", "axillary nodes"], finding: "No significant lymphadenopathy." },
  { id: "oedema", label: "Pedal oedema", group: "general-exam", durationMin: 1, match: ["pedal oedema", "pedal edema", "oedema", "edema", "leg swelling", "pitting"], finding: "No pedal oedema." },
  { id: "hydration", label: "Hydration", group: "general-exam", durationMin: 1, match: ["hydration", "dehydration", "skin turgor", "tongue", "mucous membranes", "dry tongue"], finding: "Tongue moist. Skin turgor normal." },
  { id: "crt", label: "Capillary refill", group: "general-exam", durationMin: 1, match: ["capillary refill", "crt", "peripheral perfusion", "cold peripheries", "peripheries"], finding: "Capillary refill < 2 s. Peripheries warm." },
  { id: "jvp", label: "JVP", group: "general-exam", durationMin: 1, match: ["jvp", "jugular venous pressure", "neck veins", "jugular"], finding: "JVP not raised." },
  {
    id: "cvs", label: "Cardiovascular", group: "systemic-exam", durationMin: 2,
    match: ["cvs", "cardiovascular", "cardiovascular examination", "heart", "heart sounds", "auscultate heart", "auscultate the heart", "cardiac examination", "precordium", "murmur", "murmurs", "s1 s2"],
    finding: "Apex in the 5th intercostal space, mid-clavicular line. S1 and S2 normal. No murmurs, rubs or gallops.",
  },
  {
    id: "rs", label: "Respiratory", group: "systemic-exam", durationMin: 2,
    match: ["rs", "respiratory", "respiratory examination", "respiratory system", "chest", "chest examination", "lungs", "auscultate chest", "auscultate the chest", "auscultate lungs", "breath sounds", "air entry", "crepitations", "creps", "wheeze", "crackles"],
    finding: "Trachea central. Chest expansion symmetrical. Bilateral equal air entry. Normal vesicular breath sounds. No added sounds.",
  },
  {
    id: "abdomen", label: "Abdomen", group: "systemic-exam", durationMin: 3,
    match: ["abdomen", "abdominal", "abdominal examination", "per abdomen", "pa", "p a", "palpate abdomen", "palpate the abdomen", "examine abdomen", "examine the abdomen", "belly", "tummy", "bowel sounds", "organomegaly", "liver", "spleen", "hepatomegaly", "splenomegaly", "guarding", "rigidity", "tenderness"],
    finding: "Abdomen soft, non-tender. No guarding or rigidity. No organomegaly. Bowel sounds present and normal.",
  },
  {
    id: "cns", label: "Neurological", group: "systemic-exam", durationMin: 4,
    match: ["cns", "neuro", "neurological", "neurological examination", "neurology exam", "reflexes", "power", "tone", "sensation", "sensory", "plantar", "plantars", "cranial nerves", "higher mental functions", "monofilament", "vibration sense", "ankle reflex"],
    finding: "Higher mental functions intact. Cranial nerves normal. Tone, power and reflexes normal in all four limbs. Plantars flexor. Sensation intact to light touch, pinprick, vibration and 10 g monofilament.",
  },
  {
    id: "msk", label: "Musculoskeletal", group: "systemic-exam", durationMin: 2,
    match: ["musculoskeletal", "joints", "joint examination", "spine", "back examination", "gait", "range of movement", "rom", "slr", "straight leg raise"],
    finding: "Gait normal. Joints: no swelling, tenderness or restriction. Spine non-tender. Straight-leg raise negative bilaterally.",
  },
  {
    id: "peripheral-pulses", label: "Peripheral pulses", group: "systemic-exam", durationMin: 2,
    match: ["peripheral pulses", "foot pulses", "pedal pulses", "dorsalis pedis", "posterior tibial", "femoral pulse", "femoral pulses", "popliteal pulse", "leg pulses", "dpa", "pta"],
    finding: "Femoral, popliteal, dorsalis pedis and posterior tibial pulses palpable and equal bilaterally.",
  },
  {
    id: "feet", label: "Foot examination", group: "local-exam", durationMin: 2,
    match: ["feet", "foot", "foot examination", "diabetic foot", "examine feet", "examine the feet", "toes", "ulcer", "callus"],
    finding: "Skin intact. No ulceration, callus or deformity. Normal hair distribution. Feet warm.",
  },
  {
    id: "skin", label: "Skin", group: "local-exam", durationMin: 2,
    match: ["skin", "skin examination", "rash", "lesion", "lesions", "examine skin", "examine the skin"],
    finding: "No rash or significant lesions.",
  },
  {
    id: "dermoscopy", label: "Dermoscopy", group: "local-exam", durationMin: 3,
    match: ["dermoscopy", "dermatoscopy", "dermatoscope", "dermoscope", "epiluminescence"],
    finding: "No specific dermoscopic features.",
  },
  {
    id: "woods-lamp", label: "Wood's lamp", group: "local-exam", durationMin: 2,
    match: ["woods lamp", "wood lamp", "woods light", "uv lamp", "wood s lamp"],
    finding: "No fluorescence or accentuation under Wood's light.",
  },
  {
    id: "ent", label: "ENT", group: "systemic-exam", durationMin: 2,
    match: ["ent", "throat", "ear", "ears", "nose", "tonsils", "pharynx", "otoscopy", "oral cavity", "mouth"],
    finding: "Oral cavity and pharynx normal. Tympanic membranes intact. Nasal passages clear.",
  },
  {
    id: "eyes", label: "Eyes", group: "systemic-exam", durationMin: 2,
    match: ["eyes", "eye examination", "pupils", "visual acuity", "fundus", "fundoscopy", "ophthalmoscopy"],
    finding: "Pupils equal and reactive. Visual acuity grossly normal. Fundus: disc margins sharp, no haemorrhages or exudates.",
  },
  {
    id: "thyroid", label: "Thyroid", group: "local-exam", durationMin: 1,
    match: ["thyroid", "neck swelling", "goitre", "goiter"],
    finding: "Thyroid not palpable. No neck swelling.",
  },
  {
    id: "pr", label: "Per-rectal", group: "local-exam", durationMin: 3,
    match: ["per rectal", "pr examination", "dre", "digital rectal", "rectal examination"],
    finding: "Performed with a chaperone. Normal anal tone. No tenderness, mass or blood on the glove.",
  },
  {
    id: "genital", label: "Genital", group: "local-exam", durationMin: 3,
    match: ["genital", "genitals", "genital examination", "external genitalia", "per vaginal", "pv", "speculum"],
    finding: "Performed with a chaperone. External genitalia normal.",
  },
  {
    id: "breast", label: "Breast", group: "local-exam", durationMin: 3,
    match: ["breast", "breast examination", "breasts"],
    finding: "Performed with a chaperone. No lumps, skin changes or nipple discharge.",
  },
];

export function catalogExam(id: string): CatalogExam | undefined {
  return EXAMS.find((e) => e.id === id);
}

/* -------------------------------------------------------------------------- */
/* Supportive measures & generic procedures                                    */
/* -------------------------------------------------------------------------- */

export interface CatalogMeasure {
  id: string;
  label: string;
  kind: "supportive" | "procedure" | "monitor" | "disposition";
  match: string[];
  durationMin: number;
  /** Objective note recorded for the action. */
  note: string;
}

export const MEASURES: CatalogMeasure[] = [
  { id: "oxygen", label: "Supplemental oxygen", kind: "supportive", durationMin: 1, match: ["oxygen", "o2", "nasal prongs", "nasal cannula", "face mask", "nrbm", "non rebreather", "venturi", "put on oxygen", "start oxygen"], note: "Oxygen started." },
  { id: "niv", label: "Non-invasive ventilation", kind: "supportive", durationMin: 5, match: ["niv", "bipap", "cpap", "non invasive ventilation", "noninvasive ventilation"], note: "NIV started via full-face mask." },
  { id: "intubation", label: "Intubation", kind: "procedure", durationMin: 10, match: ["intubate", "intubation", "et tube", "endotracheal", "rsi", "rapid sequence", "mechanical ventilation", "ventilator"], note: "Rapid-sequence intubation; tube confirmed with waveform capnography." },
  { id: "iv-access", label: "IV access", kind: "supportive", durationMin: 2, match: ["iv access", "iv line", "cannula", "cannulate", "secure iv", "secure line", "wide bore", "18g", "16g", "iv cannula", "two large bore"], note: "IV access secured." },
  { id: "npo", label: "Nil by mouth", kind: "supportive", durationMin: 0, match: ["npo", "nil by mouth", "nil per oral", "nothing by mouth", "keep fasting", "keep nbm", "nbm"], note: "Kept nil by mouth." },
  { id: "propped-up", label: "Propped up", kind: "supportive", durationMin: 0, match: ["prop up", "propped up", "sit up", "sit him up", "sit her up", "head end elevation", "upright", "fowler", "semi fowler", "head up"], note: "Positioned upright." },
  { id: "legs-raised", label: "Legs raised", kind: "supportive", durationMin: 0, match: ["raise legs", "legs raised", "leg raise", "lie flat", "lay flat", "supine", "trendelenburg", "elevate legs", "raise the legs"], note: "Laid flat with legs raised." },
  { id: "catheter", label: "Urinary catheter", kind: "procedure", durationMin: 5, match: ["catheter", "catheterise", "catheterize", "foley", "foleys", "urinary catheter", "folley"], note: "Foley catheter inserted; urine output charting started." },
  { id: "ryles", label: "Nasogastric tube", kind: "procedure", durationMin: 5, match: ["ryles", "ryle s tube", "ryles tube", "ng tube", "nasogastric", "rt insertion"], note: "Nasogastric tube inserted and position confirmed." },
  { id: "monitor", label: "Continuous monitoring", kind: "monitor", durationMin: 1, match: ["monitor", "cardiac monitor", "attach monitor", "multipara monitor", "continuous monitoring", "put on monitor", "monitoring", "keep under observation", "observe", "observation", "close monitoring", "hourly vitals"], note: "Continuous monitoring started." },
  { id: "cpr", label: "CPR", kind: "procedure", durationMin: 2, match: ["cpr", "chest compressions", "start cpr", "code blue", "resuscitate", "acls"], note: "CPR initiated per ACLS." },
  { id: "defib", label: "Defibrillation", kind: "procedure", durationMin: 1, match: ["defibrillate", "defibrillation", "shock", "dc shock", "cardiovert", "cardioversion"], note: "Synchronised/unsynchronised shock delivered as indicated." },
  { id: "cold-sponging", label: "Tepid sponging", kind: "supportive", durationMin: 5, match: ["sponging", "tepid sponging", "cold sponging", "cooling"], note: "Tepid sponging done." },
  { id: "dressing", label: "Wound dressing", kind: "procedure", durationMin: 10, match: ["dressing", "wound care", "clean the wound", "debridement"], note: "Wound cleaned and dressed." },
  { id: "admit", label: "Admit", kind: "disposition", durationMin: 5, match: ["admit", "admission", "admit the patient", "admit him", "admit her", "shift to ward", "shift to icu", "icu admission", "hospitalise", "hospitalize"], note: "Admitted." },
  { id: "discharge", label: "Discharge", kind: "disposition", durationMin: 2, match: ["discharge", "send home", "can go home", "discharge the patient", "send him home", "send her home"], note: "Discharged." },
  { id: "refer", label: "Referral", kind: "disposition", durationMin: 2, match: ["refer", "referral", "consult", "consultation", "opinion", "call surgeon", "call cardiology", "call medicine"], note: "Referral made." },
  { id: "stop-fluids", label: "Stop IV fluids", kind: "supportive", durationMin: 0, match: ["stop fluids", "stop iv fluids", "stop the fluids", "stop ns", "stop saline", "fluid restriction", "restrict fluids", "stop infusion"], note: "IV fluids stopped." },
  { id: "stop-drug", label: "Stop medication", kind: "supportive", durationMin: 0, match: ["stop the drug", "stop medication", "stop the medicine", "discontinue", "withhold", "stop all medicines", "hold the", "stop nsaid", "stop nsaids", "stop painkiller", "stop painkillers", "stop the painkiller", "stop the tablets"], note: "Medication withheld." },
  { id: "oral-glucose", label: "Oral glucose", kind: "supportive", durationMin: 1, match: ["oral glucose", "sugar water", "glucose powder", "glucon d", "give sugar", "sweet drink", "fruit juice", "glucose drink"], note: "Oral glucose given." },
];

export function catalogMeasure(id: string): CatalogMeasure | undefined {
  return MEASURES.find((m) => m.id === id);
}

/* -------------------------------------------------------------------------- */
/* History topics (menu + fallbacks)                                           */
/* -------------------------------------------------------------------------- */

export interface HistoryTopic {
  id: string;
  label: string;
  /** What gets placed in the composer when the topic is chosen from the menu. */
  prompt: string;
}

export const HISTORY_TOPICS: HistoryTopic[] = [
  { id: "complaint", label: "Chief complaint", prompt: "What brings you here today?" },
  { id: "hpi", label: "History of present illness", prompt: "Tell me more about it — when did it start and how has it changed?" },
  { id: "past", label: "Past history", prompt: "Any medical conditions in the past — diabetes, BP, thyroid, TB, asthma?" },
  { id: "medication", label: "Medications", prompt: "Are you taking any medicines at the moment?" },
  { id: "allergy", label: "Allergies", prompt: "Are you allergic to any medicine?" },
  { id: "family", label: "Family history", prompt: "Does anyone in the family have similar problems or any illnesses?" },
  { id: "social", label: "Social history", prompt: "Do you smoke or drink alcohol? What work do you do?" },
  { id: "diet", label: "Diet", prompt: "What does a typical day of eating look like?" },
  { id: "sexual", label: "Sexual history", prompt: "Any concerns related to sexual health?" },
  { id: "obstetric", label: "Menstrual & obstetric", prompt: "Are your periods regular? Any pregnancies?" },
  { id: "systemic", label: "Systemic review", prompt: "Any fever, weight loss, breathlessness, chest pain or urinary problems?" },
];
