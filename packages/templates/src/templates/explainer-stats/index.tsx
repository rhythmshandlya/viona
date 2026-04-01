import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ExplainerStatsProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, staggeredGlowIn, glowExit } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowHeading, GlowLabel } from '../../blackboard/typography';
import { useScale } from '../../use-scale';
import { CountUp } from './components/CountUp';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const ExplainerStats: React.FC<ExplainerStatsProps> = ({
  title,
  stats,
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const isDepthMode = !!speakerBbox && !!speakerCenter;
  const depthData = isDepthMode
    ? computeSpeakerPx(speakerBbox, speakerCenter, CANVAS_W, CANVAS_H)
    : null;

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

        {!isDepthMode ? (
          /* -- Standard layout ---------------------------------------- */
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
        ) : (
          /* -- Depth layout: numbers scale up from speaker center ----- */
          <>
            {/* Title above speaker */}
            {title && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: s(80),
                  textAlign: 'center',
                  opacity: titleAnim.contentProgress,
                  transform: `scale(${titleAnim.scale})`,
                }}
              >
                <GlowHeading
                  text={title}
                  size={s(44)}
                  glowIntensity={titleAnim.glowProgress}
                />
              </div>
            )}

            {/* Stat numbers radiating from speaker center */}
            {stats.map((stat, index) => {
              const stagger = staggeredGlowIn(frame, 20, index, 10);
              const countStart = 25 + index * 10;
              const pulseStart = 55 + index * 10;

              // Position stats in a ring around speaker center
              const angleStep = (Math.PI * 2) / count;
              const angle = angleStep * index - Math.PI / 2; // start from top
              const radius = s(320);
              const cx = depthData!.centerPx.x;
              const cy = depthData!.centerPx.y;
              const targetX = cx + Math.cos(angle) * radius;
              const targetY = cy + Math.sin(angle) * radius;

              // Scale up from speaker center
              const scaleUp = interpolate(
                frame,
                [20 + index * 10, 35 + index * 10],
                [0.3, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              const moveOut = interpolate(
                frame,
                [20 + index * 10, 35 + index * 10],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );

              const currentX = cx + (targetX - cx) * moveOut;
              const currentY = cy + (targetY - cy) * moveOut;

              return (
                <div
                  key={index}
                  style={{
                    position: 'absolute',
                    left: currentX,
                    top: currentY,
                    transform: `translate(-50%, -50%) scale(${scaleUp * stagger.scale})`,
                    opacity: stagger.contentProgress,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  <CountUp
                    value={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    startFrame={countStart}
                    duration={30}
                    fontSize={s(88)}
                    pulseStart={pulseStart}
                  />
                  <div style={{ marginTop: s(8) }}>
                    <GlowLabel
                      text={stat.label}
                      size={s(22)}
                      color={BLACKBOARD_COLORS.textMuted}
                    />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerStats;
