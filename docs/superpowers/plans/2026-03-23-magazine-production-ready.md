# Magazine Templates Production-Ready Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 29 magazine templates production-ready with proper labels, search, background preview controls, and consistent metadata.

**Architecture:** Three areas of work — (1) playground UX improvements (background toggle, search), (2) template metadata cleanup (names, descriptions, tags across all 29 meta.json + registry.json), (3) gallery card improvements. All changes are data/UI — no animation logic changes.

**Tech Stack:** React, Remotion, Zod, Vite, TypeScript

**Execution order:** Tasks 1, 5, 6 are playground code changes (independent of each other). Tasks 2, 3, 4 touch overlapping metadata files and MUST run sequentially in order (2 → 3 → 4). Task 7 runs last.

---

### Task 1: Add background toggle to PlayerWrapper

The playground renders transparent templates against a plain light gray page. There's no way to preview how overlays look on dark video, light video, or verify transparency. Add a background selector.

**Files:**
- Modify: `packages/templates/playground/components/PlayerWrapper.tsx`
- Modify: `packages/templates/playground/components/TemplateDetail.tsx`
- Modify: `packages/templates/playground/components/TemplateGallery.tsx`
- Modify: `packages/templates/playground/theme.ts`

- [ ] **Step 1: Add background mode type and CSS to theme.ts**

The current `theme.ts` exports only a `const t` object. Add the background mode type and styles. Use `CSSProperties` from React:

```typescript
import type { CSSProperties } from 'react';

export type BgMode = 'checkerboard' | 'dark' | 'light' | 'none';

export const bgModeStyles: Record<BgMode, CSSProperties> = {
  checkerboard: {
    backgroundImage: [
      'linear-gradient(45deg, #ccc 25%, transparent 25%)',
      'linear-gradient(-45deg, #ccc 25%, transparent 25%)',
      'linear-gradient(45deg, transparent 75%, #ccc 75%)',
      'linear-gradient(-45deg, transparent 75%, #ccc 75%)',
    ].join(', '),
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
    backgroundColor: '#e8e8e8',
  },
  dark: { backgroundColor: '#1a1a2e' },
  light: { backgroundColor: '#f8fafc' },
  none: { backgroundColor: 'transparent' },
};
```

- [ ] **Step 2: Add bgMode prop to PlayerWrapper**

In `PlayerWrapper.tsx`, import `BgMode` and `bgModeStyles` from `../theme`. Add `bgMode?: BgMode` to the `PlayerWrapperProps` interface.

In the main Player render path (line ~157-179), wrap the `<Player>` in a background div. The `borderRadius: 8` and `overflow: 'hidden'` move from the Player's `style` to this wrapper:

```tsx
return (
  <TemplateBoundary templateId={template.id}>
    <div style={{
      borderRadius: 8,
      overflow: 'hidden',
      maxWidth: effectiveMaxWidth,
      width: '100%',
      ...bgModeStyles[bgMode ?? 'none'],
    }}>
      <Player
        key={`${template.id}-${aspect}`}
        component={Component!}
        inputProps={props}
        durationInFrames={durationInFrames}
        compositionWidth={dims.width}
        compositionHeight={dims.height}
        fps={fps}
        style={{ width: '100%' }}
        controls={controls}
        autoPlay={autoPlay}
        loop
        initiallyMuted
      />
    </div>
  </TemplateBoundary>
);
```

Also apply the background style to the skeleton and error states for visual consistency. For the skeleton (line ~131-136), add `...bgModeStyles[bgMode ?? 'none']` to the outer div. For the error state (line ~141-154), same.

- [ ] **Step 3: Add background selector to TemplateDetail**

In `TemplateDetail.tsx`, import `BgMode` from `../theme`. Add state:

```tsx
const [bgMode, setBgMode] = useState<BgMode>('checkerboard');
```

Add a button group next to the existing aspect ratio / duration selectors. Use text labels for accessibility:

```tsx
const BG_OPTIONS: { key: BgMode; label: string }[] = [
  { key: 'checkerboard', label: 'Check' },
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
  { key: 'none', label: 'None' },
];
```

Render as small buttons styled like the existing aspect/duration selectors. Pass `bgMode={bgMode}` to the `PlayerWrapper`.

- [ ] **Step 4: Default gallery cards to dark background**

In `TemplateGallery.tsx`, pass `bgMode="dark"` to the gallery card `PlayerWrapper` so overlay thumbnails preview against a dark background (simulating video underneath). The gallery's `PlayerWrapper` does NOT have its own `borderRadius` — the card's container div already handles that with `borderRadius: '10px 10px 0 0'`.

- [ ] **Step 5: Verify in browser**

Run: `pnpm --filter @viona/templates playground`
- Open http://localhost:3200/
- Gallery cards should render with dark backgrounds
- Click any magazine template → detail view
- Toggle between Check/Dark/Light/None backgrounds
- Checkerboard should make transparency visible
- Dark background should simulate video content behind overlay

- [ ] **Step 6: Commit**

```bash
git add packages/templates/playground/theme.ts packages/templates/playground/components/PlayerWrapper.tsx packages/templates/playground/components/TemplateDetail.tsx packages/templates/playground/components/TemplateGallery.tsx
git commit -m "feat(playground): add background mode toggle for transparent template preview"
```

---

### Task 2: Improve template names in meta.json

Many template names are generic ("Magazine Stats", "Magazine Steps"). Update all 29 meta.json files with more descriptive names.

**Files:**
- Modify: `packages/templates/src/templates/magazine-*/meta.json` (29 files)

- [ ] **Step 1: Update all meta.json name fields**

Apply these name changes (only changing the `"name"` field in each meta.json, leave all other fields untouched):

| Slug | New Name |
|------|----------|
| magazine-agenda | Magazine Schedule |
| magazine-alert | Magazine Breaking News |
| magazine-beforeafter | Magazine Before & After |
| magazine-chart | Magazine Bar Chart |
| magazine-checklist | Magazine Checklist |
| magazine-collage | Magazine Photo Collage |
| magazine-comparison | Magazine Side-by-Side |
| magazine-country | Magazine Country Highlight |
| magazine-definition | Magazine Word Definition |
| magazine-didyouknow | Magazine Fun Fact |
| magazine-factfile | Magazine Dossier Card |
| magazine-inkmap | Magazine Ink Map |
| magazine-location | Magazine Location Spotlight |
| magazine-mythfact | Magazine Myth Buster |
| magazine-newspaper | Magazine Newspaper |
| magazine-pricetag | Magazine Price Reveal |
| magazine-profile | Magazine Bio Card |
| magazine-proscons | Magazine Pros & Cons |
| magazine-quote | Magazine Quote Card |
| magazine-ranking | Magazine Top List |
| magazine-stats | Magazine Stat Grid |
| magazine-steps | Magazine Step Flow |
| magazine-takeaways | Magazine Key Takeaways |
| magazine-timeline | Magazine Timeline |
| magazine-trivia | Magazine Quiz Card |
| magazine-typewriter | Magazine Typewriter |
| magazine-verdict | Magazine Verdict Card |
| magazine-versus | Magazine VS Matchup |
| magazine-warning | Magazine Caution Card |

- [ ] **Step 2: Verify names render in playground**

Run: `pnpm --filter @viona/templates playground`
- Scroll through gallery — each card should show the new name
- Search "Breaking News" — should find magazine-alert

- [ ] **Step 3: Commit**

```bash
git add packages/templates/src/templates/magazine-*/meta.json
git commit -m "feat(templates): improve magazine template display names for clarity"
```

---

### Task 3: Update registry.json descriptions

Sync registry.json with updated template context. **Do NOT change the `name` field in registry.json** — it uses slugs (e.g., `magazine-alert`), not display names. Only update `description` and `categories` fields.

**Files:**
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Update registry descriptions**

Update the `description` field for each magazine entry. Keep existing descriptions that are already clear. Fix these specific entries:

| Slug | Updated Description |
|------|-------------------|
| magazine-agenda | Time-slot schedule overlay with vertical timeline for event agendas and daily routines |
| magazine-alert | Breaking news alert banner with urgent stamp, red flash, and headline reveal |
| magazine-beforeafter | Split before/after layout with directional entrances and arrow transition |
| magazine-chart | Horizontal bar chart with animated fill bars and labels for data visualization |
| magazine-checklist | Torn paper strips with animated checkmarks revealing a bullet-point list |
| magazine-collage | Torn paper clippings scatter and drift with parallax depth in a scrapbook collage |
| magazine-comparison | Side-by-side torn paper scraps comparing two subjects with a red center divider |
| magazine-country | Country polygon highlight on map tiles with camera zoom, city marker, and editorial label |
| magazine-definition | Term definition card with large word, pronunciation, and editorial definition text |
| magazine-didyouknow | Fun fact card with decorative question mark and editorial text reveal |
| magazine-factfile | Dossier-style torn paper card with key-value fields revealing line by line |
| magazine-inkmap | Cartographic ink map with desaturated tiles, animated pin drop, and radar pulse |
| magazine-location | Location spotlight card with place name, coordinates, and key details |
| magazine-mythfact | Myth-busting overlay with animated strike-through on the myth and fact reveal below |
| magazine-newspaper | Newspaper front page unfolds with 3D perspective, zooms into headline, then tears away |
| magazine-pricetag | Large price figure with cost breakdown items for price reveals |
| magazine-profile | Person bio card with circular avatar placeholder, name, title, and key details |
| magazine-proscons | Two-column pros and cons list with checkmark and cross icons |
| magazine-quote | Editorial quote card with large quotation marks, attribution, and context line |
| magazine-ranking | Numbered ranked list with large rank numbers on torn paper strips |
| magazine-stats | Bold statistics on scattered paper scraps with animated count-up numbers |
| magazine-steps | Step-by-step numbered flow with connecting dashed line for tutorials |
| magazine-takeaways | Key takeaways summary card with numbered bullet points for recap content |
| magazine-timeline | Historical events pinned to a vertical red thread with torn paper scraps |
| magazine-trivia | Question card with dramatic pause and answer reveal for quiz content |
| magazine-typewriter | Typewriter-style character-by-character text reveal on fresh paper |
| magazine-verdict | Verdict card with animated rating ring, highlight bullets, and recommendation line |
| magazine-versus | Dramatic VS matchup overlay with center badge, opposing names, and stat bullets |
| magazine-warning | Caution overlay with warning header and flagged bullet items for red flags |

Also ensure `magazine-country` has `"categories": ["geographic"]` (it already should).

- [ ] **Step 2: Verify JSON is valid**

```bash
cd packages/templates && node -e "JSON.parse(require('fs').readFileSync('registry.json','utf-8')); console.log('Valid JSON')"
```

- [ ] **Step 3: Commit**

```bash
git add packages/templates/registry.json
git commit -m "feat(registry): update magazine template descriptions for production"
```

---

### Task 4: Standardize tags across all magazine templates

Add content-type tags to improve searchability. Check each template's existing tags FIRST to avoid duplicates.

**Files:**
- Modify: `packages/templates/src/templates/magazine-*/meta.json` (29 files)
- Modify: `packages/templates/registry.json`

- [ ] **Step 1: Add content-type tags to meta.json**

For each template, read the existing `tags` array in its meta.json. Only add tags from the table below that are NOT already present:

| Slug | Tags to add (if not already present) |
|------|--------------------------------------|
| magazine-agenda | `"schedule"` |
| magazine-alert | `"breaking-news"`, `"urgent"` |
| magazine-beforeafter | `"transformation"` |
| magazine-chart | `"data-viz"` |
| magazine-checklist | `"list"` |
| magazine-collage | `"scrapbook"`, `"photos"` |
| magazine-comparison | `"side-by-side"` |
| magazine-country | `"country"` |
| magazine-definition | `"explainer"`, `"vocabulary"` |
| magazine-didyouknow | `"fun-fact"` |
| magazine-factfile | `"dossier"` |
| magazine-inkmap | `"location"`, `"travel"` |
| magazine-location | `"travel"` |
| magazine-mythfact | `"debunk"` |
| magazine-newspaper | `"headline"`, `"news"` |
| magazine-pricetag | `"price"`, `"finance"` |
| magazine-profile | `"person"`, `"bio"` |
| magazine-proscons | `"decision"` |
| magazine-quote | `"testimonial"` |
| magazine-ranking | `"listicle"`, `"top-list"` |
| magazine-stats | `"numbers"`, `"data"` |
| magazine-steps | `"tutorial"`, `"how-to"` |
| magazine-takeaways | `"summary"`, `"recap"` |
| magazine-timeline | `"chronology"`, `"history"` |
| magazine-trivia | `"quiz"` |
| magazine-typewriter | `"text-reveal"`, `"typing"` |
| magazine-verdict | `"score"` |
| magazine-versus | `"matchup"`, `"battle"` |
| magazine-warning | `"caution"`, `"red-flag"` |

- [ ] **Step 2: Sync tags to registry.json**

For each magazine entry in registry.json, copy the final `tags` array from the corresponding meta.json so they match exactly.

- [ ] **Step 3: Commit**

```bash
git add packages/templates/src/templates/magazine-*/meta.json packages/templates/registry.json
git commit -m "feat(templates): standardize content-type tags across magazine templates"
```

---

### Task 5: Add description search to gallery

The gallery search checks ID, name, and tags — but not description. Adding description search helps users find templates by what they do.

**Files:**
- Modify: `packages/templates/playground/components/TemplateGallery.tsx`

- [ ] **Step 1: Add description to search filter**

In `TemplateGallery.tsx`, modify the search filter (around line 26-30):

```typescript
if (q) {
  const idMatch = tpl.id.toLowerCase().includes(q);
  const nameMatch = tpl.name.toLowerCase().includes(q);
  const descMatch = tpl.description.toLowerCase().includes(q);
  const tagMatch = tpl.tags.some((tag) => tag.toLowerCase().includes(q));
  if (!idMatch && !nameMatch && !descMatch && !tagMatch) return false;
}
```

- [ ] **Step 2: Verify search**

Run: `pnpm --filter @viona/templates playground`
- Search "torn paper" — should find templates with torn paper in description
- Search "quiz" — should find magazine-trivia via tags
- Search "magazine-alert" — should find via ID

- [ ] **Step 3: Commit**

```bash
git add packages/templates/playground/components/TemplateGallery.tsx
git commit -m "feat(playground): add description search to template gallery filter"
```

---

### Task 6: Show content-type tags on gallery cards

Gallery cards currently show only category and theme badges. Add the first 3 content-specific tags as pills for discoverability.

**Files:**
- Modify: `packages/templates/playground/components/TemplateGallery.tsx`

- [ ] **Step 1: Add tag pills to TemplateCard**

In the `TemplateCard` component (around line 209-238), after the existing theme name spans, add content-type tag pills. These are display-only (no click handler needed — users can type tags in the search bar):

```tsx
{template.tags
  .filter((tag) => tag !== 'magazine-theme' && tag !== 'overlay')
  .slice(0, 3)
  .map((tag) => (
    <span
      key={tag}
      style={{
        fontSize: 10,
        background: t.bgRaised,
        borderRadius: 4,
        padding: '2px 6px',
        color: t.text3,
        fontWeight: 500,
      }}
    >
      {tag}
    </span>
  ))}
```

- [ ] **Step 2: Verify card tags render**

Run playground, check that cards show 2-3 content-type tags (e.g., "quiz", "engagement" on trivia card).

- [ ] **Step 3: Commit**

```bash
git add packages/templates/playground/components/TemplateGallery.tsx
git commit -m "feat(playground): show content-type tags on gallery cards"
```

---

### Task 7: TypeScript and runtime verification

Final pass — ensure everything compiles and runs correctly.

**Files:**
- None (verification only)

- [ ] **Step 1: TypeScript check**

```bash
cd packages/templates && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Start playground**

```bash
pnpm --filter @viona/templates playground
```

Expected: Vite starts on port 3200 with no errors.

- [ ] **Step 3: Verify all 32 templates load**

Open http://localhost:3200/. The header should show "32 templates". Clear search, select "All Categories", "All Themes". Scroll through and verify:
- All 29 magazine templates appear with new names
- All 3 non-magazine templates appear
- No render errors on any card
- Background toggle works on detail view
- Gallery cards show dark backgrounds with tag pills

- [ ] **Step 4: Verify search combinations**

Test these searches:
- "country" → finds magazine-country and country-highlight
- "magazine-alert" → finds via slug
- "Breaking News" → finds magazine-alert via name
- "torn paper" → finds templates via description
- "quiz" → finds magazine-trivia via tag

- [ ] **Step 5: Commit if any fixes needed**

Only stage specific files that were fixed:
```bash
git add <specific-files-that-changed>
git commit -m "fix(templates): address verification issues"
```
