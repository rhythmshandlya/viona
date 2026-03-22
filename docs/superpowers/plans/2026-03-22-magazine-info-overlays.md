# Magazine Information Overlays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 5 new magazine-theme overlay templates (checklist, timeline, stats, comparison, factfile) for news/geopolitics content.

**Architecture:** Each template is a self-contained directory under `packages/templates/src/templates/magazine-{name}/` with schema, index, register, meta files, and local components. All share the magazine module system at `packages/templates/src/magazine/`. A prerequisite task promotes `TapeMark`/`PinMark` to a new shared `decorations.tsx` module.

**Tech Stack:** React, Remotion (`useCurrentFrame`, `interpolate`, `random`, `AbsoluteFill`), Zod schemas, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-22-magazine-info-overlays-design.md`

---

### Task 0: Promote TapeMark and PinMark to shared magazine module

**Files:**
- Create: `packages/templates/src/magazine/decorations.tsx`
- Modify: `packages/templates/src/templates/magazine-collage/components/TapeMark.tsx` (delete)
- Modify: `packages/templates/src/templates/magazine-collage/components/PinMark.tsx` (delete)
- Modify: `packages/templates/src/templates/magazine-collage/index.tsx` (update imports)
- Modify: `packages/templates/src/templates/magazine-collage/register.ts` (update getFiles)

- [ ] **Step 1: Create `decorations.tsx` in shared magazine dir**

Copy the contents of `TapeMark.tsx` and `PinMark.tsx` from `packages/templates/src/templates/magazine-collage/components/` into a single new file `packages/templates/src/magazine/decorations.tsx`. Both components stay exactly the same — just combined into one file.

```tsx
// packages/templates/src/magazine/decorations.tsx
import React from 'react';
import { random } from 'remotion';

export function TapeMark({
  corner,
  seed,
}: {
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  seed: number;
}) {
  const rotation = (random(`tape-rot-${seed}`) - 0.5) * 30;
  const width = 60 + random(`tape-w-${seed}`) * 40;
  const height = 18 + random(`tape-h-${seed}`) * 8;

  const positionStyle: React.CSSProperties = {};
  switch (corner) {
    case 'top-left':
      positionStyle.top = -height / 3;
      positionStyle.left = -width / 4;
      break;
    case 'top-right':
      positionStyle.top = -height / 3;
      positionStyle.right = -width / 4;
      break;
    case 'bottom-left':
      positionStyle.bottom = -height / 3;
      positionStyle.left = -width / 4;
      break;
    case 'bottom-right':
      positionStyle.bottom = -height / 3;
      positionStyle.right = -width / 4;
      break;
  }

  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        backgroundColor: 'rgba(240, 220, 160, 0.6)',
        transform: `rotate(${rotation}deg)`,
        borderRadius: 2,
        pointerEvents: 'none',
        zIndex: 10,
        ...positionStyle,
      }}
    />
  );
}

export function PinMark({
  x,
  y,
  seed,
}: {
  x: number;
  y: number;
  seed: number;
}) {
  const isBrass = random(`pin-color-${seed}`) > 0.5;
  const color = isBrass ? '#B8860B' : '#C0392B';
  const highlight = isBrass ? '#DAA520' : '#E74C3C';

  return (
    <div
      style={{
        position: 'absolute',
        left: x - 5,
        top: y - 5,
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${highlight}, ${color})`,
        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        zIndex: 11,
      }}
    />
  );
}
```

- [ ] **Step 2: Update magazine-collage imports**

In `packages/templates/src/templates/magazine-collage/index.tsx`, change:
```tsx
// OLD
import { TapeMark } from './components/TapeMark';
import { PinMark } from './components/PinMark';
// NEW
import { TapeMark } from '../../magazine/decorations';
import { PinMark } from '../../magazine/decorations';
```

- [ ] **Step 3: Delete the old local component files**

Delete:
- `packages/templates/src/templates/magazine-collage/components/TapeMark.tsx`
- `packages/templates/src/templates/magazine-collage/components/PinMark.tsx`

- [ ] **Step 4: Update magazine-collage register.ts getFiles**

In `packages/templates/src/templates/magazine-collage/register.ts`:
- Remove `'components/TapeMark.tsx'` and `'components/PinMark.tsx'` from `ownFileNames`
- Add `'decorations.tsx'` to `sharedFileNames`

- [ ] **Step 5: Verify playground still renders magazine-collage**

Run: `cd packages/templates && npx vite --config playground/vite.config.ts --port 5173`
Open browser to `http://localhost:5173`, navigate to magazine-collage, confirm it renders correctly.

- [ ] **Step 6: Commit**

```bash
git add packages/templates/src/magazine/decorations.tsx packages/templates/src/templates/magazine-collage/
git commit -m "refactor: promote TapeMark and PinMark to shared magazine/decorations.tsx"
```

---

### Task 1: magazine-checklist template

**Files:**
- Create: `packages/templates/src/templates/magazine-checklist/meta.json`
- Create: `packages/templates/src/templates/magazine-checklist/metadata.json`
- Create: `packages/templates/src/templates/magazine-checklist/schema.ts`
- Create: `packages/templates/src/templates/magazine-checklist/index.tsx`
- Create: `packages/templates/src/templates/magazine-checklist/register.ts`
- Create: `packages/templates/src/templates/magazine-checklist/components/ChecklistItem.tsx`
- Create: `packages/templates/src/templates/magazine-checklist/components/CheckMark.tsx`
- Modify: `packages/templates/src/index.ts` (add register import)
- Modify: `packages/templates/registry.json` (add entry)

- [ ] **Step 1: Create meta.json**

```json
{
  "slug": "magazine-checklist",
  "name": "Magazine Checklist",
  "description": "Torn paper strips with animated checkmarks reveal a bullet-point list with parallax depth",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "checklist", "list", "bullets", "editorial"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 2: Create metadata.json**

```json
{
  "compositionId": "magazine-checklist",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 3: Create schema.ts**

```ts
import { z } from 'zod';

export const schema = z.object({
  items: z.array(z.object({
    text: z.string(),
    checked: z.boolean().default(true),
  })).min(2).max(6).default([
    { text: 'Ceasefire agreement signed', checked: true },
    { text: 'Humanitarian corridor opened', checked: true },
    { text: 'Sanctions package approved', checked: true },
  ]),
  title: z.string().default('Key Developments'),
});

export type MagazineChecklistProps = z.infer<typeof schema>;
export const defaultProps: MagazineChecklistProps = schema.parse({});
```

- [ ] **Step 4: Create CheckMark.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function CheckMark({
  appearFrame,
  checked,
}: {
  appearFrame: number;
  checked: boolean;
}) {
  const frame = useCurrentFrame();

  if (!checked || frame < appearFrame) return null;

  const scale = interpolate(frame, [appearFrame, appearFrame + 10], [1.4, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });
  const opacity = interpolate(frame, [appearFrame, appearFrame + 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        backgroundColor: MAGAZINE_COLORS.stamp,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${scale})`,
        opacity,
        flexShrink: 0,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M4 9L7.5 12.5L14 5.5"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
```

- [ ] **Step 5: Create ChecklistItem.tsx**

```tsx
import React from 'react';
import { random } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';
import { CheckMark } from './CheckMark';

const ITEM_W = 900;
const ITEM_H = 140;

export function ChecklistItem({
  text,
  checked,
  index,
  appearFrame,
  checkFrame,
}: {
  text: string;
  checked: boolean;
  index: number;
  appearFrame: number;
  checkFrame: number;
}) {
  const rotation = (random(`check-rot-${index}`) - 0.5) * 4;

  return (
    <div
      style={{
        width: ITEM_W,
        height: ITEM_H,
        transform: `rotate(${rotation}deg)`,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        position: 'relative',
      }}
    >
      <TornEdge
        edges={['top', 'bottom', 'left', 'right']}
        roughness={0.4}
        seed={index * 11 + 7}
        width={ITEM_W}
        height={ITEM_H}
      >
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.2 + random(`check-age-${index}`) * 0.3} seed={`check-${index}`} />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              padding: '0 32px',
              gap: 20,
              boxSizing: 'border-box',
            }}
          >
            <CheckMark appearFrame={checkFrame} checked={checked} />
            {!checked && (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: `2px solid ${MAGAZINE_COLORS.secondary}`,
                  flexShrink: 0,
                }}
              />
            )}
            <div
              style={{
                fontFamily: MAGAZINE_FONTS.body,
                fontSize: FONT_SIZES.large,
                color: MAGAZINE_COLORS.text,
                lineHeight: 1.3,
              }}
            >
              {text}
            </div>
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
import { AbsoluteFill, useCurrentFrame, interpolate, random } from 'remotion';
import type { MagazineChecklistProps } from './schema';
import { paperSlide, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark, PinMark } from '../../magazine/decorations';
import { ChecklistItem } from './components/ChecklistItem';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const TITLE_Y = 200;
const TITLE_W = 900;
const TITLE_H = 160;
const ITEM_W = 900;
const ITEM_H = 140;
const ITEM_SPACING = 180;
const ITEM_START_Y = 420;
const STAGGER = 10;
const ENTER_DURATION = 25;

const DIRECTIONS: Array<'left' | 'right'> = ['left', 'right'];
const TAPE_CORNERS: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
  'top-right', 'top-left', 'bottom-right', 'bottom-left',
];

const MagazineChecklist: React.FC<MagazineChecklistProps> = ({ items, title }) => {
  const frame = useCurrentFrame();

  // Phase 1: Title entrance
  const titleSlide = paperSlide(frame, 0, 20, 'down');

  // Phase 5: Title exit
  const titleExitOpacity = interpolate(frame, [120, 140], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const isTitleExiting = frame >= 120;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title scrap */}
      <div
        style={{
          position: 'absolute',
          left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
          top: TITLE_Y + titleSlide.translateY,
          opacity: isTitleExiting ? titleExitOpacity : titleSlide.opacity,
          filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        }}
      >
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={99} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="checklist-title" />
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, boxSizing: 'border-box',
              }}>
                <SerifHeadline text={title} size={39} />
              </div>
            </div>
          </TornEdge>
          <TapeMark corner="top-right" seed={99} />
        </div>
      </div>

      {/* Item scraps */}
      {items.map((item, i) => {
        const enterStart = 15 + i * STAGGER;
        const slide = paperSlide(frame, enterStart, ENTER_DURATION, DIRECTIONS[i % 2]);
        const landFrame = enterStart + ENTER_DURATION;
        const checkFrame = landFrame + 15;

        // Parallax (Phase 4)
        const depth = i % 3;
        const depthMul = (depth + 1) * 6;
        const parallaxX = frame >= 60 && frame <= 120
          ? Math.sin(frame * 0.02 + i * 1.5) * depthMul
          : 0;
        const parallaxY = frame >= 60 && frame <= 120
          ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.5
          : 0;

        // Exit (Phase 5)
        const exitProgress = interpolate(frame, [120, 150], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
        });
        const exitAngle = (random(`check-exit-${i}`) - 0.5) * Math.PI * 2;
        const exitX = Math.cos(exitAngle) * 1500 * exitProgress;
        const exitY = Math.sin(exitAngle) * 1500 * exitProgress;
        const exitOpacity = interpolate(frame, [120, 140], [1, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });

        const isEntering = frame < landFrame;
        const isExiting = frame >= 120;

        const offsetX = (random(`check-ox-${i}`) - 0.5) * 60;
        const baseX = (CANVAS_W - ITEM_W) / 2 + offsetX;
        const baseY = ITEM_START_Y + i * ITEM_SPACING;

        let x = baseX + parallaxX;
        let y = baseY + parallaxY;
        let opacity = 1;

        if (isEntering) {
          x += slide.translateX;
          y += slide.translateY;
          opacity = slide.opacity;
        }
        if (isExiting) {
          x += exitX;
          y += exitY;
          opacity = exitOpacity;
        }

        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, zIndex: depth }}>
            <div style={{ position: 'relative' }}>
              <ChecklistItem
                text={item.text}
                checked={item.checked ?? true}
                index={i}
                appearFrame={enterStart}
                checkFrame={checkFrame}
              />
              {random(`check-deco-${i}`) > 0.5 ? (
                <TapeMark corner={TAPE_CORNERS[i % 4]} seed={i} />
              ) : (
                <PinMark x={ITEM_W / 2} y={4} seed={i} />
              )}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineChecklist;
```

- [ ] **Step 7: Create register.ts**

```ts
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

    const ownFileNames = [
      'meta.json',
      'metadata.json',
      'schema.ts',
      'index.tsx',
      'register.ts',
      'components/ChecklistItem.tsx',
      'components/CheckMark.tsx',
    ];

    const sharedFileNames = [
      'constants.ts',
      'textures.tsx',
      'effects.tsx',
      'typography.tsx',
      'animations.ts',
      'decorations.tsx',
    ];

    const ownFiles = ownFileNames.map((f) => ({
      path: f,
      content: fs.readFileSync(path.join(dir, f), 'utf-8'),
    }));

    const sharedFiles = sharedFileNames.map((f) => ({
      path: `../../magazine/${f}`,
      content: fs.readFileSync(path.join(magazineDir, f), 'utf-8'),
    }));

    return [...ownFiles, ...sharedFiles];
  },
});
```

- [ ] **Step 8: Add to index.ts and registry.json**

In `packages/templates/src/index.ts`, add at end of register imports:
```ts
import './templates/magazine-checklist/register';
```

In `packages/templates/registry.json`, add to `items` array:
```json
{
  "name": "magazine-checklist",
  "type": "registry:component",
  "description": "Torn paper strips with animated checkmarks reveal a bullet-point list with parallax depth",
  "categories": ["overlay"],
  "tags": ["magazine-theme", "overlay", "checklist", "list", "bullets", "editorial"],
  "meta": {
    "stylePreset": "elegantEditorial",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

- [ ] **Step 9: Verify in playground**

Run playground, navigate to magazine-checklist, confirm:
- Title scrap slides in from top
- 3 item strips slide in alternating left/right with stagger
- Checkmarks pop in with scale animation
- Parallax drift between frames 60-120
- All elements scatter out at exit

- [ ] **Step 10: Commit**

```bash
git add packages/templates/src/templates/magazine-checklist/ packages/templates/src/index.ts packages/templates/registry.json
git commit -m "feat: add magazine-checklist overlay template"
```

---

### Task 2: magazine-timeline template

**Files:**
- Create: `packages/templates/src/templates/magazine-timeline/meta.json`
- Create: `packages/templates/src/templates/magazine-timeline/metadata.json`
- Create: `packages/templates/src/templates/magazine-timeline/schema.ts`
- Create: `packages/templates/src/templates/magazine-timeline/index.tsx`
- Create: `packages/templates/src/templates/magazine-timeline/register.ts`
- Create: `packages/templates/src/templates/magazine-timeline/components/TimelineThread.tsx`
- Create: `packages/templates/src/templates/magazine-timeline/components/EventCard.tsx`
- Modify: `packages/templates/src/index.ts` (add register import)
- Modify: `packages/templates/registry.json` (add entry)

- [ ] **Step 1: Create meta.json**

```json
{
  "slug": "magazine-timeline",
  "name": "Magazine Timeline",
  "description": "Historical events pinned to a vertical red thread with torn paper scraps and parallax depth",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "timeline", "history", "dates", "chronology"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 2: Create metadata.json**

```json
{
  "compositionId": "magazine-timeline",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 3: Create schema.ts**

```ts
import { z } from 'zod';

export const schema = z.object({
  events: z.array(z.object({
    year: z.string(),
    text: z.string(),
  })).min(2).max(5).default([
    { year: '2014', text: 'Crimea annexed' },
    { year: '2015', text: 'Minsk II agreement signed' },
    { year: '2022', text: 'Full-scale invasion begins' },
    { year: '2024', text: 'Peace negotiations resume' },
  ]),
  title: z.string().default('Timeline of the Conflict'),
});

export type MagazineTimelineProps = z.infer<typeof schema>;
export const defaultProps: MagazineTimelineProps = schema.parse({});
```

- [ ] **Step 4: Create TimelineThread.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function TimelineThread({
  startY,
  endY,
  nodeYPositions,
  nodeLandFrames,
}: {
  startY: number;
  endY: number;
  nodeYPositions: number[];
  nodeLandFrames: number[];
}) {
  const frame = useCurrentFrame();
  const totalHeight = endY - startY;

  // Phase 2: Thread draws downward (frames 10-30)
  const drawProgress = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });

  // Phase 5: Thread retracts upward (frames 120-140)
  const retractProgress = interpolate(frame, [120, 140], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });

  const currentHeight = totalHeight * drawProgress * (1 - retractProgress);

  return (
    <>
      {/* Thread line */}
      <div
        style={{
          position: 'absolute',
          left: 540 - 1.5,
          top: startY,
          width: 3,
          height: currentHeight,
          backgroundColor: MAGAZINE_COLORS.accent,
          borderRadius: 1.5,
        }}
      />

      {/* Node dots */}
      {nodeYPositions.map((nodeY, i) => {
        const landFrame = nodeLandFrames[i];
        const nodeScale = interpolate(frame, [landFrame, landFrame + 8], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: magazineEasing,
        });

        // Exit
        const nodeOpacity = interpolate(frame, [120, 140], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        if (frame < landFrame) return null;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 540 - 5,
              top: nodeY - 5,
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: MAGAZINE_COLORS.accent,
              transform: `scale(${nodeScale})`,
              opacity: frame >= 120 ? nodeOpacity : 1,
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
          />
        );
      })}
    </>
  );
}
```

- [ ] **Step 5: Create EventCard.tsx**

```tsx
import React from 'react';
import { random } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';

const CARD_W = 440;
const CARD_H = 200;

export function EventCard({
  year,
  text,
  index,
}: {
  year: string;
  text: string;
  index: number;
}) {
  const rotation = (random(`event-rot-${index}`) - 0.5) * 6;

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        transform: `rotate(${rotation}deg)`,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        position: 'relative',
      }}
    >
      <TornEdge
        edges={['top', 'bottom', 'left', 'right']}
        roughness={0.5}
        seed={index * 13 + 5}
        width={CARD_W}
        height={CARD_H}
      >
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.25 + random(`event-age-${index}`) * 0.35} seed={`event-${index}`} />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: 24,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontFamily: MAGAZINE_FONTS.headline,
                fontSize: FONT_SIZES.h1,
                fontWeight: 900,
                color: MAGAZINE_COLORS.stamp,
                lineHeight: 1.0,
                letterSpacing: '-0.02em',
              }}
            >
              {year}
            </div>
            <div
              style={{
                fontFamily: MAGAZINE_FONTS.body,
                fontSize: FONT_SIZES.large,
                color: MAGAZINE_COLORS.text,
                lineHeight: 1.3,
                marginTop: 8,
              }}
            >
              {text}
            </div>
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
import { AbsoluteFill, useCurrentFrame, interpolate, random } from 'remotion';
import type { MagazineTimelineProps } from './schema';
import { paperSlide, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark } from '../../magazine/decorations';
import { TimelineThread } from './components/TimelineThread';
import { EventCard } from './components/EventCard';

const CANVAS_W = 1080;
const TITLE_Y = 120;
const TITLE_W = 800;
const TITLE_H = 140;
const CARD_W = 440;
const CARD_H = 200;
const FIRST_EVENT_Y = 360;
const EVENT_SPACING = 320;
const STAGGER = 14;
const ENTER_DURATION = 25;

const MagazineTimeline: React.FC<MagazineTimelineProps> = ({ events, title }) => {
  const frame = useCurrentFrame();

  const eventYPositions = events.map((_, i) => FIRST_EVENT_Y + i * EVENT_SPACING);
  const threadStartY = FIRST_EVENT_Y - 40;
  const threadEndY = eventYPositions[events.length - 1] + CARD_H + 40;

  // Title
  const titleSlide = paperSlide(frame, 0, 15, 'down');
  const titleExitOpacity = interpolate(frame, [120, 140], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const isTitleExiting = frame >= 120;

  // Node land frames (when each event card finishes entering)
  const nodeLandFrames = events.map((_, i) => 20 + i * STAGGER + ENTER_DURATION);
  // Node Y positions (center of each card)
  const nodeYPositions = eventYPositions.map((y) => y + CARD_H / 2);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
          top: TITLE_Y + titleSlide.translateY,
          opacity: isTitleExiting ? titleExitOpacity : titleSlide.opacity,
          filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        }}
      >
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={77} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="timeline-title" />
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, boxSizing: 'border-box',
              }}>
                <SerifHeadline text={title} size={39} />
              </div>
            </div>
          </TornEdge>
          <TapeMark corner="top-left" seed={77} />
        </div>
      </div>

      {/* Thread */}
      <TimelineThread
        startY={threadStartY}
        endY={threadEndY}
        nodeYPositions={nodeYPositions}
        nodeLandFrames={nodeLandFrames}
      />

      {/* Event cards */}
      {events.map((event, i) => {
        const isLeft = i % 2 === 0;
        const enterStart = 20 + i * STAGGER;
        const slide = paperSlide(frame, enterStart, ENTER_DURATION, isLeft ? 'left' : 'right');
        const landFrame = enterStart + ENTER_DURATION;

        // Parallax
        const depth = i % 3;
        const depthMul = (depth + 1) * 6;
        const parallaxX = frame >= 70 && frame <= 120
          ? Math.sin(frame * 0.02 + i * 1.5) * depthMul
          : 0;
        const parallaxY = frame >= 70 && frame <= 120
          ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.5
          : 0;

        // Exit
        const exitProgress = interpolate(frame, [120, 150], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
        });
        const exitAngle = isLeft ? Math.PI : 0; // exit to their own side
        const exitX = Math.cos(exitAngle) * 1500 * exitProgress;
        const exitY = (random(`tl-exit-y-${i}`) - 0.5) * 400 * exitProgress;
        const exitOpacity = interpolate(frame, [120, 140], [1, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });

        const isEntering = frame < landFrame;
        const isExiting = frame >= 120;

        // Position: left cards to left of center, right cards to right
        const baseX = isLeft ? 540 - CARD_W - 30 : 540 + 30;
        const baseY = eventYPositions[i];

        let x = baseX + parallaxX;
        let y = baseY + parallaxY;
        let opacity = 1;

        if (isEntering) {
          x += slide.translateX;
          y += slide.translateY;
          opacity = slide.opacity;
        }
        if (isExiting) {
          x += exitX;
          y += exitY;
          opacity = exitOpacity;
        }

        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, zIndex: depth + 1 }}>
            <EventCard year={event.year} text={event.text} index={i} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineTimeline;
```

- [ ] **Step 7: Create register.ts**

Same pattern as Task 1 register.ts but with:
- `ownFileNames`: `['meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts', 'components/TimelineThread.tsx', 'components/EventCard.tsx']`
- Same `sharedFileNames` (all 6 shared modules including `decorations.tsx`)

- [ ] **Step 8: Add to index.ts and registry.json**

In `packages/templates/src/index.ts`:
```ts
import './templates/magazine-timeline/register';
```

In `packages/templates/registry.json`:
```json
{
  "name": "magazine-timeline",
  "type": "registry:component",
  "description": "Historical events pinned to a vertical red thread with torn paper scraps and parallax depth",
  "categories": ["overlay"],
  "tags": ["magazine-theme", "overlay", "timeline", "history", "dates", "chronology"],
  "meta": {
    "stylePreset": "elegantEditorial",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

- [ ] **Step 9: Verify in playground**

Confirm: title enters, red thread draws down, 4 event cards alternate left/right with node dots, parallax drift, thread retracts on exit.

- [ ] **Step 10: Commit**

```bash
git add packages/templates/src/templates/magazine-timeline/ packages/templates/src/index.ts packages/templates/registry.json
git commit -m "feat: add magazine-timeline overlay template"
```

---

### Task 3: magazine-stats template

**Files:**
- Create: `packages/templates/src/templates/magazine-stats/meta.json`
- Create: `packages/templates/src/templates/magazine-stats/metadata.json`
- Create: `packages/templates/src/templates/magazine-stats/schema.ts`
- Create: `packages/templates/src/templates/magazine-stats/index.tsx`
- Create: `packages/templates/src/templates/magazine-stats/register.ts`
- Create: `packages/templates/src/templates/magazine-stats/components/StatCard.tsx`
- Create: `packages/templates/src/templates/magazine-stats/components/CountUp.tsx`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create meta.json**

```json
{
  "slug": "magazine-stats",
  "name": "Magazine Stats",
  "description": "Bold statistics on scattered paper scraps with animated count-up numbers and parallax depth",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "stats", "numbers", "data", "metrics"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 2: Create metadata.json**

```json
{
  "compositionId": "magazine-stats",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 3: Create schema.ts**

```ts
import { z } from 'zod';

export const schema = z.object({
  stats: z.array(z.object({
    value: z.string(),
    label: z.string(),
    unit: z.string().optional(),
  })).min(2).max(6).default([
    { value: '44.1M', label: 'Population' },
    { value: '$200B', label: 'GDP' },
    { value: '603,628', label: 'Area (km²)' },
    { value: '24', label: 'Regions' },
  ]),
  title: z.string().default('Ukraine at a Glance'),
});

export type MagazineStatsProps = z.infer<typeof schema>;
export const defaultProps: MagazineStatsProps = schema.parse({});
```

- [ ] **Step 4: Create CountUp.tsx**

```tsx
import { interpolate } from 'remotion';

interface ParsedValue {
  prefix: string;
  number: number;
  suffix: string;
  decimals: number;
  commaFormatted: boolean;
  isNumeric: boolean;
}

export function parseValue(raw: string): ParsedValue {
  // Try to extract a numeric portion: optional prefix ($, €), digits with optional commas and decimals, optional suffix (M, B, %, km²)
  const match = raw.match(/^([^0-9]*?)([\d,]+\.?\d*)(.*?)$/);
  if (!match) {
    return { prefix: '', number: 0, suffix: '', decimals: 0, commaFormatted: false, isNumeric: false };
  }
  const prefix = match[1];
  const numStr = match[2];
  const suffix = match[3];
  const commaFormatted = numStr.includes(',');
  const cleaned = numStr.replace(/,/g, '');
  const number = parseFloat(cleaned);
  const decimalPart = cleaned.split('.')[1];
  const decimals = decimalPart ? decimalPart.length : 0;

  return { prefix, number, suffix, decimals, commaFormatted, isNumeric: true };
}

export function formatAnimatedValue(
  frame: number,
  startFrame: number,
  duration: number,
  parsed: ParsedValue,
  rawValue: string,
): string {
  if (!parsed.isNumeric) return rawValue;

  const progress = interpolate(frame, [startFrame, startFrame + duration], [0, parsed.number], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  let formatted: string;
  if (parsed.decimals > 0) {
    formatted = progress.toFixed(parsed.decimals);
  } else if (parsed.commaFormatted) {
    formatted = Math.round(progress).toLocaleString('en-US');
  } else {
    formatted = Math.round(progress).toString();
  }

  return `${parsed.prefix}${formatted}${parsed.suffix}`;
}
```

- [ ] **Step 5: Create StatCard.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, random } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';
import { parseValue, formatAnimatedValue } from './CountUp';

export function StatCard({
  value,
  label,
  index,
  countUpStart,
  width,
  height,
}: {
  value: string;
  label: string;
  index: number;
  countUpStart: number;
  width: number;
  height: number;
}) {
  const frame = useCurrentFrame();
  const rotation = (random(`stat-rot-${index}`) - 0.5) * 8;
  const parsed = parseValue(value);
  const displayValue = formatAnimatedValue(frame, countUpStart, 20, parsed, value);
  const valueColor = index % 2 === 0 ? MAGAZINE_COLORS.text : MAGAZINE_COLORS.stamp;

  return (
    <div
      style={{
        width,
        height,
        transform: `rotate(${rotation}deg)`,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        position: 'relative',
      }}
    >
      <TornEdge
        edges={['top', 'bottom', 'left', 'right']}
        roughness={0.5}
        seed={index * 9 + 2}
        width={width}
        height={height}
      >
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.2 + random(`stat-age-${index}`) * 0.3} seed={`stat-${index}`} />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontFamily: MAGAZINE_FONTS.headline,
                fontSize: FONT_SIZES.hero,
                fontWeight: 900,
                color: valueColor,
                lineHeight: 1.0,
                letterSpacing: '-0.02em',
                textAlign: 'center',
              }}
            >
              {displayValue}
            </div>
            <div
              style={{
                fontFamily: MAGAZINE_FONTS.accent,
                fontSize: FONT_SIZES.small,
                fontWeight: 700,
                color: MAGAZINE_COLORS.secondary,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              {label}
            </div>
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
import { AbsoluteFill, useCurrentFrame, interpolate, random } from 'remotion';
import type { MagazineStatsProps } from './schema';
import { paperSlide, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark, PinMark } from '../../magazine/decorations';
import { StatCard } from './components/StatCard';
import { parseValue } from './components/CountUp';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const TITLE_Y = 150;
const TITLE_W = 800;
const TITLE_H = 140;
const STAT_W = 460;
const STAT_H = 280;
const FIRST_STAT_W = 500;
const FIRST_STAT_H = 320;
const COLS = 2;
const ROWS = 3;
const CELL_W = CANVAS_W / COLS;
const CELL_H = CANVAS_H / ROWS;
const STAGGER = 10;
const ENTER_DURATION = 25;

const DIRECTIONS: Array<'left' | 'right' | 'up' | 'down'> = ['left', 'right', 'up', 'down'];
const TAPE_CORNERS: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
  'top-right', 'top-left', 'bottom-right', 'bottom-left',
];

// 2-column scattered grid (same cell logic as magazine-collage)
const CELL_SLOTS: Array<[number, number]> = [
  [0, 0], // top-left
  [1, 0], // top-right
  [0, 2], // bottom-left
  [1, 2], // bottom-right
  [0, 1], // mid-left
  [1, 1], // mid-right
];

function getStatPosition(index: number, w: number, h: number): { x: number; y: number } {
  const slot = CELL_SLOTS[index % CELL_SLOTS.length];
  const baseX = slot[0] * CELL_W + (CELL_W - w) / 2;
  const baseY = slot[1] * CELL_H + (CELL_H - h) / 2;
  const offsetX = (random(`stat-ox-${index}`) - 0.5) * 60;
  const offsetY = (random(`stat-oy-${index}`) - 0.5) * 60;
  return { x: baseX + offsetX, y: baseY + offsetY };
}

const MagazineStats: React.FC<MagazineStatsProps> = ({ stats, title }) => {
  const frame = useCurrentFrame();

  // Title entrance (Phase 1)
  const titleSlide = paperSlide(frame, 0, 15, 'up');
  const titleExitOpacity = interpolate(frame, [120, 140], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const isTitleExiting = frame >= 120;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
          top: TITLE_Y + titleSlide.translateY,
          opacity: isTitleExiting ? titleExitOpacity : titleSlide.opacity,
          filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        }}
      >
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={88} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="stats-title" />
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, boxSizing: 'border-box',
              }}>
                <SerifHeadline text={title} size={39} />
              </div>
            </div>
          </TornEdge>
          <TapeMark corner="top-left" seed={88} />
        </div>
      </div>

      {/* Stat scraps */}
      {stats.map((stat, i) => {
        const isFirst = i === 0;
        const w = isFirst ? FIRST_STAT_W : STAT_W;
        const h = isFirst ? FIRST_STAT_H : STAT_H;
        const pos = getStatPosition(i, w, h);
        const depth = i % 3;
        const depthMul = (depth + 1) * 8;

        const enterStart = 10 + i * STAGGER;
        const direction = DIRECTIONS[i % DIRECTIONS.length];
        // Note: paperSlide returns rotation but we discard it — per convention, each element has its own deterministic rotation
        const slide = paperSlide(frame, enterStart, ENTER_DURATION, direction);
        const landFrame = enterStart + ENTER_DURATION;
        const countUpStart = landFrame + 10;

        // Parallax (Phase 4)
        const parallaxX = frame >= 60 && frame <= 120
          ? Math.sin(frame * 0.02 + i * 1.5) * depthMul
          : 0;
        const parallaxY = frame >= 60 && frame <= 120
          ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.6
          : 0;

        // Exit (Phase 5)
        const exitProgress = interpolate(frame, [120, 150], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
        });
        const exitAngle = (random(`stat-exit-${i}`) - 0.5) * Math.PI * 2;
        const exitX = Math.cos(exitAngle) * 1500 * exitProgress;
        const exitY = Math.sin(exitAngle) * 1500 * exitProgress;
        const exitOpacity = interpolate(frame, [120, 140], [1, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });

        const isEntering = frame < landFrame;
        const isExiting = frame >= 120;

        let x = pos.x + parallaxX;
        let y = pos.y + parallaxY;
        let opacity = 1;

        if (isEntering) {
          x += slide.translateX;
          y += slide.translateY;
          opacity = slide.opacity;
        }
        if (isExiting) {
          x += exitX;
          y += exitY;
          opacity = exitOpacity;
        }

        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, zIndex: depth }}>
            <div style={{ position: 'relative' }}>
              <StatCard
                value={stat.value}
                label={stat.label}
                index={i}
                countUpStart={countUpStart}
                width={w}
                height={h}
              />
              {random(`stat-deco-${i}`) > 0.5 ? (
                <TapeMark corner={TAPE_CORNERS[i % 4]} seed={i + 50} />
              ) : (
                <PinMark x={w / 2} y={4} seed={i + 50} />
              )}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineStats;
```

- [ ] **Step 7: Create register.ts**

Copy the full `register.ts` from Task 1 Step 7, replacing only `ownFileNames`:
```ts
const ownFileNames = [
  'meta.json',
  'metadata.json',
  'schema.ts',
  'index.tsx',
  'register.ts',
  'components/StatCard.tsx',
  'components/CountUp.tsx',
];
```
Keep the same `sharedFileNames` (all 6 shared modules including `decorations.tsx`).

- [ ] **Step 8: Add to index.ts and registry.json**

```ts
import './templates/magazine-stats/register';
```

```json
{
  "name": "magazine-stats",
  "type": "registry:component",
  "description": "Bold statistics on scattered paper scraps with animated count-up numbers and parallax depth",
  "categories": ["overlay"],
  "tags": ["magazine-theme", "overlay", "stats", "numbers", "data", "metrics"],
  "meta": {
    "stylePreset": "elegantEditorial",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

- [ ] **Step 9: Verify in playground**

Confirm: title enters, 4 stat scraps enter from mixed directions, numbers count up, parallax, scatter exit.

- [ ] **Step 10: Commit**

```bash
git add packages/templates/src/templates/magazine-stats/ packages/templates/src/index.ts packages/templates/registry.json
git commit -m "feat: add magazine-stats overlay template"
```

---

### Task 4: magazine-comparison template

**Files:**
- Create: `packages/templates/src/templates/magazine-comparison/meta.json`
- Create: `packages/templates/src/templates/magazine-comparison/metadata.json`
- Create: `packages/templates/src/templates/magazine-comparison/schema.ts`
- Create: `packages/templates/src/templates/magazine-comparison/index.tsx`
- Create: `packages/templates/src/templates/magazine-comparison/register.ts`
- Create: `packages/templates/src/templates/magazine-comparison/components/ComparisonHeader.tsx`
- Create: `packages/templates/src/templates/magazine-comparison/components/ComparisonRow.tsx`
- Create: `packages/templates/src/templates/magazine-comparison/components/CenterDivider.tsx`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create meta.json**

```json
{
  "slug": "magazine-comparison",
  "name": "Magazine Comparison",
  "description": "Side-by-side torn paper scraps comparing two subjects with a red center divider and parallax push-pull",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "comparison", "versus", "side-by-side", "editorial"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 2: Create metadata.json**

```json
{
  "compositionId": "magazine-comparison",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 3: Create schema.ts**

```ts
import { z } from 'zod';

export const schema = z.object({
  leftLabel: z.string().default('NATO'),
  rightLabel: z.string().default('BRICS'),
  items: z.array(z.object({
    category: z.string(),
    left: z.string(),
    right: z.string(),
  })).min(2).max(5).default([
    { category: 'Members', left: '32 nations', right: '10 nations' },
    { category: 'GDP Share', left: '~45% of world', right: '~35% of world' },
    { category: 'Military', left: '3.5M active', right: '5.2M active' },
  ]),
});

export type MagazineComparisonProps = z.infer<typeof schema>;
export const defaultProps: MagazineComparisonProps = schema.parse({});
```

- [ ] **Step 4: Create CenterDivider.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function CenterDivider({
  startY,
  endY,
}: {
  startY: number;
  endY: number;
}) {
  const frame = useCurrentFrame();
  const totalHeight = endY - startY;

  const drawProgress = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });

  const retractProgress = interpolate(frame, [120, 145], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });

  const currentHeight = totalHeight * drawProgress * (1 - retractProgress);

  return (
    <div
      style={{
        position: 'absolute',
        left: 540 - 1.5,
        top: startY,
        width: 3,
        height: currentHeight,
        backgroundColor: MAGAZINE_COLORS.accent,
        borderRadius: 1.5,
        opacity: 0.6,
      }}
    />
  );
}
```

- [ ] **Step 5: Create ComparisonHeader.tsx**

```tsx
import React from 'react';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';

const HEADER_W = 960;
const HEADER_H = 140;

export function ComparisonHeader({
  leftLabel,
  rightLabel,
}: {
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div
      style={{
        width: HEADER_W,
        height: HEADER_H,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        position: 'relative',
      }}
    >
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={55} width={HEADER_W} height={HEADER_H}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.15} seed="comp-header" />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              padding: '0 40px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{
              flex: 1,
              fontFamily: MAGAZINE_FONTS.headline,
              fontSize: FONT_SIZES.h2,
              fontWeight: 700,
              color: MAGAZINE_COLORS.text,
              letterSpacing: '-0.02em',
            }}>
              {leftLabel}
            </div>
            {/* Center red divider */}
            <div style={{
              width: 3,
              height: '60%',
              backgroundColor: MAGAZINE_COLORS.accent,
              borderRadius: 1.5,
              flexShrink: 0,
              margin: '0 20px',
            }} />
            <div style={{
              flex: 1,
              fontFamily: MAGAZINE_FONTS.headline,
              fontSize: FONT_SIZES.h2,
              fontWeight: 700,
              color: MAGAZINE_COLORS.text,
              letterSpacing: '-0.02em',
              textAlign: 'right',
            }}>
              {rightLabel}
            </div>
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
```

- [ ] **Step 6: Create ComparisonRow.tsx**

```tsx
import React from 'react';
import { random } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';

const ROW_W = 460;
const ROW_H = 180;

export function ComparisonRow({
  text,
  side,
  index,
}: {
  text: string;
  side: 'left' | 'right';
  index: number;
}) {
  const seedBase = side === 'left' ? index * 2 : index * 2 + 1;
  const rotation = (random(`comp-rot-${seedBase}`) - 0.5) * 4;

  return (
    <div
      style={{
        width: ROW_W,
        height: ROW_H,
        transform: `rotate(${rotation}deg)`,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        position: 'relative',
      }}
    >
      <TornEdge
        edges={['top', 'bottom', 'left', 'right']}
        roughness={0.4}
        seed={seedBase * 7 + 11}
        width={ROW_W}
        height={ROW_H}
      >
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.2 + random(`comp-age-${seedBase}`) * 0.3} seed={`comp-${seedBase}`} />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontFamily: MAGAZINE_FONTS.body,
                fontSize: FONT_SIZES.h3,
                fontWeight: 700,
                color: MAGAZINE_COLORS.text,
                lineHeight: 1.3,
                textAlign: 'center',
              }}
            >
              {text}
            </div>
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
```

- [ ] **Step 7: Create index.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, random } from 'remotion';
import type { MagazineComparisonProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { SectionLabel } from '../../magazine/typography';
import { TapeMark } from '../../magazine/decorations';
import { ComparisonHeader } from './components/ComparisonHeader';
import { ComparisonRow } from './components/ComparisonRow';
import { CenterDivider } from './components/CenterDivider';

const CANVAS_W = 1080;
const HEADER_Y = 140;
const HEADER_W = 960;
const FIRST_ROW_Y = 400;
const ROW_SPACING = 300;
const LEFT_X = 40;
const RIGHT_X = 580;
const ROW_STAGGER = 12;
const ENTER_DURATION = 25;
const LABEL_W = 200;

const MagazineComparison: React.FC<MagazineComparisonProps> = ({ leftLabel, rightLabel, items }) => {
  const frame = useCurrentFrame();

  // Header entrance (Phase 1)
  const headerSlide = paperSlide(frame, 0, 20, 'down');
  const headerExitOpacity = interpolate(frame, [120, 140], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const isHeaderExiting = frame >= 120;

  // Divider Y range
  const lastRowY = FIRST_ROW_Y + (items.length - 1) * ROW_SPACING;
  const dividerStartY = HEADER_Y + 160;
  const dividerEndY = lastRowY + 200;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          left: (CANVAS_W - HEADER_W) / 2 + headerSlide.translateX,
          top: HEADER_Y + headerSlide.translateY,
          opacity: isHeaderExiting ? headerExitOpacity : headerSlide.opacity,
        }}
      >
        <div style={{ position: 'relative' }}>
          <ComparisonHeader leftLabel={leftLabel} rightLabel={rightLabel} />
          <TapeMark corner="top-right" seed={55} />
        </div>
      </div>

      {/* Center divider */}
      <CenterDivider startY={dividerStartY} endY={dividerEndY} />

      {/* Row pairs */}
      {items.map((item, i) => {
        const enterStart = 15 + i * ROW_STAGGER;
        const leftSlide = paperSlide(frame, enterStart, ENTER_DURATION, 'left');
        const rightSlide = paperSlide(frame, enterStart, ENTER_DURATION, 'right');
        const landFrame = enterStart + ENTER_DURATION;

        // Category label (editorialReveal, appears when row lands)
        const labelReveal = editorialReveal(frame, landFrame, 12);

        // Parallax (Phase 3) — opposing directions
        const depth = i % 3;
        const depthMul = (depth + 1) * 5;
        const parallaxBase = frame >= 60 && frame <= 120
          ? Math.sin(frame * 0.02 + i * 1.5) * depthMul
          : 0;
        // Left drifts left (negative), right drifts right (positive)
        const leftParallaxX = -parallaxBase;
        const rightParallaxX = parallaxBase;
        const parallaxY = frame >= 60 && frame <= 120
          ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.4
          : 0;

        // Exit (Phase 4) — left exits left, right exits right
        const exitProgress = interpolate(frame, [120, 150], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
        });
        const exitOpacity = interpolate(frame, [120, 140], [1, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });

        const isEntering = frame < landFrame;
        const isExiting = frame >= 120;

        const rowY = FIRST_ROW_Y + i * ROW_SPACING;

        // Left scrap position
        let lx = LEFT_X + leftParallaxX;
        let ly = rowY + parallaxY;
        let lOpacity = 1;
        if (isEntering) { lx += leftSlide.translateX; ly += leftSlide.translateY; lOpacity = leftSlide.opacity; }
        if (isExiting) { lx += -1500 * exitProgress; lOpacity = exitOpacity; }

        // Right scrap position
        let rx = RIGHT_X + rightParallaxX;
        let ry = rowY + parallaxY;
        let rOpacity = 1;
        if (isEntering) { rx += rightSlide.translateX; ry += rightSlide.translateY; rOpacity = rightSlide.opacity; }
        if (isExiting) { rx += 1500 * exitProgress; rOpacity = exitOpacity; }

        return (
          <React.Fragment key={i}>
            {/* Category label centered between rows (above each row pair) */}
            <div
              style={{
                position: 'absolute',
                left: (CANVAS_W - LABEL_W) / 2,
                top: rowY - 35,
                width: LABEL_W,
                opacity: labelReveal.opacity * (isExiting ? exitOpacity : 1),
                transform: `translateY(${labelReveal.translateY}px)`,
                zIndex: 5,
              }}
            >
              <SectionLabel label={item.category} />
            </div>

            {/* Left scrap */}
            <div style={{ position: 'absolute', left: lx, top: ly, opacity: lOpacity, zIndex: depth }}>
              <ComparisonRow text={item.left} side="left" index={i} />
            </div>

            {/* Right scrap */}
            <div style={{ position: 'absolute', left: rx, top: ry, opacity: rOpacity, zIndex: depth }}>
              <ComparisonRow text={item.right} side="right" index={i} />
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineComparison;
```

- [ ] **Step 8: Create register.ts**

Copy the full `register.ts` from Task 1 Step 7, replacing only `ownFileNames`:
```ts
const ownFileNames = [
  'meta.json',
  'metadata.json',
  'schema.ts',
  'index.tsx',
  'register.ts',
  'components/ComparisonHeader.tsx',
  'components/ComparisonRow.tsx',
  'components/CenterDivider.tsx',
];
```
Keep the same `sharedFileNames` (all 6 shared modules including `decorations.tsx`).

- [ ] **Step 9: Add to index.ts and registry.json**

```ts
import './templates/magazine-comparison/register';
```

```json
{
  "name": "magazine-comparison",
  "type": "registry:component",
  "description": "Side-by-side torn paper scraps comparing two subjects with a red center divider and parallax push-pull",
  "categories": ["overlay"],
  "tags": ["magazine-theme", "overlay", "comparison", "versus", "side-by-side", "editorial"],
  "meta": {
    "stylePreset": "elegantEditorial",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

- [ ] **Step 10: Verify in playground and commit**

```bash
git add packages/templates/src/templates/magazine-comparison/ packages/templates/src/index.ts packages/templates/registry.json
git commit -m "feat: add magazine-comparison overlay template"
```

---

### Task 5: magazine-factfile template

**Files:**
- Create: `packages/templates/src/templates/magazine-factfile/meta.json`
- Create: `packages/templates/src/templates/magazine-factfile/metadata.json`
- Create: `packages/templates/src/templates/magazine-factfile/schema.ts`
- Create: `packages/templates/src/templates/magazine-factfile/index.tsx`
- Create: `packages/templates/src/templates/magazine-factfile/register.ts`
- Create: `packages/templates/src/templates/magazine-factfile/components/DossierCard.tsx`
- Create: `packages/templates/src/templates/magazine-factfile/components/FieldRow.tsx`
- Create: `packages/templates/src/templates/magazine-factfile/components/PaperClip.tsx`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create meta.json**

```json
{
  "slug": "magazine-factfile",
  "name": "Magazine Fact File",
  "description": "Dossier-style torn paper card with key-value fields revealing line by line, paperclip decoration",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "factfile", "profile", "dossier", "data"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **Step 2: Create metadata.json**

```json
{
  "compositionId": "magazine-factfile",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 3: Create schema.ts**

```ts
import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Ukraine'),
  subtitle: z.string().default('Country Profile'),
  fields: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })).min(3).max(8).default([
    { key: 'Capital', value: 'Kyiv' },
    { key: 'Population', value: '44.1 million' },
    { key: 'Language', value: 'Ukrainian' },
    { key: 'Currency', value: 'Hryvnia (UAH)' },
    { key: 'Government', value: 'Unitary semi-presidential republic' },
    { key: 'Leader', value: 'Volodymyr Zelenskyy' },
  ]),
});

export type MagazineFactfileProps = z.infer<typeof schema>;
export const defaultProps: MagazineFactfileProps = schema.parse({});
```

- [ ] **Step 4: Create PaperClip.tsx**

```tsx
import React from 'react';

export function PaperClip() {
  return (
    <div
      style={{
        position: 'absolute',
        top: -20,
        right: 30,
        transform: 'rotate(15deg)',
        pointerEvents: 'none',
        zIndex: 12,
      }}
    >
      {/* Outer loop */}
      <div
        style={{
          width: 40,
          height: 90,
          border: '2.5px solid #999',
          borderRadius: 8,
          position: 'relative',
          background: 'transparent',
        }}
      >
        {/* Inner loop */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 5,
            width: 30,
            height: 50,
            border: '2.5px solid #aaa',
            borderRadius: 6,
            borderTop: 'none',
            background: 'transparent',
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create FieldRow.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function FieldRow({
  fieldKey,
  value,
  index,
  revealFrame,
  width,
}: {
  fieldKey: string;
  value: string;
  index: number;
  revealFrame: number;
  width: number;
}) {
  const frame = useCurrentFrame();

  // Key fades in first
  const keyOpacity = interpolate(frame, [revealFrame, revealFrame + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });

  // Value slides in 4 frames after key
  const valueStart = revealFrame + 4;
  const valueOpacity = interpolate(frame, [valueStart, valueStart + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });
  const valueTranslateX = interpolate(frame, [valueStart, valueStart + 10], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          width,
          padding: '12px 0',
        }}
      >
        <div
          style={{
            fontFamily: MAGAZINE_FONTS.accent,
            fontSize: FONT_SIZES.small,
            fontWeight: 700,
            color: MAGAZINE_COLORS.secondary,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: keyOpacity,
          }}
        >
          {fieldKey}
        </div>
        <div
          style={{
            fontFamily: MAGAZINE_FONTS.body,
            fontSize: FONT_SIZES.large,
            fontWeight: 700,
            color: MAGAZINE_COLORS.text,
            opacity: valueOpacity,
            transform: `translateX(${valueTranslateX}px)`,
            textAlign: 'right',
            maxWidth: '60%',
          }}
        >
          {value}
        </div>
      </div>
      {/* Hairline separator */}
      <div
        style={{
          width: '100%',
          height: 1,
          backgroundColor: MAGAZINE_COLORS.secondary,
          opacity: 0.15,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 6: Create DossierCard.tsx**

```tsx
import React from 'react';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';
import { PaperClip } from './PaperClip';

const CARD_W = 940;
const CARD_H = 1400;

export function DossierCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        transform: 'rotate(1.5deg)',
        filter: 'drop-shadow(0 6px 30px rgba(0,0,0,0.5))',
        position: 'relative',
      }}
    >
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.6} seed={333} width={CARD_W} height={CARD_H}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.2} seed="dossier" />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              height: '100%',
              padding: '60px 50px',
              boxSizing: 'border-box',
            }}
          >
            {children}
          </div>
        </div>
      </TornEdge>
      <PaperClip />
    </div>
  );
}
```

- [ ] **Step 7: Create index.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineFactfileProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { SerifHeadline } from '../../magazine/typography';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_COLORS } from '../../magazine/constants';
import { DossierCard } from './components/DossierCard';
import { FieldRow } from './components/FieldRow';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1400;

const MagazineFactfile: React.FC<MagazineFactfileProps> = ({ title, subtitle, fields }) => {
  const frame = useCurrentFrame();

  // Phase 1: Card entrance (0-25)
  const cardSlide = paperSlide(frame, 0, 25, 'up');

  // Phase 5: Card exit (120-150) — reverse slide down
  const exitTranslateY = interpolate(frame, [120, 150], [0, 2000], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });
  const exitOpacity = interpolate(frame, [120, 145], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isExiting = frame >= 120;

  // Phase 4: Parallax sway (70-120)
  const parallaxX = frame >= 70 && frame <= 120
    ? Math.sin(frame * 0.015) * 4
    : 0;
  const parallaxY = frame >= 70 && frame <= 120
    ? Math.sin(frame * 0.02 + 1.0) * 3
    : 0;

  // Phase 2: Title + subtitle reveal (20-40)
  const titleReveal = editorialReveal(frame, 20, 20);
  const subtitleReveal = editorialReveal(frame, 28, 15);

  // Card position
  const cardX = (CANVAS_W - CARD_W) / 2 + parallaxX + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + parallaxY + cardSlide.translateY + (isExiting ? exitTranslateY : 0);
  const cardOpacity = isExiting ? exitOpacity : cardSlide.opacity;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div
        style={{
          position: 'absolute',
          left: cardX,
          top: cardY,
          opacity: cardOpacity,
        }}
      >
        <DossierCard>
          {/* Title */}
          <div style={{ opacity: titleReveal.opacity, transform: `translateY(${titleReveal.translateY}px)` }}>
            <SerifHeadline text={title} size={76} showRule />
          </div>

          {/* Subtitle */}
          <div style={{ marginTop: 16, opacity: subtitleReveal.opacity, transform: `translateY(${subtitleReveal.translateY}px)` }}>
            <SectionLabel label={subtitle} />
          </div>

          {/* Fields */}
          <div style={{ marginTop: 40 }}>
            {fields.map((field, i) => (
              <FieldRow
                key={i}
                fieldKey={field.key}
                value={field.value}
                index={i}
                revealFrame={35 + i * 8}
                width={CARD_W - 100}
              />
            ))}
          </div>
        </DossierCard>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineFactfile;
```

- [ ] **Step 8: Create register.ts**

`ownFileNames`: `['meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts', 'components/DossierCard.tsx', 'components/FieldRow.tsx', 'components/PaperClip.tsx']`

- [ ] **Step 9: Add to index.ts and registry.json**

```ts
import './templates/magazine-factfile/register';
```

```json
{
  "name": "magazine-factfile",
  "type": "registry:component",
  "description": "Dossier-style torn paper card with key-value fields revealing line by line, paperclip decoration",
  "categories": ["overlay"],
  "tags": ["magazine-theme", "overlay", "factfile", "profile", "dossier", "data"],
  "meta": {
    "stylePreset": "elegantEditorial",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

- [ ] **Step 10: Verify in playground and commit**

```bash
git add packages/templates/src/templates/magazine-factfile/ packages/templates/src/index.ts packages/templates/registry.json
git commit -m "feat: add magazine-factfile overlay template"
```

---

### Task 6: Final verification and cleanup

- [ ] **Step 1: Run TypeScript type check**

```bash
cd packages/templates && npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 2: Verify all 5 templates render in playground**

Open playground, cycle through all 5 new templates:
1. magazine-checklist — items with checkmarks
2. magazine-timeline — events on red thread
3. magazine-stats — numbers counting up
4. magazine-comparison — left/right columns
5. magazine-factfile — dossier card with fields

- [ ] **Step 3: Verify registry.json is valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('packages/templates/registry.json', 'utf-8')); console.log('valid')"
```

- [ ] **Step 4: Commit any fixes**

```bash
git add packages/templates/ && git commit -m "fix: address type errors and cleanup for magazine info overlays"
```
