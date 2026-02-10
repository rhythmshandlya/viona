/**
 * Remotion Root component for SVG Animation.
 */

import "./index.css";
import { Composition } from "remotion";
import MainComposition from "./svg_anim_455889e0";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="svg-anim-455889e0"
        component={MainComposition}
        durationInFrames={30}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
