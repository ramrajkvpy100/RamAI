/** A doctor's own cartoon avatar — chosen piece by piece on the profile page, drawn as SVG everywhere. */
export interface AvatarStyle {
  skin: number;
  hair: (typeof HAIR)[number];
  hairColor: number;
  eyes: (typeof EYES)[number];
  mouth: (typeof MOUTH)[number];
  extra: (typeof EXTRA)[number];
  bg: number;
  /** The outfit (0–9, one per rank, each unlocked by reaching it); -1 = always the newest unlocked. */
  outfit?: number;
}

/** One outfit per rank — the same clothes as the rank pictures; reaching the rank unlocks it. */
export const OUTFITS = [
  "Student — blue shirt & ID card",
  "Intern — short white coat",
  "Junior Resident — teal scrubs",
  "Senior Resident — coat over navy scrubs",
  "Assistant Professor — coat, shirt & tie",
  "Associate Professor — long coat, tie & badge",
  "Professor — coat with pens",
  "Head of Department — suit under the coat",
  "Dean — navy blazer & tie",
  "Master Clinician — gold-trimmed coat",
] as const;
/** The outfit shown: the one chosen, if unlocked; otherwise the newest unlocked for this rank (1–10). */
export const outfitFor = (a: AvatarStyle, tier: number) => {
  const unlocked = Math.max(1, Math.min(10, tier)) - 1;
  return a.outfit !== undefined && a.outfit >= 0 && a.outfit <= unlocked ? a.outfit : unlocked;
};

export const SKIN = ["#f9d7c3", "#efbf9c", "#d9a07a", "#b97c55", "#8d5a3b", "#5e3b26"];
export const HAIR_COLORS = ["#1f1a17", "#4a2f1d", "#8a5a2b", "#d8a657", "#b4b4b4", "#7c3aed"];
export const BGS = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#e11d48", "#f59e0b"];
export const HAIR = ["short", "side", "long", "bun", "curly", "bald", "hijab"] as const;
export const EYES = ["round", "happy", "wink", "sleepy"] as const;
export const MOUTH = ["smile", "grin", "calm", "open"] as const;
export const EXTRA = ["none", "glasses", "stethoscope", "cap", "mask", "headlight", "penlight", "hammer", "mirror", "clipboard", "loupe", "goldscope", "laurel"] as const;
export type Extra = (typeof EXTRA)[number];

/**
 * The doctor's bag: items you collect by playing — cases finished, days in a row — and wear on your avatar.
 * In the order they're collected.
 */
export const ITEMS: { id: Extra; name: string; emoji: string; need: { cases?: number; streak?: number }; line: string }[] = [
  { id: "stethoscope", name: "Stethoscope", emoji: "🩺", need: {}, line: "Every doctor's first." },
  { id: "glasses", name: "Glasses", emoji: "👓", need: {}, line: "For the fine print on the chart." },
  { id: "mask", name: "Mask", emoji: "😷", need: { cases: 1 }, line: "Finish your first case." },
  { id: "penlight", name: "Pen torch", emoji: "🔦", need: { cases: 3 }, line: "Pupils, throats, a pocket hero." },
  { id: "cap", name: "Surgical cap", emoji: "🧢", need: { cases: 5 }, line: "Ready for theatre." },
  { id: "headlight", name: "Head light", emoji: "💡", need: { streak: 3 }, line: "Three days in a row." },
  { id: "hammer", name: "Reflex hammer", emoji: "🔨", need: { cases: 10 }, line: "Tap, tap — knee jerk." },
  { id: "clipboard", name: "Clipboard", emoji: "📋", need: { streak: 7 }, line: "A week on call." },
  { id: "mirror", name: "Head mirror", emoji: "🪞", need: { cases: 25 }, line: "The ENT classic." },
  { id: "loupe", name: "Surgical loupes", emoji: "🔬", need: { cases: 50 }, line: "Nothing escapes you now." },
  { id: "laurel", name: "Golden laurel", emoji: "🌿", need: { streak: 30 }, line: "A month without a miss." },
  { id: "goldscope", name: "Golden stethoscope", emoji: "🏆", need: { cases: 100 }, line: "A hundred patients seen." },
];
const ITEM = new Map(ITEMS.map((i) => [i.id, i]));
/** Whether this item is collected, from cases finished and the best streak. "none" is always there. */
export function itemUnlocked(id: Extra, p: { casesCompleted: number; bestStreak: number; streakDays?: number }): boolean {
  if (id === "none") return true;
  const it = ITEM.get(id);
  if (!it) return false;
  return (it.need.cases ?? 0) <= p.casesCompleted && (it.need.streak ?? 0) <= Math.max(p.bestStreak, p.streakDays ?? 0);
}
export const itemNeed = (id: Extra) => {
  const n = ITEM.get(id)?.need ?? {};
  return n.cases ? `${n.cases} ${n.cases === 1 ? "case" : "cases"}` : n.streak ? `${n.streak}-day streak` : "";
};
/** How far to the item: 0–1. */
export function itemProgress(id: Extra, p: { casesCompleted: number; bestStreak: number; streakDays?: number }): number {
  const n = ITEM.get(id)?.need ?? {};
  if (n.cases) return Math.min(1, p.casesCompleted / n.cases);
  if (n.streak) return Math.min(1, Math.max(p.bestStreak, p.streakDays ?? 0) / n.streak);
  return 1;
}

export const DEFAULT_AVATAR: AvatarStyle = { skin: 2, hair: "short", hairColor: 0, eyes: "round", mouth: "smile", extra: "stethoscope", bg: 0 };

const inRange = (n: unknown, max: number) => (typeof n === "number" && Number.isInteger(n) && n >= 0 && n < max ? n : 0);
const oneOf = <T extends string>(x: unknown, xs: readonly T[], d: T): T => (xs.includes(x as T) ? (x as T) : d);

/** A stored avatar, checked piece by piece (anything unknown falls back to the default). */
export function parseAvatar(raw: unknown): AvatarStyle | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    skin: inRange(r.skin, SKIN.length),
    hair: oneOf(r.hair, HAIR, DEFAULT_AVATAR.hair),
    hairColor: inRange(r.hairColor, HAIR_COLORS.length),
    eyes: oneOf(r.eyes, EYES, DEFAULT_AVATAR.eyes),
    mouth: oneOf(r.mouth, MOUTH, DEFAULT_AVATAR.mouth),
    extra: oneOf(r.extra, EXTRA, DEFAULT_AVATAR.extra),
    bg: inRange(r.bg, BGS.length),
    outfit: typeof r.outfit === "number" && Number.isInteger(r.outfit) && r.outfit >= -1 && r.outfit < OUTFITS.length ? r.outfit : -1,
  };
}
