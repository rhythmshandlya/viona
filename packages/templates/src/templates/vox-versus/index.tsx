import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxVersusProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit, highlighterSweep } from '../../vox/animations';
import { FilmGrain, HighlighterMark } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline, VoxLabel } from '../../vox/typography';
import { RoughDivider } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const VoxVersus: React.FC<VoxVersusProps> = ({ sideA, sideB, winner, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  // Title entrance
  const titleEntrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const titleOpacity = titleEntrance.opacity * exit.opacity;

  // Side A enters from left, Side B from right (staggered by 6 frames)
  const sideAEntrance = voxEntrance(frame, 15, undefined, 'left', s(40));
  const sideBEntrance = voxEntrance(frame, 21, undefined, 'right', s(40));

  // Divider draws on between the two entrances
  const dividerProgress = frame >= 18 ? Math.min(1, (frame - 18) / 10) : 0;

  // Highlighter sweep for winner
  const { widthPercent, rotation } = highlighterSweep(frame, 30);

  const isAWinner = winner === 'a';
  const isBWinner = winner === 'b';

  const HALF_HEIGHT = s(680);
  const COLUMN_WIDTH = s(480);

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.35} seed={17} />

      {/* Title */}
      {title && (
        <div style={{
          position: 'absolute',
          top: s(100),
          left: s(60),
          right: s(60),
          opacity: titleOpacity,
          transform: `translateY(${titleEntrance.translateY + exit.translateY}px)`,
        }}>
          <VoxHeadline
            text={title}
            size={s(VOX_SIZES.h3)}
            color={VOX_COLORS.charcoal}
            accentBar="left"
          />
        </div>
      )}

      {/* Sides container */}
      <div style={{
        position: 'absolute',
        top: title ? s(220) : s(100),
        bottom: s(100),
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
      }}>
        {/* Side A */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: s(48),
          opacity: sideAEntrance.opacity * exit.opacity,
          transform: `translateX(${sideAEntrance.translateX}px) translateY(${exit.translateY}px)`,
        }}>
          <VoxLabel text={sideA.label} color={VOX_COLORS.darkGray} />
          <div style={{ marginTop: s(24), position: 'relative' }}>
            {isAWinner && (
              <HighlighterMark
                widthPercent={widthPercent}
                height={s(64)}
                rotation={rotation}
                color={VOX_COLORS.highlight}
                opacity={0.9}
              />
            )}
            <span style={{
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.h1),
              fontWeight: 700,
              color: isAWinner ? VOX_COLORS.charcoal : VOX_COLORS.darkGray,
              position: 'relative',
              zIndex: 1,
            }}>
              {sideA.value}
            </span>
          </div>
          {sideA.detail && (
            <div style={{
              marginTop: s(12),
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.tiny),
              color: VOX_COLORS.medGray,
              textAlign: 'center' as const,
              textTransform: 'uppercase' as const,
              letterSpacing: 1,
            }}>
              {sideA.detail}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: s(12),
          opacity: dividerProgress,
          flexShrink: 0,
        }}>
          <RoughDivider length={HALF_HEIGHT} direction="vertical" color={VOX_COLORS.charcoal} thickness={2} />
          <div style={{
            fontFamily: VOX_FONTS.headline,
            fontSize: s(VOX_SIZES.label),
            fontWeight: 700,
            color: VOX_COLORS.charcoal,
            letterSpacing: 2,
          }}>
            VS
          </div>
          <RoughDivider length={HALF_HEIGHT} direction="vertical" color={VOX_COLORS.charcoal} thickness={2} />
        </div>

        {/* Side B */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: s(48),
          opacity: sideBEntrance.opacity * exit.opacity,
          transform: `translateX(${sideBEntrance.translateX}px) translateY(${exit.translateY}px)`,
        }}>
          <VoxLabel text={sideB.label} color={VOX_COLORS.darkGray} />
          <div style={{ marginTop: s(24), position: 'relative' }}>
            {isBWinner && (
              <HighlighterMark
                widthPercent={widthPercent}
                height={s(64)}
                rotation={rotation}
                color={VOX_COLORS.highlight}
                opacity={0.9}
              />
            )}
            <span style={{
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.h1),
              fontWeight: 700,
              color: isBWinner ? VOX_COLORS.charcoal : VOX_COLORS.darkGray,
              position: 'relative',
              zIndex: 1,
            }}>
              {sideB.value}
            </span>
          </div>
          {sideB.detail && (
            <div style={{
              marginTop: s(12),
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.tiny),
              color: VOX_COLORS.medGray,
              textAlign: 'center' as const,
              textTransform: 'uppercase' as const,
              letterSpacing: 1,
            }}>
              {sideB.detail}
            </div>
          )}
        </div>
      </div>

      <FilmGrain opacity={0.3} />
    </AbsoluteFill>
  );
};

export default VoxVersus;
