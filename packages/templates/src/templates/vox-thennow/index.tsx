import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxThennowProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { VoxHeadline, VoxBody, VoxLabel } from '../../vox/typography';
import { RoughDivider } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const VoxThennow: React.FC<VoxThennowProps> = ({ then, now }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  // "Then" side enters slightly before "Now"
  const thenEntrance = voxEntrance(frame, 5, undefined, 'left', s(30));
  const nowEntrance = voxEntrance(frame, 12, undefined, 'right', s(30));

  // Divider appears between the two
  const dividerEntrance = voxEntrance(frame, 8, undefined, 'up', s(10));

  const HALF_W = 540;
  const CONTENT_TOP = s(300);

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite }}>
      {/* Then side — left half, slightly dimmed */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: HALF_W,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: s(60),
        opacity: thenEntrance.opacity * exit.opacity * 0.7,
        transform: `translateX(${thenEntrance.translateX}px) translateY(${exit.translateY}px)`,
      }}>
        <VoxLabel text={then.label} color={VOX_COLORS.medGray} />
        <div style={{ marginTop: s(16) }}>
          <div style={{
            fontFamily: VOX_FONTS.body,
            fontSize: s(VOX_SIZES.h2),
            fontWeight: 700,
            color: VOX_COLORS.darkGray,
          }}>
            {then.year}
          </div>
        </div>
        <div style={{ marginTop: s(20) }}>
          <VoxBody
            text={then.detail}
            size={s(VOX_SIZES.body)}
            color={VOX_COLORS.darkGray}
          />
        </div>
      </div>

      {/* Vertical divider */}
      <div style={{
        position: 'absolute',
        left: HALF_W - s(1),
        top: s(200),
        bottom: s(200),
        display: 'flex',
        alignItems: 'center',
        opacity: dividerEntrance.opacity * exit.opacity,
      }}>
        <RoughDivider
          length={1920 - s(400)}
          direction="vertical"
          color={VOX_COLORS.lightGray}
          thickness={2}
        />
      </div>

      {/* Now side — right half, full brightness with yellow accent */}
      <div style={{
        position: 'absolute',
        left: HALF_W,
        top: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: s(60),
        opacity: nowEntrance.opacity * exit.opacity,
        transform: `translateX(${nowEntrance.translateX}px) translateY(${exit.translateY}px)`,
      }}>
        <VoxLabel text={now.label} color={VOX_COLORS.charcoal} />
        <div style={{ marginTop: s(16) }}>
          <div style={{
            fontFamily: VOX_FONTS.body,
            fontSize: s(VOX_SIZES.h2),
            fontWeight: 700,
            color: VOX_COLORS.charcoal,
            backgroundColor: VOX_COLORS.highlight,
            display: 'inline-block',
            padding: `${s(4)}px ${s(12)}px`,
          }}>
            {now.year}
          </div>
        </div>
        <div style={{ marginTop: s(20) }}>
          <VoxBody
            text={now.detail}
            size={s(VOX_SIZES.body)}
            color={VOX_COLORS.charcoal}
          />
        </div>
      </div>

      <FilmGrain opacity={0.25} />
    </AbsoluteFill>
  );
};

export default VoxThennow;
