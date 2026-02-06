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
import { ThreeCanvas } from '@remotion/three';
import { COLORS, SPRING_CONFIG, TIMING, VIDEO } from './constants';

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

const AnimatedBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const gradientPosition = Math.sin(frame * 0.01) * 10 + 50;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% ${gradientPosition}%, ${COLORS.secondary}22 0%, ${COLORS.dark} 70%)`,
      }}
    />
  );
};

interface CommentBallProps {
  x: number;
  y: number;
  size?: number;
  isWinner?: boolean;
  opacity?: number;
  delay?: number;
}

const CommentBall: React.FC<CommentBallProps> = ({
  x,
  y,
  size = 40,
  isWinner = false,
  opacity = 1,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame: frame - delay, fps, config: SPRING_CONFIG });
  const color = isWinner ? COLORS.accent : COLORS.primary;
  const glowColor = isWinner ? COLORS.accent : COLORS.primary;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${color}, ${color}88)`,
        boxShadow: `0 0 ${size * 0.5}px ${glowColor}88, 0 0 ${size}px ${glowColor}44`,
        opacity: opacity * Math.min(scale, 1),
        transform: `scale(${Math.min(scale, 1)})`,
      }}
    />
  );
};

interface MemoryBucketProps {
  width: number;
  height: number;
  x: number;
  y: number;
  showCracks?: boolean;
  slots?: number;
}

const MemoryBucket: React.FC<MemoryBucketProps> = ({
  width,
  height,
  x,
  y,
  showCracks = false,
  slots = 1,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y - height / 2,
        width,
        height,
        background: COLORS.glass,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `2px solid ${showCracks ? COLORS.warning : COLORS.glassStroke}`,
        borderRadius: 16,
        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 20px ${showCracks ? COLORS.warning + '22' : 'transparent'}`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {Array.from({ length: slots }).map((_, i) => (
        <div
          key={i}
          style={{
            width: (width - 32) / slots - 8,
            height: height - 32,
            border: `1px dashed ${COLORS.glassStroke}`,
            borderRadius: 8,
          }}
        />
      ))}
    </div>
  );
};

// ============================================================================
// SCENE 1: THE SCENARIO SETUP
// ============================================================================

const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Title animation
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 30], [-50, 0], { extrapolateRight: 'clamp' });

  // Key sync: "millions" at frame 129 - balls multiply
  const keySyncFrame = 129;
  const ballMultiplier = frame < keySyncFrame ? 1 : interpolate(
    frame,
    [keySyncFrame, keySyncFrame + 30],
    [1, 4],
    { extrapolateRight: 'clamp' }
  );

  // Calculate number of balls based on progression
  const baseBallCount = 8;
  const totalBalls = Math.floor(baseBallCount * ballMultiplier);

  // Bucket animation
  const bucketScale = spring({ frame: frame - 15, fps, config: SPRING_CONFIG });
  const bucketWidth = width * 0.2;
  const bucketHeight = height * 0.12;
  const bucketY = height * 0.78;

  // Generate falling ball positions
  const balls = Array.from({ length: totalBalls }).map((_, i) => {
    const seed = i * 137.5; // Golden angle for distribution
    const startX = ((seed * 7) % (width * 0.7)) + width * 0.15;
    const startDelay = (i * 12) % 100;
    const cycleLength = 180;
    const progress = ((frame - startDelay) % cycleLength) / cycleLength;
    const y = progress * (height * 0.65) + height * 0.1;
    const x = startX + Math.sin(progress * Math.PI * 2 + i) * 30;
    const opacity = interpolate(progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0], { extrapolateRight: 'clamp' });

    return { x, y, opacity, delay: i * 2 };
  });

  return (
    <AbsoluteFill>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: height * 0.15,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <h1
          style={{
            fontSize: height * 0.045,
            fontWeight: 800,
            color: COLORS.white,
            letterSpacing: 4,
            textTransform: 'uppercase',
            margin: 0,
            textShadow: `0 0 40px ${COLORS.primary}66`,
          }}
        >
          GIVEAWAY SYSTEM
        </h1>
      </div>

      {/* Stream interface header */}
      <div
        style={{
          position: 'absolute',
          top: height * 0.05,
          left: width * 0.1,
          right: width * 0.1,
          height: height * 0.06,
          background: COLORS.glass,
          backdropFilter: 'blur(10px)',
          borderRadius: 12,
          border: `1px solid ${COLORS.glassStroke}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 12,
          opacity: interpolate(frame, [5, 25], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#27ca3f' }} />
        <span style={{ color: COLORS.white, fontSize: 18, marginLeft: 16, opacity: 0.7 }}>
          live_stream.exe
        </span>
      </div>

      {/* Falling comment balls */}
      {balls.map((ball, i) => (
        <CommentBall
          key={i}
          x={ball.x}
          y={ball.y}
          size={30 + (i % 3) * 8}
          opacity={ball.opacity}
          delay={ball.delay}
        />
      ))}

      {/* Memory bucket */}
      <div style={{ transform: `scale(${Math.min(bucketScale, 1)})` }}>
        <MemoryBucket
          width={bucketWidth}
          height={bucketHeight}
          x={width / 2}
          y={bucketY}
        />
      </div>

      {/* Label under bucket */}
      <div
        style={{
          position: 'absolute',
          bottom: height * 0.12,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <span
          style={{
            fontSize: height * 0.02,
            color: COLORS.white,
            opacity: 0.6,
            letterSpacing: 2,
          }}
        >
          MEMORY
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 2: THE MEMORY CRISIS
// ============================================================================

const WarningIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 60,
  color = COLORS.warning,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={`${color}22`}
    />
  </svg>
);

const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Bucket expands during crisis
  const bucketWidthProgress = interpolate(frame, [0, 120], [0.2, 0.6], { extrapolateRight: 'clamp' });
  const bucketWidth = width * bucketWidthProgress;
  const bucketHeight = height * 0.15;
  const bucketY = height * 0.6;

  // Stress cracks appear progressively
  const crackOpacity = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: 'clamp' });

  // Warning pulse (using frame for consistent timing)
  const warningPulse = interpolate(
    (frame % 30) / 30,
    [0, 0.5, 1],
    [0.6, 1, 0.6],
    { extrapolateRight: 'clamp' }
  );

  // Dense comment rain
  const ballCount = 40;
  const balls = Array.from({ length: ballCount }).map((_, i) => {
    const seed = i * 137.5;
    const startX = ((seed * 7) % (width * 0.8)) + width * 0.1;
    const startDelay = (i * 8) % 60;
    const cycleLength = 90; // Faster fall
    const progress = ((frame - startDelay) % cycleLength) / cycleLength;
    const y = progress * (height * 0.5) + height * 0.08;
    const x = startX + Math.sin(progress * Math.PI * 2 + i) * 20;
    const opacity = interpolate(progress, [0, 0.1, 0.85, 1], [0, 1, 1, 0], { extrapolateRight: 'clamp' });

    return { x, y, opacity, delay: i };
  });

  // Overflow balls scattered at bucket base
  const overflowBalls = Array.from({ length: 20 }).map((_, i) => {
    const appearFrame = 60 + i * 4;
    const progress = spring({
      frame: frame - appearFrame,
      fps,
      config: { damping: 25, stiffness: 80, mass: 1 },
    });
    const angle = (i / 20) * Math.PI + Math.PI;
    const radius = 80 + (i % 5) * 30;
    const x = width / 2 + Math.cos(angle) * radius * progress;
    const y = bucketY + bucketHeight / 2 + 30 + Math.abs(Math.sin(angle)) * 60 * progress;
    const opacity = interpolate(frame - appearFrame, [0, 10], [0, 0.8], { extrapolateRight: 'clamp' });

    return { x, y, opacity, size: 20 + (i % 4) * 8 };
  });

  // Crack lines on bucket
  const cracks = [
    { x1: 0.2, y1: 0.3, x2: 0.4, y2: 0.1, delay: 0 },
    { x1: 0.8, y1: 0.2, x2: 0.6, y2: 0.5, delay: 10 },
    { x1: 0.1, y1: 0.7, x2: 0.3, y2: 0.9, delay: 20 },
    { x1: 0.9, y1: 0.6, x2: 0.7, y2: 0.8, delay: 30 },
  ];

  return (
    <AbsoluteFill>
      {/* Warning text */}
      <div
        style={{
          position: 'absolute',
          top: height * 0.12,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <WarningIcon size={50} />
          <h1
            style={{
              fontSize: height * 0.04,
              fontWeight: 800,
              color: COLORS.warning,
              letterSpacing: 4,
              textTransform: 'uppercase',
              margin: 0,
              opacity: warningPulse,
              textShadow: `0 0 30px ${COLORS.warning}88`,
            }}
          >
            MEMORY OVERFLOW
          </h1>
          <WarningIcon size={50} />
        </div>
      </div>

      {/* Falling comment balls (dense) */}
      {balls.map((ball, i) => (
        <CommentBall
          key={`fall-${i}`}
          x={ball.x}
          y={ball.y}
          size={24 + (i % 3) * 6}
          opacity={ball.opacity}
          delay={ball.delay}
        />
      ))}

      {/* Expanding bucket with cracks */}
      <div
        style={{
          position: 'absolute',
          left: width / 2 - bucketWidth / 2,
          top: bucketY - bucketHeight / 2,
          width: bucketWidth,
          height: bucketHeight,
          background: COLORS.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `3px solid ${COLORS.warning}`,
          borderRadius: 16,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 40px ${COLORS.warning}33, 0 0 60px ${COLORS.warning}22`,
          overflow: 'hidden',
        }}
      >
        {/* Stress cracks */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: crackOpacity,
          }}
        >
          {cracks.map((crack, i) => {
            const lineProgress = interpolate(
              frame - crack.delay - 30,
              [0, 20],
              [0, 1],
              { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
            );
            return (
              <line
                key={i}
                x1={`${crack.x1 * 100}%`}
                y1={`${crack.y1 * 100}%`}
                x2={`${crack.x1 + (crack.x2 - crack.x1) * lineProgress * 100}%`}
                y2={`${crack.y1 + (crack.y2 - crack.y1) * lineProgress * 100}%`}
                stroke={COLORS.warning}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Balls inside bucket */}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            right: 10,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            justifyContent: 'center',
          }}
        >
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 20 + (i % 3) * 5,
                height: 20 + (i % 3) * 5,
                borderRadius: '50%',
                background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.primary}88)`,
                boxShadow: `0 0 10px ${COLORS.primary}66`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Overflow balls */}
      {overflowBalls.map((ball, i) => (
        <CommentBall
          key={`overflow-${i}`}
          x={ball.x}
          y={ball.y}
          size={ball.size}
          opacity={ball.opacity}
        />
      ))}

      {/* RAM text indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: height * 0.2,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(frame, [80, 110], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <span
          style={{
            fontSize: height * 0.025,
            color: COLORS.warning,
            letterSpacing: 3,
            fontWeight: 600,
            textShadow: `0 0 20px ${COLORS.warning}66`,
          }}
        >
          OUT OF RAM
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 3: THE SOLUTION REVEAL
// ============================================================================

const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Key sync: "reservoir sampling" at frame 883 (absolute), scene starts at 830
  // Relative frame = 883 - 830 = 53
  const keySyncFrame = 53;

  // Fade in from dark
  const fadeIn = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });

  // Bucket entrance with spring
  const bucketProgress = spring({
    frame: frame - 20,
    fps,
    config: SPRING_CONFIG,
  });
  const bucketWidth = width * 0.3;
  const bucketHeight = height * 0.18;
  const bucketY = height * 0.55;

  // Winner ball entrance and pulse
  const ballProgress = spring({
    frame: frame - 35,
    fps,
    config: SPRING_CONFIG,
  });
  const ballPulse = interpolate(
    (frame % 60) / 60,
    [0, 0.5, 1],
    [1, 1.1, 1],
    { extrapolateRight: 'clamp' }
  );

  // Title reveal at key sync
  const titleText = 'RESERVOIR SAMPLING';

  // Subtitle after title
  const subtitleOpacity = interpolate(
    frame - keySyncFrame - 30,
    [0, 20],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      {/* Title with character reveal */}
      <div
        style={{
          position: 'absolute',
          top: height * 0.18,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: height * 0.05,
            fontWeight: 800,
            color: COLORS.white,
            letterSpacing: 6,
            margin: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          {titleText.split('').map((char, i) => {
            const charDelay = i * 2;
            const charProgress = interpolate(
              frame - keySyncFrame - charDelay,
              [0, 15],
              [0, 1],
              { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
            );
            return (
              <span
                key={i}
                style={{
                  opacity: charProgress,
                  transform: `translateY(${(1 - charProgress) * 20}px)`,
                  display: 'inline-block',
                  textShadow: `0 0 30px ${COLORS.primary}88`,
                }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            );
          })}
        </h1>
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: 'absolute',
          top: height * 0.26,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: subtitleOpacity,
        }}
      >
        <p
          style={{
            fontSize: height * 0.025,
            color: COLORS.primary,
            letterSpacing: 3,
            margin: 0,
            fontWeight: 500,
            textShadow: `0 0 20px ${COLORS.primary}66`,
          }}
        >
          One variable. Infinite fairness.
        </p>
      </div>

      {/* Clean bucket with golden winner */}
      <div
        style={{
          position: 'absolute',
          left: width / 2 - bucketWidth / 2,
          top: bucketY - bucketHeight / 2,
          width: bucketWidth,
          height: bucketHeight,
          background: COLORS.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `2px solid ${COLORS.glassStroke}`,
          borderRadius: 20,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 60px ${COLORS.accent}22`,
          transform: `scale(${Math.min(bucketProgress, 1)})`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Golden winner ball */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${COLORS.accent}, ${COLORS.accent}88)`,
            boxShadow: `0 0 40px ${COLORS.accent}88, 0 0 80px ${COLORS.accent}44`,
            transform: `scale(${Math.min(ballProgress, 1) * ballPulse})`,
          }}
        />
      </div>

      {/* Label */}
      <div
        style={{
          position: 'absolute',
          top: bucketY + bucketHeight / 2 + 30,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(frame, [50, 70], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <span
          style={{
            fontSize: height * 0.018,
            color: COLORS.accent,
            letterSpacing: 3,
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          Current Winner
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 4: ALGORITHM MECHANICS (3D DICE)
// ============================================================================

// 3D Dice Component using @remotion/three
const Dice3D: React.FC<{ rotation: number; scale: number; size: number }> = ({ rotation, scale, size }) => {
  return (
    <ThreeCanvas
      width={size}
      height={size}
      camera={{ position: [0, 0, 5], fov: 50 }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-5, -5, 5]} intensity={0.5} color={COLORS.primary} />
      <mesh rotation={[rotation * 0.7, rotation, rotation * 0.3]} scale={scale}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial
          color={COLORS.accent}
          metalness={0.3}
          roughness={0.4}
          emissive={COLORS.accent}
          emissiveIntensity={0.1}
        />
      </mesh>
    </ThreeCanvas>
  );
};

const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Key sync: "die" at frame 1089 (absolute), scene starts at 1035
  // Relative frame = 1089 - 1035 = 54
  const keySyncFrame = 54;

  // Scene duration is 1606 - 1035 = 571 frames
  // We'll show multiple iterations of the algorithm
  const iterationLength = 120; // frames per iteration
  const currentIteration = Math.floor(frame / iterationLength);
  const iterationFrame = frame % iterationLength;

  // n value increases with each iteration (starting at 2)
  const n = Math.min(currentIteration + 2, 10);

  // Bucket setup
  const bucketWidth = width * 0.3;
  const bucketHeight = height * 0.15;
  const bucketY = height * 0.7;

  // New comment ball approaching
  const ballApproachProgress = interpolate(
    iterationFrame,
    [0, 60],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );
  const newBallY = height * 0.15 + ballApproachProgress * (height * 0.35);
  const newBallOpacity = interpolate(iterationFrame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // Dice appears at key sync frame (only on first iteration)
  const diceAppearFrame = frame < iterationLength ? keySyncFrame : 20;
  const diceProgress = spring({
    frame: iterationFrame - diceAppearFrame,
    fps,
    config: SPRING_CONFIG,
  });
  const diceRotation = iterationFrame * 0.08;
  const diceScale = Math.min(diceProgress, 1) * 1.5;

  // Dice result (random based on iteration)
  const diceRollFrame = diceAppearFrame + 40;
  const diceResult = (currentIteration * 7 + 3) % n; // Deterministic "random"
  const isWinner = diceResult === 0; // Win if result is 0 (1/n chance)

  // Winner replacement animation
  const replacementProgress = interpolate(
    iterationFrame - diceRollFrame - 20,
    [0, 30],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  // Current winner ball (may get replaced)
  const winnerBallScale = isWinner
    ? interpolate(replacementProgress, [0, 0.5, 1], [1, 0.5, 1], { extrapolateRight: 'clamp' })
    : 1;

  return (
    <AbsoluteFill>
      {/* Probability display on left */}
      <div
        style={{
          position: 'absolute',
          left: width * 0.08,
          top: height * 0.35,
          width: width * 0.25,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: height * 0.03,
            color: COLORS.white,
            opacity: 0.7,
            marginBottom: 10,
          }}
        >
          PROBABILITY
        </div>
        <div
          style={{
            fontSize: height * 0.08,
            fontWeight: 800,
            color: COLORS.primary,
            textShadow: `0 0 30px ${COLORS.primary}88`,
          }}
        >
          1/{n}
        </div>
        <div
          style={{
            fontSize: height * 0.02,
            color: COLORS.white,
            opacity: 0.5,
            marginTop: 15,
          }}
        >
          n = {n} comments
        </div>
      </div>

      {/* New comment ball approaching */}
      <div
        style={{
          position: 'absolute',
          left: width / 2 - 30,
          top: newBallY - 30,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.primary}88)`,
          boxShadow: `0 0 30px ${COLORS.primary}88`,
          opacity: newBallOpacity * (1 - replacementProgress),
        }}
      />

      {/* Label for new ball */}
      <div
        style={{
          position: 'absolute',
          left: width / 2,
          top: newBallY + 45,
          transform: 'translateX(-50%)',
          fontSize: height * 0.018,
          color: COLORS.primary,
          opacity: newBallOpacity * (1 - replacementProgress),
          whiteSpace: 'nowrap',
        }}
      >
        Comment #{n}
      </div>

      {/* 3D Dice on right */}
      <div
        style={{
          position: 'absolute',
          right: width * 0.08,
          top: height * 0.3,
          width: width * 0.22,
          height: width * 0.22,
          opacity: Math.min(diceProgress, 1),
        }}
      >
        <Dice3D rotation={diceRotation} scale={diceScale} size={Math.round(width * 0.22)} />
        {/* Dice result indicator */}
        {iterationFrame > diceRollFrame && (
          <div
            style={{
              position: 'absolute',
              bottom: -40,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: height * 0.025,
              fontWeight: 700,
              color: isWinner ? COLORS.accent : COLORS.warning,
              textShadow: `0 0 20px ${isWinner ? COLORS.accent : COLORS.warning}88`,
            }}
          >
            {isWinner ? 'REPLACE!' : 'KEEP'}
          </div>
        )}
      </div>

      {/* Bucket with current winner */}
      <div
        style={{
          position: 'absolute',
          left: width / 2 - bucketWidth / 2,
          top: bucketY - bucketHeight / 2,
          width: bucketWidth,
          height: bucketHeight,
          background: COLORS.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `2px solid ${COLORS.glassStroke}`,
          borderRadius: 20,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 40px ${COLORS.accent}22`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Winner ball */}
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: '50%',
            background: isWinner && replacementProgress > 0.5
              ? `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.primary}88)`
              : `radial-gradient(circle at 30% 30%, ${COLORS.accent}, ${COLORS.accent}88)`,
            boxShadow: `0 0 30px ${isWinner && replacementProgress > 0.5 ? COLORS.primary : COLORS.accent}88`,
            transform: `scale(${winnerBallScale})`,
          }}
        />
      </div>

      {/* Label under bucket */}
      <div
        style={{
          position: 'absolute',
          top: bucketY + bucketHeight / 2 + 20,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontSize: height * 0.018,
            color: COLORS.accent,
            letterSpacing: 2,
            fontWeight: 600,
          }}
        >
          RESERVOIR (k=1)
        </span>
      </div>

      {/* Iteration indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: height * 0.08,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontSize: height * 0.02,
            color: COLORS.white,
            opacity: 0.5,
          }}
        >
          Step {currentIteration + 1}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 5: MATHEMATICAL FAIRNESS PROOF
// ============================================================================

const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Ball entrance animations (staggered)
  const leftBallProgress = spring({
    frame: frame - 10,
    fps,
    config: SPRING_CONFIG,
  });
  const rightBallProgress = spring({
    frame: frame - 25,
    fps,
    config: SPRING_CONFIG,
  });

  // Formula entrance
  const formulaProgress = spring({
    frame: frame - 40,
    fps,
    config: SPRING_CONFIG,
  });

  // Synchronized golden pulse (both balls pulse together)
  const pulsePhase = (frame % 45) / 45;
  const pulseIntensity = interpolate(
    pulsePhase,
    [0, 0.5, 1],
    [0.7, 1, 0.7],
    { extrapolateRight: 'clamp' }
  );

  // Equal sign pulse after delay
  const equalPulse = frame > 60 ? interpolate(
    ((frame - 60) % 30) / 30,
    [0, 0.5, 1],
    [1, 1.3, 1],
    { extrapolateRight: 'clamp' }
  ) : 1;

  const ballSize = 100;
  const leftX = width * 0.25;
  const rightX = width * 0.75;
  const ballY = height * 0.45;

  return (
    <AbsoluteFill>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: height * 0.12,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <h1
          style={{
            fontSize: height * 0.035,
            fontWeight: 700,
            color: COLORS.white,
            letterSpacing: 3,
            margin: 0,
            textShadow: `0 0 30px ${COLORS.primary}44`,
          }}
        >
          EQUAL PROBABILITY
        </h1>
      </div>

      {/* Left ball - 1st Commenter */}
      <div
        style={{
          position: 'absolute',
          left: leftX - ballSize / 2,
          top: ballY - ballSize / 2,
          transform: `scale(${Math.min(leftBallProgress, 1)})`,
        }}
      >
        <div
          style={{
            width: ballSize,
            height: ballSize,
            borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${COLORS.accent}, ${COLORS.accent}88)`,
            boxShadow: `0 0 ${40 * pulseIntensity}px ${COLORS.accent}aa, 0 0 ${80 * pulseIntensity}px ${COLORS.accent}55`,
            transform: `scale(${pulseIntensity})`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: ballSize + 20,
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontSize: height * 0.022, color: COLORS.white, fontWeight: 600 }}>
            1st COMMENTER
          </div>
          <div style={{ fontSize: height * 0.016, color: COLORS.primary, marginTop: 8, opacity: 0.8 }}>
            Joined first
          </div>
        </div>
      </div>

      {/* Center formula */}
      <div
        style={{
          position: 'absolute',
          left: width / 2,
          top: height * 0.38,
          transform: `translateX(-50%) scale(${Math.min(formulaProgress, 1)})`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: height * 0.06,
            fontWeight: 800,
            color: COLORS.white,
            textShadow: `0 0 40px ${COLORS.primary}66`,
          }}
        >
          P = 1/n
        </div>
        <div
          style={{
            fontSize: height * 0.09,
            fontWeight: 800,
            color: COLORS.accent,
            marginTop: 20,
            transform: `scale(${equalPulse})`,
            textShadow: `0 0 30px ${COLORS.accent}88`,
          }}
        >
          =
        </div>
      </div>

      {/* Right ball - Millionth Commenter */}
      <div
        style={{
          position: 'absolute',
          left: rightX - ballSize / 2,
          top: ballY - ballSize / 2,
          transform: `scale(${Math.min(rightBallProgress, 1)})`,
        }}
      >
        <div
          style={{
            width: ballSize,
            height: ballSize,
            borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${COLORS.accent}, ${COLORS.accent}88)`,
            boxShadow: `0 0 ${40 * pulseIntensity}px ${COLORS.accent}aa, 0 0 ${80 * pulseIntensity}px ${COLORS.accent}55`,
            transform: `scale(${pulseIntensity})`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: ballSize + 20,
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontSize: height * 0.022, color: COLORS.white, fontWeight: 600 }}>
            1,000,000th COMMENTER
          </div>
          <div style={{ fontSize: height * 0.016, color: COLORS.primary, marginTop: 8, opacity: 0.8 }}>
            Joined last
          </div>
        </div>
      </div>

      {/* Connection line */}
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
        <line
          x1={leftX + ballSize / 2 + 20}
          y1={ballY}
          x2={rightX - ballSize / 2 - 20}
          y2={ballY}
          stroke={COLORS.accent}
          strokeWidth={2}
          strokeDasharray="10,10"
          opacity={interpolate(frame, [50, 70], [0, 0.4], { extrapolateRight: 'clamp' })}
        />
      </svg>

      {/* Bottom text */}
      <div
        style={{
          position: 'absolute',
          bottom: height * 0.12,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(frame, [70, 90], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <p
          style={{
            fontSize: height * 0.022,
            color: COLORS.primary,
            margin: 0,
            letterSpacing: 2,
          }}
        >
          Same chance to win. Always fair.
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 6: THE CHALLENGE
// ============================================================================

const Scene6: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Key sync: "five" at frame 1849 (absolute), scene starts at 1715
  // Relative frame = 1849 - 1715 = 134
  const keySyncFrame = 134;

  // Bucket expansion at key sync
  const bucketExpansionProgress = interpolate(
    frame - keySyncFrame,
    [0, 40],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  const bucketWidth = interpolate(
    bucketExpansionProgress,
    [0, 1],
    [width * 0.3, width * 0.6],
    { extrapolateRight: 'clamp' }
  );
  const bucketHeight = height * 0.15;
  const bucketY = height * 0.55;

  // Initial single winner ball
  const singleBallOpacity = interpolate(
    bucketExpansionProgress,
    [0, 0.5],
    [1, 0],
    { extrapolateRight: 'clamp' }
  );

  // Question mark animation
  const questionProgress = spring({
    frame: frame - 30,
    fps,
    config: SPRING_CONFIG,
  });
  const questionPulse = interpolate(
    (frame % 40) / 40,
    [0, 0.5, 1],
    [1, 1.15, 1],
    { extrapolateRight: 'clamp' }
  );

  // Approaching balls from different angles
  const approachingBalls = Array.from({ length: 8 }).map((_, i) => {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const startRadius = 400;
    const endRadius = 180;
    const progress = interpolate(
      frame - (i * 8),
      [40, 120],
      [0, 1],
      { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
    );
    const radius = startRadius - (startRadius - endRadius) * progress;
    const x = width / 2 + Math.cos(angle) * radius;
    const y = bucketY - 100 + Math.sin(angle) * (radius * 0.3);
    const opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' });

    return { x, y, opacity, size: 35 + (i % 3) * 8 };
  });

  // Challenge text
  const textOpacity = interpolate(
    frame - keySyncFrame - 30,
    [0, 25],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  return (
    <AbsoluteFill>
      {/* Question mark */}
      <div
        style={{
          position: 'absolute',
          left: width / 2,
          top: height * 0.25,
          transform: `translateX(-50%) scale(${Math.min(questionProgress, 1) * questionPulse})`,
          fontSize: height * 0.15,
          fontWeight: 800,
          color: COLORS.accent,
          textShadow: `0 0 60px ${COLORS.accent}88, 0 0 120px ${COLORS.accent}44`,
        }}
      >
        ?
      </div>

      {/* Approaching balls */}
      {approachingBalls.map((ball, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: ball.x - ball.size / 2,
            top: ball.y - ball.size / 2,
            width: ball.size,
            height: ball.size,
            borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.primary}88)`,
            boxShadow: `0 0 20px ${COLORS.primary}88`,
            opacity: ball.opacity,
          }}
        />
      ))}

      {/* Expanding bucket with 5 slots */}
      <div
        style={{
          position: 'absolute',
          left: width / 2 - bucketWidth / 2,
          top: bucketY - bucketHeight / 2,
          width: bucketWidth,
          height: bucketHeight,
          background: COLORS.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `2px solid ${COLORS.glassStroke}`,
          borderRadius: 20,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 40px ${COLORS.accent}22`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 10,
          padding: '0 15px',
        }}
      >
        {/* Single winner before expansion */}
        {bucketExpansionProgress < 0.5 && (
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${COLORS.accent}, ${COLORS.accent}88)`,
              boxShadow: `0 0 30px ${COLORS.accent}88`,
              opacity: singleBallOpacity,
            }}
          />
        )}

        {/* 5 compartments after expansion */}
        {bucketExpansionProgress > 0 && Array.from({ length: 5 }).map((_, i) => {
          const slotProgress = spring({
            frame: frame - keySyncFrame - 10 - (i * 6),
            fps,
            config: SPRING_CONFIG,
          });
          const slotWidth = (bucketWidth - 60) / 5;

          return (
            <div
              key={i}
              style={{
                width: slotWidth,
                height: bucketHeight - 30,
                border: `2px dashed ${COLORS.glassStroke}`,
                borderRadius: 12,
                opacity: Math.min(slotProgress, 1) * bucketExpansionProgress,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: height * 0.025,
                  color: COLORS.accent,
                  opacity: 0.5,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </span>
            </div>
          );
        })}
      </div>

      {/* k=5 label */}
      <div
        style={{
          position: 'absolute',
          top: bucketY + bucketHeight / 2 + 25,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: bucketExpansionProgress,
        }}
      >
        <span
          style={{
            fontSize: height * 0.02,
            color: COLORS.accent,
            letterSpacing: 2,
            fontWeight: 600,
          }}
        >
          RESERVOIR (k=5)
        </span>
      </div>

      {/* Challenge text */}
      <div
        style={{
          position: 'absolute',
          bottom: height * 0.1,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: textOpacity,
        }}
      >
        <h2
          style={{
            fontSize: height * 0.03,
            fontWeight: 700,
            color: COLORS.white,
            letterSpacing: 2,
            margin: 0,
            textShadow: `0 0 30px ${COLORS.primary}44`,
          }}
        >
          THE CHALLENGE:
        </h2>
        <p
          style={{
            fontSize: height * 0.025,
            color: COLORS.primary,
            marginTop: 15,
            letterSpacing: 1,
          }}
        >
          5 Winners, Same Rules?
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 7: CALL TO ACTION
// ============================================================================

// Checkmark Icon SVG Component
const CheckmarkIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 120,
  color = COLORS.accent,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill={`${color}22`} stroke={color} strokeWidth="2" />
    <path
      d="M8 12l3 3 5-6"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const Scene7: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Checkmark entrance
  const checkProgress = spring({
    frame: frame - 10,
    fps,
    config: SPRING_CONFIG,
  });
  const checkPulse = interpolate(
    (frame % 50) / 50,
    [0, 0.5, 1],
    [1, 1.08, 1],
    { extrapolateRight: 'clamp' }
  );

  // Solution prompt
  const promptOpacity = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: 'clamp' });
  const promptY = interpolate(frame, [30, 55], [20, 0], { extrapolateRight: 'clamp' });

  // Presenter info slides up
  const presenterProgress = interpolate(frame, [70, 100], [0, 1], { extrapolateRight: 'clamp' });
  const presenterY = interpolate(presenterProgress, [0, 1], [80, 0], { extrapolateRight: 'clamp' });

  // Social prompts
  const socialOpacity = interpolate(frame, [110, 140], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      {/* Checkmark with golden glow */}
      <div
        style={{
          position: 'absolute',
          left: width / 2,
          top: height * 0.28,
          transform: `translateX(-50%) scale(${Math.min(checkProgress, 1) * checkPulse})`,
        }}
      >
        <div
          style={{
            filter: `drop-shadow(0 0 40px ${COLORS.accent}88) drop-shadow(0 0 80px ${COLORS.accent}44)`,
          }}
        >
          <CheckmarkIcon size={height * 0.12} />
        </div>
      </div>

      {/* Solution prompt */}
      <div
        style={{
          position: 'absolute',
          top: height * 0.45,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: promptOpacity,
          transform: `translateY(${promptY}px)`,
        }}
      >
        <h1
          style={{
            fontSize: height * 0.04,
            fontWeight: 700,
            color: COLORS.white,
            letterSpacing: 3,
            margin: 0,
            textShadow: `0 0 30px ${COLORS.accent}44`,
          }}
        >
          Share Your Solution
        </h1>
        <p
          style={{
            fontSize: height * 0.022,
            color: COLORS.primary,
            marginTop: 20,
            opacity: 0.8,
          }}
        >
          Comment below with your approach!
        </p>
      </div>

      {/* Presenter info */}
      <div
        style={{
          position: 'absolute',
          bottom: height * 0.2,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: presenterProgress,
          transform: `translateY(${presenterY}px)`,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '20px 40px',
            background: COLORS.glass,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${COLORS.glassStroke}`,
            borderRadius: 16,
          }}
        >
          <div
            style={{
              fontSize: height * 0.028,
              fontWeight: 700,
              color: COLORS.white,
            }}
          >
            Prasanna
          </div>
          <div
            style={{
              fontSize: height * 0.018,
              color: COLORS.primary,
              marginTop: 8,
              opacity: 0.8,
            }}
          >
            Technical Architect at Zoho
          </div>
        </div>
      </div>

      {/* Social prompts in corners */}
      <div
        style={{
          position: 'absolute',
          bottom: height * 0.08,
          left: width * 0.1,
          opacity: socialOpacity,
        }}
      >
        <div
          style={{
            fontSize: height * 0.018,
            color: COLORS.white,
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ color: COLORS.primary }}>@</span> Follow for more
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: height * 0.08,
          right: width * 0.1,
          opacity: socialOpacity,
        }}
      >
        <div
          style={{
            fontSize: height * 0.018,
            color: COLORS.white,
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Subscribe <span style={{ color: COLORS.warning }}>&#9829;</span>
        </div>
      </div>

      {/* Subtle animated particles in background */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 300 + Math.sin(frame * 0.02 + i) * 50;
        const x = width / 2 + Math.cos(angle + frame * 0.005) * radius;
        const y = height * 0.35 + Math.sin(angle + frame * 0.005) * (radius * 0.3);
        const opacity = 0.15 + Math.sin(frame * 0.03 + i) * 0.1;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: COLORS.accent,
              opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ============================================================================
// MAIN COMPOSITION
// ============================================================================

const MainComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <AnimatedBackground key="bg" />

      {/* Scene 1: The Scenario Setup */}
      <Sequence key="scene1" from={TIMING.scene1.start} durationInFrames={TIMING.scene1.end - TIMING.scene1.start}>
        <Scene1 />
      </Sequence>

      {/* Scene 2: The Memory Crisis */}
      <Sequence key="scene2" from={TIMING.scene2.start} durationInFrames={TIMING.scene2.end - TIMING.scene2.start}>
        <Scene2 />
      </Sequence>

      {/* Scene 3: The Solution Reveal */}
      <Sequence key="scene3" from={TIMING.scene3.start} durationInFrames={TIMING.scene3.end - TIMING.scene3.start}>
        <Scene3 />
      </Sequence>

      {/* Scene 4: Algorithm Mechanics */}
      <Sequence key="scene4" from={TIMING.scene4.start} durationInFrames={TIMING.scene4.end - TIMING.scene4.start}>
        <Scene4 />
      </Sequence>

      {/* Scene 5: Mathematical Fairness Proof */}
      <Sequence key="scene5" from={TIMING.scene5.start} durationInFrames={TIMING.scene5.end - TIMING.scene5.start}>
        <Scene5 />
      </Sequence>

      {/* Scene 6: The Challenge */}
      <Sequence key="scene6" from={TIMING.scene6.start} durationInFrames={TIMING.scene6.end - TIMING.scene6.start}>
        <Scene6 />
      </Sequence>

      {/* Scene 7: Call to Action */}
      <Sequence key="scene7" from={TIMING.scene7.start} durationInFrames={TIMING.scene7.end - TIMING.scene7.start}>
        <Scene7 />
      </Sequence>
    </AbsoluteFill>
  );
};

// ============================================================================
// REMOTION ROOT
// ============================================================================

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="proj_c9b2ab0e_8fbc_4e9a_a15e_252f94536675"
      component={MainComposition}
      durationInFrames={TIMING.totalFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  );
};

// CRITICAL: Export MainComposition as default (NOT RemotionRoot!)
export default MainComposition;

// Register root for Remotion bundler (required for SSR rendering)
registerRoot(RemotionRoot);
