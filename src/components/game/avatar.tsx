import { avatarOf } from "@/lib/avatar";
import type { AvatarStyle } from "@/lib/avatar-style";

import { AvatarFace } from "./avatar-face";
import { cn } from "@/lib/cn";

export function Avatar({ name, size = 32, className, style }: { name: string; size?: number; className?: string; /** Their own made avatar, if any. */ style?: AvatarStyle | null }) {
  if (style) return <AvatarFace style={style} size={size} className={cn("shrink-0 rounded-full", className)} />;
  const { initials, color } = avatarOf(name);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #0b1220))` }}
    >
      {initials}
    </span>
  );
}
