import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ExplainerAnalogyProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING, BLACKBOARD_GLOW } from '../../blackboard/constants';
import { glowFadeIn, glowExit, glowPulse } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowHeading } from '../../blackboard/typography';
import { GlowPanel } from '../../blackboard/effects';
import { useScale } from '../../use-scale';

const ExplainerAnalogy: React.FC<ExplainerAnalogyProps> = ({
  subject,
  analogy,
  connector,
  explanation,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const subjectAnim = glowFadeIn(frame, 10);
  const connectorAnim = glowFadeIn(frame, 35);
  const connectorPulse = glowPulse(frame, 45);
  const analogyAnim = glowFadeIn(frame, 50);
  const explanationAnim = glowFadeIn(frame, 70, 15);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  const pulseGlow = connectorPulse.active
    ? `0 0 ${20 + connectorPulse.intensity * 30}px rgba(245,158,11,${0.3 + connectorPulse.intensity * 0.4})`
    : BLACKBOARD_GLOW.textPrimary;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        <BoardTexture seed="analogy-bg" />

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
          {/* Subject panel */}
          <div
            style={{
              opacity: subjectAnim.contentProgress,
              transform: `scale(${subjectAnim.scale})`,
              width: '100%',
            }}
          >
            <GlowPanel
              glowColor="primary"
              glowIntensity={subjectAnim.glowProgress}
              style={{ padding: s(40) }}
            >
              <GlowHeading
                text={subject}
                size={s(42)}
                glowIntensity={subjectAnim.glowProgress}
                style={{ textAlign: 'center' }}
              />
            </GlowPanel>
          </div>

          {/* Connector */}
          <div
            style={{
              opacity: connectorAnim.contentProgress,
              transform: `scale(${connectorAnim.scale})`,
              marginTop: s(24),
              marginBottom: s(24),
            }}
          >
            <div
              style={{
                fontFamily: BLACKBOARD_FONTS.heading,
                fontSize: s(28),
                fontWeight: 700,
                color: BLACKBOARD_COLORS.primary,
                textShadow: pulseGlow,
                textAlign: 'center',
              }}
            >
              {connector}
            </div>
          </div>

          {/* Analogy panel */}
          <div
            style={{
              opacity: analogyAnim.contentProgress,
              transform: `scale(${analogyAnim.scale})`,
              width: '100%',
            }}
          >
            <GlowPanel
              glowColor="secondary"
              glowIntensity={analogyAnim.glowProgress}
              style={{ padding: s(40) }}
            >
              <GlowHeading
                text={analogy}
                size={s(42)}
                glowIntensity={analogyAnim.glowProgress}
                color={BLACKBOARD_COLORS.secondary}
                style={{ textAlign: 'center' }}
              />
            </GlowPanel>
          </div>

          {/* Explanation */}
          {explanation && (
            <div
              style={{
                opacity: explanationAnim.contentProgress,
                transform: `scale(${explanationAnim.scale})`,
                marginTop: s(32),
              }}
            >
              <div
                style={{
                  fontFamily: BLACKBOARD_FONTS.body,
                  fontSize: s(26),
                  color: BLACKBOARD_COLORS.textMuted,
                  textAlign: 'center',
                  lineHeight: 1.5,
                }}
              >
                {explanation}
              </div>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerAnalogy;
