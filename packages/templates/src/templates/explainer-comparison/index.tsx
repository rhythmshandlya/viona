import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ExplainerComparisonProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, staggeredGlowIn } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowHeading } from '../../blackboard/typography';
import { GlowPanel } from '../../blackboard/effects';
import { useScale } from '../../use-scale';

const ExplainerComparison: React.FC<ExplainerComparisonProps> = ({
  heading,
  titleA,
  titleB,
  pointsA,
  pointsB,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const headingAnim = glowFadeIn(frame, 5);
  const headerAnim = glowFadeIn(frame, 20);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        <BoardTexture seed="comp-bg" />

        <div
          style={{
            position: 'absolute',
            left: s(40),
            right: s(40),
            top: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {heading && (
            <div
              style={{
                opacity: headingAnim.contentProgress,
                transform: `scale(${headingAnim.scale})`,
                marginBottom: s(32),
                textAlign: 'center',
              }}
            >
              <GlowHeading
                text={heading}
                size={s(44)}
                glowIntensity={headingAnim.glowProgress}
              />
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: s(16),
              width: '100%',
            }}
          >
            {/* Left column — amber / primary */}
            <GlowPanel
              glowColor="primary"
              glowIntensity={headerAnim.glowProgress}
              style={{
                flex: 1,
                padding: s(24),
                opacity: headerAnim.contentProgress,
                transform: `scale(${headerAnim.scale})`,
              }}
            >
              <div style={{ marginBottom: s(20) }}>
                <GlowHeading
                  text={titleA}
                  size={s(32)}
                  color={BLACKBOARD_COLORS.primary}
                  glowIntensity={headerAnim.glowProgress}
                />
              </div>

              {pointsA.map((point, index) => {
                const anim = staggeredGlowIn(frame, 35, index, 6);
                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: s(12),
                      marginBottom: s(14),
                      opacity: anim.contentProgress,
                      transform: `scale(${anim.scale})`,
                    }}
                  >
                    <div
                      style={{
                        width: s(8),
                        height: s(8),
                        borderRadius: '50%',
                        backgroundColor: BLACKBOARD_COLORS.primary,
                        marginTop: s(8),
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        fontFamily: BLACKBOARD_FONTS.body,
                        fontSize: s(22),
                        color: BLACKBOARD_COLORS.text,
                        lineHeight: 1.4,
                      }}
                    >
                      {point}
                    </div>
                  </div>
                );
              })}
            </GlowPanel>

            {/* Right column — cyan / secondary */}
            <GlowPanel
              glowColor="secondary"
              glowIntensity={headerAnim.glowProgress}
              style={{
                flex: 1,
                padding: s(24),
                opacity: headerAnim.contentProgress,
                transform: `scale(${headerAnim.scale})`,
              }}
            >
              <div style={{ marginBottom: s(20) }}>
                <GlowHeading
                  text={titleB}
                  size={s(32)}
                  color={BLACKBOARD_COLORS.secondary}
                  glowIntensity={headerAnim.glowProgress}
                  style={{ textShadow: headerAnim.glowProgress > 0 ? '0 0 30px rgba(6, 182, 212, 0.3)' : 'none' }}
                />
              </div>

              {pointsB.map((point, index) => {
                const anim = staggeredGlowIn(frame, 35, index, 6);
                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: s(12),
                      marginBottom: s(14),
                      opacity: anim.contentProgress,
                      transform: `scale(${anim.scale})`,
                    }}
                  >
                    <div
                      style={{
                        width: s(8),
                        height: s(8),
                        borderRadius: '50%',
                        backgroundColor: BLACKBOARD_COLORS.secondary,
                        marginTop: s(8),
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        fontFamily: BLACKBOARD_FONTS.body,
                        fontSize: s(22),
                        color: BLACKBOARD_COLORS.text,
                        lineHeight: 1.4,
                      }}
                    >
                      {point}
                    </div>
                  </div>
                );
              })}
            </GlowPanel>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerComparison;
