import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxTreemapProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild } from '../../vox/animations';
import { FilmGrain, RoughEdgeMask } from '../../vox/effects';
import { VoxHeadline } from '../../vox/typography';
import { useScale } from '../../use-scale';

const BLOCK_COLORS = [
  VOX_COLORS.highlight,
  VOX_COLORS.teal,
  VOX_COLORS.lightGray,
  VOX_COLORS.medGray,
  '#8B9E8B',
  VOX_COLORS.darkGray,
];

/**
 * Simple row-based treemap layout:
 * Sort blocks descending, lay them out in rows where each block's
 * width is proportional to its value.
 */
function computeBlockLayouts(
  blocks: { label: string; value: number }[],
  containerW: number,
  containerH: number,
): { x: number; y: number; w: number; h: number }[] {
  const total = blocks.reduce((s, b) => s + b.value, 0);

  // Sort descending
  const sorted = [...blocks].map((b, originalIdx) => ({ ...b, originalIdx }));
  sorted.sort((a, b) => b.value - a.value);

  // Simple two-row layout
  const layouts: { originalIdx: number; x: number; y: number; w: number; h: number }[] = [];
  const ROW_HEIGHT = containerH / 2;
  let x = 0;
  let y = 0;
  let rowTotal = 0;

  // First row: items until we hit 60% of total
  const firstRowItems: typeof sorted = [];
  const secondRowItems: typeof sorted = [];
  let acc = 0;
  for (const b of sorted) {
    if (acc < total * 0.6 || firstRowItems.length === 0) {
      firstRowItems.push(b);
      acc += b.value;
    } else {
      secondRowItems.push(b);
    }
  }

  const row1Total = firstRowItems.reduce((s, b) => s + b.value, 0);
  const row2Total = secondRowItems.reduce((s, b) => s + b.value, 0);

  let cx = 0;
  for (const b of firstRowItems) {
    const w = (b.value / row1Total) * containerW;
    layouts.push({ originalIdx: b.originalIdx, x: cx, y: 0, w, h: ROW_HEIGHT });
    cx += w;
  }

  cx = 0;
  for (const b of secondRowItems) {
    const w = (b.value / (row2Total || 1)) * containerW;
    layouts.push({ originalIdx: b.originalIdx, x: cx, y: ROW_HEIGHT, w, h: ROW_HEIGHT });
    cx += w;
  }

  // Re-order to match original blocks order
  const result: { x: number; y: number; w: number; h: number }[] = new Array(blocks.length);
  for (const l of layouts) {
    result[l.originalIdx] = { x: l.x, y: l.y, w: l.w, h: l.h };
  }
  return result;
}

const VoxTreemap: React.FC<VoxTreemapProps> = ({ blocks, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;

  const { itemOpacities } = progressiveBuild(frame, 20, blocks.length);

  const CONTAINER_LEFT = s(40);
  const CONTAINER_TOP = s(260);
  const CONTAINER_W = 1080 - s(80);
  const CONTAINER_H = s(1100);
  const GAP = s(6);

  const layouts = computeBlockLayouts(blocks, CONTAINER_W, CONTAINER_H);

  const maxValue = Math.max(...blocks.map((b) => b.value));

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite }}>
      {/* Title */}
      <div style={{
        position: 'absolute',
        top: s(80),
        left: s(60),
        right: s(60),
        opacity: combinedOpacity,
        transform: `translateY(${entrance.translateY + exit.translateY}px)`,
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

      {/* Blocks */}
      {blocks.map((block, i) => {
        const layout = layouts[i];
        if (!layout) return null;
        const isLargest = block.value === maxValue;
        const color = isLargest ? VOX_COLORS.highlight : BLOCK_COLORS[(i + 1) % BLOCK_COLORS.length];
        const textColor = isLargest ? VOX_COLORS.charcoal : VOX_COLORS.white;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: CONTAINER_LEFT + layout.x + (i > 0 ? GAP : 0),
              top: CONTAINER_TOP + layout.y + (layout.y > 0 ? GAP : 0),
              width: layout.w - (i > 0 ? GAP : 0),
              height: layout.h - (layout.y > 0 ? GAP : 0),
              opacity: itemOpacities[i] * combinedOpacity,
            }}
          >
            <RoughEdgeMask seed={i * 7 + 11} scale={2}>
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: color,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: s(16),
                boxSizing: 'border-box' as const,
              }}>
                <div style={{
                  fontFamily: VOX_FONTS.body,
                  fontSize: s(Math.max(VOX_SIZES.tiny, Math.min(VOX_SIZES.label, layout.w / 8))),
                  fontWeight: 700,
                  color: textColor,
                  textAlign: 'center' as const,
                  lineHeight: 1.2,
                }}>
                  {block.label}
                </div>
                <div style={{
                  fontFamily: VOX_FONTS.body,
                  fontSize: s(VOX_SIZES.tiny),
                  fontWeight: 400,
                  color: textColor,
                  opacity: 0.8,
                  marginTop: s(4),
                }}>
                  {block.value}%
                </div>
              </div>
            </RoughEdgeMask>
          </div>
        );
      })}

      <FilmGrain opacity={0.2} />
    </AbsoluteFill>
  );
};

export default VoxTreemap;
