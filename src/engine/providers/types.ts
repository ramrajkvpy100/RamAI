/**
 * The provider contract. A provider supplies two things the deterministic
 * engine cannot: clinical CONTENT (case definitions) and LANGUAGE
 * (understanding free text, phrasing replies). Everything structured —
 * vitals, results, physiology, hazards, scoring — stays in the engine.
 */

import type { ClinicalCaseDefinition } from "../case-definition";
import type { Country } from "../countries";
import type { HiddenState } from "../simulator";
import type { CareLevel, CaseDebrief, CaseTrack, EncounterMessage, LearnPack, PatientLang, ResolvedIntent, Specialty } from "../types";

export type CaseSource = { kind: "library"; id: string } | { kind: "generated"; def: ClinicalCaseDefinition };

export interface StartOptions {
  /** A newcomer: an easy, classic case. */
  easy?: boolean;
  specialty?: Specialty;
  track?: CaseTrack;
  level?: CareLevel;
  /** Care levels the player's plan allows. */
  allowedLevels?: readonly CareLevel[];
  /** Library case ids recently played (revealed to the client only after closure). */
  exclude?: readonly string[];
  /** Where the player practises: who the patients are, the units, the money. */
  country?: Country;
  /** A disease the doctor chose to practise ("Dengue fever"). */
  disease?: string;
}

export interface InterpretContext {
  def: ClinicalCaseDefinition;
  hidden: HiddenState;
  /** Recent transcript, for language models that need conversational context. */
  transcript: readonly EncounterMessage[];
  /** Where the case is set, so generated replies use the local idiom. */
  country?: Country;
  /** The language the player chose for patients and families. */
  lang?: PatientLang;
}

export interface FeedbackInput {
  def: ClinicalCaseDefinition;
  hidden: HiddenState;
  transcript: readonly EncounterMessage[];
  /** The debrief the marking rules produced — the feedback explains it, never changes it. */
  debrief: CaseDebrief;
  country?: Country;
}

export type CoachFeedback = NonNullable<CaseDebrief["coach"]>;

/** An invented case's debrief teaching and misses. */
export interface TeachingPack {
  teaching: Omit<ClinicalCaseDefinition["teaching"], "treatmentByBand">;
  misses: ClinicalCaseDefinition["rubric"]["misses"];
  strengths: ClinicalCaseDefinition["rubric"]["strengths"];
}

export interface Interpretation {
  intents: ResolvedIntent[];
  /** Replies generated for specific intents (keyed by intent index), recorded for replay. */
  generated?: Record<string, string>;
}

export interface ClinicalProvider {
  readonly id: "mock" | "openai";
  createCase(opts: StartOptions): Promise<CaseSource>;
  resolveCase(src: CaseSource): ClinicalCaseDefinition;
  interpret(text: string, ctx: InterpretContext): Promise<Interpretation>;
  /** Feedback in words for the debrief (optional). The score never depends on it. */
  feedback?(input: FeedbackInput): Promise<CoachFeedback | undefined>;
  /** For an invented case: the debrief's teaching and misses, written while it's played (optional). */
  teach?(def: ClinicalCaseDefinition): Promise<TeachingPack | undefined>;
  /** Clinical pearls and exam-style questions on the case, for the doctor's country (optional). */
  learn?(def: ClinicalCaseDefinition, country: Country): Promise<LearnPack | undefined>;
  /** Number of available cases per specialty, mode and level, in the player's country. */
  availability(country?: Country): Promise<{
    specialties: Partial<Record<Specialty, number>>;
    tracks: Partial<Record<CaseTrack, number>>;
    levels: Partial<Record<CareLevel, number>>;
  }>;
}
