/**
 * The case library — server-only. Importing this module from a client
 * component fails the build, which keeps every hidden diagnosis off the wire.
 */
import "server-only";

import type { ClinicalCaseDefinition } from "../case-definition";
import type { Country } from "../countries";
import type { CareLevel, CaseTrack, Specialty } from "../types";
import { dermAcne } from "./derm-acne";
import { dermMelasma } from "./derm-melasma";
import { dermPsoriasis } from "./derm-psoriasis";
import { dermTinea } from "./derm-tinea";
import { emAdhf } from "./em-adhf";
import { emViperPhc } from "./em-viper-phc";
import { grAip } from "./gr-aip";
import { idDengue } from "./id-dengue";
import { medPad } from "./med-pad";
import { medSleApex } from "./med-sle-apex";
import { phAcs } from "./ph-acs";
import { surgAppendicitis } from "./surg-appendicitis";
import { tutHypoglycaemia } from "./tut-hypoglycaemia";

export const CASE_LIBRARY: readonly ClinicalCaseDefinition[] = [
  dermAcne, dermMelasma, dermTinea, dermPsoriasis, medPad, idDengue, surgAppendicitis, emAdhf,
  phAcs, emViperPhc, medSleApex, grAip,
];

/** The guided demo case — outside the library, so it's never picked at random or counted. */
export const TUTORIAL_CASE: ClinicalCaseDefinition = tutHypoglycaemia;

/** Every case the engine can replay. */
export const ALL_CASES: readonly ClinicalCaseDefinition[] = [...CASE_LIBRARY, TUTORIAL_CASE];

export function getCase(id: string): ClinicalCaseDefinition | undefined {
  return ALL_CASES.find((c) => c.id === id);
}

export interface CaseFilter {
  specialty?: Specialty;
  track?: CaseTrack;
  level?: CareLevel;
  /** Levels the player may play (plan-gated). */
  allowedLevels?: readonly CareLevel[];
  /** The player's country: cases set only elsewhere are left out. */
  country?: Country;
}

const playableIn = (c: ClinicalCaseDefinition, country?: Country) => !country || !c.countries || c.countries.includes(country);

export function filterCases(f: CaseFilter): ClinicalCaseDefinition[] {
  return CASE_LIBRARY.filter(
    (c) =>
      (!f.specialty || c.specialty === f.specialty) &&
      (!f.track || c.track === f.track) &&
      (!f.level || c.level === f.level) &&
      (!f.allowedLevels || f.allowedLevels.includes(c.level)) &&
      playableIn(c, f.country),
  );
}

/** Counts per specialty, mode and level — never ids. */
export function libraryAvailability(country?: Country) {
  const specialties: Partial<Record<Specialty, number>> = {};
  const tracks: Partial<Record<CaseTrack, number>> = {};
  const levels: Partial<Record<CareLevel, number>> = {};
  for (const c of CASE_LIBRARY) {
    if (!playableIn(c, country)) continue;
    specialties[c.specialty] = (specialties[c.specialty] ?? 0) + 1;
    tracks[c.track] = (tracks[c.track] ?? 0) + 1;
    levels[c.level] = (levels[c.level] ?? 0) + 1;
  }
  return { specialties, tracks, levels };
}

/**
 * Weighted random selection within the filter. Random mode favours
 * dermatology and common OPD presentations through each case's `weight`;
 * recently played cases are strongly de-prioritised but never impossible.
 */
export function pickCase(opts: CaseFilter & { exclude?: readonly string[]; random?: () => number }): ClinicalCaseDefinition | undefined {
  const random = opts.random ?? Math.random;
  const pool = filterCases(opts);
  if (pool.length === 0) return undefined;
  const recent = new Set(opts.exclude ?? []);
  const weighted = pool.map((c) => ({ c, w: c.weight * (recent.has(c.id) ? 0.05 : 1) }));
  const total = weighted.reduce((sum, x) => sum + x.w, 0);
  let r = random() * total;
  for (const { c, w } of weighted) {
    r -= w;
    if (r <= 0) return c;
  }
  return weighted[weighted.length - 1]!.c;
}
