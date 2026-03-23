import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { BLACKBOARD_FONTS, BLACKBOARD_COLORS } from '../../../blackboard/constants';
import { glowPulse } from '../../../blackboard/animations';

export function CountUp({
  value,
  prefix = '',
  suffix = '',
  startFrame,
  duration = 30,
  fontSize,
  pulseStart,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  startFrame: number;
  duration?: number;
  fontSize: number;
  pulseStart: number;
}) {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const currentValue = progress * value;
  const pulse = glowPulse(frame, pulseStart);

  const hasDecimal = value % 1 !== 0;
  const display = hasDecimal
    ? parseFloat(currentValue.toFixed(2)).toString()
    : Math.round(currentValue).toString();

  const glowSpread = pulse.active ? 20 + pulse.intensity * 30 : 20;
  const glowOpacity = pulse.active ? 0.4 + pulse.intensity * 0.3 : 0.4;

  return (
    <div
      style={{
        fontFamily: BLACKBOARD_FONTS.mono,
        fontSize,
        fontWeight: 700,
        color: BLACKBOARD_COLORS.primary,
        textShadow: `0 0 ${glowSpread}px rgba(245,158,11,${glowOpacity})`,
      }}
    >
      {prefix}
      {display}
      {suffix}
    </div>
  );
}
