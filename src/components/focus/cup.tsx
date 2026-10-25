import type { Drink } from "@/lib/focus";

/** Each drink, seen from above: cup colour, what's in it, and its foam. */
export const DRINKS: Record<Drink, { label: string; cup: string; liquid: string; foam?: string; glass?: boolean; saucer?: string }> = {
  chai: { label: "masala chai", cup: "#c8b49a", liquid: "#b07a4a", foam: "#d9b58c", saucer: "#efe7dc" },
  americano: { label: "americano", cup: "#d9534f", liquid: "#3a2416", saucer: "#b8434a" },
  matcha: { label: "matcha", cup: "#e9efe6", liquid: "#6b9b3a", foam: "#a9c97c", glass: true },
  cappuccino: { label: "cappuccino", cup: "#2f4a5a", liquid: "#6b4024", foam: "#f1dcc0", saucer: "#9fb6c7" },
  latte: { label: "latte", cup: "#d7c08a", liquid: "#8a5a35", foam: "#f4e3c6", saucer: "#efece6" },
  "black-tea": { label: "black tea", cup: "#f4f4f2", liquid: "#5a2a1a", saucer: "#dfe6ec" },
};

/** A cup seen from above, halftone-printed; `left` (0–1) is how much is still in it — it empties as you focus. */
export function Cup({ drink, left = 1, size = 140, steam = false }: { drink: Drink; left?: number; size?: number; steam?: boolean }) {
  const d = DRINKS[drink];
  const id = `ht-${drink}`;
  const fill = Math.max(0.08, Math.min(1, left));
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={d.label}>
      <defs>
        <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="2.5" cy="2.5" r="1.1" fill="#000" opacity="0.16" />
        </pattern>
      </defs>
      {d.saucer && <ellipse cx="100" cy="108" rx="88" ry="84" fill={d.saucer} />}
      {d.saucer && <ellipse cx="100" cy="108" rx="88" ry="84" fill={`url(#${id})`} />}
      {/* handle */}
      {!d.glass && <rect x="150" y="118" width="22" height="58" rx="11" transform="rotate(-28 160 140)" fill={d.cup} stroke="#00000022" strokeWidth="2" />}
      <circle cx="100" cy="100" r="62" fill={d.cup} stroke="#00000026" strokeWidth="3" opacity={d.glass ? 0.85 : 1} />
      <circle cx="100" cy="100" r="62" fill={`url(#${id})`} />
      {/* what's left in the cup */}
      <circle cx="100" cy="100" r={52 * Math.sqrt(fill)} fill={d.liquid} style={{ transition: "r 1s linear" }} />
      {d.foam && fill > 0.25 && <path d={`M${100 - 22 * fill} 98 q${22 * fill} ${-26 * fill} ${44 * fill} 0 q${-22 * fill} ${30 * fill} ${-44 * fill} 0z`} fill={d.foam} opacity="0.9" />}
      <circle cx="100" cy="100" r={52 * Math.sqrt(fill)} fill={`url(#${id})`} />
      {drink === "matcha" && fill > 0.3 && [0, 1, 2].map((i) => <rect key={i} x={82 + i * 14} y={86 + (i % 2) * 14} width="12" height="12" rx="2" fill="#ffffffb0" transform={`rotate(${i * 25} 100 100)`} />)}
      {steam && (
        <g className="focus-steam" stroke="#9a8f86" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5">
          <path d="M86 36 q-8 -10 0 -20 q8 -10 0 -20" />
          <path d="M106 32 q-8 -10 0 -20 q8 -10 0 -20" />
        </g>
      )}
    </svg>
  );
}
