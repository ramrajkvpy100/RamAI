import type { Country } from "./countries";

/**
 * RamAI — core domain model.
 *
 * Everything in this file is isomorphic (safe on client and server) and fully
 * serialisable. Nothing here renders anything: presentation lives in
 * `src/components`, simulation lives in `src/engine`.
 *
 * The single most important invariant in this codebase:
 *
 *   `CaseState` contains ONLY what the player has actually obtained.
 *   The hidden truth of a case (diagnosis, severity, pending complications,
 *   rubric, rescue windows) lives in `ClinicalCaseDefinition`, which is
 *   server-only and never serialised to the browser during an active case.
 */

/* -------------------------------------------------------------------------- */
/* Identity                                                                    */
/* -------------------------------------------------------------------------- */

export type Specialty =
  | "Medicine"
  | "Dermatology"
  | "Surgery"
  | "Pediatrics"
  | "OBGYN"
  | "Emergency"
  | "Cardiology"
  | "Neurology"
  | "Respiratory"
  | "Gastroenterology"
  | "Nephrology"
  | "Endocrinology"
  | "Psychiatry"
  | "ENT"
  | "Ophthalmology"
  | "Orthopedics"
  | "Urology"
  | "Infectious Disease";

export type CareSetting = "OPD" | "IPD" | "ER" | "ICU" | "Ward" | "Teleconsult";

/** Language of patient and family speech. The doctor's side and teaching stay English. */
export type PatientLang = "en" | "hinglish";
export const PATIENT_LANGS: readonly PatientLang[] = ["en", "hinglish"] as const;

/** How the case presents. */
export type CaseTrack = "opd" | "phone" | "emergency";

/** Care level — the facility's resources and the case's difficulty, first contact → global centre of excellence. */
export type CareLevel = "phc" | "chc" | "district" | "college" | "apex" | "grandrounds";

export const CARE_LEVELS: readonly CareLevel[] = ["phc", "chc", "district", "college", "apex", "grandrounds"] as const;
export const CASE_TRACKS: readonly CaseTrack[] = ["opd", "phone", "emergency"] as const;

/* -------------------------------------------------------------------------- */
/* Vitals & observations                                                       */
/* -------------------------------------------------------------------------- */

export type VitalKey =
  | "bp"
  | "hr"
  | "rr"
  | "temp"
  | "spo2"
  | "rbs"
  | "weight"
  | "height"
  | "bmi"
  | "gcs"
  | "pain"
  | "urine";

export type Flag = "normal" | "low" | "high" | "critical" | "unknown";

export interface VitalReading {
  key: VitalKey;
  label: string;
  /** Display-ready value, e.g. "158/96". Never pre-interpreted. */
  value: string;
  unit?: string;
  /** Primary numeric for trend rendering (systolic for BP). */
  numeric?: number;
  flag: Flag;
  /** Sim-clock minute at which this reading was obtained. */
  at: number;
}

/** A measured vital, plus its history for trend display. */
export interface VitalTrack {
  current: VitalReading;
  history: VitalReading[];
}

/* -------------------------------------------------------------------------- */
/* Encounter transcript                                                        */
/* -------------------------------------------------------------------------- */

export type MessageRole = "patient" | "attendant" | "doctor" | "nurse" | "system";

/**
 * `speech`  — something a person said.
 * `action`  — what the doctor did ("Examined McBurney's point").
 * `finding` — an objective observation returned to the doctor.
 * `status`  — an environment-level notice ("Patient status changed").
 */
export type MessageKind = "speech" | "action" | "finding" | "status";

export interface EncounterMessage {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  text: string;
  /** Sim-clock minute. */
  at: number;
  /** Investigation instance ids rendered inline beneath this message. */
  attachmentIds?: string[];
  /** Clinical media shown inline (photographs, dermoscopy, tracings). */
  media?: MediaAsset;
}

/* -------------------------------------------------------------------------- */
/* Investigations                                                              */
/* -------------------------------------------------------------------------- */

export type InvestigationCategory =
  | "lab"
  | "bedside"
  | "ecg"
  | "imaging"
  | "photo"
  | "micro"
  | "histopath"
  | "function";

export interface LabRow {
  analyte: string;
  value: string;
  unit?: string;
  /** Reference interval, shown verbatim. */
  reference?: string;
  flag: Flag;
}

/* -- Procedural media -------------------------------------------------------
 * Clinical images are described as parameterised specs and rendered as vector
 * graphics at display time, so the same case can be shipped without binary
 * assets. `src` is supported for when real, licensed imagery is wired in:
 * the renderer prefers `src` whenever it is present.
 * ------------------------------------------------------------------------- */

export interface EcgSpec {
  kind: "ecg";
  /** Beats per minute. */
  rate: number;
  rhythm: "sinus" | "afib" | "aflutter" | "svt" | "vt" | "paced" | "junctional";
  /** Per-lead morphology overrides keyed by lead name. */
  morphology?: EcgMorphology;
  leads?: EcgLead[];
  /** Millimetres per second; 25 is standard. */
  paperSpeed?: 25 | 50;
}

export type EcgLead =
  | "I" | "II" | "III" | "aVR" | "aVL" | "aVF"
  | "V1" | "V2" | "V3" | "V4" | "V5" | "V6";

export interface EcgMorphology {
  /** ST deviation in mm, per lead. Positive = elevation. */
  st?: Partial<Record<EcgLead, number>>;
  /** T-wave amplitude multiplier, per lead. Negative inverts. */
  t?: Partial<Record<EcgLead, number>>;
  /** Q-wave depth in mm, per lead. */
  q?: Partial<Record<EcgLead, number>>;
  /** PR interval in ms. */
  pr?: number;
  /** QRS duration in ms. */
  qrs?: number;
  /** QT interval in ms. */
  qt?: number;
  /** Suppress P waves (AF, junctional). */
  pWaves?: boolean;
  /** Peaked T waves, e.g. hyperkalaemia. */
  peakedT?: boolean;
  /** QRS amplitude multiplier per lead (e.g. LVH voltage). */
  qrsScale?: Partial<Record<EcgLead, number>>;
}

export interface DermSpec {
  kind: "derm";
  /** Anatomical field the lesions are drawn on. */
  site: "face" | "cheek" | "forehead" | "back" | "forearm" | "shin" | "trunk" | "scalp" | "hand" | "foot";
  /** Fitzpatrick phototype drives the base skin tone. */
  phototype: 1 | 2 | 3 | 4 | 5 | 6;
  lesions: DermLesionLayer[];
  /** Deterministic scatter seed. */
  seed: number;
}

export interface DermLesionLayer {
  morphology:
    | "comedone-open"
    | "comedone-closed"
    | "papule"
    | "pustule"
    | "nodule"
    | "cyst"
    | "macule"
    | "patch"
    | "plaque"
    | "scale"
    | "vesicle"
    | "wheal"
    | "scar-atrophic"
    | "scar-hypertrophic"
    | "erythema"
    | "hyperpigment"
    | "ulcer"
    | "target"
    | "annular";
  count: number;
  /** Lesion radius in spec units, before jitter. */
  size?: number;
  colour?: string;
  /** 0–1. Confluence makes lesions merge into patches. */
  confluence?: number;
  /** Restrict this layer to a region of the field. */
  region?: "malar" | "central" | "perioral" | "diffuse" | "extensor" | "flexor" | "margins";
}

export interface RadiographSpec {
  kind: "xray" | "ct" | "mri" | "usg" | "fundus";
  view: string;
  /** Named findings the renderer draws; purely geometric, never captioned. */
  features: RadiographFeature[];
  seed: number;
}

export interface RadiographFeature {
  id:
    | "normal"
    | "consolidation"
    | "pleural-effusion"
    | "cardiomegaly"
    | "bat-wing-oedema"
    | "pneumothorax"
    | "cavitation"
    | "hilar-lymphadenopathy"
    | "free-air"
    | "dilated-bowel"
    | "appendix-thickened"
    | "gallstone"
    | "hydronephrosis"
    | "cotton-wool-spots"
    | "microaneurysms"
    | "hard-exudates"
    | "disc-oedema";
  side?: "left" | "right" | "bilateral";
  severity?: 1 | 2 | 3;
}

export type MediaSpec = EcgSpec | DermSpec | RadiographSpec;

export interface MediaAsset {
  /** Procedural spec; rendered as vector graphics. */
  spec?: MediaSpec;
  /** Real asset URL. Takes precedence over `spec` when present. */
  src?: string;
  /** Required: screen-reader description. Must not interpret the finding. */
  alt: string;
  /** Acquisition metadata only — no impression during an active case. */
  caption?: string;
}

export interface InvestigationResult {
  /** Instance id (a test can be repeated). */
  id: string;
  defId: string;
  name: string;
  category: InvestigationCategory;
  orderedAt: number;
  /** Sim-clock minute the result becomes available. */
  resultAt: number;
  status: "pending" | "resulted";
  rows?: LabRow[];
  media?: MediaAsset;
  /** Objective report text. Never contains a diagnosis during play. */
  report?: string;
  /** Indian-OPD-realistic cost in rupees, used for cost-effectiveness scoring. */
  cost?: number;
}

/* -------------------------------------------------------------------------- */
/* Therapeutics                                                                */
/* -------------------------------------------------------------------------- */

export type DrugRoute =
  | "PO" | "IV" | "IM" | "SC" | "SL" | "PR" | "TOP" | "INH" | "NEB" | "OD-eye" | "IN";

export interface DrugAdministration {
  id: string;
  generic: string;
  brand?: string;
  dose: string;
  route: DrugRoute;
  frequency?: string;
  duration?: string;
  /** `given` = administered now; `prescribed` = take-home script. */
  mode: "given" | "prescribed";
  at: number;
}

export interface ProcedureRecord {
  id: string;
  name: string;
  at: number;
  /** Objective operative/bedside note. */
  note?: string;
}

/* -------------------------------------------------------------------------- */
/* Revealed clinical information                                               */
/* -------------------------------------------------------------------------- */

/**
 * A single piece of information the player has obtained. Grouped for display
 * in the patient panel and the history/exam sheets.
 */
export interface RevealedFact {
  id: string;
  group: FactGroup;
  label: string;
  value: string;
  at: number;
  /** Renders with emphasis when the finding is objectively abnormal. */
  abnormal?: boolean;
}

export type FactGroup =
  | "demographics"
  | "complaint"
  | "hpi"
  | "past"
  | "medication"
  | "allergy"
  | "family"
  | "social"
  | "diet"
  | "sexual"
  | "obstetric"
  | "systemic"
  | "general-exam"
  | "systemic-exam"
  | "local-exam";

/* -------------------------------------------------------------------------- */
/* Patient & case state                                                        */
/* -------------------------------------------------------------------------- */

export type PatientStatus =
  | "stable"
  | "guarded"
  | "deteriorating"
  | "critical"
  | "improving"
  | "recovered"
  | "deceased";

export type CaseStatus = "briefing" | "active" | "closing" | "complete";

export type EncounterStage =
  | "history"
  | "examination"
  | "investigation"
  | "diagnosis"
  | "treatment"
  | "followup";

export const ENCOUNTER_STAGES: readonly EncounterStage[] = [
  "history",
  "examination",
  "investigation",
  "diagnosis",
  "treatment",
  "followup",
] as const;

export interface PatientIdentity {
  /** Fictional first name, used only in conversation — never shown on the card. */
  name?: string;
  age: number;
  sex: "Male" | "Female" | "Other";
  city: string;
  occupation?: string;
  /** One-line context shown on the patient card. */
  context?: string;
}

export interface TimelineEvent {
  id: string;
  at: number;
  /** Pre-formatted wall clock, e.g. "14:05". */
  clock: string;
  /** Day of the encounter, 0 = day of arrival. */
  day: number;
  label: string;
  detail?: string;
  category:
    | "arrival"
    | "history"
    | "exam"
    | "investigation"
    | "treatment"
    | "procedure"
    | "monitor"
    | "status"
    | "followup"
    | "closure";
}

/**
 * The player-visible simulation state. This is the ONLY case data that reaches
 * the browser while a case is active, and it is safe to expose in full.
 */
export interface CaseState {
  /** Opaque session id. Never derived from the case definition. */
  sessionId: string;
  /** Display number, e.g. 32 -> "CASE 032". */
  caseNumber: number;
  /** One-line, non-diagnostic scene-setting shown before the encounter. */
  briefing: string;
  /** Present only when the player chose the specialty, or after closure. */
  specialty?: Specialty;
  track: CaseTrack;
  level: CareLevel;
  setting: CareSetting;
  patient: PatientIdentity;

  status: CaseStatus;
  patientStatus: PatientStatus;
  /** Minutes elapsed since arrival. */
  clock: number;
  /** Wall-clock minute-of-day at arrival, for timeline formatting. */
  arrivalMinuteOfDay: number;

  stage: EncounterStage;
  /** Stages the player has actually engaged with. */
  stagesTouched: EncounterStage[];

  messages: EncounterMessage[];
  vitals: Partial<Record<VitalKey, VitalTrack>>;
  facts: RevealedFact[];
  investigations: InvestigationResult[];
  drugs: DrugAdministration[];
  procedures: ProcedureRecord[];
  timeline: TimelineEvent[];

  /** The player's own recorded working diagnosis — never the truth. */
  workingDiagnosis?: string;
  differentials: string[];
  /** Whether the patient is on continuous monitoring. */
  monitored: boolean;
  /** Rhythm on the bedside monitor — revealed only once the monitor is attached. */
  monitorRhythm?: EcgSpec["rhythm"];
  /** Every observable change in the patient's condition, for the condition trend. */
  statusHistory: { at: number; status: PatientStatus }[];
  /** Language the patient and family speak in this rendering. */
  lang?: PatientLang;
  /** The guided demo case: on-screen tips walk the player through it. */
  guided?: boolean;
  /** Where the case is set: units, money and names on screen follow it. */
  country?: Country;
  /** The daily case's day (IST) — the same patient for everyone that day. */
  daily?: string;
  /** Monotonic counter so generated ids are stable across replay. */
  seq: number;
}

/* -------------------------------------------------------------------------- */
/* Actions & intents                                                           */
/* -------------------------------------------------------------------------- */

export type IntentKind =
  | "greeting"
  | "history"
  | "vitals"
  | "exam"
  | "investigation"
  | "drug"
  | "action"
  | "followup"
  | "wait"
  | "reassess"
  | "diagnosis"
  | "differential"
  | "close"
  | "unknown";

export interface ResolvedIntent {
  kind: IntentKind;
  /** Id in the case definition this intent resolved to, when it matched. */
  targetId?: string;
  /** The phrase that triggered the match, for the timeline. */
  phrase: string;
  matched: boolean;
  /** Parsed structured payload — dose, route, free-text diagnosis, etc. */
  payload?: Record<string, string | number | boolean>;
}

/**
 * One player input, after intent resolution. Server-side only: it lives in
 * the sealed session token and is replayed deterministically every turn.
 */
export interface ActionRecord {
  id: string;
  at: number;
  raw: string;
  intents: ResolvedIntent[];
  /**
   * Language generated for this action by a non-deterministic provider,
   * keyed by intent index. Recorded so replay never calls the model again.
   */
  generated?: Record<string, string>;
}

/* -------------------------------------------------------------------------- */
/* Turn effects — the protocol between engine and UI                           */
/* -------------------------------------------------------------------------- */

/**
 * Providers (mock or OpenAI) never hand the UI prose to render structurally.
 * They emit effects; `applyEffects` folds them into `CaseState`; components
 * render state. This keeps the interface identical for every provider.
 */
export type TurnEffect =
  | { type: "message"; role: MessageRole; kind: MessageKind; text: string; media?: MediaAsset; attachmentIds?: string[] }
  | { type: "vitals"; readings: VitalPatch[] }
  | { type: "fact"; group: FactGroup; label: string; value: string; abnormal?: boolean }
  | { type: "investigation_ordered"; instanceId: string; defId: string; name: string; category: InvestigationCategory; turnaroundMin: number; cost?: number }
  | { type: "investigation_resulted"; instanceId: string; rows?: LabRow[]; media?: MediaAsset; report?: string }
  | { type: "drug"; drug: Omit<DrugAdministration, "id" | "at"> }
  | { type: "procedure"; name: string; note?: string }
  | { type: "patient_status"; status: PatientStatus; notice?: string }
  | { type: "timeline"; label: string; detail?: string; category: TimelineEvent["category"] }
  | { type: "advance_time"; minutes: number }
  | { type: "stage"; stage: EncounterStage }
  | { type: "case_status"; status: CaseStatus }
  | { type: "setting"; setting: CareSetting }
  | { type: "monitoring"; on: boolean; rhythm?: EcgSpec["rhythm"] }
  | { type: "working_diagnosis"; diagnosis?: string; differentials?: string[] };

export interface VitalPatch {
  key: VitalKey;
  value: string;
  unit?: string;
  numeric?: number;
  flag?: Flag;
}

/* -------------------------------------------------------------------------- */
/* Turn response                                                               */
/* -------------------------------------------------------------------------- */

export interface TurnResponse {
  /** Sealed, opaque session token. The client stores and returns it verbatim. */
  token: string;
  state: CaseState;
  /** Effects produced by this turn only — drives entrance transitions. */
  effects: TurnEffect[];
  /** Present only once the case has closed. */
  debrief?: CaseDebrief;
  /** Present only once the case has closed and been recorded. */
  rewards?: CaseRewards;
}

/* -------------------------------------------------------------------------- */
/* Scoring                                                                     */
/* -------------------------------------------------------------------------- */

export type ScoreCategory =
  | "history"
  | "examination"
  | "differential"
  | "investigationSelection"
  | "investigationInterpretation"
  | "treatment"
  | "drugSafety"
  | "reassessment"
  | "efficiency"
  | "outcome";

export interface ScoreLine {
  category: ScoreCategory;
  label: string;
  earned: number;
  max: number;
  /** Short, factual notes shown in the score breakdown after closure. */
  notes: string[];
}

export interface CaseScore {
  total: number;
  max: number;
  percent: number;
  lines: ScoreLine[];
  xp: number;
  penalties: ScoreAdjustment[];
  bonuses: ScoreAdjustment[];
}

export interface ScoreAdjustment {
  label: string;
  points: number;
  reason: string;
}

/* -------------------------------------------------------------------------- */
/* Debrief                                                                     */
/* -------------------------------------------------------------------------- */

export interface DebriefReasoningStep {
  stage: "History" | "Examination" | "Investigation" | "Diagnosis";
  text: string;
}

export interface DebriefMiss {
  what: string;
  why: string;
  better: string;
  severity: "minor" | "moderate" | "major";
}

export interface SeverityBand {
  id: string;
  label: string;
  /** What is visible / measurable at this severity. */
  recognition: string[];
  investigation: string[];
  treatment: string[];
  followUp: string[];
  media?: MediaAsset;
}

export interface DrugMonograph {
  generic: string;
  brand?: string;
  dose: string;
  route: DrugRoute;
  frequency: string;
  duration: string;
  indication: string;
  mechanism: string;
  whyItWorks: string;
  avoidWhen: string[];
  adverseEffects: string[];
  monitoring: string[];
}

export interface RoutineStep {
  order: number;
  step: string;
  product?: string;
  howMuch?: string;
  where?: string;
  note?: string;
}

export interface PracticalRoutine {
  label: string;
  steps: RoutineStep[];
  avoid?: string[];
  expectedIrritation?: string;
  ifIrritated?: string;
  improvementTimeline?: string;
}

export interface RescueEpisode {
  label: string;
  /** False when the harm was set in motion but the case closed before it surfaced. */
  manifested: boolean;
  cause: string;
  whatYouDid: string;
  whyItCausedHarm: string;
  earliestRescueWindow: string;
  correctRescueSequence: string[];
  lastRealisticRescueWindow: string;
  /** What the player actually did once it surfaced. */
  yourResponse: string[];
  outcome: string;
  rescued: "full" | "partial" | "no" | "not-applicable";
}

export interface RescueReview {
  occurred: boolean;
  episodes: RescueEpisode[];
  /** Shown when nothing went wrong: what could have, and how to rescue it. */
  counterfactual?: { title: string; body: string; sequence: string[] };
}

export interface InvestigationTeaching {
  /** Catalogue / case id, when known — matches `orderedInvestigationIds`. */
  id?: string;
  name: string;
  whenToOrder: string;
  whatItTellsYou: string;
  /** Rupee cost, so cost-effectiveness is teachable. */
  cost?: number;
  priority: "essential" | "useful" | "situational" | "unnecessary";
}

export interface FollowUpPlan {
  interval: string;
  reassess: string[];
  redFlags: string[];
  whenToEscalate: string[];
}

export interface TreatmentFailurePath {
  steps: string[];
}

/** "implied": no diagnosis stated, but the management treated the right disease. */
export type DiagnosisVerdict = "correct" | "partial" | "implied" | "incorrect" | "not-recorded";

export interface CaseDebrief {
  /** Library reference, revealed only after closure (used to avoid repeats). */
  caseRef: string;
  specialty: Specialty;
  track: CaseTrack;
  level: CareLevel;
  caseNumber: number;
  diagnosis: string;
  /** The diagnosis the player stated during the encounter, if any. */
  userDiagnosis?: string;
  verdict: DiagnosisVerdict;
  finalStatus: PatientStatus;
  /** Sim minutes from arrival to closure. */
  elapsedMin: number;
  /** Total spent on investigations, INR. */
  spend: number;
  /** Investigations the player ordered, by catalogue/case id. */
  orderedInvestigationIds: string[];
  /** ICD-ish / clinical qualifier, e.g. "moderate, inflammatory". */
  qualifier?: string;
  score: CaseScore;
  reasoning: DebriefReasoningStep[];
  didWell: string[];
  missed: DebriefMiss[];
  severityBands: SeverityBand[];
  /** Id of the severity band this patient belonged to. */
  patientBand?: string;
  treatmentByBand: Record<string, string[]>;
  drugs: DrugMonograph[];
  routines: PracticalRoutine[];
  investigations: InvestigationTeaching[];
  rescue: RescueReview;
  followUp: FollowUpPlan;
  treatmentFailure: TreatmentFailurePath;
  pearl: string;
  /** Where the case was set; money in this debrief is in that country's currency. */
  country?: Country;
}

/* -------------------------------------------------------------------------- */
/* Session envelope                                                            */
/* -------------------------------------------------------------------------- */

/**
 * What the client holds. `state` contains revealed information only. `token`
 * is sealed (AES-256-GCM) by the server and carries the case reference and the
 * intent-resolved action log; the client can neither read nor alter it.
 */
export interface CaseSession {
  token: string;
  state: CaseState;
  debrief?: CaseDebrief;
}

/* -------------------------------------------------------------------------- */
/* Progression                                                                 */
/* -------------------------------------------------------------------------- */

export interface Rank {
  id: string;
  label: string;
  /** 1 (lowest) – 10 (highest); drives the insignia. */
  tier: number;
  minPercent: number;
  maxPercent: number;
}

export interface SpecialtyMastery {
  specialty: Specialty;
  percent: number;
  cases: number;
}

export interface PlayerProgress {
  xp: number;
  /** Rolling mean score across completed cases, 0–100. */
  percent: number;
  casesCompleted: number;
  streakDays: number;
  bestStreak: number;
  /** XP earned today (IST) and the daily goal. */
  dailyXp: number;
  dailyGoal: number;
  lastPlayedISO?: string;
  mastery: SpecialtyMastery[];
  levels: { level: CareLevel; cases: number; best: number }[];
  badges: Badge[];
  history: CompletedCaseSummary[];
}

export interface CompletedCaseSummary {
  caseId: string;
  caseNumber: number;
  specialty: Specialty;
  track: CaseTrack;
  level: CareLevel;
  diagnosis: string;
  verdict?: DiagnosisVerdict;
  rescued?: boolean;
  score: number;
  xp: number;
  completedISO: string;
}

export interface Badge {
  id: string;
  label: string;
  description: string;
}

/** What a closed case earned — returned with the closing turn. */
export interface CaseRewards {
  xp: number;
  streakDays: number;
  /** True when this case extended the streak today. */
  streakExtended: boolean;
  dailyXp: number;
  dailyGoal: number;
  rankBefore: string;
  rankAfter: string;
  /** Place in this week's league group, before and after this case. */
  weeklyPosition?: number;
  weeklyPositionBefore?: number;
  leagueTier?: number;
  newBadges: Badge[];
  /** The daily case: your place today (ranked = your first attempt of the day). */
  daily?: { position: number; total: number; ranked: boolean };
}
