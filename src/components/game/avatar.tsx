import { avatarOf } from "@/lib/avatar";
import { cn } from "@/lib/cn";

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
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
