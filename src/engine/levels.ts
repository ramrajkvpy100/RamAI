/**
 * Care levels and case modes.
 *
 * A care level is two things at once: the facility's resources (what can be
 * ordered there) and the difficulty of the cases that arrive there. Isomorphic —
 * the client uses the labels; the engine uses the availability rules.
 */
import type { Country } from "./countries";
import type { CareLevel, CaseTrack } from "./types";

export interface LevelMeta {
  id: CareLevel;
  /** 1–6, first contact → global centre of excellence. */
  rank: number;
  label: string;
  short: string;
  tagline: string;
  description: string;
}

export const LEVELS: Record<CareLevel, LevelMeta> = {
  phc: { id: "phc", rank: 1, label: "Primary Health Centre", short: "PHC", tagline: "First contact", description: "Clinical skill, rapid tests and knowing when to refer." },
  chc: { id: "chc", rank: 2, label: "Community Health Centre", short: "CHC", tagline: "Block-level care", description: "Basic labs, X-ray and ECG, a physician on call." },
  district: { id: "district", rank: 3, label: "District Hospital", short: "District", tagline: "Secondary care", description: "Ultrasound, wider labs, CT and specialists." },
  college: { id: "college", rank: 4, label: "Medical College", short: "Med College", tagline: "Teaching hospital", description: "Full diagnostics and every department — complex, multi-morbid patients." },
  apex: { id: "apex", rank: 5, label: "National Referral Centre", short: "National Referral", tagline: "AIIMS-level", description: "Atypical, multisystem, high-stakes cases — the toughest a country sees." },
  grandrounds: { id: "grandrounds", rank: 6, label: "Global Centre of Excellence", short: "Global Excellence", tagline: "Harvard-level", description: "The hardest cases anywhere: rare diseases and diagnostic odysseys." },
};

type LevelNames = Pick<LevelMeta, "label" | "short" | "tagline">;

/** What each level is called in each country — the same six steps of the hospital pathway. */
const LEVEL_NAMES: Record<Exclude<Country, "IN">, Record<CareLevel, LevelNames>> = {
  US: {
    phc: { label: "Primary Care Clinic", short: "Primary Care", tagline: "First contact" },
    chc: { label: "Community Hospital", short: "Community", tagline: "Local hospital care" },
    district: { label: "Regional Medical Center", short: "Regional", tagline: "Secondary care" },
    college: { label: "Academic Medical Center", short: "Academic", tagline: "Teaching hospital" },
    apex: { label: "National Referral Center", short: "National Referral", tagline: "Top referral center" },
    grandrounds: { label: "Global Center of Excellence", short: "Global Excellence", tagline: "Harvard-level" },
  },
  UK: {
    phc: { label: "GP Surgery", short: "GP", tagline: "First contact" },
    chc: { label: "Community Hospital", short: "Community", tagline: "Local hospital care" },
    district: { label: "District General Hospital", short: "DGH", tagline: "Secondary care" },
    college: { label: "University Teaching Hospital", short: "Teaching", tagline: "Teaching hospital" },
    apex: { label: "Tertiary Referral Centre", short: "Tertiary", tagline: "Specialist referral centre" },
    grandrounds: { label: "Global Centre of Excellence", short: "Global Excellence", tagline: "Harvard-level" },
  },
};

/** A level as it's named in the player's country. */
export function levelMeta(level: CareLevel, country: Country = "IN"): LevelMeta {
  return country === "IN" ? LEVELS[level] : { ...LEVELS[level], ...LEVEL_NAMES[country][level] };
}

export const TRACKS: Record<CaseTrack, { id: CaseTrack; label: string; description: string }> = {
  opd: { id: "opd", label: "OPD", description: "Walk-in outpatients" },
  phone: { id: "phone", label: "Phone consult", description: "Triage a caller — no examination, no tests" },
  emergency: { id: "emergency", label: "Emergency", description: "Sick patients, ticking clocks" },
};

/** A mode as it's called in the player's country: OPD in India, Clinic elsewhere. */
export function trackLabel(track: CaseTrack, country: Country = "IN"): string {
  return track === "opd" && country !== "IN" ? "Clinic" : TRACKS[track].label;
}

/* -------------------------------------------------------------------------- */
/* Facility capability                                                         */
/* -------------------------------------------------------------------------- */

const PHC = ["cbc", "urine-rm", "urine-dip", "upt", "malaria", "dengue", "widal", "fbs", "ppbs", "stool-rm", "viral-markers", "peripheral-smear"];
const CHC = [...PHC, "lft", "rft", "electrolytes", "hba1c", "lipid", "crp", "esr", "koh", "ecg", "cxr", "xray-abdomen", "blood-group", "coag", "uric-acid", "calcium", "tzanck"];
const DISTRICT = [
  ...CHC, "usg-abdomen", "echo", "troponin", "abg", "tft", "blood-culture", "urine-culture", "pus-culture", "ct-head", "ct-abdomen",
  "amylase-lipase", "d-dimer", "iron", "vit-b12", "skin-biopsy", "fungal-culture", "spirometry", "arterial-doppler",
  "fundoscopy-photo", "uacr", "abi", "hormonal-profile", "procalcitonin", "vit-d", "bnp",
];
const AVAILABLE: Partial<Record<CareLevel, Set<string>>> = {
  phc: new Set(PHC),
  chc: new Set(CHC),
  district: new Set(DISTRICT),
};

/**
 * Whether a facility at this level can perform an investigation. Teaching
 * hospitals and above can do everything. Catalogue tests follow the lists
 * above (anything not listed — MRI, HRCT, ANA… — is teaching-hospital only);
 * case-specific tests default to district level unless the case says otherwise.
 */
export function canPerform(level: CareLevel, investigationId: string, opts: { inCatalog: boolean; minLevel?: CareLevel }): boolean {
  const rank = LEVELS[level].rank;
  if (rank >= LEVELS.college.rank) return true;
  if (opts.minLevel) return rank >= LEVELS[opts.minLevel].rank;
  if (!opts.inCatalog) return rank >= LEVELS.district.rank;
  return AVAILABLE[level]?.has(investigationId) ?? true;
}
