import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { BarChartRaceProps } from './schema';
import { formatCompact } from './lib/format';

const BarChartRace: React.FC<BarChartRaceProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];

  const { items, timeLabels, maxVisible, valuePrefix, valueSuffix } = props;
  const numSteps = timeLabels.length;

  // Timeline: title entrance 0-20, race 20-330, fade out 330-360
  const introOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Map frame to time index (0 to numSteps-1)
  const raceStart = 25;
  const raceEnd = durationInFrames - 40;
  const timeIndex = interpolate(frame, [raceStart, raceEnd], [0, numSteps - 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Get the two snapshots we're between
  const lowerIdx = Math.min(Math.floor(timeIndex), numSteps - 2);
  const upperIdx = lowerIdx + 1;
  const frac = timeIndex - lowerIdx;

  // Interpolate values for each item
  const interpolatedItems = items.map((item, i) => {
    const vals = item.values;
    const v1 = vals[Math.min(lowerIdx, vals.length - 1)] ?? 0;
    const v2 = vals[Math.min(upperIdx, vals.length - 1)] ?? 0;
    const value = v1 + (v2 - v1) * frac;
    const color = item.color ?? props.barColors[i % props.barColors.length];
    return { name: item.name, value, color };
  });

  // Sort descending by value
  const sorted = [...interpolatedItems].sort((a, b) => b.value - a.value);
  const visible = sorted.slice(0, maxVisible);
  const maxValue = Math.max(...visible.map((v) => v.value), 1);

  // Current time label (interpolated)
  const currentLabelIdx = Math.min(Math.round(timeIndex), numSteps - 1);
  const currentTimeLabel = timeLabels[currentLabelIdx] ?? '';

  // Layout constants
  const LEFT_PAD = 220;
  const RIGHT_PAD = 100;
  const TOP_PAD = 100;
  const BOTTOM_PAD = 80;
  const chartWidth = 1080 - LEFT_PAD - RIGHT_PAD;
  const chartHeight = 1080 - TOP_PAD - BOTTOM_PAD;
  const BAR_HEIGHT = Math.min(48, (chartHeight / maxVisible) - 14);
  const BAR_GAP = (chartHeight - BAR_HEIGHT * maxVisible) / (maxVisible + 1);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, opacity: introOpacity * outroOpacity }}>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 28,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: titleOpacity,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: 3,
            color: theme.textMuted,
            textTransform: 'uppercase',
          }}
        >
          {props.title}
        </span>
      </div>

      {/* Large time label (bottom right, semi-transparent) */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          right: 50,
          opacity: 0.12,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.headline,
            fontSize: 180,
            fontWeight: 900,
            color: theme.text,
            lineHeight: 1,
          }}
        >
          {currentTimeLabel}
        </span>
      </div>

      {/* Bars */}
      {visible.map((item, rank) => {
        const barWidth = (item.value / maxValue) * chartWidth;
        const y = TOP_PAD + BAR_GAP + rank * (BAR_HEIGHT + BAR_GAP);

        const barEnterOpacity = interpolate(frame, [raceStart - 5, raceStart + 10], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div key={item.name} style={{ position: 'absolute', top: y, left: 0, right: 0, height: BAR_HEIGHT, opacity: barEnterOpacity }}>
            {/* Label (left of bar) */}
            <div
              style={{
                position: 'absolute',
                right: 1080 - LEFT_PAD + 12,
                top: 0,
                height: BAR_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                width: LEFT_PAD - 20,
                justifyContent: 'flex-end',
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 18,
                  fontWeight: 500,
                  color: theme.text,
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: LEFT_PAD - 24,
                }}
              >
                {item.name}
              </span>
            </div>

            {/* Bar */}
            <div
              style={{
                position: 'absolute',
                left: LEFT_PAD,
                top: 0,
                width: Math.max(barWidth, 4),
                height: BAR_HEIGHT,
                borderRadius: BAR_HEIGHT / 2,
                background: `linear-gradient(90deg, ${item.color} 0%, ${item.color}BB 100%)`,
                boxShadow: `0 0 12px ${item.color}40`,
              }}
            />

            {/* Value (end of bar) */}
            <div
              style={{
                position: 'absolute',
                left: LEFT_PAD + Math.max(barWidth, 4) + 10,
                top: 0,
                height: BAR_HEIGHT,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.headline,
                  fontSize: 18,
                  fontWeight: 700,
                  color: theme.text,
                  whiteSpace: 'nowrap',
                }}
              >
                {formatCompact(Math.round(item.value), valuePrefix, valueSuffix)}
              </span>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default BarChartRace;
