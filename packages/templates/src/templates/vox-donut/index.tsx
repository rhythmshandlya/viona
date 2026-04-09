import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxDonutProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS, sf, voxEaseOut } from '../../vox/constants';
import { voxEntrance, voxExit, popIn } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { VoxHeadline } from '../../vox/typography';
import { useScale } from '../../use-scale';

const SEGMENT_COLORS = [
  VOX_COLORS.teal,
  VOX_COLORS.highlight,
  VOX_COLORS.lightGray,
  VOX_COLORS.medGray,
  '#8B9E8B',
];

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const VoxDonut: React.FC<VoxDonutProps> = ({ segments, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;

  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const maxSegment = Math.max(...segments.map((s) => s.value));

  const CX = 540;
  const CY = 980;
  const OUTER_R = s(300);
  const INNER_R = s(190);
  const CIRCUMFERENCE = 2 * Math.PI * OUTER_R;

  // Each segment draws on clockwise sequentially
  let cumulativeAngle = 0;
  const segmentData = segments.map((seg, i) => {
    const segAngle = (seg.value / total) * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + segAngle;
    cumulativeAngle = endAngle;

    // Draw this segment starting at frame 20, sequential
    const segStart = 20 + i * 15;
    const segDuration = 25;
    const segProgress = interpolate(sf(frame), [segStart, segStart + segDuration], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: voxEaseOut,
    });

    const labelAngle = startAngle + segAngle / 2;
    const labelRadius = OUTER_R + s(60);
    const labelPos = polarToCartesian(CX, CY, labelRadius, startAngle + segAngle * segProgress / 2);

    const color = seg.color ?? SEGMENT_COLORS[i % SEGMENT_COLORS.length];
    const isLargest = seg.value === maxSegment;

    return { seg, startAngle, endAngle, segProgress, labelAngle, labelPos, color, isLargest, segStart };
  });

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

      {/* SVG donut */}
      <svg
        style={{ position: 'absolute', inset: 0 }}
        width="100%"
        height="100%"
        viewBox="0 0 1080 1920"
        preserveAspectRatio="none"
        opacity={combinedOpacity}
      >
        {/* Background circle */}
        <circle
          cx={CX}
          cy={CY}
          r={OUTER_R}
          fill="none"
          stroke={VOX_COLORS.lightGray}
          strokeWidth={OUTER_R - INNER_R}
          opacity={0.3}
        />

        {/* Segments — drawn as stroked arcs */}
        {segmentData.map((d, i) => {
          const segAngle = (d.seg.value / total) * 360;
          const arcLength = (segAngle / 360) * CIRCUMFERENCE;
          const visibleArcLength = arcLength * d.segProgress;
          const strokeR = (OUTER_R + INNER_R) / 2;
          const strokeWidth = OUTER_R - INNER_R;
          const strokeCircumference = 2 * Math.PI * strokeR;

          // Use stroke-dashoffset to reveal segment clockwise
          const segOffset = -(d.startAngle / 360) * strokeCircumference;

          return (
            <circle
              key={i}
              cx={CX}
              cy={CY}
              r={strokeR}
              fill="none"
              stroke={d.isLargest ? VOX_COLORS.highlight : d.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${visibleArcLength} ${strokeCircumference - visibleArcLength}`}
              strokeDashoffset={segOffset}
              strokeLinecap="butt"
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${CX}px ${CY}px` }}
            />
          );
        })}

        {/* Percentage labels — appear after segment draws */}
        {segmentData.map((d, i) => {
          const labelStart = d.segStart + 30;
          const labelPop = popIn(frame, labelStart, 8);
          const pct = Math.round((d.seg.value / total) * 100);
          const segAngle = (d.seg.value / total) * 360;
          const labelAngle = d.startAngle + segAngle / 2;
          const labelPos = polarToCartesian(CX, CY, OUTER_R + s(70), labelAngle);

          return (
            <text
              key={i}
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily={VOX_FONTS.body}
              fontSize={s(VOX_SIZES.label)}
              fontWeight={700}
              fill={VOX_COLORS.charcoal}
              opacity={labelPop.opacity * exit.opacity}
              style={{ transform: `scale(${labelPop.scale})`, transformOrigin: `${labelPos.x}px ${labelPos.y}px` }}
            >
              {pct}%
            </text>
          );
        })}
      </svg>

      {/* Legend below chart */}
      <div style={{
        position: 'absolute',
        bottom: s(120),
        left: s(60),
        right: s(60),
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: s(20),
        justifyContent: 'center',
        opacity: combinedOpacity,
      }}>
        {segmentData.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: s(8) }}>
            <div style={{
              width: s(14),
              height: s(14),
              borderRadius: '50%',
              backgroundColor: d.isLargest ? VOX_COLORS.highlight : d.color,
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.label),
              color: VOX_COLORS.charcoal,
            }}>
              {d.seg.label}
            </span>
          </div>
        ))}
      </div>

      <FilmGrain opacity={0.2} />
    </AbsoluteFill>
  );
};

export default VoxDonut;
