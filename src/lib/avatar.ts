/** A doctor's avatar: their initials on their own colour — the same everywhere, on the site and on their share cards. */
const PALETTE = ["#2563eb", "#7c3aed", "#0891b2", "#db2777", "#ea580c", "#059669", "#4f46e5", "#0d9488"];

export interface AvatarLook {
  initials: string;
  color: string;
  /** The avatar they made, drawn (an SVG data URI) — for share cards. */
  face?: string;
}

export function avatarOf(name: string): AvatarLook {
  const clean = name.replace(/^dr\.?\s+/i, "");
  const initials = clean.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { initials, color: PALETTE[h % PALETTE.length]! };
}
