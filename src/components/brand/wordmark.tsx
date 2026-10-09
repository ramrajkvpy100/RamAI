import { cn } from "@/lib/cn";

/** A single PQRST complex — the brand's only medical motif. */
export function PulseMark({ className, strokeWidth = 1.7 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 30 14" fill="none" aria-hidden className={className}>
      <path d="M1 8h7l1.6-3.2L12.4 13 15.6 1.5l2.6 9.2 1.6-2.7H29" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The app tile: gradient square with the pulse. */
export function LogoTile({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden text-white shadow-[0_6px_18px_-6px_rgb(37_99_235/0.7)]", className)}
      style={{ width: size, height: size, borderRadius: size * 0.3, background: "var(--grad-ai)" }}
    >
      <span className="absolute inset-0 bg-[radial-gradient(120%_70%_at_30%_0%,rgb(255_255_255/0.45),transparent_55%)]" />
      <PulseMark className="relative w-[64%]" strokeWidth={2.2} />
    </span>
  );
}

export function Wordmark({ size = "sm", className, tile = true }: { size?: "sm" | "md" | "lg"; className?: string; tile?: boolean }) {
  const text = size === "lg" ? "text-[26px]" : size === "md" ? "text-[19px]" : "text-[16.5px]";
  const tileSize = size === "lg" ? 36 : size === "md" ? 30 : 26;
  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label="RamAI">
      {tile && <LogoTile size={tileSize} />}
      <span aria-hidden className={cn("font-semibold tracking-[-0.025em]", text)}>
        Ram<span className="text-gradient">AI</span>
      </span>
    </span>
  );
}
