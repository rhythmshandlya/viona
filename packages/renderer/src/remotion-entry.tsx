import React from 'react';
import { Composition } from 'remotion';
import { VideoComposition } from './components/VideoComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ReelifyVideo"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={VideoComposition as any}
        durationInFrames={30 * 60} // Will be overridden
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          videoUrl: '',
          subtitles: [],
        }}
      />
    </>
  );
};
