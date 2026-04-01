import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ExplainerStatsProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, staggeredGlowIn, glowExit } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowHeading, GlowLabel } from '../../blackboard/typography';
import { useScale } from '../../use-scale';
import { CountUp } from './components/CountUp';

const ExplainerStats: React.FC<ExplainerStatsProps> = ({ title, stats }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const isPortrait = height > width;
  const padX = s(isPortrait ? 80 : 120);

  const titleAnim = glowFadeIn(frame, 5);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  const count = stats.length;
  const isGrid = count === 4;
  const isRow = count === 2;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        <BoardTexture seed="stats-bg" />

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
            alignItems: 'center',
          }}
        >
          {title && (
            <div
              style={{
                opacity: titleAnim.contentProgress,
                transform: `scale(${titleAnim.scale})`,
                marginBottom: s(64),
                textAlign: 'center',
              }}
            >
              <GlowHeading
                text={title}
                size={s(48)}
                glowIntensity={titleAnim.glowProgress}
              />
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: isRow ? 'row' : isGrid ? 'row' : 'column',
              flexWrap: isGrid ? 'wrap' : 'nowrap',
              justifyContent: 'center',
              alignItems: 'center',
              gap: s(48),
              width: '100%',
            }}
          >
            {stats.map((stat, index) => {
              const stagger = staggeredGlowIn(frame, 20, index, 10);
              const countStart = 25 + index * 10;
              const pulseStart = 55 + index * 10;

              return (
                <div
                  key={index}
                  style={{
                    opacity: stagger.contentProgress,
                    transform: `scale(${stagger.scale})`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    ...(isGrid ? { width: `calc(50% - ${s(24)}px)` } : {}),
                  }}
                >
                  <CountUp
                    value={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    startFrame={countStart}
                    duration={30}
                    fontSize={s(72)}
                    pulseStart={pulseStart}
                  />
                  <div style={{ marginTop: s(12) }}>
                    <GlowLabel
                      text={stat.label}
                      size={s(20)}
                      color={BLACKBOARD_COLORS.textMuted}
                    />
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

export default ExplainerStats;
