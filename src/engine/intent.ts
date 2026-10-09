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
  "check", "measure", "record", "take", "examine", "examination", "palpate", "auscultate", "inspect", "percuss",
  "look at", "look for", "elicit", "assess", "order", "send", "get", "request", "advise", "do", "perform", "give",
  "start", "administer", "prescribe", "rx", "inject", "infuse", "apply", "put", "attach", "insert", "monitor",
  "plan", "schedule", "arrange", "admit", "refer", "repeat", "test", "feel", "see", "evaluate", "screen",
];
const EXAM_VERBS = ["examine", "examination", "palpate", "auscultate", "inspect", "percuss", "look at", "look for", "elicit", "feel", "test for", "check for", "assess", "look in", "see the"];
const TREATMENT_VERBS = ["give", "start", "administer", "prescribe", "rx", "inject", "infuse", "push", "bolus", "apply", "put on", "put him on", "put her on", "tab", "tablet", "cap", "capsule", "inj", "injection", "syp", "syrup", "neb", "nebulise", "nebulize", "continue", "add", "switch to", "increase", "load", "loading dose", "transfuse", "dose of"];
const COUNSEL_VERBS = ["counsel", "counselling", "counseling", "advise", "explain", "educate", "reassure", "tell him", "tell her", "tell the patient", "teach", "instruct", "recommend", "lifestyle", "inform"];
const PROCEDURE_VERBS = ["perform", "do a", "do an", "plan", "schedule", "take up for", "posted for", "post for", "undergo", "arrange", "proceed with", "operate"];
const NEGATIONS = ["dont", "don t", "do not", "never", "avoid", "no", "not", "without", "stop", "hold", "withhold", "discontinue", "cease"];
const HISTORY_GUARD = ["do you have", "have you", "any history", "history of", "known case of", "are you", "did you", "suffer", "suffering", "diagnosed", "any", "taking medicine for", "medicine for", "problem of", "since when", "do you", "complaining of"];

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
    if (ids.length > 1) return ids.slice(0, 3).map((id) => ({ kind: "history", targetId: id, phrase: rawClause, matched: true }));
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
  const verb = hasAny(tk, EXAM_VERBS) || hasAny(tk, ["check", "look", "see", "show me", "examine", "test", "measure", "elicit"]);
  // Words like "face" or "pimples" appear in counselling too — only an examination verb makes them an examination.
  if (requireVerb && !verb) return out;
  for (const e of ctx.def.exam) {
    // An override of a catalogue exam may omit `match` and inherit its phrases.
    const phrases = e.match.length ? e.match : EXAMS.find((c) => c.id === e.id)?.match ?? [];
    for (const hit of allHits(tk, phrases)) {
      out.push({ hit, priority: 4, intent: { kind: "exam", targetId: e.id, phrase: rawClause, matched: true } });
    }
  }
  {
    for (const e of EXAMS) {
      if (ctx.def.exam.some((c) => c.id === e.id)) continue; // case override already listed
      for (const hit of allHits(tk, e.match)) {
        out.push({ hit, priority: 2, intent: { kind: "exam", targetId: e.id, phrase: rawClause, matched: true } });
      }
    }
  }
  return out;
}

/** "Show me the X-ray", "generate the ECG", "see the scan again" — display, don't repeat. */
const SHOW_WORDS = ["show", "see", "view", "display", "look at", "image", "picture", "photo", "photograph", "film", "strip", "tracing", "again", "generate", "pull up", "open"];

function investigationCandidates(rawClause: string, tk: string[], ctx: IntentContext): Candidate[] {
  const out: Candidate[] = [];
  const payload = hasAny(tk, SHOW_WORDS) ? { reshow: true } : undefined;
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
    const route = details.route ?? drug.route;
    const givenNow =
      /\b(give|administer|inject|infuse|bolus|push|stat|now|nebuli[sz]e|transfuse|load|chew|immediately)\b/.test(lower) ||
      // On a phone call, "take" / "put under the tongue" is done at home, now.
      (ctx.setting === "Teleconsult" && /\b(take|swallow|put|place|keep)\b/.test(lower)) ||
      ["IV", "IM", "NEB"].includes(route) ||
      (route === "SC" && /\b(stat|now|give)\b/.test(lower));
    const prescribing =
      /\b(prescribe|rx|advise|send home|discharge on|continue|for \d+ (?:day|week|month)s?|x \d+)\b/.test(segment) ||
      !!details.duration;
    const outpatient = ctx.setting === "OPD" || ctx.setting === "Teleconsult";
    const mode = givenNow && !prescribing ? "given" : prescribing ? "prescribed" : outpatient ? "prescribed" : "given";
    const payload: Record<string, string | number | boolean> = { mode, route };
    if (details.text) payload.dose = details.text;
    if (details.amount !== undefined) payload.amount = details.amount;
    if (details.unit) payload.unit = details.unit;
    if (details.frequency) payload.frequency = details.frequency;
    if (details.duration) payload.duration = details.duration;
    if (details.volumeMl !== undefined) payload.volumeMl = details.volumeMl;
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
  const clinicianDirected = hasClinicianVerb(tk);

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

  // Questions addressed to the patient go to history first.
  if (question && !clinicianDirected) {
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
export function resolveIntents(raw: string, ctx: IntentContext): ResolvedIntent[] {
  const clauses = splitClauses(raw);
  const out: ResolvedIntent[] = [];
  for (const clause of clauses) out.push(...resolveClause(clause, ctx));
  // A single "case close" anywhere wins once, at the end.
  const closing = out.some((i) => i.kind === "close");
  const rest = out.filter((i) => i.kind !== "close");
  return closing ? [...rest, { kind: "close", phrase: "case close", matched: true }] : rest;
}

