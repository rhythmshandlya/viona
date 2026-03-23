import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ExplainerRankingProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, staggeredGlowIn, glowPulse } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowHeading, DataValue } from '../../blackboard/typography';
import { useScale } from '../../use-scale';

const ExplainerRanking: React.FC<ExplainerRankingProps> = ({
  title,
  items,
  ascending,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const displayItems = ascending ? [...items].reverse() : items;

  const titleAnim = glowFadeIn(frame, 5);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        <BoardTexture seed="ranking-bg" />

        <div
          style={{
            position: 'absolute',
            left: s(60),
            right: s(60),
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
              marginBottom: s(40),
            }}
          >
            <GlowHeading
              text={title}
              size={s(44)}
              glowIntensity={titleAnim.glowProgress}
            />
          </div>

          {/* Ranked items */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: s(20),
            }}
          >
            {displayItems.map((item, index) => {
              const rowAnim = staggeredGlowIn(frame, 20, index, 8);
              const pulse = glowPulse(frame, 28 + index * 8);

              return (
                <div
                  key={item.rank}
                  style={{
                    opacity: rowAnim.contentProgress,
                    transform: `scale(${rowAnim.scale})`,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: s(20),
                  }}
                >
                  {/* Rank number */}
                  <DataValue
                    text={String(item.rank)}
                    size={s(56)}
                    glowIntensity={rowAnim.glowProgress + pulse.intensity * 0.5}
                  />

                  {/* Label + detail */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      paddingTop: s(6),
                    }}
                  >
                    <div
                      style={{
                        fontFamily: BLACKBOARD_FONTS.heading,
                        fontSize: s(30),
                        fontWeight: 600,
                        color: BLACKBOARD_COLORS.text,
                        lineHeight: 1.2,
                      }}
                    >
                      {item.label}
                    </div>
                    {item.detail && (
                      <div
                        style={{
                          fontFamily: BLACKBOARD_FONTS.body,
                          fontSize: s(20),
                          color: BLACKBOARD_COLORS.textMuted,
                          marginTop: s(4),
                          lineHeight: 1.3,
                        }}
                      >
                        {item.detail}
                      </div>
                    )}
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

export default ExplainerRanking;
