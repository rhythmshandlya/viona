import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { StatDonutProps } from './schema';
import CardShell from './components/CardShell';
import { describeArc } from './lib/format';

const DotGrid: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <defs>
      <pattern id="dot-grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <circle cx="16" cy="16" r="1" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dot-grid)" />
  </svg>
);

const StatDonut: React.FC<StatDonutProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];

  const segments = props.segments;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  const introOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleSlideY = interpolate(frame, [10, 25], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Donut draw animation (frames 25–200)
  const drawProgress = interpolate(frame, [25, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Center label (frames 120–160)
  const centerLabelOpacity = interpolate(frame, [120, 160], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Legend fade in (frames 180–220)
  const legendOpacity = interpolate(frame, [180, 220], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cx = 200;
  const cy = 200;
  const r = 150;
  const strokeWidth = 36;

  // Build arcs
  let currentAngle = 0;
  const arcs = segments.map((seg, i) => {
    const segAngle = (seg.value / total) * 360;
    const drawnAngle = segAngle * drawProgress;
    const startAngle = currentAngle;
    const endAngle = currentAngle + drawnAngle;
    currentAngle += segAngle;
    const color = seg.color ?? props.chartColors[i % props.chartColors.length];
    return { startAngle, endAngle, color, label: seg.label, value: seg.value };
  });

  const bgStyle: React.CSSProperties = props.background === 'gradient'
    ? { background: theme.bg }
    : { backgroundColor: theme.bg };

  return (
    <AbsoluteFill style={{ ...bgStyle, opacity: introOpacity * outroOpacity, overflow: 'hidden' }}>
      <DotGrid color={theme.gridColor} />

      <CardShell
        frame={frame}
        enterFrame={0}
        exitFrame={durationInFrames}
        cardStyle={props.cardStyle}
        cardBg={theme.cardBg}
        cardBorder={theme.cardBorder}
        accentColor={props.accentColor}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 16 }}>
          {/* Title */}
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: 3,
              color: theme.textMuted,
              textTransform: 'uppercase',
              opacity: titleOpacity,
              transform: `translateY(${titleSlideY}px)`,
              textAlign: 'center',
            }}
          >
            {props.title}
          </span>

          {/* Donut + Legend row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 48, flex: 1 }}>
            {/* SVG Donut */}
            <div style={{ position: 'relative', width: 400, height: 400, flexShrink: 0 }}>
              <svg width={400} height={400} viewBox="0 0 400 400">
                {/* Background ring */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={`${theme.text}08`}
                  strokeWidth={strokeWidth}
                />
                {/* Segments */}
                {arcs.map((arc, i) => {
                  if (arc.endAngle - arc.startAngle < 0.5) return null;
                  return (
                    <path
                      key={i}
                      d={describeArc(cx, cy, r, arc.startAngle, arc.endAngle)}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>

              {/* Center label */}
              {props.centerLabel && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: centerLabelOpacity,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.headline,
                      fontSize: 48,
                      fontWeight: 800,
                      color: theme.text,
                    }}
                  >
                    {props.centerLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Legend */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                opacity: legendOpacity,
              }}
            >
              {segments.map((seg, i) => {
                const color = seg.color ?? props.chartColors[i % props.chartColors.length];
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        backgroundColor: color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontFamily: FONTS.body, fontSize: 20, color: theme.textMuted, whiteSpace: 'nowrap' }}>
                      {seg.label}
                    </span>
                    <span style={{ fontFamily: FONTS.headline, fontSize: 22, fontWeight: 700, color: theme.text }}>
                      {seg.value}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardShell>
    </AbsoluteFill>
  );
};

export default StatDonut;
