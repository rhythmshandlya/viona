import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxSourceProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit, highlighterSweep } from '../../vox/animations';
import { FilmGrain, HighlighterMark } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline, VoxBody, VoxSourceBadge } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxSource: React.FC<VoxSourceProps> = ({ title, excerpt, source, year }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  const cardEntrance = voxEntrance(frame, 8, undefined, 'up', s(40));
  const titleEntrance = voxEntrance(frame, 16, undefined, 'up', s(20));
  const excerptEntrance = voxEntrance(frame, 22, undefined, 'up', s(16));
  const { widthPercent, rotation } = highlighterSweep(frame, 30);
  const badgeEntrance = voxEntrance(frame, 38, undefined, 'up', s(12));

  const cardOpacity = cardEntrance.opacity * exit.opacity;

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.offWhite,
      justifyContent: 'center',
      alignItems: 'center',
      padding: s(60),
    }}>
      {/* Document card */}
      <div style={{
        position: 'relative',
        width: '100%',
        opacity: cardOpacity,
        transform: `translateY(${cardEntrance.translateY + exit.translateY}px) rotate(1deg)`,
      }}>
        <ConstructionPaper color='#EDE9E0' opacity={0.5} seed={31} />

        <div style={{
          backgroundColor: '#EDE9E0',
          padding: s(60),
          borderRadius: s(4),
          display: 'flex',
          flexDirection: 'column',
          gap: s(32),
          position: 'relative',
        }}>
          {/* Document title */}
          <div style={{
            opacity: titleEntrance.opacity,
            transform: `translateY(${titleEntrance.translateY}px)`,
          }}>
            <VoxHeadline
              text={title}
              size={s(VOX_SIZES.h2)}
              color={VOX_COLORS.charcoal}
              accentBar="underline"
              accentColor={VOX_COLORS.charcoal}
            />
          </div>

          {/* Excerpt with highlighter */}
          <div style={{
            opacity: excerptEntrance.opacity,
            transform: `translateY(${excerptEntrance.translateY}px)`,
            position: 'relative',
          }}>
            <HighlighterMark
              widthPercent={widthPercent}
              height={s(44)}
              rotation={rotation}
              color={VOX_COLORS.highlight}
              opacity={0.8}
            />
            <div style={{
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.body),
              fontWeight: 400,
              color: VOX_COLORS.charcoal,
              lineHeight: 1.6,
              fontStyle: 'italic',
              position: 'relative',
              zIndex: 1,
            }}>
              &ldquo;{excerpt}&rdquo;
            </div>
          </div>

          {/* Source badge */}
          <div style={{
            opacity: badgeEntrance.opacity,
            transform: `translateY(${badgeEntrance.translateY}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: s(12),
          }}>
            <div style={{
              width: s(32),
              height: s(2),
              backgroundColor: VOX_COLORS.charcoal,
            }} />
            <div style={{
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.tiny),
              color: VOX_COLORS.darkGray,
              textTransform: 'uppercase' as const,
              letterSpacing: 1.5,
              fontWeight: 600,
            }}>
              {source}{year ? `, ${year}` : ''}
            </div>
          </div>
        </div>
      </div>

      <FilmGrain opacity={0.3} />
    </AbsoluteFill>
  );
};

export default VoxSource;
