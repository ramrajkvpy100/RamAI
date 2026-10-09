/**
 * Text utilities for the rule-based clinical language layer.
 *
 * Matching works on normalised, lightly stemmed token sequences so that
 * "McBurney's point", "mcburney point" and "MCBURNEYS POINT" all agree, and
 * so that matching is deterministic (required for session replay).
 */

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bk\s*\/\s*c\s*\/\s*o\b/g, " known case of "],
  [/\bh\s*\/\s*o\b/g, " history of "],
  [/\bc\s*\/\s*o\b/g, " complaining of "],
  [/\bo\s*\/\s*e\b/g, " on examination "],
  [/\bp\s*\/\s*a\b/g, " per abdomen "],
  [/\bp\s*\/\s*r\b/g, " per rectal "],
  [/\bp\s*\/\s*v\b/g, " per vaginal "],
  [/\bi\s*\/\s*v\b/g, " iv "],
  [/\bi\s*\/\s*m\b/g, " im "],
  [/\bs\s*\/\s*c\b/g, " sc "],
  [/\br\s*\/\s*m\b/g, " r m "],
  [/\bc\s*\/\s*s\b/g, " c s "],
  [/\bb\.\s*p\.?/g, " bp "],
  [/\bx[\s-]*rays?\b/g, " x ray "],
  [/\bsp\s*o\s*[2₂]\b/g, " spo2 "],
  [/\bo₂\b/g, " o2 "],
  [/\be\.?g\.?\s/g, " "],
  [/\bpls\b|\bplz\b|\bplease\b|\bkindly\b/g, " "],
  [/\bdr\.?\s/g, " doctor "],
  [/\bhrs\b/g, " hours "],
  [/\bwks?\b/g, " weeks "],
  [/\bmins?\b/g, " minutes "],
  [/\bf\s*\/\s*u\b/g, " follow up "],
  [/\bfu\b/g, " follow up "],
  [/\bsob\b/g, " shortness of breath "],
  [/\bloc\b/g, " loss of consciousness "],
  [/\bhtn\b/g, " hypertension "],
  [/\bt2dm\b|\bdm2\b|\bdm\b/g, " diabetes "],
  [/\bcad\b|\bihd\b/g, " heart disease "],
  [/\bckd\b/g, " kidney disease "],
  [/\btb\b/g, " tuberculosis "],
  [/\bocps?\b/g, " ocp "],
  [/\bmeds\b/g, " medicines "],
  [/\bmedications?\b/g, " medicines "],
  [/\bppbs\b/g, " ppbs "],
  [/\bexam\b/g, " examination "],
  [/\bexamine\b/g, " examine "],
  [/\binvx\b|\binvestigations?\b/g, " investigation "],
];

/** Units that may be glued to numbers in clinical shorthand ("650mg", "2L"). */
const GLUED_UNIT = /(\d)(mg|mcg|µg|ug|gm|g|ml|l|kg|iu|units?|meq|mmol|%|hours|h|days?|d|weeks?|w|months?|m|minutes?)\b/g;

export function normalise(input: string): string {
  let s = ` ${input.toLowerCase()} `;
  s = s.replace(/[’‘`´]/g, "'");
  s = s.replace(/₂/g, "2").replace(/µ/g, "u");
  for (const [re, rep] of ABBREVIATIONS) s = s.replace(re, rep);
  s = s.replace(GLUED_UNIT, "$1 $2");
  s = s.replace(/'s\b/g, "s");
  s = s.replace(/'/g, "");
  // Keep digits joined by "." or "/" ("0.5", "158/96"); everything else → space.
  s = s.replace(/(\d)[.](\d)/g, "$1·$2").replace(/(\d)\/(\d)/g, "$1⁄$2");
  s = s.replace(/[^a-z0-9%·⁄+ ]+/g, " ");
  s = s.replace(/·/g, ".").replace(/⁄/g, "/");
  return s.replace(/\s+/g, " ").trim();
}

/** British and American medical spellings meet in one form: oedema = edema, anaemia = anemia. */
const SPELLING: [RegExp, string][] = [
  [/^oe(?=dema|sophag|strogen|tal|dipus)/, "e"],
  [/noea/g, "nea"],
  [/^haem/, "hem"],
  [/aem/g, "em"],
  [/paed/g, "ped"],
  [/anaesth/g, "anesth"],
  [/oeliac/g, "eliac"],
  [/diarrhoea/g, "diarrhea"],
  [/sulph/g, "sulf"],
  [/^(colo|tumo|behavio|favo|odo|labo|humo|vapo|rigo)ur(s?)$/, "$1r$2"],
  [/^(cent|lit|met|fib)re(s?)$/, "$1er$2"],
];

/** Light, symmetric stemming. Applied to both sides of every comparison. */
export function stem(token: string): string {
  for (const [re, rep] of SPELLING) token = token.replace(re, rep);
  if (token.length <= 3) return token;
  if (/(ss|us|is|ys)$/.test(token)) return token;
  if (token.endsWith("ies") && token.length > 4) return token.slice(0, -3) + "y";
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

export function tokens(normalised: string): string[] {
  return normalised.split(" ").filter(Boolean).map(stem);
}

export interface PhraseHit {
  phrase: string;
  start: number;
  end: number;
}

/** Finds a phrase (as a token sequence) in already-tokenised text. */
export function findPhrase(textTokens: string[], phrase: string): PhraseHit | null {
  const p = tokens(normalise(phrase));
  if (p.length === 0 || p.length > textTokens.length) return null;
  outer: for (let i = 0; i <= textTokens.length - p.length; i++) {
    for (let j = 0; j < p.length; j++) {
      if (textTokens[i + j] !== p[j]) continue outer;
    }
    return { phrase, start: i, end: i + p.length };
  }
  return null;
}

export function hasAny(textTokens: string[], phrases: readonly string[]): boolean {
  return phrases.some((p) => findPhrase(textTokens, p) !== null);
}

/** Longest phrase hit wins. Returns the best hit for a list of phrases. */
export function bestHit(textTokens: string[], phrases: readonly string[]): PhraseHit | null {
  let best: PhraseHit | null = null;
  for (const p of phrases) {
    const hit = findPhrase(textTokens, p);
    if (hit && (!best || hit.end - hit.start > best.end - best.start)) best = hit;
  }
  return best;
}

/** Splits a player's message into independent clauses. */
export function splitClauses(raw: string): string[] {
  return raw
    .replace(/\r/g, "")
    .split(/\n+|;|(?<=\?)\s+|(?<=[a-z0-9)\]])\.\s+(?=[a-z])|\b(?:and then|after that)\b/i)
    .map((c) => (c ?? "").trim())
    .filter((c) => c.length > 0);
}

/** Deterministic 32-bit hash (FNV-1a). */
export function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pick<T>(items: readonly T[], seed: number): T {
  const item = items[seed % items.length];
  if (item === undefined) throw new Error("pick() on empty list");
  return item;
}

/** Small seeded PRNG (mulberry32) for deterministic procedural rendering. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function capitalise(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

export function formatClock(arrivalMinuteOfDay: number, elapsed: number): string {
  const total = arrivalMinuteOfDay + elapsed;
  const minuteOfDay = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(minuteOfDay / 60);
  const m = Math.floor(minuteOfDay % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Human description of a sim-time span: "45 min", "3 h", "2 weeks". */
export function describeSpan(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) {
    const h = minutes / 60;
    return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
  }
  const days = Math.round(minutes / 1440);
  if (days % 7 === 0 && days >= 7) return `${days / 7} week${days === 7 ? "" : "s"}`;
  return `${days} day${days === 1 ? "" : "s"}`;
}
