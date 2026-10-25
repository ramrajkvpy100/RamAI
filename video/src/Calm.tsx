import { AbsoluteFill, useCurrentFrame } from "remotion";

/** Quiet: warm morning light — soft blurred motes drifting slowly up and swaying. A seamless 12-second loop. */
export const CALM_FRAMES = 12 * 30;
const MOTES = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 37) % 100,
  size: 40 + ((i * 53) % 110),
  speed: 1 + (i % 3),
  phase: (i * 0.37) % 1,
  hue: i % 3 === 0 ? "255,214,165" : i % 3 === 1 ? "255,236,200" : "214,236,222",
}));

export const Calm = () => {
  const f = useCurrentFrame();
  const t = f / CALM_FRAMES; // 0..1, loops
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #f6efe4 0%, #f1e8da 55%, #eadfcd 100%)" }}>
      {MOTES.map((m, i) => {
        const p = (m.phase + t * m.speed) % 1; // rises, wraps
        const y = 110 - p * 125;
        const sway = Math.sin((t * m.speed + m.phase) * Math.PI * 2) * 3;
        const o = Math.sin(p * Math.PI) * 0.55;
        return (
          <div key={i} style={{ position: "absolute", left: `${m.x + sway}%`, top: `${y}%`, width: m.size, height: m.size, borderRadius: "50%", background: `radial-gradient(circle, rgba(${m.hue},0.9), rgba(${m.hue},0) 70%)`, opacity: o, filter: "blur(6px)" }} />
        );
      })}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(70% 45% at 30% 15%, rgba(255,226,180,0.45), transparent 70%)", opacity: 0.8 + 0.2 * Math.sin(t * Math.PI * 2) }} />
    </AbsoluteFill>
  );
};
