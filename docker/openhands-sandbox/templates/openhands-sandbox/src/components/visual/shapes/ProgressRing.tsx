import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface ProgressRingProps {
  /** Static progress value 0-1 OR use startFrame/endFrame for animation */
  progress?: number;
  /** Frame to start animation (if animating) */
  startFrame?: number;
  /** Frame when progress reaches 100% (if animating) */
  endFrame?: number;
  /** Size multiplier (default: 1) */
  size?: number;
  /** Ring color */
  color?: string;
  /** Background ring color */
  backgroundColor?: string;
  /** Stroke width multiplier (default: 1) */
  strokeWidth?: number;
  /** Show percentage text in center */
  showLabel?: boolean;
  /** Label color */
  labelColor?: string;
}

/**
 * ProgressRing - Circular progress indicator with animated fill
 *
 * Use for: progress visualization, loading states, completion percentage
 *
 * @example
 * // Animated progress
 * <ProgressRing startFrame={0} endFrame={90} color="#22c55e" />
 *
 * // Static progress
 * <ProgressRing progress={0.75} color="#8b5cf6" showLabel />
 */
export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress: staticProgress,
  startFrame = 0,
  endFrame = 60,
  size = 1,
  color = '#8b5cf6',
  backgroundColor = 'rgba(255, 255, 255, 0.1)',
  strokeWidth = 1,
  showLabel = false,
  labelColor = '#ffffff',
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // Calculate progress
  let progress: number;
  if (staticProgress !== undefined) {
    progress = staticProgress;
  } else {
    progress = interpolate(
      frame,
      [startFrame, endFrame],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
  }

  // Ring dimensions
  const ringSize = minDim * 0.15 * size;
  const ringStrokeWidth = minDim * 0.015 * strokeWidth;
  const radius = (ringSize - ringStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const percentage = Math.round(progress * 100);

  return (
    <div
      style={{
        position: 'relative',
        width: ringSize,
        height: ringSize,
      }}
    >
      <svg
        width={ringSize}
        height={ringSize}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background ring */}
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={ringStrokeWidth}
        />

        {/* Progress ring */}
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={ringStrokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 ${ringStrokeWidth}px ${color})`,
          }}
        />
      </svg>

      {/* Label */}
      {showLabel && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: labelColor,
            fontSize: ringSize * 0.25,
            fontWeight: 'bold',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {percentage}%
        </div>
      )}
    </div>
  );
};

export default ProgressRing;
