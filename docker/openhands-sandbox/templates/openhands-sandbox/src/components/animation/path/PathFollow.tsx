import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface PathFollowProps {
  /** Start X position as percentage (0-100) */
  startX: number;
  /** Start Y position as percentage (0-100) */
  startY: number;
  /** End X position as percentage (0-100) */
  endX: number;
  /** End Y position as percentage (0-100) */
  endY: number;
  /** Arc height as percentage (negative = upward arc) */
  arcHeight?: number;
  /** Frame when animation starts */
  startFrame: number;
  /** Duration in frames */
  durationFrames: number;
  /** Show motion trail (default: false) */
  showTrail?: boolean;
  /** Trail color */
  trailColor?: string;
  /** Fade out at end (default: false) */
  fadeOut?: boolean;
  /** Children to animate along the path */
  children: React.ReactNode;
}

/**
 * PathFollow - Object follows a bezier curve path
 *
 * Perfect for: data flowing, requests traveling, connections forming
 *
 * @example
 * <PathFollow
 *   startX={10} startY={50}
 *   endX={90} endY={50}
 *   arcHeight={-20}
 *   startFrame={0}
 *   durationFrames={60}
 * >
 *   <DataPacket />
 * </PathFollow>
 */
export const PathFollow: React.FC<PathFollowProps> = ({
  startX,
  startY,
  endX,
  endY,
  arcHeight = -15,
  startFrame,
  durationFrames,
  showTrail = false,
  trailColor = '#8b5cf6',
  fadeOut = false,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Convert percentages to pixels
  const startXPx = (startX / 100) * width;
  const startYPx = (startY / 100) * height;
  const endXPx = (endX / 100) * width;
  const endYPx = (endY / 100) * height;
  const arcHeightPx = (arcHeight / 100) * height;

  // Mid point for the bezier curve
  const midX = (startXPx + endXPx) / 2;
  const midY = (startYPx + endYPx) / 2 + arcHeightPx;

  // Calculate progress
  const localFrame = frame - startFrame;
  const progress = interpolate(
    localFrame,
    [0, durationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Quadratic bezier curve calculation
  const t = progress;
  const oneMinusT = 1 - t;

  const x = oneMinusT * oneMinusT * startXPx +
            2 * oneMinusT * t * midX +
            t * t * endXPx;

  const y = oneMinusT * oneMinusT * startYPx +
            2 * oneMinusT * t * midY +
            t * t * endYPx;

  // Opacity
  let opacity = frame >= startFrame ? 1 : 0;
  if (fadeOut && progress > 0.8) {
    opacity = interpolate(progress, [0.8, 1], [1, 0]);
  }

  // Calculate rotation based on path tangent
  const tangentX = 2 * oneMinusT * (midX - startXPx) + 2 * t * (endXPx - midX);
  const tangentY = 2 * oneMinusT * (midY - startYPx) + 2 * t * (endYPx - midY);
  const rotation = Math.atan2(tangentY, tangentX) * (180 / Math.PI);

  return (
    <>
      {/* Trail */}
      {showTrail && frame >= startFrame && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <path
            d={`M ${startXPx} ${startYPx} Q ${midX} ${midY} ${endXPx} ${endYPx}`}
            fill="none"
            stroke={trailColor}
            strokeWidth={3}
            strokeDasharray={`${progress * 100}% 100%`}
            opacity={0.5}
          />
        </svg>
      )}

      {/* Animated object */}
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          opacity,
        }}
      >
        {children}
      </div>
    </>
  );
};

export default PathFollow;
