import type { Drink } from "@/lib/focus";

export const DRINKS: Record<Drink, { label: string }> = {
  chai: { label: "masala chai" },
  americano: { label: "americano" },
  matcha: { label: "iced matcha" },
  cappuccino: { label: "cappuccino" },
  latte: { label: "latte" },
  "black-tea": { label: "black tea" },
};

/** Your drink, from above — with a soft ring around it that fills as the focus goes on. */
export function Cup({ drink, left = 1, size = 140, steam = false }: { drink: Drink; left?: number; size?: number; steam?: boolean }) {
  const done = Math.max(0, Math.min(1, 1 - left));
  const r = 47;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {left < 1 && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="2" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeDasharray={`${done * c} ${c}`} className="text-emerald-600 transition-[stroke-dasharray] duration-1000 ease-linear dark:text-emerald-300" />
        </svg>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/focus/${drink}.png`} alt={DRINKS[drink].label} draggable={false} className={`${left < 1 ? "h-[84%] w-[84%]" : "h-full w-full"} object-contain drop-shadow-[0_12px_18px_rgba(60,40,20,0.22)] ${steam ? "focus-float" : ""}`} />
    </span>
  );
}
