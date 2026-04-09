# Plan 3: Vox Templates — Batch 1 (Text & Statement + Data)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first 12 vox templates covering Text & Statement (6) and Data & Numbers (6). These are the bread-and-butter scenes that appear in nearly every Vox video.

**Architecture:** Each template follows the established pattern: `meta.json`, `metadata.json`, `schema.ts`, `index.tsx`, `register.ts`. All import from `../../vox/` shared library. Registry entries added to `packages/templates/registry.json` and imports to `packages/templates/src/index.ts`.

**Tech Stack:** React, Remotion, Zod, vox shared library

**Spec reference:** `docs/superpowers/specs/2026-04-09-vox-theme-research.md` Part IV

**Prerequisite:** Plan 2 (shared library) must be completed first.

---

## Template Pattern Reference

Every template in this batch follows the same file structure. To avoid repeating boilerplate, here is the pattern once. Each task shows only the UNIQUE content (schema, component, meta).

### Standard `register.ts` pattern for vox templates:

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
    const voxDir = path.join(dir, '../../vox');

    const ownFileNames = [
      'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts',
    ];
    const sharedFileNames = [
      'constants.ts', 'textures.tsx', 'effects.tsx', 'typography.tsx',
      'animations.ts', 'decorations.tsx',
    ];

    const ownFiles = ownFileNames.map((f) => ({
      path: f,
      content: fs.readFileSync(path.join(dir, f), 'utf-8'),
    }));
    const sharedFiles = sharedFileNames.map((f) => ({
      path: `../../vox/${f}`,
      content: fs.readFileSync(path.join(voxDir, f), 'utf-8'),
    }));
    return [...ownFiles, ...sharedFiles];
  },
});
```

### Standard `metadata.json`:
```json
{
  "compositionId": "vox-{slug}",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

---

### Task 1: `vox-headline` — Full-screen bold statement card

**Files:**
- Create: `packages/templates/src/templates/vox-headline/meta.json`
- Create: `packages/templates/src/templates/vox-headline/metadata.json`
- Create: `packages/templates/src/templates/vox-headline/schema.ts`
- Create: `packages/templates/src/templates/vox-headline/index.tsx`
- Create: `packages/templates/src/templates/vox-headline/register.ts`

- [ ] **Step 1: Create meta.json**

```json
{
  "slug": "vox-headline",
  "name": "Vox Headline",
  "description": "Full-screen bold statement card with large serif text, yellow accent bar, and film grain — for opening hooks, bold claims, and key takeaways",
  "category": "overlay",
  "tags": ["vox-theme", "overlay", "text", "headline", "statement"],
  "stylePreset": "voxDocumentary",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "4s",
  "thumbnail": "",
  "type": "scene",
  "themes": ["vox"]
}
```

- [ ] **Step 2: Create metadata.json**

```json
{
  "compositionId": "vox-headline",
  "durationInFrames": 120,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 3: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  headline: z.string().default('This tiny line on a map caused a war'),
  subtext: z.string().optional(),
  accentBar: z.enum(['left', 'underline', 'none']).default('underline'),
  background: z.enum(['dark', 'light']).default('dark'),
});

export type VoxHeadlineProps = z.infer<typeof schema>;
export const defaultProps: VoxHeadlineProps = schema.parse({});
```

- [ ] **Step 4: Create index.tsx**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxHeadlineProps } from './schema';
import { VOX_COLORS, VOX_SIZES, sf } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline as HeadlineText } from '../../vox/typography';
import { HighlighterStroke } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const VoxHeadline: React.FC<VoxHeadlineProps> = ({ headline, subtext, accentBar, background }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const isDark = background === 'dark';
  const bgColor = isDark ? VOX_COLORS.deepPurple : VOX_COLORS.offWhite;
  const textColor = isDark ? VOX_COLORS.white : VOX_COLORS.charcoal;

  const entrance = voxEntrance(frame, 8, 12, 'up', s(30));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const idle = voxIdle(frame, 42);

  const combinedOpacity = entrance.opacity * exit.opacity;
  const combinedY = entrance.translateY + exit.translateY + idle.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center', padding: s(60) }}>
      <ConstructionPaper color={bgColor} opacity={0.4} seed={5} />
      <div style={{
        opacity: combinedOpacity,
        transform: `translateY(${combinedY}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: s(16),
        maxWidth: s(900),
      }}>
        <HeadlineText
          text={headline}
          size={s(VOX_SIZES.h1)}
          color={textColor}
          accentBar={accentBar}
        />
        {subtext && (
          <div style={{
            fontFamily: 'Inter',
            fontSize: s(VOX_SIZES.body),
            color: isDark ? VOX_COLORS.lightGray : VOX_COLORS.darkGray,
            marginTop: s(12),
            opacity: entrance.opacity,
          }}>
            {subtext}
          </div>
        )}
      </div>
      <FilmGrain opacity={0.35} />
    </AbsoluteFill>
  );
};

export default VoxHeadline;
```

- [ ] **Step 5: Create register.ts** (use standard pattern from above, with voxDir reference)

- [ ] **Step 6: Add import to index.ts**

Add to `packages/templates/src/index.ts`:
```typescript
import './templates/vox-headline/register';
```

- [ ] **Step 7: Add entry to registry.json**

Add to `packages/templates/registry.json`:
```json
{
  "name": "vox-headline",
  "type": "registry:component",
  "description": "Full-screen bold statement card with large serif text, yellow accent bar, and film grain",
  "categories": ["overlay"],
  "tags": ["vox-theme", "overlay", "text", "headline", "statement"],
  "meta": { "stylePreset": "voxDocumentary", "aspectRatio": "9:16", "estimatedDuration": "4s" }
}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd packages/templates && npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add packages/templates/src/templates/vox-headline/ packages/templates/src/index.ts packages/templates/registry.json
git commit -m "feat(templates): add vox-headline template"
```

---

### Task 2-6: Remaining Text & Statement templates

Follow the exact same pattern as Task 1 for each:

**Task 2: `vox-highlight`** — Text with animated yellow highlighter sweep. Schema: `{ text, highlightPhrase, source? }`. Uses `highlighterSweep()` animation.

**Task 3: `vox-definition`** — Key term spotlight. Schema: `{ term, definition, pronunciation? }`. Uses `typewriterReveal()` + `HighlighterStroke`.

**Task 4: `vox-quote`** — Pull quote with attribution. Schema: `{ quote, speaker, title? }`. Large serif text in quotes, yellow highlight on key phrase.

**Task 5: `vox-question`** — Centered rhetorical question. Schema: `{ question }`. Uses `VoxQuestion` typography, minimal.

**Task 6: `vox-label`** — Contextual label card. Schema: `{ location?, date?, source? }`. Small caps, sans-serif, subtle background bar.

Each task:
- [ ] Create meta.json, metadata.json, schema.ts, index.tsx, register.ts
- [ ] Add import to index.ts
- [ ] Add entry to registry.json
- [ ] Verify compiles
- [ ] Commit

---

### Task 7-12: Data & Numbers templates

**Task 7: `vox-stats`** — Hero number with counter animation. Schema: `{ value, unit?, context?, title? }`. Uses `counterRoll()`, yellow accent on number.

**Task 8: `vox-barchart`** — Animated bar chart. Schema: `{ bars: {label, value, highlight?}[], title?, unit? }`. Uses `progressiveBuild()`, yellow highlight on key bar.

**Task 9: `vox-linechart`** — Animated line graph. Schema: `{ points: {x, y}[], title?, annotation? }`. Uses `drawOn()` for progressive line draw.

**Task 10: `vox-counter`** — Large ticking number. Schema: `{ target, unit?, comparison? }`. Uses `counterRoll()` with overshoot, side-by-side comparison variant.

**Task 11: `vox-ranking`** — Ranked list. Schema: `{ items: {rank, label, value?}[], title? }`. Uses `progressiveBuild()`, #1 highlighted yellow.

**Task 12: `vox-timeline`** — Historical timeline. Schema: `{ events: {year, label, description?}[], title? }`. Horizontal with marker drops, active period yellow.

Each task:
- [ ] Create meta.json, metadata.json, schema.ts, index.tsx, register.ts
- [ ] Add import to index.ts
- [ ] Add entry to registry.json
- [ ] Verify compiles
- [ ] Commit

---

### Task 13: Final batch verification

- [ ] **Step 1: Verify all 12 templates are registered**

```bash
cd packages/templates && node -e "
  require('./src/index');
  const { listTemplates } = require('./src/registry');
  const vox = listTemplates({ theme: 'vox' });
  console.log('Vox templates:', vox.length);
  vox.forEach(t => console.log(' -', t.meta.slug));
"
```

Expected: 12 templates listed.

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
cd packages/templates && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit batch verification**

```bash
git commit --allow-empty -m "chore: verify vox templates batch 1 — 12 templates registered and compiling"
```
