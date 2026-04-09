import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxAlertProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { useScale } from '../../use-scale';

const severityColor = (severity: VoxAlertProps['severity']): string => {
  if (severity === 'info') return VOX_COLORS.teal;
  if (severity === 'critical') return VOX_COLORS.mutedRed;
  return VOX_COLORS.highlight;
};

const VoxAlert: React.FC<VoxAlertProps> = ({ text, severity }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const barColor = severityColor(severity);

  const barEntrance = voxEntrance(frame, 0, undefined, 'left', s(40));
  const textEntrance = voxEntrance(frame, 6, undefined, 'left', s(20));

  const exitStart = durationInFrames - 12;
  const barExit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const textExit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  const barOpacity = barEntrance.opacity * barExit.opacity;
  const textOpacity = textEntrance.opacity * textExit.opacity;

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.deepPurple, justifyContent: 'center', alignItems: 'center' }}>
      {/* Alert bar */}
      <div style={{
        opacity: barOpacity,
        transform: `translateX(${barEntrance.translateX}px) translateY(${barExit.translateY}px)`,
        width: '100%',
        backgroundColor: barColor,
        paddingTop: s(36),
        paddingBottom: s(36),
        paddingLeft: s(60),
        paddingRight: s(60),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          opacity: textOpacity,
          transform: `translateX(${textEntrance.translateX}px)`,
          fontFamily: VOX_FONTS.body,
          fontSize: s(VOX_SIZES.h3),
          fontWeight: 700,
          color: severity === 'warning' ? VOX_COLORS.charcoal : VOX_COLORS.white,
          textAlign: 'center' as const,
          lineHeight: 1.25,
          maxWidth: s(900),
        }}>
          {text}
        </div>
      </div>
      <FilmGrain opacity={0.4} />
    </AbsoluteFill>
  );
};

export default VoxAlert;
