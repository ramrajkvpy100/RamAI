/**
 * The provider contract. A provider supplies two things the deterministic
 * engine cannot: clinical CONTENT (case definitions) and LANGUAGE
 * (understanding free text, phrasing replies). Everything structured —
 * vitals, results, physiology, hazards, scoring — stays in the engine.
 */

import type { ClinicalCaseDefinition } from "../case-definition";
import type { HiddenState } from "../simulator";
import type { CareLevel, CaseTrack, EncounterMessage, ResolvedIntent, Specialty } from "../types";

export type CaseSource = { kind: "library"; id: string } | { kind: "generated"; def: ClinicalCaseDefinition };

export interface StartOptions {
  specialty?: Specialty;
  track?: CaseTrack;
  level?: CareLevel;
  /** Care levels the player's plan allows. */
  allowedLevels?: readonly CareLevel[];
  /** Library case ids recently played (revealed to the client only after closure). */
  exclude?: readonly string[];
}

export interface InterpretContext {
  def: ClinicalCaseDefinition;
  hidden: HiddenState;
  /** Recent transcript, for language models that need conversational context. */
  transcript: readonly EncounterMessage[];
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
  /** Number of available cases per specialty, mode and level. */
  availability(): Promise<{
    specialties: Partial<Record<Specialty, number>>;
    tracks: Partial<Record<CaseTrack, number>>;
    levels: Partial<Record<CareLevel, number>>;
  }>;
}
