import { Composition } from "remotion";
import { HowItWorks, HOW_FRAMES } from "./HowItWorks";
import { Monitor, MONITOR_FRAMES } from "./Monitor";
import { Calm, CALM_FRAMES } from "./Calm";
import { Promo, PROMO_FRAMES } from "./Promo";
import { StreetLoop, STREET_FRAMES } from "./StreetLoop";

export const Root = () => (
  <>
    <Composition id="Promo" component={Promo} durationInFrames={PROMO_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Monitor" component={Monitor} durationInFrames={MONITOR_FRAMES} fps={30} width={480} height={480} />
    <Composition id="HowItWorks" component={HowItWorks} durationInFrames={HOW_FRAMES} fps={30} width={1080} height={1080} />
    <Composition id="TokyoLoop" component={StreetLoop} defaultProps={{ src: "tokyo.mp4" }} durationInFrames={STREET_FRAMES} fps={30} width={720} height={1280} />
    <Composition id="StreetLoop" component={StreetLoop} durationInFrames={STREET_FRAMES} fps={30} width={1280} height={720} />
    {/* The Focus timer's street scenes at screen shape: wide for laptops, tall for phones. */}
    <Composition id="StreetCafeWide" component={StreetLoop} defaultProps={{ src: "dali.mp4" }} durationInFrames={STREET_FRAMES} fps={30} width={1600} height={900} />
    <Composition id="StreetCafeTall" component={StreetLoop} defaultProps={{ src: "dali.mp4" }} durationInFrames={STREET_FRAMES} fps={30} width={720} height={1280} />
    <Composition id="StreetTokyoWide" component={StreetLoop} defaultProps={{ src: "tokyo.mp4", blurFill: true }} durationInFrames={STREET_FRAMES} fps={30} width={1600} height={900} />
    <Composition id="StreetTokyoTall" component={StreetLoop} defaultProps={{ src: "tokyo.mp4" }} durationInFrames={STREET_FRAMES} fps={30} width={720} height={1280} />
    <Composition id="Calm" component={Calm} durationInFrames={CALM_FRAMES} fps={30} width={540} height={960} />
  </>
);
