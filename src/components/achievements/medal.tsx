/**
 * Each achievement's medal: a faceted gem in its own colours, a ribbon and a symbol for what it was earned for.
 * Locked medals keep their colours, faded, with a small lock — so you can see what you're playing for.
 */
const MEDALS: Record<string, { glyph: string; from: string; to: string; ribbon: string }> = {
  "first-case": { glyph: "🩺", from: "#34d399", to: "#059669", ribbon: "#10b981" },
  "ten-cases": { glyph: "🔟", from: "#60a5fa", to: "#2563eb", ribbon: "#3b82f6" },
  "fifty-cases": { glyph: "🏥", from: "#a78bfa", to: "#6d28d9", ribbon: "#8b5cf6" },
  "streak-7": { glyph: "🔥", from: "#fdba74", to: "#ea580c", ribbon: "#f97316" },
  "streak-30": { glyph: "🌙", from: "#fca5a5", to: "#b91c1c", ribbon: "#ef4444" },
  rescuer: { glyph: "🚑", from: "#f9a8d4", to: "#db2777", ribbon: "#ec4899" },
  sharp: { glyph: "🎯", from: "#fde047", to: "#ca8a04", ribbon: "#eab308" },
  phone: { glyph: "📞", from: "#67e8f9", to: "#0e7490", ribbon: "#06b6d4" },
  "grand-rounds": { glyph: "🌍", from: "#5eead4", to: "#0f766e", ribbon: "#14b8a6" },
  "full-circuit": { glyph: "🧭", from: "#c4b5fd", to: "#4338ca", ribbon: "#6366f1" },
};

export function Medal({ id, size = 72, locked = false }: { id: string; size?: number; locked?: boolean }) {
  const m = MEDALS[id] ?? { glyph: "🏅", from: "#fcd34d", to: "#d97706", ribbon: "#f59e0b" };
  const { from, to, ribbon } = m;
  const g = `m-${id}-${locked ? "l" : "u"}`;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className={locked ? "" : "drop-shadow-[0_6px_10px_rgba(0,0,0,0.25)]"} style={locked ? { filter: "saturate(0.5) opacity(0.5)" } : undefined}>
        <defs>
          <linearGradient id={`${g}-a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient>
          <linearGradient id={`${g}-b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity="0.55" /><stop offset="0.5" stopColor="#ffffff" stopOpacity="0" /></linearGradient>
        </defs>
        {/* Ribbon tails */}
        <path d="M33 66 L24 96 L36 90 L42 99 L48 70 Z" fill={ribbon} opacity="0.9" />
        <path d="M67 66 L76 96 L64 90 L58 99 L52 70 Z" fill={ribbon} opacity="0.75" />
        {/* The faceted gem */}
        <path d="M50 4 L86 24 L86 60 L50 80 L14 60 L14 24 Z" fill={`url(#${g}-a)`} />
        <path d="M50 4 L86 24 L50 42 L14 24 Z" fill={`url(#${g}-b)`} />
        <path d="M50 4 L86 24 L86 60 L50 80 L14 60 L14 24 Z" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2.5" />
        <circle cx="50" cy="42" r="22" fill="#ffffff" fillOpacity="0.92" />
      </svg>
      <span className="absolute" style={{ top: size * 0.27, fontSize: size * 0.3, lineHeight: 1, filter: locked ? "grayscale(0.6) opacity(0.6)" : undefined }} aria-hidden>
        {m.glyph}
      </span>
      {locked && (
        <span className="absolute flex items-center justify-center rounded-full bg-fg/80 shadow" style={{ right: size * 0.06, bottom: size * 0.16, width: size * 0.32, height: size * 0.32, fontSize: size * 0.17 }} aria-hidden>
          🔒
        </span>
      )}
    </span>
  );
}
