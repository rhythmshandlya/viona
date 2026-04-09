import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxLinechartProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS, sf, voxEaseOut } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxLinechart: React.FC<VoxLinechartProps> = ({ points, title, annotation, yUnit }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width: canvasW, height: canvasH } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;
  const idle = voxIdle(frame, 55);

  // Progressive draw from frame 20 to 80
  const drawProgress = interpolate(sf(frame), [20, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });

  // Annotation appears after line finishes
  const annotationOpacity = interpolate(frame, [85, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) * combinedOpacity;

  // Responsive chart dimensions — adapt to any canvas size
  const PADDING = s(60);
  const Y_LABEL_W = s(50);
  const TITLE_H = title ? s(120) : s(40);
  const X_LABEL_H = s(50);

  const CHART_LEFT = PADDING + Y_LABEL_W;
  const CHART_TOP = TITLE_H + s(40);
  const CHART_RIGHT = canvasW - PADDING;
  const CHART_BOTTOM = canvasH - PADDING - X_LABEL_H;
  const CHART_WIDTH = CHART_RIGHT - CHART_LEFT;
  const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP;

  // Data range
  const minY = 0;
  const maxY = Math.max(...points.map((p) => p.y)) * 1.15;

  // Map data to chart coordinates
  const chartPoints = points.map((p, i) => ({
    x: CHART_LEFT + (i / Math.max(points.length - 1, 1)) * CHART_WIDTH,
    y: CHART_TOP + CHART_HEIGHT - ((p.y - minY) / (maxY - minY)) * CHART_HEIGHT,
    label: p.x,
    value: p.y,
  }));

  // SVG paths
  const polylinePoints = chartPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath = [
    `M ${chartPoints[0].x} ${CHART_BOTTOM}`,
    ...chartPoints.map((p) => `L ${p.x} ${p.y}`),
    `L ${chartPoints[chartPoints.length - 1].x} ${CHART_BOTTOM}`,
    'Z',
  ].join(' ');

  // Clip width for progressive reveal
  const visibleWidth = CHART_LEFT + drawProgress * CHART_WIDTH;
  const clipId = 'vox-line-reveal';

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite, overflow: 'hidden' }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.25} seed={33} />

      {/* Title */}
      {title && (
        <div style={{
          position: 'absolute',
          top: s(60),
          left: PADDING,
          right: PADDING,
          opacity: combinedOpacity,
          transform: `translateY(${entrance.translateY + exit.translateY + idle.translateY}px)`,
        }}>
          <VoxHeadline
            text={title}
            size={s(VOX_SIZES.h3)}
            color={VOX_COLORS.charcoal}
            accentBar="left"
          />
        </div>
      )}

      {/* SVG Chart */}
      <svg
        width={canvasW}
        height={canvasH}
        style={{ position: 'absolute', inset: 0, opacity: combinedOpacity }}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={visibleWidth} height={canvasH} />
          </clipPath>
        </defs>

        {/* Horizontal grid lines + Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = CHART_TOP + frac * CHART_HEIGHT;
          const val = Math.round(maxY * (1 - frac));
          return (
            <g key={frac}>
              <line
                x1={CHART_LEFT}
                y1={y}
                x2={CHART_RIGHT}
                y2={y}
                stroke={VOX_COLORS.lightGray}
                strokeWidth={1}
                opacity={0.4}
              />
              <text
                x={CHART_LEFT - s(10)}
                y={y + s(5)}
                textAnchor="end"
                fontFamily={VOX_FONTS.body}
                fontSize={s(VOX_SIZES.tiny)}
                fill={VOX_COLORS.medGray}
              >
                {val}{yUnit}
              </text>
            </g>
          );
        })}

        {/* Shaded area below line */}
        <path
          d={areaPath}
          fill={VOX_COLORS.teal}
          opacity={0.12}
          clipPath={`url(#${clipId})`}
        />

        {/* Main line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={VOX_COLORS.teal}
          strokeWidth={s(4)}
          strokeLinejoin="round"
          strokeLinecap="round"
          clipPath={`url(#${clipId})`}
        />

        {/* X-axis labels */}
        {chartPoints.map((p, i) => {
          // Show every label if <=6 points, otherwise show every other
          const showLabel = points.length <= 6 || i % 2 === 0 || i === points.length - 1;
          if (!showLabel) return null;
          return (
            <text
              key={i}
              x={p.x}
              y={CHART_BOTTOM + s(30)}
              textAnchor="middle"
              fontFamily={VOX_FONTS.body}
              fontSize={s(VOX_SIZES.tiny)}
              fill={VOX_COLORS.medGray}
            >
              {p.label}
            </text>
          );
        })}

        {/* Data point dots — appear as line passes */}
        {chartPoints.map((p, i) => {
          const pointProgress = drawProgress * (points.length - 1);
          const pointReveal = interpolate(pointProgress, [i - 0.3, i + 0.2], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const isLast = i === chartPoints.length - 1;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={s(isLast ? 8 : 5)}
              fill={isLast ? VOX_COLORS.highlight : VOX_COLORS.teal}
              opacity={pointReveal}
            />
          );
        })}
      </svg>

      {/* Annotation callout */}
      {annotation && (
        <div style={{
          position: 'absolute',
          right: PADDING + s(10),
          top: CHART_TOP + s(10),
          opacity: annotationOpacity,
          maxWidth: s(220),
          backgroundColor: VOX_COLORS.highlight,
          padding: `${s(6)}px ${s(10)}px`,
          borderRadius: s(2),
        }}>
          <span style={{
            fontFamily: VOX_FONTS.body,
            fontSize: s(VOX_SIZES.tiny),
            fontWeight: 600,
            color: VOX_COLORS.charcoal,
          }}>
            {annotation}
          </span>
        </div>
      )}

      <FilmGrain opacity={0.2} />
    </AbsoluteFill>
  );
};

export default VoxLinechart;
