import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ExplainerProcessProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, staggeredGlowIn, drawLine } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowCircle } from '../../blackboard/effects';
import { GlowHeading } from '../../blackboard/typography';
import { useScale } from '../../use-scale';

const ExplainerProcess: React.FC<ExplainerProcessProps> = ({ title, steps }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const isPortrait = height > width;
  const padX = s(isPortrait ? 80 : 120);
  const padY = s(isPortrait ? 100 : 40);

  // Animation sequence
  const titleAnim = glowFadeIn(frame, 5);
  const lineAnim = drawLine(frame, 15, 30);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  const circleSize = s(56);
  const stepGap = s(24);
  const lineGap = s(16);

  // Total vertical line length between first and last circle centers
  const stepBlockHeight = circleSize + stepGap;
  const totalLineLength = (steps.length - 1) * stepBlockHeight;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        <BoardTexture seed="process-bg" />

        <div
          style={{
            position: 'absolute',
            left: padX,
            right: padX,
            top: padY,
            bottom: padY,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Title */}
          <div
            style={{
              opacity: titleAnim.contentProgress,
              transform: `scale(${titleAnim.scale})`,
              textAlign: 'center',
              marginBottom: s(48),
              boxShadow:
                titleAnim.glowProgress > 0
                  ? `0 0 ${titleAnim.glowProgress * 40}px rgba(245,158,11,${titleAnim.glowProgress * 0.2})`
                  : 'none',
              display: 'inline-block',
            }}
          >
            <GlowHeading text={title} size={s(56)} glowIntensity={titleAnim.glowProgress} />
          </div>

          {/* Steps container */}
          <div style={{ position: 'relative' }}>
            {/* Connecting SVG line between circle centers */}
            {steps.length > 1 && (
              <svg
                width={s(4)}
                height={totalLineLength}
                style={{
                  position: 'absolute',
                  left: circleSize / 2 - s(2),
                  top: circleSize / 2,
                  overflow: 'visible',
                }}
              >
                <line
                  x1={s(2)}
                  y1={0}
                  x2={s(2)}
                  y2={totalLineLength}
                  stroke={BLACKBOARD_COLORS.primary}
                  strokeWidth={s(3)}
                  strokeDasharray={totalLineLength}
                  strokeDashoffset={totalLineLength * (1 - lineAnim.progress)}
                  strokeLinecap="round"
                  filter={`drop-shadow(0 0 6px rgba(245,158,11,0.5))`}
                />
              </svg>
            )}

            {/* Step nodes */}
            {steps.map((step, index) => {
              const stepAnim = staggeredGlowIn(frame, 30, index, 10);

              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: index < steps.length - 1 ? stepGap : 0,
                    opacity: stepAnim.contentProgress,
                    transform: `scale(${stepAnim.scale})`,
                  }}
                >
                  {/* Numbered circle */}
                  <GlowCircle
                    size={circleSize}
                    glowIntensity={stepAnim.glowProgress}
                    glowColor="primary"
                  >
                    <span
                      style={{
                        fontFamily: BLACKBOARD_FONTS.mono,
                        fontSize: s(24),
                        fontWeight: 700,
                        color: BLACKBOARD_COLORS.primary,
                      }}
                    >
                      {index + 1}
                    </span>
                  </GlowCircle>

                  {/* Label + description */}
                  <div
                    style={{
                      marginLeft: lineGap,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: s(4),
                    }}
                  >
                    <div
                      style={{
                        fontFamily: BLACKBOARD_FONTS.heading,
                        fontSize: s(28),
                        fontWeight: 700,
                        color: BLACKBOARD_COLORS.text,
                        lineHeight: 1.2,
                      }}
                    >
                      {step.label}
                    </div>
                    <div
                      style={{
                        fontFamily: BLACKBOARD_FONTS.body,
                        fontSize: s(22),
                        color: BLACKBOARD_COLORS.textMuted,
                        lineHeight: 1.3,
                      }}
                    >
                      {step.description}
                    </div>
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

export default ExplainerProcess;
