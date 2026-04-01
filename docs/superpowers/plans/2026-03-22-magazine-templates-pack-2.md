# 10 New Magazine Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 new magazine-theme overlay templates targeting the most common Instagram Reel content formats.

**Architecture:** Each template follows the established magazine template pattern: a folder under `packages/templates/src/templates/magazine-xxx/` containing schema.ts, index.tsx, meta.json, metadata.json, register.ts, and components/. All templates use shared magazine modules (constants, animations, textures, effects, typography, decorations). All are 1080x1920 overlays at 150 frames / 30fps with transparent backgrounds and NO exit animations.

**Tech Stack:** React, Remotion (useCurrentFrame, interpolate, random, AbsoluteFill), Zod schemas, TypeScript

---

## Reference: Established Patterns

Every template must follow these rules:

1. **All `interpolate()` calls MUST include `extrapolateLeft: 'clamp', extrapolateRight: 'clamp'`** — missing clamp causes scale/position blowouts.
2. **No exit animations** — overlays stay on screen; scene cuts handle transitions.
3. **Transparent background** — `<AbsoluteFill style={{ backgroundColor: 'transparent' }}>`.
4. **Parallax drift runs indefinitely** — `frame >= 60` with no upper bound.
5. **Canvas is 1080x1920 pixels.**
6. **Shared imports come from `../../magazine/*`** (constants, animations, textures, effects, typography, decorations).

### Shared module exports (for reference):

```
// constants.ts
MAGAZINE_COLORS: { primary, secondary, accent (#e11d48), background, text, stamp (#e11d48), inkBlack (#0f172a), paperWhite, paperAged }
MAGAZINE_FONTS: { headline (Playfair Display), body (Lora), accent (Merriweather) }
MAGAZINE_TIMING: { revealDuration: 20, staggerDelay: 12, holdMinimum: 30 }
FONT_SIZES: { caption: 12, small: 14, body: 16, large: 20, h4: 25, h3: 31, h2: 39, h1: 49, display: 61, hero: 76 }

// animations.ts
magazineEasing: Easing.bezier(0.25, 0.1, 0.25, 1.0)
editorialReveal(frame, start, duration=20) → { opacity, translateY }
paperSlide(frame, start, duration=25, direction) → { translateX, translateY, rotation, opacity }

// textures.tsx: PaperTexture, NewsprintGrain, CoffeeStain
// effects.tsx: TornEdge, FoldShadow, BurnEdge, InkBleedFilter
// typography.tsx: SerifHeadline, Byline, Dateline, SectionLabel
// decorations.tsx: TapeMark, PinMark
```

### Standard register.ts pattern:

Every register.ts follows this exact pattern (substitute `SLUG`, `OWN_FILES`, and add `decorations.tsx` to sharedFileNames only if the template uses TapeMark/PinMark):

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
    const magazineDir = path.join(dir, '../../magazine');

    const ownFileNames = [OWN_FILES];

    const sharedFileNames = [
      'constants.ts', 'textures.tsx', 'effects.tsx', 'typography.tsx', 'animations.ts',
    ];

    const ownFiles = ownFileNames.map((f) => ({
      path: f, content: fs.readFileSync(path.join(dir, f), 'utf-8'),
    }));
    const sharedFiles = sharedFileNames.map((f) => ({
      path: `../../magazine/${f}`, content: fs.readFileSync(path.join(magazineDir, f), 'utf-8'),
    }));

    return [...ownFiles, ...sharedFiles];
  },
});
```

---

## Task 1: magazine-ranking

Numbered ranked list — "#1, #2, #3..." items. The most common Reel format for "Top 5" / "Best of" content.

**Files:**
- Create: `packages/templates/src/templates/magazine-ranking/schema.ts`
- Create: `packages/templates/src/templates/magazine-ranking/meta.json`
- Create: `packages/templates/src/templates/magazine-ranking/metadata.json`
- Create: `packages/templates/src/templates/magazine-ranking/index.tsx`
- Create: `packages/templates/src/templates/magazine-ranking/register.ts`
- Create: `packages/templates/src/templates/magazine-ranking/components/RankItem.tsx`
- Modify: `packages/templates/src/index.ts` — add import
- Modify: `packages/templates/registry.json` — add entry

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Top 5 Developments'),
  items: z.array(z.object({
    text: z.string(),
    detail: z.string().optional(),
  })).min(2).max(5).default([
    { text: 'Peace talks resume in Geneva', detail: 'After 18 months of stalemate' },
    { text: 'Humanitarian corridor expanded', detail: 'Now covers 3 provinces' },
    { text: 'Ceasefire holds for 30 days', detail: 'Longest since 2022' },
    { text: 'Aid reaches eastern regions' },
    { text: 'Refugee returns begin' },
  ]),
});

export type MagazineRankingProps = z.infer<typeof schema>;
export const defaultProps: MagazineRankingProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-ranking",
  "name": "Magazine Ranking",
  "description": "Numbered ranked list with large rank numbers on torn paper strips, ideal for Top 5 and listicle content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "ranking", "list", "top5", "listicle", "numbered"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "magazine-ranking",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create components/RankItem.tsx**

```tsx
import React from 'react';
import { random } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';

const ITEM_W = 920;
const ITEM_H = 160;

export function RankItem({
  rank, text, detail, index,
}: {
  rank: number; text: string; detail?: string; index: number;
}) {
  const rotation = (random(`rank-rot-${index}`) - 0.5) * 3;

  return (
    <div style={{
      width: ITEM_W, height: ITEM_H,
      transform: `rotate(${rotation}deg)`,
      filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      position: 'relative',
    }}>
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={index * 13 + 5} width={ITEM_W} height={ITEM_H}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.15 + random(`rank-age-${index}`) * 0.2} seed={`rank-${index}`} />
          <div style={{
            position: 'relative', zIndex: 1, width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', padding: '0 32px', gap: 24, boxSizing: 'border-box',
          }}>
            {/* Large rank number */}
            <div style={{
              fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.hero,
              fontWeight: 900, color: MAGAZINE_COLORS.accent,
              lineHeight: 1, minWidth: 80, textAlign: 'center',
              letterSpacing: '-0.02em',
            }}>
              {rank}
            </div>
            {/* Vertical divider */}
            <div style={{
              width: 2, height: ITEM_H * 0.5,
              backgroundColor: MAGAZINE_COLORS.accent, opacity: 0.3,
              borderRadius: 1, flexShrink: 0,
            }} />
            {/* Text content */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h3,
                fontWeight: 700, color: MAGAZINE_COLORS.text,
                lineHeight: 1.2, letterSpacing: '-0.01em',
              }}>
                {text}
              </div>
              {detail && (
                <div style={{
                  fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.small,
                  color: MAGAZINE_COLORS.secondary, marginTop: 4, lineHeight: 1.3,
                }}>
                  {detail}
                </div>
              )}
            </div>
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
```

- [ ] **Step 5: Create index.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import type { MagazineRankingProps } from './schema';
import { paperSlide } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark, PinMark } from '../../magazine/decorations';
import { RankItem } from './components/RankItem';

const CANVAS_W = 1080;
const TITLE_Y = 140;
const TITLE_W = 800;
const TITLE_H = 140;
const ITEM_START_Y = 350;
const ITEM_SPACING = 200;
const STAGGER = 10;
const ENTER_DURATION = 25;

const DIRECTIONS: Array<'left' | 'right'> = ['left', 'right'];
const TAPE_CORNERS: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
  'top-right', 'top-left', 'bottom-right', 'bottom-left',
];

const MagazineRanking: React.FC<MagazineRankingProps> = ({ title, items }) => {
  const frame = useCurrentFrame();

  const titleSlide = paperSlide(frame, 0, 15, 'down');

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title */}
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={200} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="ranking-title" />
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, boxSizing: 'border-box',
              }}>
                <SerifHeadline text={title} size={39} />
              </div>
            </div>
          </TornEdge>
          <TapeMark corner="top-right" seed={200} />
        </div>
      </div>

      {/* Ranked items */}
      {items.map((item, i) => {
        const enterStart = 15 + i * STAGGER;
        const slide = paperSlide(frame, enterStart, ENTER_DURATION, DIRECTIONS[i % 2]);
        const landFrame = enterStart + ENTER_DURATION;

        const depth = i % 3;
        const depthMul = (depth + 1) * 6;
        const parallaxX = frame >= 60 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const parallaxY = frame >= 60 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.5 : 0;

        const isEntering = frame < landFrame;

        const offsetX = (random(`rank-ox-${i}`) - 0.5) * 40;
        const baseX = (CANVAS_W - 920) / 2 + offsetX;
        const baseY = ITEM_START_Y + i * ITEM_SPACING;

        let x = baseX + parallaxX;
        let y = baseY + parallaxY;
        let opacity = 1;
        if (isEntering) { x += slide.translateX; y += slide.translateY; opacity = slide.opacity; }

        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, zIndex: depth }}>
            <div style={{ position: 'relative' }}>
              <RankItem rank={i + 1} text={item.text} detail={item.detail} index={i} />
              {random(`rank-deco-${i}`) > 0.5 ? (
                <TapeMark corner={TAPE_CORNERS[i % 4]} seed={i + 200} />
              ) : (
                <PinMark x={920 / 2} y={4} seed={i + 200} />
              )}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineRanking;
```

- [ ] **Step 6: Create register.ts**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts', 'components/RankItem.tsx'`

sharedFileNames must include `'decorations.tsx'` (uses TapeMark/PinMark).

- [ ] **Step 7: Add import to src/index.ts**

Add this line after the existing magazine imports:
```typescript
import './templates/magazine-ranking/register';
```

- [ ] **Step 8: Add entry to registry.json**

Add to the `items` array:
```json
{
  "name": "magazine-ranking",
  "type": "registry:component",
  "description": "Numbered ranked list with large rank numbers on torn paper strips, ideal for Top 5 and listicle content",
  "categories": ["overlay"],
  "tags": ["magazine-theme", "overlay", "ranking", "list", "top5", "listicle", "numbered"],
  "meta": {
    "stylePreset": "elegantEditorial",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

- [ ] **Step 9: Verify TypeScript compiles**

Run: `cd packages/templates && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add packages/templates/src/templates/magazine-ranking/ packages/templates/src/index.ts packages/templates/registry.json
git commit -m "feat(templates): add magazine-ranking template"
```

---

## Task 2: magazine-steps

Step-by-step tutorial flow with numbered circles connected by a vertical dashed line. For how-to, recipe, and tutorial content.

**Files:**
- Create: `packages/templates/src/templates/magazine-steps/schema.ts`
- Create: `packages/templates/src/templates/magazine-steps/meta.json`
- Create: `packages/templates/src/templates/magazine-steps/metadata.json`
- Create: `packages/templates/src/templates/magazine-steps/index.tsx`
- Create: `packages/templates/src/templates/magazine-steps/register.ts`
- Create: `packages/templates/src/templates/magazine-steps/components/StepCircle.tsx`
- Create: `packages/templates/src/templates/magazine-steps/components/DashedLine.tsx`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('How It Happened'),
  steps: z.array(z.object({
    label: z.string(),
    description: z.string().optional(),
  })).min(2).max(5).default([
    { label: 'Delegates arrived in Geneva', description: 'From 47 nations' },
    { label: 'Framework terms negotiated', description: 'Over 72 hours non-stop' },
    { label: 'Final agreement signed', description: 'Historic unanimous vote' },
  ]),
});

export type MagazineStepsProps = z.infer<typeof schema>;
export const defaultProps: MagazineStepsProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-steps",
  "name": "Magazine Steps",
  "description": "Step-by-step numbered flow with connecting dashed line, ideal for tutorials and how-to content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "steps", "tutorial", "how-to", "process", "numbered"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "magazine-steps",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create components/DashedLine.tsx**

A vertical dashed line that draws downward between step circles.

```tsx
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function DashedLine({ startY, endY }: { startY: number; endY: number }) {
  const frame = useCurrentFrame();
  const totalHeight = endY - startY;
  const drawProgress = interpolate(frame, [10, 40], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const currentHeight = totalHeight * drawProgress;
  const dashCount = Math.ceil(currentHeight / 16);

  return (
    <div style={{
      position: 'absolute', left: 128, top: startY,
      width: 3, height: currentHeight, overflow: 'hidden',
    }}>
      {Array.from({ length: dashCount }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, top: i * 16,
          width: 3, height: 8,
          backgroundColor: MAGAZINE_COLORS.accent,
          borderRadius: 1.5, opacity: 0.4,
        }} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create components/StepCircle.tsx**

A numbered circle with label text beside it.

```tsx
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { editorialReveal } from '../../../magazine/animations';

export function StepCircle({
  stepNumber, label, description, revealFrame,
}: {
  stepNumber: number; label: string; description?: string; revealFrame: number;
}) {
  const frame = useCurrentFrame();
  const reveal = editorialReveal(frame, revealFrame, 15);

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 28,
      opacity: reveal.opacity,
      transform: `translateY(${reveal.translateY}px)`,
    }}>
      {/* Numbered circle */}
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        backgroundColor: MAGAZINE_COLORS.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h3,
          fontWeight: 700, color: '#ffffff', lineHeight: 1,
        }}>
          {stepNumber}
        </div>
      </div>
      {/* Text */}
      <div style={{ paddingTop: 4, flex: 1 }}>
        <div style={{
          fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h2,
          fontWeight: 700, color: MAGAZINE_COLORS.text,
          lineHeight: 1.2, letterSpacing: '-0.01em',
        }}>
          {label}
        </div>
        {description && (
          <div style={{
            fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.large,
            color: MAGAZINE_COLORS.secondary, marginTop: 8, lineHeight: 1.3,
          }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create index.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { MagazineStepsProps } from './schema';
import { paperSlide, editorialReveal } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark } from '../../magazine/decorations';
import { StepCircle } from './components/StepCircle';
import { DashedLine } from './components/DashedLine';

const CANVAS_W = 1080;
const TITLE_Y = 120;
const TITLE_W = 800;
const TITLE_H = 140;
const FIRST_STEP_Y = 360;
const STEP_SPACING = 280;
const STAGGER = 12;

const MagazineSteps: React.FC<MagazineStepsProps> = ({ title, steps }) => {
  const frame = useCurrentFrame();

  const titleSlide = paperSlide(frame, 0, 15, 'down');

  const lineStartY = FIRST_STEP_Y + 28;
  const lineEndY = FIRST_STEP_Y + (steps.length - 1) * STEP_SPACING + 28;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title */}
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={210} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="steps-title" />
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, boxSizing: 'border-box',
              }}>
                <SerifHeadline text={title} size={39} />
              </div>
            </div>
          </TornEdge>
          <TapeMark corner="top-left" seed={210} />
        </div>
      </div>

      {/* Dashed connecting line */}
      <DashedLine startY={lineStartY} endY={lineEndY} />

      {/* Step items */}
      {steps.map((step, i) => {
        const revealFrame = 20 + i * STAGGER;
        const y = FIRST_STEP_Y + i * STEP_SPACING;

        return (
          <div key={i} style={{
            position: 'absolute', left: 100, top: y,
            width: CANVAS_W - 200,
          }}>
            <StepCircle
              stepNumber={i + 1}
              label={step.label}
              description={step.description}
              revealFrame={revealFrame}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineSteps;
```

- [ ] **Step 7: Create register.ts**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts', 'components/StepCircle.tsx', 'components/DashedLine.tsx'`

sharedFileNames must include `'decorations.tsx'`.

- [ ] **Step 8: Add import to src/index.ts and entry to registry.json**

Import: `import './templates/magazine-steps/register';`

registry.json entry:
```json
{
  "name": "magazine-steps",
  "type": "registry:component",
  "description": "Step-by-step numbered flow with connecting dashed line, ideal for tutorials and how-to content",
  "categories": ["overlay"],
  "tags": ["magazine-theme", "overlay", "steps", "tutorial", "how-to", "process", "numbered"],
  "meta": { "stylePreset": "elegantEditorial", "aspectRatio": "9:16", "estimatedDuration": "5s" }
}
```

- [ ] **Step 9: Verify and commit**

Run: `cd packages/templates && npx tsc --noEmit`

```bash
git add packages/templates/src/templates/magazine-steps/ packages/templates/src/index.ts packages/templates/registry.json
git commit -m "feat(templates): add magazine-steps template"
```

---

## Task 3: magazine-proscons

Two-column pros and cons list with checkmark/cross icons. For product reviews and decision content.

**Files:**
- Create: `packages/templates/src/templates/magazine-proscons/schema.ts`
- Create: `packages/templates/src/templates/magazine-proscons/meta.json`
- Create: `packages/templates/src/templates/magazine-proscons/metadata.json`
- Create: `packages/templates/src/templates/magazine-proscons/index.tsx`
- Create: `packages/templates/src/templates/magazine-proscons/register.ts`
- Create: `packages/templates/src/templates/magazine-proscons/components/ProConItem.tsx`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('The Agreement'),
  pros: z.array(z.string()).min(1).max(4).default([
    'Immediate ceasefire',
    'Humanitarian access',
    'Prisoner exchange',
  ]),
  cons: z.array(z.string()).min(1).max(4).default([
    'No territorial resolution',
    'Enforcement unclear',
    'Timeline disputed',
  ]),
});

export type MagazineProsconsProps = z.infer<typeof schema>;
export const defaultProps: MagazineProsconsProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-proscons",
  "name": "Magazine Pros & Cons",
  "description": "Two-column pros and cons list with checkmark and cross icons, ideal for reviews and decision content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "pros", "cons", "review", "decision", "comparison"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "magazine-proscons",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create components/ProConItem.tsx**

```tsx
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { editorialReveal } from '../../../magazine/animations';

export function ProConItem({
  text, type, revealFrame,
}: {
  text: string; type: 'pro' | 'con'; revealFrame: number;
}) {
  const frame = useCurrentFrame();
  const reveal = editorialReveal(frame, revealFrame, 15);
  const isPro = type === 'pro';
  const iconColor = isPro ? '#16a34a' : MAGAZINE_COLORS.accent;
  const icon = isPro ? '\u2713' : '\u2717';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 16,
      opacity: reveal.opacity,
      transform: `translateY(${reveal.translateY}px)`,
      marginBottom: 24,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        backgroundColor: iconColor, opacity: 0.15,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.large,
          fontWeight: 700, color: iconColor, lineHeight: 1,
        }}>
          {icon}
        </div>
      </div>
      <div style={{
        fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h4,
        color: MAGAZINE_COLORS.text, lineHeight: 1.3, paddingTop: 4,
      }}>
        {text}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create index.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineProsconsProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline, SectionLabel } from '../../magazine/typography';
import { MAGAZINE_COLORS } from '../../magazine/constants';
import { ProConItem } from './components/ProConItem';

const CANVAS_W = 1080;
const TITLE_Y = 140;
const TITLE_W = 800;
const TITLE_H = 140;
const COLUMNS_Y = 380;
const COL_WIDTH = 460;
const LEFT_X = 40;
const RIGHT_X = 580;
const STAGGER = 10;

const MagazineProscons: React.FC<MagazineProsconsProps> = ({ title, pros, cons }) => {
  const frame = useCurrentFrame();

  const titleSlide = paperSlide(frame, 0, 15, 'down');

  // Center divider draws down
  const dividerProgress = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const dividerHeight = 1200 * dividerProgress;

  // Column headers
  const prosHeaderReveal = editorialReveal(frame, 15, 12);
  const consHeaderReveal = editorialReveal(frame, 18, 12);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title */}
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={220} width={TITLE_W} height={TITLE_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="proscons-title" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24, boxSizing: 'border-box',
            }}>
              <SerifHeadline text={title} size={39} />
            </div>
          </div>
        </TornEdge>
      </div>

      {/* Center divider */}
      <div style={{
        position: 'absolute', left: CANVAS_W / 2 - 1.5, top: COLUMNS_Y - 40,
        width: 3, height: dividerHeight,
        backgroundColor: MAGAZINE_COLORS.accent,
        borderRadius: 1.5, opacity: 0.5,
      }} />

      {/* Pros column header */}
      <div style={{
        position: 'absolute', left: LEFT_X, top: COLUMNS_Y - 50,
        width: COL_WIDTH, textAlign: 'center',
        opacity: prosHeaderReveal.opacity,
        transform: `translateY(${prosHeaderReveal.translateY}px)`,
      }}>
        <SectionLabel label="Pros" color="#16a34a" />
      </div>

      {/* Cons column header */}
      <div style={{
        position: 'absolute', left: RIGHT_X, top: COLUMNS_Y - 50,
        width: COL_WIDTH, textAlign: 'center',
        opacity: consHeaderReveal.opacity,
        transform: `translateY(${consHeaderReveal.translateY}px)`,
      }}>
        <SectionLabel label="Cons" color={MAGAZINE_COLORS.accent} />
      </div>

      {/* Pros items */}
      <div style={{ position: 'absolute', left: LEFT_X + 20, top: COLUMNS_Y + 20, width: COL_WIDTH - 40 }}>
        {pros.map((text, i) => (
          <ProConItem key={i} text={text} type="pro" revealFrame={25 + i * STAGGER} />
        ))}
      </div>

      {/* Cons items */}
      <div style={{ position: 'absolute', left: RIGHT_X + 20, top: COLUMNS_Y + 20, width: COL_WIDTH - 40 }}>
        {cons.map((text, i) => (
          <ProConItem key={i} text={text} type="con" revealFrame={25 + i * STAGGER} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export default MagazineProscons;
```

- [ ] **Step 6: Create register.ts, add import to src/index.ts, add entry to registry.json, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts', 'components/ProConItem.tsx'`

Import: `import './templates/magazine-proscons/register';`

---

## Task 4: magazine-verdict

Product/topic verdict card with large rating, highlight bullets, and recommendation. For review content.

**Files:**
- Create: `packages/templates/src/templates/magazine-verdict/schema.ts`
- Create: `packages/templates/src/templates/magazine-verdict/meta.json`
- Create: `packages/templates/src/templates/magazine-verdict/metadata.json`
- Create: `packages/templates/src/templates/magazine-verdict/index.tsx`
- Create: `packages/templates/src/templates/magazine-verdict/register.ts`
- Create: `packages/templates/src/templates/magazine-verdict/components/RatingRing.tsx`
- Create: `packages/templates/src/templates/magazine-verdict/components/VerdictCard.tsx`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  subject: z.string().default('Geneva Peace Framework'),
  rating: z.string().default('8.5'),
  ratingLabel: z.string().default('out of 10'),
  highlights: z.array(z.string()).min(2).max(4).default([
    'Broadest multilateral support since 1945',
    'Enforceable verification mechanisms',
    'Immediate humanitarian impact',
  ]),
  recommendation: z.string().default('A landmark achievement, though implementation remains the true test.'),
});

export type MagazineVerdictProps = z.infer<typeof schema>;
export const defaultProps: MagazineVerdictProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-verdict",
  "name": "Magazine Verdict",
  "description": "Verdict card with animated rating ring, highlight bullets, and recommendation line for review content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "verdict", "rating", "review", "score", "recommendation"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "magazine-verdict",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create components/RatingRing.tsx**

An SVG circle that draws itself to represent the rating as a fraction of 10.

```tsx
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function RatingRing({
  rating, ratingLabel, drawStart,
}: {
  rating: string; ratingLabel: string; drawStart: number;
}) {
  const frame = useCurrentFrame();
  const numericRating = parseFloat(rating) || 0;
  const fraction = Math.min(numericRating / 10, 1);

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - fraction);

  const drawProgress = interpolate(frame, [drawStart, drawStart + 25], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const currentOffset = circumference - (circumference - targetOffset) * drawProgress;

  // Count-up for the rating number
  const displayNum = interpolate(frame, [drawStart, drawStart + 20], [0, numericRating], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const displayRating = displayNum.toFixed(1);

  const ratingOpacity = interpolate(frame, [drawStart, drawStart + 8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      opacity: ratingOpacity,
    }}>
      <div style={{ position: 'relative', width: 200, height: 200 }}>
        <svg width={200} height={200} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background ring */}
          <circle cx={100} cy={100} r={radius}
            fill="none" stroke={MAGAZINE_COLORS.secondary} strokeWidth={6} opacity={0.15} />
          {/* Progress ring */}
          <circle cx={100} cy={100} r={radius}
            fill="none" stroke={MAGAZINE_COLORS.accent} strokeWidth={6}
            strokeDasharray={circumference} strokeDashoffset={currentOffset}
            strokeLinecap="round" />
        </svg>
        {/* Rating number centered */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.display,
            fontWeight: 900, color: MAGAZINE_COLORS.text, lineHeight: 1,
          }}>
            {displayRating}
          </div>
          <div style={{
            fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.caption,
            color: MAGAZINE_COLORS.secondary, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginTop: 4,
          }}>
            {ratingLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create components/VerdictCard.tsx**

```tsx
import React from 'react';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';

const CARD_W = 940;
const CARD_H = 1500;

export function VerdictCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: CARD_W, height: CARD_H,
      filter: 'drop-shadow(0 6px 30px rgba(0,0,0,0.5))',
      position: 'relative',
    }}>
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={230} width={CARD_W} height={CARD_H}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.15} seed="verdict" />
          <div style={{
            position: 'relative', zIndex: 1, width: '100%', height: '100%',
            padding: '60px 50px', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            {children}
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
```

- [ ] **Step 6: Create index.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { MagazineVerdictProps } from './schema';
import { paperSlide, editorialReveal } from '../../magazine/animations';
import { SerifHeadline, SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { VerdictCard } from './components/VerdictCard';
import { RatingRing } from './components/RatingRing';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1500;
const HIGHLIGHT_STAGGER = 10;

const MagazineVerdict: React.FC<MagazineVerdictProps> = ({
  subject, rating, ratingLabel, highlights, recommendation,
}) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const subjectReveal = editorialReveal(frame, 15, 15);
  const labelReveal = editorialReveal(frame, 20, 12);

  const lastHighlightFrame = 45 + (highlights.length - 1) * HIGHLIGHT_STAGGER + 15;
  const recoReveal = editorialReveal(frame, lastHighlightFrame + 5, 15);

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <VerdictCard>
          {/* Section label */}
          <div style={{
            opacity: labelReveal.opacity,
            transform: `translateY(${labelReveal.translateY}px)`,
            width: '100%',
          }}>
            <SectionLabel label="Verdict" />
          </div>

          {/* Subject title */}
          <div style={{
            marginTop: 24,
            opacity: subjectReveal.opacity,
            transform: `translateY(${subjectReveal.translateY}px)`,
          }}>
            <SerifHeadline text={subject} size={FONT_SIZES.h1} />
          </div>

          {/* Rating ring */}
          <div style={{ marginTop: 40 }}>
            <RatingRing rating={rating} ratingLabel={ratingLabel} drawStart={25} />
          </div>

          {/* Highlights */}
          <div style={{ marginTop: 40, width: '100%' }}>
            {highlights.map((text, i) => {
              const reveal = editorialReveal(frame, 45 + i * HIGHLIGHT_STAGGER, 15);
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20,
                  opacity: reveal.opacity,
                  transform: `translateY(${reveal.translateY}px)`,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: MAGAZINE_COLORS.accent,
                    flexShrink: 0, marginTop: 10,
                  }} />
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h4,
                    color: MAGAZINE_COLORS.text, lineHeight: 1.3,
                  }}>
                    {text}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommendation */}
          <div style={{
            marginTop: 30, width: '100%',
            borderTop: `2px solid ${MAGAZINE_COLORS.accent}`,
            paddingTop: 24,
            opacity: recoReveal.opacity,
            transform: `translateY(${recoReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
              fontStyle: 'italic', color: MAGAZINE_COLORS.secondary,
              lineHeight: 1.4,
            }}>
              {recommendation}
            </div>
          </div>
        </VerdictCard>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineVerdict;
```

- [ ] **Step 7: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts', 'components/RatingRing.tsx', 'components/VerdictCard.tsx'`

Import: `import './templates/magazine-verdict/register';`

---

## Task 5: magazine-mythfact

Myth-busting format — myth with animated strike-through, then fact reveals below. For educational/debunking content.

**Files:**
- Create: `packages/templates/src/templates/magazine-mythfact/schema.ts`
- Create: `packages/templates/src/templates/magazine-mythfact/meta.json`
- Create: `packages/templates/src/templates/magazine-mythfact/metadata.json`
- Create: `packages/templates/src/templates/magazine-mythfact/index.tsx`
- Create: `packages/templates/src/templates/magazine-mythfact/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  topic: z.string().default('Common Misconception'),
  myth: z.string().default('The conflict began in 2022 with no prior warning.'),
  fact: z.string().default('Tensions had been escalating since 2014, with multiple diplomatic failures preceding the full-scale conflict.'),
});

export type MagazineMythfactProps = z.infer<typeof schema>;
export const defaultProps: MagazineMythfactProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-mythfact",
  "name": "Magazine Myth vs Fact",
  "description": "Myth-busting overlay with animated strike-through on the myth and clean reveal of the fact below",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "myth", "fact", "debunk", "educational", "truth"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "magazine-mythfact",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

This template is simple enough to not need sub-components. Everything lives in index.tsx.

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineMythfactProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1500;

const MagazineMythfact: React.FC<MagazineMythfactProps> = ({ topic, myth, fact }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const topicReveal = editorialReveal(frame, 15, 12);
  const mythReveal = editorialReveal(frame, 20, 15);

  // Strike-through draws across the myth text
  const strikeProgress = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  // Myth text fades to secondary after strike
  const mythFade = interpolate(frame, [45, 55], [1, 0.4], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Divider draws
  const dividerProgress = interpolate(frame, [55, 65], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  // Fact label and text reveal
  const factLabelReveal = editorialReveal(frame, 60, 12);
  const factReveal = editorialReveal(frame, 68, 15);

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={240} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.2} seed="mythfact" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '80px 60px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Topic label */}
              <div style={{
                opacity: topicReveal.opacity,
                transform: `translateY(${topicReveal.translateY}px)`,
              }}>
                <SectionLabel label={topic} />
              </div>

              {/* MYTH section */}
              <div style={{
                marginTop: 60,
                opacity: mythReveal.opacity,
                transform: `translateY(${mythReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                  fontWeight: 700, color: MAGAZINE_COLORS.accent,
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16,
                }}>
                  MYTH
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                    fontWeight: 700, color: MAGAZINE_COLORS.text,
                    lineHeight: 1.3, opacity: mythFade,
                  }}>
                    {myth}
                  </div>
                  {/* Strike-through line */}
                  {strikeProgress > 0 && (
                    <div style={{
                      position: 'absolute', top: '50%', left: 0,
                      width: `${strikeProgress * 100}%`, height: 4,
                      backgroundColor: MAGAZINE_COLORS.accent,
                      borderRadius: 2, transform: 'translateY(-50%)',
                    }} />
                  )}
                </div>
              </div>

              {/* Divider */}
              <div style={{
                marginTop: 50, marginBottom: 50,
                width: `${dividerProgress * 100}%`, height: 2,
                backgroundColor: MAGAZINE_COLORS.secondary, opacity: 0.2,
              }} />

              {/* FACT section */}
              <div style={{
                opacity: factLabelReveal.opacity,
                transform: `translateY(${factLabelReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                  fontWeight: 700, color: '#16a34a',
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16,
                }}>
                  FACT
                </div>
              </div>
              <div style={{
                opacity: factReveal.opacity,
                transform: `translateY(${factReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h2,
                  color: MAGAZINE_COLORS.text, lineHeight: 1.4,
                }}>
                  {fact}
                </div>
              </div>
            </div>
          </div>
        </TornEdge>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineMythfact;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

No component files. No decorations.tsx needed in shared.

Import: `import './templates/magazine-mythfact/register';`

---

## Task 6: magazine-beforeafter

Before/After split layout for transformation content. Two sections with directional entrances.

**Files:**
- Create: `packages/templates/src/templates/magazine-beforeafter/schema.ts`
- Create: `packages/templates/src/templates/magazine-beforeafter/meta.json`
- Create: `packages/templates/src/templates/magazine-beforeafter/metadata.json`
- Create: `packages/templates/src/templates/magazine-beforeafter/index.tsx`
- Create: `packages/templates/src/templates/magazine-beforeafter/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Diplomatic Relations'),
  before: z.string().default('Frozen negotiations, escalating hostilities, no humanitarian access'),
  after: z.string().default('Active dialogue, 30-day ceasefire, humanitarian corridors established'),
  beforeLabel: z.string().default('Before'),
  afterLabel: z.string().default('After'),
});

export type MagazineBeforeafterProps = z.infer<typeof schema>;
export const defaultProps: MagazineBeforeafterProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-beforeafter",
  "name": "Magazine Before & After",
  "description": "Split before/after layout with directional entrances and arrow transition, ideal for transformation content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "before", "after", "transformation", "comparison", "change"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "magazine-beforeafter",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineBeforeafterProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline, SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 880;
const SECTION_H = 500;
const GAP = 160;

const MagazineBeforeafter: React.FC<MagazineBeforeafterProps> = ({
  title, before, after, beforeLabel, afterLabel,
}) => {
  const frame = useCurrentFrame();

  const titleReveal = editorialReveal(frame, 5, 15);

  // Before section slides in from left
  const beforeSlide = paperSlide(frame, 10, 25, 'left');
  // After section slides in from right
  const afterSlide = paperSlide(frame, 40, 25, 'right');

  // Arrow draws between sections
  const arrowOpacity = interpolate(frame, [30, 38], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const arrowScale = interpolate(frame, [30, 40], [0.5, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const centerX = (CANVAS_W - CARD_W) / 2;
  const topSectionY = 320;
  const arrowY = topSectionY + SECTION_H + (GAP - 60) / 2;
  const bottomSectionY = topSectionY + SECTION_H + GAP;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title */}
      <div style={{
        position: 'absolute', left: 0, top: 160, width: CANVAS_W,
        display: 'flex', justifyContent: 'center',
        opacity: titleReveal.opacity,
        transform: `translateY(${titleReveal.translateY}px)`,
      }}>
        <SerifHeadline text={title} size={FONT_SIZES.h1} />
      </div>

      {/* Before section */}
      <div style={{
        position: 'absolute', left: centerX + beforeSlide.translateX, top: topSectionY + beforeSlide.translateY,
        opacity: beforeSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={250} width={CARD_W} height={SECTION_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.35} seed="before" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '40px 50px', boxSizing: 'border-box',
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                fontWeight: 700, color: MAGAZINE_COLORS.accent,
                letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20,
              }}>
                {beforeLabel}
              </div>
              <div style={{
                fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                color: MAGAZINE_COLORS.text, lineHeight: 1.4,
              }}>
                {before}
              </div>
            </div>
          </div>
        </TornEdge>
      </div>

      {/* Arrow */}
      <div style={{
        position: 'absolute', left: CANVAS_W / 2, top: arrowY,
        transform: `translate(-50%, -50%) scale(${arrowScale})`,
        opacity: arrowOpacity,
      }}>
        <div style={{
          fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
          color: MAGAZINE_COLORS.accent, lineHeight: 1,
        }}>
          {'\u2193'}
        </div>
      </div>

      {/* After section */}
      <div style={{
        position: 'absolute', left: centerX + afterSlide.translateX, top: bottomSectionY + afterSlide.translateY,
        opacity: afterSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={251} width={CARD_W} height={SECTION_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.1} seed="after" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '40px 50px', boxSizing: 'border-box',
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                fontWeight: 700, color: '#16a34a',
                letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20,
              }}>
                {afterLabel}
              </div>
              <div style={{
                fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                color: MAGAZINE_COLORS.text, lineHeight: 1.4,
              }}>
                {after}
              </div>
            </div>
          </div>
        </TornEdge>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineBeforeafter;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-beforeafter/register';`

---

## Task 7: magazine-definition

"What is [TERM]?" explainer overlay with large term, pronunciation, definition, and category badge.

**Files:**
- Create: `packages/templates/src/templates/magazine-definition/schema.ts`
- Create: `packages/templates/src/templates/magazine-definition/meta.json`
- Create: `packages/templates/src/templates/magazine-definition/metadata.json`
- Create: `packages/templates/src/templates/magazine-definition/index.tsx`
- Create: `packages/templates/src/templates/magazine-definition/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  term: z.string().default('Ceasefire'),
  pronunciation: z.string().optional().default('/\u02C8si\u02D0s.fa\u026A.\u0259r/'),
  definition: z.string().default('A temporary suspension of fighting, typically one during which peace talks take place; an agreement to stop fighting.'),
  category: z.string().optional().default('International Law'),
});

export type MagazineDefinitionProps = z.infer<typeof schema>;
export const defaultProps: MagazineDefinitionProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-definition",
  "name": "Magazine Definition",
  "description": "Term definition overlay with large word, pronunciation, and editorial definition text for explainer content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "definition", "explainer", "term", "glossary", "educational"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "magazine-definition",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineDefinitionProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const MagazineDefinition: React.FC<MagazineDefinitionProps> = ({
  term, pronunciation, definition, category,
}) => {
  const frame = useCurrentFrame();

  const slide = paperSlide(frame, 0, 15, 'up');
  const categoryReveal = editorialReveal(frame, 10, 12);
  const termReveal = editorialReveal(frame, 15, 15);
  const pronunciationReveal = editorialReveal(frame, 25, 12);

  // Horizontal rule draws across
  const ruleProgress = interpolate(frame, [28, 42], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const definitionReveal = editorialReveal(frame, 40, 18);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        width: '100%', height: '100%',
        opacity: slide.opacity,
        transform: `translateY(${slide.translateY}px)`,
      }}>
        <PaperTexture age={0.1} opacity={1} seed="definition-paper" />

        {/* Content — vertically centered */}
        <div style={{
          position: 'absolute', left: 80, right: 80, top: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          {/* Category badge */}
          {category && (
            <div style={{
              opacity: categoryReveal.opacity,
              transform: `translateY(${categoryReveal.translateY}px)`,
              marginBottom: 24,
            }}>
              <span style={{
                fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                fontWeight: 700, color: MAGAZINE_COLORS.accent,
                letterSpacing: '0.15em', textTransform: 'uppercase',
                borderBottom: `2px solid ${MAGAZINE_COLORS.accent}`,
                paddingBottom: 4,
              }}>
                {category}
              </span>
            </div>
          )}

          {/* Term */}
          <div style={{
            opacity: termReveal.opacity,
            transform: `translateY(${termReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.hero,
              fontWeight: 900, color: MAGAZINE_COLORS.text,
              lineHeight: 1.1, letterSpacing: '-0.02em',
            }}>
              {term}
            </div>
          </div>

          {/* Pronunciation */}
          {pronunciation && (
            <div style={{
              opacity: pronunciationReveal.opacity,
              transform: `translateY(${pronunciationReveal.translateY}px)`,
              marginTop: 12,
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h4,
                fontStyle: 'italic', color: MAGAZINE_COLORS.secondary,
              }}>
                {pronunciation}
              </div>
            </div>
          )}

          {/* Horizontal rule */}
          <div style={{
            marginTop: 32, marginBottom: 32,
            width: `${ruleProgress * 100}%`, height: 3,
            backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
          }} />

          {/* Definition */}
          <div style={{
            opacity: definitionReveal.opacity,
            transform: `translateY(${definitionReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h2,
              color: MAGAZINE_COLORS.text, lineHeight: 1.5,
            }}>
              {definition}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineDefinition;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-definition/register';`

---

## Task 8: magazine-takeaways

Key takeaways summary card with bullet points. For end-of-video recap content.

**Files:**
- Create: `packages/templates/src/templates/magazine-takeaways/schema.ts`
- Create: `packages/templates/src/templates/magazine-takeaways/meta.json`
- Create: `packages/templates/src/templates/magazine-takeaways/metadata.json`
- Create: `packages/templates/src/templates/magazine-takeaways/index.tsx`
- Create: `packages/templates/src/templates/magazine-takeaways/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Key Takeaways'),
  points: z.array(z.string()).min(2).max(5).default([
    '47 nations reached consensus in record time',
    'Humanitarian access begins within 72 hours',
    'Verification mechanisms are legally binding',
    'Next review summit scheduled for September',
  ]),
});

export type MagazineTakeawaysProps = z.infer<typeof schema>;
export const defaultProps: MagazineTakeawaysProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-takeaways",
  "name": "Magazine Takeaways",
  "description": "Key takeaways summary card with numbered bullet points for end-of-video recap content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "takeaways", "summary", "recap", "bullets", "key-points"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "magazine-takeaways",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { MagazineTakeawaysProps } from './schema';
import { paperSlide, editorialReveal } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline, SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1400;
const POINT_STAGGER = 10;

const MagazineTakeaways: React.FC<MagazineTakeawaysProps> = ({ title, points }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const labelReveal = editorialReveal(frame, 15, 12);
  const titleReveal = editorialReveal(frame, 20, 15);

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={270} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="takeaways" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 50px', boxSizing: 'border-box',
            }}>
              {/* Section label */}
              <div style={{
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label="Summary" />
              </div>

              {/* Title */}
              <div style={{
                marginTop: 24,
                opacity: titleReveal.opacity,
                transform: `translateY(${titleReveal.translateY}px)`,
              }}>
                <SerifHeadline text={title} size={FONT_SIZES.h1} showRule />
              </div>

              {/* Points */}
              <div style={{ marginTop: 50 }}>
                {points.map((point, i) => {
                  const reveal = editorialReveal(frame, 35 + i * POINT_STAGGER, 15);
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 28,
                      opacity: reveal.opacity,
                      transform: `translateY(${reveal.translateY}px)`,
                    }}>
                      {/* Number bullet */}
                      <div style={{
                        fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h3,
                        fontWeight: 700, color: MAGAZINE_COLORS.accent,
                        lineHeight: 1.3, minWidth: 36, textAlign: 'right',
                        flexShrink: 0,
                      }}>
                        {i + 1}.
                      </div>
                      <div style={{
                        fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                        color: MAGAZINE_COLORS.text, lineHeight: 1.4,
                      }}>
                        {point}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TornEdge>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineTakeaways;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-takeaways/register';`

---

## Task 9: magazine-quote

Testimonial/expert quote with attribution. Different from typewriter — this is formal citation with author info.

**Files:**
- Create: `packages/templates/src/templates/magazine-quote/schema.ts`
- Create: `packages/templates/src/templates/magazine-quote/meta.json`
- Create: `packages/templates/src/templates/magazine-quote/metadata.json`
- Create: `packages/templates/src/templates/magazine-quote/index.tsx`
- Create: `packages/templates/src/templates/magazine-quote/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  quote: z.string().default('This agreement represents the most significant diplomatic breakthrough of the century. Its implications will reshape international relations for decades.'),
  author: z.string().default('Dr. Elena Vasquez'),
  role: z.string().optional().default('Chief Diplomatic Correspondent'),
  context: z.string().optional().default('Speaking at the Geneva Press Conference, March 2026'),
});

export type MagazineQuoteProps = z.infer<typeof schema>;
export const defaultProps: MagazineQuoteProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-quote",
  "name": "Magazine Quote",
  "description": "Editorial quote card with large quotation marks, attribution, and optional context line",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "quote", "testimonial", "citation", "attribution", "expert"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "magazine-quote",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create index.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineQuoteProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const MagazineQuote: React.FC<MagazineQuoteProps> = ({ quote, author, role, context }) => {
  const frame = useCurrentFrame();

  const slide = paperSlide(frame, 0, 15, 'up');
  const quoteMarkReveal = editorialReveal(frame, 8, 12);
  const quoteTextReveal = editorialReveal(frame, 18, 18);

  // Accent rule draws
  const ruleProgress = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const authorReveal = editorialReveal(frame, 50, 15);
  const roleReveal = editorialReveal(frame, 58, 12);
  const contextReveal = editorialReveal(frame, 68, 15);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        width: '100%', height: '100%',
        opacity: slide.opacity,
        transform: `translateY(${slide.translateY}px)`,
      }}>
        <PaperTexture age={0.1} opacity={1} seed="quote-paper" />

        {/* Content — vertically centered */}
        <div style={{
          position: 'absolute', left: 80, right: 80, top: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          {/* Opening quotation mark */}
          <div style={{
            fontFamily: MAGAZINE_FONTS.headline, fontSize: 240,
            fontWeight: 700, color: MAGAZINE_COLORS.accent,
            lineHeight: 0.6, marginBottom: -30,
            opacity: quoteMarkReveal.opacity * 0.12,
            transform: `translateY(${quoteMarkReveal.translateY}px)`,
            userSelect: 'none',
          }}>
            {'\u201C'}
          </div>

          {/* Quote text */}
          <div style={{
            paddingLeft: 24,
            opacity: quoteTextReveal.opacity,
            transform: `translateY(${quoteTextReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
              fontWeight: 700, color: MAGAZINE_COLORS.text,
              lineHeight: 1.35, letterSpacing: '-0.01em',
            }}>
              {quote}
            </div>
          </div>

          {/* Accent rule */}
          <div style={{
            marginTop: 36, marginBottom: 28, marginLeft: 24,
            width: `${ruleProgress * 30}%`, height: 3,
            backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
          }} />

          {/* Author */}
          <div style={{
            paddingLeft: 24,
            opacity: authorReveal.opacity,
            transform: `translateY(${authorReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h3,
              fontWeight: 700, color: MAGAZINE_COLORS.text,
            }}>
              {'\u2014 '}{author}
            </div>
          </div>

          {/* Role */}
          {role && (
            <div style={{
              paddingLeft: 50,
              opacity: roleReveal.opacity,
              transform: `translateY(${roleReveal.translateY}px)`,
              marginTop: 8,
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.large,
                fontStyle: 'italic', color: MAGAZINE_COLORS.secondary,
              }}>
                {role}
              </div>
            </div>
          )}

          {/* Context */}
          {context && (
            <div style={{
              paddingLeft: 24, marginTop: 30,
              opacity: contextReveal.opacity,
              transform: `translateY(${contextReveal.translateY}px)`,
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                color: MAGAZINE_COLORS.secondary,
                letterSpacing: '0.05em',
              }}>
                {context}
              </div>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineQuote;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-quote/register';`

---

## Task 10: magazine-versus

Dramatic VS matchup with center badge, side names, and stat bullets. For "X vs Y" content.

**Files:**
- Create: `packages/templates/src/templates/magazine-versus/schema.ts`
- Create: `packages/templates/src/templates/magazine-versus/meta.json`
- Create: `packages/templates/src/templates/magazine-versus/metadata.json`
- Create: `packages/templates/src/templates/magazine-versus/index.tsx`
- Create: `packages/templates/src/templates/magazine-versus/register.ts`
- Create: `packages/templates/src/templates/magazine-versus/components/VsBadge.tsx`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().optional().default('Military Comparison'),
  leftName: z.string().default('NATO'),
  rightName: z.string().default('BRICS'),
  leftStats: z.array(z.string()).min(1).max(4).default([
    '32 member nations',
    '3.5M active personnel',
    '$1.2T defense budget',
  ]),
  rightStats: z.array(z.string()).min(1).max(4).default([
    '10 member nations',
    '5.2M active personnel',
    '$420B defense budget',
  ]),
});

export type MagazineVersusProps = z.infer<typeof schema>;
export const defaultProps: MagazineVersusProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-versus",
  "name": "Magazine Versus",
  "description": "Dramatic VS matchup overlay with center badge, opposing names, and stat bullets for comparison content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "versus", "vs", "matchup", "battle", "competition"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 3: Create metadata.json**

```json
{
  "compositionId": "magazine-versus",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 4: Create components/VsBadge.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function VsBadge({ appearFrame }: { appearFrame: number }) {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [appearFrame, appearFrame + 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const opacity = interpolate(frame, [appearFrame, appearFrame + 8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      width: 120, height: 120, borderRadius: '50%',
      backgroundColor: MAGAZINE_COLORS.accent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: `scale(${scale})`, opacity,
      boxShadow: '0 4px 24px rgba(225,29,72,0.4)',
    }}>
      <div style={{
        fontFamily: MAGAZINE_FONTS.headline, fontSize: 42,
        fontWeight: 900, color: '#ffffff', lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        VS
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create index.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { MagazineVersusProps } from './schema';
import { paperSlide, editorialReveal } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline, SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { VsBadge } from './components/VsBadge';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const SIDE_W = 440;
const SIDE_H = 800;
const LEFT_X = 40;
const RIGHT_X = 600;
const SIDES_Y = 480;
const STAT_STAGGER = 8;

const MagazineVersus: React.FC<MagazineVersusProps> = ({
  title, leftName, rightName, leftStats, rightStats,
}) => {
  const frame = useCurrentFrame();

  const titleReveal = editorialReveal(frame, 5, 15);
  const leftSlide = paperSlide(frame, 10, 25, 'left');
  const rightSlide = paperSlide(frame, 10, 25, 'right');
  const leftNameReveal = editorialReveal(frame, 30, 15);
  const rightNameReveal = editorialReveal(frame, 30, 15);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title */}
      {title && (
        <div style={{
          position: 'absolute', left: 0, top: 180, width: CANVAS_W,
          display: 'flex', justifyContent: 'center',
          opacity: titleReveal.opacity,
          transform: `translateY(${titleReveal.translateY}px)`,
        }}>
          <SectionLabel label={title} />
        </div>
      )}

      {/* VS Badge — center */}
      <div style={{
        position: 'absolute',
        left: CANVAS_W / 2 - 60, top: SIDES_Y + SIDE_H / 2 - 60,
        zIndex: 10,
      }}>
        <VsBadge appearFrame={5} />
      </div>

      {/* Left side */}
      <div style={{
        position: 'absolute',
        left: LEFT_X + leftSlide.translateX, top: SIDES_Y + leftSlide.translateY,
        opacity: leftSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={290} width={SIDE_W} height={SIDE_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.2} seed="vs-left" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '40px 32px', boxSizing: 'border-box',
            }}>
              {/* Name */}
              <div style={{
                opacity: leftNameReveal.opacity,
                transform: `translateY(${leftNameReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                  fontWeight: 900, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.1, letterSpacing: '-0.02em',
                }}>
                  {leftName}
                </div>
              </div>
              {/* Accent rule */}
              <div style={{
                width: 48, height: 3, backgroundColor: MAGAZINE_COLORS.accent,
                borderRadius: 1.5, marginTop: 20, marginBottom: 28,
              }} />
              {/* Stats */}
              {leftStats.map((stat, i) => {
                const reveal = editorialReveal(frame, 40 + i * STAT_STAGGER, 12);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
                    opacity: reveal.opacity,
                    transform: `translateY(${reveal.translateY}px)`,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: MAGAZINE_COLORS.accent, flexShrink: 0,
                    }} />
                    <div style={{
                      fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.large,
                      color: MAGAZINE_COLORS.text, lineHeight: 1.3,
                    }}>
                      {stat}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TornEdge>
      </div>

      {/* Right side */}
      <div style={{
        position: 'absolute',
        left: RIGHT_X + rightSlide.translateX, top: SIDES_Y + rightSlide.translateY,
        opacity: rightSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={291} width={SIDE_W} height={SIDE_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.2} seed="vs-right" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '40px 32px', boxSizing: 'border-box',
            }}>
              {/* Name */}
              <div style={{
                opacity: rightNameReveal.opacity,
                transform: `translateY(${rightNameReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                  fontWeight: 900, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.1, letterSpacing: '-0.02em',
                }}>
                  {rightName}
                </div>
              </div>
              {/* Accent rule */}
              <div style={{
                width: 48, height: 3, backgroundColor: MAGAZINE_COLORS.accent,
                borderRadius: 1.5, marginTop: 20, marginBottom: 28,
              }} />
              {/* Stats */}
              {rightStats.map((stat, i) => {
                const reveal = editorialReveal(frame, 40 + i * STAT_STAGGER, 12);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
                    opacity: reveal.opacity,
                    transform: `translateY(${reveal.translateY}px)`,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: MAGAZINE_COLORS.accent, flexShrink: 0,
                    }} />
                    <div style={{
                      fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.large,
                      color: MAGAZINE_COLORS.text, lineHeight: 1.3,
                    }}>
                      {stat}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TornEdge>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineVersus;
```

- [ ] **Step 6: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts', 'components/VsBadge.tsx'`

Import: `import './templates/magazine-versus/register';`

---

## Task 11: Final verification

- [ ] **Step 1: Run full TypeScript check**

```bash
cd packages/templates && npx tsc --noEmit
```

Expected: No errors. All 10 new templates compile cleanly.

- [ ] **Step 2: Verify all templates appear in registry**

Check `src/index.ts` has all 10 new imports:
```
magazine-ranking, magazine-steps, magazine-proscons, magazine-verdict,
magazine-mythfact, magazine-beforeafter, magazine-definition,
magazine-takeaways, magazine-quote, magazine-versus
```

Check `registry.json` has all 10 new entries (total should be 22 items: 12 existing + 10 new).

- [ ] **Step 3: Start playground and spot-check each template visually**

```bash
cd packages/templates && npx vite dev
```

Open browser to each template URL and verify:
- Template renders (not blank)
- Entrance animation works
- No exit animation (overlay stays)
- Text is readable
- Layout doesn't overflow 1080x1920

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A packages/templates/
git commit -m "feat(templates): add 10 new magazine overlay templates"
```
