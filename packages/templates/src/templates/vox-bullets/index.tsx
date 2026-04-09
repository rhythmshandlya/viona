import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxBulletsProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { VoxHeadline } from '../../vox/typography';
import { ConstructionPaper } from '../../vox/textures';
import { useScale } from '../../use-scale';

const VoxBullets: React.FC<VoxBulletsProps> = ({ items, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const titleEntrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  const titleOpacity = titleEntrance.opacity * exit.opacity;

  const { itemOpacities } = progressiveBuild(frame, 20, items.length);

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.offWhite,
      padding: s(60),
      paddingTop: s(120),
    }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.35} seed={31} />

      {/* Title */}
      {title && (
        <div style={{
          opacity: titleOpacity,
          transform: `translateY(${titleEntrance.translateY + exit.translateY}px)`,
          marginBottom: s(48),
        }}>
          <VoxHeadline
            text={title}
            size={s(VOX_SIZES.h2)}
            color={VOX_COLORS.charcoal}
            accentBar="left"
            accentColor={VOX_COLORS.highlight}
          />
        </div>
      )}

      {/* Bullet items */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: s(28),
        flex: 1,
        justifyContent: 'center',
      }}>
        {items.map((item, i) => {
          const itemEntrance = voxEntrance(frame, 20 + i * 8, undefined, 'left', s(24));
          const itemOpacity = itemOpacities[i] * exit.opacity;

          // Split first word to bold it
          const firstSpace = item.indexOf(' ');
          const firstWord = firstSpace >= 0 ? item.slice(0, firstSpace) : item;
          const rest = firstSpace >= 0 ? item.slice(firstSpace) : '';

          return (
            <div
              key={i}
              style={{
                opacity: itemOpacity,
                transform: `translateX(${itemEntrance.translateX}px) translateY(${exit.translateY}px)`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: s(24),
              }}
            >
              {/* Yellow dot */}
              <div style={{
                width: s(16),
                height: s(16),
                borderRadius: '50%',
                backgroundColor: VOX_COLORS.highlight,
                flexShrink: 0,
                marginTop: s(10),
              }} />

              {/* Text with bold first word */}
              <div style={{
                fontFamily: VOX_FONTS.body,
                fontSize: s(VOX_SIZES.body),
                color: VOX_COLORS.charcoal,
                lineHeight: 1.5,
                flex: 1,
              }}>
                <span style={{ fontWeight: 600 }}>{firstWord}</span>
                {rest && <span style={{ fontWeight: 400 }}>{rest}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <FilmGrain opacity={0.3} />
    </AbsoluteFill>
  );
};

export default VoxBullets;
