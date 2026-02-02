import React from 'react';
import { Trail, CameraMotionBlur } from '@remotion/motion-blur';

type BlurType = 'trail' | 'camera';

interface MotionBlurWrapperProps {
  /** Type of motion blur effect */
  type?: BlurType;
  /** For trail: number of ghost images */
  trailAmount?: number;
  /** For trail: lag between ghosts in frames */
  trailLag?: number;
  /** For trail: opacity of trail layers (0-1, default: 0.8) */
  trailOpacity?: number;
  /** For camera: number of samples for blur */
  cameraSamples?: number;
  /** For camera: shutter angle (180 = standard film, 360 = full exposure) */
  shutterAngle?: number;
  /** Children to apply blur to (must be absolutely positioned for trail) */
  children: React.ReactNode;
}

/**
 * MotionBlurWrapper - Easy motion blur using @remotion/motion-blur
 *
 * Provides two types of blur:
 * - 'trail': Creates ghost trail effect (good for fast-moving objects)
 * - 'camera': Natural camera motion blur (more cinematic)
 *
 * Note: Children should be absolutely positioned for trail effect.
 *
 * @example
 * <MotionBlurWrapper type="trail" trailAmount={5}>
 *   <FlyingObject />
 * </MotionBlurWrapper>
 */
export const MotionBlurWrapper: React.FC<MotionBlurWrapperProps> = ({
  type = 'trail',
  trailAmount = 5,
  trailLag = 0.1,
  trailOpacity = 0.8,
  cameraSamples = 10,
  shutterAngle = 180,
  children,
}) => {
  if (type === 'camera') {
    return (
      <CameraMotionBlur samples={cameraSamples} shutterAngle={shutterAngle}>
        {children}
      </CameraMotionBlur>
    );
  }

  return (
    <Trail layers={trailAmount} lagInFrames={trailLag} trailOpacity={trailOpacity}>
      {children}
    </Trail>
  );
};

export default MotionBlurWrapper;
