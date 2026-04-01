# 10 New Magazine Templates (Pack 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 more magazine-theme overlay templates targeting Instagram Reel content formats: alert, didyouknow, profile, trivia, pricetag, warning, chart, agenda, callout, location.

**Architecture:** Each template follows the established magazine template pattern: a folder under `packages/templates/src/templates/magazine-xxx/` containing schema.ts, index.tsx, meta.json, metadata.json, register.ts, and optional components/. All templates use shared magazine modules. All are 1080x1920 overlays at 150 frames / 30fps with transparent backgrounds and NO exit animations.

**Tech Stack:** React, Remotion (useCurrentFrame, interpolate, random, AbsoluteFill), Zod schemas, TypeScript

---

## Reference: Established Patterns

Every template must follow these rules:

1. **All `interpolate()` calls MUST include `extrapolateLeft: 'clamp', extrapolateRight: 'clamp'`** — missing clamp causes scale/position blowouts.
2. **No exit animations** — overlays stay on screen; scene cuts handle transitions.
3. **Transparent background** — `<AbsoluteFill style={{ backgroundColor: 'transparent' }}>`.
4. **Canvas is 1080x1920 pixels.**
5. **Shared imports come from `../../magazine/*`** (constants, animations, textures, effects, typography, decorations).

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

### Standard registry.json entry pattern:

```json
{
  "name": "magazine-SLUG",
  "type": "registry:component",
  "description": "DESCRIPTION",
  "categories": ["overlay"],
  "tags": ["magazine-theme", "overlay", ...],
  "meta": { "stylePreset": "elegantEditorial", "aspectRatio": "9:16", "estimatedDuration": "5s" }
}
```

---

## Task 1: magazine-alert

Breaking news / urgent alert banner with "BREAKING" stamp and red flash. For announcements, shocking reveals, urgent news.

**Files:**
- Create: `packages/templates/src/templates/magazine-alert/schema.ts`
- Create: `packages/templates/src/templates/magazine-alert/meta.json`
- Create: `packages/templates/src/templates/magazine-alert/metadata.json`
- Create: `packages/templates/src/templates/magazine-alert/index.tsx`
- Create: `packages/templates/src/templates/magazine-alert/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  label: z.string().default('BREAKING NEWS'),
  headline: z.string().default('World leaders reach historic accord on climate finance framework'),
  source: z.string().optional().default('Reuters'),
  timestamp: z.string().optional().default('Just now'),
});

export type MagazineAlertProps = z.infer<typeof schema>;
export const defaultProps: MagazineAlertProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-alert",
  "name": "Magazine Alert",
  "description": "Breaking news alert banner with urgent stamp, red flash, and headline reveal",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "alert", "breaking", "news", "urgent", "announcement"],
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
  "compositionId": "magazine-alert",
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
import type { MagazineAlertProps } from './schema';
import { editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const BANNER_H = 680;
const BANNER_Y = 620;

const MagazineAlert: React.FC<MagazineAlertProps> = ({ label, headline, source, timestamp }) => {
  const frame = useCurrentFrame();

  // Red flash overlay (frames 0-12)
  const flashOpacity = interpolate(frame, [0, 4, 12], [0, 0.25, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Banner slides up from bottom (frames 2-18)
  const bannerSlideY = interpolate(frame, [2, 18], [BANNER_H + 40, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const bannerOpacity = interpolate(frame, [2, 10], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // "BREAKING" stamp slams in with scale bounce (frames 8-22)
  const stampScale = interpolate(frame, [8, 16, 22], [2.5, 0.95, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const stampOpacity = interpolate(frame, [8, 12], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Red accent bar draws (frames 14-28)
  const barProgress = interpolate(frame, [14, 28], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  // Headline reveals
  const headlineReveal = editorialReveal(frame, 22, 18);

  // Source line
  const sourceReveal = editorialReveal(frame, 38, 12);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Red flash overlay */}
      {flashOpacity > 0 && (
        <AbsoluteFill style={{ backgroundColor: MAGAZINE_COLORS.accent, opacity: flashOpacity }} />
      )}

      {/* Banner card */}
      <div style={{
        position: 'absolute', left: 0, top: BANNER_Y, width: CANVAS_W, height: BANNER_H,
        transform: `translateY(${bannerSlideY}px)`, opacity: bannerOpacity,
      }}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.05} seed="alert-paper" />

          {/* Top red bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: `${barProgress * 100}%`, height: 6,
            backgroundColor: MAGAZINE_COLORS.accent,
          }} />

          <div style={{
            position: 'relative', zIndex: 1,
            padding: '50px 60px', boxSizing: 'border-box',
          }}>
            {/* BREAKING stamp */}
            <div style={{
              transform: `scale(${stampScale})`, opacity: stampOpacity,
              transformOrigin: 'left center', marginBottom: 28,
            }}>
              <div style={{
                display: 'inline-block',
                fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.large,
                fontWeight: 900, color: '#ffffff',
                backgroundColor: MAGAZINE_COLORS.accent,
                padding: '8px 20px', letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}>
                {label}
              </div>
            </div>

            {/* Headline */}
            <div style={{
              opacity: headlineReveal.opacity,
              transform: `translateY(${headlineReveal.translateY}px)`,
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                fontWeight: 700, color: MAGAZINE_COLORS.text,
                lineHeight: 1.25, letterSpacing: '-0.01em',
              }}>
                {headline}
              </div>
            </div>

            {/* Source / timestamp */}
            {(source || timestamp) && (
              <div style={{
                marginTop: 28, opacity: sourceReveal.opacity,
                transform: `translateY(${sourceReveal.translateY}px)`,
                display: 'flex', gap: 16, alignItems: 'center',
              }}>
                {source && (
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                    fontWeight: 700, color: MAGAZINE_COLORS.secondary,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    {source}
                  </div>
                )}
                {source && timestamp && (
                  <div style={{
                    width: 4, height: 4, borderRadius: '50%',
                    backgroundColor: MAGAZINE_COLORS.secondary, opacity: 0.5,
                  }} />
                )}
                {timestamp && (
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.small,
                    color: MAGAZINE_COLORS.secondary, fontStyle: 'italic',
                  }}>
                    {timestamp}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineAlert;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-alert/register';`

---

## Task 2: magazine-didyouknow

"Did You Know?" fun fact card with large decorative question mark. For educational content, fun facts, trivia hooks.

**Files:**
- Create: `packages/templates/src/templates/magazine-didyouknow/schema.ts`
- Create: `packages/templates/src/templates/magazine-didyouknow/meta.json`
- Create: `packages/templates/src/templates/magazine-didyouknow/metadata.json`
- Create: `packages/templates/src/templates/magazine-didyouknow/index.tsx`
- Create: `packages/templates/src/templates/magazine-didyouknow/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  fact: z.string().default('The International Space Station orbits Earth every 92 minutes, meaning astronauts witness 16 sunrises and sunsets each day.'),
  source: z.string().optional().default('NASA'),
});

export type MagazineDidyouknowProps = z.infer<typeof schema>;
export const defaultProps: MagazineDidyouknowProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-didyouknow",
  "name": "Magazine Did You Know",
  "description": "Fun fact card with decorative question mark and editorial text reveal for educational content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "didyouknow", "fact", "educational", "trivia", "funfact"],
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
  "compositionId": "magazine-didyouknow",
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
import type { MagazineDidyouknowProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1200;

const MagazineDidyouknow: React.FC<MagazineDidyouknowProps> = ({ fact, source }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const questionReveal = editorialReveal(frame, 8, 15);

  // "DID YOU KNOW?" label
  const labelReveal = editorialReveal(frame, 18, 12);

  // Accent rule draws in
  const ruleProgress = interpolate(frame, [28, 42], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  // Fact text
  const factReveal = editorialReveal(frame, 35, 18);

  // Source
  const sourceReveal = editorialReveal(frame, 55, 12);

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={300} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.1} seed="didyouknow" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '70px 55px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              {/* Large decorative "?" */}
              <div style={{
                fontFamily: MAGAZINE_FONTS.headline, fontSize: 280,
                fontWeight: 900, color: MAGAZINE_COLORS.accent,
                lineHeight: 0.7, opacity: questionReveal.opacity * 0.1,
                transform: `translateY(${questionReveal.translateY}px)`,
                userSelect: 'none', position: 'absolute', right: 40, top: 50,
              }}>
                ?
              </div>

              {/* Section label */}
              <div style={{
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label="Did You Know?" />
              </div>

              {/* Accent rule */}
              <div style={{
                marginTop: 32, marginBottom: 32, alignSelf: 'center',
                width: `${ruleProgress * 15}%`, height: 3,
                backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
              }} />

              {/* Fact text */}
              <div style={{
                opacity: factReveal.opacity,
                transform: `translateY(${factReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h2,
                  fontWeight: 700, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.4, textAlign: 'center',
                }}>
                  {fact}
                </div>
              </div>

              {/* Source */}
              {source && (
                <div style={{
                  marginTop: 36, alignSelf: 'center',
                  opacity: sourceReveal.opacity,
                  transform: `translateY(${sourceReveal.translateY}px)`,
                }}>
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                    fontWeight: 700, color: MAGAZINE_COLORS.secondary,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    Source: {source}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TornEdge>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineDidyouknow;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-didyouknow/register';`

---

## Task 3: magazine-profile

Person bio card with circular placeholder, name, title, and key detail lines. For introducing people, expert profiles, "who is..." content.

**Files:**
- Create: `packages/templates/src/templates/magazine-profile/schema.ts`
- Create: `packages/templates/src/templates/magazine-profile/meta.json`
- Create: `packages/templates/src/templates/magazine-profile/metadata.json`
- Create: `packages/templates/src/templates/magazine-profile/index.tsx`
- Create: `packages/templates/src/templates/magazine-profile/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  name: z.string().default('Dr. Elena Vasquez'),
  title: z.string().default('Chief Diplomatic Correspondent'),
  details: z.array(z.string()).min(1).max(5).default([
    'Based in Geneva, Switzerland',
    '15 years covering international relations',
    'Pulitzer Prize finalist, 2024',
    'Former UN press corps member',
  ]),
  initials: z.string().optional().default('EV'),
});

export type MagazineProfileProps = z.infer<typeof schema>;
export const defaultProps: MagazineProfileProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-profile",
  "name": "Magazine Profile",
  "description": "Person bio card with circular avatar placeholder, name, title, and key details for profile introductions",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "profile", "bio", "person", "expert", "introduction"],
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
  "compositionId": "magazine-profile",
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
import type { MagazineProfileProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1400;
const AVATAR_SIZE = 160;
const DETAIL_STAGGER = 8;

const MagazineProfile: React.FC<MagazineProfileProps> = ({ name, title, details, initials }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const labelReveal = editorialReveal(frame, 14, 12);

  // Avatar circle scales in
  const avatarScale = interpolate(frame, [18, 30], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const avatarOpacity = interpolate(frame, [18, 24], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const nameReveal = editorialReveal(frame, 28, 15);
  const titleReveal = editorialReveal(frame, 36, 12);

  // Accent rule
  const ruleProgress = interpolate(frame, [42, 55], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={310} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="profile" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 55px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              {/* Section label */}
              <div style={{
                width: '100%',
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label="Profile" />
              </div>

              {/* Avatar circle with initials */}
              <div style={{
                marginTop: 40,
                width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: '50%',
                border: `3px solid ${MAGAZINE_COLORS.accent}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: `scale(${avatarScale})`, opacity: avatarOpacity,
                backgroundColor: 'rgba(225,29,72,0.06)',
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                  fontWeight: 700, color: MAGAZINE_COLORS.accent, lineHeight: 1,
                }}>
                  {initials}
                </div>
              </div>

              {/* Name */}
              <div style={{
                marginTop: 32,
                opacity: nameReveal.opacity,
                transform: `translateY(${nameReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                  fontWeight: 700, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.15, textAlign: 'center', letterSpacing: '-0.02em',
                }}>
                  {name}
                </div>
              </div>

              {/* Title */}
              <div style={{
                marginTop: 12,
                opacity: titleReveal.opacity,
                transform: `translateY(${titleReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                  fontStyle: 'italic', color: MAGAZINE_COLORS.secondary,
                  textAlign: 'center',
                }}>
                  {title}
                </div>
              </div>

              {/* Accent rule */}
              <div style={{
                marginTop: 30, marginBottom: 30,
                width: `${ruleProgress * 20}%`, height: 3,
                backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
              }} />

              {/* Detail lines */}
              <div style={{ width: '100%' }}>
                {details.map((detail, i) => {
                  const reveal = editorialReveal(frame, 50 + i * DETAIL_STAGGER, 12);
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
                      opacity: reveal.opacity,
                      transform: `translateY(${reveal.translateY}px)`,
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        backgroundColor: MAGAZINE_COLORS.accent, flexShrink: 0,
                      }} />
                      <div style={{
                        fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h4,
                        color: MAGAZINE_COLORS.text, lineHeight: 1.3,
                      }}>
                        {detail}
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

export default MagazineProfile;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-profile/register';`

---

## Task 4: magazine-trivia

Question card with dramatic answer reveal. For quiz content, engagement hooks, "can you guess?" reels.

**Files:**
- Create: `packages/templates/src/templates/magazine-trivia/schema.ts`
- Create: `packages/templates/src/templates/magazine-trivia/meta.json`
- Create: `packages/templates/src/templates/magazine-trivia/metadata.json`
- Create: `packages/templates/src/templates/magazine-trivia/index.tsx`
- Create: `packages/templates/src/templates/magazine-trivia/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  question: z.string().default('How many countries have a permanent seat on the UN Security Council?'),
  answer: z.string().default('Five'),
  detail: z.string().optional().default('China, France, Russia, the United Kingdom, and the United States'),
});

export type MagazineTriviaProps = z.infer<typeof schema>;
export const defaultProps: MagazineTriviaProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-trivia",
  "name": "Magazine Trivia",
  "description": "Question card with dramatic pause and answer reveal for quiz and engagement content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "trivia", "quiz", "question", "answer", "engagement"],
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
  "compositionId": "magazine-trivia",
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
import type { MagazineTriviaProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1500;

const MagazineTrivia: React.FC<MagazineTriviaProps> = ({ question, answer, detail }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const questionLabel = editorialReveal(frame, 15, 12);
  const questionReveal = editorialReveal(frame, 22, 18);

  // Divider draws in (frames 45-58)
  const dividerProgress = interpolate(frame, [45, 58], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  // Answer reveals after dramatic pause (frame 60)
  const answerLabelReveal = editorialReveal(frame, 60, 12);
  const answerReveal = editorialReveal(frame, 68, 15);
  const detailReveal = editorialReveal(frame, 82, 15);

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={320} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="trivia" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '80px 55px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Question section */}
              <div style={{
                opacity: questionLabel.opacity,
                transform: `translateY(${questionLabel.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                  fontWeight: 700, color: MAGAZINE_COLORS.accent,
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20,
                }}>
                  QUESTION
                </div>
              </div>

              <div style={{
                opacity: questionReveal.opacity,
                transform: `translateY(${questionReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                  fontWeight: 700, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.3,
                }}>
                  {question}
                </div>
              </div>

              {/* Divider */}
              <div style={{
                marginTop: 60, marginBottom: 60, alignSelf: 'center',
                width: `${dividerProgress * 60}%`, height: 2,
                backgroundColor: MAGAZINE_COLORS.secondary, opacity: 0.25,
              }} />

              {/* Answer section */}
              <div style={{
                opacity: answerLabelReveal.opacity,
                transform: `translateY(${answerLabelReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                  fontWeight: 700, color: '#16a34a',
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20,
                }}>
                  ANSWER
                </div>
              </div>

              <div style={{
                opacity: answerReveal.opacity,
                transform: `translateY(${answerReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.display,
                  fontWeight: 900, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.15, letterSpacing: '-0.02em',
                }}>
                  {answer}
                </div>
              </div>

              {/* Detail explanation */}
              {detail && (
                <div style={{
                  marginTop: 24,
                  opacity: detailReveal.opacity,
                  transform: `translateY(${detailReveal.translateY}px)`,
                }}>
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                    color: MAGAZINE_COLORS.secondary, lineHeight: 1.4,
                  }}>
                    {detail}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TornEdge>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineTrivia;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-trivia/register';`

---

## Task 5: magazine-pricetag

Large currency figure with cost breakdown items. For price reveals, cost comparisons, "how much does X cost" content.

**Files:**
- Create: `packages/templates/src/templates/magazine-pricetag/schema.ts`
- Create: `packages/templates/src/templates/magazine-pricetag/meta.json`
- Create: `packages/templates/src/templates/magazine-pricetag/metadata.json`
- Create: `packages/templates/src/templates/magazine-pricetag/index.tsx`
- Create: `packages/templates/src/templates/magazine-pricetag/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  label: z.string().default('Estimated Cost'),
  price: z.string().default('$4.2 Trillion'),
  breakdown: z.array(z.string()).min(1).max(5).default([
    'Infrastructure & green energy: $1.8T',
    'Adaptation funding: $1.1T',
    'Loss and damage: $900B',
    'Technology transfer: $400B',
  ]),
});

export type MagazinePricetagProps = z.infer<typeof schema>;
export const defaultProps: MagazinePricetagProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-pricetag",
  "name": "Magazine Pricetag",
  "description": "Large price figure with cost breakdown items for price reveals and financial content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "price", "cost", "money", "finance", "budget"],
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
  "compositionId": "magazine-pricetag",
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
import type { MagazinePricetagProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1400;
const ITEM_STAGGER = 8;

const MagazinePricetag: React.FC<MagazinePricetagProps> = ({ label, price, breakdown }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const labelReveal = editorialReveal(frame, 15, 12);

  // Price snaps in with scale
  const priceScale = interpolate(frame, [22, 34], [1.4, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const priceOpacity = interpolate(frame, [22, 28], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Rule draws
  const ruleProgress = interpolate(frame, [35, 48], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={330} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="pricetag" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 50px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Label */}
              <div style={{
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label={label} />
              </div>

              {/* Large price figure */}
              <div style={{
                marginTop: 50, alignSelf: 'center',
                transform: `scale(${priceScale})`, opacity: priceOpacity,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.hero,
                  fontWeight: 900, color: MAGAZINE_COLORS.accent,
                  lineHeight: 1.05, letterSpacing: '-0.03em', textAlign: 'center',
                }}>
                  {price}
                </div>
              </div>

              {/* Accent rule */}
              <div style={{
                marginTop: 45, marginBottom: 45, alignSelf: 'center',
                width: `${ruleProgress * 30}%`, height: 3,
                backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
              }} />

              {/* Breakdown items */}
              {breakdown.map((item, i) => {
                const reveal = editorialReveal(frame, 48 + i * ITEM_STAGGER, 12);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 22,
                    opacity: reveal.opacity,
                    transform: `translateY(${reveal.translateY}px)`,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: MAGAZINE_COLORS.accent, flexShrink: 0,
                      marginTop: 10,
                    }} />
                    <div style={{
                      fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                      color: MAGAZINE_COLORS.text, lineHeight: 1.4,
                    }}>
                      {item}
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

export default MagazinePricetag;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-pricetag/register';`

---

## Task 6: magazine-warning

Caution/red-flag overlay with warning header and bullet list. For "avoid these", red flags, mistakes content.

**Files:**
- Create: `packages/templates/src/templates/magazine-warning/schema.ts`
- Create: `packages/templates/src/templates/magazine-warning/meta.json`
- Create: `packages/templates/src/templates/magazine-warning/metadata.json`
- Create: `packages/templates/src/templates/magazine-warning/index.tsx`
- Create: `packages/templates/src/templates/magazine-warning/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Red Flags'),
  items: z.array(z.string()).min(1).max(5).default([
    'Unverified sources spreading misinformation',
    'Deepfake footage circulating on social media',
    'Phishing emails disguised as aid organizations',
    'Fake donation links targeting sympathizers',
  ]),
});

export type MagazineWarningProps = z.infer<typeof schema>;
export const defaultProps: MagazineWarningProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-warning",
  "name": "Magazine Warning",
  "description": "Caution overlay with warning header and flagged bullet items for red flags and mistakes content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "warning", "caution", "red-flag", "avoid", "mistakes"],
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
  "compositionId": "magazine-warning",
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
import type { MagazineWarningProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1400;
const ITEM_STAGGER = 10;

const MagazineWarning: React.FC<MagazineWarningProps> = ({ title, items }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');

  // Warning badge slams in
  const badgeScale = interpolate(frame, [10, 18, 24], [2.2, 0.95, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const badgeOpacity = interpolate(frame, [10, 14], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const titleReveal = editorialReveal(frame, 22, 15);

  // Red top bar draws
  const barProgress = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={340} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="warning" />

            {/* Top red bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: `${barProgress * 100}%`, height: 6,
              backgroundColor: MAGAZINE_COLORS.accent, zIndex: 2,
            }} />

            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 50px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Warning badge */}
              <div style={{
                transform: `scale(${badgeScale})`, opacity: badgeOpacity,
                transformOrigin: 'left center', marginBottom: 24,
              }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 12,
                  backgroundColor: MAGAZINE_COLORS.accent,
                  padding: '10px 22px',
                }}>
                  {/* Triangle icon */}
                  <div style={{
                    width: 0, height: 0,
                    borderLeft: '10px solid transparent',
                    borderRight: '10px solid transparent',
                    borderBottom: '18px solid #ffffff',
                  }} />
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.body,
                    fontWeight: 900, color: '#ffffff',
                    letterSpacing: '0.2em', textTransform: 'uppercase',
                  }}>
                    WARNING
                  </div>
                </div>
              </div>

              {/* Title */}
              <div style={{
                opacity: titleReveal.opacity,
                transform: `translateY(${titleReveal.translateY}px)`,
                marginBottom: 40,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                  fontWeight: 700, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.2, letterSpacing: '-0.01em',
                }}>
                  {title}
                </div>
              </div>

              {/* Warning items */}
              {items.map((item, i) => {
                const reveal = editorialReveal(frame, 38 + i * ITEM_STAGGER, 12);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 26,
                    opacity: reveal.opacity,
                    transform: `translateY(${reveal.translateY}px)`,
                  }}>
                    {/* Red cross icon */}
                    <div style={{
                      fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h3,
                      fontWeight: 700, color: MAGAZINE_COLORS.accent,
                      lineHeight: 1.3, flexShrink: 0,
                    }}>
                      {'\u2717'}
                    </div>
                    <div style={{
                      fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                      color: MAGAZINE_COLORS.text, lineHeight: 1.4,
                    }}>
                      {item}
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

export default MagazineWarning;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-warning/register';`

---

## Task 7: magazine-chart

Horizontal bar chart with animated fill bars. For data visualization, poll results, market shares.

**Files:**
- Create: `packages/templates/src/templates/magazine-chart/schema.ts`
- Create: `packages/templates/src/templates/magazine-chart/meta.json`
- Create: `packages/templates/src/templates/magazine-chart/metadata.json`
- Create: `packages/templates/src/templates/magazine-chart/index.tsx`
- Create: `packages/templates/src/templates/magazine-chart/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

const barSchema = z.object({
  label: z.string(),
  value: z.number().min(0).max(100),
});

export const schema = z.object({
  title: z.string().default('Global Energy Mix (2026)'),
  bars: z.array(barSchema).min(2).max(6).default([
    { label: 'Renewables', value: 38 },
    { label: 'Natural Gas', value: 24 },
    { label: 'Coal', value: 18 },
    { label: 'Nuclear', value: 12 },
    { label: 'Oil', value: 8 },
  ]),
  unit: z.string().optional().default('%'),
});

export type MagazineChartProps = z.infer<typeof schema>;
export const defaultProps: MagazineChartProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-chart",
  "name": "Magazine Chart",
  "description": "Horizontal bar chart with animated fill bars and labels for data visualization content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "chart", "bar", "data", "visualization", "statistics"],
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
  "compositionId": "magazine-chart",
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
import type { MagazineChartProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline, SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1500;
const BAR_MAX_W = 580;
const BAR_H = 36;
const BAR_STAGGER = 10;

const MagazineChart: React.FC<MagazineChartProps> = ({ title, bars, unit }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const labelReveal = editorialReveal(frame, 14, 12);
  const titleReveal = editorialReveal(frame, 20, 15);

  const maxValue = Math.max(...bars.map((b) => b.value), 1);

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={350} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="chart" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 50px', boxSizing: 'border-box',
            }}>
              {/* Section label */}
              <div style={{
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label="Data" />
              </div>

              {/* Title */}
              <div style={{
                marginTop: 24,
                opacity: titleReveal.opacity,
                transform: `translateY(${titleReveal.translateY}px)`,
              }}>
                <SerifHeadline text={title} size={FONT_SIZES.h1} showRule />
              </div>

              {/* Bars */}
              <div style={{ marginTop: 50 }}>
                {bars.map((bar, i) => {
                  const barStart = 35 + i * BAR_STAGGER;
                  const reveal = editorialReveal(frame, barStart, 12);
                  const barFill = interpolate(frame, [barStart + 5, barStart + 25], [0, 1], {
                    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
                  });
                  const barWidth = (bar.value / maxValue) * BAR_MAX_W * barFill;

                  return (
                    <div key={i} style={{
                      marginBottom: 32,
                      opacity: reveal.opacity,
                      transform: `translateY(${reveal.translateY}px)`,
                    }}>
                      {/* Label row */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', marginBottom: 10,
                      }}>
                        <div style={{
                          fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.large,
                          color: MAGAZINE_COLORS.text, fontWeight: 600,
                        }}>
                          {bar.label}
                        </div>
                        <div style={{
                          fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.large,
                          fontWeight: 700, color: MAGAZINE_COLORS.accent,
                        }}>
                          {bar.value}{unit}
                        </div>
                      </div>
                      {/* Bar track */}
                      <div style={{
                        width: BAR_MAX_W, height: BAR_H,
                        backgroundColor: 'rgba(15,23,42,0.06)', borderRadius: 4,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: barWidth, height: '100%',
                          backgroundColor: i === 0 ? MAGAZINE_COLORS.accent : MAGAZINE_COLORS.inkBlack,
                          borderRadius: 4, opacity: i === 0 ? 1 : 0.7,
                        }} />
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

export default MagazineChart;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-chart/register';`

---

## Task 8: magazine-agenda

Time-slot schedule with vertical time line. For event recaps, daily routines, "a day in the life" content.

**Files:**
- Create: `packages/templates/src/templates/magazine-agenda/schema.ts`
- Create: `packages/templates/src/templates/magazine-agenda/meta.json`
- Create: `packages/templates/src/templates/magazine-agenda/metadata.json`
- Create: `packages/templates/src/templates/magazine-agenda/index.tsx`
- Create: `packages/templates/src/templates/magazine-agenda/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

const slotSchema = z.object({
  time: z.string(),
  event: z.string(),
});

export const schema = z.object({
  title: z.string().default('Summit Day 1'),
  slots: z.array(slotSchema).min(2).max(6).default([
    { time: '09:00', event: 'Opening ceremony & keynote address' },
    { time: '10:30', event: 'Panel: Climate finance framework' },
    { time: '12:00', event: 'Working lunch — bilateral meetings' },
    { time: '14:00', event: 'Breakout sessions on regional targets' },
    { time: '16:30', event: 'Joint press conference' },
  ]),
});

export type MagazineAgendaProps = z.infer<typeof schema>;
export const defaultProps: MagazineAgendaProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-agenda",
  "name": "Magazine Agenda",
  "description": "Time-slot schedule overlay with vertical timeline for event agendas and daily routine content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "agenda", "schedule", "timeline", "event", "routine"],
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
  "compositionId": "magazine-agenda",
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
import type { MagazineAgendaProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline, SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1500;
const SLOT_STAGGER = 10;

const MagazineAgenda: React.FC<MagazineAgendaProps> = ({ title, slots }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const labelReveal = editorialReveal(frame, 14, 12);
  const titleReveal = editorialReveal(frame, 20, 15);

  // Vertical line draws down
  const lineProgress = interpolate(frame, [30, 30 + slots.length * SLOT_STAGGER + 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={360} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="agenda" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 50px', boxSizing: 'border-box',
            }}>
              {/* Section label */}
              <div style={{
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label="Schedule" />
              </div>

              {/* Title */}
              <div style={{
                marginTop: 24,
                opacity: titleReveal.opacity,
                transform: `translateY(${titleReveal.translateY}px)`,
              }}>
                <SerifHeadline text={title} size={FONT_SIZES.h1} showRule />
              </div>

              {/* Schedule slots */}
              <div style={{ marginTop: 50, position: 'relative', paddingLeft: 120 }}>
                {/* Vertical timeline line */}
                <div style={{
                  position: 'absolute', left: 95, top: 8,
                  width: 2, height: `${lineProgress * 100}%`,
                  backgroundColor: MAGAZINE_COLORS.accent, opacity: 0.4,
                }} />

                {slots.map((slot, i) => {
                  const reveal = editorialReveal(frame, 35 + i * SLOT_STAGGER, 12);
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', marginBottom: 36,
                      opacity: reveal.opacity,
                      transform: `translateY(${reveal.translateY}px)`,
                      position: 'relative',
                    }}>
                      {/* Time label */}
                      <div style={{
                        position: 'absolute', left: -120, width: 80, textAlign: 'right',
                        fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.large,
                        fontWeight: 700, color: MAGAZINE_COLORS.accent,
                        lineHeight: 1.3,
                      }}>
                        {slot.time}
                      </div>

                      {/* Dot on timeline */}
                      <div style={{
                        position: 'absolute', left: -30,
                        width: 10, height: 10, borderRadius: '50%',
                        backgroundColor: MAGAZINE_COLORS.accent, top: 6,
                      }} />

                      {/* Event text */}
                      <div style={{
                        fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                        color: MAGAZINE_COLORS.text, lineHeight: 1.4,
                        paddingLeft: 8,
                      }}>
                        {slot.event}
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

export default MagazineAgenda;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-agenda/register';`

---

## Task 9: magazine-callout

Single dramatic stat or phrase with oversized typography. For viral one-liners, shocking stats, key moments.

**Files:**
- Create: `packages/templates/src/templates/magazine-callout/schema.ts`
- Create: `packages/templates/src/templates/magazine-callout/meta.json`
- Create: `packages/templates/src/templates/magazine-callout/metadata.json`
- Create: `packages/templates/src/templates/magazine-callout/index.tsx`
- Create: `packages/templates/src/templates/magazine-callout/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  callout: z.string().default('1.5°C'),
  subtitle: z.string().optional().default('The temperature threshold the world just agreed to defend'),
  context: z.string().optional().default('Geneva Climate Accord, March 2026'),
});

export type MagazineCalloutProps = z.infer<typeof schema>;
export const defaultProps: MagazineCalloutProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-callout",
  "name": "Magazine Callout",
  "description": "Single dramatic stat or phrase with oversized typography for viral one-liners and key moments",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "callout", "stat", "highlight", "dramatic", "viral"],
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
  "compositionId": "magazine-callout",
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
import type { MagazineCalloutProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const MagazineCallout: React.FC<MagazineCalloutProps> = ({ callout, subtitle, context }) => {
  const frame = useCurrentFrame();

  const slide = paperSlide(frame, 0, 15, 'up');

  // Callout text scales in from large
  const calloutScale = interpolate(frame, [12, 28], [1.6, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const calloutOpacity = interpolate(frame, [12, 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Top and bottom accent rules
  const ruleProgress = interpolate(frame, [25, 42], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const subtitleReveal = editorialReveal(frame, 38, 18);
  const contextReveal = editorialReveal(frame, 55, 12);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        width: '100%', height: '100%',
        opacity: slide.opacity,
        transform: `translateY(${slide.translateY}px)`,
      }}>
        <PaperTexture age={0.1} opacity={1} seed="callout-paper" />

        {/* Content — vertically centered */}
        <div style={{
          position: 'absolute', left: 70, right: 70, top: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          alignItems: 'center',
        }}>
          {/* Top rule */}
          <div style={{
            width: `${ruleProgress * 40}%`, height: 3,
            backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
            marginBottom: 50,
          }} />

          {/* Large callout text */}
          <div style={{
            transform: `scale(${calloutScale})`, opacity: calloutOpacity,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.headline, fontSize: 120,
              fontWeight: 900, color: MAGAZINE_COLORS.text,
              lineHeight: 1.0, letterSpacing: '-0.04em', textAlign: 'center',
            }}>
              {callout}
            </div>
          </div>

          {/* Bottom rule */}
          <div style={{
            width: `${ruleProgress * 40}%`, height: 3,
            backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
            marginTop: 50, marginBottom: 40,
          }} />

          {/* Subtitle */}
          {subtitle && (
            <div style={{
              opacity: subtitleReveal.opacity,
              transform: `translateY(${subtitleReveal.translateY}px)`,
              maxWidth: 800,
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h2,
                color: MAGAZINE_COLORS.text, lineHeight: 1.4,
                textAlign: 'center',
              }}>
                {subtitle}
              </div>
            </div>
          )}

          {/* Context */}
          {context && (
            <div style={{
              marginTop: 30,
              opacity: contextReveal.opacity,
              transform: `translateY(${contextReveal.translateY}px)`,
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                color: MAGAZINE_COLORS.secondary,
                letterSpacing: '0.08em', textTransform: 'uppercase',
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

export default MagazineCallout;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-callout/register';`

---

## Task 10: magazine-location

Location spotlight card with place name, coordinates, and key details. For travel content, location intros, "where is..." reels.

**Files:**
- Create: `packages/templates/src/templates/magazine-location/schema.ts`
- Create: `packages/templates/src/templates/magazine-location/meta.json`
- Create: `packages/templates/src/templates/magazine-location/metadata.json`
- Create: `packages/templates/src/templates/magazine-location/index.tsx`
- Create: `packages/templates/src/templates/magazine-location/register.ts`
- Modify: `packages/templates/src/index.ts`
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  place: z.string().default('Geneva'),
  region: z.string().optional().default('Switzerland'),
  coordinates: z.string().optional().default('46.2044° N, 6.1432° E'),
  details: z.array(z.string()).min(0).max(4).default([
    'Population: 203,000',
    'Home to 38 international organizations',
    'Site of the historic Climate Accord',
  ]),
});

export type MagazineLocationProps = z.infer<typeof schema>;
export const defaultProps: MagazineLocationProps = schema.parse({});
```

- [ ] **Step 2: Create meta.json**

```json
{
  "slug": "magazine-location",
  "name": "Magazine Location",
  "description": "Location spotlight card with place name, coordinates, and key details for travel and geography content",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "location", "place", "travel", "geography", "city"],
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
  "compositionId": "magazine-location",
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
import type { MagazineLocationProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1300;
const DETAIL_STAGGER = 8;

const MagazineLocation: React.FC<MagazineLocationProps> = ({ place, region, coordinates, details }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const labelReveal = editorialReveal(frame, 14, 12);

  // Pin icon drops in
  const pinScale = interpolate(frame, [18, 28], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const pinOpacity = interpolate(frame, [18, 22], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const placeReveal = editorialReveal(frame, 25, 15);
  const regionReveal = editorialReveal(frame, 34, 12);
  const coordsReveal = editorialReveal(frame, 42, 12);

  // Accent rule
  const ruleProgress = interpolate(frame, [48, 60], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={370} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="location" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 55px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Section label */}
              <div style={{
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label="Location" />
              </div>

              {/* Pin icon */}
              <div style={{
                marginTop: 40, alignSelf: 'center',
                transform: `scale(${pinScale})`, opacity: pinOpacity,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50% 50% 50% 0',
                  backgroundColor: MAGAZINE_COLORS.accent,
                  transform: 'rotate(-45deg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    backgroundColor: '#ffffff', transform: 'rotate(45deg)',
                  }} />
                </div>
              </div>

              {/* Place name */}
              <div style={{
                marginTop: 32, alignSelf: 'center',
                opacity: placeReveal.opacity,
                transform: `translateY(${placeReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.hero,
                  fontWeight: 900, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.05, letterSpacing: '-0.03em', textAlign: 'center',
                }}>
                  {place}
                </div>
              </div>

              {/* Region */}
              {region && (
                <div style={{
                  marginTop: 10, alignSelf: 'center',
                  opacity: regionReveal.opacity,
                  transform: `translateY(${regionReveal.translateY}px)`,
                }}>
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                    fontStyle: 'italic', color: MAGAZINE_COLORS.secondary,
                    textAlign: 'center',
                  }}>
                    {region}
                  </div>
                </div>
              )}

              {/* Coordinates */}
              {coordinates && (
                <div style={{
                  marginTop: 16, alignSelf: 'center',
                  opacity: coordsReveal.opacity,
                  transform: `translateY(${coordsReveal.translateY}px)`,
                }}>
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                    color: MAGAZINE_COLORS.secondary,
                    letterSpacing: '0.08em',
                  }}>
                    {coordinates}
                  </div>
                </div>
              )}

              {/* Accent rule */}
              <div style={{
                marginTop: 36, marginBottom: 36, alignSelf: 'center',
                width: `${ruleProgress * 20}%`, height: 3,
                backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
              }} />

              {/* Detail lines */}
              {details.map((detail, i) => {
                const reveal = editorialReveal(frame, 58 + i * DETAIL_STAGGER, 12);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
                    opacity: reveal.opacity,
                    transform: `translateY(${reveal.translateY}px)`,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: MAGAZINE_COLORS.accent, flexShrink: 0,
                    }} />
                    <div style={{
                      fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h4,
                      color: MAGAZINE_COLORS.text, lineHeight: 1.3,
                    }}>
                      {detail}
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

export default MagazineLocation;
```

- [ ] **Step 5: Create register.ts, add import, add registry entry, verify, commit**

ownFileNames: `'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts'`

Import: `import './templates/magazine-location/register';`

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
magazine-alert, magazine-didyouknow, magazine-profile, magazine-trivia,
magazine-pricetag, magazine-warning, magazine-chart, magazine-agenda,
magazine-callout, magazine-location
```

Check `registry.json` has all 10 new entries (total should be 32 items: 22 existing + 10 new).

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
git commit -m "feat(templates): add 10 more magazine overlay templates (pack 3)"
```
