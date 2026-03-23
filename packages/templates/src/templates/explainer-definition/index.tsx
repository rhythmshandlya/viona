import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ExplainerDefinitionProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, drawLine } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowHeading, GlowLabel } from '../../blackboard/typography';
import { useScale } from '../../use-scale';

const ExplainerDefinition: React.FC<ExplainerDefinitionProps> = ({
  term,
  pronunciation,
  partOfSpeech,
  definition,
  example,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const isPortrait = height > width;
  const padX = s(isPortrait ? 80 : 120);
  const padY = s(isPortrait ? 0 : 40);

  const termAnim = glowFadeIn(frame, 10);
  const pronunciationAnim = glowFadeIn(frame, 25, 15);
  const lineAnim = drawLine(frame, 35, 20);
  const defAnim = glowFadeIn(frame, 50, 20);
  const exampleAnim = glowFadeIn(frame, 70, 15);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        <BoardTexture seed="def-bg" />

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
          {partOfSpeech && (
            <div
              style={{
                opacity: termAnim.contentProgress,
                transform: `scale(${termAnim.scale})`,
                marginBottom: s(16),
              }}
            >
              <GlowLabel text={partOfSpeech} size={s(18)} color={BLACKBOARD_COLORS.primary} />
            </div>
          )}

          <div
            style={{
              opacity: termAnim.contentProgress,
              transform: `scale(${termAnim.scale})`,
              boxShadow:
                termAnim.glowProgress > 0
                  ? `0 0 ${termAnim.glowProgress * 40}px rgba(245,158,11,${termAnim.glowProgress * 0.2})`
                  : 'none',
              display: 'inline-block',
            }}
          >
            <GlowHeading text={term} size={s(76)} glowIntensity={termAnim.glowProgress} />
          </div>

          {pronunciation && (
            <div
              style={{
                opacity: pronunciationAnim.contentProgress,
                transform: `scale(${pronunciationAnim.scale})`,
                marginTop: s(12),
              }}
            >
              <div
                style={{
                  fontFamily: BLACKBOARD_FONTS.body,
                  fontSize: s(24),
                  fontStyle: 'italic',
                  color: BLACKBOARD_COLORS.textMuted,
                }}
              >
                {pronunciation}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: s(32),
              marginBottom: s(32),
              height: s(3),
              borderRadius: s(1.5),
              backgroundColor: BLACKBOARD_COLORS.primary,
              width: `${lineAnim.progress * 100}%`,
              boxShadow:
                lineAnim.progress > 0
                  ? `0 0 12px rgba(245,158,11,0.5)`
                  : 'none',
            }}
          />

          <div
            style={{
              opacity: defAnim.contentProgress,
              transform: `scale(${defAnim.scale})`,
            }}
          >
            <div
              style={{
                fontFamily: BLACKBOARD_FONTS.body,
                fontSize: s(36),
                color: BLACKBOARD_COLORS.text,
                lineHeight: 1.5,
              }}
            >
              {definition}
            </div>
          </div>

          {example && (
            <div
              style={{
                opacity: exampleAnim.contentProgress,
                transform: `scale(${exampleAnim.scale})`,
                marginTop: s(28),
              }}
            >
              <div
                style={{
                  fontFamily: BLACKBOARD_FONTS.body,
                  fontSize: s(24),
                  fontStyle: 'italic',
                  color: BLACKBOARD_COLORS.secondary,
                }}
              >
                "{example}"
              </div>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerDefinition;
