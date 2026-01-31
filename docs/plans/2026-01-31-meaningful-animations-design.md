# Meaningful Animations Design

## Overview

This design addresses three critical problems with AI-generated visuals:

1. **Static after entrance** - Animations are mostly "spring in then sit there"
2. **Literal not conceptual** - Shows "a binary tree" instead of "why binary tree fails here"
3. **Text-heavy** - Agent falls back to animated text instead of visual storytelling

**Solution:** A three-part approach combining prompt philosophy changes, structured scene planning with reasoning, and new narrative-driven reference examples.

**Target content types:** Technical explanations and educational content (algorithms, data structures, how things work, comparisons, processes).

---

## Part 1: Animation Philosophy

Replace the current "VISUAL DESIGN REQUIREMENTS" section in the prompt with this fundamentally different mindset:

```markdown
## 🎬 ANIMATION PHILOSOPHY

You are creating **visual narratives**, not decorated slides.

### The Three Laws of Meaningful Animation:

**1. CONTINUOUS MOTION**
Every sequence must have animation throughout its duration, not just entrance effects.
- ❌ Elements spring in, then sit static
- ✅ Elements enter, then demonstrate, then transition

**2. CONCEPTUAL, NOT LITERAL**
Show WHY and HOW, not just WHAT.
- ❌ "Binary tree" → Draw a static tree diagram
- ✅ "Binary tree is slow here" → Show search path growing longer, branches multiplying, O(n) counter climbing

- ❌ "Caching improves speed" → Show a cache icon
- ✅ "Caching improves speed" → Show request hitting cache (instant flash) vs traveling to database (long animated journey)

**3. ZERO TEXT OVERLAYS**
Subtitles handle all text. Your job is PURE VISUAL STORYTELLING.
- ❌ Animated text saying "Step 1: Configure"
- ❌ Labels floating over diagrams
- ✅ Visual metaphors that need no explanation
- Exception: Single numbers/percentages for data visualization (e.g., "85%" in a progress ring)
```

---

## Part 2: Scene Planning with Chain of Thought

Before writing any code, the agent must think through each scene with explicit reasoning. This catches "literal" thinking before it becomes code.

```markdown
## 📋 SCENE PLANNING WITH REASONING (REQUIRED FIRST STEP)

Before writing ANY code, think through each scene step by step.

### Scene Plan Format:

\`\`\`json
{
  "scenes": [
    {
      "timestamp": "0:00 - 0:08",
      "transcript": "Exact words being spoken",

      "reasoning": {
        "whatIsBeingExplained": "The core concept the speaker wants the audience to understand",
        "whyNotLiteral": "Why a literal depiction would fail (e.g., 'showing a tree icon doesn't explain WHY it's slow')",
        "whatWouldMakeItClick": "The 'aha moment' - what visual would make a viewer instantly GET it",
        "howAnimationAddsUnderstanding": "What the motion itself communicates that a static image cannot"
      },

      "decision": {
        "visualMetaphor": "The chosen representation",
        "animationNarrative": "Beat-by-beat description of motion",
        "keyframes": ["start", "middle", "end"]
      }
    }
  ]
}
\`\`\`

### Example with Full Reasoning:

**Transcript:** "The problem with bubble sort is that it keeps comparing adjacent elements over and over..."

\`\`\`json
{
  "scenes": [
    {
      "timestamp": "0:00 - 0:07",
      "transcript": "The problem with bubble sort is that it keeps comparing adjacent elements over and over",

      "reasoning": {
        "whatIsBeingExplained": "Bubble sort's inefficiency - redundant comparisons",
        "whyNotLiteral": "Just showing array elements swapping doesn't convey the WASTE. Viewer won't feel the redundancy.",
        "whatWouldMakeItClick": "Show the SAME comparisons happening repeatedly. Make the repetition visually tedious/exhausting.",
        "howAnimationAddsUnderstanding": "By showing multiple passes over already-sorted sections, the viewer SEES the wasted work. A counter showing redundant comparisons makes it quantifiable."
      },

      "decision": {
        "visualMetaphor": "Array with a 'scan line' that keeps re-scanning sections that are already sorted",
        "animationNarrative": "Pass 1: scan line moves left-to-right, swaps happen → Pass 2: scan line starts over, fewer swaps but SAME distance traveled → Pass 3: scan line travels ENTIRE array for just 1 swap → redundancy counter climbs",
        "keyframes": [
          "full array, scan begins",
          "pass 2 starting over (viewer feels 'again?')",
          "pass N, nearly sorted but still full scan, counter shows wasted ops"
        ]
      }
    }
  ]
}
\`\`\`

### Reasoning Quality Checklist:
- [ ] "whyNotLiteral" identifies a specific failure of the obvious approach
- [ ] "whatWouldMakeItClick" describes an insight, not just a visual
- [ ] "howAnimationAddsUnderstanding" explains what MOTION contributes
- [ ] Animation narrative has multiple beats (not just "elements appear")
```

---

## Part 3: Narrative Reference Examples

Replace current static-ish examples (flowchart, bar chart, info card) with these narrative-driven demonstrations.

### Example 1: Linear vs Binary Search - The Race

**Concept:** Two algorithms race to find the same target. The contrast creates the "aha moment."

```tsx
// src/${projectId}/index.tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring } from 'remotion';

const COLORS = {
  bg: '#0f0f23',
  linear: '#ef4444',
  binary: '#22c55e',
  element: '#2a2a4a',
  highlight: '#8b5cf6',
  eliminated: 'rgba(42, 42, 74, 0.3)',
};

export const ${projectId}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // 16 sorted elements, target is at index 12
  const elements = Array.from({ length: 16 }, (_, i) => (i + 1) * 5); // [5, 10, 15... 80]
  const targetValue = 65; // elements[12]
  const targetIndex = 12;

  // === LINEAR SEARCH: Slow, steady crawl ===
  const linearSpeed = 12; // frames per check
  const linearProgress = Math.floor(frame / linearSpeed);
  const linearCurrentIndex = Math.min(linearProgress, targetIndex);
  const linearFound = linearProgress >= targetIndex;
  const linearChecks = Math.min(linearProgress + 1, targetIndex + 1);

  // === BINARY SEARCH: Dramatic divide & conquer ===
  // Binary search steps: [0,15] -> [8,15] -> [8,11] -> [12,15] -> found 12
  const binarySteps = [
    { left: 0, right: 15, mid: 7, direction: 'right' },
    { left: 8, right: 15, mid: 11, direction: 'right' },
    { left: 12, right: 15, mid: 13, direction: 'left' },
    { left: 12, right: 12, mid: 12, direction: 'found' },
  ];

  const binarySpeed = 35; // frames per step (slower, more dramatic)
  const binaryStepIndex = Math.min(Math.floor(frame / binarySpeed), binarySteps.length - 1);
  const binaryStep = binarySteps[binaryStepIndex];
  const binaryFound = binaryStep.direction === 'found';
  const binaryChecks = Math.min(binaryStepIndex + 1, binarySteps.length);

  // Responsive sizes
  const elementWidth = minDim * 0.045;
  const elementHeight = minDim * 0.07;
  const gap = minDim * 0.008;
  const rowGap = minDim * 0.12;
  const fontSize = height * 0.018;
  const labelSize = height * 0.028;
  const counterSize = height * 0.055;

  // Helper: render a row of elements for one algorithm
  const renderRow = (
    algorithm: 'linear' | 'binary',
    currentIdx: number | null,
    eliminatedRange: { left: number; right: number } | null,
    found: boolean
  ) => {
    return (
      <div style={{
        display: 'flex',
        gap,
        justifyContent: 'center',
      }}>
        {elements.map((val, i) => {
          const isTarget = i === targetIndex;
          const isCurrent = i === currentIdx;

          // Binary search: show eliminated regions
          let isEliminated = false;
          if (algorithm === 'binary' && eliminatedRange) {
            isEliminated = i < eliminatedRange.left || i > eliminatedRange.right;
          }

          // Linear search: show checked elements
          const isChecked = algorithm === 'linear' && i < linearCurrentIndex;

          // Determine appearance
          let bgColor = COLORS.element;
          let opacity = 1;
          let scale = 1;
          let glowColor = 'transparent';
          let glowSize = 0;

          if (isTarget && found) {
            bgColor = algorithm === 'linear' ? COLORS.linear : COLORS.binary;
            scale = spring({ frame: frame - (found ? (algorithm === 'linear' ? linearCurrentIndex * linearSpeed : binaryStepIndex * binarySpeed) : 0), fps, config: { damping: 8, stiffness: 100 } });
            scale = 1 + (scale - 1) * 0.3; // Subtle pulse
            glowColor = bgColor;
            glowSize = minDim * 0.025;
          } else if (isCurrent && !found) {
            bgColor = algorithm === 'linear' ? COLORS.linear : COLORS.binary;
            scale = 1.2;
            glowColor = bgColor;
            glowSize = minDim * 0.015;
          } else if (isEliminated) {
            opacity = 0.25;
            scale = 0.85;
          } else if (isChecked) {
            opacity = 0.5;
          }

          return (
            <div
              key={i}
              style={{
                width: elementWidth,
                height: elementHeight,
                background: bgColor,
                borderRadius: minDim * 0.008,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'ui-monospace, monospace',
                fontSize,
                fontWeight: 600,
                color: opacity < 1 ? '#444' : '#fff',
                opacity,
                transform: `scale(${scale})`,
                boxShadow: glowSize > 0 ? `0 0 ${glowSize}px ${glowColor}` : 'none',
              }}
            >
              {val}
            </div>
          );
        })}
      </div>
    );
  };

  // Calculate current states
  const linearCurrentIdx = linearFound ? targetIndex : linearCurrentIndex;
  const binaryCurrentIdx = binaryFound ? targetIndex : binaryStep.mid;
  const binaryActiveRange = { left: binaryStep.left, right: binaryStep.right };

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at center, #1a1a3e 0%, ${COLORS.bg} 70%)`
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: minDim * 0.04,
        gap: rowGap,
      }}>

        {/* LINEAR SEARCH ROW */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: minDim * 0.02,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: minDim * 0.03,
          }}>
            {/* Algorithm indicator */}
            <div style={{
              width: minDim * 0.015,
              height: minDim * 0.015,
              borderRadius: '50%',
              background: COLORS.linear,
              boxShadow: `0 0 ${minDim * 0.015}px ${COLORS.linear}`,
            }} />
            {/* Counter */}
            <span style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: counterSize,
              fontWeight: 800,
              color: COLORS.linear,
              minWidth: minDim * 0.08,
            }}>
              {linearChecks}
            </span>
            {/* Status */}
            {linearFound && (
              <span style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: labelSize,
                color: COLORS.linear,
                opacity: spring({ frame: frame - targetIndex * linearSpeed, fps, config: { damping: 12 } }),
              }}>
                ✓
              </span>
            )}
          </div>
          {renderRow('linear', linearCurrentIdx, null, linearFound)}
        </div>

        {/* BINARY SEARCH ROW */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: minDim * 0.02,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: minDim * 0.03,
          }}>
            {/* Algorithm indicator */}
            <div style={{
              width: minDim * 0.015,
              height: minDim * 0.015,
              borderRadius: '50%',
              background: COLORS.binary,
              boxShadow: `0 0 ${minDim * 0.015}px ${COLORS.binary}`,
            }} />
            {/* Counter */}
            <span style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: counterSize,
              fontWeight: 800,
              color: COLORS.binary,
              minWidth: minDim * 0.08,
            }}>
              {binaryChecks}
            </span>
            {/* Status */}
            {binaryFound && (
              <span style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: labelSize,
                color: COLORS.binary,
                opacity: spring({ frame: frame - (binarySteps.length - 1) * binarySpeed, fps, config: { damping: 12 } }),
              }}>
                ✓
              </span>
            )}
          </div>
          {renderRow('binary', binaryCurrentIdx, binaryActiveRange, binaryFound)}
        </div>

      </div>
    </AbsoluteFill>
  );
};
```

**Why this works:**
- **Complex:** Two parallel state machines, elimination regions, multiple simultaneous animations
- **Meaningful:** The RACE creates contrast. Binary finishes in 4 steps while linear is still crawling. Eliminated regions show WHY binary is faster (half the data gone each step)
- **Responsive:** All sizes derived from minDim/height

---

### Example 2: Stack Overflow - The Inevitable Crash

**Concept:** Recursive function calls pile up with physics. Memory bar fills. Shake increases. The crash becomes inevitable.

```tsx
// src/${projectId}/index.tsx
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

export const ${projectId}: React.FC = () => {
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
      background: `radial-gradient(ellipse at center, #1a1a3e 0%, ${COLORS.bg} 70%)`,
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: minDim * 0.08,
        padding,
        transform: `translate(${shakeX}px, ${shakeY}px)`,
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
                  background: `radial-gradient(circle, ${COLORS.explosion} 0%, transparent 70%)`,
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
                      transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`,
                      opacity: p.opacity,
                      boxShadow: `0 0 ${minDim * 0.01}px ${COLORS.explosion}`,
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
                    background: `linear-gradient(135deg, ${COLORS.frame}22 0%, ${COLORS.frame}11 100%)`,
                    border: `${Math.max(1, minDim * 0.002)}px solid ${COLORS.frameStroke}`,
                    borderRadius: minDim * 0.01,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: minDim * 0.015,
                    transform: `
                      scale(${entryProgress * pulse})
                      translateX(${scatterX}px)
                      translateY(${scatterY}px)
                      rotate(${scatterRotate}deg)
                    `,
                    opacity: scatterOpacity * entryProgress,
                    boxShadow: stressLevel > 0.7
                      ? `0 0 ${minDim * 0.015}px ${COLORS.danger}66`
                      : `0 0 ${minDim * 0.01}px ${COLORS.frame}44`,
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
              textShadow: `0 0 ${minDim * 0.02}px ${memoryColor}`,
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
            border: `${Math.max(1, minDim * 0.002)}px solid #333`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            position: 'relative',
          }}>
            {/* Fill level */}
            <div style={{
              width: '100%',
              height: `${memoryUsage * 100}%`,
              background: `linear-gradient(180deg, ${memoryColor} 0%, ${memoryColor}88 100%)`,
              borderRadius: minDim * 0.01,
              boxShadow: `0 0 ${minDim * 0.025}px ${memoryColor}66`,
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
```

**Why this works:**
- **Complex:** Parallel animations (stack + memory + shake + particles), multiple state phases (growing → warning → critical → explosion), physics (gravity on particles, stress pulses)
- **Meaningful:** Each frame is "waiting" (pulsing) - shows WHY they pile up. Memory bar creates PRESSURE. Shake shows system STRUGGLING. Explosion is visceral consequence.
- **Responsive:** All sizes derived from minDim/height

---

### Example 3: Hash Collisions - When Keys Collide (Physics-Based)

**Concept:** Keys fall with gravity into hash buckets. Good distribution = fast. Collisions = balls stack up, lookup has to dig through the pile.

```tsx
// src/${projectId}/index.tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring } from 'remotion';

const COLORS = {
  bg: '#0f0f23',
  bucket: '#1e293b',
  bucketStroke: '#475569',
  ball: ['#8b5cf6', '#3b82f6', '#06b6d4', '#22c55e', '#f97316', '#ef4444', '#ec4899', '#eab308'],
  collision: '#ef4444',
  success: '#22c55e',
  glow: 'rgba(139, 92, 246, 0.4)',
};

interface Ball {
  id: number;
  key: string;
  bucketIndex: number;
  color: string;
  dropFrame: number;
  stackPosition: number;
}

// Simple physics simulation for a falling ball
const simulateBallPhysics = (
  frame: number,
  dropFrame: number,
  targetY: number,
  bounceHeight: number,
  fps: number
) => {
  const elapsed = frame - dropFrame;
  if (elapsed < 0) return { y: -100, settled: false };

  const gravity = 0.004;
  const bounceDamping = 0.5;
  const settleThreshold = 2;

  let y = 0;
  let velocity = 0;
  let bounces = 0;
  const maxBounces = 4;

  for (let t = 0; t < elapsed; t++) {
    velocity += gravity;
    y += velocity;

    if (y >= targetY) {
      y = targetY;
      velocity = -velocity * bounceDamping;
      bounces++;

      if (bounces >= maxBounces || Math.abs(velocity) < settleThreshold * 0.01) {
        return { y: targetY, settled: true };
      }
    }
  }

  return { y: Math.min(y, targetY), settled: false };
};

export const ${projectId}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // === CONFIGURATION ===
  const numBuckets = 6;
  const ballRadius = minDim * 0.035;
  const bucketWidth = minDim * 0.11;
  const bucketHeight = height * 0.45;
  const bucketGap = minDim * 0.02;
  const bucketY = height * 0.75;

  // === BALLS WITH INTENTIONAL COLLISIONS ===
  const balls: Ball[] = [
    { id: 0, key: 'user_1', bucketIndex: 0, color: COLORS.ball[0], dropFrame: 15, stackPosition: 0 },
    { id: 1, key: 'user_2', bucketIndex: 2, color: COLORS.ball[1], dropFrame: 30, stackPosition: 0 },
    { id: 2, key: 'user_3', bucketIndex: 4, color: COLORS.ball[2], dropFrame: 45, stackPosition: 0 },
    { id: 3, key: 'user_4', bucketIndex: 2, color: COLORS.ball[3], dropFrame: 60, stackPosition: 1 },
    { id: 4, key: 'user_5', bucketIndex: 1, color: COLORS.ball[4], dropFrame: 75, stackPosition: 0 },
    { id: 5, key: 'user_6', bucketIndex: 2, color: COLORS.ball[5], dropFrame: 90, stackPosition: 2 },
    { id: 6, key: 'user_7', bucketIndex: 5, color: COLORS.ball[6], dropFrame: 105, stackPosition: 0 },
    { id: 7, key: 'user_8', bucketIndex: 2, color: COLORS.ball[7], dropFrame: 120, stackPosition: 3 },
    { id: 8, key: 'user_9', bucketIndex: 4, color: COLORS.ball[0], dropFrame: 135, stackPosition: 1 },
    { id: 9, key: 'user_10', bucketIndex: 3, color: COLORS.ball[1], dropFrame: 150, stackPosition: 0 },
  ];

  // === LOOKUP ANIMATION ===
  const lookupStartFrame = 180;
  const lookupBucketIndex = 2;
  const lookupProgress = interpolate(
    frame - lookupStartFrame,
    [0, 30, 50, 70, 90],
    [0, 1, 2, 3, 4],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const lookupComplete = frame > lookupStartFrame + 100;

  // Count collisions
  const bucketCounts: Record<number, number> = {};
  balls.forEach(ball => {
    if (frame >= ball.dropFrame) {
      bucketCounts[ball.bucketIndex] = (bucketCounts[ball.bucketIndex] || 0) + 1;
    }
  });
  const totalCollisions = Object.values(bucketCounts).reduce((sum, count) => sum + Math.max(0, count - 1), 0);

  // === RESPONSIVE SIZES ===
  const fontSize = height * 0.02;
  const counterSize = height * 0.045;
  const totalBucketsWidth = numBuckets * bucketWidth + (numBuckets - 1) * bucketGap;
  const startX = (width - totalBucketsWidth) / 2;

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at top, #1a1a3e 0%, ${COLORS.bg} 70%)`,
    }}>
      {/* === BUCKETS === */}
      {Array.from({ length: numBuckets }).map((_, bucketIdx) => {
        const bucketX = startX + bucketIdx * (bucketWidth + bucketGap);
        const ballsInBucket = bucketCounts[bucketIdx] || 0;
        const isOverloaded = ballsInBucket > 2;
        const isBeingSearched = frame >= lookupStartFrame && bucketIdx === lookupBucketIndex;

        const shakeX = isOverloaded
          ? Math.sin(frame * 0.5 + bucketIdx) * minDim * 0.003 * (ballsInBucket - 2)
          : 0;

        return (
          <div
            key={bucketIdx}
            style={{
              position: 'absolute',
              left: bucketX,
              top: bucketY - bucketHeight,
              width: bucketWidth,
              height: bucketHeight,
              transform: `translateX(${shakeX}px)`,
            }}
          >
            <div style={{
              width: '100%',
              height: '100%',
              background: COLORS.bucket,
              border: `${Math.max(2, minDim * 0.003)}px solid ${isBeingSearched ? COLORS.ball[1] : COLORS.bucketStroke}`,
              borderTop: 'none',
              borderRadius: `0 0 ${minDim * 0.015}px ${minDim * 0.015}px`,
              boxShadow: isBeingSearched
                ? `0 0 ${minDim * 0.03}px ${COLORS.ball[1]}66`
                : isOverloaded
                  ? `0 0 ${minDim * 0.02}px ${COLORS.collision}44`
                  : 'none',
            }} />

            <div style={{
              position: 'absolute',
              bottom: -minDim * 0.05,
              left: '50%',
              transform: 'translateX(-50%)',
              fontFamily: 'ui-monospace, monospace',
              fontSize,
              color: '#666',
            }}>
              [{bucketIdx}]
            </div>
          </div>
        );
      })}

      {/* === FALLING BALLS === */}
      {balls.map((ball) => {
        const bucketX = startX + ball.bucketIndex * (bucketWidth + bucketGap) + bucketWidth / 2;
        const bucketBottom = bucketY;
        const targetY = bucketBottom - ballRadius - (ball.stackPosition * ballRadius * 2.2);

        const physics = simulateBallPhysics(frame, ball.dropFrame, targetY, ballRadius * 2, fps);

        if (frame < ball.dropFrame) return null;

        const isBeingChecked = frame >= lookupStartFrame &&
          ball.bucketIndex === lookupBucketIndex &&
          Math.floor(lookupProgress) === ball.stackPosition;
        const isFoundMatch = lookupComplete && ball.bucketIndex === lookupBucketIndex && ball.stackPosition === 3;

        const justLanded = physics.settled && frame - ball.dropFrame < 20;
        const isCollision = ball.stackPosition > 0 && justLanded;

        const velocity = frame - ball.dropFrame < 5 ? 0 : Math.min((frame - ball.dropFrame) * 0.02, 0.3);
        const scaleX = physics.settled ? 1 : 1 - velocity * 0.2;
        const scaleY = physics.settled ? 1 : 1 + velocity * 0.3;

        const landingSquash = justLanded && physics.settled
          ? interpolate(frame - ball.dropFrame, [0, 8, 15], [1, 0.7, 1], { extrapolateRight: 'clamp' })
          : 1;

        return (
          <div
            key={ball.id}
            style={{
              position: 'absolute',
              left: bucketX - ballRadius,
              top: physics.y - ballRadius,
              width: ballRadius * 2,
              height: ballRadius * 2,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${ball.color}, ${ball.color}88)`,
              transform: `scaleX(${scaleX * (1 / landingSquash)}) scaleY(${scaleY * landingSquash})`,
              boxShadow: isBeingChecked
                ? `0 0 ${minDim * 0.03}px ${COLORS.ball[1]}, inset 0 0 ${minDim * 0.015}px rgba(255,255,255,0.3)`
                : isCollision
                  ? `0 0 ${minDim * 0.04}px ${COLORS.collision}`
                  : isFoundMatch
                    ? `0 0 ${minDim * 0.04}px ${COLORS.success}`
                    : `0 0 ${minDim * 0.015}px ${ball.color}66, inset 0 0 ${minDim * 0.01}px rgba(255,255,255,0.2)`,
              border: isFoundMatch
                ? `${Math.max(2, minDim * 0.004)}px solid ${COLORS.success}`
                : isBeingChecked
                  ? `${Math.max(2, minDim * 0.004)}px solid ${COLORS.ball[1]}`
                  : 'none',
              zIndex: ball.stackPosition + 1,
            }}
          >
            <div style={{
              position: 'absolute',
              top: '15%',
              left: '20%',
              width: '25%',
              height: '25%',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.4)',
            }} />
          </div>
        );
      })}

      {/* === LOOKUP SCANNER === */}
      {frame >= lookupStartFrame && !lookupComplete && (
        <div style={{
          position: 'absolute',
          left: startX + lookupBucketIndex * (bucketWidth + bucketGap),
          top: bucketY - bucketHeight + (bucketHeight * 0.1),
          width: bucketWidth,
          height: minDim * 0.008,
          background: `linear-gradient(90deg, transparent, ${COLORS.ball[1]}, transparent)`,
          transform: `translateY(${Math.floor(lookupProgress) * ballRadius * 2.5}px)`,
          boxShadow: `0 0 ${minDim * 0.02}px ${COLORS.ball[1]}`,
          opacity: 0.8,
        }} />
      )}

      {/* === STATS DISPLAY === */}
      <div style={{
        position: 'absolute',
        top: minDim * 0.05,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: minDim * 0.1,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: minDim * 0.01,
        }}>
          <span style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: counterSize,
            fontWeight: 800,
            color: totalCollisions > 0 ? COLORS.collision : COLORS.success,
            textShadow: `0 0 ${minDim * 0.02}px ${totalCollisions > 0 ? COLORS.collision : COLORS.success}66`,
          }}>
            {totalCollisions}
          </span>
          <span style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: height * 0.02,
            color: '#888',
          }}>
            collisions
          </span>
        </div>

        {frame >= lookupStartFrame && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: minDim * 0.01,
            opacity: spring({ frame: frame - lookupStartFrame, fps, config: { damping: 15 } }),
          }}>
            <span style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: counterSize,
              fontWeight: 800,
              color: lookupComplete ? COLORS.success : COLORS.ball[1],
              textShadow: `0 0 ${minDim * 0.02}px ${lookupComplete ? COLORS.success : COLORS.ball[1]}66`,
            }}>
              {Math.min(Math.floor(lookupProgress) + 1, 4)}
            </span>
            <span style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: height * 0.02,
              color: '#888',
            }}>
              checks to find
            </span>
          </div>
        )}
      </div>

      {/* === O(1) vs O(n) indicator === */}
      {frame >= lookupStartFrame + 50 && (
        <div style={{
          position: 'absolute',
          bottom: minDim * 0.08,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: spring({ frame: frame - lookupStartFrame - 50, fps, config: { damping: 12 } }),
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: minDim * 0.02,
            padding: `${minDim * 0.015}px ${minDim * 0.03}px`,
            background: 'rgba(239, 68, 68, 0.15)',
            borderRadius: minDim * 0.01,
            border: `${Math.max(1, minDim * 0.002)}px solid ${COLORS.collision}44`,
          }}>
            <span style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: height * 0.028,
              fontWeight: 700,
              color: COLORS.collision,
            }}>
              O(n)
            </span>
            <span style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: height * 0.022,
              color: '#888',
            }}>
              instead of O(1)
            </span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
```

**Why this works:**
- **Complex Physics:** Real gravity simulation, bounce damping, squash & stretch, stack settling, bucket shake
- **Meaningful:** Collisions are PHYSICAL - balls pile up visibly. Lookup scanner digs through stack. Counter shows "4 checks" vs ideal O(1). Crowded bucket shakes.
- **Responsive:** All physics values and sizes scaled to minDim

---

## Implementation Notes

### Files to Modify

1. **`packages/worker/src/prompts/generate-visuals.ts`**
   - Add Animation Philosophy section (Part 1)
   - Add Scene Planning section (Part 2)
   - Update the `buildGenerateVisualsPrompt` function

2. **`packages/worker/src/prompts/visual-references.ts`**
   - Replace existing examples with the three narrative examples (Part 3)
   - Update `buildReferenceExamplesSection` function

### Prompt Structure (Updated)

```
1. Reference Examples (new narrative ones)
2. Animation Philosophy (THREE LAWS)
3. Scene Planning with Reasoning (REQUIRED FIRST)
4. Video Specifications
5. Technical Rules (existing, keep)
6. Self-Healing Workflow (existing, keep)
```

### Validation Checklist

Before considering implementation complete:

- [ ] Scene plan JSON is generated before any code
- [ ] Reasoning includes "whyNotLiteral" for each scene
- [ ] No text overlays in generated output (except single numbers)
- [ ] Animations continue throughout duration (not just entrance)
- [ ] All sizes use responsive multipliers (no hardcoded px)
- [ ] Physics simulations use frame-based calculations (no CSS transitions)

---

## Future Extensions

- **Additional content types:** Add separate prompt variations for business/marketing content
- **Style-specific physics:** Different physics parameters per style preset (playful = bouncier, minimal = smoother)
- **Complexity tiers:** Simple/medium/complex animation templates based on video duration
