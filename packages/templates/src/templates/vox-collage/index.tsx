import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxCollageProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle, progressiveBuild } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline, VoxLabel } from '../../vox/typography';
import { CutoutFrame } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const ROTATIONS = [2, -1.5, 2.5, -2];
const SEEDS = [42, 71, 13, 88];

const VoxCollage: React.FC<VoxCollageProps> = ({ items, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  const titleEntrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const titleOpacity = titleEntrance.opacity * exit.opacity;

  const { itemOpacities } = progressiveBuild(frame, 18, items.length);

  // Grid layout — 2 columns
  const cols = 2;
  const FRAME_W = s(440);
  const FRAME_H = s(380);
  const GAP = s(20);

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.4} seed={5} />

      {/* Title */}
      {title && (
        <div style={{
          position: 'absolute',
          top: s(80),
          left: s(60),
          right: s(60),
          opacity: titleOpacity,
          transform: `translateY(${titleEntrance.translateY + exit.translateY}px)`,
        }}>
          <VoxHeadline text={title} size={s(VOX_SIZES.h3)} color={VOX_COLORS.charcoal} accentBar="left" />
        </div>
      )}

      {/* Collage grid */}
      <div style={{
        position: 'absolute',
        top: title ? s(180) : s(120),
        left: 0,
        right: 0,
        bottom: s(80),
        display: 'flex',
        flexWrap: 'wrap',
        gap: GAP,
        justifyContent: 'center',
        alignContent: 'center',
        padding: s(40),
      }}>
        {items.map((item, i) => {
          const rotation = ROTATIONS[i % ROTATIONS.length];
          const seed = SEEDS[i % SEEDS.length];
          const idle = voxIdle(frame, seed * 3 + i * 17);
          const itemEntrance = voxEntrance(frame, 18 + i * 8, undefined, i % 2 === 0 ? 'left' : 'right', s(30));

          return (
            <div
              key={i}
              style={{
                opacity: itemOpacities[i] * exit.opacity,
                transform: `translateX(${itemEntrance.translateX}px) translateY(${itemEntrance.translateY + exit.translateY + idle.translateY}px)`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: s(12),
              }}
            >
              <CutoutFrame width={FRAME_W} height={FRAME_H} rotation={rotation} seed={seed}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: VOX_COLORS.lightGray,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{
                    fontFamily: 'Inter',
                    fontSize: s(VOX_SIZES.label),
                    color: VOX_COLORS.medGray,
                    fontWeight: 500,
                    textTransform: 'uppercase' as const,
                    letterSpacing: 1,
                  }}>
                    {item.label}
                  </span>
                </div>
              </CutoutFrame>

              {item.description && (
                <div style={{
                  fontFamily: 'Inter',
                  fontSize: s(VOX_SIZES.tiny),
                  color: VOX_COLORS.darkGray,
                  textTransform: 'uppercase' as const,
                  letterSpacing: 1.2,
                  fontWeight: 500,
                }}>
                  {item.description}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <FilmGrain opacity={0.3} />
    </AbsoluteFill>
  );
};

export default VoxCollage;
