/**
 * Wrong options a doctor could really fall for. Pure (no React, no server): given an item and its pool, the
 * three most confusable others — same sub-group first, ranked by clinical similarity (explicit look-alike
 * clusters, then shared words in the label and key), then the rest of the pool — shuffled with the right one.
 */
export interface Pickable {
  id: string;
  label: string;
  key?: string;
  group?: string;
}

export interface PickRules {
  /** Sets of ids that are classic look-alikes of one another. */
  clusters?: readonly (readonly string[])[];
  /** Pairs where both could be called right for the same picture (a Colles' fracture IS a distal radius fracture): never offered together. */
  alsoTrue?: readonly (readonly [string, string])[];
  rand?: () => number;
  wrong?: number;
}

const STOP = new Set("the and with for from that this are but not its than can has have may often usually into over under after before when between without within each both only one two very more most less seen left right".split(" "));
const words = (s = ""): Set<string> => new Set(s.toLowerCase().replace(/\*\*/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)));
function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

/** How alike two items read: the label counts for more than the key. */
export function similarity(a: Pickable, b: Pickable): number {
  return overlap(words(a.label), words(b.label)) + 0.5 * overlap(words(a.key), words(b.key));
}

/** Brackets that make the name true rather than give it away: without them it would also fit a look-alike (flutter is a supraventricular tachycardia too). */
const NAMING = /\((AVNRT|Wuchereria bancrofti|post-primary TB)\)$/;
/** A label without its trailing bracket: "Epiglottitis (thumb sign)" names the sign that is the question. */
export const optionText = (label: string): string => (NAMING.test(label) ? label : label.replace(/\s*\([^()]*\)\s*$/, "").trim() || label);

/** The words shown on the buttons: same shape for all four, the bracket kept only where two would read alike without it. */
export function optionTexts(labels: readonly string[]): string[] {
  const short = labels.map(optionText);
  return short.map((s, i) => (short.filter((x) => x === s).length > 1 ? labels[i]! : s));
}

function shuffled<T>(xs: readonly T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** The wrong options, best first. Fewer than asked only when the pool truly has no more. */
export function pickConfusable<T extends Pickable>(item: T, pool: readonly T[], rules: PickRules = {}): T[] {
  const { clusters = [], alsoTrue = [], rand = Math.random, wrong = 3 } = rules;
  const near = new Set(clusters.filter((c) => c.includes(item.id)).flat());
  const clash = (a: T, b: T) => a.id === b.id || a.label === b.label || optionText(a.label) === optionText(b.label) || alsoTrue.some(([x, y]) => (x === a.id && y === b.id) || (y === a.id && x === b.id));
  const scored = pool
    .filter((c) => !clash(c, item))
    .map((c) => ({
      c,
      sameGroup: !!item.group && c.group === item.group,
      // Look-alikes first, a little chance so a round isn't always the same four; a similar length, so the answer doesn't stand out.
      score: (near.has(c.id) ? 2 : 0) + similarity(item, c) + rand() * 0.25 - Math.abs(optionText(c.label).length - optionText(item.label).length) / 400,
    }))
    .sort((a, b) => Number(b.sameGroup) - Number(a.sameGroup) || b.score - a.score);
  const out: T[] = [];
  for (const { c } of scored) {
    if (out.length >= wrong) break;
    if (!out.some((o) => clash(o, c))) out.push(c);
  }
  return out;
}

/** Four options (the right one and three wrong), shuffled, and where the right one landed. */
export function pickOptions<T extends Pickable>(item: T, pool: readonly T[], rules: PickRules = {}): { options: T[]; answer: number } {
  const options = shuffled([item, ...pickConfusable(item, pool, rules)], rules.rand ?? Math.random);
  return { options, answer: options.indexOf(item) };
}
