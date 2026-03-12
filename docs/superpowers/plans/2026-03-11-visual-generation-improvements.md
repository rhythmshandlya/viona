# Visual Generation Improvements Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the visual generation pipeline so outputs are diverse, high-quality, and resilient — addressing template gaps, screenshot verification, technique tracking, stall reliability, and prompt builder alignment.

**Architecture:** 7 independent tasks across prompt files, Python builder, TypeScript worker config, and new template files. All tasks are parallelizable — no inter-task dependencies.

**Tech Stack:** Markdown prompts, Python (animator.py builder), TypeScript (worker config), TSX (new Remotion templates)

---

## Chunk 1: Template Library & Prompt Builder

### Task 1: Add Non-Card Template Examples

The AI is told "read 3 templates before coding" but all 61 templates are card-based. Add 2 new templates demonstrating diverse techniques. (Kinetic text omitted — captions already handle text.)

**Files:**
- Create: `packages/worker/workspace/src/.templates/path-draw-reveal/index.tsx`
- Create: `packages/worker/workspace/src/.templates/path-draw-reveal/constants.ts`
- Create: `packages/worker/workspace/src/.templates/path-draw-reveal/schema.ts`
- Create: `packages/worker/workspace/src/.templates/animated-diagram/index.tsx`
- Create: `packages/worker/workspace/src/.templates/animated-diagram/constants.ts`
- Create: `packages/worker/workspace/src/.templates/animated-diagram/schema.ts`
- Create: `packages/worker/workspace/src/.templates/shape-morph-transition/index.tsx`
- Create: `packages/worker/workspace/src/.templates/shape-morph-transition/constants.ts`
- Create: `packages/worker/workspace/src/.templates/shape-morph-transition/schema.ts`

- [ ] **Step 1: Create `path-draw-reveal/schema.ts`**

```ts
import { z } from 'zod';

export const schema = z.object({
  steps: z.array(z.string()).default(['Step 1', 'Step 2', 'Step 3']),
  title: z.string().default('PROCESS'),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  fontPair: z
    .enum(['modernTech', 'boldImpact', 'friendlyTech', 'strongReadable', 'elegantEditorial', 'cleanMinimal'])
    .default('cleanMinimal'),
  colors: z
    .object({
      primary: z.string().default('#6366F1'),
      secondary: z.string().default('#A5B4FC'),
      accent: z.string().default('#6366F1'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type PathDrawRevealProps = z.infer<typeof schema>;
export const defaultProps: PathDrawRevealProps = schema.parse({});
```

- [ ] **Step 2: Create `path-draw-reveal/constants.ts`**

```ts
import { FONT_PAIRS } from '../../fonts';
import type { PathDrawRevealProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    cardBg: 'rgba(255, 255, 255, 0.06)',
    cardBorder: 'rgba(255, 255, 255, 0.10)',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
  },
  light: {
    bg: '#F8F9FB',
    cardBg: 'rgba(0, 0, 0, 0.03)',
    cardBorder: 'rgba(0, 0, 0, 0.08)',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
  },
} as const;

export function getConstants(props: PathDrawRevealProps) {
  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  return { COLORS, FONTS, BACKGROUNDS: BACKGROUNDS[props.background] };
}
```

- [ ] **Step 3: Create `path-draw-reveal/index.tsx`**

SVG path that draws progressively using `strokeDasharray`/`strokeDashoffset`. Use case: process flows, connections, reveals.

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { PathDrawRevealProps } from './schema';

export const PathDrawReveal: React.FC<PathDrawRevealProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = useScale();
  const { COLORS, FONTS, BACKGROUNDS: BG_THEME } = getConstants(props);

  const steps = props.steps;
  const PATH_LENGTH = 800;
  const nodeSpacing = 1080 / (steps.length + 1);

  // Title entrance
  const titleSpring = spring({ frame, fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });
  const titleOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Path draws from frame 20 to frame 70
  const drawProgress = interpolate(frame, [20, 70], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
  });

  // Nodes appear with stagger after path reaches them
  const nodeProgress = (i: number) => {
    const nodeFrame = 30 + i * 15;
    return spring({ frame: frame - nodeFrame, fps, config: { damping: 22, stiffness: 170, mass: 0.8 } });
  };

  const labelOpacity = (i: number) => interpolate(frame, [45 + i * 15, 55 + i * 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG_THEME.bg }}>
      <div style={{
        position: 'absolute', top: '12%', left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: titleOpacity, transform: `scale(${interpolate(titleSpring, [0, 1], [1.3, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
      }}>
        <span style={{ fontFamily: FONTS.headline, fontSize: s(48), fontWeight: 700, color: BG_THEME.text, letterSpacing: '0.08em' }}>
          {props.title}
        </span>
      </div>

      <svg style={{ position: 'absolute', top: '40%', left: '5%', width: '90%', height: s(200) }}
        viewBox={`0 0 ${1080 * 0.9} 200`} fill="none">
        <path
          d={`M ${nodeSpacing * 0.5} 100 ${steps.map((_, i) => `L ${nodeSpacing * (i + 1)} 100`).join(' ')}`}
          stroke={COLORS.accent}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={PATH_LENGTH}
          strokeDashoffset={PATH_LENGTH * (1 - drawProgress)}
          opacity={0.6}
        />
      </svg>

      {steps.map((label, i) => {
        const np = nodeProgress(i);
        const x = nodeSpacing * (i + 1);
        return (
          <div key={i} style={{
            position: 'absolute', top: '40%',
            left: `${(x / (1080 * 0.9)) * 90 + 5}%`,
            transform: `translate(-50%, -50%) scale(${interpolate(np, [0, 1], [0.3, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
            opacity: np,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s(12),
          }}>
            <div style={{
              width: s(48), height: s(48), borderRadius: '50%',
              background: BG_THEME.cardBg, border: `2px solid ${COLORS.accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 ${s(20)}px ${COLORS.accent}44`,
            }}>
              <span style={{ fontFamily: FONTS.headline, fontSize: s(20), fontWeight: 700, color: COLORS.accent }}>
                {i + 1}
              </span>
            </div>
            <span style={{
              fontFamily: FONTS.body, fontSize: s(16), color: BG_THEME.textMuted,
              opacity: labelOpacity(i), textAlign: 'center', maxWidth: s(120),
            }}>
              {label}
            </span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Create `animated-diagram/schema.ts`**

```ts
import { z } from 'zod';

const nodeSchema = z.object({
  label: z.string(),
  x: z.number(), // 0-1 relative position
  y: z.number(),
});

const edgeSchema = z.object({
  from: z.number(), // index into nodes
  to: z.number(),
});

export const schema = z.object({
  title: z.string().default('ARCHITECTURE'),
  nodes: z.array(nodeSchema).default([
    { label: 'Input', x: 0.2, y: 0.3 },
    { label: 'Process', x: 0.5, y: 0.3 },
    { label: 'Output', x: 0.8, y: 0.3 },
  ]),
  edges: z.array(edgeSchema).default([
    { from: 0, to: 1 },
    { from: 1, to: 2 },
  ]),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  fontPair: z
    .enum(['modernTech', 'boldImpact', 'friendlyTech', 'strongReadable', 'elegantEditorial', 'cleanMinimal'])
    .default('cleanMinimal'),
  colors: z
    .object({
      primary: z.string().default('#6366F1'),
      secondary: z.string().default('#A5B4FC'),
      accent: z.string().default('#6366F1'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type AnimatedDiagramProps = z.infer<typeof schema>;
export const defaultProps: AnimatedDiagramProps = schema.parse({});
```

- [ ] **Step 5: Create `animated-diagram/constants.ts`**

```ts
import { FONT_PAIRS } from '../../fonts';
import type { AnimatedDiagramProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    nodeBg: 'rgba(255, 255, 255, 0.06)',
    nodeBorder: 'rgba(255, 255, 255, 0.10)',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    lineColor: 'rgba(255, 255, 255, 0.15)',
  },
  light: {
    bg: '#F8F9FB',
    nodeBg: 'rgba(0, 0, 0, 0.03)',
    nodeBorder: 'rgba(0, 0, 0, 0.08)',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    lineColor: 'rgba(0, 0, 0, 0.12)',
  },
} as const;

export function getConstants(props: AnimatedDiagramProps) {
  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  return { COLORS, FONTS, BACKGROUNDS: BACKGROUNDS[props.background] };
}
```

- [ ] **Step 6: Create `animated-diagram/index.tsx`**

Animated node-and-edge diagram. Nodes spring in with stagger, then connecting lines draw between them. Use case: architectures, flows, relationships.

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { AnimatedDiagramProps } from './schema';

export const AnimatedDiagram: React.FC<AnimatedDiagramProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = useScale();
  const { COLORS, FONTS, BACKGROUNDS: BG_THEME } = getConstants(props);

  const CANVAS_W = 1080;
  const CANVAS_H = 1920;
  const CONTENT_TOP = CANVAS_H * 0.25;
  const CONTENT_H = CANVAS_H * 0.5;
  const CONTENT_LEFT = CANVAS_W * 0.08;
  const CONTENT_W = CANVAS_W * 0.84;

  // Title entrance
  const titleOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleSpring = spring({ frame, fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });

  // Node entrance with stagger
  const nodeProgress = (i: number) => {
    const delay = 15 + i * 12;
    return spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 170, mass: 0.8 } });
  };

  // Edge drawing starts after nodes are in
  const edgeDrawStart = 15 + props.nodes.length * 12 + 10;
  const edgeProgress = (i: number) => {
    const delay = edgeDrawStart + i * 10;
    return interpolate(frame, [delay, delay + 20], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
    });
  };

  const getNodePos = (idx: number) => ({
    x: CONTENT_LEFT + props.nodes[idx].x * CONTENT_W,
    y: CONTENT_TOP + props.nodes[idx].y * CONTENT_H,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG_THEME.bg }}>
      {/* Title */}
      <div style={{
        position: 'absolute', top: '10%', left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: titleOpacity, transform: `scale(${interpolate(titleSpring, [0, 1], [1.3, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
      }}>
        <span style={{ fontFamily: FONTS.headline, fontSize: s(44), fontWeight: 700, color: BG_THEME.text, letterSpacing: '0.08em' }}>
          {props.title}
        </span>
      </div>

      {/* Edges (SVG lines that draw progressively) */}
      <svg style={{ position: 'absolute', inset: 0 }} width={CANVAS_W} height={CANVAS_H} fill="none">
        {props.edges.map((edge, i) => {
          const from = getNodePos(edge.from);
          const to = getNodePos(edge.to);
          const length = Math.hypot(to.x - from.x, to.y - from.y);
          const ep = edgeProgress(i);
          return (
            <line key={i}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={COLORS.accent}
              strokeWidth="2"
              strokeDasharray={length}
              strokeDashoffset={length * (1 - ep)}
              opacity={0.5}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {props.nodes.map((node, i) => {
        const np = nodeProgress(i);
        const pos = getNodePos(i);
        return (
          <div key={i} style={{
            position: 'absolute',
            left: pos.x, top: pos.y,
            transform: `translate(-50%, -50%) scale(${interpolate(np, [0, 1], [0.3, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
            opacity: np,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s(8),
          }}>
            <div style={{
              width: s(80), height: s(80), borderRadius: s(16),
              background: BG_THEME.nodeBg, border: `2px solid ${COLORS.accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 ${s(20)}px ${COLORS.accent}33`,
            }}>
              <span style={{ fontFamily: FONTS.headline, fontSize: s(16), fontWeight: 600, color: BG_THEME.text, textAlign: 'center' }}>
                {node.label}
              </span>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 7: Create `shape-morph-transition/schema.ts`**

```ts
import { z } from 'zod';

export const schema = z.object({
  beforeLabel: z.string().default('BEFORE'),
  afterLabel: z.string().default('AFTER'),
  morphFrame: z.number().default(60),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  fontPair: z
    .enum(['modernTech', 'boldImpact', 'friendlyTech', 'strongReadable', 'elegantEditorial', 'cleanMinimal'])
    .default('cleanMinimal'),
  colors: z
    .object({
      primary: z.string().default('#6366F1'),
      secondary: z.string().default('#A5B4FC'),
      accent: z.string().default('#6366F1'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type ShapeMorphTransitionProps = z.infer<typeof schema>;
export const defaultProps: ShapeMorphTransitionProps = schema.parse({});
```

- [ ] **Step 8: Create `shape-morph-transition/constants.ts`**

```ts
import { FONT_PAIRS } from '../../fonts';
import type { ShapeMorphTransitionProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
  },
  light: {
    bg: '#F8F9FB',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
  },
} as const;

export function getConstants(props: ShapeMorphTransitionProps) {
  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  return { COLORS, FONTS, BACKGROUNDS: BACKGROUNDS[props.background] };
}
```

- [ ] **Step 9: Create `shape-morph-transition/index.tsx`**

Cross-fade morph between two **visually distinct** SVG shapes (square → star). Use case: transformations, before/after, evolution.

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { ShapeMorphTransitionProps } from './schema';

export const ShapeMorphTransition: React.FC<ShapeMorphTransitionProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = useScale();
  const { COLORS, FONTS, BACKGROUNDS: BG_THEME } = getConstants(props);
  const morphFrame = props.morphFrame;

  // Morph progress
  const morphProgress = interpolate(frame, [morphFrame, morphFrame + 25], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  });

  // Scale pulse at morph point
  const pulseSpring = spring({ frame: frame - morphFrame, fps, config: { damping: 22, stiffness: 170, mass: 0.8 } });
  const pulseScale = interpolate(pulseSpring, [0, 1], [1, 1.15], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const settleSpring = spring({ frame: frame - (morphFrame + 20), fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });
  const settleScale = interpolate(settleSpring, [0, 1], [1.15, 1.0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const iconScale = frame < morphFrame + 20 ? pulseScale : settleScale;

  // Glow at morph
  const glowRadius = interpolate(frame, [morphFrame, morphFrame + 15, morphFrame + 40], [0, 30, 12], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Label transitions
  const beforeLabelOp = interpolate(frame, [morphFrame, morphFrame + 15], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const afterLabelOp = interpolate(frame, [morphFrame + 10, morphFrame + 25], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const iconSize = s(120);

  return (
    <AbsoluteFill style={{ backgroundColor: BG_THEME.bg }}>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: s(24),
      }}>
        {/* Morphing icon container */}
        <div style={{ position: 'relative', width: iconSize, height: iconSize, transform: `scale(${iconScale})` }}>
          {/* Before shape: rounded square */}
          <div style={{ position: 'absolute', inset: 0, opacity: 1 - morphProgress,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke={BG_THEME.textMuted} strokeWidth="2" />
            </svg>
          </div>
          {/* After shape: 5-point star */}
          <div style={{ position: 'absolute', inset: 0, opacity: morphProgress,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                fill="none" stroke={COLORS.accent} strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
          {/* Glow ring */}
          {frame >= morphFrame && (
            <div style={{
              position: 'absolute', inset: -s(16), borderRadius: '50%',
              background: `radial-gradient(circle, ${COLORS.accent}${Math.round((glowRadius / 30) * 60).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
              pointerEvents: 'none',
            }} />
          )}
        </div>

        {/* Labels */}
        <div style={{ position: 'relative', height: s(40) }}>
          <span style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            fontFamily: FONTS.headline, fontSize: s(28), fontWeight: 700,
            color: BG_THEME.textMuted, opacity: beforeLabelOp, letterSpacing: '0.1em',
          }}>{props.beforeLabel}</span>
          <span style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            fontFamily: FONTS.headline, fontSize: s(28), fontWeight: 700,
            color: COLORS.accent, opacity: afterLabelOp, letterSpacing: '0.1em',
          }}>{props.afterLabel}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 10: TypeScript validation**

Run: `cd packages/worker/workspace && npx tsc --noEmit --pretty false`
Expected: No errors on new template files.

- [ ] **Step 11: Commit**

```bash
git add packages/worker/workspace/src/.templates/path-draw-reveal/
git add packages/worker/workspace/src/.templates/animated-diagram/
git add packages/worker/workspace/src/.templates/shape-morph-transition/
git commit -m "feat(templates): add non-card templates — path-draw, animated-diagram, shape-morph"
```

---

### Task 2: Update Animator Builder Template Immersion

The `animator.py` builder tells the AI to "read 3 templates" and lists `stat-counter`, `quote-pulse`, `versus-screen` as examples. Update to include the new non-card templates so the AI sees diverse techniques.

**Files:**
- Modify: `packages/worker/src/prompts/animator/animator.py:456-460`

- [ ] **Step 1: Read the template immersion section in animator.py**

Read `packages/worker/src/prompts/animator/animator.py` lines 450-480.

- [ ] **Step 2: Update the example template list**

Change:
```python
1. **Read at least 3 templates** from `src/.templates/` (e.g., `stat-counter`, `quote-pulse`, `versus-screen`)
2. **Study how they use:** DotGrid backgrounds, card containers, `useScale()`, `FONT_PAIRS`, spring configs, accent color transparency
```

To:
```python
1. **Read at least 3 templates** from `src/.templates/` — include at least ONE non-card template (e.g., `path-draw-reveal`, `animated-diagram`, `shape-morph-transition`) alongside card templates (e.g., `stat-counter`, `versus-screen`)
2. **Study how they use:** DotGrid backgrounds, `useScale()`, `FONT_PAIRS`, spring configs, accent color transparency, SVG path animation, animated diagrams, shape morphing
```

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/animator/animator.py
git commit -m "feat(animator): update template immersion to include non-card templates"
```

---

## Chunk 2: Technique Tracking & Verification

### Task 3: Add `technique` Field to scenes.json Schema

Add a structured `technique` field so the Animator and validators can programmatically verify technique diversity.

**Files:**
- Modify: `packages/worker/src/prompts/director/system.md` (scenes.json format section)

- [ ] **Step 1: Read the output_format section**

Read `packages/worker/src/prompts/director/system.md` lines 249-327 (the scenes.json format definition).

- [ ] **Step 2: Add `technique` field to per-scene schema**

Add to the scenes.json example and format documentation:
```json
{
  "id": 1,
  "name": "The Hook",
  "type": "animation",
  "technique": "path-drawing",
  "displayMode": "fullscreen",
  "frames": [0, 240],
  "keySync": [60],
  "syncPoints": [
    { "frame": 30, "word": "first" },
    { "frame": 90, "word": "second" }
  ],
  "visual": "SVG path draws a process flow connecting three nodes..."
}
```

Valid technique values:
- `"card-data"` — card with animated data/stats
- `"path-drawing"` — SVG strokeDasharray progressive reveal
- `"shape-morph"` — cross-fade/morph between shapes
- `"animated-diagram"` — nodes + connecting lines
- `"split-composition"` — side-by-side comparison with animation
- `"particle-scatter"` — elements scatter/converge
- `"svg-illustration"` — full-scene composed SVG
- `"data-viz"` — charts, progress bars, counters

Add documentation: "The `technique` field identifies the primary visual technique for this scene. No two adjacent scenes should share the same technique value. The Animator uses this to select the right implementation approach."

- [ ] **Step 3: Add technique to the self-verification table**

Update the self-verification table to include:
```
| Adjacent technique diversity: no two adjacent scenes share same technique? | ✓/✗ | ... |
```

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/prompts/director/system.md
git commit -m "feat(director): add technique field to scenes.json schema for diversity tracking"
```

---

### Task 4: Update Screenshot Verification Criteria

Phase 2e uses `VISUAL_VERIFY_PROMPT` to judge screenshots. Update it to check for technique diversity — not just "does it match the plan text."

**Files:**
- Modify: `packages/worker/src/prompts/animator/verify.md`

- [ ] **Step 1: Read the verification prompt**

Read `packages/worker/src/prompts/animator/verify.md` to understand the current checklist structure.

- [ ] **Step 2: Add technique diversity check to verification criteria**

Add to the `## Your Checklist` section, after the "Layout Quality" block:
```
- TECHNIQUE DIVERSITY: Do the screenshots show varied visual approaches across scenes?
  If 3+ consecutive screenshots show the same structure (card with text sliding in), flag as "repetitive visual pattern — lacks technique diversity."
- TECHNIQUE MATCH: Does each scene use the technique specified in the plan?
  If the plan says "kinetic-typography" but the screenshot shows a card with text, flag as "technique mismatch."
```

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/animator/verify.md
git commit -m "feat(verification): add technique diversity checks to screenshot review"
```

---

## Chunk 3: Reliability & Config

### Task 5: Fix BullMQ Stall Tolerance

3 out of 4 generate-visuals jobs died from `maxStalledCount: 0`. The subprocess was alive and working (reached 65% progress) but the BullMQ lock heartbeat extension failed once. Change to tolerate 1-2 stall events.

**Files:**
- Modify: `packages/worker/src/index.ts:147,180,212`

- [ ] **Step 1: Read the worker configs**

Read `packages/worker/src/index.ts` lines 136-220 to see all three worker configs.

- [ ] **Step 2: Change maxStalledCount from 0 to 2 on generate-visuals (line 147)**

```typescript
// Before:
maxStalledCount: 0,  // Immediately fail stalled jobs

// After:
maxStalledCount: 2,  // Tolerate up to 2 stall events before failing (subprocess monitor handles real hangs)
```

Rationale: The subprocess monitor's HeartbeatTracker already kills truly hung processes (60s timeout). BullMQ stall detection at 10-minute intervals is too coarse — it kills healthy jobs that had a momentary lock extension failure. With `maxStalledCount: 2`, a job survives 2 false stall detections (20 minutes of grace) while truly stuck jobs are caught by the subprocess monitor.

- [ ] **Step 3: Apply same fix to plan-visuals worker (line 180)**

Change `maxStalledCount: 0` to `maxStalledCount: 2`.

- [ ] **Step 4: Apply same fix to edit-visuals worker (line 212)**

Change `maxStalledCount: 0` to `maxStalledCount: 2`.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/index.ts
git commit -m "fix(worker): increase maxStalledCount to 2 — prevent false stall kills on healthy jobs"
```

---

### Task 6: Update STUDIO_TEMPLATES.md Catalog

The workspace has a `STUDIO_TEMPLATES.md` catalog file that the AI reads. Add the new non-card templates to it.

**Files:**
- Modify: `packages/worker/workspace/src/STUDIO_TEMPLATES.md`

- [ ] **Step 1: Read current STUDIO_TEMPLATES.md**

Read `packages/worker/workspace/src/STUDIO_TEMPLATES.md` to understand the format.

- [ ] **Step 2: Add new templates to catalog**

Add entries for:
- `path-draw-reveal` — "SVG path drawing with progressive node reveal. Use for: processes, connections, step-by-step flows. NOT a card."
- `animated-diagram` — "Node-and-edge diagram with staggered entrance and progressive line drawing. Use for: architectures, flows, relationships. NOT a card."
- `shape-morph-transition` — "Cross-fade morph between two SVG shapes (square→star) with scale pulse. Use for: transformations, before/after. NOT a card."

Add a new section header: `## Non-Card Templates` to visually separate them.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/workspace/src/STUDIO_TEMPLATES.md
git commit -m "docs(templates): add non-card templates to STUDIO_TEMPLATES.md catalog"
```

---

### Task 7: Update remotion-template CLAUDE.md with Technique Guidance

The workspace CLAUDE.md files that ship with every generation need a brief note about technique variety.

**Files:**
- Modify: `packages/worker/remotion-template/CLAUDE.md`
- Modify: `packages/worker/remotion-template/.claude/CLAUDE.md`

- [ ] **Step 1: Read current CLAUDE.md**

Read `packages/worker/remotion-template/CLAUDE.md`.

- [ ] **Step 2: Add technique variety note to Common Gotchas**

Add after the existing gotchas:
```markdown
- Vary visual techniques across scenes — don't put every scene in a card. Use path drawing, animated diagrams, morphing, particles as alternatives.
- Non-card templates available: `path-draw-reveal`, `animated-diagram`, `shape-morph-transition`
```

- [ ] **Step 3: Apply same change to `.claude/CLAUDE.md`**

- [ ] **Step 4: Commit**

```bash
git add packages/worker/remotion-template/CLAUDE.md packages/worker/remotion-template/.claude/CLAUDE.md
git commit -m "docs(workspace): add technique variety guidance to CLAUDE.md"
```
