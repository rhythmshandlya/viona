import "./index.css";
import { Composition } from "remotion";
import MainComposition from "./proj_e704b900_4010_408b_b7e5_a22b0114d4d1";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="proj-e704b900-4010-408b-b7e5-a22b0114d4d1"
        component={MainComposition}
        durationInFrames={2208}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
