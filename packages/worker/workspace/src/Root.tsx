import "./index.css";
import { Composition } from "remotion";
import MainComposition from "./proj_e432e024_e304_4a27_bf35_75b11fa2c60c";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="proj-e432e024-e304-4a27-bf35-75b11fa2c60c"
        component={MainComposition}
        durationInFrames={856}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
