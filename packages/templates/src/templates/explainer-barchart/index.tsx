import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ExplainerBarchartProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, staggeredGlowIn } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowHeading } from '../../blackboard/typography';
import { useScale } from '../../use-scale';

const ExplainerBarchart: React.FC<ExplainerBarchartProps> = ({ title, bars }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const isPortrait = height > width;
  const padX = s(isPortrait ? 80 : 120);

  const maxValue = Math.max(...bars.map((b) => b.maxValue ?? b.value));

  const titleAnim = glowFadeIn(frame, 5);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        <BoardTexture seed="barchart-bg" />

        <div
          style={{
            position: 'absolute',
            left: padX,
            right: padX,
            top: 0,
            bottom: 0,
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
            }}
          >
            <GlowHeading text={title} size={s(44)} glowIntensity={titleAnim.glowProgress} />
          </div>

          {/* Bars */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: s(24),
            }}
          >
            {bars.map((bar, index) => {
              const barAnim = staggeredGlowIn(frame, 20, index, 8);
              const fillStart = 25 + index * 8;
              const targetPercent = maxValue > 0 ? (bar.value / maxValue) * 100 : 0;
              const fillWidth = interpolate(
                frame,
                [fillStart, fillStart + 25],
                [0, targetPercent],
                {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                },
              );
              const valueFadeIn = glowFadeIn(frame, fillStart + 25);

              return (
                <div
                  key={index}
                  style={{
                    opacity: barAnim.contentProgress,
                    transform: `scale(${barAnim.scale})`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: s(16),
                  }}
                >
                  {/* Label */}
                  <div
                    style={{
                      fontFamily: BLACKBOARD_FONTS.body,
                      fontSize: s(22),
                      color: BLACKBOARD_COLORS.text,
                      width: s(160),
                      flexShrink: 0,
                      textAlign: 'right',
                    }}
                  >
                    {bar.label}
                  </div>

                  {/* Bar track */}
                  <div
                    style={{
                      flex: 1,
                      height: s(36),
                      backgroundColor: BLACKBOARD_COLORS.surfaceBorder,
                      borderRadius: s(6),
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {/* Fill bar */}
                    <div
                      style={{
                        height: '100%',
                        width: `${fillWidth}%`,
                        backgroundColor: BLACKBOARD_COLORS.secondary,
                        borderRadius: s(6),
                        boxShadow: '0 0 10px rgba(6,182,212,0.3)',
                      }}
                    />
                  </div>

                  {/* Value */}
                  <div
                    style={{
                      fontFamily: BLACKBOARD_FONTS.mono,
                      fontSize: s(22),
                      color: BLACKBOARD_COLORS.primary,
                      opacity: valueFadeIn.contentProgress,
                      width: s(60),
                      flexShrink: 0,
                      textAlign: 'left',
                    }}
                  >
                    {bar.value}
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

export default ExplainerBarchart;
