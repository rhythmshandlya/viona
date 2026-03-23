# Blackboard Glow Explainer Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Blackboard Glow theme (dark background, amber/cyan neon glow accents) with 10 explainer overlay templates.

**Architecture:** Theme JSON + 5 shared modules (`src/blackboard/`) providing colors, animations, effects, textures, and typography. 10 template folders (`src/templates/explainer-*/`) each with schema, component, metadata, and registration. All templates use `useScale()` and `useVideoConfig()` for responsive sizing — no hardcoded pixel values. Registry and index updated for discovery.

**Tech Stack:** React, Remotion, Zod, TypeScript

**Execution order:** Tasks 1-3 are the theme foundation (must be sequential: 1→2→3). Tasks 4-13 are the 10 templates (independent of each other, depend on Tasks 1-3). Task 14 is registry + index registration. Task 15 is verification.

---

### Task 1: Create theme JSON

**Files:**
- Create: `packages/templates/themes/blackboard.json`

- [ ] **Step 1: Create the theme definition file**

```json
{
  "slug": "blackboard",
  "name": "Blackboard Glow",
  "description": "Dark explainer theme with warm amber glow accents, cool cyan highlights, and neon bloom animations",
  "colorPalette": {
    "primary": "#f59e0b",
    "secondary": "#06b6d4",
    "accent": "#f59e0b",
    "background": "#0a0a14",
    "text": "#f1f5f9"
  },
  "fontRecommendations": {
    "heading": "Space Grotesk",
    "body": "Inter",
    "accent": "Fira Code"
  },
  "styleGuidance": "Dark educational — near-black board, warm amber glow accents, cool cyan data highlights. Motion should feel like neon signs turning on: glow appears first, then content fills in. Typography is clean and geometric. Generous dark space, minimal texture. Data-forward with glowing number reveals."
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
cd packages/templates && node -e "JSON.parse(require('fs').readFileSync('themes/blackboard.json','utf-8')); console.log('Valid JSON')"
```

Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
git add packages/templates/themes/blackboard.json
git commit -m "feat(templates): add Blackboard Glow theme definition"
```

---

### Task 2: Create shared blackboard modules (constants, animations, textures)

**Files:**
- Create: `packages/templates/src/blackboard/constants.ts`
- Create: `packages/templates/src/blackboard/animations.ts`
- Create: `packages/templates/src/blackboard/textures.tsx`

**Reference:** Follow the pattern of `packages/templates/src/magazine/constants.ts`, `animations.ts`, and `textures.tsx`.

- [ ] **Step 1: Create constants.ts**

```typescript
import { FONTS } from '../fonts';

export const BLACKBOARD_COLORS = {
  background: '#0a0a14',
  surface: '#141420',
  surfaceBorder: '#1e1e30',
  primary: '#f59e0b',
  secondary: '#06b6d4',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textDim: '#64748b',
} as const;

export const BLACKBOARD_FONTS = {
  heading: FONTS.spaceGrotesk,
  body: FONTS.inter,
  mono: FONTS.firaCode,
} as const;

export const BLACKBOARD_TIMING = {
  glowRevealDuration: 20,
  contentRevealDuration: 15,
  staggerDelay: 7,
  holdMinimum: 30,
  exitDuration: 15,
} as const;

export const BLACKBOARD_GLOW = {
  primary: '0 0 20px rgba(245, 158, 11, 0.4), 0 0 60px rgba(245, 158, 11, 0.15)',
  secondary: '0 0 20px rgba(6, 182, 212, 0.4), 0 0 60px rgba(6, 182, 212, 0.15)',
  textPrimary: '0 0 30px rgba(245, 158, 11, 0.3)',
  textSecondary: '0 0 30px rgba(6, 182, 212, 0.3)',
  surfaceBorder: '0 0 1px rgba(245, 158, 11, 0.2)',
} as const;
```

Note: Templates use `useScale()` from `../../use-scale` for responsive sizing instead of a custom `responsive()` function. The existing `useScale()` hook returns a function `s(px)` that maps 1080-based pixel values to the current composition width. Use it in every template.

- [ ] **Step 2: Create animations.ts**

```typescript
import { interpolate, Easing } from 'remotion';

export const blackboardEasing = Easing.bezier(0.25, 0.1, 0.25, 1.0);

/**
 * Primary reveal: glow bloom appears first, then content materializes.
 */
export function glowFadeIn(frame: number, start: number, duration = 20) {
  const glowProgress = interpolate(frame, [start, start + duration * 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const contentProgress = interpolate(
    frame,
    [start + duration * 0.25, start + duration],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );
  const scale = interpolate(contentProgress, [0, 1], [0.97, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { glowProgress, contentProgress, scale };
}

/**
 * Brief glow intensity pulse — use when a stat lands or a checkmark appears.
 * Returns a 0→1→0 intensity value over `duration` frames.
 */
export function glowPulse(frame: number, start: number, duration = 15) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const intensity = Math.sin(progress * Math.PI);
  return { intensity, active: frame >= start && frame <= start + duration };
}

/**
 * Exit animation: glow contracts, content fades out.
 */
export function glowExit(frame: number, start: number, duration = 15) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  return { opacity: 1 - progress, glowScale: 1 - progress * 0.3 };
}

/**
 * Stagger helper: returns glowFadeIn result for item at `index` in a sequence.
 */
export function staggeredGlowIn(
  frame: number,
  baseStart: number,
  index: number,
  staggerDelay = 7,
  duration = 20,
) {
  return glowFadeIn(frame, baseStart + index * staggerDelay, duration);
}

/**
 * Animated line draw — interpolates a 0→1 progress for stroke-dashoffset.
 */
export function drawLine(frame: number, start: number, duration = 25) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: blackboardEasing,
  });
  return { progress };
}
```

- [ ] **Step 3: Create textures.tsx**

```tsx
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { BLACKBOARD_COLORS } from './constants';

/**
 * Dark board background with subtle SVG noise texture.
 */
export function BoardTexture({
  opacity = 0.04,
  seed = 'board',
}: {
  opacity?: number;
  seed?: string;
}) {
  const filterId = `blackboard-${seed}`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ backgroundColor: BLACKBOARD_COLORS.background }} />
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0, opacity }}
      >
        <defs>
          <filter id={filterId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves={3}
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values={`0 0 0 0 0.06
                       0 0 0 0 0.05
                       0 0 0 0 0.04
                       0 0 0 0.5 0`}
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </AbsoluteFill>
  );
}

/**
 * Very faint warm-tinted particle layer for chalk-dust feel.
 * Layer on top of BoardTexture for extra atmosphere.
 */
export function ChalkDust({
  opacity = 0.03,
  seed = 'dust',
}: {
  opacity?: number;
  seed?: string;
}) {
  const filterId = `blackboard-dust-${seed}`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity }}>
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <defs>
          <filter id={filterId}>
            <feTurbulence
              type="turbulence"
              baseFrequency="1.5"
              numOctaves={2}
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values={`0 0 0 0 0.96
                       0 0 0 0 0.62
                       0 0 0 0 0.04
                       0 0 0 0.3 0`}
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </AbsoluteFill>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd packages/templates && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors from `src/blackboard/` files.

- [ ] **Step 5: Commit**

```bash
git add packages/templates/src/blackboard/constants.ts packages/templates/src/blackboard/animations.ts packages/templates/src/blackboard/textures.tsx
git commit -m "feat(blackboard): add shared constants, animations, and textures modules"
```

---

### Task 3: Create shared blackboard modules (effects, typography)

**Files:**
- Create: `packages/templates/src/blackboard/effects.tsx`
- Create: `packages/templates/src/blackboard/typography.tsx`

**Reference:** Follow the pattern of `packages/templates/src/magazine/effects.tsx` and `typography.tsx`.

- [ ] **Step 1: Create effects.tsx**

```tsx
import React from 'react';
import { BLACKBOARD_COLORS, BLACKBOARD_GLOW } from './constants';

/**
 * Surface card with configurable glow color and spread.
 */
export function GlowPanel({
  glowIntensity = 1,
  glowColor = 'primary',
  children,
  style,
}: {
  glowIntensity?: number;
  glowColor?: 'primary' | 'secondary';
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const glowValue = glowColor === 'primary' ? BLACKBOARD_GLOW.primary : BLACKBOARD_GLOW.secondary;

  return (
    <div
      style={{
        backgroundColor: BLACKBOARD_COLORS.surface,
        border: `1px solid ${BLACKBOARD_COLORS.surfaceBorder}`,
        borderRadius: 12,
        boxShadow: glowIntensity > 0 ? glowValue : 'none',
        opacity: glowIntensity > 0 ? 1 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Animated border that "charges up" with glow.
 * Intensity drives border opacity and boxShadow spread.
 */
export function GlowBorder({
  glowIntensity = 1,
  glowColor = 'primary',
  borderRadius = 12,
  children,
  style,
}: {
  glowIntensity?: number;
  glowColor?: 'primary' | 'secondary';
  borderRadius?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const color = glowColor === 'primary' ? BLACKBOARD_COLORS.primary : BLACKBOARD_COLORS.secondary;
  const alpha = (0.3 * glowIntensity).toFixed(2);
  const spread = 8 + glowIntensity * 12;

  return (
    <div
      style={{
        border: `1px solid rgba(${glowColor === 'primary' ? '245,158,11' : '6,182,212'},${alpha})`,
        borderRadius,
        boxShadow: glowIntensity > 0
          ? `0 0 ${spread}px rgba(${glowColor === 'primary' ? '245,158,11' : '6,182,212'},${(0.15 * glowIntensity).toFixed(2)})`
          : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Expanding circle with bloom effect — for step numbers, timeline nodes.
 */
export function GlowCircle({
  size,
  glowIntensity = 1,
  glowColor = 'primary',
  children,
  style,
}: {
  size: number;
  glowIntensity?: number;
  glowColor?: 'primary' | 'secondary';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const color = glowColor === 'primary' ? BLACKBOARD_COLORS.primary : BLACKBOARD_COLORS.secondary;
  const glowValue = glowColor === 'primary' ? BLACKBOARD_GLOW.primary : BLACKBOARD_GLOW.secondary;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: BLACKBOARD_COLORS.surface,
        border: `2px solid ${color}`,
        boxShadow: glowIntensity > 0 ? glowValue : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create typography.tsx**

```tsx
import React from 'react';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_GLOW } from './constants';

/**
 * Space Grotesk heading with amber text-shadow glow.
 */
export function GlowHeading({
  text,
  size,
  glowIntensity = 1,
  color = BLACKBOARD_COLORS.text,
  style,
}: {
  text: string;
  size: number;
  glowIntensity?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: BLACKBOARD_FONTS.heading,
        fontSize: size,
        fontWeight: 700,
        color,
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        textShadow: glowIntensity > 0 ? BLACKBOARD_GLOW.textPrimary : 'none',
        ...style,
      }}
    >
      {text}
    </div>
  );
}

/**
 * Small label with subtle glow.
 */
export function GlowLabel({
  text,
  size,
  color = BLACKBOARD_COLORS.textMuted,
  style,
}: {
  text: string;
  size: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: BLACKBOARD_FONTS.body,
        fontSize: size,
        fontWeight: 500,
        color,
        letterSpacing: '0.05em',
        textTransform: 'uppercase' as const,
        ...style,
      }}
    >
      {text}
    </div>
  );
}

/**
 * Fira Code large number for data values.
 */
export function DataValue({
  text,
  size,
  glowIntensity = 1,
  color = BLACKBOARD_COLORS.primary,
  style,
}: {
  text: string;
  size: number;
  glowIntensity?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: BLACKBOARD_FONTS.mono,
        fontSize: size,
        fontWeight: 700,
        color,
        textShadow: glowIntensity > 0 ? BLACKBOARD_GLOW.textPrimary : 'none',
        ...style,
      }}
    >
      {text}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/templates && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/templates/src/blackboard/effects.tsx packages/templates/src/blackboard/typography.tsx
git commit -m "feat(blackboard): add shared effects and typography modules"
```

---

### Task 4: Create explainer-definition template

**Files:**
- Create: `packages/templates/src/templates/explainer-definition/schema.ts`
- Create: `packages/templates/src/templates/explainer-definition/meta.json`
- Create: `packages/templates/src/templates/explainer-definition/metadata.json`
- Create: `packages/templates/src/templates/explainer-definition/index.tsx`
- Create: `packages/templates/src/templates/explainer-definition/register.ts`

**Reference:** Follow the pattern of `packages/templates/src/templates/magazine-definition/` but use blackboard shared modules instead of magazine ones. Use `useScale()` from `../../use-scale` for all pixel values.

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  term: z.string().default('Algorithm'),
  pronunciation: z.string().optional().default('/ˈæl.ɡə.rɪ.ðəm/'),
  partOfSpeech: z.string().optional().default('noun'),
  definition: z
    .string()
    .default('A step-by-step procedure for solving a problem or accomplishing a task'),
  example: z
    .string()
    .optional()
    .default('Search engines use algorithms to rank web pages'),
});

export type ExplainerDefinitionProps = z.infer<typeof schema>;
export const defaultProps: ExplainerDefinitionProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "explainer-definition",
  "name": "Explainer Word Definition",
  "description": "Term definition card with large word, pronunciation, and glow underline reveal",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "definition", "vocabulary", "educational"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "explainer-definition",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ExplainerDefinitionProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, drawLine } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowHeading, GlowLabel } from '../../blackboard/typography';
import { useScale } from '../../use-scale';

const ExplainerDefinition: React.FC<ExplainerDefinitionProps> = ({
  term,
  pronunciation,
  partOfSpeech,
  definition,
  example,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const isPortrait = height > width;
  const padX = s(isPortrait ? 80 : 120);
  const padY = s(isPortrait ? 0 : 40);

  // Animation timing
  const termAnim = glowFadeIn(frame, 10);
  const pronunciationAnim = glowFadeIn(frame, 25, 15);
  const lineAnim = drawLine(frame, 35, 20);
  const defAnim = glowFadeIn(frame, 50, 20);
  const exampleAnim = glowFadeIn(frame, 70, 15);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        <BoardTexture seed="def-bg" />

        <div
          style={{
            position: 'absolute',
            left: padX,
            right: padX,
            top: padY,
            bottom: padY,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Part of speech label */}
          {partOfSpeech && (
            <div
              style={{
                opacity: termAnim.contentProgress,
                transform: `scale(${termAnim.scale})`,
                marginBottom: s(16),
              }}
            >
              <GlowLabel text={partOfSpeech} size={s(18)} color={BLACKBOARD_COLORS.primary} />
            </div>
          )}

          {/* Term */}
          <div
            style={{
              opacity: termAnim.contentProgress,
              transform: `scale(${termAnim.scale})`,
              boxShadow:
                termAnim.glowProgress > 0
                  ? `0 0 ${termAnim.glowProgress * 40}px rgba(245,158,11,${termAnim.glowProgress * 0.2})`
                  : 'none',
              display: 'inline-block',
            }}
          >
            <GlowHeading text={term} size={s(76)} glowIntensity={termAnim.glowProgress} />
          </div>

          {/* Pronunciation */}
          {pronunciation && (
            <div
              style={{
                opacity: pronunciationAnim.contentProgress,
                transform: `scale(${pronunciationAnim.scale})`,
                marginTop: s(12),
              }}
            >
              <div
                style={{
                  fontFamily: BLACKBOARD_FONTS.body,
                  fontSize: s(24),
                  fontStyle: 'italic',
                  color: BLACKBOARD_COLORS.textMuted,
                }}
              >
                {pronunciation}
              </div>
            </div>
          )}

          {/* Glow underline */}
          <div
            style={{
              marginTop: s(32),
              marginBottom: s(32),
              height: s(3),
              borderRadius: s(1.5),
              backgroundColor: BLACKBOARD_COLORS.primary,
              width: `${lineAnim.progress * 100}%`,
              boxShadow:
                lineAnim.progress > 0
                  ? `0 0 12px rgba(245,158,11,0.5)`
                  : 'none',
            }}
          />

          {/* Definition */}
          <div
            style={{
              opacity: defAnim.contentProgress,
              transform: `scale(${defAnim.scale})`,
            }}
          >
            <div
              style={{
                fontFamily: BLACKBOARD_FONTS.body,
                fontSize: s(36),
                color: BLACKBOARD_COLORS.text,
                lineHeight: 1.5,
              }}
            >
              {definition}
            </div>
          </div>

          {/* Example */}
          {example && (
            <div
              style={{
                opacity: exampleAnim.contentProgress,
                transform: `scale(${exampleAnim.scale})`,
                marginTop: s(28),
              }}
            >
              <div
                style={{
                  fontFamily: BLACKBOARD_FONTS.body,
                  fontSize: s(24),
                  fontStyle: 'italic',
                  color: BLACKBOARD_COLORS.secondary,
                }}
              >
                "{example}"
              </div>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerDefinition;
```

- [ ] **Step 5: Create register.ts**

```typescript
import { registerTemplate } from '../../registry';
import type { TemplateMeta, CompositionMeta } from '../../types';
import { schema, defaultProps } from './schema';
import meta from './meta.json';
import compositionMeta from './metadata.json';

registerTemplate({
  meta: meta as TemplateMeta,
  compositionMeta: compositionMeta as CompositionMeta,
  schema,
  defaultProps,
  getComponent: async () => import('./index'),
  getFiles: async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(new URL(import.meta.url).pathname);
    const blackboardDir = path.join(dir, '../../blackboard');

    const ownFileNames = [
      'meta.json',
      'metadata.json',
      'schema.ts',
      'index.tsx',
      'register.ts',
    ];

    const sharedFileNames = [
      'constants.ts',
      'textures.tsx',
      'effects.tsx',
      'typography.tsx',
      'animations.ts',
    ];

    const ownFiles = ownFileNames.map((f) => ({
      path: f,
      content: fs.readFileSync(path.join(dir, f), 'utf-8'),
    }));

    const sharedFiles = sharedFileNames.map((f) => ({
      path: `../../blackboard/${f}`,
      content: fs.readFileSync(path.join(blackboardDir, f), 'utf-8'),
    }));

    return [...ownFiles, ...sharedFiles];
  },
});
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd packages/templates && npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add packages/templates/src/templates/explainer-definition/
git commit -m "feat(templates): add explainer-definition template"
```

---

### Task 5: Create explainer-process template

**Files:**
- Create: `packages/templates/src/templates/explainer-process/schema.ts`
- Create: `packages/templates/src/templates/explainer-process/meta.json`
- Create: `packages/templates/src/templates/explainer-process/metadata.json`
- Create: `packages/templates/src/templates/explainer-process/index.tsx`
- Create: `packages/templates/src/templates/explainer-process/register.ts`

**Reference:** Same structure as Task 4. Step-by-step flow with glowing connecting lines.

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('How Data Travels'),
  steps: z
    .array(
      z.object({
        label: z.string(),
        description: z.string(),
      }),
    )
    .min(3)
    .max(6)
    .default([
      { label: 'Request', description: 'Browser sends HTTP request' },
      { label: 'Server', description: 'Server processes the query' },
      { label: 'Database', description: 'Data is retrieved from storage' },
      { label: 'Response', description: 'Results sent back to browser' },
    ]),
});

export type ExplainerProcessProps = z.infer<typeof schema>;
export const defaultProps: ExplainerProcessProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "explainer-process",
  "name": "Explainer Step Flow",
  "description": "Step-by-step process flow with glowing connecting lines and numbered nodes",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "process", "steps", "tutorial", "how-to"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "explainer-process",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

This template renders a vertical (portrait) or horizontal (landscape) step flow with numbered glow circles connected by a drawn line.

Key layout logic:
- Portrait: Steps stack vertically, connecting line is an SVG `<line>` with `stroke-dashoffset` driven by `drawLine()` progress. Each step is a `GlowCircle` with number + label/description beside it.
- Landscape: Steps flow horizontally.
- Use `useScale()` for all sizes. Use `staggeredGlowIn()` for step reveals (baseStart: 30, staggerDelay: 10). Title enters with `glowFadeIn(frame, 5)`. Line draws from frame 20. Exit with `glowExit()`.

The implementer should follow the same pattern as `explainer-definition/index.tsx` — imports from `../../blackboard/` modules, `useScale()`, `useVideoConfig()`, `useCurrentFrame()`. Use `AbsoluteFill` as root, `BoardTexture` for background, `GlowHeading` for title, `GlowCircle` for step numbers, `GlowLabel`/body text for step content.

For the SVG connecting line: render an `<svg>` positioned absolutely between the step nodes. Set `strokeDasharray` to the total line length and `strokeDashoffset` to `totalLength * (1 - drawLine.progress)`. Stroke color: `BLACKBOARD_COLORS.primary`, width: `s(2)`, with glow via `filter: drop-shadow(0 0 6px rgba(245,158,11,0.5))`.

- [ ] **Step 5: Create register.ts**

Same pattern as Task 4 Step 5, but with `'explainer-process'` paths and no extra component files.

- [ ] **Step 6: Verify and commit**

```bash
cd packages/templates && npx tsc --noEmit --pretty 2>&1 | head -20
git add packages/templates/src/templates/explainer-process/
git commit -m "feat(templates): add explainer-process template"
```

---

### Task 6: Create explainer-cause-effect template

**Files:**
- Create: `packages/templates/src/templates/explainer-cause-effect/schema.ts`
- Create: `packages/templates/src/templates/explainer-cause-effect/meta.json`
- Create: `packages/templates/src/templates/explainer-cause-effect/metadata.json`
- Create: `packages/templates/src/templates/explainer-cause-effect/index.tsx`
- Create: `packages/templates/src/templates/explainer-cause-effect/register.ts`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  cause: z.string().default('Rising global temperatures melt polar ice caps'),
  effect: z.string().default('Sea levels rise, threatening coastal cities'),
  label: z.string().optional().default('Therefore'),
});

export type ExplainerCauseEffectProps = z.infer<typeof schema>;
export const defaultProps: ExplainerCauseEffectProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "explainer-cause-effect",
  "name": "Explainer Cause & Effect",
  "description": "Two panels showing cause and effect with animated arrow bridge and dual-color glow",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "cause-effect", "educational", "logic"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "explainer-cause-effect",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

Two `GlowPanel` components — cause panel (amber accent border) and effect panel (cyan accent border) — with an animated arrow between them. Portrait: panels stack vertically with arrow pointing down. Landscape: panels side-by-side with arrow pointing right.

Animation sequence: cause panel `glowFadeIn(frame, 10)` → arrow draws with `drawLine(frame, 35, 20)` (SVG arrow with stroke-dashoffset) → label (e.g., "Therefore") fades in at midpoint of arrow draw → effect panel `glowFadeIn(frame, 55)` → `glowExit()` at end.

Arrow: SVG `<line>` or `<path>` with arrowhead marker. Glow via `filter: drop-shadow()`. Color: `BLACKBOARD_COLORS.primary`.

Use `useScale()` for all sizes. Text inside panels uses `BLACKBOARD_FONTS.body` at `s(32)`.

- [ ] **Step 5: Create register.ts**

Same pattern as Task 4 Step 5.

- [ ] **Step 6: Verify and commit**

```bash
cd packages/templates && npx tsc --noEmit --pretty 2>&1 | head -20
git add packages/templates/src/templates/explainer-cause-effect/
git commit -m "feat(templates): add explainer-cause-effect template"
```

---

### Task 7: Create explainer-analogy template

**Files:**
- Create: `packages/templates/src/templates/explainer-analogy/schema.ts`
- Create: `packages/templates/src/templates/explainer-analogy/meta.json`
- Create: `packages/templates/src/templates/explainer-analogy/metadata.json`
- Create: `packages/templates/src/templates/explainer-analogy/index.tsx`
- Create: `packages/templates/src/templates/explainer-analogy/register.ts`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  subject: z.string().default('A Firewall'),
  analogy: z.string().default('A Security Guard'),
  connector: z.string().default('is like'),
  explanation: z.string().optional().default(
    'It checks everything coming in and blocks anything suspicious',
  ),
});

export type ExplainerAnalogyProps = z.infer<typeof schema>;
export const defaultProps: ExplainerAnalogyProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "explainer-analogy",
  "name": "Explainer Analogy",
  "description": "X is like Y split card with connector label and explanation reveal",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "analogy", "comparison", "educational"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "explainer-analogy",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

Split layout: subject in `GlowPanel` (amber accent) and analogy in `GlowPanel` (cyan accent). Between them: connector text (e.g., "is like") in `GlowLabel` with amber color. Explanation text below.

Animation: subject panel `glowFadeIn(frame, 10)` → connector `glowFadeIn(frame, 35)` with amber `glowPulse` → analogy panel `glowFadeIn(frame, 50)` → explanation `glowFadeIn(frame, 70)` → `glowExit()`.

Portrait: stack vertically. Landscape: side-by-side with connector in center divider.

- [ ] **Step 5: Create register.ts**

Same pattern.

- [ ] **Step 6: Verify and commit**

```bash
cd packages/templates && npx tsc --noEmit --pretty 2>&1 | head -20
git add packages/templates/src/templates/explainer-analogy/
git commit -m "feat(templates): add explainer-analogy template"
```

---

### Task 8: Create explainer-howitworks template

**Files:**
- Create: `packages/templates/src/templates/explainer-howitworks/schema.ts`
- Create: `packages/templates/src/templates/explainer-howitworks/meta.json`
- Create: `packages/templates/src/templates/explainer-howitworks/metadata.json`
- Create: `packages/templates/src/templates/explainer-howitworks/index.tsx`
- Create: `packages/templates/src/templates/explainer-howitworks/register.ts`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('How WiFi Works'),
  items: z
    .array(
      z.object({
        label: z.string(),
        description: z.string(),
      }),
    )
    .min(3)
    .max(5)
    .default([
      { label: 'Signal', description: 'Router broadcasts radio waves' },
      { label: 'Connect', description: 'Device authenticates with network' },
      { label: 'Transfer', description: 'Data packets travel wirelessly' },
    ]),
});

export type ExplainerHowitworksProps = z.infer<typeof schema>;
export const defaultProps: ExplainerHowitworksProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "explainer-howitworks",
  "name": "Explainer How It Works",
  "description": "Numbered breakdown with expanding glow circles and staggered reveals",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "how-it-works", "breakdown", "educational"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "explainer-howitworks",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

Title at top with `GlowHeading`. Below: items laid out in a grid. Portrait: 1-column or 2-column grid. Landscape: single row.

Each item: `GlowCircle` with number inside (amber, `BLACKBOARD_FONTS.mono`), label in `GlowHeading` (smaller), description in body text.

Animation: title `glowFadeIn(frame, 5)` → items with `staggeredGlowIn(frame, 25, index, 10)` — glow circle expands (scale from `GlowCircle` with `glowFadeIn.scale`), then label and description fade in → `glowExit()`.

- [ ] **Step 5: Create register.ts**

Same pattern.

- [ ] **Step 6: Verify and commit**

```bash
cd packages/templates && npx tsc --noEmit --pretty 2>&1 | head -20
git add packages/templates/src/templates/explainer-howitworks/
git commit -m "feat(templates): add explainer-howitworks template"
```

---

### Task 9: Create explainer-stats template

**Files:**
- Create: `packages/templates/src/templates/explainer-stats/schema.ts`
- Create: `packages/templates/src/templates/explainer-stats/meta.json`
- Create: `packages/templates/src/templates/explainer-stats/metadata.json`
- Create: `packages/templates/src/templates/explainer-stats/index.tsx`
- Create: `packages/templates/src/templates/explainer-stats/components/CountUp.tsx`
- Create: `packages/templates/src/templates/explainer-stats/register.ts`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().optional().default('The Internet in Numbers'),
  stats: z
    .array(
      z.object({
        value: z.number(),
        label: z.string(),
        prefix: z.string().optional(),
        suffix: z.string().optional(),
      }),
    )
    .min(2)
    .max(4)
    .default([
      { value: 5.3, label: 'Billion Users', suffix: 'B' },
      { value: 1.13, label: 'Billion Websites', suffix: 'B' },
      { value: 333, label: 'Million Terabytes Daily', suffix: 'M' },
    ]),
});

export type ExplainerStatsProps = z.infer<typeof schema>;
export const defaultProps: ExplainerStatsProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "explainer-stats",
  "name": "Explainer Stat Grid",
  "description": "Big number count-up with Fira Code font and glow pulse on landing",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "stats", "numbers", "data", "metrics"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "explainer-stats",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create components/CountUp.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { BLACKBOARD_FONTS, BLACKBOARD_COLORS, BLACKBOARD_GLOW } from '../../../blackboard/constants';
import { glowPulse } from '../../../blackboard/animations';

export function CountUp({
  value,
  prefix = '',
  suffix = '',
  startFrame,
  duration = 30,
  fontSize,
  pulseStart,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  startFrame: number;
  duration?: number;
  fontSize: number;
  pulseStart: number;
}) {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const currentValue = progress * value;
  const pulse = glowPulse(frame, pulseStart);

  // Format: show decimal only if original has one
  const hasDecimal = value % 1 !== 0;
  const display = hasDecimal ? currentValue.toFixed(2) : Math.round(currentValue).toString();

  const glowSpread = pulse.active ? 20 + pulse.intensity * 30 : 20;
  const glowOpacity = pulse.active ? 0.4 + pulse.intensity * 0.3 : 0.4;

  return (
    <div
      style={{
        fontFamily: BLACKBOARD_FONTS.mono,
        fontSize,
        fontWeight: 700,
        color: BLACKBOARD_COLORS.primary,
        textShadow: `0 0 ${glowSpread}px rgba(245,158,11,${glowOpacity})`,
      }}
    >
      {prefix}
      {display}
      {suffix}
    </div>
  );
}
```

- [ ] **Step 5: Create index.tsx**

Stats laid out in a centered grid. 2 stats = row. 3 stats = portrait column / landscape row. 4 stats = 2x2 grid.

Title with `GlowHeading` at top. Each stat: `CountUp` for the number, `GlowLabel` for the label below. Use `staggeredGlowIn` for container entrance, then `CountUp` starts its own count-up animation offset per stat. Pulse fires when count-up completes.

Animation: title `glowFadeIn(frame, 5)` → each stat container `staggeredGlowIn(frame, 20, index, 10)` → `CountUp` starts at `25 + index * 10` with duration 30 → pulse at `55 + index * 10` → `glowExit()`.

- [ ] **Step 6: Create register.ts**

Same pattern as Task 4 but add `'components/CountUp.tsx'` to `ownFileNames`.

- [ ] **Step 7: Verify and commit**

```bash
cd packages/templates && npx tsc --noEmit --pretty 2>&1 | head -20
git add packages/templates/src/templates/explainer-stats/
git commit -m "feat(templates): add explainer-stats template with count-up animation"
```

---

### Task 10: Create explainer-barchart template

**Files:**
- Create: `packages/templates/src/templates/explainer-barchart/schema.ts`
- Create: `packages/templates/src/templates/explainer-barchart/meta.json`
- Create: `packages/templates/src/templates/explainer-barchart/metadata.json`
- Create: `packages/templates/src/templates/explainer-barchart/index.tsx`
- Create: `packages/templates/src/templates/explainer-barchart/register.ts`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Programming Languages 2026'),
  bars: z
    .array(
      z.object({
        label: z.string(),
        value: z.number(),
        maxValue: z.number().optional(),
      }),
    )
    .min(3)
    .max(6)
    .default([
      { label: 'Python', value: 28 },
      { label: 'JavaScript', value: 22 },
      { label: 'TypeScript', value: 18 },
      { label: 'Rust', value: 12 },
      { label: 'Go', value: 10 },
    ]),
});

export type ExplainerBarchartProps = z.infer<typeof schema>;
export const defaultProps: ExplainerBarchartProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "explainer-barchart",
  "name": "Explainer Bar Chart",
  "description": "Horizontal bar chart with animated cyan fill bars and amber value labels",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "chart", "bar", "data", "data-viz"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "explainer-barchart",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

Title at top. Bars stacked vertically. Each bar: label on left in `BLACKBOARD_FONTS.body`, horizontal bar that fills left-to-right (width interpolated from 0 to `(value/maxValue) * maxBarWidth`), value number at bar end in amber `DataValue`.

Bar fill: `BLACKBOARD_COLORS.secondary` (cyan) background with `boxShadow: 0 0 10px rgba(6,182,212,0.3)`. Bar track: subtle `BLACKBOARD_COLORS.surfaceBorder` background.

`maxValue`: if not provided per bar, use `Math.max(...bars.map(b => b.value))`.

Animation: title `glowFadeIn(frame, 5)` → bars fill with `staggeredGlowIn` for container + `interpolate` for bar width (start: `25 + i * 8`, duration: 25) → value numbers `glowFadeIn` at each bar's fill-end frame → `glowExit()`.

- [ ] **Step 5: Create register.ts**

Same pattern.

- [ ] **Step 6: Verify and commit**

```bash
cd packages/templates && npx tsc --noEmit --pretty 2>&1 | head -20
git add packages/templates/src/templates/explainer-barchart/
git commit -m "feat(templates): add explainer-barchart template"
```

---

### Task 11: Create explainer-comparison template

**Files:**
- Create: `packages/templates/src/templates/explainer-comparison/schema.ts`
- Create: `packages/templates/src/templates/explainer-comparison/meta.json`
- Create: `packages/templates/src/templates/explainer-comparison/metadata.json`
- Create: `packages/templates/src/templates/explainer-comparison/index.tsx`
- Create: `packages/templates/src/templates/explainer-comparison/register.ts`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  heading: z.string().optional().default('Cloud vs On-Premise'),
  titleA: z.string().default('Cloud'),
  titleB: z.string().default('On-Premise'),
  pointsA: z.array(z.string()).min(2).max(5).default([
    'Scales instantly',
    'Pay per use',
    'Managed updates',
  ]),
  pointsB: z.array(z.string()).min(2).max(5).default([
    'Full control',
    'One-time cost',
    'Data stays local',
  ]),
});

export type ExplainerComparisonProps = z.infer<typeof schema>;
export const defaultProps: ExplainerComparisonProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "explainer-comparison",
  "name": "Explainer Side-by-Side",
  "description": "Side-by-side comparison columns with dual-color amber and cyan glow accents",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "comparison", "versus", "side-by-side"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "explainer-comparison",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

Two `GlowPanel` columns — left (amber border/glow) and right (cyan border/glow). Optional heading above. Column headers in `GlowHeading`. Bullet points as body text with small colored dots.

Portrait: columns side-by-side (each ~48% width). Landscape: same but wider. Both always side-by-side — this template is inherently a two-column layout.

Animation: heading `glowFadeIn(frame, 5)` → column headers `glowFadeIn(frame, 20)` simultaneously → pointsA stagger with `staggeredGlowIn(frame, 35, index, 6)` → pointsB stagger with `staggeredGlowIn(frame, 35, index, 6)` (same timing, parallel reveals) → `glowExit()`.

- [ ] **Step 5: Create register.ts**

Same pattern.

- [ ] **Step 6: Verify and commit**

```bash
cd packages/templates && npx tsc --noEmit --pretty 2>&1 | head -20
git add packages/templates/src/templates/explainer-comparison/
git commit -m "feat(templates): add explainer-comparison template"
```

---

### Task 12: Create explainer-ranking template

**Files:**
- Create: `packages/templates/src/templates/explainer-ranking/schema.ts`
- Create: `packages/templates/src/templates/explainer-ranking/meta.json`
- Create: `packages/templates/src/templates/explainer-ranking/metadata.json`
- Create: `packages/templates/src/templates/explainer-ranking/index.tsx`
- Create: `packages/templates/src/templates/explainer-ranking/register.ts`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Top 5 Renewable Energy Sources'),
  items: z
    .array(
      z.object({
        rank: z.number(),
        label: z.string(),
        detail: z.string().optional(),
      }),
    )
    .min(3)
    .max(7)
    .default([
      { rank: 1, label: 'Solar', detail: 'Most widely adopted' },
      { rank: 2, label: 'Wind', detail: 'Fastest growing' },
      { rank: 3, label: 'Hydroelectric', detail: 'Most reliable' },
      { rank: 4, label: 'Geothermal' },
      { rank: 5, label: 'Biomass' },
    ]),
  ascending: z.boolean().default(false),
});

export type ExplainerRankingProps = z.infer<typeof schema>;
export const defaultProps: ExplainerRankingProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "explainer-ranking",
  "name": "Explainer Top List",
  "description": "Numbered ranked list with large amber rank numbers and staggered glow reveals",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "ranking", "list", "top-list", "listicle"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "explainer-ranking",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

Title at top. Ranked items stacked vertically. Each item: large rank number in amber `DataValue` (e.g., `s(56)` font size), label in `GlowHeading` (smaller), optional detail in muted body text. Optionally render items in ascending order if `ascending` is true (reverse the display order).

Animation: title `glowFadeIn(frame, 5)` → items `staggeredGlowIn(frame, 20, index, 8)` → each rank number gets `glowPulse` at its reveal end frame → `glowExit()`.

- [ ] **Step 5: Create register.ts**

Same pattern.

- [ ] **Step 6: Verify and commit**

```bash
cd packages/templates && npx tsc --noEmit --pretty 2>&1 | head -20
git add packages/templates/src/templates/explainer-ranking/
git commit -m "feat(templates): add explainer-ranking template"
```

---

### Task 13: Create explainer-timeline template

**Files:**
- Create: `packages/templates/src/templates/explainer-timeline/schema.ts`
- Create: `packages/templates/src/templates/explainer-timeline/meta.json`
- Create: `packages/templates/src/templates/explainer-timeline/metadata.json`
- Create: `packages/templates/src/templates/explainer-timeline/index.tsx`
- Create: `packages/templates/src/templates/explainer-timeline/register.ts`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().optional().default('History of the Internet'),
  events: z
    .array(
      z.object({
        date: z.string(),
        label: z.string(),
        detail: z.string().optional(),
      }),
    )
    .min(3)
    .max(6)
    .default([
      { date: '1969', label: 'ARPANET', detail: 'First network connection' },
      { date: '1983', label: 'TCP/IP', detail: 'Standard protocol adopted' },
      { date: '1991', label: 'World Wide Web', detail: 'Tim Berners-Lee goes public' },
      { date: '2007', label: 'Mobile Era', detail: 'iPhone launches' },
    ]),
});

export type ExplainerTimelineProps = z.infer<typeof schema>;
export const defaultProps: ExplainerTimelineProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "explainer-timeline",
  "name": "Explainer Timeline",
  "description": "Vertical or horizontal timeline with glowing amber line and cyan node dots",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "timeline", "history", "chronology", "dates"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "explainer-timeline",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

Optional title at top. SVG timeline axis (vertical for portrait, horizontal for landscape) drawn with `drawLine(frame, 10, 30)`. Node dots at evenly-spaced intervals using `GlowCircle` (cyan, small ~`s(16)` diameter). Date in `DataValue` (amber), label in body text, detail in muted text.

Portrait layout: vertical line on left side (~15% from left), events to the right of each node. Landscape: horizontal line centered vertically, events above/below alternating.

Animation: title `glowFadeIn(frame, 5)` → line `drawLine(frame, 15, 30)` → each node `staggeredGlowIn(frame, 25, index, 10)` — node dot glows cyan, date/label/detail fade in beside it → `glowExit()`.

- [ ] **Step 5: Create register.ts**

Same pattern.

- [ ] **Step 6: Verify and commit**

```bash
cd packages/templates && npx tsc --noEmit --pretty 2>&1 | head -20
git add packages/templates/src/templates/explainer-timeline/
git commit -m "feat(templates): add explainer-timeline template"
```

---

### Task 14: Register all templates in index.ts and registry.json

**Files:**
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Add registration imports to index.ts**

Append these lines to `packages/templates/src/index.ts` after the last magazine import:

```typescript
import './templates/explainer-definition/register';
import './templates/explainer-process/register';
import './templates/explainer-cause-effect/register';
import './templates/explainer-analogy/register';
import './templates/explainer-howitworks/register';
import './templates/explainer-stats/register';
import './templates/explainer-barchart/register';
import './templates/explainer-comparison/register';
import './templates/explainer-ranking/register';
import './templates/explainer-timeline/register';
```

- [ ] **Step 2: Add entries to registry.json**

Add 10 new entries to the `items` array in `packages/templates/registry.json`. Each entry follows this pattern (adjust `name`, `description`, and `tags` per template):

```json
{
  "name": "explainer-definition",
  "type": "registry:component",
  "description": "Term definition card with large word, pronunciation, and glow underline reveal",
  "categories": ["overlay"],
  "tags": ["blackboard-theme", "overlay", "explainer", "definition", "vocabulary", "educational"],
  "meta": {
    "stylePreset": "cleanMinimal",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

Add entries for all 10 templates. Use the description and tags from each template's meta.json.

- [ ] **Step 3: Validate JSON**

```bash
cd packages/templates && node -e "JSON.parse(require('fs').readFileSync('registry.json','utf-8')); console.log('Valid JSON')"
```

Expected: `Valid JSON`

- [ ] **Step 4: Commit**

```bash
git add packages/templates/src/index.ts packages/templates/registry.json
git commit -m "feat(templates): register all 10 explainer templates in index and registry"
```

---

### Task 15: TypeScript and playground verification

**Files:** None (verification only)

- [ ] **Step 1: TypeScript full check**

```bash
cd packages/templates && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Start playground**

```bash
pnpm --filter @viona/templates playground
```

Expected: Vite starts on port 3200 with no errors.

- [ ] **Step 3: Verify all templates load**

Open http://localhost:3200/. Check:
- Total template count should be 42 (32 existing + 10 new explainer)
- Filter by "blackboard" theme → should show exactly 10 templates
- Search "explainer" → should find all 10
- Click any explainer template → detail view should render with dark background and amber glow
- All 10 explainer templates render without errors
- Existing magazine templates still work

- [ ] **Step 4: Verify search**

Test these searches:
- "definition" → finds explainer-definition and magazine-definition
- "bar chart" → finds explainer-barchart via description
- "timeline" → finds explainer-timeline and magazine-timeline
- "blackboard" → finds all 10 explainer templates via tags

- [ ] **Step 5: Commit fixes if any**

```bash
git add <specific-files>
git commit -m "fix(templates): address verification issues"
```
