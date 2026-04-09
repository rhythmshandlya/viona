import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxFilmstripProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline, VoxLabel } from '../../vox/typography';
import { CutoutFrame } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const VoxFilmstrip: React.FC<VoxFilmstripProps> = ({ frames, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  const titleEntrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const titleOpacity = titleEntrance.opacity * exit.opacity;

  const { itemOpacities } = progressiveBuild(frame, 18, frames.length);

  // Grid: 2 columns
  const cols = 2;
  const FRAME_W = s(460);
  const FRAME_H = s(340);

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.deepPurple }}>
      <ConstructionPaper color={VOX_COLORS.deepPurple} opacity={0.25} seed={77} />

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
          <VoxHeadline text={title} size={s(VOX_SIZES.h3)} color={VOX_COLORS.white} accentBar="left" accentColor={VOX_COLORS.highlight} />
        </div>
      )}

      {/* Filmstrip grid */}
      <div style={{
        position: 'absolute',
        top: title ? s(180) : s(100),
        left: s(40),
        right: s(40),
        bottom: s(60),
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: s(16),
        justifyContent: 'center',
        alignContent: 'center',
      }}>
        {frames.map((filmFrame, i) => {
          const itemEntrance = voxEntrance(frame, 18 + i * 10, undefined, 'up', s(20));

          return (
            <div key={i} style={{
              opacity: itemOpacities[i] * exit.opacity,
              transform: `translateY(${itemEntrance.translateY + exit.translateY}px)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: s(10),
            }}>
              <CutoutFrame width={FRAME_W} height={FRAME_H} rotation={i % 2 === 0 ? 0.5 : -0.5} seed={i * 17 + 33}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: `2px solid rgba(255,255,255,0.15)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box' as const,
                }}>
                  <span style={{
                    fontFamily: VOX_FONTS.body,
                    fontSize: s(VOX_SIZES.label),
                    color: 'rgba(255,255,255,0.4)',
                    fontWeight: 500,
                    textTransform: 'uppercase' as const,
                    letterSpacing: 1,
                  }}>
                    {filmFrame.label}
                  </span>
                </div>
              </CutoutFrame>

              {filmFrame.caption && (
                <div style={{
                  fontFamily: VOX_FONTS.body,
                  fontSize: s(VOX_SIZES.tiny),
                  color: 'rgba(255,255,255,0.6)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: 1.2,
                  fontWeight: 500,
                }}>
                  {filmFrame.caption}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <FilmGrain opacity={0.4} />
    </AbsoluteFill>
  );
};

export default VoxFilmstrip;
