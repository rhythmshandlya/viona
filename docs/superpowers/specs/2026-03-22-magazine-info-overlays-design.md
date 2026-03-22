# Magazine Information Overlays — Design Spec

**Date:** 2026-03-22
**Status:** Draft
**Theme:** Magazine (editorial)
**Category:** Overlay (transparent background)

## Overview

Five new magazine-theme overlay templates that convey structured information — checklists, timelines, statistics, comparisons, and fact files — using the same torn-paper editorial aesthetic as `magazine-collage`. All are 9:16 portrait, 150 frames @ 30fps (5 seconds), transparent background, and built on the shared magazine module system.

**Primary use case:** News, geopolitics, country profiles, educational fact-sharing content.

## Shared Conventions

All 5 overlays follow these patterns:

- **Canvas:** 1080x1920, transparent background
- **Duration:** 150 frames @ 30fps (5 seconds)
- **5-phase animation structure:**
  1. Entrance (paper slides in via `paperSlide`)
  2. Content reveal (element-specific: stamps, count-ups, draws)
  3. Parallax hold (sine-wave drift, depth-based amplitude)
  4. Exit (reverse scatter or slide-out)
- **Clamped interpolation:** Every `interpolate()` call uses `extrapolateLeft: 'clamp'` and `extrapolateRight: 'clamp'`
- **Deterministic randomness:** `random()` with string seeds for rotation, offsets, decoration assignment
- **Decorations:** Tape or pin marks assigned per element via `random('decoration-{i}') > 0.5`
- **Shared modules:** `animations.ts`, `constants.ts`, `effects.tsx`, `textures.tsx`, `typography.tsx`
- **Easing:** `magazineEasing` (cubic-bezier 0.25, 0.1, 0.25, 1.0) for all transitions

## Template 1: magazine-checklist

**Purpose:** Bullet-point lists — "5 Key Demands", "Things to Know", "Action Items"

### Schema

```ts
z.object({
  items: z.array(z.object({
    text: z.string(),
    checked: z.boolean().default(true),
  })).default([
    { text: 'Ceasefire agreement signed', checked: true },
    { text: 'Humanitarian corridor opened', checked: true },
    { text: 'Sanctions package approved', checked: true },
  ]),
  title: z.string().default('Key Developments'),
})
```

### Layout

- **Title scrap:** Centered at ~y:200, ~900w x 160h torn paper, `SerifHeadline` at h2 size, tape decoration
- **Item scraps:** Stacked vertically below title, ~900w x 140h each, spaced ~180px apart
- Alternating slight left/right offset (±30px) for organic scattered feel
- Each item: red circle checkbox on left (32px diameter), text to the right in body serif
- Slight per-item rotation (±2° via `random`)

### Animation (150 frames)

| Phase | Frames | Action |
|-------|--------|--------|
| 1 — Title enter | 0-20 | Title scrap `paperSlide('down')` |
| 2 — Items enter | 15-75 | Item scraps slide in alternating left/right, stagger 10 frames |
| 3 — Checkmarks | 40-100 | Check stamp pops 15 frames after each scrap lands (scale 1.4→1.0, red fill) |
| 4 — Parallax | 60-120 | Sine-wave drift, depth by index |
| 5 — Exit | 120-150 | Reverse scatter, opacity fade |

### Components

- `ChecklistItem.tsx` — torn paper strip with checkbox area + text
- `CheckMark.tsx` — animated red checkmark stamp (scale pop via `interpolate`)
- Reuses: `TornEdge`, `PaperTexture`, `TapeMark`/`PinMark`, `SerifHeadline`

---

## Template 2: magazine-timeline

**Purpose:** Historical sequences — "History of the Conflict", "Key Dates", "How It Happened"

### Schema

```ts
z.object({
  events: z.array(z.object({
    year: z.string(),
    text: z.string(),
  })).default([
    { year: '2014', text: 'Crimea annexed' },
    { year: '2015', text: 'Minsk II agreement signed' },
    { year: '2022', text: 'Full-scale invasion begins' },
    { year: '2024', text: 'Peace negotiations resume' },
  ]),
  title: z.string().default('Timeline of the Conflict'),
})
```

### Layout

- **Title scrap:** Centered at ~y:120, tape decoration
- **Red thread:** 3px vertical line at x:540 (center), running from below title to near bottom
- **Node dots:** 10px red circles on the thread at each event's y-position
- **Event scraps:** Alternate left/right of thread, each ~440w x 200h
  - Year in bold red (stat style, `FONT_SIZES.hero`)
  - Description in body serif below
  - Scraps spaced ~320px apart vertically, rotation ±3°

### Animation (150 frames)

| Phase | Frames | Action |
|-------|--------|--------|
| 1 — Title enter | 0-15 | `paperSlide('down')` |
| 2 — Thread draw | 10-30 | Height animates 0→full via `interpolate`, `magazineEasing` |
| 3 — Events enter | 20-90 | Scraps `paperSlide` from their side, stagger 14 frames. Node dot pops scale 0→1 on land |
| 4 — Parallax | 70-120 | Scraps drift, thread stays fixed as visual anchor |
| 5 — Exit | 120-150 | Scraps scatter outward, thread retracts upward |

### Components

- `TimelineThread.tsx` — animated vertical red line with node dots (pure CSS/div)
- `EventCard.tsx` — torn paper scrap with year + description
- Reuses: `TornEdge`, `PaperTexture`, `TapeMark`, `SerifHeadline`, `SectionLabel`

---

## Template 3: magazine-stats

**Purpose:** Numeric data displays — "Country at a Glance", "By the Numbers", "Key Figures"

### Schema

```ts
z.object({
  stats: z.array(z.object({
    value: z.string(),
    label: z.string(),
    unit: z.string().optional(),
  })).default([
    { value: '44.1M', label: 'Population' },
    { value: '$200B', label: 'GDP' },
    { value: '603,628', label: 'Area (km²)' },
    { value: '24', label: 'Regions' },
  ]),
  title: z.string().default('Ukraine at a Glance'),
})
```

### Layout

- **Title scrap:** Centered at ~y:150
- **Stat scraps:** 2-column scattered grid (same cell logic as `magazine-collage`'s `getFragmentPosition`)
  - Each ~460w x 280h torn paper
  - Value in hero-sized bold text (dark or red based on index)
  - Label below in small-caps accent font
  - Unit displayed inline with value
- First stat slightly larger (~500w x 320h) to create visual hierarchy
- Pin/tape decoration per scrap, deterministic by index

### Animation (150 frames)

| Phase | Frames | Action |
|-------|--------|--------|
| 1 — Title enter | 0-15 | `paperSlide('up')` |
| 2 — Scraps enter | 10-70 | Mixed-direction `paperSlide`, stagger 10 frames |
| 3 — Count-up | 30-90 | Numeric values animate from 0 to final over 20 frames after scrap lands. Parses numeric portion from string, preserves prefix ($) and suffix (M, %, km²). Non-numeric values appear instantly |
| 4 — Parallax | 60-120 | Depth-based sine drift |
| 5 — Exit | 120-150 | Reverse scatter |

### Components

- `StatCard.tsx` — torn paper scrap with animated value + label
- `CountUp.tsx` — helper that extracts numeric part from value string (e.g. "$200B" → prefix:"$", number:200, suffix:"B"), interpolates the number, and reconstructs the display string
- Reuses: `TornEdge`, `PaperTexture`, `PinMark`/`TapeMark`

### Count-Up Logic

```
parseValue("$200B") → { prefix: "$", number: 200, suffix: "B" }
parseValue("44.1M") → { prefix: "", number: 44.1, suffix: "M" }
parseValue("603,628") → { prefix: "", number: 603628, suffix: "", commaFormatted: true }
```

Display during animation: `prefix + interpolate(frame, [start, start+20], [0, number]) + suffix`
Non-numeric values (e.g. "Kyiv") render immediately without animation.

---

## Template 4: magazine-comparison

**Purpose:** Side-by-side comparisons — "NATO vs BRICS", "Before vs After", "Policy A vs Policy B"

### Schema

```ts
z.object({
  leftLabel: z.string().default('NATO'),
  rightLabel: z.string().default('BRICS'),
  items: z.array(z.object({
    category: z.string(),
    left: z.string(),
    right: z.string(),
  })).default([
    { category: 'Members', left: '32 nations', right: '10 nations' },
    { category: 'GDP Share', left: '~45% of world', right: '~35% of world' },
    { category: 'Military', left: '3.5M active', right: '5.2M active' },
  ]),
})
```

### Layout

- **Header scrap:** Full-width torn paper strip at ~y:140, ~960w x 140h
  - `leftLabel` left-aligned, `rightLabel` right-aligned, thin red vertical divider at center
- **Center divider:** Torn vertical paper strip (~6px wide) running down the canvas center, slightly jagged via `generateTornClipPath` on a rotated axis
- **Row pairs:** Each row has:
  - Left scrap at x:~40, ~460w x 180h
  - Right scrap at x:~580, ~460w x 180h
  - `SectionLabel` with category name centered between rows
- Rows spaced ~300px apart

### Animation (150 frames)

| Phase | Frames | Action |
|-------|--------|--------|
| 1 — Header + divider | 0-20 | Header `paperSlide('down')`. Divider tears downward (height 0→full) |
| 2 — Rows enter | 15-80 | Left scraps from left, right scraps from right, simultaneous per row, stagger 12 frames between rows. Category label fades in |
| 3 — Parallax | 60-120 | Left column drifts slightly left, right drifts slightly right (opposing sine waves) for push-pull effect |
| 4 — Exit | 120-150 | Left column exits left, right exits right |

### Components

- `ComparisonHeader.tsx` — split header scrap with labels and red divider
- `ComparisonRow.tsx` — paired torn paper scraps (left value + right value)
- `CenterDivider.tsx` — animated torn vertical strip
- Reuses: `TornEdge`, `PaperTexture`, `TapeMark`, `SerifHeadline`, `SectionLabel`

---

## Template 5: magazine-factfile

**Purpose:** Structured profiles — "Country Profile: Ukraine", "Organization Dossier", "Leader Bio"

### Schema

```ts
z.object({
  title: z.string().default('Ukraine'),
  subtitle: z.string().default('Country Profile'),
  fields: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })).default([
    { key: 'Capital', value: 'Kyiv' },
    { key: 'Population', value: '44.1 million' },
    { key: 'Language', value: 'Ukrainian' },
    { key: 'Currency', value: 'Hryvnia (UAH)' },
    { key: 'Government', value: 'Unitary semi-presidential republic' },
    { key: 'Leader', value: 'Volodymyr Zelenskyy' },
  ]),
})
```

### Layout

- **Single large torn paper scrap:** ~940w x ~1400h, centered, slight rotation (~1.5°)
- Feels like a dossier page or file folder pulled from a cabinet
- **Title:** Hero-sized `SerifHeadline` at top, with red underline rule (48w x 3h)
- **Subtitle:** `SectionLabel` below title
- **Fields:** Key-value rows with:
  - Key: left-aligned, small-caps accent font, secondary color
  - Value: right-aligned, bold body font, primary color
  - Faint 1px hairline rule separating each row
  - Rows ~100px apart
- **Paperclip decoration** at top-right corner: CSS-only rounded rectangle outline, slightly rotated, silver/grey gradient

### Animation (150 frames)

| Phase | Frames | Action |
|-------|--------|--------|
| 1 — Card enter | 0-25 | Large scrap `paperSlide('up')` — feels like pulling a file from a drawer |
| 2 — Title reveal | 20-40 | Title + subtitle via `editorialReveal` (fade + translateY) |
| 3 — Fields reveal | 35-100 | Rows reveal top-to-bottom, stagger 8 frames. Key fades in first, value slides to position 4 frames after |
| 4 — Parallax | 70-120 | Subtle whole-card sway (low amplitude: ±4px) |
| 5 — Exit | 120-150 | Card slides back down (reverse entrance) |

### Components

- `DossierCard.tsx` — large torn paper container with paperclip
- `FieldRow.tsx` — animated key-value row with hairline separator
- `PaperClip.tsx` — CSS-only paperclip decoration (rotated rounded-rect with inner cutout, silver gradient)
- Reuses: `TornEdge`, `PaperTexture`, `SerifHeadline`, `SectionLabel`, `editorialReveal`

---

## File Structure

Each template follows the established pattern:

```
packages/templates/src/templates/
├── magazine-checklist/
│   ├── meta.json
│   ├── metadata.json
│   ├── schema.ts
│   ├── index.tsx
│   ├── register.ts
│   └── components/
│       ├── ChecklistItem.tsx
│       └── CheckMark.tsx
├── magazine-timeline/
│   ├── meta.json
│   ├── metadata.json
│   ├── schema.ts
│   ├── index.tsx
│   ├── register.ts
│   └── components/
│       ├── TimelineThread.tsx
│       └── EventCard.tsx
├── magazine-stats/
│   ├── meta.json
│   ├── metadata.json
│   ├── schema.ts
│   ├── index.tsx
│   ├── register.ts
│   └── components/
│       ├── StatCard.tsx
│       └── CountUp.tsx
├── magazine-comparison/
│   ├── meta.json
│   ├── metadata.json
│   ├── schema.ts
│   ├── index.tsx
│   ├── register.ts
│   └── components/
│       ├── ComparisonHeader.tsx
│       ├── ComparisonRow.tsx
│       └── CenterDivider.tsx
└── magazine-factfile/
    ├── meta.json
    ├── metadata.json
    ├── schema.ts
    ├── index.tsx
    ├── register.ts
    └── components/
        ├── DossierCard.tsx
        ├── FieldRow.tsx
        └── PaperClip.tsx
```

## Registry Additions

Each template added to `registry.json` and `src/index.ts` with:
- `type: "registry:component"`, category `"overlay"`
- Tags: `["magazine-theme", "overlay", ...]` plus template-specific tags
- `stylePreset: "elegantEditorial"`, `aspectRatio: "9:16"`, `estimatedDuration: "5s"`
- `themes: ["magazine"]`

## Out of Scope

- No new shared magazine modules needed — existing set covers all requirements
- No new fonts — all use Playfair Display, Lora, Merriweather
- No background colors — all transparent overlays
- The 4 deferred concepts (quote, ranking, cause-effect, pull-quotes) are not part of this batch
