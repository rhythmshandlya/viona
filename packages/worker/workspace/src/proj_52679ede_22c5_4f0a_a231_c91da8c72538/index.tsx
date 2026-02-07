import React from 'react';
import {
  AbsoluteFill,
  Composition,
  Sequence,
  registerRoot,
} from 'remotion';
import { COLORS, TIMING, VIDEO_CONFIG } from './constants';
import { Background } from './components/Background';
import { Scene1 } from './scenes/Scene1';
import { Scene2 } from './scenes/Scene2';
import { Scene3 } from './scenes/Scene3';
import { Scene4 } from './scenes/Scene4';
import { Scene5 } from './scenes/Scene5';
import { Scene6 } from './scenes/Scene6';
import { Scene7 } from './scenes/Scene7';
import { Scene8 } from './scenes/Scene8';

const MainComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Animated background - persistent across all scenes */}
      <Background key="bg" />

      {/* Scene 1: Challenge Introduction */}
      <Sequence
        key="scene1"
        from={TIMING.scene1Start}
        durationInFrames={TIMING.scene1End - TIMING.scene1Start}
      >
        <Scene1 />
      </Sequence>

      {/* Scene 2: The Obvious Solution */}
      <Sequence
        key="scene2"
        from={TIMING.scene2Start}
        durationInFrames={TIMING.scene2End - TIMING.scene2Start}
      >
        <Scene2 />
      </Sequence>

      {/* Scene 3: The Trap Revealed */}
      <Sequence
        key="scene3"
        from={TIMING.scene3Start}
        durationInFrames={TIMING.scene3End - TIMING.scene3Start}
      >
        <Scene3 />
      </Sequence>

      {/* Scene 4: Solution Emergence */}
      <Sequence
        key="scene4"
        from={TIMING.scene4Start}
        durationInFrames={TIMING.scene4End - TIMING.scene4Start}
      >
        <Scene4 />
      </Sequence>

      {/* Scene 5: Clock Face Visualization */}
      <Sequence
        key="scene5"
        from={TIMING.scene5Start}
        durationInFrames={TIMING.scene5End - TIMING.scene5Start}
      >
        <Scene5 />
      </Sequence>

      {/* Scene 6: Hierarchical Genius */}
      <Sequence
        key="scene6"
        from={TIMING.scene6Start}
        durationInFrames={TIMING.scene6End - TIMING.scene6Start}
      >
        <Scene6 />
      </Sequence>

      {/* Scene 7: Real Implementation */}
      <Sequence
        key="scene7"
        from={TIMING.scene7Start}
        durationInFrames={TIMING.scene7End - TIMING.scene7Start}
      >
        <Scene7 />
      </Sequence>

      {/* Scene 8: Call to Action */}
      <Sequence
        key="scene8"
        from={TIMING.scene8Start}
        durationInFrames={TIMING.scene8End - TIMING.scene8Start}
      >
        <Scene8 />
      </Sequence>
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="proj_52679ede_22c5_4f0a_a231_c91da8c72538"
      component={MainComposition}
      durationInFrames={VIDEO_CONFIG.durationInFrames}
      fps={VIDEO_CONFIG.fps}
      width={VIDEO_CONFIG.width}
      height={VIDEO_CONFIG.height}
    />
  );
};

// CRITICAL: Export MainComposition as default for SSR rendering
export default MainComposition;

// Register root for Remotion bundler
registerRoot(RemotionRoot);
