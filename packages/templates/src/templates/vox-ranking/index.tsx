import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxRankingProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild, highlighterSweep } from '../../vox/animations';
import { FilmGrain, HighlighterMark } from '../../vox/effects';
import { VoxHeadline, VoxBody, VoxLabel } from '../../vox/typography';
import { RoughDivider } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const VoxRanking: React.FC<VoxRankingProps> = ({ items, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;

  // Items stagger in from bottom, starting at frame 20, default stagger (5 frames)
  const { itemOpacities } = progressiveBuild(frame, 20, items.length);

  // Highlight sweep for rank #1
  const { widthPercent, rotation } = highlighterSweep(frame, 28, 10);

  const ROW_HEIGHT = s(96);
  const RANK_WIDTH = s(72);

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.offWhite,
      padding: s(60),
      paddingTop: s(100),
    }}>
      {/* Title */}
      <div style={{
        opacity: combinedOpacity,
        transform: `translateY(${entrance.translateY + exit.translateY}px)`,
        marginBottom: s(48),
      }}>
        {title && (
          <VoxHeadline
            text={title}
            size={s(VOX_SIZES.h3)}
            color={VOX_COLORS.charcoal}
            accentBar="left"
          />
        )}
      </div>

      {/* Ranking list */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        flex: 1,
        justifyContent: 'center',
      }}>
        {items.map((item, i) => {
          const isTop = item.rank === 1;
          const itemEntrance = voxEntrance(frame, 20 + i * 5, undefined, 'up', s(24));

          return (
            <React.Fragment key={i}>
              <div style={{
                opacity: itemOpacities[i] * combinedOpacity,
                transform: `translateY(${itemEntrance.translateY + exit.translateY}px)`,
                display: 'flex',
                alignItems: 'center',
                height: ROW_HEIGHT,
                gap: s(20),
              }}>
                {/* Rank number */}
                <div style={{
                  width: RANK_WIDTH,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  position: 'relative',
                  flexShrink: 0,
                }}>
                  {isTop && (
                    <HighlighterMark
                      widthPercent={widthPercent}
                      height={s(52)}
                      rotation={rotation}
                      color={VOX_COLORS.highlight}
                      opacity={0.9}
                    />
                  )}
                  <span style={{
                    fontFamily: 'Inter',
                    fontSize: s(VOX_SIZES.h2),
                    fontWeight: 700,
                    color: isTop ? VOX_COLORS.charcoal : VOX_COLORS.medGray,
                    position: 'relative',
                    zIndex: 1,
                  }}>
                    {item.rank}
                  </span>
                </div>

                {/* Label */}
                <div style={{ flex: 1 }}>
                  <span style={{
                    fontFamily: 'Inter',
                    fontSize: s(VOX_SIZES.body),
                    fontWeight: isTop ? 600 : 400,
                    color: isTop ? VOX_COLORS.charcoal : VOX_COLORS.darkGray,
                  }}>
                    {item.label}
                  </span>
                </div>

                {/* Value */}
                {item.value && (
                  <span style={{
                    fontFamily: 'Inter',
                    fontSize: s(VOX_SIZES.body),
                    fontWeight: isTop ? 700 : 500,
                    color: isTop ? VOX_COLORS.charcoal : VOX_COLORS.darkGray,
                    flexShrink: 0,
                  }}>
                    {item.value}
                  </span>
                )}
              </div>

              {/* Divider between rows */}
              {i < items.length - 1 && (
                <div style={{ opacity: itemOpacities[i] * combinedOpacity }}>
                  <RoughDivider length={s(960)} thickness={1} color={VOX_COLORS.lightGray} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <FilmGrain opacity={0.25} />
    </AbsoluteFill>
  );
};

export default VoxRanking;
