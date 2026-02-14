/**
 * Remotion Root component for SVG Animation.
 */

import "./index.css";
import { Composition } from "remotion";
import MainComposition from "./svg_anim_b856fddc";

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
