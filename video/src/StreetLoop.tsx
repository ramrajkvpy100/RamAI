import { AbsoluteFill, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";

/** The Focus timer's Street scene: a real café window in Dali (Pexels, free licence), real speed, looped with a soft crossfade. */
export const STREET_FRAMES = 14 * 30;
const FADE = 30;

/** One pass of the clip: filling the frame, or (`blurFill`) whole in the middle over a soft, blurred copy of itself —
 * a portrait clip on a wide screen, sharp instead of cropped and blown up. */
const Clip = ({ src, blurFill }: { src: string; blurFill?: boolean }) =>
  blurFill ? (
    <AbsoluteFill>
      {/* Each layer fills the frame on its own (stacked, not one under the other). */}
      <AbsoluteFill>
        <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(28px) brightness(0.75)", transform: "scale(1.15)" }} />
      </AbsoluteFill>
      <AbsoluteFill>
        <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  ) : (
    <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  );

export const StreetLoop = ({ src = "dali.mp4", blurFill = false }: { src?: string; blurFill?: boolean }) => {
  const f = useCurrentFrame();
  const head = interpolate(f, [STREET_FRAMES - FADE, STREET_FRAMES], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "black" }}>
      <Clip src={src} blurFill={blurFill} />
      {/* The loop's start fades in over the end, so the jump back is invisible. */}
      <Sequence from={STREET_FRAMES - FADE}>
        <AbsoluteFill style={{ opacity: head }}>
          <Clip src={src} blurFill={blurFill} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
