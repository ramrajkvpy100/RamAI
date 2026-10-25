import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/** RamAI's 30-second store video: a title, the six store screens, and a call to play. */
const SCREENS = [1, 2, 3, 4, 5, 6];
const INTRO = 75;
const EACH = 105;
const OUTRO = 90;
export const PROMO_FRAMES = INTRO + SCREENS.length * EACH + OUTRO;

const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";
const BG = "linear-gradient(160deg, #4338ca 0%, #3b5bdb 45%, #0ea5e9 100%)";

function Intro() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 14 } });
  const fade = interpolate(f, [INTRO - 12, INTRO], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ background: BG, alignItems: "center", justifyContent: "center", opacity: fade, fontFamily: FONT }}>
      <Img src={staticFile("icon.png")} style={{ width: 260, height: 260, borderRadius: 60, transform: `scale(${pop})`, boxShadow: "0 30px 80px rgba(0,0,0,0.35)" }} />
      <div style={{ marginTop: 60, color: "white", fontSize: 120, fontWeight: 800, letterSpacing: -3, opacity: interpolate(f, [10, 30], [0, 1], { extrapolateRight: "clamp" }) }}>RamAI</div>
      <div style={{ marginTop: 20, color: "rgba(255,255,255,0.9)", fontSize: 52, fontWeight: 500, opacity: interpolate(f, [22, 42], [0, 1], { extrapolateRight: "clamp" }) }}>The clinical case simulator</div>
    </AbsoluteFill>
  );
}

function Screen({ n }: { n: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 18, stiffness: 90 } });
  const x = interpolate(enter, [0, 1], [1080, 0]);
  const out = interpolate(f, [EACH - 14, EACH], [0, -1080], { extrapolateLeft: "clamp", easing: Easing.in(Easing.cubic) });
  const zoom = interpolate(f, [0, EACH], [1, 1.06]);
  return (
    <AbsoluteFill style={{ transform: `translateX(${x + out}px)` }}>
      <Img src={staticFile(`${n}.png`)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} />
    </AbsoluteFill>
  );
}

function Outro() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ background: BG, alignItems: "center", justifyContent: "center", fontFamily: FONT, textAlign: "center", padding: 80 }}>
      <div style={{ color: "white", fontSize: 96, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, transform: `scale(${0.8 + 0.2 * pop})` }}>Think like a doctor,<br />every day.</div>
      <div style={{ marginTop: 50, color: "rgba(255,255,255,0.92)", fontSize: 46 }}>5 free cases a day · Skills Lab · Exam MCQs</div>
      <div style={{ marginTop: 80, background: "white", color: "#3b3fd8", fontSize: 54, fontWeight: 800, padding: "30px 70px", borderRadius: 999, opacity: interpolate(f, [15, 30], [0, 1], { extrapolateRight: "clamp" }) }}>Play your first case</div>
    </AbsoluteFill>
  );
}

export const Promo = () => (
  <AbsoluteFill style={{ background: "#3b5bdb" }}>
    <Sequence durationInFrames={INTRO}><Intro /></Sequence>
    {SCREENS.map((n, i) => (
      <Sequence key={n} from={INTRO + i * EACH} durationInFrames={EACH}><Screen n={n} /></Sequence>
    ))}
    <Sequence from={INTRO + SCREENS.length * EACH} durationInFrames={OUTRO}><Outro /></Sequence>
  </AbsoluteFill>
);
