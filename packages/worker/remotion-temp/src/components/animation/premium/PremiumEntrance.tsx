/**
 * PremiumEntrance - Configurable premium entrance animation wrapper
 *
 * Provides a single component interface for all premium entrance animations.
 * Use this when you want to dynamically select an entrance animation.
 *
 * @example
 * <PremiumEntrance animation="bounceIn" delay={0} style="modern">
 *   <HeroTitle />
 * </PremiumEntrance>
 */

import React from 'react';
import {
  BounceIn, FadeInUp, FadeInDown, ZoomIn, FlipInX,
  RotateIn, LightSpeedIn, SlideInRotate,
  type StylePreset,
} from '../../../animations';

export type PremiumEntranceType =
  | 'bounceIn' | 'fadeInUp' | 'fadeInDown' | 'zoomIn'
  | 'flipInX' | 'rotateIn' | 'lightSpeedIn' | 'slideInRotate';

interface PremiumEntranceProps {
  animation: PremiumEntranceType;
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: StylePreset;
  speed?: 'fast' | 'normal' | 'slow';
}

const ENTRANCE_MAP: Record<PremiumEntranceType, React.FC<any>> = {
  bounceIn: BounceIn,
  fadeInUp: FadeInUp,
  fadeInDown: FadeInDown,
  zoomIn: ZoomIn,
  flipInX: FlipInX,
  rotateIn: RotateIn,
  lightSpeedIn: LightSpeedIn,
  slideInRotate: SlideInRotate,
};

export const PremiumEntrance: React.FC<PremiumEntranceProps> = ({
  animation, children, delay = 0, duration, style = 'modern', speed = 'normal',
}) => {
  const Comp = ENTRANCE_MAP[animation];
  return (
    <Comp delay={delay} duration={duration} style={style} speed={speed}>
      {children}
    </Comp>
  );
};
