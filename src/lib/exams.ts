/**
 * Exam practice — the exams each country's doctors sit, and their subjects. Isomorphic: the menu and
 * pages show them, the server writes questions for them. India: NEET PG and INI-CET; the USA: USMLE;
 * the UK: UKMLA and PLAB.
 */
import type { Country } from "@/engine/countries";

export type ExamId = "neet-pg" | "ini-cet" | "usmle" | "ukmla" | "plab";

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
}

export interface ExamSet {
  id: string;
  exam: ExamId;
  subject: string;
  questions: ExamQuestion[];
}

export interface ExamStats {
  answered: number;
  correct: number;
  /** Per subject, weakest first. */
  subjects: { subject: string; answered: number; correct: number }[];
}
