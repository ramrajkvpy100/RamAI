import { notFound } from "next/navigation";

import { AvatarFace } from "@/components/game/avatar-face";
import { DEFAULT_AVATAR, HAIR } from "@/lib/avatar-style";

/** Development only: every hair style, side by side. */
export default function AvatarSheet() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: 16, background: "#fff" }}>
      {HAIR.map((hair) => (
        <AvatarFace key={hair} style={{ ...DEFAULT_AVATAR, hair, extra: "none" }} size={110} />
      ))}
    </div>
  );
}
