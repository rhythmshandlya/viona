import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxBeforeAfterProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit, drawOn } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline, VoxBody, VoxLabel } from '../../vox/typography';
import { RoughDivider } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const VoxBeforeAfter: React.FC<VoxBeforeAfterProps> = ({ before, after, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  // Title entrance
  const titleEntrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const titleOpacity = titleEntrance.opacity * exit.opacity;

  // Before enters first from left
  const beforeEntrance = voxEntrance(frame, 12, undefined, 'left', s(40));
  // Divider draws on after before panel
  const { progress: dividerProgress } = drawOn(frame, 22, 10);
  // After enters once divider is partially drawn
  const afterEntrance = voxEntrance(frame, 28, undefined, 'right', s(40));

  const PANEL_HEIGHT = s(600);

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.35} seed={33} />

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

      {/* Split layout */}
      <div style={{
        position: 'absolute',
        top: title ? s(220) : s(100),
        bottom: s(100),
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        {/* Before panel */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: s(48),
          gap: s(20),
          opacity: beforeEntrance.opacity * exit.opacity,
          transform: `translateX(${beforeEntrance.translateX}px) translateY(${exit.translateY}px)`,
        }}>
          {/* Year label */}
          {before.year && (
            <div style={{
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.tiny),
              fontWeight: 600,
              color: VOX_COLORS.medGray,
              textTransform: 'uppercase' as const,
              letterSpacing: 2,
              border: `1px solid ${VOX_COLORS.lightGray}`,
              padding: `${s(4)}px ${s(12)}px`,
            }}>
              {before.year}
            </div>
          )}
          <VoxLabel text={before.label} color={VOX_COLORS.darkGray} />
          <div style={{ textAlign: 'center' as const }}>
            <VoxBody
              text={before.description}
              size={s(VOX_SIZES.body)}
              color={VOX_COLORS.darkGray}
            />
          </div>
        </div>

        {/* Vertical divider */}
        <div style={{
          flexShrink: 0,
          opacity: dividerProgress,
          overflow: 'hidden',
          height: PANEL_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <RoughDivider length={PANEL_HEIGHT} direction="vertical" color={VOX_COLORS.charcoal} thickness={2} />
        </div>

        {/* After panel */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: s(48),
          gap: s(20),
          opacity: afterEntrance.opacity * exit.opacity,
          transform: `translateX(${afterEntrance.translateX}px) translateY(${exit.translateY}px)`,
        }}>
          {after.year && (
            <div style={{
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.tiny),
              fontWeight: 600,
              color: VOX_COLORS.charcoal,
              textTransform: 'uppercase' as const,
              letterSpacing: 2,
              border: `1px solid ${VOX_COLORS.charcoal}`,
              padding: `${s(4)}px ${s(12)}px`,
            }}>
              {after.year}
            </div>
          )}
          <VoxLabel text={after.label} color={VOX_COLORS.charcoal} />
          <div style={{ textAlign: 'center' as const }}>
            <VoxBody
              text={after.description}
              size={s(VOX_SIZES.body)}
              color={VOX_COLORS.charcoal}
            />
          </div>
        </div>
      </div>

      <FilmGrain opacity={0.3} />
    </AbsoluteFill>
  );
};

export default VoxBeforeAfter;
