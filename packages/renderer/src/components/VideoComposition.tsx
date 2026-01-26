import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  useVideoConfig,
} from 'remotion';
import { AnimatedSubtitle, SubtitleWord, SubtitleStyle } from './AnimatedSubtitle';

export interface SubtitleItem {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  words: SubtitleWord[];
  style?: SubtitleStyle;
}

export interface VideoCompositionProps {
  videoUrl: string;
  subtitles: SubtitleItem[];
  defaultSubtitleStyle?: SubtitleStyle;
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  videoUrl,
  subtitles,
  defaultSubtitleStyle,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Video layer */}
      <AbsoluteFill>
        <OffthreadVideo
          src={videoUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </AbsoluteFill>

      {/* Subtitles layer */}
      <AbsoluteFill>
        {subtitles.map((subtitle) => {
          const startFrame = Math.floor((subtitle.startMs / 1000) * fps);
          const durationFrames = Math.floor(
            ((subtitle.endMs - subtitle.startMs) / 1000) * fps
          );

          return (
            <Sequence
              key={subtitle.id}
              from={startFrame}
              durationInFrames={durationFrames}
            >
              <AnimatedSubtitle
                words={subtitle.words}
                startMs={subtitle.startMs}
                endMs={subtitle.endMs}
                style={{ ...defaultSubtitleStyle, ...subtitle.style }}
              />
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default VideoComposition;
