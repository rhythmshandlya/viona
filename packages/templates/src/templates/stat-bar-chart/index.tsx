import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { StatBarChartProps } from './schema';
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

const StatBarChart: React.FC<StatBarChartProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  const bars = props.bars;
  const maxValue = Math.max(...bars.map((b) => b.value), 1);

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
          {/* Title */}
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

          {/* Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: s(24), flex: 1, justifyContent: 'center', padding: `${s(12)}px 0` }}>
            {bars.map((bar, i) => {
              const staggerDelay = 30 + i * 15;
              const barProgress = spring({
                frame: frame - staggerDelay,
                fps,
                config: { damping: 18, stiffness: 80, mass: 0.8 },
              });

              const widthPercent = (bar.value / maxValue) * 100 * barProgress;
              const color = bar.color ?? props.chartColors[i % props.chartColors.length];

              const labelOpacity = interpolate(frame, [staggerDelay, staggerDelay + 12], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: s(8) }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: labelOpacity,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: FONTS.body,
                        fontSize: s(20),
                        fontWeight: 500,
                        color: theme.text,
                      }}
                    >
                      {bar.label}
                    </span>
                    <span
                      style={{
                        fontFamily: FONTS.headline,
                        fontSize: s(24),
                        fontWeight: 700,
                        color: theme.text,
                      }}
                    >
                      {Math.round(bar.value * barProgress)}%
                    </span>
                  </div>

                  <div
                    style={{
                      width: '100%',
                      height: s(28),
                      borderRadius: s(14),
                      background: `${color}15`,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${widthPercent}%`,
                        height: '100%',
                        borderRadius: s(14),
                        background: `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)`,
                        boxShadow: `0 0 ${s(16)}px ${color}40`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardShell>
    </AbsoluteFill>
  );
};

export default StatBarChart;
