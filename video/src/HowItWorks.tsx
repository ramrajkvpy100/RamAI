import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** "How RamAI works" in 12 seconds: four steps, one after another, then the promise. */
const STEPS = [
  { emoji: "🗣️", title: "Talk to the patient", line: "Ask anything — history in your own words" },
  { emoji: "🩺", title: "Examine & order tests", line: "Vitals, examination, labs and scans" },
  { emoji: "💊", title: "Diagnose & treat", line: "Drugs, doses and fluids — the patient responds" },
  { emoji: "📊", title: "See what you missed", line: "Scored out of 100, with the ideal approach" },
];
const EACH = 75;
export const HOW_FRAMES = STEPS.length * EACH + 60;
const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

function Step({ i }: { i: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = STEPS[i]!;
  const pop = spring({ frame: f, fps, config: { damping: 13 } });
  const out = interpolate(f, [EACH - 12, EACH], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: out, fontFamily: FONT }}>
      <div style={{ fontSize: 170, transform: `scale(${pop}) translateY(${(1 - pop) * 40}px)` }}>{s.emoji}</div>
      <div style={{ marginTop: 30, color: "white", fontSize: 62, fontWeight: 800, letterSpacing: -1.5, opacity: interpolate(f, [6, 18], [0, 1], { extrapolateRight: "clamp" }) }}>{s.title}</div>
      <div style={{ marginTop: 16, color: "rgba(255,255,255,0.85)", fontSize: 34, textAlign: "center", maxWidth: 820, opacity: interpolate(f, [14, 28], [0, 1], { extrapolateRight: "clamp" }) }}>{s.line}</div>
    </AbsoluteFill>
  );
}

function Dots() {
  const f = useCurrentFrame();
  const at = Math.min(STEPS.length - 1, Math.floor(f / EACH));
  return (
    <div style={{ position: "absolute", bottom: 70, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18 }}>
      {STEPS.map((_, i) => <div key={i} style={{ width: i === at ? 56 : 18, height: 18, borderRadius: 9, background: i <= at ? "white" : "rgba(255,255,255,0.35)" }} />)}
    </div>
  );
}

function End() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT, textAlign: "center" }}>
      <div style={{ color: "white", fontSize: 76, fontWeight: 800, lineHeight: 1.08, letterSpacing: -2, transform: `scale(${0.85 + 0.15 * pop})` }}>Think like a doctor,<br />every day.</div>
    </AbsoluteFill>
  );
}

export const HowItWorks = () => (
  <AbsoluteFill style={{ background: "linear-gradient(150deg, #4338ca 0%, #2563eb 50%, #06b6d4 100%)" }}>
    {STEPS.map((_, i) => <Sequence key={i} from={i * EACH} durationInFrames={EACH}><Step i={i} /></Sequence>)}
    <Sequence durationInFrames={STEPS.length * EACH}><Dots /></Sequence>
    <Sequence from={STEPS.length * EACH}><End /></Sequence>
  </AbsoluteFill>
);
