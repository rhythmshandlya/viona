import "./index.css";
import { Composition } from "remotion";
import MainComposition from "./proj_ec296bcb_9669_466e_a319_fa4291695177";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="proj-ec296bcb-9669-466e-a319-fa4291695177"
        component={MainComposition}
        durationInFrames={2967}
        fps={30}
        width={1080}
        height={960}
      />
    </>
  );
};
