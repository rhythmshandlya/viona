import { AbsoluteFill, Sequence } from 'remotion';
import Scene1 from './scenes/scene_1';
import Scene2 from './scenes/scene_2';
import Scene3 from './scenes/scene_3';
import Scene4 from './scenes/scene_4';

// Visual Concept: A modular 3D car chassis on a clean pedestal that dynamically assembles and changes color properties based on interaction.
export default function Main() {
  return (
    <AbsoluteFill style={{ background: '#1a1a1a' }}>
      <Sequence from={0} durationInFrames={175} name="scene_1">
        <Scene1 />
      </Sequence>
      <Sequence from={175} durationInFrames={150} name="scene_2">
        <Scene2 />
      </Sequence>
      <Sequence from={325} durationInFrames={225} name="scene_3">
        <Scene3 />
      </Sequence>
      <Sequence from={550} durationInFrames={187} name="scene_4">
        <Scene4 />
      </Sequence>
    </AbsoluteFill>
  );
}
