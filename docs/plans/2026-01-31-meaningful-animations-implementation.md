# Meaningful Animations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the visual generation prompt system to produce meaningful, narrative-driven animations instead of static/entrance-only visuals with text overlays.

**Architecture:** Modify two files in `packages/worker/src/prompts/`: (1) `generate-visuals.ts` gets new Animation Philosophy and Scene Planning sections, (2) `visual-references.ts` gets three new narrative-driven examples replacing the static ones.

**Tech Stack:** TypeScript, Vitest for tests

---

## Task 1: Add Animation Philosophy Section

**Files:**
- Modify: `packages/worker/src/prompts/generate-visuals.ts:207-234` (replace VISUAL DESIGN REQUIREMENTS section)

**Step 1: Read the current file to confirm line numbers**

Run: Read `packages/worker/src/prompts/generate-visuals.ts` lines 200-240

**Step 2: Replace the VISUAL DESIGN REQUIREMENTS section**

Replace lines 207-234 (the `## 🎨 VISUAL DESIGN REQUIREMENTS` section) with the new Animation Philosophy:

```typescript
## 🎬 ANIMATION PHILOSOPHY

You are creating **visual narratives**, not decorated slides.

### The Three Laws of Meaningful Animation:

**1. CONTINUOUS MOTION**
Every sequence must have animation throughout its duration, not just entrance effects.
- ❌ Elements spring in, then sit static
- ✅ Elements enter, then DEMONSTRATE, then transition

**2. CONCEPTUAL, NOT LITERAL**
Show WHY and HOW, not just WHAT.
- ❌ "Binary tree" → Draw a static tree diagram
- ✅ "Binary tree is slow here" → Show search path growing longer, branches multiplying, O(n) counter climbing
- ❌ "Caching improves speed" → Show a cache icon
- ✅ "Caching improves speed" → Show request hitting cache (instant) vs database trip (long journey)

**3. ZERO TEXT OVERLAYS**
Subtitles handle all text. Your job is PURE VISUAL STORYTELLING.
- ❌ Animated text saying "Step 1: Configure"
- ❌ Labels floating over diagrams
- ✅ Visual metaphors that need no explanation
- Exception: Single numbers/percentages for data viz (e.g., "85%" in a progress ring)

---
```

**Step 3: Verify the file still has valid syntax**

Run: `cd /c/Users/armaa/Documents/cllipify && npx tsc --noEmit -p packages/worker/tsconfig.json 2>&1 | head -20`

Expected: No errors related to generate-visuals.ts

**Step 4: Commit**

```bash
git add packages/worker/src/prompts/generate-visuals.ts
git commit -m "feat(worker): add Animation Philosophy section to visual generation prompt"
```

---

## Task 2: Add Scene Planning Section

**Files:**
- Modify: `packages/worker/src/prompts/generate-visuals.ts` (add after Animation Philosophy, before Video Specifications)

**Step 1: Add Scene Planning with Chain of Thought section**

Insert after the Animation Philosophy section (after line ~234) and before `## 📐 Video Specifications`:

```typescript
## 📋 SCENE PLANNING WITH REASONING (REQUIRED FIRST STEP)

Before writing ANY code, analyze the transcript and output a scene plan.

### Scene Plan Format:

\`\`\`json
{
  "scenes": [
    {
      "timestamp": "0:00 - 0:08",
      "transcript": "Exact words being spoken",
      "reasoning": {
        "whatIsBeingExplained": "The core concept",
        "whyNotLiteral": "Why a literal depiction would fail",
        "whatWouldMakeItClick": "The aha moment visual",
        "howAnimationAddsUnderstanding": "What motion communicates"
      },
      "decision": {
        "visualMetaphor": "The chosen representation",
        "animationNarrative": "Beat-by-beat motion description",
        "keyframes": ["start state", "middle state", "end state"]
      }
    }
  ]
}
\`\`\`

### Example Scene Plan:

**Transcript:** "The problem with bubble sort is that it keeps comparing adjacent elements over and over..."

\`\`\`json
{
  "scenes": [
    {
      "timestamp": "0:00 - 0:07",
      "transcript": "The problem with bubble sort is that it keeps comparing adjacent elements over and over",
      "reasoning": {
        "whatIsBeingExplained": "Bubble sort's inefficiency - redundant comparisons",
        "whyNotLiteral": "Just showing swaps doesn't convey the WASTE. Viewer won't feel the redundancy.",
        "whatWouldMakeItClick": "Show the SAME comparisons repeatedly. Make repetition visually tedious.",
        "howAnimationAddsUnderstanding": "Multiple passes over already-sorted sections shows wasted work. Counter quantifies it."
      },
      "decision": {
        "visualMetaphor": "Array with scan line re-scanning sorted sections",
        "animationNarrative": "Pass 1: scan left-to-right, swaps happen → Pass 2: starts over, fewer swaps but SAME distance → Pass 3: full scan for 1 swap → counter climbs",
        "keyframes": ["full array, scan begins", "pass 2 starting over", "pass N, counter shows wasted ops"]
      }
    }
  ]
}
\`\`\`

### Reasoning Quality Checklist:
- [ ] "whyNotLiteral" identifies specific failure of obvious approach
- [ ] "whatWouldMakeItClick" describes an insight, not just a visual
- [ ] "howAnimationAddsUnderstanding" explains what MOTION contributes
- [ ] Animation narrative has multiple beats (not just "elements appear")

---
```

**Step 2: Verify syntax**

Run: `cd /c/Users/armaa/Documents/cllipify && npx tsc --noEmit -p packages/worker/tsconfig.json 2>&1 | head -20`

Expected: No errors

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/generate-visuals.ts
git commit -m "feat(worker): add Scene Planning with Chain of Thought to visual generation prompt"
```

---

## Task 3: Create Physics Simulation Helper

**Files:**
- Create: `packages/worker/src/prompts/physics-helpers.ts`

**Step 1: Create the physics helpers file**

```typescript
/**
 * Physics simulation code snippets for reference examples.
 * These demonstrate frame-based physics that work with Remotion's rendering model.
 */

export const BALL_PHYSICS_SIMULATION = `
// Frame-based physics simulation for falling objects
// Works with Remotion because it's a pure function of frame number
const simulateBallPhysics = (
  frame: number,
  dropFrame: number,
  targetY: number,
  fps: number
): { y: number; settled: boolean } => {
  const elapsed = frame - dropFrame;
  if (elapsed < 0) return { y: -100, settled: false };

  const gravity = 0.004; // Acceleration per frame²
  const bounceDamping = 0.5; // Energy loss per bounce
  const maxBounces = 4;

  let y = 0;
  let velocity = 0;
  let bounces = 0;

  for (let t = 0; t < elapsed; t++) {
    velocity += gravity;
    y += velocity;

    if (y >= targetY) {
      y = targetY;
      velocity = -velocity * bounceDamping;
      bounces++;

      if (bounces >= maxBounces || Math.abs(velocity) < 0.02) {
        return { y: targetY, settled: true };
      }
    }
  }

  return { y: Math.min(y, targetY), settled: false };
};
`;

export const SQUASH_STRETCH = `
// Squash and stretch based on velocity
const getSquashStretch = (velocity: number, settled: boolean) => {
  if (settled) return { scaleX: 1, scaleY: 1 };

  const stretch = Math.min(velocity * 0.02, 0.3);
  return {
    scaleX: 1 - stretch * 0.2,
    scaleY: 1 + stretch * 0.3,
  };
};
`;

export const SHAKE_EFFECT = `
// Shake intensity based on stress level
const getShake = (frame: number, intensity: number, minDim: number) => {
  if (intensity <= 0) return { x: 0, y: 0 };

  return {
    x: Math.sin(frame * 1.5) * intensity * minDim * 0.008,
    y: Math.cos(frame * 1.8) * intensity * minDim * 0.005,
  };
};
`;

export const EXPLOSION_PARTICLES = `
// Generate explosion particles with gravity
const generateParticles = (
  count: number,
  explosionProgress: number,
  minDim: number
) => {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + i * 0.5;
    const velocity = minDim * 0.3 + (i % 5) * minDim * 0.1;
    const size = minDim * 0.015 + (i % 3) * minDim * 0.01;

    return {
      x: Math.cos(angle) * velocity * explosionProgress,
      y: Math.sin(angle) * velocity * explosionProgress
         - (explosionProgress * explosionProgress * minDim * 0.2), // gravity
      size: size * (1 - explosionProgress * 0.5),
      opacity: 1 - explosionProgress,
      rotation: explosionProgress * 360 * (i % 2 === 0 ? 1 : -1),
    };
  });
};
`;
```

**Step 2: Verify syntax**

Run: `cd /c/Users/armaa/Documents/cllipify && npx tsc --noEmit -p packages/worker/tsconfig.json 2>&1 | head -20`

Expected: No errors

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/physics-helpers.ts
git commit -m "feat(worker): add physics simulation helpers for reference examples"
```

---

## Task 4: Replace Reference Examples - Linear vs Binary Search

**Files:**
- Modify: `packages/worker/src/prompts/visual-references.ts:86-241` (replace REFERENCE_FLOWCHART)

**Step 1: Replace REFERENCE_FLOWCHART with the Linear vs Binary Search race example**

Replace the entire `REFERENCE_FLOWCHART` constant (lines 86-241) with:

```typescript
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
              transform: \\\`scale(\\\${scale})\\\`,
            }}>
              {val}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ background: \\\`radial-gradient(ellipse at center, #1a1a3e 0%, \\\${COLORS.bg} 70%)\\\` }}>
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
              boxShadow: \\\`0 0 \\\${minDim * 0.015}px \\\${COLORS.linear}\\\`,
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
              boxShadow: \\\`0 0 \\\${minDim * 0.015}px \\\${COLORS.binary}\\\`,
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
```

**Step 2: Verify syntax**

Run: `cd /c/Users/armaa/Documents/cllipify && npx tsc --noEmit -p packages/worker/tsconfig.json 2>&1 | head -20`

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/visual-references.ts
git commit -m "feat(worker): replace flowchart example with Linear vs Binary Search race"
```

---

## Task 5: Replace Reference Examples - Stack Overflow

**Files:**
- Modify: `packages/worker/src/prompts/visual-references.ts` (replace REFERENCE_BAR_CHART)

**Step 1: Replace REFERENCE_BAR_CHART with Stack Overflow example**

Replace the `REFERENCE_BAR_CHART` constant with:

```typescript
/**
 * Reference Example 2: Stack Overflow - The Inevitable Crash
 * Demonstrates: Physics (particles, gravity), state progression, memory pressure visualization
 * Meaningful: Frames pile up, memory fills, shake increases - viewer FEELS the impending crash
 */
export const REFERENCE_STACK_OVERFLOW = `
// src/\${projectId}/index.tsx
// [Full implementation from design doc - Stack Overflow example]
// ... (include the complete Stack Overflow code from the design document)
`;
```

(The full code is in the design document at `docs/plans/2026-01-31-meaningful-animations-design.md`)

**Step 2: Verify and commit**

```bash
git add packages/worker/src/prompts/visual-references.ts
git commit -m "feat(worker): replace bar chart example with Stack Overflow physics demo"
```

---

## Task 6: Replace Reference Examples - Hash Collisions

**Files:**
- Modify: `packages/worker/src/prompts/visual-references.ts` (replace REFERENCE_INFO_CARD)

**Step 1: Replace REFERENCE_INFO_CARD with Hash Collisions example**

Replace the `REFERENCE_INFO_CARD` constant with:

```typescript
/**
 * Reference Example 3: Hash Collisions - When Keys Collide
 * Demonstrates: Gravity, bounce physics, squash/stretch, stacking
 * Meaningful: Balls physically pile up, lookup scanner digs through - shows O(n) cost
 */
export const REFERENCE_HASH_COLLISIONS = `
// src/\${projectId}/index.tsx
// [Full implementation from design doc - Hash Collisions example]
// ... (include the complete Hash Collisions code from the design document)
`;
```

**Step 2: Verify and commit**

```bash
git add packages/worker/src/prompts/visual-references.ts
git commit -m "feat(worker): replace info card example with Hash Collisions physics demo"
```

---

## Task 7: Update buildReferenceExamplesSection Function

**Files:**
- Modify: `packages/worker/src/prompts/visual-references.ts:711-850` (the buildReferenceExamplesSection function)

**Step 1: Update the function to use new example names and add physics section**

Replace the `buildReferenceExamplesSection` function:

```typescript
/**
 * Constructs the reference examples section for the prompt
 */
export function buildReferenceExamplesSection(projectId: string): string {
  return `
## 🎨 NARRATIVE REFERENCE EXAMPLES

These examples demonstrate MEANINGFUL animations that explain concepts, not just entrance effects.

**Key Principles:**
1. **Continuous motion** - Animation throughout, not just "spring in and sit"
2. **Conceptual, not literal** - Show WHY/HOW, not just WHAT
3. **Physics-based** - Gravity, bouncing, particles create visceral understanding
4. **Responsive** - All sizes relative to width/height

### Example 1: Linear vs Binary Search Race
Shows WHY binary search is faster through visual CONTRAST.
${REFERENCE_SEARCH_RACE.replace(/\$\{projectId\}/g, projectId)}

### Example 2: Stack Overflow with Physics
Shows WHY stack overflow happens - frames pile up, memory fills, system crashes.
${REFERENCE_STACK_OVERFLOW.replace(/\$\{projectId\}/g, projectId)}

### Example 3: Hash Collisions with Gravity
Shows WHY collisions hurt performance - balls physically stack, lookup digs through.
${REFERENCE_HASH_COLLISIONS.replace(/\$\{projectId\}/g, projectId)}

---

## 🔬 PHYSICS PATTERNS FOR REMOTION

### Ball Physics (Gravity + Bounce)
\`\`\`tsx
const simulateBallPhysics = (frame: number, dropFrame: number, targetY: number) => {
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
      if (++bounces >= 4) return { y: targetY, settled: true };
    }
  }
  return { y, settled: false };
};
\`\`\`

### Shake Effect (Stress Indicator)
\`\`\`tsx
const getShake = (frame: number, intensity: number, minDim: number) => ({
  x: Math.sin(frame * 1.5) * intensity * minDim * 0.008,
  y: Math.cos(frame * 1.8) * intensity * minDim * 0.005,
});
\`\`\`

### Squash & Stretch
\`\`\`tsx
const velocity = Math.min((frame - dropFrame) * 0.02, 0.3);
const scaleX = settled ? 1 : 1 - velocity * 0.2;
const scaleY = settled ? 1 : 1 + velocity * 0.3;
\`\`\`

---

${RESPONSIVE_LAYOUT_HELPER}

---

## 📐 MANDATORY LAYOUT RULES

### All Sizes Must Be Relative
\`\`\`tsx
const { width, height } = useVideoConfig();
const minDim = Math.min(width, height);

const padding = minDim * 0.05;
const fontSize = height * 0.035;
const glow = minDim * 0.025;
// ❌ NEVER: padding: 20, fontSize: 32
\`\`\`

### React key Prop (MANDATORY)
\`\`\`tsx
{items.map((item, i) => <div key={i}>{item}</div>)}
// ❌ NEVER omit key in .map()
\`\`\`

`;
}
```

**Step 2: Verify and commit**

```bash
git add packages/worker/src/prompts/visual-references.ts
git commit -m "feat(worker): update buildReferenceExamplesSection with narrative examples"
```

---

## Task 8: Remove Unused Example Constants

**Files:**
- Modify: `packages/worker/src/prompts/visual-references.ts`

**Step 1: Remove REFERENCE_STATS constant**

Delete the entire `REFERENCE_STATS` constant (it's no longer referenced).

**Step 2: Verify and commit**

```bash
git add packages/worker/src/prompts/visual-references.ts
git commit -m "chore(worker): remove unused REFERENCE_STATS constant"
```

---

## Task 9: Update Tests

**Files:**
- Modify: `packages/worker/src/prompts/generate-visuals.test.ts`

**Step 1: Add tests for new Animation Philosophy section**

Add new test suite:

```typescript
describe('Animation Philosophy', () => {
  const baseOptions = {
    transcript: [{ text: 'Test', startMs: 0, endMs: 1000 }],
    projectId: 'test_project',
    stylePreset: 'modern',
    styleGuidelines: STYLE_GUIDELINES.modern,
    durationMs: 60000,
    fps: 30,
    width: 1080,
    height: 1920,
    layoutMode: 'pip' as const,
  };

  it('includes the Three Laws of Meaningful Animation', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('CONTINUOUS MOTION');
    expect(prompt).toContain('CONCEPTUAL, NOT LITERAL');
    expect(prompt).toContain('ZERO TEXT OVERLAYS');
  });

  it('provides examples of conceptual vs literal animations', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('Binary tree is slow here');
    expect(prompt).toContain('O(n) counter climbing');
  });

  it('explicitly forbids text overlays', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('Subtitles handle all text');
    expect(prompt).toContain('PURE VISUAL STORYTELLING');
  });
});

describe('Scene Planning', () => {
  const baseOptions = {
    transcript: [{ text: 'Test', startMs: 0, endMs: 1000 }],
    projectId: 'test_project',
    stylePreset: 'modern',
    styleGuidelines: STYLE_GUIDELINES.modern,
    durationMs: 60000,
    fps: 30,
    width: 1080,
    height: 1920,
    layoutMode: 'pip' as const,
  };

  it('requires scene planning before code', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('SCENE PLANNING WITH REASONING');
    expect(prompt).toContain('REQUIRED FIRST STEP');
  });

  it('includes Chain of Thought reasoning fields', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('whatIsBeingExplained');
    expect(prompt).toContain('whyNotLiteral');
    expect(prompt).toContain('whatWouldMakeItClick');
    expect(prompt).toContain('howAnimationAddsUnderstanding');
  });

  it('provides a bubble sort example with full reasoning', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('bubble sort');
    expect(prompt).toContain('redundant comparisons');
  });
});
```

**Step 2: Run tests to verify**

Run: `cd /c/Users/armaa/Documents/cllipify && pnpm --filter @viona/worker test`

Expected: All new tests pass

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/generate-visuals.test.ts
git commit -m "test(worker): add tests for Animation Philosophy and Scene Planning"
```

---

## Task 10: Final Verification

**Step 1: Run full test suite**

Run: `cd /c/Users/armaa/Documents/cllipify && pnpm --filter @viona/worker test`

Expected: All tests pass

**Step 2: Type check the worker package**

Run: `cd /c/Users/armaa/Documents/cllipify && pnpm --filter @viona/worker typecheck`

Expected: No type errors

**Step 3: Build the worker package**

Run: `cd /c/Users/armaa/Documents/cllipify && pnpm --filter @viona/worker build`

Expected: Build succeeds

**Step 4: Final commit with all changes**

```bash
git status
# Verify all changes are committed
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `generate-visuals.ts` | Added Animation Philosophy section, Scene Planning with CoT |
| `visual-references.ts` | Replaced 3 static examples with narrative physics-based examples |
| `physics-helpers.ts` | New file with reusable physics code snippets |
| `generate-visuals.test.ts` | Added tests for new sections |

## Verification Checklist

- [ ] Animation Philosophy section appears in generated prompt
- [ ] Scene Planning section with JSON format appears
- [ ] Three narrative examples (Search Race, Stack Overflow, Hash Collisions) in references
- [ ] Physics patterns (gravity, bounce, shake) documented
- [ ] All tests pass
- [ ] TypeScript compiles without errors
- [ ] Worker package builds successfully
