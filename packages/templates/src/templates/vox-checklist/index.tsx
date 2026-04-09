import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxChecklistProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild, popIn } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { VoxHeadline, VoxBody } from '../../vox/typography';
import { RoughDivider } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const VoxChecklist: React.FC<VoxChecklistProps> = ({ items, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;

  const { itemOpacities } = progressiveBuild(frame, 20, items.length);

  const ROW_HEIGHT = s(110);
  const MARK_SIZE = s(52);
  const LIST_TOP = s(280);

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.offWhite,
      padding: s(60),
      paddingTop: s(80),
    }}>
      {/* Title */}
      <div style={{
        opacity: combinedOpacity,
        transform: `translateY(${entrance.translateY + exit.translateY}px)`,
        marginBottom: s(48),
      }}>
        {title && (
          <VoxHeadline
            text={title}
            size={s(VOX_SIZES.h3)}
            color={VOX_COLORS.charcoal}
            accentBar="left"
          />
        )}
      </div>

      {/* Items */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}>
        {items.map((item, i) => {
          const mark = popIn(frame, 20 + i * 5);

          return (
            <React.Fragment key={i}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                height: ROW_HEIGHT,
                gap: s(24),
                opacity: itemOpacities[i] * combinedOpacity,
              }}>
                {/* Mark symbol */}
                <div style={{
                  width: MARK_SIZE,
                  height: MARK_SIZE,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transform: `scale(${mark.scale})`,
                  opacity: mark.opacity,
                }}>
                  <span style={{
                    fontFamily: 'Inter',
                    fontSize: s(VOX_SIZES.h2),
                    fontWeight: 700,
                    color: item.checked ? VOX_COLORS.teal : VOX_COLORS.mutedRed,
                    lineHeight: 1,
                  }}>
                    {item.checked ? '✓' : '✗'}
                  </span>
                </div>

                {/* Text */}
                <div style={{ flex: 1 }}>
                  <VoxBody
                    text={item.text}
                    size={s(VOX_SIZES.body)}
                    color={VOX_COLORS.charcoal}
                  />
                </div>
              </div>

              {/* Divider */}
              {i < items.length - 1 && (
                <div style={{ opacity: itemOpacities[i] * combinedOpacity }}>
                  <RoughDivider length={s(960)} thickness={1} color={VOX_COLORS.lightGray} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <FilmGrain opacity={0.25} />
    </AbsoluteFill>
  );
};

export default VoxChecklist;
