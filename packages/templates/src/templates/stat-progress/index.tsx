import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { StatProgressProps } from './schema';
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

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;
  const start = { x: cx + r * Math.cos(endRad), y: cy + r * Math.sin(endRad) };
  const end = { x: cx + r * Math.cos(startRad), y: cy + r * Math.sin(startRad) };
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

const ProgressRing: React.FC<{
  value: number;
  label: string;
  color: string;
  progress: number;
  textColor: string;
  textMuted: string;
  headlineFont: string;
  bodyFont: string;
  s: (px: number) => number;
}> = ({ value, label, color, progress, textColor, textMuted, headlineFont, bodyFont, s }) => {
  const RING_SIZE = s(180);
  const RING_RADIUS = s(70);
  const RING_STROKE = s(12);
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const displayValue = Math.round(value * progress);
  const sweepAngle = (value / 100) * 360 * progress;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s(12) }}>
      <div style={{ position: 'relative', width: RING_SIZE, height: RING_SIZE }}>
        <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
          {/* Background ring */}
          <circle
            cx={cx}
            cy={cy}
            r={RING_RADIUS}
            fill="none"
            stroke={`${textColor}10`}
            strokeWidth={RING_STROKE}
          />
          {/* Progress arc */}
          {sweepAngle > 0.5 && (
            <path
              d={describeArc(cx, cy, RING_RADIUS, 0, Math.min(sweepAngle, 359.9))}
              fill="none"
              stroke={color}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              filter={`drop-shadow(0 0 ${s(8)}px ${color}60)`}
            />
          )}
        </svg>
        {/* Center percentage */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: headlineFont,
              fontSize: s(40),
              fontWeight: 800,
              color: textColor,
            }}
          >
            {displayValue}%
          </span>
        </div>
      </div>
      <span
        style={{
          fontFamily: bodyFont,
          fontSize: s(18),
          fontWeight: 500,
          color: textMuted,
          textAlign: 'center',
          maxWidth: s(160),
        }}
      >
        {label}
      </span>
    </div>
  );
};

const StatProgress: React.FC<StatProgressProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  const items = props.items;

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

  const bgStyle: React.CSSProperties = props.background === 'gradient'
    ? { background: theme.bg }
    : { backgroundColor: theme.bg };

  // Arrange items in a 2-column grid
  const cols = 2;
  const rows: typeof items[] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }

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
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: s(20) }}>
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

          {/* 2×2 ring grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: s(32), flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            {rows.map((row, rowIdx) => (
              <div key={rowIdx} style={{ display: 'flex', gap: s(64), justifyContent: 'center' }}>
                {row.map((item, colIdx) => {
                  const i = rowIdx * cols + colIdx;
                  const staggerDelay = 30 + i * 18;

                  const ringProgress = interpolate(frame, [staggerDelay, staggerDelay + 180], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.out(Easing.cubic),
                  });

                  const itemOpacity = interpolate(frame, [staggerDelay, staggerDelay + 15], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  });

                  const itemScale = interpolate(frame, [staggerDelay, staggerDelay + 15], [0.85, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  });

                  const color = item.color ?? props.chartColors[i % props.chartColors.length];

                  return (
                    <div key={i} style={{ opacity: itemOpacity, transform: `scale(${itemScale})` }}>
                      <ProgressRing
                        value={item.value}
                        label={item.label}
                        color={color}
                        progress={ringProgress}
                        textColor={theme.text}
                        textMuted={theme.textMuted}
                        headlineFont={FONTS.headline}
                        bodyFont={FONTS.body}
                        s={s}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardShell>
    </AbsoluteFill>
  );
};

export default StatProgress;
