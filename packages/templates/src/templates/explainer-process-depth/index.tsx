import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ExplainerProcessDepthProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, staggeredGlowIn, drawLine } from '../../blackboard/animations';
import { GlowCircle } from '../../blackboard/effects';
import { GlowHeading } from '../../blackboard/typography';
import { useScale } from '../../use-scale';
import { computeSpeakerPx } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const ExplainerProcessDepth: React.FC<ExplainerProcessDepthProps> = ({
  title,
  steps = [],
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );

  // Title in top visible zone
  const titleAnim = glowFadeIn(frame, 5);
  const lineAnim = drawLine(frame, 15, 30);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  const circleSize = s(56);
  const stepGap = s(24);
  const stepBlockHeight = circleSize + stepGap;

  // Steps fan out from speaker center, alternating left and right
  const stepStartY = centerPx.y - ((steps.length - 1) * stepBlockHeight) / 2;

  const totalLineLength = (steps.length - 1) * stepBlockHeight;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {/* Title — top of canvas */}
        <div style={{
          position: 'absolute',
          top: s(120),
          left: 0,
          width: '100%',
          textAlign: 'center',
          opacity: titleAnim.contentProgress,
          transform: `scale(${titleAnim.scale})`,
        }}>
          <GlowHeading text={title} size={s(52)} glowIntensity={titleAnim.glowProgress} />
        </div>

        {/* Connecting line through speaker center */}
        {steps.length > 1 && (
          <svg
            width={s(4)}
            height={totalLineLength}
            style={{
              position: 'absolute',
              left: centerPx.x - s(2),
              top: stepStartY + circleSize / 2,
              overflow: 'visible',
            }}
          >
            <line
              x1={s(2)} y1={0} x2={s(2)} y2={totalLineLength}
              stroke={BLACKBOARD_COLORS.primary}
              strokeWidth={s(3)}
              strokeDasharray={totalLineLength}
              strokeDashoffset={totalLineLength * (1 - lineAnim.progress)}
              strokeLinecap="round"
              opacity={0.8}
            />
          </svg>
        )}

        {/* Step nodes — alternate left/right of speaker */}
        {steps.map((step, i) => {
          const stepAnim = staggeredGlowIn(frame, 30, i, 10);
          const isLeft = i % 2 === 0;
          const nodeY = stepStartY + i * stepBlockHeight;

          // Position: circle at speaker center X, text extends outward
          const textX = isLeft
            ? centerPx.x - circleSize - s(16) - s(400)
            : centerPx.x + circleSize + s(16);

          return (
            <React.Fragment key={i}>
              {/* Numbered circle — centered on speaker X */}
              <div style={{
                position: 'absolute',
                left: centerPx.x - circleSize / 2,
                top: nodeY,
                opacity: stepAnim.contentProgress,
                transform: `scale(${stepAnim.scale})`,
              }}>
                <GlowCircle size={circleSize} glowIntensity={stepAnim.glowProgress} glowColor="primary">
                  <span style={{
                    fontFamily: BLACKBOARD_FONTS.mono,
                    fontSize: s(24),
                    fontWeight: 700,
                    color: BLACKBOARD_COLORS.primary,
                  }}>
                    {i + 1}
                  </span>
                </GlowCircle>
              </div>

              {/* Label + description — peek from behind shoulders */}
              <div style={{
                position: 'absolute',
                left: textX,
                top: nodeY,
                width: s(400),
                opacity: stepAnim.contentProgress,
                transform: `scale(${stepAnim.scale})`,
              }}>
                <div style={{
                  fontFamily: BLACKBOARD_FONTS.heading,
                  fontSize: s(26),
                  fontWeight: 700,
                  color: BLACKBOARD_COLORS.text,
                  lineHeight: 1.2,
                  textAlign: isLeft ? 'right' : 'left',
                }}>
                  {step.label}
                </div>
                <div style={{
                  fontFamily: BLACKBOARD_FONTS.body,
                  fontSize: s(20),
                  color: BLACKBOARD_COLORS.textMuted,
                  lineHeight: 1.3,
                  marginTop: s(4),
                  textAlign: isLeft ? 'right' : 'left',
                }}>
                  {step.description}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerProcessDepth;
