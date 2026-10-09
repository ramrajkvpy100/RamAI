import type { IconName } from "@/components/ui/icon";
import type { CareLevel, CaseTrack } from "@/engine/types";

/** Colour and glyph per care level — a calm ramp from green (first contact) to gold (global excellence). */
export const LEVEL_STYLE: Record<CareLevel, { from: string; to: string; press: string; icon: IconName }> = {
  phc: { from: "#34d399", to: "#059669", press: "#047857", icon: "home" },
  chc: { from: "#22d3ee", to: "#0891b2", press: "#0e7490", icon: "building" },
  district: { from: "#60a5fa", to: "#2563eb", press: "#1d4ed8", icon: "building" },
  college: { from: "#818cf8", to: "#4f46e5", press: "#4338ca", icon: "book" },
  apex: { from: "#c084fc", to: "#7c3aed", press: "#6d28d9", icon: "award" },
  grandrounds: { from: "#fbbf24", to: "#d97706", press: "#b45309", icon: "crown" },
};

export const levelGradient = (level: CareLevel) => `linear-gradient(150deg, ${LEVEL_STYLE[level].from}, ${LEVEL_STYLE[level].to})`;

export const TRACK_ICON: Record<CaseTrack, IconName> = { opd: "user", phone: "phone", emergency: "siren" };
