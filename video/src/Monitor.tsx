import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/** A bedside monitor: a green ECG trace sweeping, the heart beating — a seamless 2-second loop (60/min). */
export const MONITOR_FRAMES = 60;

// One beat of an ECG, as y offsets over 0..1 (P, QRS, T).
function ecg(t: number) {
  const g = (c: number, w: number, h: number) => h * Math.exp(-((t - c) ** 2) / (2 * w * w));
  return g(0.18, 0.025, -0.12) + g(0.3, 0.008, 0.25) + g(0.32, 0.01, -1) + g(0.345, 0.01, 0.35) + g(0.55, 0.045, -0.22);
}

export const Monitor = () => {
  const f = useCurrentFrame();
  const W = 480, H = 480, top = 170, amp = 120;
  const sweep = (f / MONITOR_FRAMES) * W;
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 2) {
    const t = ((x / W) * 2) % 1;
    pts.push(`${x},${top + 70 + ecg(t) * amp}`);
  }
  const beat = (f % 30) / 30;
  const pulse = interpolate(beat, [0.3, 0.36, 0.6, 1], [1, 1.12, 1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "radial-gradient(80% 70% at 50% 40%, #0f2a2a 0%, #071415 70%)", fontFamily: "Inter, Arial, sans-serif" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="fade" x1="0" x2="1">
            <stop offset="0" stopColor="#34f5a0" stopOpacity="0.15" />
            <stop offset="1" stopColor="#34f5a0" stopOpacity="1" />
          </linearGradient>
          <clipPath id="drawn"><rect x={0} y={0} width={sweep} height={H} /></clipPath>
          <filter id="glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {[...Array(9)].map((_, i) => <line key={`h${i}`} x1={0} x2={W} y1={i * 60} y2={i * 60} stroke="#1d3b3a" strokeWidth={1} />)}
        {[...Array(9)].map((_, i) => <line key={`v${i}`} y1={0} y2={H} x1={i * 60} x2={i * 60} stroke="#1d3b3a" strokeWidth={1} />)}
        <polyline points={pts.join(" ")} fill="none" stroke="#34f5a0" strokeOpacity={0.18} strokeWidth={4} />
        <polyline points={pts.join(" ")} fill="none" stroke="url(#fade)" strokeWidth={5} strokeLinejoin="round" clipPath="url(#drawn)" filter="url(#glow)" />
        <circle cx={sweep} cy={top + 70 + ecg(((sweep / W) * 2) % 1) * amp} r={7} fill="#c9ffe5" filter="url(#glow)" />
        <g transform={`translate(240 380) scale(${pulse})`}>
          <path d="M0 22 C-34 -4 -30 -34 -10 -34 C0 -34 0 -26 0 -22 C0 -26 0 -34 10 -34 C30 -34 34 -4 0 22 Z" fill="#ff4d6d" filter="url(#glow)" />
        </g>
        <text x={330} y={392} fill="#34f5a0" fontSize={44} fontWeight={700}>72</text>
        <text x={100} y={392} fill="#7dd3fc" fontSize={28} fontWeight={600}>SpO₂ 98</text>
      </svg>
    </AbsoluteFill>
  );
};
