/**
 * A doctor's avatar. Today they choose a medical persona (or their Google photo); doctors who made a cartoon before keep it, drawn
 * from the same stored style, until they choose something else. The cartoon's pieces stay in the stored JSON either way.
 */
export interface AvatarStyle {
  skin: number;
  hair: (typeof HAIR)[number];
  hairColor: number;
  eyes: (typeof EYES)[number];
  mouth: (typeof MOUTH)[number];
  extra: (typeof EXTRA)[number];
  bg: number;
  /** The outfit (0–9, one per rank); -1 = the newest for their rank. Only old cartoons have one chosen. */
  outfit?: number;
  /** What they chose to be shown as: a persona's id, or PHOTO. Absent: their old cartoon. */
  persona?: PersonaId | typeof PHOTO;
  /** Their Google picture, when persona is PHOTO. */
  photo?: string;
  /** The cartoon pieces are only defaults: this doctor never made one, so there's none to go back to. */
  auto?: boolean;
}

const OUTFIT_COUNT = 10;
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

/** The personas to choose from. Their drawings load separately (components/game/avatar-personas.tsx); the tint holds the place until then. */
export const PERSONAS = [
  { id: "er-resus", name: "ER Resuscitationist", tint: "#e11d48" },
  { id: "interventional-cardiologist", name: "Interventional Cardiologist", tint: "#be123c" },
  { id: "neuro-intensivist", name: "Neuro-Intensivist", tint: "#6d28d9" },
  { id: "trauma-surgeon", name: "Trauma Surgeon", tint: "#0f766e" },
  { id: "pediatric-healer", name: "Pediatric Healer", tint: "#f97316" },
  { id: "clinical-detective", name: "Clinical Detective", tint: "#475569" },
  { id: "toxicology-specialist", name: "Toxicology Specialist", tint: "#059669" },
  { id: "maternal-fetal-guardian", name: "Maternal-Fetal Guardian", tint: "#db2777" },
  { id: "icu-night-owl", name: "ICU Night Owl", tint: "#312e81" },
  { id: "radiology-ace", name: "Radiology Ace", tint: "#0e7490" },
  { id: "infectious-disease-hunter", name: "Infectious Disease Hunter", tint: "#15803d" },
  { id: "master-clinician", name: "Master Clinician", tint: "#d97706" },
  { id: "airway-guardian", name: "Airway Guardian", tint: "#1d4ed8" },
  { id: "rural-frontliner", name: "Rural Frontliner", tint: "#65a30d" },
  { id: "bone-setter", name: "Bone Setter", tint: "#475569" },
  { id: "mind-listener", name: "Mind Listener", tint: "#7e22ce" },
] as const;
export type PersonaId = (typeof PERSONAS)[number]["id"];
/** The persona value meaning "my Google photo". */
export const PHOTO = "photo";
const PERSONA_IDS = new Set<string>(PERSONAS.map((p) => p.id));
export const isPersona = (x: unknown): x is PersonaId => typeof x === "string" && PERSONA_IDS.has(x);

const PHOTO_ROOT = "https://lh3.googleusercontent.com/";
/** A Google profile picture's address, or nothing: this one host only (it's all the page's security policy lets in). */
export const cleanPhoto = (x: unknown): string | undefined => (typeof x === "string" && x.length <= 500 && x.startsWith(PHOTO_ROOT) && !/[\s"'<>()\\]/.test(x) ? x : undefined);

/** All that other doctors need to see of someone's avatar (leaderboards, near me). */
export interface PublicAvatar {
  persona: string;
  photo?: string;
}
export function publicAvatar(a: AvatarStyle | null | undefined): PublicAvatar | null {
  if (!a?.persona) return null;
  return a.persona === PHOTO ? (a.photo ? { persona: PHOTO, photo: a.photo } : null) : { persona: a.persona };
}

export const DEFAULT_AVATAR: AvatarStyle = { skin: 2, hair: "short", hairColor: 0, eyes: "round", mouth: "smile", extra: "stethoscope", bg: 0 };

const inRange = (n: unknown, max: number) => (typeof n === "number" && Number.isInteger(n) && n >= 0 && n < max ? n : 0);
const oneOf = <T extends string>(x: unknown, xs: readonly T[], d: T): T => (xs.includes(x as T) ? (x as T) : d);

/** A stored avatar, checked piece by piece (anything unknown falls back to the default). Rows from before personas read as the cartoon they are. */
export function parseAvatar(raw: unknown): AvatarStyle | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const photo = r.persona === PHOTO ? cleanPhoto(r.photo) : undefined;
  return {
    skin: inRange(r.skin, SKIN.length),
    hair: oneOf(r.hair, HAIR, DEFAULT_AVATAR.hair),
    hairColor: inRange(r.hairColor, HAIR_COLORS.length),
    eyes: oneOf(r.eyes, EYES, DEFAULT_AVATAR.eyes),
    mouth: oneOf(r.mouth, MOUTH, DEFAULT_AVATAR.mouth),
    extra: oneOf(r.extra, EXTRA, DEFAULT_AVATAR.extra),
    bg: inRange(r.bg, BGS.length),
    outfit: typeof r.outfit === "number" && Number.isInteger(r.outfit) && r.outfit >= -1 && r.outfit < OUTFIT_COUNT ? r.outfit : -1,
    ...(photo ? { persona: PHOTO, photo } : isPersona(r.persona) ? { persona: r.persona } : {}),
    ...(r.auto === true ? { auto: true } : {}),
  };
}
