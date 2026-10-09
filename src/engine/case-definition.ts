/**
 * Server-only clinical case definitions.
 *
 * A `ClinicalCaseDefinition` is the hidden truth of a case. It is consumed by
 * the engine on the server and is NEVER sent to the browser while the case is
 * active. Teaching content embedded here is only released after case closure.
 *
 * Authoring notes
 * ───────────────
 * • `match` phrases are lowercase. The engine normalises player input
 *   (abbreviations expanded, punctuation stripped, light stemming) and matches
 *   phrases as whole token sequences. Prefer several short phrases.
 * • Anything not defined here falls back to the global catalogues
 *   (`catalog.ts`, `formulary.ts`), which return normal findings or plausible
 *   negatives. Author every POSITIVE finding explicitly.
 * • To override a catalogue examination or investigation, reuse its id.
 * • Patient replies are spoken words — human, specific, free of jargon.
 */

import type {
  CareLevel,
  CareSetting,
  CaseDebrief,
  CaseTrack,
  DebriefMiss,
  DrugRoute,
  FactGroup,
  InvestigationCategory,
  LabRow,
  MediaAsset,
  MessageKind,
  MessageRole,
  PatientIdentity,
  PatientStatus,
  Specialty,
  VitalKey,
  VitalPatch,
} from "./types";

export type Importance = "essential" | "useful" | "minor";

/* -------------------------------------------------------------------------- */
/* History & examination                                                       */
/* -------------------------------------------------------------------------- */

export interface HistoryEntry {
  id: string;
  group: FactGroup;
  /** Short label for the patient panel, e.g. "Duration". */
  label: string;
  match: string[];
  /** What the patient (or attendant) says. */
  reply: string;
  /** Compact structured fact recorded in the panel. Defaults to `reply`. */
  fact?: string;
  abnormal?: boolean;
  importance: Importance;
  /** Who answers. Defaults to the patient. */
  speaker?: "patient" | "attendant";
}

export interface ExamEntry {
  id: string;
  group: Extract<FactGroup, "general-exam" | "systemic-exam" | "local-exam">;
  label: string;
  match: string[];
  /** Objective finding, written as the examiner observes it. Never a diagnosis. */
  finding: string;
  fact?: string;
  abnormal?: boolean;
  importance: Importance;
  /** Optional patient reaction (e.g. wincing on palpation). */
  patientReaction?: string;
  /** Media revealed by this examination (close-up, dermoscopy). */
  media?: MediaAsset;
  durationMin?: number;
}

/* -------------------------------------------------------------------------- */
/* Investigations                                                              */
/* -------------------------------------------------------------------------- */

export interface InvestigationPhase {
  /** Applies to orders placed at or after this sim minute. */
  fromMin: number;
  rows?: LabRow[];
  report?: string;
  media?: MediaAsset;
}

export interface InvestigationOverride {
  /** Catalogue id (see `catalog.ts`), or a case-specific id. */
  id: string;
  /** Required only for case-specific tests not in the catalogue. */
  name?: string;
  short?: string;
  category?: InvestigationCategory;
  match?: string[];
  turnaroundMin?: number;
  cost?: number;
  rows?: LabRow[];
  media?: MediaAsset;
  report?: string;
  /** Time-varying results (e.g. a falling platelet count). Latest phase wins. */
  phases?: InvestigationPhase[];
  /** Suppress the catalogue's default image (when the case gives a report only). */
  noMedia?: boolean;
  /** Lowest care level that can perform a case-specific test (default: district hospital). */
  minLevel?: CareLevel;
  /** Rubric value for this specific case. */
  priority: "essential" | "useful" | "situational" | "unnecessary";
  teaching: { whenToOrder: string; whatItTellsYou: string };
}

/* -------------------------------------------------------------------------- */
/* Therapeutics                                                                */
/* -------------------------------------------------------------------------- */

/** Clinical appropriateness of an action in the context of THIS case. */
export type Appropriateness = "ideal" | "acceptable" | "neutral" | "unnecessary" | "harmful" | "dangerous";

export interface TherapeuticRule {
  id: string;
  kind: "drug" | "procedure" | "counsel" | "referral" | "admit" | "discharge" | "supportive";
  /** Formulary drug ids this rule covers. */
  drugIds?: string[];
  /** Formulary drug classes this rule covers. */
  drugClasses?: string[];
  /** Catalogue measure ids this rule covers (oxygen, niv, admit…). */
  measureIds?: string[];
  /**
   * Counselling rules only: drug ids or classes this advice is about. Saying
   * "stop X" or "avoid X" for a matching drug executes this rule.
   */
  concernsDrugs?: string[];
  /** Free phrases (procedures, counselling, supportive measures). */
  match?: string[];
  label: string;
  appropriateness: Appropriateness;
  /** Safe dose window; doses outside it are scored as dose errors. */
  doseRange?: { min: number; max: number; unit: string };
  /** Frequencies that make this order wrong, e.g. daily methotrexate. */
  wrongFrequencies?: string[];
  /** Observable response to this action. */
  response?: { role: MessageRole; kind: MessageKind; text: string }[];
  /** Hazard armed by this action. */
  arms?: string;
  /** Hazards this action contributes to rescuing. */
  rescues?: string[];
  /** Objective procedural / operative note. */
  note?: string;
  /** Alternative note used when a hazard has already manifested (e.g. perforation found at surgery). */
  altNote?: { ifHazard: string; note: string };
  /** Minutes the action consumes on the sim clock. */
  durationMin?: number;
  /** Status the patient moves to after this action. */
  statusAfter?: PatientStatus;
  /** Care setting the patient moves to after this action. */
  settingAfter?: CareSetting;
  /** Vitals the underlying physiology moves to after this action. */
  vitalsAfter?: VitalPatch[];
  /** Debrief critique when this action was taken and was not ideal. */
  critique?: DebriefMiss;
  /** Debrief strength line when this action was taken. */
  praise?: string;
}

/* -------------------------------------------------------------------------- */
/* Hazards — the consequence & rescue mechanic                                 */
/* -------------------------------------------------------------------------- */

export interface HazardStage {
  /** Minutes after the hazard is armed. */
  afterMin: number;
  status: PatientStatus;
  vitals: VitalPatch[];
  /** Observable sign surfaced by the patient, an attendant or nursing staff. */
  observation?: { role: MessageRole; text: string };
  /** Examination findings that change while this stage is current (by exam id). */
  examFindings?: Partial<Record<string, string>>;
  /** What the patient says if asked how they feel during this stage. */
  patientSays?: string;
  /** Results returned while this stage is current. */
  investigations?: Partial<Record<string, { rows?: LabRow[]; report?: string; media?: MediaAsset }>>;
  /** Patient moves to a different care setting (e.g. brought to the ER). */
  setting?: CareSetting;
  /** Time-jumps (follow-up, waiting) stop here so the player can respond. */
  interrupts?: boolean;
}

export interface HazardDefinition {
  id: string;
  label: string;
  /** Additional arming conditions evaluated when a trigger fires. */
  condition?: {
    /** Cumulative IV crystalloid volume (mL) that must be exceeded. */
    minFluidMl?: number;
    /** Frequency strings that arm the hazard, e.g. ["OD","BD","TDS"]. */
    frequencyAnyOf?: string[];
  };
  /** Omission hazard: arms when the clock passes `byMinute` and none of `preventedBy` was done. */
  omission?: { byMinute: number; preventedBy: string[] };
  /** Delay before stage timings begin when the order is a take-home prescription. */
  prescribedOnsetMin?: number;
  stages: HazardStage[];
  /**
   * AND-of-ORs over therapeutic rule ids, catalogue measure ids ("measure:oxygen")
   * or formulary drug ids ("drug:adrenaline"). Every inner group needs one member.
   */
  rescue: string[][];
  /** Minutes after arming in which rescue gives a full recovery. */
  fullRecoveryWindowMin: number;
  /** Minutes after arming beyond which rescue is no longer possible. */
  lastRescueMin: number;
  recovery: HazardStage[];
  review: {
    cause: string;
    whyItCausedHarm: string;
    earliestRescueWindow: string;
    correctRescueSequence: string[];
    lastRealisticRescueWindow: string;
  };
}

/* -------------------------------------------------------------------------- */
/* Patient safety profile — drives the global safety layer                    */
/* -------------------------------------------------------------------------- */

export interface PatientProfile {
  /** Formulary drug ids or classes that trigger anaphylaxis. */
  allergies?: string[];
  /** Formulary drug ids the patient currently takes. */
  currentDrugs?: string[];
  /** Female of reproductive age without reliable contraception. */
  pregnancyPossible?: boolean;
  pregnant?: boolean;
  asthma?: boolean;
  ckd?: boolean;
  heartFailure?: boolean;
  thrombocytopenia?: boolean;
  /** Cumulative IV crystalloid (mL) above which pulmonary oedema develops. */
  fluidToleranceMl?: number;
  weightKg?: number;
}

/* -------------------------------------------------------------------------- */
/* Follow-up & rubric                                                          */
/* -------------------------------------------------------------------------- */

export interface FollowUpScenario {
  /** Treatment quality this scenario applies to. First match wins. */
  when: "ideal" | "acceptable" | "harmful" | "untreated" | "any";
  lines: { role: MessageRole; kind: MessageKind; text: string; media?: MediaAsset }[];
  status: PatientStatus;
  vitals?: VitalPatch[];
  facts?: { group: FactGroup; label: string; value: string; abnormal?: boolean }[];
}

export type ScoreWeights = Partial<Record<
  | "history" | "examination" | "differential" | "investigationSelection"
  | "investigationInterpretation" | "treatment" | "drugSafety"
  | "reassessment" | "efficiency" | "outcome",
  number
>>;

export interface CaseRubric {
  /** Accepted final diagnoses, lowercase phrases. */
  diagnosisAccept: string[];
  /** Partially correct diagnoses (right family, wrong specificity). */
  diagnosisPartial: string[];
  /** Reasonable differentials worth credit when stated. */
  differentials: string[];
  /** Ideal treatment: AND-of-ORs over therapeutic rule ids. */
  idealTreatment: string[][];
  /** Number of player actions an expert would need. */
  expertActionCount: number;
  /** Sensible follow-up interval, in days. */
  followUpDays?: { min: number; max: number };
  /** Whether reassessment (repeat vitals / response check) is expected. */
  expectsReassessment: boolean;
  /** Definitive treatment (any of these rule ids) expected by this sim minute. */
  definitiveTreatment?: { ids: string[]; byMinute: number; label: string };
  /** Category weights (total 100). Omitted categories use defaults. */
  weights?: ScoreWeights;
  /** Miss templates keyed by history / exam / investigation / therapeutic id. */
  misses: Record<string, DebriefMiss>;
  /** Strength lines keyed by history / exam / investigation / therapeutic id. */
  strengths: Record<string, string>;
}

/* -------------------------------------------------------------------------- */
/* The case                                                                    */
/* -------------------------------------------------------------------------- */

export interface OpeningBeat {
  role: MessageRole;
  kind: MessageKind;
  text: string;
  media?: MediaAsset;
}

export interface ClinicalCaseDefinition {
  id: string;
  /** The guided demo case: on-screen tips are allowed, and it's never picked at random. */
  guided?: boolean;
  specialty: Specialty;
  track: CaseTrack;
  level: CareLevel;
  setting: CareSetting;
  /** Phone cases: vitals the caller can measure at home (BP machine, glucometer…). */
  phoneVitals?: VitalKey[];
  /** Relative weight for random selection. Dermatology and common OPD weigh more. */
  weight: number;
  difficulty: 1 | 2 | 3;
  patient: PatientIdentity;
  /** Minute-of-day at arrival, e.g. 10:42 → 642. */
  arrivalMinuteOfDay: number;
  /** One-line, non-diagnostic briefing shown before the encounter. */
  briefing: string;
  opening: OpeningBeat[];

  /** Patient status at arrival. Defaults to "stable". */
  initialStatus?: PatientStatus;

  /** Underlying physiology. Revealed only when measured. */
  baselineVitals: Partial<Record<VitalKey, VitalPatch>>;
  /** Vitals measured at triage and visible from the start (ER cases). */
  triageVitals?: VitalKey[];
  profile: PatientProfile;

  history: HistoryEntry[];
  exam: ExamEntry[];
  investigations: InvestigationOverride[];
  therapeutics: TherapeuticRule[];
  hazards: HazardDefinition[];
  /**
   * What changes the moment the patient responds to the definitive treatment
   * (case-specific values on top of the generic settling of vitals).
   */
  onResponse?: {
    vitals?: VitalPatch[];
    examFindings?: Partial<Record<string, string>>;
    /** What the patient says when asked how they feel from now on. */
    patientSays?: string;
    /** A line the patient says as they respond. */
    says?: string;
  };
  followUp: FollowUpScenario[];

  truth: {
    diagnosis: string;
    qualifier?: string;
    reasoning: CaseDebrief["reasoning"];
  };
  rubric: CaseRubric;

  /** Static teaching content, released at closure only. */
  teaching: Pick<
    CaseDebrief,
    "severityBands" | "treatmentByBand" | "drugs" | "routines" | "followUp" | "treatmentFailure" | "pearl"
  > & {
    /** Counterfactual teaching shown when no deterioration occurred. */
    hazardTeaching?: { title: string; body: string; sequence: string[] };
    /** Teaching notes for investigations not overridden by the case. */
    extraInvestigations?: CaseDebrief["investigations"];
    /** Id of the severity band this patient falls in. */
    patientBand?: string;
  };
}

/** A dose the engine parsed from free text. */
export interface ParsedDose {
  amount?: number;
  unit?: string;
  text?: string;
  route?: DrugRoute;
  frequency?: string;
  duration?: string;
  volumeMl?: number;
}
