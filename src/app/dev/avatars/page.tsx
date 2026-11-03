import { notFound } from "next/navigation";

import { AvatarFace } from "@/components/game/avatar-face";
import { DEFAULT_AVATAR, HAIR } from "@/lib/avatar-style";

import { PersonaSheet } from "./persona-sheet";

/** Development only: the personas and the picker, then every old cartoon hair style, side by side. */
export default function AvatarSheet() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div>
      <PersonaSheet />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: 16 }}>
        {HAIR.map((hair) => (
          <AvatarFace key={hair} style={{ ...DEFAULT_AVATAR, hair, extra: "none" }} size={110} />
        ))}
      </div>
    </div>
  );
}
