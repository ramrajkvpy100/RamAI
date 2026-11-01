/**
 * How the patient can talk and behave right now: from their illness and their current numbers, not a script. The model is told
 * this when it writes their words, and code holds the hard limits: someone too drowsy to answer can't give a history.
 */
export interface MindFacts {
  diagnosis: string;
  age: number;
  gcs: number;
  pain: number;
  status: string;
}

/** A line for the model about how they speak now, if it isn't ordinary. */
export function stateOfMind(f: MindFacts): string | undefined {
  if (f.gcs <= 10) return "Too drowsy to give a history: a word or a moan at most.";
  if (f.gcs < 15 || /delirium|encephalopath|sepsis.*(?:elderly|confus)/i.test(f.diagnosis)) return "Confused: muddled about time, place and events, loses the thread, may give wrong or contradictory answers, and may pull at lines or try to get up.";
  if (/schizo|psychos|psychotic|paranoi/i.test(f.diagnosis)) return "Paranoid and guarded: suspicious of staff and treatment, may refuse tablets or injections, believes things that aren't so, and can turn hostile if pushed.";
  if (/\bmania\b|manic|bipolar/i.test(f.diagnosis)) return "Pressured and overfamiliar: talks fast, jumps between topics, little insight, irritable if crossed.";
  if (/depress|suicid/i.test(f.diagnosis)) return "Flat and slow: few words, long pauses, little hope; has to be asked directly about self-harm, and answers honestly if asked with care.";
  if (/alcohol withdrawal|delirium tremens|intoxicat/i.test(f.diagnosis)) return "Restless and tremulous: irritable, may be frightened by things that aren't there.";
  if (f.pain >= 8) return "In severe pain: short answers between breaths, hard to engage until it's treated, and may snap.";
  if (f.status === "critical") return "Very unwell: few words at a time.";
  return undefined;
}

/** Steps a reluctant patient may refuse: big, frightening, or keeping them in. */
export const BIG_STEPS = /^(?:measure:)?(?:admit|central-line|chest-tube|paracentesis|surgery|dialysis)$/;

/** A reason, in plain words: what's wrong, what it could do, why this is needed. */
const REASON = /\b(?:because|reason|risk|danger\w*|die|death|fatal|serious|could|otherwise|if (?:you|we) (?:don'?t|leave|go)|need(?:ed|s)?|likely|may|might|sorry|low|bleed\w*|infection|important|explain\w*|understand|safe|worse|zaruri|khatra|samjh\w*)\b/i;
/** An order with a reason in it, or a doctor plainly explaining at some length. */
export const givesReason = (words: string) => REASON.test(words) || words.trim().split(/\s+/).length >= 15;
