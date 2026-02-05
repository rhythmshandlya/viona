import { AbsoluteFill, Sequence } from 'remotion';
import Scene1 from './scenes/scene_1';
import Scene2 from './scenes/scene_2';
import Scene3 from './scenes/scene_3';
import Scene4 from './scenes/scene_4';
import Scene5 from './scenes/scene_5';
import Scene6 from './scenes/scene_6';

// Visual Concept: A central API processing gateway represented as a rigid 'Validation Lens' for outgoing data and a flexible 'Normalization Funnel' for incoming data.
export default function Main() {
  return (
    <AbsoluteFill style={{ background: '#0F172A' }}>
      <Sequence from={0} durationInFrames={216} name="scene_1">
        <Scene1 />
      </Sequence>
      <Sequence from={216} durationInFrames={144} name="scene_2">
        <Scene2 />
      </Sequence>
      <Sequence from={360} durationInFrames={432} name="scene_3">
        <Scene3 />
      </Sequence>
      <Sequence from={792} durationInFrames={264} name="scene_4">
        <Scene4 />
      </Sequence>
      <Sequence from={1056} durationInFrames={192} name="scene_5">
        <Scene5 />
      </Sequence>
      <Sequence from={1248} durationInFrames={190} name="scene_6">
        <Scene6 />
      </Sequence>
    </AbsoluteFill>
  );
}
