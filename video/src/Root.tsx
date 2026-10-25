import { Composition } from "remotion";
import { HowItWorks, HOW_FRAMES } from "./HowItWorks";
import { Monitor, MONITOR_FRAMES } from "./Monitor";
import { Promo, PROMO_FRAMES } from "./Promo";

export const Root = () => (
  <>
    <Composition id="Promo" component={Promo} durationInFrames={PROMO_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Monitor" component={Monitor} durationInFrames={MONITOR_FRAMES} fps={30} width={480} height={480} />
    <Composition id="HowItWorks" component={HowItWorks} durationInFrames={HOW_FRAMES} fps={30} width={1080} height={1080} />
  </>
);
