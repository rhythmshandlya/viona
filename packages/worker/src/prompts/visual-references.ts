/**
 * High-quality Remotion code examples for few-shot prompting.
 * These examples demonstrate FULLY RESPONSIVE design that works at any resolution.
 *
 * Key principles:
 * 1. ALL sizes relative to width/height - no hardcoded pixels
 * 2. Proper text handling - wrapping, overflow, alignment
 * 3. Flexbox layouts for consistent alignment
 * 4. Clear visual hierarchy with regions (header, content, footer)
 */

export const DESIGN_SYSTEM = {
  modern: {
    colors: {
      bgDeep: '#0f0f23',
      bgCard: 'rgba(139, 92, 246, 0.1)',
      bgGradient: 'radial-gradient(circle at center, #1a1a3e 0%, #0f0f23 90%)',
      primary: '#8b5cf6',      // Purple
      secondary: '#3b82f6',    // Blue
      accent: '#06b6d4',       // Cyan
      success: '#22c55e',
      white: '#ffffff',
      muted: '#888888',
      glowPrimary: 'rgba(139, 92, 246, 0.4)',
      glowAccent: 'rgba(6, 182, 212, 0.4)',
    },
  },
};

/**
 * RESPONSIVE LAYOUT HELPER
 * This pattern should be used in every composition for consistent responsive design
 */
export const RESPONSIVE_LAYOUT_HELPER = `
// Helper function for responsive values - USE THIS EVERYWHERE
const useResponsive = () => {
  const { width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  return {
    // Spacing
    padding: minDim * 0.05,
    gap: {
      xs: minDim * 0.01,
      sm: minDim * 0.02,
      md: minDim * 0.03,
      lg: minDim * 0.05,
      xl: minDim * 0.08,
    },
    // Border radius
    radius: {
      sm: minDim * 0.01,
      md: minDim * 0.02,
      lg: minDim * 0.03,
      full: minDim * 0.5,
    },
    // Font sizes (relative to height for readability)
    fontSize: {
      xs: height * 0.018,
      sm: height * 0.022,
      md: height * 0.028,
      lg: height * 0.038,
      xl: height * 0.05,
      xxl: height * 0.07,
    },
    // Element sizes
    size: {
      icon: minDim * 0.06,
      node: minDim * 0.12,
      card: minDim * 0.25,
    },
    // Glow sizes
    glow: {
      sm: minDim * 0.01,
      md: minDim * 0.02,
      lg: minDim * 0.04,
    },
  };
};
`;

/**
 * Reference Example 1: Linear vs Binary Search Race
 * Demonstrates: Parallel state machines, elimination regions, continuous animation
 * Meaningful: The RACE creates contrast - binary finishes in 4 steps while linear crawls
 */
export const REFERENCE_SEARCH_RACE = `
// src/\${projectId}/index.tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring } from 'remotion';

const COLORS = {
  bg: '#0f0f23',
  linear: '#ef4444',
  binary: '#22c55e',
  element: '#2a2a4a',
  eliminated: 'rgba(42, 42, 74, 0.3)',
};

export const \${projectId}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // 16 sorted elements, target at index 12
  const elements = Array.from({ length: 16 }, (_, i) => (i + 1) * 5);
  const targetIndex = 12;

  // === LINEAR SEARCH: Slow crawl ===
  const linearSpeed = 12;
  const linearProgress = Math.floor(frame / linearSpeed);
  const linearCurrentIndex = Math.min(linearProgress, targetIndex);
  const linearFound = linearProgress >= targetIndex;
  const linearChecks = Math.min(linearProgress + 1, targetIndex + 1);

  // === BINARY SEARCH: Divide & conquer ===
  const binarySteps = [
    { left: 0, right: 15, mid: 7, direction: 'right' },
    { left: 8, right: 15, mid: 11, direction: 'right' },
    { left: 12, right: 15, mid: 13, direction: 'left' },
    { left: 12, right: 12, mid: 12, direction: 'found' },
  ];
  const binarySpeed = 35;
  const binaryStepIndex = Math.min(Math.floor(frame / binarySpeed), binarySteps.length - 1);
  const binaryStep = binarySteps[binaryStepIndex];
  const binaryFound = binaryStep.direction === 'found';
  const binaryChecks = Math.min(binaryStepIndex + 1, binarySteps.length);

  // Responsive sizes
  const elementWidth = minDim * 0.045;
  const elementHeight = minDim * 0.07;
  const gap = minDim * 0.008;
  const rowGap = minDim * 0.12;
  const counterSize = height * 0.055;

  const renderRow = (algorithm: 'linear' | 'binary') => {
    const currentIdx = algorithm === 'linear'
      ? (linearFound ? targetIndex : linearCurrentIndex)
      : (binaryFound ? targetIndex : binaryStep.mid);
    const found = algorithm === 'linear' ? linearFound : binaryFound;

    return (
      <div style={{ display: 'flex', gap, justifyContent: 'center' }}>
        {elements.map((val, i) => {
          const isTarget = i === targetIndex;
          const isCurrent = i === currentIdx;
          const isEliminated = algorithm === 'binary' && (i < binaryStep.left || i > binaryStep.right);
          const isChecked = algorithm === 'linear' && i < linearCurrentIndex;

          let bgColor = COLORS.element;
          let opacity = 1;
          let scale = 1;

          if (isTarget && found) {
            bgColor = algorithm === 'linear' ? COLORS.linear : COLORS.binary;
            scale = 1.15;
          } else if (isCurrent && !found) {
            bgColor = algorithm === 'linear' ? COLORS.linear : COLORS.binary;
            scale = 1.2;
          } else if (isEliminated) {
            opacity = 0.25;
            scale = 0.85;
          } else if (isChecked) {
            opacity = 0.5;
          }

          return (
            <div key={i} style={{
              width: elementWidth,
              height: elementHeight,
              background: bgColor,
              borderRadius: minDim * 0.008,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'ui-monospace, monospace',
              fontSize: height * 0.018,
              fontWeight: 600,
              color: opacity < 1 ? '#444' : '#fff',
              opacity,
              transform: \`scale(\${scale})\`,
            }}>
              {val}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ background: \`radial-gradient(ellipse at center, #1a1a3e 0%, \${COLORS.bg} 70%)\` }}>
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: minDim * 0.04, gap: rowGap,
      }}>
        {/* LINEAR ROW */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: minDim * 0.02 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: minDim * 0.03 }}>
            <div style={{
              width: minDim * 0.015, height: minDim * 0.015,
              borderRadius: '50%', background: COLORS.linear,
              boxShadow: \`0 0 \${minDim * 0.015}px \${COLORS.linear}\`,
            }} />
            <span style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: counterSize, fontWeight: 800,
              color: COLORS.linear,
            }}>
              {linearChecks}
            </span>
            {linearFound && <span style={{ color: COLORS.linear }}>✓</span>}
          </div>
          {renderRow('linear')}
        </div>

        {/* BINARY ROW */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: minDim * 0.02 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: minDim * 0.03 }}>
            <div style={{
              width: minDim * 0.015, height: minDim * 0.015,
              borderRadius: '50%', background: COLORS.binary,
              boxShadow: \`0 0 \${minDim * 0.015}px \${COLORS.binary}\`,
            }} />
            <span style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: counterSize, fontWeight: 800,
              color: COLORS.binary,
            }}>
              {binaryChecks}
            </span>
            {binaryFound && <span style={{ color: COLORS.binary }}>✓</span>}
          </div>
          {renderRow('binary')}
        </div>
      </div>
    </AbsoluteFill>
  );
};
`;

/**
 * Reference Example 2: Stack Overflow - The Inevitable Crash
 * Demonstrates: Physics (particles, gravity), state progression, memory pressure visualization
 * Meaningful: Frames pile up, memory fills, shake increases - viewer FEELS the impending crash
 */
export const REFERENCE_STACK_OVERFLOW = `
// src/\${projectId}/index.tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring, Easing } from 'remotion';

const COLORS = {
  bg: '#0f0f23',
  frame: '#8b5cf6',
  frameStroke: '#a78bfa',
  danger: '#ef4444',
  warning: '#f97316',
  safe: '#22c55e',
  memoryBg: '#1a1a2e',
  memoryFill: '#8b5cf6',
  explosion: '#ff6b6b',
};

interface StackFrame {
  id: number;
  name: string;
  arg: number;
}

export const \${projectId}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // === ANIMATION TIMELINE ===
  const frameInterval = 8; // New stack frame every 8 frames
  const maxFrames = 14;
  const crashFrame = maxFrames * frameInterval;
  const explosionDuration = 40;

  const currentStackDepth = Math.min(Math.floor(frame / frameInterval), maxFrames);
  const isCrashed = frame >= crashFrame;
  const explosionProgress = isCrashed
    ? interpolate(frame - crashFrame, [0, explosionDuration], [0, 1], { extrapolateRight: 'clamp' })
    : 0;

  // Generate stack frames (recursive fibonacci as example)
  const stackFrames: StackFrame[] = [];
  for (let i = 0; i <= currentStackDepth && i < maxFrames; i++) {
    stackFrames.push({
      id: i,
      name: 'fib',
      arg: maxFrames - i,
    });
  }

  // === RESPONSIVE SIZES ===
  const stackWidth = width * 0.45;
  const frameHeight = height * 0.05;
  const frameGap = height * 0.008;
  const padding = minDim * 0.05;
  const fontSize = height * 0.022;
  const memoryBarWidth = width * 0.08;
  const memoryBarHeight = height * 0.7;

  // === MEMORY PRESSURE ===
  const memoryUsage = currentStackDepth / maxFrames;
  const memoryColor = memoryUsage > 0.85
    ? COLORS.danger
    : memoryUsage > 0.6
      ? COLORS.warning
      : COLORS.safe;

  // Shake intensity increases as memory fills
  const shakeIntensity = interpolate(memoryUsage, [0.7, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const shakeX = isCrashed ? 0 : Math.sin(frame * 1.5) * shakeIntensity * minDim * 0.008;
  const shakeY = isCrashed ? 0 : Math.cos(frame * 1.8) * shakeIntensity * minDim * 0.005;

  // === EXPLOSION PARTICLES ===
  const particles = Array.from({ length: 20 }, (_, i) => {
    const angle = (i / 20) * Math.PI * 2 + i * 0.5;
    const velocity = minDim * 0.3 + (i % 5) * minDim * 0.1;
    const size = minDim * 0.015 + (i % 3) * minDim * 0.01;
    return {
      x: Math.cos(angle) * velocity * explosionProgress,
      y: Math.sin(angle) * velocity * explosionProgress - (explosionProgress * explosionProgress * minDim * 0.2),
      size: size * (1 - explosionProgress * 0.5),
      opacity: 1 - explosionProgress,
      rotation: explosionProgress * 360 * (i % 2 === 0 ? 1 : -1),
    };
  });

  return (
    <AbsoluteFill style={{
      background: \`radial-gradient(ellipse at center, #1a1a3e 0%, \${COLORS.bg} 70%)\`,
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: minDim * 0.08,
        padding,
        transform: \`translate(\${shakeX}px, \${shakeY}px)\`,
      }}>

        {/* === STACK VISUALIZATION === */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: minDim * 0.02,
          position: 'relative',
        }}>
          {/* Stack container */}
          <div style={{
            width: stackWidth,
            height: height * 0.75,
            display: 'flex',
            flexDirection: 'column-reverse',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: frameGap,
            position: 'relative',
            overflow: 'visible',
          }}>
            {/* Explosion overlay */}
            {isCrashed && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 100,
              }}>
                {/* Central flash */}
                <div style={{
                  width: minDim * 0.3 * (1 + explosionProgress * 2),
                  height: minDim * 0.3 * (1 + explosionProgress * 2),
                  borderRadius: '50%',
                  background: \`radial-gradient(circle, \${COLORS.explosion} 0%, transparent 70%)\`,
                  opacity: 1 - explosionProgress,
                }} />

                {/* Particles */}
                {particles.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: p.size,
                      height: p.size,
                      borderRadius: minDim * 0.003,
                      background: i % 3 === 0 ? COLORS.danger : i % 3 === 1 ? COLORS.warning : COLORS.frame,
                      transform: \`translate(\${p.x}px, \${p.y}px) rotate(\${p.rotation}deg)\`,
                      opacity: p.opacity,
                      boxShadow: \`0 0 \${minDim * 0.01}px \${COLORS.explosion}\`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Stack frames */}
            {stackFrames.map((sf, i) => {
              const entryDelay = sf.id * frameInterval;
              const entryProgress = spring({
                frame: frame - entryDelay,
                fps,
                config: { damping: 12, stiffness: 100 },
              });

              // Frames get more "stressed" as stack fills
              const stressLevel = i / maxFrames;
              const pulseSpeed = 0.1 + stressLevel * 0.2;
              const pulse = 1 + Math.sin(frame * pulseSpeed + i) * stressLevel * 0.05;

              // Explosion scatter
              const scatterX = isCrashed
                ? (Math.random() - 0.5) * minDim * explosionProgress * 0.5
                : 0;
              const scatterY = isCrashed
                ? -explosionProgress * minDim * 0.3 * (1 + Math.random())
                : 0;
              const scatterRotate = isCrashed
                ? (Math.random() - 0.5) * 45 * explosionProgress
                : 0;
              const scatterOpacity = isCrashed ? 1 - explosionProgress : 1;

              return (
                <div
                  key={sf.id}
                  style={{
                    width: stackWidth * 0.9,
                    height: frameHeight,
                    background: \`linear-gradient(135deg, \${COLORS.frame}22 0%, \${COLORS.frame}11 100%)\`,
                    border: \`\${Math.max(1, minDim * 0.002)}px solid \${COLORS.frameStroke}\`,
                    borderRadius: minDim * 0.01,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: minDim * 0.015,
                    transform: \`
                      scale(\${entryProgress * pulse})
                      translateX(\${scatterX}px)
                      translateY(\${scatterY}px)
                      rotate(\${scatterRotate}deg)
                    \`,
                    opacity: scatterOpacity * entryProgress,
                    boxShadow: stressLevel > 0.7
                      ? \`0 0 \${minDim * 0.015}px \${COLORS.danger}66\`
                      : \`0 0 \${minDim * 0.01}px \${COLORS.frame}44\`,
                  }}
                >
                  {/* Function name */}
                  <span style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize,
                    fontWeight: 600,
                    color: COLORS.frameStroke,
                  }}>
                    {sf.name}({sf.arg})
                  </span>

                  {/* Return arrow indicator - shows it's waiting */}
                  <div style={{
                    width: minDim * 0.025,
                    height: minDim * 0.025,
                    borderRadius: '50%',
                    background: stressLevel > 0.7 ? COLORS.danger : COLORS.frame,
                    opacity: 0.6 + Math.sin(frame * 0.15 + i * 0.5) * 0.4,
                  }} />
                </div>
              );
            })}
          </div>

          {/* Depth counter */}
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: minDim * 0.015,
          }}>
            <span style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: height * 0.05,
              fontWeight: 800,
              color: memoryColor,
              textShadow: \`0 0 \${minDim * 0.02}px \${memoryColor}\`,
            }}>
              {currentStackDepth}
            </span>
            <span style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: height * 0.022,
              color: '#888',
            }}>
              frames deep
            </span>
          </div>
        </div>

        {/* === MEMORY BAR === */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: minDim * 0.02,
        }}>
          {/* Memory container */}
          <div style={{
            width: memoryBarWidth,
            height: memoryBarHeight,
            background: COLORS.memoryBg,
            borderRadius: minDim * 0.015,
            border: \`\${Math.max(1, minDim * 0.002)}px solid #333\`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            position: 'relative',
          }}>
            {/* Fill level */}
            <div style={{
              width: '100%',
              height: \`\${memoryUsage * 100}%\`,
              background: \`linear-gradient(180deg, \${memoryColor} 0%, \${memoryColor}88 100%)\`,
              borderRadius: minDim * 0.01,
              boxShadow: \`0 0 \${minDim * 0.025}px \${memoryColor}66\`,
              transition: 'none',
            }} />

            {/* Danger zone line */}
            <div style={{
              position: 'absolute',
              top: '15%',
              left: 0,
              right: 0,
              height: Math.max(1, minDim * 0.002),
              background: COLORS.danger,
              opacity: 0.5 + Math.sin(frame * 0.2) * 0.3,
            }} />
          </div>

          {/* Memory percentage */}
          <span style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: height * 0.03,
            fontWeight: 700,
            color: memoryColor,
          }}>
            {Math.round(memoryUsage * 100)}%
          </span>
        </div>

      </div>
    </AbsoluteFill>
  );
};
`;

/**
 * Reference Example 3: Responsive Info Card Layout
 * Shows heading + content + footer pattern with proper text wrapping
 */
export const REFERENCE_INFO_CARD = `
// src/\${projectId}/components/InfoCard.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = {
  bgDeep: '#0f0f23',
  bgGradient: 'radial-gradient(ellipse at center, #1a1a3e 0%, #0f0f23 90%)',
  primary: '#8b5cf6',
  accent: '#06b6d4',
  glow: 'rgba(139, 92, 246, 0.4)',
  white: '#ffffff',
  muted: '#888888',
};

export const InfoCard: React.FC<{
  title: string;
  subtitle: string;
  content: string;
  highlight: string;
}> = ({ title, subtitle, content, highlight }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // RESPONSIVE DESIGN TOKENS
  const padding = minDim * 0.06;
  const gap = minDim * 0.025;
  const radius = minDim * 0.025;
  const glow = minDim * 0.03;
  const borderWidth = Math.max(2, minDim * 0.003);

  const fontSize = {
    title: height * 0.055,
    subtitle: height * 0.025,
    content: height * 0.032,
    highlight: height * 0.08,
  };

  const cardScale = spring({ frame, fps, config: { damping: 12, stiffness: 60 } });
  const contentOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.5, 1]);

  return (
    <AbsoluteFill style={{ background: COLORS.bgGradient }}>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
      }}>
        {/* CARD CONTAINER */}
        <div style={{
          width: '100%',
          maxWidth: width * 0.9,
          background: 'rgba(139, 92, 246, 0.08)',
          border: \`\${borderWidth}px solid \${COLORS.primary}\`,
          borderRadius: radius,
          boxShadow: \`0 0 \${glow * glowPulse}px \${COLORS.glow}\`,
          transform: \`scale(\${cardScale})\`,
          overflow: 'hidden', // Prevent content overflow
        }}>
          {/* CARD LAYOUT: Vertical stack with flexbox */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            padding,
            gap,
          }}>
            {/* HEADER REGION */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: gap * 0.3,
            }}>
              <h1 style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: fontSize.title,
                fontWeight: 700,
                color: COLORS.white,
                margin: 0,
                lineHeight: 1.2,
                // Multi-line text handling
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
              }}>
                {title}
              </h1>
              <p style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: fontSize.subtitle,
                color: COLORS.muted,
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                {subtitle}
              </p>
            </div>

            {/* HIGHLIGHT NUMBER */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: \`\${gap}px 0\`,
              opacity: contentOpacity,
            }}>
              <span style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: fontSize.highlight,
                fontWeight: 800,
                color: COLORS.primary,
                textShadow: \`0 0 \${glow}px \${COLORS.glow}\`,
              }}>
                {highlight}
              </span>
            </div>

            {/* CONTENT REGION */}
            <p style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: fontSize.content,
              color: COLORS.white,
              margin: 0,
              lineHeight: 1.5,
              opacity: contentOpacity,
              textAlign: 'center',
              // CRITICAL: Multi-line text handling
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              hyphens: 'auto',
            }}>
              {content}
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
`;

/**
 * Reference Example 4: Responsive Stats Display
 * Shows multiple stats in a responsive grid
 */
export const REFERENCE_STATS = `
// src/\${projectId}/components/StatsGrid.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = {
  bgDeep: '#0f0f23',
  bgGradient: 'radial-gradient(ellipse at top, #1a1a3e 0%, #0f0f23 60%)',
  primary: '#8b5cf6',
  secondary: '#3b82f6',
  accent: '#06b6d4',
  glow: 'rgba(139, 92, 246, 0.4)',
  white: '#ffffff',
  muted: '#888888',
};

interface StatItem {
  value: number;
  suffix?: string;
  label: string;
}

const AnimatedStat: React.FC<{ stat: StatItem; index: number }> = ({ stat, index }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const minDim = Math.min(useVideoConfig().width, height);

  // RESPONSIVE VALUES
  const valueSize = height * 0.07;
  const labelSize = height * 0.022;
  const glow = minDim * 0.025;
  const gap = minDim * 0.01;

  const delay = index * 15;
  const progress = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 40 } });
  const scale = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 80 } });
  const displayValue = Math.round(stat.value * progress);
  const glowPulse = interpolate(Math.sin((frame - delay) * 0.08), [-1, 1], [0.5, 1]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap,
      transform: \`scale(\${scale})\`,
    }}>
      <div style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: valueSize,
        fontWeight: 800,
        color: COLORS.primary,
        textShadow: \`0 0 \${glow * glowPulse}px \${COLORS.glow}\`,
        lineHeight: 1,
      }}>
        {displayValue.toLocaleString()}{stat.suffix || ''}
      </div>
      <div style={{
        fontFamily: 'system-ui, sans-serif',
        fontSize: labelSize,
        color: COLORS.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        textAlign: 'center',
        // Text handling
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}>
        {stat.label}
      </div>
    </div>
  );
};

export const StatsGrid: React.FC<{ title: string; stats: StatItem[] }> = ({ title, stats }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // RESPONSIVE VALUES
  const padding = minDim * 0.06;
  const gap = minDim * 0.04;
  const titleSize = height * 0.05;

  const titleScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });

  return (
    <AbsoluteFill style={{ background: COLORS.bgGradient }}>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding,
        gap: gap * 1.5,
      }}>
        {/* TITLE REGION */}
        <div style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <h1 style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: titleSize,
            fontWeight: 700,
            color: COLORS.white,
            textAlign: 'center',
            transform: \`scale(\${titleScale})\`,
            margin: 0,
            wordWrap: 'break-word',
          }}>
            {title}
          </h1>
        </div>

        {/* STATS GRID REGION */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap,
        }}>
          {/* Responsive grid: 2 columns on wide, 1 on narrow */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap,
            width: '100%',
          }}>
            {stats.map((stat, i) => (
              <div key={i} style={{
                flex: width > height ? '0 0 45%' : '0 0 100%',
                display: 'flex',
                justifyContent: 'center',
              }}>
                <AnimatedStat stat={stat} index={i} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
`;

/**
 * Constructs the reference examples section for the prompt
 */
export function buildReferenceExamplesSection(projectId: string): string {
  return `
## 🎨 REFERENCE EXAMPLES - FULLY RESPONSIVE DESIGN

**CRITICAL: Every value must be relative to width/height. NO hardcoded pixels.**

### Responsive Design Helper (USE THIS PATTERN):
\`\`\`tsx
${RESPONSIVE_LAYOUT_HELPER}
\`\`\`

### Example 1: Linear vs Binary Search Race
${REFERENCE_SEARCH_RACE.replace(/\$\{projectId\}/g, projectId)}

### Example 2: Stack Overflow - The Inevitable Crash
${REFERENCE_STACK_OVERFLOW.replace(/\$\{projectId\}/g, projectId)}

### Example 3: Info Card with Text Wrapping
${REFERENCE_INFO_CARD}

---

## 📐 MANDATORY LAYOUT RULES

### 1. ALL Sizes Must Be Relative
\`\`\`tsx
// ✅ CORRECT - Responsive
const { width, height } = useVideoConfig();
const minDim = Math.min(width, height);

const padding = minDim * 0.05;
const fontSize = height * 0.035;
const borderRadius = minDim * 0.02;
const gap = minDim * 0.03;
const glowSize = minDim * 0.025;
const borderWidth = Math.max(2, minDim * 0.003);

// ❌ WRONG - Hardcoded pixels
padding: 20,
fontSize: 32,
borderRadius: 16,
gap: 30,
\`\`\`

### 2. Text Overflow Handling
\`\`\`tsx
// For single-line text (titles, labels)
style={{
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
}}

// For multi-line text (paragraphs, descriptions)
style={{
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
  hyphens: 'auto',
  lineHeight: 1.4,
}}
\`\`\`

### 3. Layout Structure (Flexbox)
\`\`\`tsx
// ALWAYS use flexbox for layout
<div style={{
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: minDim * 0.05,
  gap: minDim * 0.03,
}}>
  {/* Title Region - fixed height */}
  <div style={{ flex: '0 0 15%' }}>...</div>

  {/* Content Region - fills remaining space */}
  <div style={{ flex: 1 }}>...</div>

  {/* Footer Region - fixed height */}
  <div style={{ flex: '0 0 10%' }}>...</div>
</div>
\`\`\`

### 4. Prevent Overflow
\`\`\`tsx
// Container must have overflow: hidden
<div style={{
  overflow: 'hidden',
  // ... other styles
}}>
  {/* Content cannot escape this container */}
</div>
\`\`\`

### 5. Responsive Font Scale
\`\`\`tsx
// Font sizes relative to HEIGHT (maintains readability)
const fontSize = {
  xs: height * 0.018,  // Small labels
  sm: height * 0.022,  // Body text
  md: height * 0.032,  // Subheadings
  lg: height * 0.045,  // Headings
  xl: height * 0.06,   // Large titles
  xxl: height * 0.08,  // Hero numbers
};
\`\`\`

### 6. Glow Effects (Responsive)
\`\`\`tsx
const glow = minDim * 0.025;
const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.5, 1]);

boxShadow: \`0 0 \${glow * glowPulse}px rgba(139, 92, 246, 0.4)\`
\`\`\`

### 7. React key Prop (MANDATORY - NEVER FORGET)
\`\`\`tsx
// ✅ ALWAYS add key when using .map()
{items.map((item, i) => (
  <div key={i}>
    {item.content}
  </div>
))}

// ✅ For multiple elements, use React.Fragment with key
{steps.map((step, i) => (
  <React.Fragment key={i}>
    {i > 0 && <ConnectorArrow />}
    <FlowNode label={step} index={i} />
  </React.Fragment>
))}

// ❌ NEVER omit the key prop - causes React errors
{items.map((item) => <div>{item}</div>)} // WRONG!
\`\`\`

`;
}
