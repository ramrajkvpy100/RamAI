import { cn } from "@/lib/cn";

const PALETTE = ["#2563eb", "#7c3aed", "#0891b2", "#db2777", "#ea580c", "#059669", "#4f46e5", "#0d9488"];

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const clean = name.replace(/^dr\.?\s+/i, "");
  const initials = clean.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const color = PALETTE[h % PALETTE.length];
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
