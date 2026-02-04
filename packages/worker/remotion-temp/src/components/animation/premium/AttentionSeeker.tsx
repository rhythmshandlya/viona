/**
 * AttentionSeeker - Emphasis animations that draw the eye
 *
 * Use for highlighting key moments, statistics, or important elements.
 * Animations play once when startFrame is reached, or loop between start/end.
 *
 * @example
 * <AttentionSeeker effect="tada" startFrame={60}>
 *   <StatNumber>1,000,000</StatNumber>
 * </AttentionSeeker>
 */

import React from 'react';
import {
  Pulse, Shake, Tada, Wobble, HeartBeat, Flash, GlowPulse,
  type StylePreset,
} from '../../../animations';

export type AttentionEffect =
  | 'pulse' | 'shake' | 'tada' | 'wobble'
  | 'heartBeat' | 'flash' | 'glowPulse';

interface AttentionSeekerProps {
  effect: AttentionEffect;
  children: React.ReactNode;
  startFrame?: number;
  duration?: number;
  style?: StylePreset;
  color?: string;
}

const EFFECT_MAP: Record<AttentionEffect, React.FC<any>> = {
  pulse: Pulse,
  shake: Shake,
  tada: Tada,
  wobble: Wobble,
  heartBeat: HeartBeat,
  flash: Flash,
  glowPulse: GlowPulse,
};

export const AttentionSeeker: React.FC<AttentionSeekerProps> = ({
  effect, children, startFrame = 0, duration = 30, style = 'modern', color,
}) => {
  const Comp = EFFECT_MAP[effect];
  const extraProps: Record<string, any> = {};
  if (color && (effect === 'glowPulse')) {
    extraProps.color = color;
  }

  return (
    <Comp delay={startFrame} duration={duration} style={style} {...extraProps}>
      {children}
    </Comp>
  );
};
