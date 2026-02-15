/**
 * Remotion Root component for SVG Animation.
 */

import "./index.css";
import { Composition } from "remotion";
import MainComposition from "./proj_f1b4f6b3_069b_48dc_a5ad_a76aca1b0e0c";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="svg-anim-b856fddc"
        component={MainComposition}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
