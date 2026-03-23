import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ExplainerCauseEffectProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, drawLine } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowPanel } from '../../blackboard/effects';
import { GlowLabel } from '../../blackboard/typography';
import { useScale } from '../../use-scale';

const ExplainerCauseEffect: React.FC<ExplainerCauseEffectProps> = ({
  cause,
  effect,
  label,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const causeAnim = glowFadeIn(frame, 10);
  const arrowAnim = drawLine(frame, 35, 20);
  const labelAnim = glowFadeIn(frame, 40, 12);
  const effectAnim = glowFadeIn(frame, 55);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  const arrowHeight = s(80);
  const lineLength = arrowHeight - s(16);
  const dashTotal = lineLength;
  const dashOffset = dashTotal * (1 - arrowAnim.progress);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        <BoardTexture seed="cause-effect-bg" />

        <div
          style={{
            position: 'absolute',
            left: s(80),
            right: s(80),
            top: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Cause Panel */}
          <div
            style={{
              opacity: causeAnim.contentProgress,
              transform: `scale(${causeAnim.scale})`,
              width: '100%',
            }}
          >
            <GlowPanel
              glowColor="primary"
              glowIntensity={causeAnim.glowProgress}
              style={{ padding: s(32), borderRadius: s(12) }}
            >
              <GlowLabel
                text="CAUSE"
                size={s(18)}
                color={BLACKBOARD_COLORS.primary}
                style={{ marginBottom: s(12) }}
              />
              <div
                style={{
                  fontFamily: BLACKBOARD_FONTS.body,
                  fontSize: s(32),
                  color: BLACKBOARD_COLORS.text,
                  lineHeight: 1.4,
                }}
              >
                {cause}
              </div>
            </GlowPanel>
          </div>

          {/* Arrow + Label */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: arrowHeight,
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <svg
              width={s(24)}
              height={arrowHeight}
              viewBox={`0 0 24 ${arrowHeight / s(1)}`}
              style={{ overflow: 'visible' }}
            >
              <defs>
                <filter id="arrow-glow">
                  <feDropShadow
                    dx={0}
                    dy={0}
                    stdDeviation={4}
                    floodColor={BLACKBOARD_COLORS.primary}
                    floodOpacity={0.6}
                  />
                </filter>
              </defs>
              <line
                x1={12}
                y1={0}
                x2={12}
                y2={lineLength / s(1)}
                stroke={BLACKBOARD_COLORS.primary}
                strokeWidth={2}
                strokeDasharray={dashTotal / s(1)}
                strokeDashoffset={dashOffset / s(1)}
                filter="url(#arrow-glow)"
              />
              <polygon
                points={`6,${(lineLength - s(4)) / s(1)} 18,${(lineLength - s(4)) / s(1)} 12,${arrowHeight / s(1)}`}
                fill={BLACKBOARD_COLORS.primary}
                opacity={arrowAnim.progress}
                filter="url(#arrow-glow)"
              />
            </svg>

            {/* Label overlay */}
            {label && (
              <div
                style={{
                  position: 'absolute',
                  left: s(40),
                  top: '50%',
                  transform: `translateY(-50%) scale(${labelAnim.scale})`,
                  opacity: labelAnim.contentProgress,
                  fontFamily: BLACKBOARD_FONTS.heading,
                  fontSize: s(24),
                  color: BLACKBOARD_COLORS.primary,
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </div>
            )}
          </div>

          {/* Effect Panel */}
          <div
            style={{
              opacity: effectAnim.contentProgress,
              transform: `scale(${effectAnim.scale})`,
              width: '100%',
            }}
          >
            <GlowPanel
              glowColor="secondary"
              glowIntensity={effectAnim.glowProgress}
              style={{ padding: s(32), borderRadius: s(12) }}
            >
              <GlowLabel
                text="EFFECT"
                size={s(18)}
                color={BLACKBOARD_COLORS.secondary}
                style={{ marginBottom: s(12) }}
              />
              <div
                style={{
                  fontFamily: BLACKBOARD_FONTS.body,
                  fontSize: s(32),
                  color: BLACKBOARD_COLORS.text,
                  lineHeight: 1.4,
                }}
              >
                {effect}
              </div>
            </GlowPanel>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerCauseEffect;
