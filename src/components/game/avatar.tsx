import { avatarOf } from "@/lib/avatar";
import type { AvatarStyle } from "@/lib/avatar-style";

import { AvatarFace } from "./avatar-face";
import { PersonaAvatar } from "./specialist-avatar";
import { cn } from "@/lib/cn";

/** A doctor's avatar: the persona or photo they chose, else the cartoon they made, else their initials. */
export function Avatar({ name, size = 32, className, style }: { name: string; size?: number; className?: string; /** Their stored avatar, if any. */ style?: AvatarStyle | null }) {
  const { initials, color } = avatarOf(name);
  const plain = (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #0b1220))` }}
    >
      {initials}
    </span>
  );
  if (style?.persona) return <PersonaAvatar persona={style.persona} photo={style.photo} size={size} className={className} fallback={plain} />;
  if (style) return <AvatarFace style={style} size={size} className={cn("shrink-0 rounded-full", className)} />;
  return plain;
}
