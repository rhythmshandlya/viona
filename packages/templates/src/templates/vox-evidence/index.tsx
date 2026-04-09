import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxEvidenceProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { VoxHeadline, VoxBody, VoxLabel } from '../../vox/typography';
import { RoughDivider } from '../../vox/decorations';
import { useScale } from '../../use-scale';
import { interpolate } from 'remotion';

const VoxEvidence: React.FC<VoxEvidenceProps> = ({ evidence, interpretation, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  const titleEntrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const evidenceEntrance = voxEntrance(frame, 15, undefined, 'left', s(40));
  const dividerOpacity = interpolate(frame, [28, 38], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const interpretationEntrance = voxEntrance(frame, 38, undefined, 'right', s(40));

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite }}>
      {/* Title */}
      {title && (
        <div style={{
          position: 'absolute',
          top: s(80),
          left: s(60),
          right: s(60),
          opacity: titleEntrance.opacity * exit.opacity,
          transform: `translateY(${titleEntrance.translateY + exit.translateY}px)`,
        }}>
          <VoxHeadline text={title} size={s(VOX_SIZES.h3)} color={VOX_COLORS.charcoal} accentBar="left" />
        </div>
      )}

      {/* Two-panel layout */}
      <div style={{
        position: 'absolute',
        top: title ? s(200) : s(120),
        bottom: s(80),
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
      }}>
        {/* Evidence panel */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: s(60),
          gap: s(24),
          opacity: evidenceEntrance.opacity * exit.opacity,
          transform: `translateX(${evidenceEntrance.translateX}px) translateY(${exit.translateY}px)`,
          backgroundColor: 'rgba(240, 240, 238, 0.6)',
        }}>
          <VoxLabel text={evidence.label} color={VOX_COLORS.darkGray} />
          <div style={{
            fontFamily: VOX_FONTS.body,
            fontSize: s(VOX_SIZES.body),
            color: VOX_COLORS.charcoal,
            lineHeight: 1.5,
            fontWeight: 400,
          }}>
            {evidence.detail}
          </div>
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: dividerOpacity * exit.opacity,
          flexShrink: 0,
        }}>
          <RoughDivider length={s(600)} direction="vertical" color={VOX_COLORS.charcoal} thickness={2} />
        </div>

        {/* Interpretation panel */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: s(60),
          gap: s(24),
          opacity: interpretationEntrance.opacity * exit.opacity,
          transform: `translateX(${interpretationEntrance.translateX}px) translateY(${exit.translateY}px)`,
          backgroundColor: 'rgba(255, 235, 0, 0.08)',
        }}>
          <VoxLabel text={interpretation.label} color={VOX_COLORS.charcoal} />
          <div style={{
            fontFamily: VOX_FONTS.body,
            fontSize: s(VOX_SIZES.body),
            color: VOX_COLORS.charcoal,
            lineHeight: 1.5,
            fontWeight: 600,
          }}>
            {interpretation.detail}
          </div>
          {/* Yellow accent line */}
          <div style={{
            width: s(48),
            height: s(4),
            backgroundColor: VOX_COLORS.highlight,
            borderRadius: s(2),
          }} />
        </div>
      </div>

      <FilmGrain opacity={0.3} />
    </AbsoluteFill>
  );
};

export default VoxEvidence;
