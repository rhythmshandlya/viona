import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ExplainerProcessProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, staggeredGlowIn, drawLine } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowCircle } from '../../blackboard/effects';
import { GlowHeading } from '../../blackboard/typography';
import { useScale } from '../../use-scale';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const ExplainerProcess: React.FC<ExplainerProcessProps> = ({
  title,
  steps,
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
  const zones = isDepthMode && depthData
    ? computeVisibleZones(depthData.bboxPx, CANVAS_W, CANVAS_H)
    : null;

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

  /* -- Depth-mode: compute alternating left/right positions ---------- */
  const depthStepPositions = isDepthMode && depthData && zones
    ? steps.map((_step, index) => {
        const isLeft = index % 2 === 0;
        const zone = isLeft ? zones.left : zones.right;
        const stepBlockH = circleSize + s(12);
        const totalStepsH = steps.length * stepBlockH;
        const startY = depthData.centerPx.y - totalStepsH / 2;
        return {
          x: zone.x + zone.w * 0.1,
          y: startY + index * stepBlockH,
          maxW: zone.w * 0.8,
          isLeft,
        };
      })
    : null;

  /* -- Depth-mode: connecting line X position through speaker center - */
  const depthLineX = depthData ? depthData.centerPx.x : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        <BoardTexture seed="process-bg" />

        {!isDepthMode ? (
          /* -- Standard layout ---------------------------------------- */
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
        ) : (
          /* -- Depth layout: steps alternate left/right of speaker ---- */
          <>
            {/* Title above speaker */}
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
              <GlowHeading text={title} size={s(48)} glowIntensity={titleAnim.glowProgress} />
            </div>

            {/* Connecting vertical line through speaker center */}
            {steps.length > 1 && depthStepPositions && (
              <svg
                width={s(4)}
                height={CANVAS_H}
                style={{
                  position: 'absolute',
                  left: depthLineX - s(2),
                  top: 0,
                  overflow: 'visible',
                  pointerEvents: 'none',
                }}
              >
                <line
                  x1={s(2)}
                  y1={depthStepPositions[0].y + circleSize / 2}
                  x2={s(2)}
                  y2={depthStepPositions[depthStepPositions.length - 1].y + circleSize / 2}
                  stroke={BLACKBOARD_COLORS.primary}
                  strokeWidth={s(3)}
                  strokeDasharray={totalLineLength}
                  strokeDashoffset={totalLineLength * (1 - lineAnim.progress)}
                  strokeLinecap="round"
                  opacity={0.4}
                />
              </svg>
            )}

            {/* Step nodes positioned left/right */}
            {steps.map((step, index) => {
              const stepAnim = staggeredGlowIn(frame, 30, index, 10);
              const pos = depthStepPositions![index];

              const slideIn = interpolate(
                frame,
                [30 + index * 10, 40 + index * 10],
                [pos.isLeft ? -s(200) : s(200), 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );

              return (
                <div
                  key={index}
                  style={{
                    position: 'absolute',
                    left: pos.x,
                    top: pos.y,
                    width: pos.maxW,
                    display: 'flex',
                    flexDirection: pos.isLeft ? 'row' : 'row-reverse',
                    alignItems: 'center',
                    opacity: stepAnim.contentProgress,
                    transform: `translateX(${slideIn}px) scale(${stepAnim.scale})`,
                  }}
                >
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

                  <div
                    style={{
                      marginLeft: pos.isLeft ? lineGap : 0,
                      marginRight: pos.isLeft ? 0 : lineGap,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: s(4),
                      textAlign: pos.isLeft ? 'left' : 'right',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: BLACKBOARD_FONTS.heading,
                        fontSize: s(26),
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
                        fontSize: s(20),
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
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerProcess;
