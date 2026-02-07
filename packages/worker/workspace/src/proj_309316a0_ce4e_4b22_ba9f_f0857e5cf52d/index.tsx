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

// =============================================================================
// CONSTANTS - Electric Sunset Color Palette (inlined for module resolution)
// =============================================================================
const COLORS = {
  primary: '#ff6b6b',    // Coral - for "low" warmth
  secondary: '#feca57',  // Gold - for transition/energy
  accent: '#ff9ff3',     // Pink - for highlights
  cool: '#667eea',       // Indigo - for "high" coolness
  dark: '#1a1a2e',       // Background depth
};

const SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };

const TIMING = {
  scene1Start: 0,
  scene1End: 33,
  scene2Start: 34,
  scene2End: 51,
  keyHighFrame: 34,
  scene3Start: 52,
  scene3End: 73,
  keyAndFrame: 52,
  keyLowFrame: 55,
  totalFrames: 73,
};

const VIDEO_CONFIG = {
  fps: 24,
  width: 1080,
  height: 1920,
  durationInFrames: 73,
};

// =============================================================================
// ANIMATED BACKGROUND - Vertical gradient establishing hierarchy
// =============================================================================
const AnimatedBackground: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle gradient shift based on frame (scene progression)
  const gradientProgress = interpolate(
    frame,
    [0, TIMING.scene2Start, TIMING.scene3Start, TIMING.totalFrames],
    [0, 0.3, 0.7, 1],
    { extrapolateRight: 'clamp' }
  );

  // Gradient shifts from cool-centered to high-cool to low-warm
  const topColorStop = interpolate(
    gradientProgress,
    [0, 0.5, 1],
    [50, 30, 70]
  );

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(
          180deg,
          ${COLORS.cool} 0%,
          ${COLORS.dark} ${topColorStop}%,
          ${COLORS.dark} 100%
        )`,
      }}
    />
  );
};

// =============================================================================
// LUMINOUS ORB - Glowing sphere with breathing animation
// =============================================================================
interface OrbProps {
  delay: number;
  baseX: number;
  baseY: number;
  size: number;
  color: string;
  glowColor: string;
  glowIntensity?: number;
}

const LuminousOrb: React.FC<OrbProps> = ({
  delay,
  baseX,
  baseY,
  size,
  color,
  glowColor,
  glowIntensity = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Materialization spring
  const materialize = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG,
  });

  // Gentle breathing animation (subtle scale pulse)
  const breathe = 1 + Math.sin((frame + delay * 10) * 0.08) * 0.05;

  // Gentle vertical float
  const floatY = Math.sin((frame + delay * 15) * 0.06) * (height * 0.01);

  const orbSize = (size / 100) * height;
  const x = (baseX / 100) * width - orbSize / 2;
  const y = (baseY / 100) * height - orbSize / 2 + floatY;

  const scale = materialize * breathe;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: orbSize,
        height: orbSize,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, white 0%, ${color} 40%, ${glowColor} 100%)`,
        transform: `scale(${scale})`,
        opacity: materialize,
        boxShadow: `
          0 0 ${30 * glowIntensity}px ${glowColor},
          0 0 ${60 * glowIntensity}px ${glowColor},
          0 0 ${90 * glowIntensity}px ${color}
        `,
      }}
    />
  );
};

// =============================================================================
// SCENE 1: ANTICIPATION - Orbs materialize at center
// =============================================================================
const Scene1Anticipation: React.FC = () => {
  // Orbs materialize with staggered timing, positioned at center (50%)
  // Using neutral color blend for anticipation state
  const neutralColor = COLORS.accent; // Pink for neutral state
  const neutralGlow = COLORS.cool;

  return (
    <>
      <LuminousOrb
        key="orb1"
        delay={6}
        baseX={45}
        baseY={48}
        size={8}
        color={neutralColor}
        glowColor={neutralGlow}
        glowIntensity={0.8}
      />
      <LuminousOrb
        key="orb2"
        delay={12}
        baseX={50}
        baseY={52}
        size={8}
        color={neutralColor}
        glowColor={neutralGlow}
        glowIntensity={0.8}
      />
      <LuminousOrb
        key="orb3"
        delay={18}
        baseX={55}
        baseY={50}
        size={8}
        color={neutralColor}
        glowColor={neutralGlow}
        glowIntensity={0.8}
      />
    </>
  );
};

// =============================================================================
// SCENE 2: HIGH - Orbs ascend to upper third with cool colors
// =============================================================================
const Scene2High: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  // Spring animation for upward movement
  const riseProgress = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 80, mass: 1.0 },
  });

  // Scale increase (100% -> 120%)
  const scaleBoost = interpolate(riseProgress, [0, 1], [1, 1.2], { extrapolateRight: 'clamp' });

  // Glow intensifies at peak
  const glowBoost = interpolate(riseProgress, [0, 0.8, 1], [0.8, 1.2, 1.5], { extrapolateRight: 'clamp' });

  // Y positions transition from center (~50%) to high (~20%)
  const yProgress = interpolate(riseProgress, [0, 1], [0, 1], { extrapolateRight: 'clamp' });

  // Starting positions (from Scene 1 end state)
  const orb1StartY = 48;
  const orb2StartY = 52;
  const orb3StartY = 50;

  // Target positions (high state - 20% from top)
  const orb1EndY = 20;
  const orb2EndY = 15;
  const orb3EndY = 20;

  // Interpolated Y positions
  const orb1Y = interpolate(yProgress, [0, 1], [orb1StartY, orb1EndY], { extrapolateRight: 'clamp' });
  const orb2Y = interpolate(yProgress, [0, 1], [orb2StartY, orb2EndY], { extrapolateRight: 'clamp' });
  const orb3Y = interpolate(yProgress, [0, 1], [orb3StartY, orb3EndY], { extrapolateRight: 'clamp' });

  // X positions spread slightly at peak
  const orb1X = interpolate(yProgress, [0, 1], [45, 40], { extrapolateRight: 'clamp' });
  const orb2X = 50; // Center stays
  const orb3X = interpolate(yProgress, [0, 1], [55, 60], { extrapolateRight: 'clamp' });

  // Sizes increase
  const baseSize = 8;
  const boostedSize = baseSize * scaleBoost;

  // Gentle float continues
  const floatY = Math.sin(frame * 0.08) * (height * 0.005);
  const floatOffset = floatY / height * 100;

  return (
    <>
      {/* Orb 1 - Left, ascending */}
      <LuminousOrb
        key="orb1-high"
        delay={0}
        baseX={orb1X}
        baseY={orb1Y + floatOffset}
        size={boostedSize}
        color={COLORS.cool}
        glowColor={COLORS.cool}
        glowIntensity={glowBoost}
      />

      {/* Orb 2 - Center, ascending highest */}
      <LuminousOrb
        key="orb2-high"
        delay={0}
        baseX={orb2X}
        baseY={orb2Y - floatOffset}
        size={boostedSize}
        color={COLORS.cool}
        glowColor={COLORS.accent}
        glowIntensity={glowBoost * 1.1}
      />

      {/* Orb 3 - Right, ascending */}
      <LuminousOrb
        key="orb3-high"
        delay={0}
        baseX={orb3X}
        baseY={orb3Y + floatOffset * 0.5}
        size={boostedSize}
        color={COLORS.cool}
        glowColor={COLORS.cool}
        glowIntensity={glowBoost}
      />
    </>
  );
};

// =============================================================================
// SCENE 3: AND LOW - Orbs descend with warm color shift
// =============================================================================
const Scene3AndLow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  // Spring animation for downward movement (slightly slower for graceful descent)
  const descendProgress = spring({
    frame,
    fps,
    config: { damping: 25, stiffness: 70, mass: 1.1 },
  });

  // Scale decrease (120% -> 90%)
  const scaleDown = interpolate(descendProgress, [0, 1], [1.2, 0.9], { extrapolateRight: 'clamp' });

  // Glow softens as they settle
  const glowFade = interpolate(descendProgress, [0, 0.5, 1], [1.5, 1.0, 0.7], { extrapolateRight: 'clamp' });

  // Y positions transition from high (~20%) to low (~80%)
  const yProgress = interpolate(descendProgress, [0, 1], [0, 1], { extrapolateRight: 'clamp' });

  // Starting positions (from Scene 2 end state - high position)
  const orb1StartY = 20;
  const orb2StartY = 15;
  const orb3StartY = 20;

  // Target positions (low state - 80% from top)
  const orb1EndY = 80;
  const orb2EndY = 85;
  const orb3EndY = 80;

  // Interpolated Y positions
  const orb1Y = interpolate(yProgress, [0, 1], [orb1StartY, orb1EndY], { extrapolateRight: 'clamp' });
  const orb2Y = interpolate(yProgress, [0, 1], [orb2StartY, orb2EndY], { extrapolateRight: 'clamp' });
  const orb3Y = interpolate(yProgress, [0, 1], [orb3StartY, orb3EndY], { extrapolateRight: 'clamp' });

  // X positions come together slightly at bottom
  const orb1X = interpolate(yProgress, [0, 1], [40, 35], { extrapolateRight: 'clamp' });
  const orb2X = 50; // Center stays
  const orb3X = interpolate(yProgress, [0, 1], [60, 65], { extrapolateRight: 'clamp' });

  // Size decreases
  const baseSize = 8;
  const reducedSize = baseSize * scaleDown;

  // Color interpolation from cool to warm
  const colorProgress = interpolate(descendProgress, [0, 1], [0, 1], { extrapolateRight: 'clamp' });

  // Gentle float continues (slower at bottom)
  const floatY = Math.sin(frame * 0.06) * (height * 0.003);
  const floatOffset = floatY / height * 100;

  // Determine colors based on progress (cool -> warm)
  const orbColor = colorProgress > 0.5 ? COLORS.primary : COLORS.cool;
  const orbGlow = colorProgress > 0.5 ? COLORS.secondary : COLORS.cool;

  return (
    <>
      {/* Orb 1 - Left, descending */}
      <LuminousOrb
        key="orb1-low"
        delay={0}
        baseX={orb1X}
        baseY={orb1Y + floatOffset}
        size={reducedSize}
        color={orbColor}
        glowColor={orbGlow}
        glowIntensity={glowFade}
      />

      {/* Orb 2 - Center, descending deepest */}
      <LuminousOrb
        key="orb2-low"
        delay={0}
        baseX={orb2X}
        baseY={orb2Y - floatOffset}
        size={reducedSize}
        color={COLORS.primary}
        glowColor={COLORS.secondary}
        glowIntensity={glowFade * 0.9}
      />

      {/* Orb 3 - Right, descending */}
      <LuminousOrb
        key="orb3-low"
        delay={0}
        baseX={orb3X}
        baseY={orb3Y + floatOffset * 0.5}
        size={reducedSize}
        color={orbColor}
        glowColor={orbGlow}
        glowIntensity={glowFade}
      />
    </>
  );
};

// =============================================================================
// MAIN COMPOSITION
// =============================================================================
const MainComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <AnimatedBackground key="bg" />

      {/* Scene 1: Anticipation (frames 0-33) */}
      <Sequence key="scene1" from={TIMING.scene1Start} durationInFrames={TIMING.scene1End - TIMING.scene1Start + 1}>
        <Scene1Anticipation />
      </Sequence>

      {/* Scene 2: High (frames 34-51) */}
      <Sequence key="scene2" from={TIMING.scene2Start} durationInFrames={TIMING.scene2End - TIMING.scene2Start + 1}>
        <Scene2High />
      </Sequence>

      {/* Scene 3: And Low (frames 52-73) */}
      <Sequence key="scene3" from={TIMING.scene3Start} durationInFrames={TIMING.scene3End - TIMING.scene3Start + 1}>
        <Scene3AndLow />
      </Sequence>
    </AbsoluteFill>
  );
};

// =============================================================================
// REMOTION ROOT & EXPORTS
// =============================================================================
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="proj_309316a0_ce4e_4b22_ba9f_f0857e5cf52d"
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
