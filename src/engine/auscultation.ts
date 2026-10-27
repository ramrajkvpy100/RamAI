/**
 * Auscultation: just what the stethoscope picks up — the sound-related part of
 * a system's examination as it stands right now — and the acoustic parameters
 * the browser plays. Never a label, never a diagnosis.
 */
import type { Auscultation, BowelSounds, BreathSounds, HeartSounds } from "./types";

export type ListenPart = "heart" | "lungs" | "bowel";

/** The system examination each part of auscultation is taken from. */
export const LISTEN_SOURCE: Record<ListenPart, string> = { heart: "cvs", lungs: "rs", bowel: "abdomen" };

/** What a normal stethoscope finding sounds like, when the examination says nothing about sounds. */
export const NORMAL_SOUNDS: Record<ListenPart, string> = {
  heart: "S1 and S2 heard, normal. No murmurs, rubs or gallops.",
  lungs: "Bilateral equal air entry. Normal vesicular breath sounds. No added sounds.",
  bowel: "Bowel sounds present and normal.",
};

const TERMS: Record<ListenPart, RegExp> = {
  heart: /\b(S1|S2|S3|S4|heart sounds?|murmurs?|gallops?|rubs?|clicks?|opening snap|split|P2|A2|pansystolic|holosystolic|systolic|diastolic)\b/i,
  lungs: /\b(breath sounds?|air entry|crepitations?|crackles?|creps|wheez\w*|rhonchi|vesicular|bronchial|stridor|added sounds?|silent chest|pleural rub|(chest|lungs?) (is |are )?clear)\b/i,
  bowel: /\b(bowel sounds?|silent abdomen|borborygmi|bruits?)\b/i,
};

/** A finding's sentences, and the parts of a sentence separated by semicolons. */
const pieces = (text: string) =>
  text
    .split(/(?<=[.;])\s+/)
    .map((p) => p.trim().replace(/[.;]+$/, ""))
    .filter(Boolean);

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What hands and fingers find (percussion, palpation) sharing a sentence with a sound — not the stethoscope's to tell. */
const NOT_HEARD = /(?:,?\s*(?:and|with)\s+|,\s*)(?:stony\s+)?(?:dull(?:ness)?|hyper-?resonan(?:ce|t)|resonan(?:ce|t)|tender(?:ness)?|guarding|rigidity)(?:\s+(?:to|on)\s+percussion)?/gi;

/** What the stethoscope picks up, from a system's examination finding (or normal, if the examination says nothing about sounds). */
export function heardIn(systemFinding: string, part: ListenPart): string {
  const heard = pieces(systemFinding)
    .filter((p) => TERMS[part].test(p))
    .map((p) => p.replace(NOT_HEARD, "").replace(/\s{2,}/g, " ").trim());
  return heard.length ? `${heard.map(capitalise).join(". ")}.` : NORMAL_SOUNDS[part];
}

/** Said instead of what was heard: the player listens for themselves. */
export const LISTEN_LINE: Record<ListenPart, string> = {
  heart: "Heart sounds: listen with the stethoscope.",
  lungs: "Breath sounds: listen with the stethoscope.",
  bowel: "Bowel sounds: listen with the stethoscope.",
};

/** The system examination with what the stethoscope would pick up taken out — the player hears it instead. */
export function withoutSounds(systemFinding: string, part: ListenPart): string {
  const kept = pieces(systemFinding).filter((p) => !TERMS[part].test(p));
  return [...kept.map((p) => `${capitalise(p)}.`), LISTEN_LINE[part]].join(" ");
}

const ABNORMAL_SIGN =
  /\b(displaced|raised|elevated|heav\w*|thrill|irregular\w*|tender\w*|guarding|rigid\w*|distend\w*|dull\w*|hyper-?resonan\w*|deviat\w*|tachyp\w*|accessory|recession|cyanos\w*|clubb\w*|oedema|edema|mass|organomegaly|hepatomegaly|splenomegaly|ascites|shifting|rebound|weak|absent|bounding|collapsing|thready|cold|mottled|pale|palpable|scars?|out of proportion)\b/i;

/** Whether what's left after the sounds are taken out is itself abnormal — so its emphasis never hints at a sound. */
export function signsAbnormal(text: string): boolean {
  return pieces(text).some((p) => !/^(no|not)\b/i.test(p) && !p.endsWith("listen with the stethoscope") && ABNORMAL_SIGN.test(p.replace(/\bno\b[^]*$/i, "")));
}

/** Drops the negatives ("no murmurs, rubs or gallops") so only what is present is read. */
const present = (text: string) =>
  pieces(text)
    .map((p) => p.replace(/\bno\b[^]*$/i, ""))
    .join(". ");

export function heartSounds(heard: string, rate: number, irregular: boolean): HeartSounds {
  const t = present(heard);
  const phase = /diastolic/i.test(t) ? "diastolic" : /murmur|systolic/i.test(t) ? "systolic" : null;
  const shape = phase === "diastolic" ? (/mid-?diastolic|rumbl/i.test(t) ? "rumble" : "decrescendo") : /ejection/i.test(t) ? "diamond" : "plateau";
  return {
    kind: "heart",
    rate: Math.round(Math.min(220, Math.max(30, rate || 80))),
    ...(irregular ? { irregular: true } : {}),
    ...(/muffled|distant|faint|soft heart sounds|soft s1/i.test(t) ? { soft: true } : {}),
    ...(/\bS3\b/i.test(t) || (/gallop/i.test(t) && !/\bS4\b/i.test(t)) ? { s3: true } : {}),
    ...(/\bS4\b/i.test(t) ? { s4: true } : {}),
    ...(phase ? { murmur: { phase, shape } } : {}),
    ...(/\brubs?\b/i.test(t) ? { rub: true } : {}),
  } as HeartSounds;
}

export function breathSounds(heard: string, rate: number): BreathSounds {
  const t = present(heard);
  const breath: BreathSounds["breath"] = /absent|silent chest|not heard|inaudible/i.test(t)
    ? "absent"
    : /bronchial/i.test(t)
      ? "bronchial"
      : /reduced|diminished|decreased|poor air entry|quiet/i.test(t)
        ? "reduced"
        : "vesicular";
  const crackles = /crackl|crepit|creps/i.test(t) ? (/coarse/i.test(t) ? "coarse" : "fine") : null;
  return {
    kind: "lungs",
    rate: Math.round(Math.min(60, Math.max(6, rate || 16))),
    breath,
    ...(crackles ? { crackles } : {}),
    ...(/wheez|rhonch/i.test(t) ? { wheeze: true } : {}),
    ...(/stridor/i.test(t) ? { stridor: true } : {}),
    ...(/\brub\b/i.test(t) ? { rub: true } : {}),
  } as BreathSounds;
}

export function bowelSounds(heard: string, pulse: number): BowelSounds {
  const t = present(heard);
  const activity: BowelSounds["activity"] = /absent|silent/i.test(t) ? "absent" : /tinkling/i.test(t) ? "tinkling" : /sluggish|reduced|hypoactive|diminished/i.test(t) ? "sluggish" : /hyperactive|increased|exaggerated|loud/i.test(t) ? "hyperactive" : "normal";
  return { kind: "bowel", activity, rate: Math.round(Math.min(220, Math.max(30, pulse || 80))), ...(/bruit/i.test(t) ? { bruit: true } : {}) };
}

/** Anything a stethoscope would flag. */
export function soundsAbnormal(s: Auscultation): boolean {
  if (s.kind === "heart") return !!(s.irregular || s.soft || s.s3 || s.s4 || s.murmur || s.rub || s.click || s.snap);
  if (s.kind === "lungs") return s.breath !== "vesicular" || !!(s.crackles || s.wheeze || s.stridor || s.rub);
  if (s.kind === "vessel") return s.sound !== "normal";
  return s.activity !== "normal" || !!s.bruit;
}

export interface Listened {
  part: ListenPart;
  text: string;
  sound: Auscultation;
  abnormal: boolean;
}

/** One part of auscultation, from the system examination as it stands and the patient's own rates. */
export function listen(part: ListenPart, systemFinding: string, body: { hr: number; rr: number; irregular: boolean }): Listened {
  const text = heardIn(systemFinding, part);
  const sound = part === "heart" ? heartSounds(text, body.hr, body.irregular) : part === "lungs" ? breathSounds(text, body.rr) : bowelSounds(text, body.hr);
  return { part, text, sound, abnormal: soundsAbnormal(sound) };
}
