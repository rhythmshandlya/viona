import "./index.css";
import React from "react";
import { Composition } from "remotion";
import { ProjectComposition } from "./proj_f734af15_05a7_4e5f_b143_538e92ea68f6/Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="proj-f734af15-05a7-4e5f-b143-538e92ea68f6"
        component={ProjectComposition}
        durationInFrames={1974}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoUrl: "source.mp4",
          subtitles: [],
          captionStyle: {},
        }}
      />
    </>
  );
};
