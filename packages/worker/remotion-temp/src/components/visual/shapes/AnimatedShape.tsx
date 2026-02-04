import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import {
  makeStar,
  makeCircle,
  makeTriangle,
  makeRect,
  makePie,
  makePolygon,
  makeEllipse,
} from '@remotion/shapes';
import { evolvePath, getLength } from '@remotion/paths';

type ShapeType = 'star' | 'circle' | 'triangle' | 'rect' | 'pie' | 'polygon' | 'heart' | 'ellipse';
type AnimationType = 'draw' | 'scale' | 'morph' | 'pulse' | 'rotate' | 'none';

interface AnimatedShapeProps {
  /** Shape type */
  shape: ShapeType;
  /** Size of the shape */
  size?: number;
  /** Fill color */
  fill?: string;
  /** Stroke color (if using stroke) */
  stroke?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Animation type */
  animation?: AnimationType;
  /** Frame to start animation */
  startFrame?: number;
  /** Animation duration in frames */
  durationFrames?: number;
  /** For star: number of points */
  points?: number;
  /** For star: inner radius ratio (0-1) */
  innerRadiusRatio?: number;
  /** For pie: progress (0-1) */
  pieProgress?: number;
  /** For polygon: number of sides */
  sides?: number;
  /** Rotation in degrees */
  rotation?: number;
  /** Glow effect */
  glow?: boolean;
  /** Glow color */
  glowColor?: string;
}

/**
 * AnimatedShape - Animated geometric shapes using @remotion/shapes
 *
 * Supports draw-on animation, scaling, pulsing, and more.
 * Perfect for icons, decorations, and visual emphasis.
 *
 * @example
 * <AnimatedShape shape="star" size={100} fill="#8b5cf6" animation="draw" />
 */
export const AnimatedShape: React.FC<AnimatedShapeProps> = ({
  shape,
  size = 100,
  fill = '#8b5cf6',
  stroke,
  strokeWidth = 2,
  animation = 'none',
  startFrame = 0,
  durationFrames = 30,
  points = 5,
  innerRadiusRatio = 0.5,
  pieProgress = 1,
  sides = 6,
  rotation = 0,
  glow = false,
  glowColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);
  const isActive = frame >= startFrame;

  // Generate shape path
  const shapePath = React.useMemo(() => {
    const halfSize = size / 2;

    switch (shape) {
      case 'star':
        return makeStar({
          points,
          innerRadius: halfSize * innerRadiusRatio,
          outerRadius: halfSize,
        });

      case 'circle':
        return makeCircle({ radius: halfSize });

      case 'triangle':
        return makeTriangle({
          length: size,
          direction: 'up',
        });

      case 'rect':
        return makeRect({ width: size, height: size });

      case 'pie':
        return makePie({
          radius: halfSize,
          progress: pieProgress,
        });

      case 'polygon':
        return makePolygon({
          points: sides,
          radius: halfSize,
        });

      case 'heart':
        // makeHeart doesn't exist in shapes, create a custom path
        const heartPath = `M 0 ${-halfSize * 0.6}
          C ${halfSize * 0.5} ${-halfSize} ${halfSize} ${-halfSize * 0.5} ${halfSize * 0.5} 0
          C ${halfSize * 0.8} ${halfSize * 0.4} 0 ${halfSize} 0 ${halfSize}
          C 0 ${halfSize} ${-halfSize * 0.8} ${halfSize * 0.4} ${-halfSize * 0.5} 0
          C ${-halfSize} ${-halfSize * 0.5} ${-halfSize * 0.5} ${-halfSize} 0 ${-halfSize * 0.6} Z`;
        return { path: heartPath };

      case 'ellipse':
        return makeEllipse({ rx: halfSize, ry: halfSize * 0.7 });

      default:
        return makeCircle({ radius: halfSize });
    }
  }, [shape, size, points, innerRadiusRatio, pieProgress, sides]);

  // Calculate animation values
  let pathLength = 0;
  let strokeDashoffset = 0;
  let scale = 1;
  let opacity = 1;
  let animRotation = rotation;

  if (shapePath.path) {
    pathLength = getLength(shapePath.path);
  }

  if (!isActive) {
    opacity = 0;
    scale = animation === 'scale' ? 0 : 1;
    strokeDashoffset = pathLength;
  } else {
    const progress = interpolate(
      localFrame,
      [0, durationFrames],
      [0, 1],
      { extrapolateRight: 'clamp' }
    );

    const springValue = spring({
      frame: localFrame,
      fps,
      config: { damping: 15, stiffness: 100 },
    });

    switch (animation) {
      case 'draw':
        // Draw the stroke progressively
        strokeDashoffset = pathLength * (1 - progress);
        opacity = 1;
        break;

      case 'scale':
        scale = springValue;
        opacity = interpolate(springValue, [0, 0.3, 1], [0, 1, 1]);
        break;

      case 'morph':
        // Morph effect using path evolution
        if (shapePath.path) {
          evolvePath(progress, shapePath.path);
          strokeDashoffset = 0;
        }
        break;

      case 'pulse':
        const pulseProgress = (localFrame % 60) / 60;
        const pulse = Math.sin(pulseProgress * Math.PI * 2);
        scale = 1 + pulse * 0.1;
        break;

      case 'rotate':
        animRotation = rotation + localFrame * 2;
        break;

      case 'none':
      default:
        break;
    }
  }

  const effectiveGlowColor = glowColor || fill;
  const glowFilter = glow
    ? `drop-shadow(0 0 ${size * 0.1}px ${effectiveGlowColor}) drop-shadow(0 0 ${size * 0.2}px ${effectiveGlowColor}80)`
    : undefined;

  // Determine if we're drawing stroke or filling
  const isDrawAnimation = animation === 'draw';

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      style={{
        transform: `scale(${scale}) rotate(${animRotation}deg)`,
        opacity,
        filter: glowFilter,
        overflow: 'visible',
      }}
    >
      {/* Background fill (if not draw animation) */}
      {!isDrawAnimation && shapePath.path && (
        <path
          d={shapePath.path}
          fill={fill}
          stroke="none"
        />
      )}

      {/* Stroke (always if stroke color provided, or for draw animation) */}
      {(stroke || isDrawAnimation) && shapePath.path && (
        <path
          d={shapePath.path}
          fill={isDrawAnimation ? 'none' : 'none'}
          stroke={stroke || fill}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={isDrawAnimation ? pathLength : undefined}
          strokeDashoffset={isDrawAnimation ? strokeDashoffset : undefined}
        />
      )}

      {/* Fill that appears after draw animation */}
      {isDrawAnimation && shapePath.path && frame >= startFrame + durationFrames && (
        <path
          d={shapePath.path}
          fill={fill}
          stroke="none"
          opacity={interpolate(
            frame - (startFrame + durationFrames),
            [0, 15],
            [0, 1],
            { extrapolateRight: 'clamp' }
          )}
        />
      )}
    </svg>
  );
};

export default AnimatedShape;
