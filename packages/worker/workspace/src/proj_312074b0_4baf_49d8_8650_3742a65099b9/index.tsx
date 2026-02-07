import React from 'react';
import {
  AbsoluteFill,
  Composition,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  registerRoot,
} from 'remotion';
import { COLORS, SPRING_CONFIG, TIMING, VIDEO_CONFIG, SPHERE_CONFIG, POSITIONS } from './constants';

// =============================================================================
// ANIMATED BACKGROUND
// =============================================================================
const AnimatedBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  // Subtle gradient animation that shifts from warm to cool over the video
  const gradientProgress = interpolate(frame, [0, 73], [0, 1], { extrapolateRight: 'clamp' });
  const warmOpacity = interpolate(gradientProgress, [0, 1], [0.3, 0.1], { extrapolateRight: 'clamp' });
  const coolOpacity = interpolate(gradientProgress, [0, 1], [0.1, 0.3], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Warm gradient at top (fades as video progresses) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: height * 0.5,
          background: `radial-gradient(ellipse at 50% 0%, ${COLORS.primary}${Math.round(warmOpacity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
        }}
      />
      {/* Cool gradient at bottom (grows as video progresses) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: height * 0.5,
          background: `radial-gradient(ellipse at 50% 100%, ${COLORS.accent}${Math.round(coolOpacity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// =============================================================================
// ENERGY PARTICLES (Scene 1 - High State)
// =============================================================================
interface EnergyParticlesProps {
  centerX: number;
  centerY: number;
  startFrame: number;
  color: string;
  count?: number;
}

const EnergyParticles: React.FC<EnergyParticlesProps> = ({
  centerX,
  centerY,
  startFrame,
  color,
  count = 12
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const delay = i * 3;
        const particleFrame = frame - startFrame - delay;

        if (particleFrame < 0) return null;

        const angle = (i / count) * Math.PI * 2;
        const baseRadius = 100;
        const expandProgress = spring({
          frame: particleFrame,
          fps,
          config: { damping: 25, stiffness: 60, mass: 1.2 },
        });

        const radius = baseRadius + expandProgress * 80;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        const opacity = interpolate(
          expandProgress,
          [0, 0.3, 1],
          [0, 0.8, 0],
          { extrapolateRight: 'clamp' }
        );

        const size = interpolate(
          expandProgress,
          [0, 0.5, 1],
          [8, 16, 6],
          { extrapolateRight: 'clamp' }
        );

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: color,
              opacity,
              boxShadow: `0 0 ${size * 2}px ${color}`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}
    </>
  );
};

// =============================================================================
// LUMINOUS SPHERE
// =============================================================================
interface LuminousSphereProps {
  x: number;
  y: number;
  scale: number;
  color: string;
  glowIntensity: number;
}

const LuminousSphere: React.FC<LuminousSphereProps> = ({
  x,
  y,
  scale,
  color,
  glowIntensity
}) => {
  const radius = SPHERE_CONFIG.baseRadius * scale;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: radius * 2,
        height: radius * 2,
        borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%,
          ${color}ff 0%,
          ${color}cc 40%,
          ${color}88 70%,
          ${color}44 100%)`,
        transform: 'translate(-50%, -50%)',
        boxShadow: `
          0 0 ${40 * glowIntensity}px ${color}88,
          0 0 ${80 * glowIntensity}px ${color}66,
          0 0 ${120 * glowIntensity}px ${color}44
        `,
      }}
    />
  );
};

// =============================================================================
// SCENE 1: HIGH STATE
// =============================================================================
const Scene1High: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Sphere entrance with spring bounce
  const entranceProgress = spring({
    frame,
    fps,
    config: SPRING_CONFIG,
  });

  // Peak glow at frame 34 (key sync for "High")
  const glowIntensity = interpolate(
    frame,
    [0, TIMING.highWordSync - 5, TIMING.highWordSync, 40],
    [0.5, 0.8, 1.2, 1.0],
    { extrapolateRight: 'clamp' }
  );

  // Sphere position
  const sphereX = width / 2;
  const sphereY = height * (1 - POSITIONS.highY); // Convert from "from bottom" to "from top"

  // Scale builds up to peak at sync
  const scale = interpolate(
    entranceProgress,
    [0, 1],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  // Text animation
  const textOpacity = interpolate(
    frame,
    [15, 30],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  const textY = interpolate(
    frame,
    [15, 30],
    [height * 0.12, height * 0.08],
    { extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill>
      {/* Energy particles */}
      <EnergyParticles
        centerX={sphereX}
        centerY={sphereY}
        startFrame={10}
        color={COLORS.primary}
        count={12}
      />

      {/* Main sphere */}
      <LuminousSphere
        x={sphereX}
        y={sphereY}
        scale={scale}
        color={COLORS.primary}
        glowIntensity={glowIntensity}
      />

      {/* HIGH text */}
      <div
        style={{
          position: 'absolute',
          top: textY,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: textOpacity,
        }}
      >
        <span
          style={{
            fontSize: height * 0.06,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '0.15em',
            textShadow: `0 0 30px ${COLORS.primary}, 0 0 60px ${COLORS.primary}88`,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          HIGH
        </span>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// TRAILING PARTICLES (Scene 2 - Descent Trail)
// =============================================================================
interface TrailingParticlesProps {
  startY: number;
  endY: number;
  centerX: number;
  progress: number;
  count?: number;
}

const TrailingParticles: React.FC<TrailingParticlesProps> = ({
  startY,
  endY,
  centerX,
  progress,
  count = 8
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        // Each particle trails behind the main sphere
        const particleProgress = Math.max(0, progress - (i * 0.08));
        const y = interpolate(
          particleProgress,
          [0, 1],
          [startY, endY],
          { extrapolateRight: 'clamp' }
        );

        // Fade and shrink as they trail
        const opacity = interpolate(
          i,
          [0, count - 1],
          [0.6, 0.1],
          { extrapolateRight: 'clamp' }
        );

        const size = interpolate(
          i,
          [0, count - 1],
          [20, 8],
          { extrapolateRight: 'clamp' }
        );

        // Color based on particle position in trail
        const particleColor = particleProgress < 0.5 ? COLORS.primary : COLORS.accent;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: centerX,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: particleColor,
              opacity: opacity * (progress > 0.1 ? 1 : 0),
              transform: 'translate(-50%, -50%)',
              filter: `blur(${i * 0.5}px)`,
            }}
          />
        );
      })}
    </>
  );
};

// =============================================================================
// SCENE 2: TRANSITION AND LOW STATE
// =============================================================================
const Scene2Low: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Scene 2 starts at frame 41, so internal frame starts at 0
  // Key syncs: "and" at frame 52 (internal 11), "low" at frame 55 (internal 14)
  const lowSyncFrame = TIMING.lowWordSync - TIMING.scene2Start; // 14

  // Calculate positions
  const highY = height * (1 - POSITIONS.highY); // 20% from top (high position)
  const lowY = height * (1 - POSITIONS.lowY);   // 80% from top (low position)
  const sphereX = width / 2;

  // Descent animation - starts at scene start, reaches final position at "low" sync
  const descentDuration = lowSyncFrame;
  const descentProgress = interpolate(
    frame,
    [0, descentDuration],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  // Apply easing for natural gravitational feel
  const easedProgress = descentProgress * descentProgress; // Quadratic easing for acceleration

  // Sphere Y position
  const sphereY = interpolate(
    easedProgress,
    [0, 1],
    [highY, lowY],
    { extrapolateRight: 'clamp' }
  );

  // Settle bounce after reaching position
  const settleProgress = spring({
    frame: Math.max(0, frame - lowSyncFrame),
    fps,
    config: { damping: 28, stiffness: 120, mass: 0.8 },
  });

  // Add subtle bounce to final position
  const settleOffset = frame > lowSyncFrame
    ? interpolate(settleProgress, [0, 0.5, 1], [10, -5, 0], { extrapolateRight: 'clamp' })
    : 0;

  const finalY = sphereY + settleOffset;

  // Color transition from coral to blue
  const colorProgress = interpolate(
    frame,
    [0, lowSyncFrame],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  // Blend colors manually - use primary early, accent later
  const sphereColor = colorProgress < 0.5 ? COLORS.primary : COLORS.accent;

  // Scale reduction from 1.0 to 0.6
  const scale = interpolate(
    frame,
    [0, lowSyncFrame],
    [SPHERE_CONFIG.highScale, SPHERE_CONFIG.lowScale],
    { extrapolateRight: 'clamp' }
  );

  // Glow intensity - subtle at low position
  const glowIntensity = interpolate(
    frame,
    [0, lowSyncFrame, lowSyncFrame + 10],
    [1.0, 0.6, 0.8],
    { extrapolateRight: 'clamp' }
  );

  // HIGH text fades out
  const highTextOpacity = interpolate(
    frame,
    [0, 10],
    [1, 0],
    { extrapolateRight: 'clamp' }
  );

  // LOW text fades in after sphere settles
  const lowTextOpacity = interpolate(
    frame,
    [lowSyncFrame, lowSyncFrame + 15],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  const lowTextY = interpolate(
    frame,
    [lowSyncFrame, lowSyncFrame + 15],
    [height * 0.88, height * 0.85],
    { extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill>
      {/* Trailing particles during descent */}
      <TrailingParticles
        startY={highY}
        endY={lowY}
        centerX={sphereX}
        progress={easedProgress}
        count={8}
      />

      {/* Main sphere */}
      <LuminousSphere
        x={sphereX}
        y={finalY}
        scale={scale}
        color={sphereColor}
        glowIntensity={glowIntensity}
      />

      {/* HIGH text fading out */}
      <div
        style={{
          position: 'absolute',
          top: height * 0.08,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: highTextOpacity,
        }}
      >
        <span
          style={{
            fontSize: height * 0.06,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '0.15em',
            textShadow: `0 0 30px ${COLORS.primary}, 0 0 60px ${COLORS.primary}88`,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          HIGH
        </span>
      </div>

      {/* LOW text appearing */}
      <div
        style={{
          position: 'absolute',
          top: lowTextY,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: lowTextOpacity,
        }}
      >
        <span
          style={{
            fontSize: height * 0.06,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '0.15em',
            textShadow: `0 0 30px ${COLORS.accent}, 0 0 60px ${COLORS.accent}88`,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          LOW
        </span>
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// MAIN COMPOSITION
// =============================================================================
const MainComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <AnimatedBackground key="bg" />

      {/* Scene 1: High State (frames 0-40) */}
      <Sequence key="scene1-high" from={0} durationInFrames={41}>
        <Scene1High />
      </Sequence>

      {/* Scene 2: Transition and Low State (frames 41-73) */}
      <Sequence key="scene2-low" from={41} durationInFrames={32}>
        <Scene2Low />
      </Sequence>
    </AbsoluteFill>
  );
};

// =============================================================================
// REMOTION ROOT
// =============================================================================
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="proj_312074b0_4baf_49d8_8650_3742a65099b9"
      component={MainComposition}
      durationInFrames={VIDEO_CONFIG.durationInFrames}
      fps={VIDEO_CONFIG.fps}
      width={VIDEO_CONFIG.width}
      height={VIDEO_CONFIG.height}
    />
  );
};

// CRITICAL: Export MainComposition as default (NOT RemotionRoot!)
export default MainComposition;

// Register root for Remotion bundler (required for SSR rendering)
registerRoot(RemotionRoot);
