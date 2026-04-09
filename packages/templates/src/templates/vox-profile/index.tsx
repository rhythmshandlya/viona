import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxProfileProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit, highlighterSweep } from '../../vox/animations';
import { FilmGrain, HighlighterMark } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline, VoxBody, VoxLabel } from '../../vox/typography';
import { CutoutFrame } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const VoxProfile: React.FC<VoxProfileProps> = ({ name, title, fact, role }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  const photoEntrance = voxEntrance(frame, 5, undefined, 'up', s(30));
  const nameEntrance = voxEntrance(frame, 12, undefined, 'up', s(24));
  const titleEntrance = voxEntrance(frame, 18, undefined, 'up', s(20));
  const roleEntrance = voxEntrance(frame, 23, undefined, 'up', s(16));
  const factEntrance = voxEntrance(frame, 30, undefined, 'up', s(20));
  const { widthPercent, rotation } = highlighterSweep(frame, 32);

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.35} seed={23} />

      {/* Photo placeholder */}
      <div style={{
        position: 'absolute',
        top: s(100),
        left: s(60),
        right: s(60),
        opacity: photoEntrance.opacity * exit.opacity,
        transform: `translateY(${photoEntrance.translateY + exit.translateY}px)`,
      }}>
        <CutoutFrame width={s(280)} height={s(320)} rotation={1.5} seed={23}>
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: VOX_COLORS.lightGray,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.tiny),
              color: VOX_COLORS.medGray,
              textTransform: 'uppercase' as const,
              letterSpacing: 1,
            }}>
              Photo
            </span>
          </div>
        </CutoutFrame>
      </div>

      {/* Content */}
      <div style={{
        position: 'absolute',
        top: s(460),
        left: s(60),
        right: s(60),
        display: 'flex',
        flexDirection: 'column',
        gap: s(20),
      }}>
        {/* Yellow accent bar + Name */}
        <div style={{
          opacity: nameEntrance.opacity * exit.opacity,
          transform: `translateY(${nameEntrance.translateY + exit.translateY}px)`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: s(16),
        }}>
          <div style={{
            width: s(6),
            height: s(80),
            backgroundColor: VOX_COLORS.highlight,
            borderRadius: s(3),
            flexShrink: 0,
            marginTop: s(4),
          }} />
          <div style={{
            fontFamily: VOX_FONTS.headline,
            fontSize: s(VOX_SIZES.h1),
            fontWeight: 700,
            color: VOX_COLORS.charcoal,
            lineHeight: 1.15,
          }}>
            {name}
          </div>
        </div>

        {/* Title */}
        <div style={{
          opacity: titleEntrance.opacity * exit.opacity,
          transform: `translateY(${titleEntrance.translateY + exit.translateY}px)`,
        }}>
          <VoxLabel text={title} color={VOX_COLORS.charcoal} />
        </div>

        {/* Role */}
        {role && (
          <div style={{
            opacity: roleEntrance.opacity * exit.opacity,
            transform: `translateY(${roleEntrance.translateY + exit.translateY}px)`,
          }}>
            <VoxBody text={role} color={VOX_COLORS.medGray} size={s(VOX_SIZES.body)} />
          </div>
        )}

        {/* Fact with highlighter */}
        {fact && (
          <div style={{
            opacity: factEntrance.opacity * exit.opacity,
            transform: `translateY(${factEntrance.translateY + exit.translateY}px)`,
            marginTop: s(16),
            position: 'relative',
            display: 'inline-block',
          }}>
            <HighlighterMark
              widthPercent={widthPercent}
              height={s(44)}
              rotation={rotation}
              color={VOX_COLORS.highlight}
              opacity={0.85}
            />
            <div style={{
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.body),
              fontWeight: 600,
              color: VOX_COLORS.charcoal,
              position: 'relative',
              zIndex: 1,
            }}>
              {fact}
            </div>
          </div>
        )}
      </div>

      <FilmGrain opacity={0.3} />
    </AbsoluteFill>
  );
};

export default VoxProfile;
