import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxProsConsProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS, sf, voxEaseOut } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle, popIn } from '../../vox/animations';
import { FilmGrain, RoughEdgeMask } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline } from '../../vox/typography';
import { useScale } from '../../use-scale';

const PRO_COLOR = VOX_COLORS.teal;
const CON_COLOR = VOX_COLORS.mutedRed;

const VoxProsCons: React.FC<VoxProsConsProps> = ({ pros, cons, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width: W, height: H } = useVideoConfig();
  const s = useScale();

  const exitStart = durationInFrames - 10;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const titleEntrance = voxEntrance(frame, 5, undefined, 'up', s(15));
  const idle = voxIdle(frame, 55);

  // Layout
  const PAD = s(50);
  const TITLE_H = title ? s(90) : 0;
  const CONTENT_TOP = PAD + TITLE_H + s(20);
  const CONTENT_BOTTOM = H - PAD;
  const CONTENT_H = CONTENT_BOTTOM - CONTENT_TOP;
  const COL_GAP = s(24);
  const COL_W = (W - PAD * 2 - COL_GAP) / 2;

  // Each column: header + items filling remaining space
  const HEADER_H = s(50);
  const ITEMS_TOP = CONTENT_TOP + HEADER_H + s(16);
  const ITEMS_H = CONTENT_BOTTOM - ITEMS_TOP - s(10);
  const maxItems = Math.max(pros.length, cons.length);
  const ITEM_GAP = s(12);
  const ITEM_H = Math.min(s(120), (ITEMS_H - (maxItems - 1) * ITEM_GAP) / maxItems);

  // Animation
  const STAGGER = 8;
  const START = 16;

  const getItemAnim = (col: 'pro' | 'con', idx: number) => {
    const offset = col === 'pro' ? 0 : 4;
    const itemStart = START + idx * STAGGER + offset;
    const opacity = interpolate(frame, [itemStart, itemStart + 10], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    }) * exit.opacity;
    const translateX = interpolate(sf(frame), [itemStart, itemStart + 10],
      [col === 'pro' ? -s(20) : s(20), 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
      });
    return { opacity, translateX };
  };

  const headerReveal = interpolate(frame, [8, 16], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }) * exit.opacity;

  // Divider
  const dividerProgress = interpolate(sf(frame), [10, 28], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
  });

  const renderItem = (text: string, col: 'pro' | 'con', idx: number) => {
    const anim = getItemAnim(col, idx);
    const color = col === 'pro' ? PRO_COLOR : CON_COLOR;
    const icon = col === 'pro' ? '✓' : '✗';
    const iconAnim = popIn(frame, START + idx * STAGGER + (col === 'pro' ? 0 : 4) + 3);

    return (
      <div key={`${col}-${idx}`} style={{
        width: COL_W,
        height: ITEM_H,
        opacity: anim.opacity,
        transform: `translateX(${anim.translateX}px)`,
      }}>
        <RoughEdgeMask seed={idx * 13 + (col === 'pro' ? 3 : 47)} scale={2}>
          <div style={{
            width: COL_W,
            height: ITEM_H,
            backgroundColor: VOX_COLORS.offWhite,
            borderLeft: `${s(5)}px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            gap: s(14),
            padding: `0 ${s(16)}px`,
            boxSizing: 'border-box',
          }}>
            <div style={{
              width: s(32), height: s(32), borderRadius: '50%',
              backgroundColor: color, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: `scale(${iconAnim.scale})`,
              opacity: iconAnim.opacity,
            }}>
              <span style={{ color: VOX_COLORS.offWhite, fontSize: s(18), fontWeight: 700 }}>{icon}</span>
            </div>
            <span style={{
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.body),
              fontWeight: 500,
              color: VOX_COLORS.charcoal,
              lineHeight: 1.3,
            }}>
              {text}
            </span>
          </div>
        </RoughEdgeMask>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite, overflow: 'hidden' }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.25} seed={55} />

      {/* Title */}
      {title && (
        <div style={{
          position: 'absolute', top: PAD, left: PAD, right: PAD,
          opacity: titleEntrance.opacity * exit.opacity,
          transform: `translateY(${titleEntrance.translateY + exit.translateY + idle.translateY}px)`,
        }}>
          <VoxHeadline text={title} size={s(VOX_SIZES.h3)} color={VOX_COLORS.charcoal} accentBar="left" />
        </div>
      )}

      {/* Column headers */}
      <div style={{
        position: 'absolute', top: CONTENT_TOP, left: PAD, width: COL_W,
        opacity: headerReveal,
        display: 'flex', alignItems: 'center', gap: s(10),
      }}>
        <div style={{
          width: s(6), height: HEADER_H * 0.7,
          backgroundColor: PRO_COLOR, borderRadius: s(2),
        }} />
        <span style={{
          fontFamily: VOX_FONTS.body, fontSize: s(VOX_SIZES.label),
          fontWeight: 700, color: PRO_COLOR,
          textTransform: 'uppercase' as const, letterSpacing: s(2),
        }}>
          PROS
        </span>
      </div>

      <div style={{
        position: 'absolute', top: CONTENT_TOP, right: PAD, width: COL_W,
        opacity: headerReveal,
        display: 'flex', alignItems: 'center', gap: s(10),
      }}>
        <div style={{
          width: s(6), height: HEADER_H * 0.7,
          backgroundColor: CON_COLOR, borderRadius: s(2),
        }} />
        <span style={{
          fontFamily: VOX_FONTS.body, fontSize: s(VOX_SIZES.label),
          fontWeight: 700, color: CON_COLOR,
          textTransform: 'uppercase' as const, letterSpacing: s(2),
        }}>
          CONS
        </span>
      </div>

      {/* Center divider */}
      <div style={{
        position: 'absolute',
        top: CONTENT_TOP,
        left: W / 2 - s(1),
        width: s(2),
        height: CONTENT_H * dividerProgress,
        backgroundColor: VOX_COLORS.lightGray,
        opacity: 0.3 * exit.opacity,
      }} />

      {/* Pro items — left column */}
      <div style={{
        position: 'absolute',
        top: ITEMS_TOP,
        left: PAD,
        width: COL_W,
        display: 'flex',
        flexDirection: 'column',
        gap: ITEM_GAP,
      }}>
        {pros.map((item, i) => renderItem(item, 'pro', i))}
      </div>

      {/* Con items — right column */}
      <div style={{
        position: 'absolute',
        top: ITEMS_TOP,
        right: PAD,
        width: COL_W,
        display: 'flex',
        flexDirection: 'column',
        gap: ITEM_GAP,
      }}>
        {cons.map((item, i) => renderItem(item, 'con', i))}
      </div>

      <FilmGrain opacity={0.25} />
    </AbsoluteFill>
  );
};

export default VoxProsCons;
