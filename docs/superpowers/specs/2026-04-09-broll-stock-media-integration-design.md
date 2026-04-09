# B-Roll Stock Media Integration — Design Spec

**Date:** 2026-04-09
**Status:** Draft
**Theme context:** Magazine + Vox (new DNA system)

---

## Problem

The pipeline is animation-only. Every scene gets a generated Remotion component. But not every concept is best represented as animation — concrete, real-world subjects (objects, places, people, actions) are better shown as stock footage. The viewer needs visual variety: the contrast between smooth real footage and styled graphics creates rhythm and credibility (especially critical for Vox's documentary identity).

## Solution

Add stock B-roll as a first-class visual mode alongside animations. The Planner decides per-scene whether to use animation, B-roll, or a hybrid. A new Asset Scout agent searches and downloads footage from Pexels. Pre-built display components render B-roll with theme-aware treatments (borders, grain, frames). The existing pipeline phases adapt minimally.

---

## 1. Planner Changes — `visualMode` Per Scene

### New required field in per-scene schema

```
**Visual mode:** animation | broll | hybrid
```

**Three modes:**

- **`animation`** — current behavior. Pure Remotion scene (data viz, process flow, metaphor, abstract concept).
- **`broll`** — stock footage/image is the primary visual with light treatment (borders, frames, filters). No .tsx scene file. Rendered by a pre-built display component.
- **`hybrid`** — stock footage used inside a template scene. The template handles composition (e.g., `vox-collage` with cutout photos, `vox-filmstrip` with image sequence, `vox-spotlight` with annotated photo). Still generates a .tsx scene file.

### Decision logic

**Can this concept be beautifully represented with animation?**

- Abstract concepts, data, processes, metaphors, comparisons → `animation`
- Concrete real-world subjects (objects, places, people, actions) → `broll`
- Evidence/archival that needs annotation or arrangement inside a template → `hybrid`

### Schema for `broll` scenes

When `visualMode: broll`, the scene entry replaces `Visual concept` / `Animation brief` / `Template` with:

```
### B-roll search
[1-3 Pexels search queries, ranked by priority. Specific and descriptive.]

### B-roll display
[One of the 12 display modes — see Section 3]

### B-roll treatment
[Styling instructions: border color/width, frame tilt, filter type, etc.
 Theme defaults apply if omitted.]
```

### Schema for `hybrid` scenes

When `visualMode: hybrid`, the scene keeps the normal `Template` / `Visual concept` / `Animation brief` fields, plus adds:

```
### B-roll search
[1-3 Pexels search queries for the assets the template needs]

### Asset count
[How many images/videos the template requires — e.g., "4 images" for a collage]
```

### Self-verification checklist additions

```
- [ ] Every scene has a Visual mode field (animation, broll, or hybrid)
- [ ] Every broll scene has B-roll search, B-roll display, and B-roll treatment
- [ ] Every hybrid scene has B-roll search, Asset count, and a Template
- [ ] B-roll search queries are specific and descriptive (not generic like "city" or "people")
- [ ] No broll scene uses overlay display mode vocabulary (overlay-large, center-card, etc.)
- [ ] Visual mode choices follow the decision logic: abstract → animation, concrete → broll, evidence+annotation → hybrid
```

---

## 2. Asset Scout Agent — New Pipeline Phase 3.5

A new subagent dispatched after the Planner and before Setup. Its sole job: turn B-roll search queries into downloaded assets.

### Behavior

1. Read `SCENE_PLAN.md`
2. Filter to scenes with `visualMode: broll` or `hybrid`
3. Read the active theme's `broll-dna.md` for search guidance (Vox: specific/archival, Magazine: clean/aspirational)
4. For each scene:
   - Search Pexels using queries in priority order
   - For video B-roll: prefer clips 5-15s, landscape orientation
   - For image B-roll: prefer high-res landscape
   - If primary query returns no results, try secondary/tertiary
   - Download best match to `/workspace/public/assets/broll/`
   - For `hybrid` scenes needing multiple assets: download the specified count
5. Write `ASSET_MANIFEST.md` mapping scene → asset paths + metadata

### ASSET_MANIFEST.md format

```markdown
## Scene 3: City Traffic
- **File:** /assets/broll/city-traffic-01.mp4
- **Type:** video
- **Duration:** 8200ms
- **Dimensions:** 1920x1080
- **Attribution:** John Doe / Pexels (https://pexels.com/video/12345)

## Scene 5: Evidence Collage
- **Files:**
  1. /assets/broll/newspaper-headline.jpg (4000x2667, Jane Smith / Pexels)
  2. /assets/broll/protest-crowd.jpg (3840x2160, Alex Chen / Pexels)
  3. /assets/broll/court-document.jpg (3200x2400, Maria Lopez / Pexels)
```

### Tools

- `search_pexels` — extended with `mediaType: "photo" | "video"` parameter
- `download_stock_asset` — renamed from `download_stock_photo`, supports both image and video
- `read_file` — to read SCENE_PLAN.md and broll-dna.md
- `write_file` — to write ASSET_MANIFEST.md

### Prompt location

`packages/sandbox/src/prompts/asset-scout/system.md`

### Orchestrator integration

- Dispatched after Planner returns, before Setup
- Skipped entirely if SCENE_PLAN.md contains zero broll/hybrid scenes (orchestrator checks before dispatching)
- Status message to user: "Finding footage..."

---

## 3. B-Roll Display Components

12 pre-built Remotion components for rendering B-roll. Located at `packages/sandbox/template/src/items/broll/`.

### Single clip modes

| Component | Display mode key | Description |
|---|---|---|
| `BrollFullscreen` | `fullscreen-cutaway` | Full 1080x1920 bleed. Hard cut. Speaker audio continues. |
| `BrollLetterboxed` | `letterboxed` | 16:9 clip centered, solid color bars top/bottom. |
| `BrollLetterboxedCaptions` | `letterboxed-captions` | Same as letterboxed but caption area reserved in bars. |
| `BrollRoundedFloat` | `rounded-float` | Clip with border-radius on colored/gradient background. Optional drop shadow. |
| `BrollPolaroid` | `polaroid` | White border (thicker bottom), optional slight tilt, optional tape graphic. |
| `BrollFilmTreatment` | `film-treatment` | Full-screen with applied filter: grain, VHS scanlines, desaturated, or duotone. |

### Stacked with speaker

| Component | Display mode key | Description |
|---|---|---|
| `BrollStacked50` | `stacked-50` | 50/50 split. B-roll top, speaker bottom. |
| `BrollStacked70` | `stacked-70` | 70/30 split. B-roll dominant (70% top), speaker smaller (30% bottom). |
| `BrollSpeakerPip` | `speaker-pip` | Full-screen B-roll, small speaker in rounded-rect corner PiP. |

### Multi-clip

| Component | Display mode key | Description |
|---|---|---|
| `BrollTripleStack` | `triple-stack` | 3 clips stacked vertically (33/33/33). |
| `BrollGrid` | `grid-2x2` | 4 clips in a 2x2 grid. |

### Speaker integration

| Component | Display mode key | Description |
|---|---|---|
| `BrollGreenscreen` | `greenscreen-bg` | Speaker matte in foreground, B-roll as background. Uses existing segmentation system. |

### Treatment props

Every display component accepts a `treatment` object with theme-aware defaults:

```typescript
interface BrollTreatment {
  borderColor?: string;      // default from theme design-system
  borderWidth?: number;      // px
  borderRadius?: number;     // px
  tilt?: number;             // degrees rotation
  filter?: 'none' | 'grain' | 'vhs' | 'desaturated' | 'duotone';
  filterIntensity?: number;  // 0-1
  roughEdges?: boolean;      // feTurbulence rough edge mask (Vox default: true)
}
```

### Theme defaults

**Vox:** `{ filter: 'grain', filterIntensity: 0.3, roughEdges: true, borderRadius: 0 }`
**Magazine:** `{ filter: 'none', roughEdges: false, borderRadius: 8, borderColor: '#FFFFFF' }`

---

## 4. Pipeline Phase Integration

### Updated pipeline flow

```
Phase 1:   Brief & Clarification (unchanged)
Phase 2:   Trimming (unchanged)
Phase 3:   Planning — Planner writes visualMode per scene
Phase 3.5: Asset Scout — searches/downloads stock assets (SKIPPED if no broll/hybrid)
Phase 4:   Setup — creates skeletons for animation scenes + broll items for broll scenes
Phase 5:   Depth Assets (unchanged)
Phase 6:   Layout Editor — places scene items AND broll items on timeline
Phase 7:   Animators in parallel — dispatched for animation + hybrid scenes only
Phase 8:   Final Assembly — extended to verify broll items
Phase 9:   Done
```

### Setup Agent changes

- **`animation` scenes:** creates scene skeleton .tsx files (current behavior)
- **`broll` scenes:** adds broll manifest items directly using `add_item` (no .tsx file — the display component handles rendering)
- **`hybrid` scenes:** creates scene skeleton with asset paths pre-populated in the DATA object from ASSET_MANIFEST.md

### Layout Editor changes

- Reads `ASSET_MANIFEST.md` to map scenes to downloaded asset paths
- For `broll` scenes: places broll items with display mode and treatment from SCENE_PLAN.md
- Handles speaker track transform adjustments for stacked/PiP layouts:
  - `stacked-50`: speaker gets `{y: 960, height: 960}`
  - `stacked-70`: speaker gets `{y: 1344, height: 576}`
  - `speaker-pip`: speaker gets `{x: 780, y: 1560, width: 240, height: 320, borderRadius: 16}`
  - `greenscreen-bg`: uses existing matte item system
- Same speaker-transform logic already exists for stacked scene items — reused here

### Animator changes (minimal)

- NOT dispatched for pure `broll` scenes
- For `hybrid` scenes: receives asset paths in skeleton DATA object, uses them inside template fork (e.g., `<Img src={DATA.photos[0]} />` inside a vox-collage)
- Same fork-template → animate flow as current behavior

### Final Editor changes

- Validates broll items have valid `src` paths that exist in `/workspace/public/assets/broll/`
- Renders test stills for broll scenes via `render_still`
- Checks attribution metadata is present on all broll items

---

## 5. Theme DNA Extensions

Each theme gets a new DNA file: `broll-dna.md`. Located alongside existing DNA files in `packages/worker/src/prompts/themes/{theme}/`.

### Vox `broll-dna.md`

- B-roll is evidence, not decoration. Every clip must serve the argument.
- Prefer archival/documentary footage over generic stock. Search queries should be specific ("1990s Tokyo subway crowd" not "city people").
- Film grain overlay at 25-35% opacity on all B-roll to unify with Vox texture.
- Rough edges (feTurbulence) on bordered/framed clips. No clean rectangles.
- Border animations stutter at 12fps. Footage stays smooth 30fps. The contrast is the point.
- Preferred display modes: `fullscreen-cutaway` for dramatic evidence, `letterboxed-captions` for cited sources, `polaroid` for archival photos, `greenscreen-bg` for immersive context.
- Multi-clip (`triple-stack`, `grid-2x2`) for montage/evidence-pile moments.
- Hard cut transitions only. No dissolves, no wipes.

### Magazine `broll-dna.md`

- B-roll is lifestyle context. Aspirational, clean, well-lit.
- Clean white or brand-color borders with subtle shadow.
- Smooth spring animations on frames (SMOOTH preset).
- Preferred display modes: `rounded-float` for product shots, `letterboxed` for cinematic moments, `stacked-50` for tutorial walkthroughs.
- No film grain, no rough edges, no VHS treatments.

### Integration with existing DNA

The Asset Scout reads `broll-dna.md` to guide search query style.

The Planner's existing `planner-dna.md` gets a new section — scene vocabulary for B-roll:

```
| Signal in transcript | Visual mode | Display mode |
|---|---|---|
| Speaker references a real place/object | broll | fullscreen-cutaway or letterboxed |
| "Look at this" / evidence citation | broll | letterboxed-captions |
| Montage of examples | broll | triple-stack or grid-2x2 |
| Photo needs annotation/analysis | hybrid | vox-spotlight or vox-collage template |
| Speaker in a different environment | broll | greenscreen-bg |
| Abstract concept, data, process | animation | (current behavior) |
```

### Workspace init

`workspace-init.ts` already copies DNA files for the active theme. `broll-dna.md` follows the same pattern — copied to `/workspace/docs/guidelines/broll-dna.md` if it exists.

---

## 6. Renderer & Editor Store Changes

### New manifest item type: `broll`

```json
{
  "id": "broll-1",
  "type": "broll",
  "trackId": "overlay-1",
  "startMs": 4000,
  "endMs": 8000,
  "data": {
    "src": "/assets/broll/golf-putter.mp4",
    "mediaType": "video",
    "displayMode": "letterboxed",
    "treatment": {
      "borderColor": "#FFFFFF",
      "borderWidth": 4,
      "borderRadius": 0,
      "tilt": 0,
      "filter": "grain",
      "filterIntensity": 0.3,
      "roughEdges": true
    },
    "attribution": {
      "photographer": "John Doe",
      "source": "pexels",
      "url": "https://pexels.com/video/12345"
    }
  },
  "transform": { "x": 0, "y": 0, "width": "100%", "height": "100%" }
}
```

### PlayerComposition.tsx

Add `broll` to the item type switch:

```tsx
case 'broll':
  return <BrollItem data={item.data} assets={assets} theme={videoSettings.theme} />;
```

### BrollItem.tsx — router component

Reads `data.displayMode`, delegates to the correct display component. Each display component:

- Handles its own layout (letterbox bars, borders, PiP positioning)
- Applies treatment (grain overlay, rough edges, color filters)
- Reads theme for default treatment values
- Uses `<Video>` from Remotion for video assets, `<Img>` for images
- Auto-detects image vs video from file extension

### Editor store types

`BrollItemData` interface added to the TimelineItem data union:

```typescript
type BrollDisplayMode =
  | 'fullscreen-cutaway'
  | 'letterboxed'
  | 'letterboxed-captions'
  | 'rounded-float'
  | 'polaroid'
  | 'film-treatment'
  | 'stacked-50'
  | 'stacked-70'
  | 'speaker-pip'
  | 'triple-stack'
  | 'grid-2x2'
  | 'greenscreen-bg';

interface BrollTreatment {
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  tilt?: number;
  filter?: 'none' | 'grain' | 'vhs' | 'desaturated' | 'duotone';
  filterIntensity?: number;
  roughEdges?: boolean;
}

interface BrollAttribution {
  photographer: string;
  source: 'pexels';
  url: string;
}

interface BrollItemData {
  src: string;
  mediaType: 'image' | 'video';
  displayMode: BrollDisplayMode;
  treatment: BrollTreatment;
  attribution?: BrollAttribution;
}
```

### Pexels API extension

**`search_pexels` tool:** Add `mediaType` parameter.
- `mediaType: "photo"` → `api.pexels.com/v1/search` (current)
- `mediaType: "video"` → `api.pexels.com/videos/search` (new endpoint)

**`download_stock_photo`** → renamed to **`download_stock_asset`**. Supports both image and video downloads. Saves to `/workspace/public/assets/broll/` subdirectory.

---

## 7. Out of Scope

Explicitly not included in this design:

- **No B-roll editor UI** — agent places B-roll through pipeline only. No drag-and-drop panel, no manual Pexels browser in editor.
- **No user-uploaded B-roll** — only Pexels-sourced assets via Asset Scout.
- **No Ken Burns / zoom effects** — footage plays at native framing. No pan/zoom.
- **No video speed ramping** — B-roll video plays at 1x.
- **No audio from B-roll** — B-roll video is always muted. Speaker audio continues as voiceover.
- **No Unsplash or Pixabay** — Pexels only for now.
- **No multi-clip transitions** — within triple-stack or grid, all clips display simultaneously. No sequential reveal or beat-synced switching.
- **No attribution watermark in render** — attribution stored in metadata for compliance. Pexels license does not require visible credit.
- **No B-roll editing tools** — no crop, trim, or color correction on B-roll clips through the editor UI.
