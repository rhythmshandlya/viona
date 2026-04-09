import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxAreachartProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS, sf, voxEaseOut } from '../../vox/constants';
import { voxEntrance, voxExit } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { VoxHeadline, VoxBody, VoxLabel } from '../../vox/typography';
import { useScale } from '../../use-scale';

// Colors for each layer
const LAYER_COLORS = [
  VOX_COLORS.teal,
  VOX_COLORS.highlight,
  VOX_COLORS.lightGray,
  VOX_COLORS.medGray,
];

const VoxAreachart: React.FC<VoxAreachartProps> = ({ layers, title, xLabel }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;

  // Chart fills up from bottom — each layer reveals left-to-right
  const drawProgress = interpolate(sf(frame), [20, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });

  const CHART_LEFT = 80;
  const CHART_TOP = 350;
  const CHART_WIDTH = 820;
  const CHART_HEIGHT = 900;
  const CHART_BOTTOM = CHART_TOP + CHART_HEIGHT;

  // Each layer occupies an equal portion of the height
  const layerHeight = CHART_HEIGHT / layers.length;

  // Build stacked area paths for each layer
  const visibleWidth = CHART_LEFT + drawProgress * CHART_WIDTH;

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

      {/* SVG chart */}
      <svg
        style={{ position: 'absolute', inset: 0 }}
        width="100%"
        height="100%"
        viewBox="0 0 1080 1920"
        preserveAspectRatio="none"
        opacity={combinedOpacity}
      >
        <defs>
          <clipPath id="area-reveal">
            <rect x={0} y={0} width={visibleWidth} height={1920} />
          </clipPath>
        </defs>

        {/* Stacked filled areas — each layer sits atop the previous */}
        {layers.map((layer, i) => {
          const color = layer.color ?? LAYER_COLORS[i % LAYER_COLORS.length];
          const topY = CHART_TOP + i * layerHeight;
          const bottomY = topY + layerHeight;

          // Gentle wave shape for each layer using a quad bezier
          const midX = CHART_LEFT + CHART_WIDTH / 2;
          const waveMid = topY + layerHeight * 0.3 * (i % 2 === 0 ? 1 : -1) * 0.5;

          const areaPath = [
            `M ${CHART_LEFT} ${bottomY}`,
            `L ${CHART_LEFT} ${topY}`,
            `Q ${midX} ${waveMid} ${CHART_LEFT + CHART_WIDTH} ${topY}`,
            `L ${CHART_LEFT + CHART_WIDTH} ${bottomY}`,
            'Z',
          ].join(' ');

          return (
            <path
              key={i}
              d={areaPath}
              fill={color}
              opacity={0.85}
              clipPath="url(#area-reveal)"
            />
          );
        })}

        {/* Axis baseline */}
        <line
          x1={CHART_LEFT}
          y1={CHART_BOTTOM}
          x2={CHART_LEFT + CHART_WIDTH}
          y2={CHART_BOTTOM}
          stroke={VOX_COLORS.charcoal}
          strokeWidth={2}
          opacity={combinedOpacity}
        />
      </svg>

      {/* Legend labels — right side */}
      <div style={{
        position: 'absolute',
        right: s(40),
        top: CHART_TOP,
        display: 'flex',
        flexDirection: 'column',
        gap: layerHeight / layers.length,
        opacity: combinedOpacity,
      }}>
        {layers.map((layer, i) => {
          const color = layer.color ?? LAYER_COLORS[i % LAYER_COLORS.length];
          const labelOpacity = interpolate(sf(frame), [20 + i * 15, 35 + i * 15], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }) * exit.opacity;
          return (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: s(10),
              marginTop: i > 0 ? layerHeight - s(36) : 0,
              opacity: labelOpacity,
            }}>
              <div style={{
                width: s(16),
                height: s(16),
                borderRadius: '50%',
                backgroundColor: color,
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: VOX_FONTS.body,
                fontSize: s(VOX_SIZES.label),
                fontWeight: 500,
                color: VOX_COLORS.charcoal,
              }}>
                {layer.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* xLabel at bottom */}
      {xLabel && (
        <div style={{
          position: 'absolute',
          bottom: s(120),
          left: s(60),
          right: s(60),
          textAlign: 'center' as const,
          opacity: combinedOpacity,
        }}>
          <VoxBody
            text={xLabel}
            size={s(VOX_SIZES.label)}
            color={VOX_COLORS.medGray}
          />
        </div>
      )}

      <FilmGrain opacity={0.2} />
    </AbsoluteFill>
  );
};

export default VoxAreachart;
