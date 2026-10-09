import { RANKS } from "@/engine/progression";
import { cn } from "@/lib/cn";

/** Colour family per tier: slate → bronze → silver → gold → sapphire → violet → crimson. */
const TIER_COLORS: [string, string][] = [
  ["#94a3b8", "#64748b"],
  ["#d6a473", "#a26a3a"],
  ["#cfd8e3", "#8a99ad"],
  ["#7dd3fc", "#0284c7"],
  ["#93c5fd", "#2563eb"],
  ["#c4b5fd", "#7c3aed"],
  ["#fde68a", "#d97706"],
  ["#fca5a5", "#dc2626"],
  ["#f0abfc", "#a21caf"],
  ["#a5f3fc", "#7c3aed"],
];

/** Hexagonal insignia for the medical ranks. */
export function RankBadge({ tier, size = 28, className, title }: { tier: number; size?: number; className?: string; title?: string }) {
  const [a, b] = TIER_COLORS[Math.max(0, Math.min(9, tier - 1))]!;
  const id = `rb-${tier}`;
  const label = title ?? RANKS[tier - 1]?.label;
  return (
    <svg viewBox="0 0 40 44" width={size} height={size * 1.1} className={cn("shrink-0 drop-shadow-[0_4px_8px_rgb(0_0_0/0.18)]", className)} role="img" aria-label={label}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <path d="M20 1.5 37 11v22L20 42.5 3 33V11Z" fill={`url(#${id})`} />
      <path d="M20 1.5 37 11v22L20 42.5 3 33V11Z" fill="none" stroke="rgb(255 255 255 / 0.55)" strokeWidth="1.2" />
      <path d="M20 6 32.5 13v18L20 38 7.5 31V13Z" fill="rgb(255 255 255 / 0.14)" />
      {tier >= 10 ? (
        <path d="m20 12 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7Z" fill="#fff" />
      ) : (
        <text x="20" y="27.5" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="var(--font-sans)">
          {tier}
        </text>
      )}
    </svg>
  );
}
