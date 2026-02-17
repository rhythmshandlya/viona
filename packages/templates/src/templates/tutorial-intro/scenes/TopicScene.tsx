import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CleanBg } from '../components/CleanBg';
import type { TutorialIntroProps } from '../schema';
import { getConstants } from '../constants';

export const TopicScene: React.FC<TutorialIntroProps> = (props) => {
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

  // Accent underline for heading
  const underlineWidth = interpolate(frame, [15, 40], [0, 80], {
    extrapolateRight: 'clamp',
  });

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
            marginBottom: 16,
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
            What You'll Learn
          </div>
          <div
            style={{
              width: underlineWidth,
              height: 4,
              backgroundColor: COLORS.primary,
              borderRadius: 2,
              marginTop: 12,
            }}
          />
        </div>

        {/* Topics list */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            marginTop: 48,
          }}
        >
          {props.topics.map((topic, index) => {
            const staggerDelay = 20 + index * 20;

            const topicSpring = spring({
              frame: Math.max(0, frame - staggerDelay),
              fps,
              config: SPRING_CONFIG,
              durationInFrames: 35,
            });

            const slideX = interpolate(topicSpring, [0, 1], [-60, 0], {
              extrapolateRight: 'clamp',
            });

            const topicOpacity = interpolate(topicSpring, [0, 1], [0, 1], {
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                  transform: `translateX(${slideX}px)`,
                  opacity: topicOpacity,
                }}
              >
                {/* Colored bullet */}
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    backgroundColor: COLORS.primary,
                    flexShrink: 0,
                    opacity: 0.9,
                  }}
                />

                {/* Topic text */}
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 36,
                    fontWeight: 500,
                    color: COLORS.text,
                  }}
                >
                  {topic}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
