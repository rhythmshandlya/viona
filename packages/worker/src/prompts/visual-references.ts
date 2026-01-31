/**
 * High-quality Remotion code examples for few-shot prompting.
 *
 * OPTIMIZED STRUCTURE:
 * 1. COMMON_PATTERNS - Shared code extracted from all examples (included once)
 * 2. Slimmed examples - Each focuses on its unique concept, references common patterns
 *
 * Key principles:
 * - ALL sizes relative to width/height - no hardcoded pixels
 * - Proper text handling - wrapping, overflow, alignment
 * - Flexbox layouts for consistent alignment
 * - Clear visual hierarchy with regions (header, content, footer)
 */

/**
 * Common patterns extracted from all examples.
 * These are included ONCE in the prompt, not repeated per example.
 */
export const COMMON_PATTERNS = `
## 🔧 COMMON PATTERNS (Use in ALL compositions)

### Responsive Sizing Helper
\`\`\`tsx
const { width, height, fps } = useVideoConfig();
const minDim = Math.min(width, height);

// Font sizes - relative to height for readability
const fontSize = {
  xs: height * 0.018,
  sm: height * 0.022,
  md: height * 0.032,
  lg: height * 0.045,
  xl: height * 0.06,
};

// Spacing - relative to minDim
const padding = minDim * 0.05;
const gap = minDim * 0.03;
const borderRadius = minDim * 0.02;
const borderWidth = Math.max(2, minDim * 0.003);

// Glow effects
const glow = minDim * 0.025;
\`\`\`

### Standard Color Palettes
\`\`\`tsx
// Modern palette (most common)
const COLORS = {
  bg: '#0f0f23',
  primary: '#8b5cf6',    // Purple
  secondary: '#3b82f6',  // Blue
  accent: '#06b6d4',     // Cyan
  success: '#22c55e',    // Green
  danger: '#ef4444',     // Red
  warning: '#f97316',    // Orange
  muted: '#888888',
};
\`\`\`

### Ball Physics Simulation
\`\`\`tsx
// Frame-based physics - pure function of frame number (Remotion-safe)
const simulateBallPhysics = (
  frame: number,
  dropFrame: number,
  targetY: number,
  fps: number
): { y: number; settled: boolean } => {
  const elapsed = frame - dropFrame;
  if (elapsed < 0) return { y: -100, settled: false };

  const gravity = 0.004;
  const bounceDamping = 0.5;
  let y = 0, velocity = 0, bounces = 0;

  for (let t = 0; t < elapsed; t++) {
    velocity += gravity;
    y += velocity;
    if (y >= targetY) {
      y = targetY;
      velocity = -velocity * bounceDamping;
      if (++bounces >= 4 || Math.abs(velocity) < 0.02) {
        return { y: targetY, settled: true };
      }
    }
  }
  return { y: Math.min(y, targetY), settled: false };
};
\`\`\`

### Shake Effect (Stress Indicator)
\`\`\`tsx
const shakeIntensity = interpolate(stressLevel, [0.7, 1], [0, 1], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
const shakeX = Math.sin(frame * 1.5) * shakeIntensity * minDim * 0.008;
const shakeY = Math.cos(frame * 1.8) * shakeIntensity * minDim * 0.005;
// Apply: transform: \\\`translate(\${shakeX}px, \${shakeY}px)\\\`
\`\`\`

### Squash & Stretch
\`\`\`tsx
// During fall - stretch vertically
const velocity = Math.min((frame - dropFrame) * 0.02, 0.3);
const scaleX = isSettled ? 1 : 1 - velocity * 0.2;
const scaleY = isSettled ? 1 : 1 + velocity * 0.3;

// On landing - squash horizontally
const landingSquash = justLanded
  ? interpolate(frame - landFrame, [0, 8, 15], [1, 0.7, 1], { extrapolateRight: 'clamp' })
  : 1;
\`\`\`

### Spring Configs by Style
\`\`\`tsx
const SPRING_CONFIGS = {
  minimal: { damping: 20, stiffness: 60 },   // Smooth, no bounce
  modern: { damping: 12, stiffness: 80 },    // Bouncy, satisfying
  playful: { damping: 8, stiffness: 200 },   // Very bouncy
  bold: { damping: 15, stiffness: 150 },     // Snappy, powerful
  classic: { damping: 25, stiffness: 50 },   // Dignified, no bounce
};
\`\`\`

### Layout Structure (Flexbox)
\`\`\`tsx
<AbsoluteFill style={{ background: \\\`radial-gradient(ellipse at center, #1a1a3e 0%, #0f0f23 70%)\\\` }}>
  <div style={{
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    justifyContent: 'center', alignItems: 'center',
    padding: minDim * 0.05, gap: minDim * 0.03,
  }}>
    {/* Content */}
  </div>
</AbsoluteFill>
\`\`\`
`;

/**
 * Reference Example 1: Linear vs Binary Search Race
 *
 * DEMONSTRATES: Parallel state machines, elimination visualization, continuous counters
 * MEANINGFUL BECAUSE: The RACE creates contrast - binary finishes in 4 steps while linear crawls
 */
export const REFERENCE_SEARCH_RACE = `
### Example: Algorithm Race (Linear vs Binary Search)

**What it demonstrates:** Parallel comparison, elimination regions, live counters
**Key insight:** Show BOTH algorithms simultaneously so viewer FEELS the difference

\`\`\`tsx
// src/\${projectId}/index.tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, spring } from 'remotion';

export const \${projectId}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // 16 sorted elements, target at index 12
  const elements = Array.from({ length: 16 }, (_, i) => (i + 1) * 5);
  const targetIndex = 12;

  // === LINEAR: Slow crawl through every element ===
  const linearSpeed = 12; // frames per step
  const linearProgress = Math.floor(frame / linearSpeed);
  const linearCurrentIndex = Math.min(linearProgress, targetIndex);
  const linearFound = linearProgress >= targetIndex;

  // === BINARY: Divide & conquer - eliminates half each step ===
  const binarySteps = [
    { left: 0, right: 15, mid: 7 },   // Check middle, go right
    { left: 8, right: 15, mid: 11 },  // Check middle of right half
    { left: 12, right: 15, mid: 13 }, // Check middle, go left
    { left: 12, right: 12, mid: 12 }, // Found!
  ];
  const binarySpeed = 35;
  const binaryStepIndex = Math.min(Math.floor(frame / binarySpeed), binarySteps.length - 1);
  const binaryStep = binarySteps[binaryStepIndex];
  const binaryFound = binaryStepIndex === binarySteps.length - 1;

  // Responsive sizes
  const elementSize = { w: minDim * 0.045, h: minDim * 0.07 };
  const gap = minDim * 0.008;

  const renderRow = (isLinear: boolean) => (
    <div style={{ display: 'flex', gap, justifyContent: 'center' }}>
      {elements.map((val, i) => {
        const isCurrent = isLinear ? i === linearCurrentIndex : i === binaryStep.mid;
        const isEliminated = !isLinear && (i < binaryStep.left || i > binaryStep.right);
        const found = isLinear ? linearFound && i === targetIndex : binaryFound && i === targetIndex;

        return (
          <div key={i} style={{
            width: elementSize.w, height: elementSize.h,
            background: found ? '#22c55e' : isCurrent ? (isLinear ? '#ef4444' : '#22c55e') : '#2a2a4a',
            borderRadius: minDim * 0.008,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: height * 0.018, fontWeight: 600, color: '#fff',
            opacity: isEliminated ? 0.25 : 1,
            transform: \\\`scale(\${isCurrent || found ? 1.2 : isEliminated ? 0.85 : 1})\\\`,
          }}>
            {val}
          </div>
        );
      })}
    </div>
  );

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, #1a1a3e 0%, #0f0f23 70%)' }}>
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', gap: minDim * 0.12 }}>
        {/* Linear row with counter */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: minDim * 0.02 }}>
          <span style={{ fontSize: height * 0.055, fontWeight: 800, color: '#ef4444' }}>
            {Math.min(linearProgress + 1, targetIndex + 1)}
          </span>
          {renderRow(true)}
        </div>
        {/* Binary row with counter */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: minDim * 0.02 }}>
          <span style={{ fontSize: height * 0.055, fontWeight: 800, color: '#22c55e' }}>
            {binaryStepIndex + 1}
          </span>
          {renderRow(false)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
\`\`\`
`;

/**
 * Reference Example 2: Stack Overflow - The Inevitable Crash
 *
 * DEMONSTRATES: Physics (shake), state progression, memory pressure visualization
 * MEANINGFUL BECAUSE: Frames pile up, memory fills, shake increases - viewer FEELS impending crash
 */
export const REFERENCE_STACK_OVERFLOW = `
### Example: Stack Overflow with Memory Pressure

**What it demonstrates:** Progressive tension, memory visualization, physics-based shake
**Key insight:** Visual stress (shake, color) increases as memory fills - viewer feels the crash coming

\`\`\`tsx
// src/\${projectId}/index.tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring } from 'remotion';

export const \${projectId}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // Timeline
  const frameInterval = 8;
  const maxFrames = 14;
  const crashFrame = maxFrames * frameInterval;
  const currentStackDepth = Math.min(Math.floor(frame / frameInterval), maxFrames);
  const isCrashed = frame >= crashFrame;

  // Memory pressure (0 to 1)
  const memoryUsage = currentStackDepth / maxFrames;
  const memoryColor = memoryUsage > 0.85 ? '#ef4444' : memoryUsage > 0.6 ? '#f97316' : '#22c55e';

  // Shake increases with memory pressure
  const shakeIntensity = interpolate(memoryUsage, [0.7, 1], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const shakeX = isCrashed ? 0 : Math.sin(frame * 1.5) * shakeIntensity * minDim * 0.008;
  const shakeY = isCrashed ? 0 : Math.cos(frame * 1.8) * shakeIntensity * minDim * 0.005;

  // Stack frames
  const stackFrames = Array.from({ length: currentStackDepth }, (_, i) => ({
    id: i, name: 'fib', arg: maxFrames - i,
  }));

  const stackWidth = width * 0.45;
  const frameHeight = height * 0.05;

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, #1a1a3e 0%, #0f0f23 70%)' }}>
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: minDim * 0.08,
        transform: \\\`translate(\${shakeX}px, \${shakeY}px)\\\`,
      }}>
        {/* Stack visualization */}
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: height * 0.008 }}>
          {stackFrames.map((sf) => {
            const entryProgress = spring({ frame: frame - sf.id * frameInterval, fps, config: { damping: 12, stiffness: 100 } });
            const stressLevel = sf.id / maxFrames;
            return (
              <div key={sf.id} style={{
                width: stackWidth * 0.9, height: frameHeight,
                background: 'linear-gradient(135deg, #8b5cf622 0%, #8b5cf611 100%)',
                border: \\\`\${Math.max(1, minDim * 0.002)}px solid #a78bfa\\\`,
                borderRadius: minDim * 0.01,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: \\\`scale(\${entryProgress})\\\`,
                opacity: entryProgress,
                boxShadow: stressLevel > 0.7 ? \\\`0 0 \${minDim * 0.015}px #ef444466\\\` : 'none',
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: height * 0.022, color: '#a78bfa' }}>
                  {sf.name}({sf.arg})
                </span>
              </div>
            );
          })}
        </div>

        {/* Memory bar */}
        <div style={{
          width: width * 0.08, height: height * 0.7,
          background: '#1a1a2e', borderRadius: minDim * 0.015,
          border: \\\`\${Math.max(1, minDim * 0.002)}px solid #333\\\`,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        }}>
          <div style={{
            width: '100%', height: \\\`\${memoryUsage * 100}%\\\`,
            background: memoryColor, borderRadius: minDim * 0.01,
            boxShadow: \\\`0 0 \${minDim * 0.025}px \${memoryColor}66\\\`,
          }} />
        </div>
      </div>

      {/* Depth counter */}
      <div style={{ position: 'absolute', bottom: minDim * 0.05, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ fontSize: height * 0.05, fontWeight: 800, color: memoryColor }}>
          {currentStackDepth}
        </span>
        <span style={{ fontSize: height * 0.022, color: '#888', marginLeft: minDim * 0.015 }}>
          frames deep
        </span>
      </div>
    </AbsoluteFill>
  );
};
\`\`\`
`;

/**
 * Reference Example 3: Hash Collisions - When Keys Collide
 *
 * DEMONSTRATES: Gravity physics, bounce, stacking, lookup cost visualization
 * MEANINGFUL BECAUSE: Balls physically pile up, lookup scanner digs through - shows O(n) cost
 */
export const REFERENCE_HASH_COLLISIONS = `
### Example: Hash Collisions with Physics

**What it demonstrates:** Gravity, bouncing, collision stacking, lookup traversal
**Key insight:** Balls pile up in buckets - lookup must scan through stack (O(n) vs O(1))

\`\`\`tsx
// src/\${projectId}/index.tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring } from 'remotion';

// Use simulateBallPhysics from COMMON_PATTERNS

export const \${projectId}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  const numBuckets = 6;
  const ballRadius = minDim * 0.035;
  const bucketWidth = minDim * 0.11;
  const bucketHeight = height * 0.45;

  // Balls with intentional collisions in bucket 2
  const balls = [
    { id: 0, bucketIndex: 0, dropFrame: 15, stackPos: 0, color: '#8b5cf6' },
    { id: 1, bucketIndex: 2, dropFrame: 30, stackPos: 0, color: '#3b82f6' },
    { id: 2, bucketIndex: 4, dropFrame: 45, stackPos: 0, color: '#06b6d4' },
    { id: 3, bucketIndex: 2, dropFrame: 60, stackPos: 1, color: '#22c55e' },  // Collision!
    { id: 4, bucketIndex: 1, dropFrame: 75, stackPos: 0, color: '#f97316' },
    { id: 5, bucketIndex: 2, dropFrame: 90, stackPos: 2, color: '#ef4444' },  // Collision!
    { id: 6, bucketIndex: 2, dropFrame: 120, stackPos: 3, color: '#eab308' }, // Collision!
  ];

  // Lookup animation - scanning bucket 2
  const lookupStart = 150;
  const lookupProgress = interpolate(frame - lookupStart, [0, 30, 60, 90], [0, 1, 2, 3], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const lookupComplete = frame > lookupStart + 100;

  const totalWidth = numBuckets * bucketWidth + (numBuckets - 1) * minDim * 0.02;
  const startX = (width - totalWidth) / 2;
  const bucketY = height * 0.75;

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at top, #1a1a3e 0%, #0f0f23 70%)' }}>
      {/* Buckets */}
      {Array.from({ length: numBuckets }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: startX + i * (bucketWidth + minDim * 0.02),
          top: bucketY - bucketHeight,
          width: bucketWidth, height: bucketHeight,
          background: '#1e293b',
          border: \\\`\${Math.max(2, minDim * 0.003)}px solid \${frame >= lookupStart && i === 2 ? '#3b82f6' : '#475569'}\\\`,
          borderTop: 'none',
          borderRadius: \\\`0 0 \${minDim * 0.015}px \${minDim * 0.015}px\\\`,
        }} />
      ))}

      {/* Falling balls */}
      {balls.map((ball) => {
        if (frame < ball.dropFrame) return null;
        const bucketX = startX + ball.bucketIndex * (bucketWidth + minDim * 0.02) + bucketWidth / 2;
        const targetY = bucketY - ballRadius - ball.stackPos * ballRadius * 2.2;

        // Simple physics approximation (use full simulateBallPhysics for production)
        const elapsed = frame - ball.dropFrame;
        const fallDuration = 25;
        const y = elapsed < fallDuration
          ? interpolate(elapsed, [0, fallDuration], [-ballRadius * 2, targetY], { extrapolateRight: 'clamp' })
          : targetY;

        const isBeingChecked = frame >= lookupStart && ball.bucketIndex === 2 && Math.floor(lookupProgress) === ball.stackPos;

        return (
          <div key={ball.id} style={{
            position: 'absolute',
            left: bucketX - ballRadius, top: y - ballRadius,
            width: ballRadius * 2, height: ballRadius * 2,
            borderRadius: '50%',
            background: \\\`radial-gradient(circle at 30% 30%, \${ball.color}, \${ball.color}88)\\\`,
            boxShadow: isBeingChecked ? \\\`0 0 \${minDim * 0.03}px #3b82f6\\\` : 'none',
            border: isBeingChecked ? \\\`\${Math.max(2, minDim * 0.004)}px solid #3b82f6\\\` : 'none',
          }} />
        );
      })}

      {/* Stats */}
      <div style={{ position: 'absolute', top: minDim * 0.05, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: minDim * 0.1 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: height * 0.045, fontWeight: 800, color: '#ef4444' }}>3</div>
          <div style={{ fontSize: height * 0.02, color: '#888' }}>collisions</div>
        </div>
        {frame >= lookupStart && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: height * 0.045, fontWeight: 800, color: lookupComplete ? '#22c55e' : '#3b82f6' }}>
              {Math.min(Math.floor(lookupProgress) + 1, 4)}
            </div>
            <div style={{ fontSize: height * 0.02, color: '#888' }}>checks to find</div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
\`\`\`
`;

/**
 * Constructs the reference examples section for the prompt.
 * Now includes COMMON_PATTERNS once, followed by slimmed examples.
 */
export function buildReferenceExamplesSection(projectId: string): string {
  return `
## 🎨 REFERENCE PATTERNS & EXAMPLES

These examples demonstrate **meaningful animations** that teach concepts through motion.

**KEY PRINCIPLES:**
1. **Continuous motion** - Animation throughout, not just "spring in and sit"
2. **Conceptual, not literal** - Show WHY/HOW, not just WHAT
3. **Physics-based** - Gravity, bouncing, particles create visceral understanding
4. **Responsive** - All sizes relative to width/height

---

${COMMON_PATTERNS}

---

## 📚 REFERENCE EXAMPLES

Use these as inspiration. Each shows a different visualization technique:

${REFERENCE_SEARCH_RACE.replace(/\$\{projectId\}/g, projectId)}

---

${REFERENCE_STACK_OVERFLOW.replace(/\$\{projectId\}/g, projectId)}

---

${REFERENCE_HASH_COLLISIONS.replace(/\$\{projectId\}/g, projectId)}
`;
}
