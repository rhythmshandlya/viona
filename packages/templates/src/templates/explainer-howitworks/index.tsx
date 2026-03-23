import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ExplainerHowitworksProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, staggeredGlowIn, glowExit } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowHeading } from '../../blackboard/typography';
import { GlowCircle } from '../../blackboard/effects';
import { useScale } from '../../use-scale';

const ExplainerHowitworks: React.FC<ExplainerHowitworksProps> = ({
  title,
  items,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const titleAnim = glowFadeIn(frame, 5);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        <BoardTexture seed="howitworks-bg" />

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
          {/* Title */}
          <div
            style={{
              opacity: titleAnim.contentProgress,
              transform: `scale(${titleAnim.scale})`,
              marginBottom: s(48),
              textAlign: 'center',
            }}
          >
            <GlowHeading
              text={title}
              size={s(48)}
              glowIntensity={titleAnim.glowProgress}
            />
          </div>

          {/* Items */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: s(32),
              width: '100%',
            }}
          >
            {items.map((item, index) => {
              const anim = staggeredGlowIn(frame, 25, index, 10);

              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: s(24),
                    opacity: anim.contentProgress,
                    transform: `scale(${anim.scale})`,
                  }}
                >
                  <GlowCircle
                    size={s(64)}
                    glowIntensity={anim.glowProgress}
                  >
                    <span
                      style={{
                        fontFamily: BLACKBOARD_FONTS.mono,
                        fontSize: s(28),
                        fontWeight: 700,
                        color: BLACKBOARD_COLORS.primary,
                      }}
                    >
                      {index + 1}
                    </span>
                  </GlowCircle>

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: BLACKBOARD_FONTS.heading,
                        fontSize: s(30),
                        fontWeight: 700,
                        color: BLACKBOARD_COLORS.text,
                        lineHeight: 1.2,
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontFamily: BLACKBOARD_FONTS.body,
                        fontSize: s(22),
                        color: BLACKBOARD_COLORS.textMuted,
                        lineHeight: 1.4,
                        marginTop: s(4),
                      }}
                    >
                      {item.description}
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

export default ExplainerHowitworks;
