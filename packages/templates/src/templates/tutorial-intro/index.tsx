import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import type { TutorialIntroProps } from './schema';
import { getConstants } from './constants';
import { TitleScene } from './scenes/TitleScene';
import { TopicScene } from './scenes/TopicScene';
import { ChapterScene } from './scenes/ChapterScene';

const TutorialIntro: React.FC<TutorialIntroProps> = (props) => {
  const { TIMING } = getConstants(props);

  return (
    <AbsoluteFill>
      <Sequence
        from={TIMING.scene1.start}
        durationInFrames={TIMING.scene1.duration}
        name="Title"
      >
        <TitleScene {...props} />
      </Sequence>

      <Sequence
        from={TIMING.scene2.start}
        durationInFrames={TIMING.scene2.duration}
        name="Topics"
      >
        <TopicScene {...props} />
      </Sequence>

      <Sequence
        from={TIMING.scene3.start}
        durationInFrames={TIMING.scene3.duration}
        name="Chapters"
      >
        <ChapterScene {...props} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default TutorialIntro;
