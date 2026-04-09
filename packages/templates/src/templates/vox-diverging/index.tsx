import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxDivergingProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS, sf, voxEaseOut } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxDiverging: React.FC<VoxDivergingProps> = ({ lineA, lineB, divergePoint, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width: W, height: H } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;
  const idle = voxIdle(frame, 77);

  // Progressive draw
  const drawProgress = interpolate(sf(frame), [20, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });

  const markerOpacity = interpolate(frame, [65, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) * combinedOpacity;

  const labelOpacity = interpolate(frame, [100, 115], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) * combinedOpacity;

  // Layout using real canvas dimensions
  const PAD = s(60);
  const TITLE_H = title ? s(100) : s(20);
  const LEGEND_H = s(60);
  const HEADER_H = PAD + TITLE_H + LEGEND_H;

  const CHART_LEFT = PAD;
  const CHART_RIGHT = W - PAD;
  const CHART_WIDTH = CHART_RIGHT - CHART_LEFT;
  const CHART_TOP = HEADER_H + s(20);
  const CHART_BOTTOM = H - PAD - s(20);
  const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP;
  const CHART_MID_Y = CHART_TOP + CHART_HEIGHT / 2;

  // Draw endpoint
  const endX = CHART_LEFT + CHART_WIDTH * drawProgress;

  // Diverge at 40%
  const divergeX = CHART_LEFT + CHART_WIDTH * 0.4;

  // Line A: flat → curves up
  function lineAY(x: number): number {
    if (x <= divergeX) return CHART_MID_Y;
    const t = (x - divergeX) / (CHART_RIGHT - divergeX);
    return CHART_MID_Y - t * t * (CHART_HEIGHT * 0.38);
  }

  // Line B: flat → drifts down
  function lineBY(x: number): number {
    if (x <= divergeX) return CHART_MID_Y;
    const t = (x - divergeX) / (CHART_RIGHT - divergeX);
    return CHART_MID_Y + t * t * (CHART_HEIGHT * 0.22);
  }

  // SVG paths
  const STEPS = 50;
  const buildPath = (yFn: (x: number) => number): string => {
    const pts: string[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const x = CHART_LEFT + (endX - CHART_LEFT) * (i / STEPS);
      pts.push(i === 0 ? `M ${x} ${yFn(x)}` : `L ${x} ${yFn(x)}`);
    }
    return pts.join(' ');
  };

  const pathA = buildPath(lineAY);
  const pathB = buildPath(lineBY);

  const shadedPath = (() => {
    const topPts: string[] = [];
    const botPts: string[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const x = CHART_LEFT + (endX - CHART_LEFT) * (i / STEPS);
      topPts.push(`${x} ${lineAY(x)}`);
      botPts.unshift(`${x} ${lineBY(x)}`);
    }
    return `M ${topPts.join(' L ')} L ${botPts.join(' L ')} Z`;
  })();

  const endAY = lineAY(CHART_RIGHT);
  const endBY = lineBY(CHART_RIGHT);

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite, overflow: 'hidden' }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.3} seed={19} />

      {/* Title */}
      {title && (
        <div style={{
          position: 'absolute',
          top: PAD,
          left: PAD,
          right: PAD,
          opacity: combinedOpacity,
          transform: `translateY(${entrance.translateY + exit.translateY + idle.translateY}px)`,
        }}>
          <VoxHeadline text={title} size={s(VOX_SIZES.h3)} color={VOX_COLORS.charcoal} accentBar="left" />
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute',
        top: PAD + TITLE_H,
        left: PAD,
        right: PAD,
        display: 'flex',
        gap: s(30),
        opacity: combinedOpacity,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: s(8) }}>
          <div style={{ width: s(20), height: s(4), backgroundColor: VOX_COLORS.teal, borderRadius: 2 }} />
          <span style={{ fontFamily: VOX_FONTS.body, fontSize: s(VOX_SIZES.tiny), color: VOX_COLORS.teal, fontWeight: 600 }}>
            {lineA.label}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: s(8) }}>
          <div style={{ width: s(20), height: s(4), backgroundColor: VOX_COLORS.highlight, borderRadius: 2 }} />
          <span style={{ fontFamily: VOX_FONTS.body, fontSize: s(VOX_SIZES.tiny), color: VOX_COLORS.charcoal, fontWeight: 600 }}>
            {lineB.label}
          </span>
        </div>
      </div>

      {/* SVG chart — viewBox = actual canvas */}
      <svg
        style={{ position: 'absolute', inset: 0 }}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
      >
        {/* Shaded area */}
        <path d={shadedPath} fill={VOX_COLORS.teal} opacity={0.1} />

        {/* Line A — teal */}
        <path d={pathA} fill="none" stroke={VOX_COLORS.teal} strokeWidth={s(4)} strokeLinecap="round" strokeLinejoin="round" />

        {/* Line B — highlight */}
        <path d={pathB} fill="none" stroke={VOX_COLORS.highlight} strokeWidth={s(4)} strokeLinecap="round" strokeLinejoin="round" />

        {/* Diverge marker */}
        {divergePoint && (
          <g opacity={markerOpacity}>
            <line
              x1={divergeX} y1={CHART_TOP + s(10)}
              x2={divergeX} y2={CHART_BOTTOM - s(10)}
              stroke={VOX_COLORS.charcoal} strokeWidth={s(1.5)}
              strokeDasharray={`${s(8)} ${s(6)}`} opacity={0.4}
            />
            <text
              x={divergeX} y={CHART_TOP - s(6)}
              fontFamily={VOX_FONTS.body} fontSize={s(VOX_SIZES.tiny)}
              fill={VOX_COLORS.charcoal} fontWeight={600} textAnchor="middle"
            >
              {divergePoint}
            </text>
          </g>
        )}

        {/* End labels at line endpoints */}
        <text
          x={CHART_RIGHT - s(8)} y={endAY - s(10)}
          fontFamily={VOX_FONTS.body} fontSize={s(VOX_SIZES.tiny)}
          fontWeight={600} fill={VOX_COLORS.teal} opacity={labelOpacity} textAnchor="end"
        >
          {lineA.label}
        </text>
        <text
          x={CHART_RIGHT - s(8)} y={endBY + s(22)}
          fontFamily={VOX_FONTS.body} fontSize={s(VOX_SIZES.tiny)}
          fontWeight={600} fill={VOX_COLORS.charcoal} opacity={labelOpacity} textAnchor="end"
        >
          {lineB.label}
        </text>
      </svg>

      <FilmGrain opacity={0.2} />
    </AbsoluteFill>
  );
};

export default VoxDiverging;
