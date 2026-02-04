/**
 * CombinedAnimation - Chain entrance + emphasis + exit in one component
 *
 * Orchestrates a full animation lifecycle: enter, draw attention, then exit.
 * All timing is frame-based and deterministic.
 *
 * @example
 * <CombinedAnimation
 *   entrance="fadeInUp"
 *   emphasis="pulse"
 *   emphasisFrame={60}
 *   exit="zoomOut"
 *   exitFrame={150}
 *   style="modern"
 * >
 *   <FeatureCard />
 * </CombinedAnimation>
 */

import React from 'react';
import { useCurrentFrame } from 'remotion';
import {
  BounceIn, FadeInUp, FadeInDown, ZoomIn, FlipInX, RotateIn, LightSpeedIn,
  BounceOut, FadeOutUp, ZoomOut,
  Pulse, Shake, Tada, Wobble, HeartBeat, GlowPulse,
  type StylePreset, PREMIUM_DURATIONS,
} from '../../../animations';
import type { PremiumEntranceType } from './PremiumEntrance';

type PremiumExitType = 'bounceOut' | 'fadeOutUp' | 'zoomOut';
type EmphasisType = 'pulse' | 'shake' | 'tada' | 'wobble' | 'heartBeat' | 'glowPulse';

interface CombinedAnimationProps {
  children: React.ReactNode;
  entrance: PremiumEntranceType;
  emphasis?: EmphasisType;
  emphasisFrame?: number;
  emphasisDuration?: number;
  exit?: PremiumExitType;
  exitFrame?: number;
  exitDuration?: number;
  style?: StylePreset;
  speed?: 'fast' | 'normal' | 'slow';
}

const ENTRANCE_MAP: Record<PremiumEntranceType, React.FC<any>> = {
  bounceIn: BounceIn, fadeInUp: FadeInUp, fadeInDown: FadeInDown,
  zoomIn: ZoomIn, flipInX: FlipInX, rotateIn: RotateIn,
  lightSpeedIn: LightSpeedIn, slideInRotate: () => null,
};

const EXIT_MAP: Record<PremiumExitType, React.FC<any>> = {
  bounceOut: BounceOut, fadeOutUp: FadeOutUp, zoomOut: ZoomOut,
};

const EMPHASIS_MAP: Record<EmphasisType, React.FC<any>> = {
  pulse: Pulse, shake: Shake, tada: Tada,
  wobble: Wobble, heartBeat: HeartBeat, glowPulse: GlowPulse,
};

export const CombinedAnimation: React.FC<CombinedAnimationProps> = ({
  children, entrance, emphasis, emphasisFrame, emphasisDuration = 30,
  exit, exitFrame, exitDuration, style = 'modern', speed = 'normal',
}) => {
  const frame = useCurrentFrame();
  const EntranceComp = ENTRANCE_MAP[entrance];
  const dur = PREMIUM_DURATIONS[style][speed];

  // Phase 1: Entrance
  let content = (
    <EntranceComp delay={0} duration={dur} style={style} speed={speed}>
      {children}
    </EntranceComp>
  );

  // Phase 2: Emphasis (if configured and frame reached)
  if (emphasis && emphasisFrame !== undefined && frame >= emphasisFrame) {
    const EmphasisComp = EMPHASIS_MAP[emphasis];
    content = (
      <EmphasisComp delay={emphasisFrame} duration={emphasisDuration} style={style}>
        {content}
      </EmphasisComp>
    );
  }

  // Phase 3: Exit (if configured and frame reached)
  if (exit && exitFrame !== undefined && frame >= exitFrame) {
    const ExitComp = EXIT_MAP[exit];
    content = (
      <ExitComp delay={exitFrame} duration={exitDuration || dur} style={style} speed={speed}>
        {content}
      </ExitComp>
    );
  }

  return <>{content}</>;
};
