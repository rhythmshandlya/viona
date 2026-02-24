import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { StatLineChartProps } from './schema';
import CardShell from './components/CardShell';

const DotGrid: React.FC<{ color: string; s: (px: number) => number }> = ({ color, s }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <defs>
      <pattern id="dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
        <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dot-grid)" />
  </svg>
);

const StatLineChart: React.FC<StatLineChartProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const CHART_W = s(740);
  const CHART_H = s(360);
  const PAD_LEFT = s(60);
  const PAD_BOTTOM = s(40);
  const PAD_TOP = s(20);
  const PAD_RIGHT = s(20);
  const theme = BACKGROUNDS[props.background];

  const points = props.points;
  const xLabels = props.xLabels;

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

  if (points.length < 2) {
    const bgStyle: React.CSSProperties = props.background === 'gradient'
      ? { background: theme.bg }
      : { backgroundColor: theme.bg };
    return <AbsoluteFill style={bgStyle} />;
  }

  const minVal = 0;
  const maxVal = Math.max(...points) * 1.15;
  const plotW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;

  // Map data points to pixel coords
  const coords = points.map((v, i) => ({
    x: PAD_LEFT + (i / (points.length - 1)) * plotW,
    y: PAD_TOP + plotH - ((v - minVal) / (maxVal - minVal)) * plotH,
  }));

  // Draw progress (frames 25–240)
  const drawProgress = interpolate(frame, [25, 240], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Build polyline segments
  const totalSegments = coords.length - 1;
  const pointsToDraw = Math.floor(drawProgress * totalSegments) + 1;
  const segFraction = (drawProgress * totalSegments) % 1;

  let pathD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < Math.min(pointsToDraw, coords.length); i++) {
    pathD += ` L ${coords[i].x} ${coords[i].y}`;
  }
  // Interpolate partial last segment
  if (pointsToDraw < coords.length && pointsToDraw > 0) {
    const from = coords[pointsToDraw - 1];
    const to = coords[pointsToDraw];
    const x = from.x + (to.x - from.x) * segFraction;
    const y = from.y + (to.y - from.y) * segFraction;
    pathD += ` L ${x} ${y}`;
  }

  // Fill area path
  const lastDrawnIdx = Math.min(pointsToDraw, coords.length - 1);
  let lastX: number, lastY: number;
  if (pointsToDraw < coords.length && pointsToDraw > 0) {
    const from = coords[pointsToDraw - 1];
    const to = coords[pointsToDraw];
    lastX = from.x + (to.x - from.x) * segFraction;
    lastY = from.y + (to.y - from.y) * segFraction;
  } else {
    lastX = coords[lastDrawnIdx].x;
    lastY = coords[lastDrawnIdx].y;
  }
  const areaD = `${pathD} L ${lastX} ${PAD_TOP + plotH} L ${coords[0].x} ${PAD_TOP + plotH} Z`;

  // Label
  const labelOpacity = interpolate(frame, [240, 270], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const bgStyle: React.CSSProperties = props.background === 'gradient'
    ? { background: theme.bg }
    : { backgroundColor: theme.bg };

  return (
    <AbsoluteFill style={{ ...bgStyle, opacity: introOpacity * outroOpacity, overflow: 'hidden' }}>
      <DotGrid color={theme.gridColor} s={s} />

      <CardShell
        frame={frame}
        enterFrame={0}
        exitFrame={durationInFrames}
        cardStyle={props.cardStyle}
        cardBg={theme.cardBg}
        cardBorder={theme.cardBorder}
        accentColor={props.accentColor}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: s(16) }}>
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: s(22),
              fontWeight: 500,
              letterSpacing: s(3),
              color: theme.textMuted,
              textTransform: 'uppercase',
              opacity: titleOpacity,
              transform: `translateY(${titleSlideY}px)`,
              textAlign: 'center',
            }}
          >
            {props.title}
          </span>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
              {/* Grid lines */}
              {[0.25, 0.5, 0.75, 1].map((frac, i) => {
                const y = PAD_TOP + plotH - frac * plotH;
                return (
                  <line
                    key={i}
                    x1={PAD_LEFT}
                    y1={y}
                    x2={PAD_LEFT + plotW}
                    y2={y}
                    stroke={`${theme.text}10`}
                    strokeWidth={1}
                  />
                );
              })}

              {/* Gradient fill under curve */}
              <defs>
                <linearGradient id="line-fill-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={props.accentColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={props.accentColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <path d={areaD} fill="url(#line-fill-gradient)" />

              {/* Line */}
              <path
                d={pathD}
                fill="none"
                stroke={props.accentColor}
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Dot at current tip */}
              <circle
                cx={lastX}
                cy={lastY}
                r={s(6)}
                fill={props.accentColor}
                stroke="#0B0F1A"
                strokeWidth={3}
              />

              {/* X-axis labels */}
              {xLabels.map((label, i) => {
                const x = PAD_LEFT + (i / Math.max(xLabels.length - 1, 1)) * plotW;
                return (
                  <text
                    key={i}
                    x={x}
                    y={CHART_H - s(8)}
                    textAnchor="middle"
                    fill={theme.textMuted}
                    fontSize={s(16)}
                    fontFamily={FONTS.body}
                  >
                    {label}
                  </text>
                );
              })}
            </svg>

            {props.label && (
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: s(18),
                  color: theme.textMuted,
                  opacity: labelOpacity,
                  marginTop: s(12),
                }}
              >
                {props.label}
              </span>
            )}
          </div>
        </div>
      </CardShell>
    </AbsoluteFill>
  );
};

export default StatLineChart;
