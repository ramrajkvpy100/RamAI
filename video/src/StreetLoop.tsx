import { AbsoluteFill, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";

/** The Focus timer's Street scene: a real café window in Dali (Pexels, free licence), real speed, looped with a soft crossfade. */
export const STREET_FRAMES = 14 * 30;
const FADE = 30;

export const StreetLoop = ({ src = "dali.mp4" }: { src?: string }) => {
  const f = useCurrentFrame();
  const head = interpolate(f, [STREET_FRAMES - FADE, STREET_FRAMES], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "black" }}>
      <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      {/* The loop's start fades in over the end, so the jump back is invisible. */}
      <Sequence from={STREET_FRAMES - FADE}>
        <AbsoluteFill style={{ opacity: head }}>
          <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
