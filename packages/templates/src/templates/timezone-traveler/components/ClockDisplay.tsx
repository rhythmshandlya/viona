import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import { FONTS } from '../../../fonts';

interface ClockDisplayProps {
  frame: number;
  enterFrame: number;
  /** Route draw progress from 0 to 1, drives the time interpolation. */
  drawProgress: number;
  /** UTC offset string, e.g. "UTC-5" */
  startTimezone: string;
  /** UTC offset string, e.g. "UTC+9" */
  endTimezone: string;
  clockStyle: 'digital' | 'analog';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

/** Parse a UTC offset string like "UTC-5" or "UTC+9" into a numeric hour offset. */
function parseUtcOffset(tz: string): number {
  const match = tz.match(/UTC([+-]?\d+(?:\.\d+)?)/i);
  if (!match) return 0;
  return parseFloat(match[1]);
}

/** Convert a fractional hours value to { hours12, minutes, totalHours24 }. */
function timeFromHours(totalHours: number): { hours12: number; minutes: number; totalHours24: number } {
  // Normalise to 0-24 range
  let h24 = totalHours % 24;
  if (h24 < 0) h24 += 24;

  const hours24 = Math.floor(h24);
  const minutes = Math.floor((h24 - hours24) * 60);
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;

  return { hours12, minutes, totalHours24: h24 };
}

const ClockDisplay: React.FC<ClockDisplayProps> = ({
  frame,
  enterFrame,
  drawProgress,
  startTimezone,
  endTimezone,
  clockStyle,
  primaryColor,
  secondaryColor,
  accentColor,
}) => {
  const { fps } = useVideoConfig();

  // Spring entrance
  const scaleSpring = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const opacity = interpolate(frame, [enterFrame, enterFrame + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < enterFrame) return null;

  // Time calculation
  const startOffset = parseUtcOffset(startTimezone);
  const endOffset = parseUtcOffset(endTimezone);
  const baseHour = 10; // 10:00 AM at departure
  const startTime = baseHour; // local time at start
  const timeDelta = endOffset - startOffset; // hours gained/lost crossing zones
  const currentLocalTime = startTime + drawProgress * timeDelta;
  const { hours12, minutes, totalHours24 } = timeFromHours(currentLocalTime);

  // Blinking colon for digital clock (toggles every 15 frames)
  const colonVisible = Math.floor(frame / 15) % 2 === 0;

  if (clockStyle === 'analog') {
    return (
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 40,
          opacity,
          transform: `scale(${scaleSpring})`,
          transformOrigin: 'top right',
          pointerEvents: 'none',
        }}
      >
        <AnalogClock
          hours24={totalHours24}
          minutes={minutes}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          accentColor={accentColor}
        />
      </div>
    );
  }

  // Digital clock
  const hoursStr = String(hours12).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        right: 40,
        opacity,
        transform: `scale(${scaleSpring})`,
        transformOrigin: 'top right',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 16,
        padding: '16px 28px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: FONTS.jetBrainsMono,
          fontSize: 56,
          fontWeight: 700,
          color: secondaryColor,
          letterSpacing: 2,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span>{hoursStr}</span>
        <span style={{ opacity: colonVisible ? 1 : 0.2, margin: '0 2px' }}>:</span>
        <span>{minutesStr}</span>
      </div>
      <div
        style={{
          fontFamily: FONTS.inter,
          fontSize: 13,
          fontWeight: 500,
          color: primaryColor,
          marginTop: 6,
          letterSpacing: 1,
        }}
      >
        LOCAL TIME
      </div>
    </div>
  );
};

/** Simple SVG analog clock face with hour and minute hands. */
const AnalogClock: React.FC<{
  hours24: number;
  minutes: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}> = ({ hours24, minutes, primaryColor, secondaryColor, accentColor }) => {
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;

  // Hour hand: full rotation = 12 hours, so each hour = 30 degrees
  const hourAngle = ((hours24 % 12) + minutes / 60) * 30 - 90;
  const hourRad = (hourAngle * Math.PI) / 180;
  const hourLen = r * 0.5;

  // Minute hand: full rotation = 60 minutes, each minute = 6 degrees
  const minAngle = minutes * 6 - 90;
  const minRad = (minAngle * Math.PI) / 180;
  const minLen = r * 0.72;

  // Tick marks
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 * Math.PI) / 180 - Math.PI / 2;
    const outerR = r - 2;
    const innerR = i % 3 === 0 ? r - 14 : r - 8;
    ticks.push(
      <line
        key={i}
        x1={cx + Math.cos(angle) * innerR}
        y1={cy + Math.sin(angle) * innerR}
        x2={cx + Math.cos(angle) * outerR}
        y2={cy + Math.sin(angle) * outerR}
        stroke={secondaryColor}
        strokeWidth={i % 3 === 0 ? 2.5 : 1.2}
        strokeLinecap="round"
      />
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: '50%',
        padding: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Face */}
        <circle cx={cx} cy={cy} r={r} fill="white" stroke={secondaryColor} strokeWidth={2} />
        {/* Ticks */}
        {ticks}
        {/* Hour hand */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + Math.cos(hourRad) * hourLen}
          y2={cy + Math.sin(hourRad) * hourLen}
          stroke={secondaryColor}
          strokeWidth={4}
          strokeLinecap="round"
        />
        {/* Minute hand */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + Math.cos(minRad) * minLen}
          y2={cy + Math.sin(minRad) * minLen}
          stroke={primaryColor}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={4} fill={accentColor} />
      </svg>
    </div>
  );
};

export default ClockDisplay;
