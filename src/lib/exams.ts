/**
 * Exam practice — the exams each country's doctors sit, and their subjects. Isomorphic: the menu and
 * pages show them, the server writes questions for them. India: NEET PG and INI-CET, and the super-speciality NEET SS and INI-SS; the USA: USMLE;
 * the UK: UKMLA and PLAB.
 */
import type { Country } from "@/engine/countries";

export type ExamId = "neet-pg" | "ini-cet" | "neet-ss" | "ini-ss" | "usmle" | "ukmla" | "plab";

export interface ExamInfo {
  id: ExamId;
  label: string;
  /** Who sets it, for the question writer. */
  board: string;
  country: Country;
  options: 4 | 5;
  /** How its questions are written. */
  style: string;
  subjects: string[];
}

const NEET_SUBJECTS = [
  "Anatomy", "Physiology", "Biochemistry", "Pathology", "Pharmacology", "Microbiology", "Forensic Medicine", "Community Medicine (PSM)",
  "ENT", "Ophthalmology", "Medicine", "Surgery", "Obstetrics & Gynaecology", "Paediatrics", "Orthopaedics", "Dermatology", "Psychiatry", "Anaesthesia", "Radiology",
];

/** Super-speciality entrance (DM, MCh): the feeder specialities' question areas. */
const SS_SUBJECTS = [
  "Cardiology", "Neurology", "Nephrology", "Gastroenterology & Hepatology", "Endocrinology", "Clinical Haematology", "Medical Oncology", "Pulmonary & Critical Care", "Rheumatology & Clinical Immunology", "Infectious Diseases",
  "Neonatology", "Paediatric Cardiology", "Paediatric Neurology", "Paediatric Gastroenterology",
  "Cardiothoracic & Vascular Surgery", "Neurosurgery", "Urology", "Surgical Gastroenterology", "Surgical Oncology", "Plastic Surgery", "Paediatric Surgery", "Endocrine Surgery",
  "Reproductive Medicine", "Gynaecologic Oncology", "Interventional Radiology", "Cardiac Anaesthesia",
];

const UK_AREAS = [
  "Acute and emergency", "Cardiovascular", "Respiratory", "Gastrointestinal and liver", "Renal and urology", "Endocrine and metabolic", "Neurosciences", "Mental health",
  "Infection", "Clinical haematology", "Cancer", "Musculoskeletal", "Dermatology", "ENT", "Ophthalmology", "Obstetrics and gynaecology", "Child health",
  "Medicine of older adults", "Surgery", "Perioperative medicine and anaesthesia", "Sexual health", "General practice", "Clinical pharmacology and prescribing", "Ethics and law",
];

export const EXAMS: Record<ExamId, ExamInfo> = {
  "neet-pg": {
    id: "neet-pg",
    label: "NEET PG",
    board: "the National Board of Examinations",
    country: "IN",
    options: 4,
    style: "NEET PG single best answer: a one-to-three-line stem — a short clinical vignette or a direct question — and FOUR options. High-yield, as NEET PG tests: drug of choice, investigation of choice, most common cause, characteristic sign, next best step, per standard Indian textbooks and national guidelines",
    subjects: NEET_SUBJECTS,
  },
  "ini-cet": {
    id: "ini-cet",
    label: "INI-CET",
    board: "AIIMS New Delhi",
    country: "IN",
    options: 4,
    style: "INI-CET single best answer: conceptual and image-free, a little harder than NEET PG — two-step reasoning, recent advances and AIIMS-style clinical vignettes — with FOUR options, per standard Indian textbooks and national guidelines",
    subjects: NEET_SUBJECTS,
  },
  "neet-ss": {
    id: "neet-ss",
    label: "NEET SS",
    board: "the National Board of Examinations (DM/MCh entrance)",
    country: "IN",
    options: 4,
    style: "NEET SS single best answer at super-speciality level: clinical vignettes, recent trials and guidelines, investigation interpretation and advanced management in the feeder speciality, with FOUR options, per current international and Indian guidelines",
    subjects: SS_SUBJECTS,
  },
  "ini-ss": {
    id: "ini-ss",
    label: "INI-SS",
    board: "AIIMS New Delhi (super-speciality entrance)",
    country: "IN",
    options: 4,
    style: "INI-SS (AIIMS super-speciality) single best answer: conceptual and applied, recent advances, landmark trials and multi-step clinical reasoning in the feeder speciality, with FOUR options",
    subjects: SS_SUBJECTS,
  },
  usmle: {
    id: "usmle",
    label: "USMLE",
    board: "the NBME",
    country: "US",
    options: 5,
    style: "USMLE single best answer (Step 1 for basic sciences, Step 2 CK for clinical subjects): a clinical vignette (age, sex, setting, presentation, vital signs, key examination and laboratory findings) ending in one lead-in, with FIVE homogeneous options, per current US guidelines",
    subjects: ["Internal Medicine", "Surgery", "Pediatrics", "Obstetrics & Gynecology", "Psychiatry", "Neurology", "Emergency Medicine", "Biostatistics & Epidemiology", "Ethics", "Pharmacology", "Pathology", "Microbiology & Immunology", "Physiology", "Biochemistry & Genetics", "Anatomy"],
  },
  ukmla: {
    id: "ukmla",
    label: "UKMLA",
    board: "the GMC (Medical Licensing Assessment)",
    country: "UK",
    options: 5,
    style: "UKMLA Applied Knowledge Test single best answer: a short clinical vignette with one lead-in and FIVE options, mapped to the MLA content map, per NICE, CKS and the BNF",
    subjects: UK_AREAS,
  },
  plab: {
    id: "plab",
    label: "PLAB 1",
    board: "the GMC",
    country: "UK",
    options: 5,
    style: "PLAB 1 single best answer: a short clinical vignette set in UK practice (often a foundation doctor in the NHS) with one lead-in and FIVE options, per NICE, CKS, the BNF and GMC guidance",
    subjects: UK_AREAS,
  },
};

export const EXAM_IDS = Object.keys(EXAMS) as ExamId[];
export const isExamId = (x: unknown): x is ExamId => typeof x === "string" && x in EXAMS;

/** Only the exams of the country the doctor practises in. */
export const examsFor = (country: Country): ExamInfo[] => EXAM_IDS.map((id) => EXAMS[id]).filter((e) => e.country === country);

/** "Mixed" draws from every subject. */
export const MIXED = "Mixed";

/** Questions in a set. */
export const SET_SIZE = 10;

/** A question as the player sees it — the answer and explanation come only after they choose. */
export interface ExamQuestion {
  stem: string;
  options: string[];
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  /** "NEET PG 2023 pattern" — previous-year-pattern sets only. */
  pattern?: string;
}

/** Previous-year pattern (the default): topics and question patterns from recent papers. Concept: any high-yield topic. */
export type ExamStyle = "pyq" | "concept";
export const EXAM_STYLES: Record<ExamStyle, { label: string; note: string }> = {
  pyq: { label: "Previous-year pattern", note: "Topics and patterns asked in recent papers — recall-based practice, not the actual papers" },
  concept: { label: "Concept practice", note: "Any high-yield topic in the subject" },
};

export interface ExamSet {
  id: string;
  exam: ExamId;
  subject: string;
  style: ExamStyle;
  questions: ExamQuestion[];
  /** New questions couldn't be written just now: a set they've done before, to keep practising. */
  repeat?: boolean;
}

export interface ExamStats {
  answered: number;
  correct: number;
  /** Per subject, weakest first. */
  subjects: { subject: string; answered: number; correct: number }[];
}
