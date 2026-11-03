/**
 * The way a patient says it. Written replies can be terse ("No sugar, BP or asthma."); out loud they're sentences, shaped by
 * how the patient is right now: too breathless to say much, or hurting. Words only: never a new fact, and what's recorded stays as written.
 * Fixed tables and a hash of the words, with no model, so a case replays exactly. (Hinglish keeps its own lines: see i18n/hinglish.)
 */

export interface SpeakerState {
  spo2?: number;
  rr?: number;
  /** 0–10. */
  pain?: number;
  age?: number;
  /** A relative speaking of the patient. */
  relative: boolean;
  /** First person to third, for a relative. */
  aboutThem: (text: string) => string;
  sex?: string;
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = <T,>(xs: readonly T[], seed: string): T => xs[hash(seed) % xs.length]!;

const WORDS: [RegExp, string][] = [[/\bBP\b/, "high BP"]];
const HABITS = /^(?:alcohol|drinking|smoking|tobacco|gutkha|drugs|cigarettes?|bidis?)$/i;
const CHRONIC = /\b(?:sugar|bp|diabetes|hypertension|asthma|tb|tuberculosis|thyroid|gout|epilepsy|kidney (?:disease|trouble|problems?)|liver (?:disease|problems?)|heart (?:disease|trouble|problems?)|illness(?:es)?|ulcers?)\b/i;
const MEDS = /\b(?:tablets?|medicines?|blood thinners?|pills?|injections?|supplements?|steroids?|insulin)\b/i;
const WORN = /\b(?:glasses|contact lenses|lenses|dentures)\b/i;
/** A sentence that already has its verb, or isn't a list of things. */
const NOT_A_LIST = /\b(?:is|are|was|were|am|has|have|had|did|does|do|can|could|will|would|helps?|helped|works?|worked|comes?|came|goes|went|ever|seen|changed|one|idea|way|need|matter|more|thanks?|wonder|change|difference|better|worse|relief|effect|help)\b/i;

const listed = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`);
const withWords = (s: string) => WORDS.reduce((t, [re, to]) => t.replace(re, to), s);

/** "No sugar, BP or asthma." → "I don't have sugar, high BP or asthma."; anything else is left as it was. */
function negative(sentence: string): string {
  const m = /^No\s+(.+?)(, doctor)?([.!…]*)$/.exec(sentence);
  if (!m) return sentence;
  const tail = m[2] ?? "";
  // Words that hang off the end ("that I know of", "before this pregnancy") stay at the end.
  const qualifier = /\s+(that (?:I|we) know of|that (?:I|we)'ve seen|I know of|we know of|yet|so far|at all|in the family|in my family|except .+|before .+)$/i.exec(m[1]!);
  const body = qualifier ? m[1]!.slice(0, qualifier.index) : m[1]!;
  if (m[1]!.split(/\s+/).length > 14 || NOT_A_LIST.test(body) || /^,/.test(body)) return sentence;
  const after = qualifier ? ` ${qualifier[1]}` : "";
  const items = body.split(/\s*,\s*|\s+or\s+|\s+and\s+|\s+no\s+/i).map((x) => x.replace(/^(?:no|any)\s+/i, "").trim()).filter(Boolean);
  if (!items.length) return sentence;
  const habits = items.filter((i) => HABITS.test(i));
  const others = items.filter((i) => !HABITS.test(i));
  const said: string[] = [];
  if (others.length) {
    const what = withWords(listed(others));
    if (others.every((i) => /^allerg/i.test(i))) said.push(`I don't have any allergies${after}`);
    else if (others.every((i) => MEDS.test(i))) said.push(`I'm not taking any ${what}${after}`);
    else if (others.every((i) => WORN.test(i))) said.push(`I don't wear ${what}${after}`);
    else if (others.every((i) => /^pets?$/i.test(i))) said.push(`We don't keep any pets${after}`);
    else if (others.every((i) => CHRONIC.test(i))) said.push(`No doctor, I don't have ${what}${after}`);
    else said.push(`I haven't had any ${what}${after}`);
  }
  if (habits.length) {
    const smokes = habits.some((h) => /smok|tobacco|cigar|bidi|gutkha/i.test(h));
    const drinks = habits.some((h) => /alcohol|drink/i.test(h));
    const drugs = habits.some((h) => /^drugs$/i.test(h));
    const parts = [drinks ? "drink" : "", smokes ? "smoke" : "", drugs ? "take drugs" : ""].filter(Boolean);
    said.push(`I don't ${parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} or ${parts.at(-1)}`}${others.length ? "" : after}`);
  }
  return `${said.join(", and ")}${tail}${m[3] || "."}`;
}

/** One answer's sentences, said as sentences. Words before a colon ("As I told you, doctor: ") aren't touched. */
function sentences(text: string, who: SpeakerState): string {
  const lead = /^[^:]{3,40}: /.exec(text)?.[0] ?? "";
  const rest = text.slice(lead.length);
  const out = rest.split(/(?<=[.!?…])\s+/).map((s) => {
    const said = negative(s);
    return said !== s && who.relative ? who.aboutThem(said) : said;
  });
  return `${lead}${out.join(" ")}`;
}

/** The next answer in the same breath: starts in the middle of a sentence. */
function carriedOn(text: string, seed: string): string {
  if (/^(?:and|but|also|apart|yes|no\b|well|oh|ah|sorry)/i.test(text)) return text;
  const lower = /^(?:I\b|I'|[A-Z]{2})/.test(text) ? text : `${text[0]!.toLowerCase()}${text.slice(1)}`;
  return `${pick(["And ", "Also, "], seed)}${lower}`;
}

const BREATHLESS = ["Doctor, I can barely finish a sentence… ", "Sorry, doctor… so hard to breathe… ", "Doctor… can't get my breath… ", "Give me a second, doctor… "];
const RELATIVE_BREATHLESS = ["Doctor, please, the breathing is so bad… ", "Doctor, look how hard the breathing is… "];
const IN_PAIN = ["It hurts so much, doctor… ", "Sorry, doctor, this pain… ", "Ah… give me a moment, doctor. ", "Doctor, it's really bad right now. "];

/** How one turn's answer comes out. `parts`: separate answers said together. */
export function spokenLine(parts: string[], who: SpeakerState): string {
  const seed = parts.join("|");
  const said = parts.map((p, i) => {
    const line = sentences(p, who);
    return i === 0 ? line : carriedOn(line, `${seed}${i}`);
  }).join(" ");
  // (A small child normally breathes faster: 46 a minute at three isn't gasping.)
  const fastBreathing = (who.age ?? 30) < 5 ? 50 : (who.age ?? 30) < 12 ? 40 : 28;
  const gasping = (who.spo2 !== undefined && who.spo2 < 90) || (who.rr !== undefined && who.rr >= fastBreathing);
  if (gasping) {
    // A relative says so now and then, not every time.
    if (who.relative) return hash(seed) % 3 === 0 ? `${pick(RELATIVE_BREATHLESS, seed)}${said}` : said;
    // Short of breath, the words come in pieces.
    const pieces = said.replace(/([.!?])\s+/g, "… ");
    return hash(seed) % 2 === 0 ? `${pick(BREATHLESS, seed)}${pieces}` : pieces;
  }
  if (!who.relative && (who.pain ?? 0) >= 7 && hash(seed) % 3 !== 0) return `${pick(IN_PAIN, seed)}${said}`;
  return said;
}
