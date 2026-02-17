import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CleanBg } from '../components/CleanBg';
import type { TutorialIntroProps } from '../schema';
import { getConstants } from '../constants';

export const ChapterScene: React.FC<TutorialIntroProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { COLORS, FONTS, SPRING_CONFIG } = getConstants(props);

  // Heading animation
  const headingSpring = spring({
    frame,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 35,
  });

  const headingOpacity = interpolate(headingSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const headingTranslateY = interpolate(headingSpring, [0, 1], [30, 0], {
    extrapolateRight: 'clamp',
  });

  // Timeline progress bar
  const totalChapters = props.chapters.length;
  const lastChapterDelay = 20 + (totalChapters - 1) * 20;
  const timelineHeight = interpolate(
    frame,
    [15, lastChapterDelay + 30],
    [0, 100],
    { extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill>
      <CleanBg background={COLORS.background} accent={COLORS.accent} />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 160px',
        }}
      >
        {/* Heading */}
        <div
          style={{
            opacity: headingOpacity,
            transform: `translateY(${headingTranslateY}px)`,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.headline,
              fontSize: 48,
              fontWeight: 700,
              color: COLORS.text,
            }}
          >
            Chapters
          </div>
        </div>

        {/* Chapter list with timeline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 40,
          }}
        >
          {/* Timeline bar on the left */}
          <div
            style={{
              width: 4,
              backgroundColor: `${COLORS.primary}15`,
              borderRadius: 2,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            {/* Animated progress fill */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${timelineHeight}%`,
                backgroundColor: COLORS.primary,
                borderRadius: 2,
              }}
            />
          </div>

          {/* Chapters */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 36,
              flex: 1,
            }}
          >
            {props.chapters.map((chapter, index) => {
              const staggerDelay = 20 + index * 20;

              const chapterSpring = spring({
                frame: Math.max(0, frame - staggerDelay),
                fps,
                config: SPRING_CONFIG,
                durationInFrames: 35,
              });

              const chapterOpacity = interpolate(chapterSpring, [0, 1], [0, 1], {
                extrapolateRight: 'clamp',
              });

              const slideY = interpolate(chapterSpring, [0, 1], [25, 0], {
                extrapolateRight: 'clamp',
              });

              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 20,
                    transform: `translateY(${slideY}px)`,
                    opacity: chapterOpacity,
                  }}
                >
                  {/* Chapter number */}
                  <div
                    style={{
                      fontFamily: FONTS.headline,
                      fontSize: 28,
                      fontWeight: 700,
                      color: COLORS.accent,
                      minWidth: 50,
                    }}
                  >
                    {String(chapter.number).padStart(2, '0')}
                  </div>

                  {/* Chapter title */}
                  <div
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 32,
                      fontWeight: 500,
                      color: COLORS.text,
                    }}
                  >
                    {chapter.title}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
