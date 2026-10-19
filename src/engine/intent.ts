/**
 * Rule-based clinical intent resolution.
 *
 * Converts free text into `ResolvedIntent[]`. It is deterministic, so a
 * session can be replayed from its action log. A language-model provider can
 * replace or augment this (see `providers/openai.ts`) — its output is the
 * same `ResolvedIntent[]` contract, recorded into the action log.
 */

import { ALL_VITALS_PHRASES, EXAMS, INVESTIGATIONS, MEASURES, ROUTINE_VITALS, VITALS } from "./catalog";
import type { ClinicalCaseDefinition } from "./case-definition";
import { FORMULARY, drugMatchPhrases, parseOrderDetails, wordToNumber } from "./formulary";
import { findPhrase, hasAny, normalise, splitClauses, tokens, type PhraseHit } from "./text";
import type { CareSetting, ResolvedIntent } from "./types";

export interface IntentContext {
  def: ClinicalCaseDefinition;
  setting: CareSetting;
  weightKg: number;
}

/* -------------------------------------------------------------------------- */
/* Lexicon                                                                     */
/* -------------------------------------------------------------------------- */

const CLOSE_RE = /\b(case close|close (?:the )?case|case closed|end (?:the )?case|finish (?:the )?case|close (?:the )?encounter|end (?:the )?encounter|close this case)\b/;
const GREETING_RE = /^(hi|hello|hey|namaste|namaskar|good (?:morning|afternoon|evening)|greetings)\b[\s,!.]*/i;
const DIAGNOSIS_RE = /^(?:my |the |our )?(?:final |provisional |working |clinical |most likely |likely )?(?:diagnosis|dx|impression)\b(?:\s*(?:is|would be|of|:|-|=))?\s*(.+)$/i;
const OPINION_RE = /^(?:i think|i believe|i suspect|i am thinking|my guess is|this looks like|it looks like|looks like|most likely|probably|likely|consistent with|suggestive of)\b\s*(?:this is |it is |it s |its |a case of |an? )?(.+)$/i;
const DIFFERENTIAL_RE = /^(?:ddx|d\/d|differentials?|differential diagnos[ie]s|my differentials?)\b(?:\s*(?:are|include|is|would be|:|-|=))?\s*(.+)$/i;

/** Verbs that direct an action at the clinical environment, not the patient. */
const CLINICIAN_VERBS = [
  "check", "measure", "record", "take", "examine", "examination", "palpate", "auscultate", "listen to", "listen for", "inspect", "percuss",
  "look at", "look for", "elicit", "assess", "order", "send", "get", "request", "advise", "do", "perform", "give",
  "start", "administer", "prescribe", "rx", "inject", "infuse", "apply", "put", "attach", "insert", "monitor",
  "plan", "schedule", "arrange", "admit", "refer", "repeat", "test", "feel", "see", "evaluate", "screen",
];
const EXAM_VERBS = ["examine", "examination", "palpate", "auscultate", "listen to", "listen for", "inspect", "percuss", "look at", "look for", "elicit", "feel", "test for", "check for", "assess", "look in", "see the"];
const TREATMENT_VERBS = ["give", "start", "administer", "prescribe", "rx", "inject", "infuse", "push", "bolus", "apply", "put on", "put him on", "put her on", "tab", "tablet", "cap", "capsule", "inj", "injection", "syp", "syrup", "neb", "nebulise", "nebulize", "continue", "add", "switch to", "increase", "load", "loading dose", "transfuse", "dose of"];
const COUNSEL_VERBS = ["counsel", "counselling", "counseling", "advise", "explain", "educate", "reassure", "tell him", "tell her", "tell the patient", "teach", "instruct", "recommend", "lifestyle", "inform"];
const PROCEDURE_VERBS = ["perform", "do a", "do an", "plan", "schedule", "take up for", "posted for", "post for", "undergo", "arrange", "proceed with", "operate"];
const NEGATIONS = ["dont", "don t", "do not", "never", "avoid", "no", "not", "without", "stop", "hold", "withhold", "discontinue", "cease"];
const HISTORY_GUARD = ["do you have", "have you", "any history", "history of", "known case of", "are you", "did you", "suffer", "suffering", "diagnosed", "any", "taking medicine for", "medicine for", "problem of", "since when", "do you", "complaining of"];

/** Asking how the patient feels (now, or after something was given) — never an examination. */
const FEELING_RE = /^(?:(?:and|so|now|ok|okay|hello|hi|hey)\s+)?(?:how (?:do|are|is) (?:you|he|she|the patient)(?: (?:feel|feeling|doing|now))?|how you (?:feel|feeling)|(?:are|do) you feel(?:ing)?(?: (?:better|worse|ok|okay|fine|good|any better|alright|all right|any relief))?|(?:feeling|feel|any) (?:better|worse|relief)|any improvement)\b/;

const QUESTION_START = /^(what|whats|what s|when|where|why|who|whom|which|how|is|are|am|was|were|do|does|did|have|has|had|can|could|will|would|should|any|anything|ever|tell me|describe|since)\b/;

const NUMBER_TOKEN = "(\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fourteen|fifteen|twenty|thirty|half)";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function isQuestion(rawClause: string, norm: string): boolean {
  return rawClause.trim().endsWith("?") || QUESTION_START.test(norm);
}

function hasClinicianVerb(tk: string[]): boolean {
  return hasAny(tk, CLINICIAN_VERBS);
}

interface Candidate {
  hit: PhraseHit;
  intent: ResolvedIntent;
  priority: number;
}

/** Keeps the longest, highest-priority, non-overlapping candidates. */
function resolveOverlaps(cands: Candidate[]): ResolvedIntent[] {
  const sorted = [...cands].sort((a, b) => {
    const la = a.hit.end - a.hit.start;
    const lb = b.hit.end - b.hit.start;
    return lb - la || b.priority - a.priority || a.hit.start - b.hit.start;
  });
  const taken: Candidate[] = [];
  for (const c of sorted) {
    if (taken.some((t) => c.hit.start < t.hit.end && t.hit.start < c.hit.end)) continue;
    taken.push(c);
  }
  // Collapse duplicates (same kind + target), preserve reading order.
  const seen = new Set<string>();
  return taken
    .sort((a, b) => a.hit.start - b.hit.start)
    .filter((c) => {
      const key = `${c.intent.kind}:${c.intent.targetId ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => c.intent);
}

/** Every hit of a phrase list, not just the first. */
/** Letters to change, add or drop to turn one word into another. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length]!;
}

function allHits(tk: string[], phrases: readonly string[]): PhraseHit[] {
  const hits: PhraseHit[] = [];
  for (const p of phrases) {
    const pt = tokens(normalise(p));
    if (pt.length === 0) continue;
    for (let i = 0; i <= tk.length - pt.length; i++) {
      let ok = true;
      for (let j = 0; j < pt.length; j++) if (tk[i + j] !== pt[j]) { ok = false; break; }
      if (ok) hits.push({ phrase: p, start: i, end: i + pt.length });
    }
  }
  return hits;
}

function precededBy(tk: string[], index: number, phrases: readonly string[], window = 4): boolean {
  const from = Math.max(0, index - window);
  const slice = tk.slice(from, index);
  return hasAny(slice, phrases);
}

function parseSpanMinutes(norm: string): number | null {
  const m = norm.match(new RegExp(`\\b${NUMBER_TOKEN}\\s*(minute|minutes|min|hour|hours|h|day|days|week|weeks|month|months)\\b`));
  if (!m?.[1] || !m[2]) return null;
  const n = wordToNumber(m[1]) ?? 1;
  const unit = m[2];
  if (unit.startsWith("min")) return n;
  if (unit.startsWith("h")) return n * 60;
  if (unit.startsWith("d")) return n * 1440;
  if (unit.startsWith("w")) return n * 7 * 1440;
  return n * 30 * 1440;
}

/* -------------------------------------------------------------------------- */
/* History                                                                     */
/* -------------------------------------------------------------------------- */

const IDENTITY: { id: string; phrases: string[] }[] = [
  { id: "identity:age", phrases: ["how old", "your age", "what is your age", "age"] },
  { id: "identity:occupation", phrases: ["what do you do", "your work", "occupation", "profession", "your job", "what work", "do for a living", "what is your work"] },
  { id: "identity:residence", phrases: ["where do you live", "where are you from", "which area", "native place", "where do you stay", "your address"] },
  { id: "identity:name", phrases: ["your name", "what is your name", "whats your name"] },
  { id: "identity:feeling", phrases: ["how do you feel", "how are you feeling", "how you feel", "how you feeling", "how are you", "how r you", "are you feeling better", "feeling better", "feel better", "any better", "any relief", "feeling any better", "how is the patient", "how is he", "how is she", "hows the patient", "how is he doing", "how is she doing", "how are you doing"] },
  { id: "identity:complaint", phrases: ["what brings you", "what brought you", "how can i help", "what happened", "what is the problem", "whats the problem", "what seems to be the problem", "what is your problem", "chief complaint", "presenting complaint", "what is troubling you", "why have you come", "how may i help"] },
];

export function matchHistory(tk: string[], def: ClinicalCaseDefinition): { id: string; score: number }[] {
  const scored: { id: string; score: number }[] = [];
  for (const entry of def.history) {
    let best = 0;
    for (const p of entry.match) {
      const pt = tokens(normalise(p));
      const hit = findPhrase(tk, p);
      if (hit) best = Math.max(best, 10 + pt.length * 3);
    }
    if (best > 0) scored.push({ id: entry.id, score: best });
  }
  return scored.sort((a, b) => b.score - a.score);
}

function resolveHistory(rawClause: string, tk: string[], ctx: IntentContext): ResolvedIntent[] {
  // Several topics joined by "or" / "and" / commas each get their own answer
  // ("any fever or vomiting?"); otherwise the single best match wins.
  const segments = rawClause.split(/,|\bor\b|\band\b|\//i).map((x) => x.trim()).filter(Boolean);
  if (segments.length > 1) {
    const ids: string[] = [];
    for (const seg of segments) {
      const best = matchHistory(tokens(normalise(seg)), ctx.def)[0];
      if (best && !ids.includes(best.id)) ids.push(best.id);
    }
    if (ids.length > 1) return ids.slice(0, 4).map((id) => ({ kind: "history", targetId: id, phrase: rawClause, matched: true }));
  }
  const best = matchHistory(tk, ctx.def)[0];
  if (best) return [{ kind: "history", targetId: best.id, phrase: rawClause, matched: true }];

  for (const id of IDENTITY) {
    if (!hasAny(tk, id.phrases)) continue;
    // "age" alone is too loose unless the clause is short.
    if (id.id === "identity:age" && !hasAny(tk, ["how old", "your age", "what is your age"]) && tk.length > 3) continue;
    if (id.id === "identity:complaint") {
      const cc = ctx.def.history.find((h) => h.group === "complaint");
      if (cc) return [{ kind: "history", targetId: cc.id, phrase: rawClause, matched: true }];
    }
    return [{ kind: "history", targetId: id.id, phrase: rawClause, matched: true }];
  }
  return [];
}

/* -------------------------------------------------------------------------- */
/* Candidate extraction                                                        */
/* -------------------------------------------------------------------------- */

function vitalCandidates(rawClause: string, tk: string[]): Candidate[] {
  const out: Candidate[] = [];
  for (const hit of allHits(tk, ALL_VITALS_PHRASES)) {
    out.push({ hit, priority: 3, intent: { kind: "vitals", targetId: ROUTINE_VITALS.join(","), phrase: rawClause, matched: true } });
  }
  for (const v of VITALS) {
    for (const hit of allHits(tk, v.match)) {
      if (precededBy(tk, hit.start, HISTORY_GUARD, 4)) continue;
      out.push({ hit, priority: 3, intent: { kind: "vitals", targetId: v.key, phrase: rawClause, matched: true } });
    }
  }
  return out;
}

function examCandidates(rawClause: string, tk: string[], ctx: IntentContext, requireVerb: boolean): Candidate[] {
  const out: Candidate[] = [];
  const verb = hasAny(tk, EXAM_VERBS) || hasAny(tk, ["check", "look", "see", "show me", "examine", "test", "measure", "elicit", "listen"]);
  // Words like "face" or "pimples" appear in counselling too — only an examination verb makes them an examination.
  // Auscultation's words ("heart sounds", "breath sounds") can only mean the stethoscope, verb or not.
  for (const e of ctx.def.exam) {
    if (requireVerb && !verb) break;
    // A case's own version of a catalogue exam answers to the catalogue's phrases as well as its own
    // ("examine the patient" still means the general examination when the case writes that one itself).
    const phrases = [...new Set([...e.match, ...(EXAMS.find((c) => c.id === e.id)?.match ?? [])])];
    for (const hit of allHits(tk, phrases)) {
      out.push({ hit, priority: 4, intent: { kind: "exam", targetId: e.id, phrase: rawClause, matched: true } });
    }
  }
  for (const e of EXAMS) {
    if (ctx.def.exam.some((c) => c.id === e.id)) continue; // case override already listed
    const self = new Set(e.selfEvident ?? []);
    const bare = new Set(e.bare ?? []);
    for (const hit of allHits(tk, requireVerb && !verb ? [...self, ...bare] : e.match)) {
      out.push({ hit, priority: self.has(hit.phrase) ? 5 : bare.has(hit.phrase) ? 4 : 2, intent: { kind: "exam", targetId: e.id, phrase: rawClause, matched: true } });
    }
  }
  return out;
}

/** "Show me the X-ray", "generate the ECG", "see the scan again" — display, don't repeat. */
const SHOW_WORDS = ["show", "see", "view", "display", "look at", "image", "picture", "photo", "photograph", "film", "strip", "tracing", "again", "generate", "pull up", "open"];

/** Orders that name only the kind of study — the part (and view, or contrast) is asked for. */
const GENERIC_STUDIES: [string, string[]][] = [
  ["xray", ["x ray", "xray", "x rays", "xrays", "radiograph", "radiographs", "skiagram", "plain film"]],
  ["ct", ["ct", "ct scan", "cect", "ncct", "cat scan", "computed tomography"]],
  ["usg", ["usg", "ultrasound", "sonography", "ultrasonography", "sonogram"]],
  ["mri", ["mri", "mri scan", "magnetic resonance", "mr scan"]],
];
/** "Send bloods" — which ones is asked. */
const GENERIC_BLOODS = ["blood tests", "blood test", "bloods", "blood work", "bloodwork", "routine bloods", "routine blood tests", "routine investigations", "basic investigations", "basic labs", "labs", "lab tests", "baseline investigations"];

function investigationCandidates(rawClause: string, tk: string[], ctx: IntentContext): Candidate[] {
  const out: Candidate[] = [];
  const payload = hasAny(tk, SHOW_WORDS) ? { reshow: true } : undefined;
  for (const [kind, phrases] of GENERIC_STUDIES) {
    for (const hit of allHits(tk, phrases)) out.push({ hit, priority: 3, intent: { kind: "investigation", targetId: kind, phrase: rawClause, matched: true, payload } });
  }
  const bloods = allHits(tk, GENERIC_BLOODS);
  for (const inv of ctx.def.investigations) {
    if (!inv.match) continue;
    for (const hit of allHits(tk, inv.match)) {
      out.push({ hit, priority: 5, intent: { kind: "investigation", targetId: inv.id, phrase: rawClause, matched: true, payload } });
    }
  }
  for (const inv of INVESTIGATIONS) {
    for (const hit of allHits(tk, inv.match)) {
      out.push({ hit, priority: 4, intent: { kind: "investigation", targetId: inv.id, phrase: rawClause, matched: true, payload } });
    }
  }
  // "Bloods" alone is asked about; "bloods — CBC and RFT" is those tests.
  const named = out.some((c) => !["xray", "ct", "usg", "mri"].includes(c.intent.targetId ?? ""));
  if (!named) for (const hit of bloods) out.push({ hit, priority: 2, intent: { kind: "investigation", targetId: "blood", phrase: rawClause, matched: true, payload } });
  return out;
}

/** Splits a clause between consecutive drug mentions, at the conjunction separating them. */
function boundary(text: string, a: number, b: number): number {
  const between = text.slice(a, b);
  const joins = [...between.matchAll(/,|;|\+|\band\b|\bwith\b|\bplus\b|\balong with\b/g)];
  const last = joins[joins.length - 1];
  return last?.index !== undefined ? a + last.index : Math.round((a + b) / 2);
}

function drugCandidates(rawClause: string, tk: string[], ctx: IntentContext): Candidate[] {
  const lower = rawClause.toLowerCase();

  // Longest non-overlapping drug mentions ("adapalene with benzoyl peroxide" beats "adapalene").
  const hits: { drug: (typeof FORMULARY)[number]; hit: PhraseHit }[] = [];
  for (const drug of FORMULARY) for (const hit of allHits(tk, drugMatchPhrases(drug))) hits.push({ drug, hit });
  // A drug name slightly misspelt ("oseltimivir", "amoxycilin"): the closest one, if it's close enough.
  if (hits.length === 0) {
    for (let i = 0; i < tk.length; i++) {
      const word = tk[i]!;
      if (word.length < 6) continue;
      let best: { drug: (typeof FORMULARY)[number]; phrase: string; d: number } | null = null;
      // Every other drug nearly as close — if there is one, the spelling is ambiguous and nothing is guessed.
      let rival = false;
      for (const drug of FORMULARY)
        for (const phrase of drugMatchPhrases(drug)) {
          if (phrase.includes(" ") || phrase.length < 6 || phrase[0] !== word[0]) continue;
          const d = editDistance(word, phrase);
          if (d > (phrase.length >= 9 ? 2 : 1) + 1) continue;
          if (!best || d < best.d) {
            if (best && best.drug.id !== drug.id && best.d <= d + 1) rival = true;
            best = d <= (phrase.length >= 9 ? 2 : 1) ? { drug, phrase, d } : best;
          } else if (best.drug.id !== drug.id && d <= best.d + 1) rival = true;
        }
      if (best && !rival) hits.push({ drug: best.drug, hit: { phrase: best.phrase, start: i, end: i + 1 } });
    }
  }
  hits.sort((a, b) => b.hit.end - b.hit.start - (a.hit.end - a.hit.start) || a.hit.start - b.hit.start);
  const kept: typeof hits = [];
  for (const h of hits) if (!kept.some((k) => h.hit.start < k.hit.end && k.hit.start < h.hit.end)) kept.push(h);
  kept.sort((a, b) => a.hit.start - b.hit.start);

  // Each mention gets its own slice of the sentence for dose, route and frequency.
  const positions = kept.map((k) => {
    const idx = lower.indexOf(k.hit.phrase);
    return idx >= 0 ? idx : Math.round((k.hit.start / Math.max(1, tk.length)) * lower.length);
  });
  const segments = kept.map((_, n) => {
    const from = n === 0 ? 0 : boundary(lower, positions[n - 1]!, positions[n]!);
    const to = n === kept.length - 1 ? lower.length : boundary(lower, positions[n]!, positions[n + 1]!);
    return lower.slice(from, to);
  });

  const out: Candidate[] = [];
  kept.forEach(({ drug, hit }, n) => {
    const segment = segments[n] ?? lower;
    const details = parseOrderDetails(segment, { weightKg: ctx.weightKg });
    if (precededBy(tk, hit.start, NEGATIONS, 3)) {
      const stopping = precededBy(tk, hit.start, ["stop", "hold", "withhold", "discontinue", "cease"], 3);
      out.push({
        hit,
        priority: 6,
        intent: stopping
          ? { kind: "action", targetId: "measure:stop-drug", phrase: rawClause, matched: true, payload: { drugId: drug.id } }
          : { kind: "action", targetId: "counsel:avoid", phrase: rawClause, matched: true, payload: { drugId: drug.id } },
      });
      return;
    }
    // Salt is food, not a drug: only an order to eat an amount of it ("eat 50 g of salt") is an order; "low salt diet" is advice.
    if (drug.id === "table-salt" && !(details.amount !== undefined && /\b(eat|give|take|swallow|feed|have|consume|drink|mix|add|lick)\b/.test(lower))) return;
    // A brand that names its strength ("Dolo 650") is a dose.
    if (details.amount === undefined && /\d/.test(hit.phrase) && drug.brands.some((b) => b.toLowerCase().includes(hit.phrase))) {
      const n = hit.phrase.match(/(\d+(?:\.\d+)?)/)?.[1];
      const unit = drug.dose?.match(/^[\d.,]+\s*([a-zµ]+)/i)?.[1];
      if (n && unit) {
        details.amount = parseFloat(n);
        details.unit = unit.toLowerCase();
        details.text = `${n} ${unit.toLowerCase()}`;
      }
    }
    // "A Sorbitrate", "one Crocin": one tablet of it.
    if (details.amount === undefined && ["PO", "SL"].includes(drug.route) && hit.start > 0 && ["a", "an", "one"].includes(tk[hit.start - 1] ?? "")) {
      details.amount = 1;
      details.unit = "tablet";
      details.text = "1 tablet";
    }
    // The route as said; when it isn't, the drug's usual route decides only whether it's given now — the nurse asks.
    const route = details.route ?? drug.route;
    const givenNow =
      /\b(give|administer|inject|infuse|bolus|push|stat|now|nebuli[sz]e|transfuse|load|chew|immediately)\b/.test(lower) ||
      (drug.id === "table-salt") ||
      // On a phone call, "take" / "put under the tongue" is done at home, now.
      (ctx.setting === "Teleconsult" && /\b(take|swallow|put|place|keep)\b/.test(lower)) ||
      ["IV", "IM", "NEB"].includes(route) ||
      (route === "SC" && /\b(stat|now|give)\b/.test(lower));
    const prescribing =
      /\b(prescribe|rx|advise|send home|discharge on|continue|for \d+ (?:day|week|month)s?|x \d+)\b/.test(segment) ||
      !!details.duration;
    const outpatient = ctx.setting === "OPD" || ctx.setting === "Teleconsult";
    const mode = givenNow && !prescribing ? "given" : prescribing ? "prescribed" : outpatient ? "prescribed" : "given";
    const payload: Record<string, string | number | boolean> = { mode };
    if (details.route) payload.route = details.route;
    if (details.rapid) payload.rapid = true;
    if (details.rateMlH !== undefined) payload.rateMlH = details.rateMlH;
    if (details.text) payload.dose = details.text;
    if (details.amount !== undefined) payload.amount = details.amount;
    if (details.unit) payload.unit = details.unit;
    if (details.frequency) payload.frequency = details.frequency;
    if (details.duration) payload.duration = details.duration;
    if (details.volumeMl !== undefined) payload.volumeMl = details.volumeMl;
    if (details.overMin !== undefined) payload.overMin = details.overMin;
    out.push({ hit, priority: 6, intent: { kind: "drug", targetId: drug.id, phrase: rawClause, matched: true, payload } });
  });
  return out;
}

function actionCandidates(rawClause: string, tk: string[], ctx: IntentContext): Candidate[] {
  const out: Candidate[] = [];
  // Case-specific therapeutic rules expressed as phrases (procedures, counselling…).
  for (const rule of ctx.def.therapeutics) {
    if (!rule.match) continue;
    for (const hit of allHits(tk, rule.match)) {
      if (precededBy(tk, hit.start, ["dont", "do not", "no need", "not"], 2)) continue;
      out.push({ hit, priority: 7, intent: { kind: "action", targetId: rule.id, phrase: rawClause, matched: true } });
    }
  }
  // Catalogue measures, mapped onto a case rule when one claims the measure.
  for (const m of MEASURES) {
    for (const hit of allHits(tk, m.match)) {
      if (m.id === "stop-drug" && hasAny(tk, ["fluid", "fluids", "saline", "ns", "infusion"])) continue;
      const rule = ctx.def.therapeutics.find((r) => r.measureIds?.includes(m.id));
      out.push({
        hit,
        priority: 5,
        intent: { kind: "action", targetId: rule ? rule.id : `measure:${m.id}`, phrase: rawClause, matched: true },
      });
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Clause resolution                                                           */
/* -------------------------------------------------------------------------- */

function resolveClause(rawClauseIn: string, ctx: IntentContext): ResolvedIntent[] {
  let rawClause = rawClauseIn.trim();
  const intents: ResolvedIntent[] = [];

  // Greeting prefix: answer it, then keep parsing the rest of the clause.
  const greet = rawClause.match(GREETING_RE);
  if (greet) {
    intents.push({ kind: "greeting", phrase: greet[0].trim(), matched: true });
    rawClause = rawClause.slice(greet[0].length).replace(/^(doctor|sir|madam|ji)\b[\s,]*/i, "").trim();
    if (!rawClause) return intents;
  }

  let norm = normalise(rawClause);

  // Closure may be embedded: "Diagnosis acne vulgaris, case close".
  let closing = false;
  if (CLOSE_RE.test(norm)) {
    closing = true;
    rawClause = rawClause.replace(/[,.\s-]*\b(case close[d]?|close (?:the )?case|end (?:the )?case|finish (?:the )?case|close (?:the )?encounter|end (?:the )?encounter|close this case)\b[.!\s]*/i, " ").trim();
    norm = normalise(rawClause);
  }

  const done = (list: ResolvedIntent[]) => {
    const all = [...intents, ...list];
    if (closing) all.push({ kind: "close", phrase: "case close", matched: true });
    return all;
  };

  if (!rawClause) return done([]);

  // Differential before diagnosis ("differential diagnosis: …").
  const ddx = rawClause.match(DIFFERENTIAL_RE);
  if (ddx?.[1]) {
    const list = ddx[1].split(/,|\bor\b|\bvs\.?\b|\bversus\b|\band\b|\//i).map((x) => x.trim()).filter(Boolean);
    return done([{ kind: "differential", phrase: rawClause, matched: true, payload: { text: list.join("; ") } }]);
  }
  const dx = rawClause.match(DIAGNOSIS_RE) ?? rawClause.match(OPINION_RE);
  if (dx?.[1] && !rawClause.trim().endsWith("?") && !/^(you|he|she|they|the patient)\b/i.test(dx[1].trim())) {
    return done([{ kind: "diagnosis", phrase: rawClause, matched: true, payload: { text: dx[1].replace(/[.\s]+$/, "") } }]);
  }

  const tk = tokens(norm);
  const question = isQuestion(rawClause, norm);
  // "Feel" is palpation ("feel the pulse") — but "how do you feel?" is for the patient to answer.
  const feelingQuestion = FEELING_RE.test(norm);
  const clinicianDirected = hasClinicianVerb(tk) && !feelingQuestion;

  // Nothing but punctuation ("?"): nothing to act on.
  if (tk.length === 0) return done([{ kind: "unknown", phrase: rawClause, matched: false, payload: { empty: true } }]);

  // Follow-up scheduling.
  if (hasAny(tk, ["follow up", "review", "come back", "revisit", "see you", "see him", "see her", "next visit", "recall"]) && !question) {
    let days: number | null = null;
    const span = parseSpanMinutes(norm);
    if (span !== null && span >= 1440) days = Math.round(span / 1440);
    else if (hasAny(tk, ["tomorrow"])) days = 1;
    else if (hasAny(tk, ["next week", "a week"])) days = 7;
    else if (hasAny(tk, ["next month", "a month"])) days = 30;
    else if (hasAny(tk, ["with reports", "with report", "with results", "with the reports"])) days = 2;
    if (days !== null || hasAny(tk, ["follow up", "revisit", "come back"])) {
      return done([{ kind: "followup", phrase: rawClause, matched: true, payload: { days: days ?? 7 } }]);
    }
  }

  // Waiting / observation over time.
  if (/^(?:let s |lets |we ll |will )?(wait|observe|watch|give it|keep under observation|observe for)\b/.test(norm) || hasAny(tk, ["wait for", "wait and watch"])) {
    if (hasAny(tk, ["result", "report", "lab", "labs"])) {
      return done([{ kind: "wait", phrase: rawClause, matched: true, payload: { untilResults: true } }]);
    }
    const span = parseSpanMinutes(norm);
    const list: ResolvedIntent[] = [{ kind: "wait", phrase: rawClause, matched: true, payload: { minutes: Math.min(span ?? 15, 60 * 24) } }];
    if (hasAny(tk, ["reassess", "recheck", "repeat vitals", "re examine"])) list.push({ kind: "reassess", phrase: rawClause, matched: true });
    return done(list);
  }

  // Reassessment.
  if (hasAny(tk, ["reassess", "re assess", "re examine", "reexamine", "recheck", "re check", "repeat vitals", "repeat the vitals", "how is the patient now", "how is he now", "how is she now", "how are you feeling now", "how do you feel now", "check on the patient", "review the patient"])) {
    const list: ResolvedIntent[] = [];
    const span = parseSpanMinutes(norm);
    if (span !== null && hasAny(tk, ["after", "in"])) list.push({ kind: "wait", phrase: rawClause, matched: true, payload: { minutes: Math.min(span, 1440) } });
    list.push({ kind: "reassess", phrase: rawClause, matched: true });
    return done(list);
  }

  // Asking about results ("result of the test?", "is the CBC report ready?"): show what's back, say what's pending — never a new order.
  if (hasAny(tk, ["result", "results", "report", "reports", "findings", "impression"]) && !hasAny(tk, ["order", "send", "send for", "request", "repeat"])) {
    const named = resolveOverlaps(investigationCandidates(rawClause, tk, ctx));
    // "USG report?" / "impression of the CT" — the report itself, not just the picture again.
    const report = hasAny(tk, ["report", "reports", "impression", "reported", "radiologist"]);
    if (named.length > 0) return done(named.map((i) => ({ ...i, payload: { ...i.payload, reshow: true, ...(report ? { report: true } : {}) } })));
    return done([{ kind: "results", phrase: rawClause, matched: true }]);
  }

  // "Show me (the picture / the rash / it)": the doctor wants to see — the examination that has a photograph.
  if (/^(?:please\s+|can you\s+|let me\s+)?(?:show(?: me)?|let me see|can i see)\b(?:\s+(?:the|your|a|it|that|them))*\s*(?:picture|photo|photograph|image|pic|lesions?|rash|skin|spots?|lumps?|swelling|wound|it|that|them)?\s*$/.test(norm)) {
    // Only an examination that has a photograph — otherwise it's not this rule's to guess.
    const pictured = ctx.def.exam.find((e) => e.media);
    if (pictured) return done([{ kind: "exam", targetId: pictured.id, phrase: rawClause, matched: true }]);
  }

  // "How are you feeling?" — the patient says how they are now.
  if (feelingQuestion) return done([{ kind: "history", targetId: "identity:feeling", phrase: rawClause, matched: true }]);

  // Questions addressed to the patient go to history first — except the stethoscope's words ("heart sounds?").
  if (question && !clinicianDirected) {
    const stethoscope = examCandidates(rawClause, tk, ctx, false).filter((c) => c.priority >= 5);
    if (stethoscope.length > 0) return done(resolveOverlaps(stethoscope));
    const hx = resolveHistory(rawClause, tk, ctx);
    if (hx.length > 0) return done(hx);
    // "What is the BP?" / "BP?" — a request for a measurement.
    const vitals = vitalCandidates(rawClause, tk);
    if (vitals.length > 0 && (tk.length <= 4 || hasAny(tk, ["what is the", "whats the", "what is his", "what is her", "how much is"]))) {
      return done(resolveOverlaps(vitals));
    }
    const exam = examCandidates(rawClause, tk, ctx, false).filter((c) => c.priority >= 4);
    if (exam.length > 0) return done(resolveOverlaps(exam));
    return done([{ kind: "history", targetId: /^(do|does|did|is|are|was|were|have|has|had|any|can|could|ever|will|would)\b/.test(norm) || /\bany\b/.test(norm) ? "fallback:yesno" : "fallback:open", phrase: rawClause, matched: false }]);
  }

  // Everything else: collect concrete targets across all categories.
  const cands: Candidate[] = [
    ...vitalCandidates(rawClause, tk),
    ...examCandidates(rawClause, tk, ctx, true),
    ...investigationCandidates(rawClause, tk, ctx),
    ...drugCandidates(rawClause, tk, ctx),
    ...actionCandidates(rawClause, tk, ctx),
  ];

  // A history-style statement ("tell me about your diet") with no clinical target.
  if (cands.length === 0) {
    const hx = resolveHistory(rawClause, tk, ctx);
    if (hx.length > 0) return done(hx);
  }

  let resolved = resolveOverlaps(cands);

  // A bare sign or region with no verb at all ("McBurney's point", "Rovsing sign").
  if (resolved.length === 0 && !clinicianDirected) {
    resolved = resolveOverlaps(examCandidates(rawClause, tk, ctx, false).filter((c) => c.priority >= 4));
  }

  // Bare exam requests the catalogues don't know: "examine the lesion".
  if (resolved.length === 0 && hasAny(tk, EXAM_VERBS)) {
    resolved = [{ kind: "exam", targetId: "generic", phrase: rawClause, matched: false }];
  }
  if (resolved.length === 0 && hasAny(tk, COUNSEL_VERBS)) {
    resolved = [{ kind: "action", targetId: "counsel:generic", phrase: rawClause, matched: true }];
  }
  if (resolved.length === 0 && hasAny(tk, PROCEDURE_VERBS)) {
    resolved = [{ kind: "action", targetId: "procedure:generic", phrase: rawClause, matched: false }];
  }
  if (resolved.length === 0 && hasAny(tk, TREATMENT_VERBS)) {
    resolved = [{ kind: "drug", targetId: "unknown", phrase: rawClause, matched: false }];
  }
  if (resolved.length === 0) {
    resolved = [{ kind: "unknown", phrase: rawClause, matched: false, payload: { question } }];
  }
  return done(resolved);
}

/** Resolves a full player message into an ordered list of intents. */
const DEPARTMENTS: [RegExp, string][] = [
  [/cardio/, "Cardiology"], [/neuro\s*surg/, "Neurosurgery"], [/neuro/, "Neurology"], [/ortho/, "Orthopaedics"], [/gyn|obs|obgyn|ob\/gyn/, "Obstetrics & Gynaecology"],
  [/paed|pedia|ped\b/, "Paediatrics"], [/derm|skin/, "Dermatology"], [/\bent\b|otolaryn/, "ENT"], [/ophthal|eye/, "Ophthalmology"], [/psych/, "Psychiatry"],
  [/nephro|renal|kidney/, "Nephrology"], [/gastro|\bgi\b|hepato/, "Gastroenterology"], [/pulmo|chest|respir/, "Pulmonology"], [/uro/, "Urology"],
  [/anaesth|anesth|icu|intensiv|critical care/, "Anaesthesia & ICU"], [/endo(crin)?/, "Endocrinology"], [/surg/, "General Surgery"], [/medicine|physician/, "Internal Medicine"],
  [/infectious|\bid\b/, "Infectious Disease"], [/haemat|hemat/, "Haematology"], [/onco/, "Oncology"],
];

/** The department asked for a consult ("" when none named yet), or null when it isn't a consult. */
export function consultDepartment(raw: string): string | null {
  const t = raw.toLowerCase().trim();
  if (/^(?:get |call |ask for )?(?:a |an )?(?:consult(?:ation)?|opinion|specialist)(?: please)?$/.test(t)) return "";
  const hit = DEPARTMENTS.find(([re]) => re.test(t));
  if (!hit) return null;
  // "cardiology consult", "opinion from surgery", "call ortho", "call the paediatrician".
  if (/\b(consult(?:ation)?|opinion|review)\b/.test(t) || /^(?:please\s+)?(?:call|page|get)\s+(?:the\s+|a\s+|an\s+)?\S+\s*(?:team|doctor|resident|registrar|specialist|on call)?\s*$/.test(t)) return hit[1];
  return null;
}

export function resolveIntents(raw: string, ctx: IntentContext): ResolvedIntent[] {
  // Plain instructions to the patient — answered at once, no AI needed.
  if (/^\s*(?:please\s+|can you\s+|could you\s+)?(?:stand(?: up)?|get up|sit(?: up| down)?|lie (?:down|flat)|lie on (?:your|the) (?:back|side|left|right)|turn (?:over|to (?:your|the) (?:left|right|side))|walk(?: a few steps| for me| around)?|take a (?:deep )?breath|breathe (?:in|deeply)|hold your breath|open your mouth|say (?:aa+h|ahh+)|stick out your tongue|show (?:me )?your tongue|relax|cough)\b[^?]{0,30}$/i.test(raw)) return [{ kind: "instruct", phrase: raw, matched: true }];
  // "Hint", "give me a hint", "I'm stuck": a nudge, only when asked for.
  if (/^\s*(?:please\s+)?(?:give me |show me |i need |any )?(?:a |another )?(?:hint|clue)s?\b|\bi'?m stuck\b|\bwhat (?:should|do) i do next\b/i.test(raw)) return [{ kind: "hint", phrase: raw, matched: true }];
  // "Call cardiology", "surgery consult", "ortho opinion": another department's view.
  const consult = consultDepartment(raw);
  if (consult !== null) return [{ kind: "consult", targetId: consult || undefined, phrase: raw, matched: true }];
  const clauses = splitClauses(raw);
  const out: ResolvedIntent[] = [];
  for (const clause of clauses) out.push(...resolveClause(clause, ctx));
  // A single "case close" anywhere wins once, at the end.
  const closing = out.some((i) => i.kind === "close");
  const rest = out.filter((i) => i.kind !== "close");
  return closing ? [...rest, { kind: "close", phrase: "case close", matched: true }] : rest;
}

