# Subtitle System V2 — Animations, Customization & UX

**Date:** 2026-01-27
**Status:** Ready for Implementation
**Scope:** Animation engine, enhanced presets, three-layer customization, hybrid subtitle editing UX

---

## 1. Animation Engine

The current system has 4 trivial animations (pop = 1.1x scale, fade = opacity, highlight = 1.05x scale, none). V2 introduces a proper animation engine supporting both viral/TikTok and cinematic/broadcast styles.

### Architecture

Every animation is a trio — an **entry** (word appears), an **active** state (word is currently spoken), and an **exit** (word finishes). Each phase is a pure function `(progress: 0-1) => CSSProperties` composed with an easing curve.

### Animation Library

| Category | Name | Entry | Active | Exit |
|----------|------|-------|--------|------|
| Viral | Elastic Pop | Spring scale 0→1.2→1 | Gentle pulse | Scale down + fade |
| Viral | Bounce Up | Slide up + overshoot | Subtle bounce | Drop down |
| Viral | Shake | Scale in | Random shake/wiggle | Scale out |
| Viral | Color Wipe | Gradient sweep L→R | Glow pulse | Reverse wipe |
| Viral | 3D Flip | rotateX(90°→0°) | None | rotateX(0°→-90°) |
| Viral | Punch | Scale 0→1.4→1 | None | Fast shrink |
| Cinematic | Fade Rise | Fade + translateY(10→0) | None | Fade + rise out |
| Cinematic | Typewriter | Letter-by-letter reveal | Cursor blink | Dissolve |
| Cinematic | Smooth Slide | Slide from left | None | Slide right |
| Cinematic | Soft Scale | Scale 0.8→1 + fade | None | Gentle fade |
| Cinematic | Underline Wipe | Text visible, underline sweeps in | Underline solid | Underline sweeps out |

### Easing Functions

- `linear` — constant rate
- `ease-out` — fast start, gentle stop
- `spring` — damped oscillation (configurable stiffness/damping)
- `elastic` — overshoot with bounce-back
- `bounce` — multiple diminishing bounces

Each preset references a specific animation combo. Users could eventually mix and match entry/active/exit independently.

---

## 2. Enhanced Presets

12 presets across three categories, each pairing typography + animation + color into a cohesive look.

| # | Name | Category | Font | Animation | Colors | Display Mode |
|---|------|----------|------|-----------|--------|-------------|
| 1 | **MrBeast Bold** | Viral | Montserrat 900 | Elastic Pop | White / Yellow | phrase |
| 2 | **Hormozi** | Viral | Inter 800 uppercase | Punch | White / Red | word-by-word |
| 3 | **TikTok Bounce** | Viral | Poppins 700 | Bounce Up | White / Cyan | phrase |
| 4 | **Glitch Out** | Viral | Space Grotesk 700 | Shake | Green / Magenta | word-by-word |
| 5 | **Neon Karaoke** | Viral | Inter 700 | Color Wipe | Cyan / Magenta glow | karaoke |
| 6 | **Cinema Fade** | Cinematic | Playfair Display 600 | Fade Rise | White / White | phrase |
| 7 | **Documentary** | Cinematic | Source Sans 400 | Soft Scale | White w/ stroke | phrase |
| 8 | **Keynote** | Cinematic | SF Pro / Inter 500 | Smooth Slide | White / Blue | phrase |
| 9 | **Typewriter** | Cinematic | JetBrains Mono 400 | Typewriter | Green on dark bg | karaoke |
| 10 | **Minimal** | Minimal | Inter 500 | Fade Rise | White w/ shadow | phrase |
| 11 | **Box Highlight** | Minimal | Inter 700 | Soft Scale | White on dark box | phrase |
| 12 | **Classic Sub** | Minimal | Inter 600 | None | White w/ stroke | phrase |

### Font Loading

Fonts load from Google Fonts on demand. A `fontRegistry` maps font names to URLs and available weights. In the editor, fonts load via `document.fonts`. For export, Remotion bundles fonts at render time.

### Preset Picker UI

The preset grid uses 3 tabs (Viral / Cinematic / Minimal). Each preset shows an animated preview thumbnail — a short looping demo of the style applied to sample text. Hovering a preset temporarily applies it to the live player preview. Clicking commits. A "Reset to preset" link restores original values after customization.

---

## 3. Three-Layer Customization

### Design Principle: Progressive Disclosure

The default view is dead simple. Power reveals itself only when you reach for it. Most users will pick a preset and ship. Power users get full control without the UI feeling cluttered.

### Layer 1 — Global Style

Applied to all captions in the project. This is what the preset sets. The Style panel default view shows only:

1. Preset grid (12 presets with animated previews, 3 tabs)
2. Position toggle (top / center / bottom)
3. Display mode toggle (word-by-word / phrase / karaoke)

Three controls. Pick a preset, pick position, pick mode. Done. Most users stop here.

A **"Customize" disclosure toggle** below the presets expands the full controls:

- **Font family** — picker with 20-30 curated Google Fonts, grouped by category (sans-serif, serif, mono, display). No free-text input. Each font name renders in its own typeface. Fonts load lazily as the picker scrolls (intersection observer).
- **Font size** — slider, 24-96px (existing)
- **Font weight** — slider or toggle (400/600/700/800/900)
- **Letter spacing** — slider, -2px to 8px
- **Text transform** — none / uppercase / lowercase toggle
- **Text color + Active color** — color pickers (existing, improved)
- **Background color + Active background** — color pickers (existing)
- **Background padding** — horizontal and vertical sliders (0-20px)
- **Background border radius** — slider 0-16px
- **Text stroke** — width slider (0-4px) + color picker
- **Text shadow** — preset shadows (none / soft / hard / glow)
- **Vertical offset** — fine-tune slider (existing `offsetY`)

Clearly labeled **"Applies to all captions"**. A "Reset to preset" link snaps everything back.

### Layer 2 — Per-Caption Overrides

When a user **double-clicks** a specific caption block (in timeline or transcript), the Style panel title changes to **"Caption #4"** with a back arrow to return to global view. The same controls appear, but edits scope to that one block only.

Data model: `styleOverrides: Partial<CaptionStyle>` stored on each `CaptionItemData`. Properties not overridden inherit from global via `resolveStyle()`.

Visual indicators:
- Timeline blocks with overrides show a subtle accent-colored border
- A **"Custom"** badge appears on overridden captions
- A **"Reset to global"** button clears all overrides for that caption

No deep navigation — just one level deep (global → specific caption → back).

### Layer 3 — Per-Word Overrides

Selecting a word in the transcript panel pops a **small floating toolbar** directly above the word (like Google Docs / Notion formatting bar). Four buttons:

- **Color** — color picker for that word
- **Bold** — toggle font weight override
- **Scale** — make the word 1.2x larger
- **Highlight BG** — add a background color behind the word

No panel navigation, no mode switch — contextual popover where your cursor already is.

Data model: `styleOverrides?: WordStyleOverrides` on the `SubtitleWord` object.

```typescript
interface WordStyleOverrides {
  color?: string;
  fontWeight?: number;
  scale?: number;        // 1.0 = normal, 1.2 = 20% bigger
  emphasisBg?: string;   // highlight background color
}
```

### Style Panel Breadcrumb

The panel header shows context: **"All Captions"** → **"Caption #4"**. Clicking the breadcrumb navigates up. Simple, one level.

---

## 4. Hybrid Subtitle Bar UX

Two complementary views — transcript panel for text work, timeline for timing work. Both stay synced.

### Transcript Panel

A scrollable list of caption blocks, each showing the spoken text. Core behaviors:

- **Auto-scroll** — follows the playhead during playback. A "Following" toggle in the header disables this.
- **Seek on click** — clicking a caption block seeks the player to that caption's start time.
- **Inline text editing** — click any caption text to edit. Typing updates the word list in real-time. Enter confirms, Escape cancels.
- **Split/merge** — a scissor icon appears between words on hover. Click to split the caption at that point. Drag one caption block onto another to merge.
- **Word-level selection** — click a word to select it (floating toolbar appears). Shift-click for multi-word selection. Selected words highlight in the timeline simultaneously.
- **Timing display** — subtle timestamp on the right edge of each block (e.g. "0:04.2"). Click the timestamp to manually type a time.
- **Search** — filter bar at the top to search across all caption text. Matches highlight and the list scrolls to the first result.

### Timeline Caption Track

Caption blocks as colored bars on a dedicated track. Waveform renders faintly behind the blocks.

- **Drag edges** to adjust start/end times. Edges snap to word boundaries by default (hold Alt to free-drag for frame-level precision).
- **Split at playhead** — click at playhead position + press S.
- **Drag to reposition** — blocks cannot overlap, they push neighbors aside.
- **Color coding** — blocks with per-caption overrides show an accent border. Selected block highlights in green accent.

### Waveform Rendering

Audio waveform on the caption timeline track is generated once on project load using Web Audio API `decodeAudioData`, cached as a flat array of amplitude values, and drawn as a lightweight canvas behind caption blocks.

### Sync Behavior

Selecting a caption in either view selects it in both. Scrolling the transcript during editing doesn't move the timeline, but selecting does. The playhead is the single source of truth for current position.

### Panel Docking

Transcript panel has a drag handle in its header. Drag to left edge, bottom edge, or release to float. Position persists in localStorage. Can be hidden entirely.

---

## 5. Data Model Changes

All new fields are optional with sensible defaults. Existing projects load without migration.

### SubtitleWord (existing + additions)

```typescript
interface SubtitleWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
  styleOverrides?: WordStyleOverrides;   // NEW
}

interface WordStyleOverrides {
  color?: string;
  fontWeight?: number;
  scale?: number;        // 1.0 = normal
  emphasisBg?: string;   // highlight background color
}
```

### AnimationConfig (new, replaces animation string)

```typescript
type AnimationType =
  | 'none'
  | 'elastic-pop' | 'bounce-up' | 'shake' | 'color-wipe' | '3d-flip' | 'punch'
  | 'fade-rise' | 'typewriter' | 'smooth-slide' | 'soft-scale' | 'underline-wipe';

type EasingType = 'linear' | 'ease-out' | 'spring' | 'elastic' | 'bounce';

interface AnimationConfig {
  in: AnimationType;
  active: AnimationType;
  out: AnimationType;
  easing: EasingType;
}
```

### CaptionStyle (existing + additions)

```typescript
interface CaptionStyle {
  // Existing
  displayMode: 'word-by-word' | 'phrase' | 'karaoke';
  wordsPerPhrase: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  activeColor: string;
  backgroundColor: string;
  activeBackgroundColor: string;
  textStroke?: string;
  textShadow?: string;
  position: 'top' | 'center' | 'bottom';
  offsetY: number;
  textAlign: 'left' | 'center' | 'right';

  // CHANGED — was string, now object
  animation: AnimationConfig;

  // NEW
  letterSpacing?: number;          // default 0
  textTransform?: 'none' | 'uppercase' | 'lowercase';  // default 'none'
  backgroundPadding?: { x: number; y: number };         // default { x: 4, y: 2 }
  backgroundRadius?: number;       // default 0
  presetId?: string;               // reference to source preset
}
```

### CaptionItemData (existing + additions)

```typescript
interface CaptionItemData {
  text: string;
  words: CaptionWord[];
  style: CaptionStyle;
  styleOverrides?: Partial<CaptionStyle>;  // NEW — per-caption overrides
}
```

### Backward Compatibility

When loading old projects:

- `animation: 'pop'` (string) migrates to `{ in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' }` at load time via a `migrateStyle()` function in the store. No database migration needed.
- `animation: 'fade'` → `{ in: 'fade-rise', active: 'none', out: 'fade-rise', easing: 'ease-out' }`
- `animation: 'highlight'` → `{ in: 'soft-scale', active: 'none', out: 'none', easing: 'ease-out' }`
- `animation: 'none'` → `{ in: 'none', active: 'none', out: 'none', easing: 'linear' }`
- Missing new fields filled by `resolveStyle()` which merges `defaults → global → captionOverrides → wordOverrides`.

---

## 6. Component Architecture

### Animation Engine — `packages/renderer/src/animations/`

```
animations/
├── types.ts          — AnimationType, AnimationConfig, EasingType
├── easing.ts         — easing functions (spring, elastic, bounce, ease-out)
├── animations.ts     — each animation as (progress: number) => CSSProperties
├── resolve.ts        — compose entry/active/exit phases for a given frame
└── index.ts          — public API
```

Lives in `packages/renderer` so both the editor preview (`Composition.tsx`) and the export renderer (`AnimatedSubtitle.tsx`) share the exact same animation code. No visual drift between preview and export.

### Style Resolution — `packages/shared/src/styles/`

```
styles/
├── resolve-style.ts  — resolveStyle(global, captionOverrides?, wordOverrides?) → ComputedStyle
├── migrate-style.ts  — old animation string → AnimationConfig object
└── font-registry.ts  — font name → Google Fonts URL + metadata
```

### Editor Components — `apps/web/src/features/editor-v2/`

- **`panels/StylePanel.tsx`** — refactored. Top: preset grid with 3 tabs. Below: position + display mode. "Customize" disclosure for full controls. Context-aware header when specific caption selected.
- **`panels/TranscriptPanel.tsx`** — NEW. Scrollable transcript view with inline editing, split/merge, word selection, search, auto-scroll.
- **`panels/WordToolbar.tsx`** — NEW. Floating popover for per-word styling. Positioned above selected word in transcript.
- **`timeline/CaptionTrack.tsx`** — NEW or refactored. Caption blocks on timeline with waveform background, drag-to-resize, snap-to-word.

### Preset Data — `apps/web/src/lib/subtitle-presets.ts`

Expands from 6 to 12 entries using the new `AnimationConfig` format. Grouped by `category: 'viral' | 'cinematic' | 'minimal'`.

---

## 7. Keyboard Shortcuts

### Global

| Key | Action |
|-----|--------|
| `S` | Toggle Style panel |
| `T` | Toggle Transcript panel |
| `Space` | Play / pause |
| `1` / `2` / `3` | Switch display mode (word-by-word / phrase / karaoke) |

### Transcript Panel

| Key | Action |
|-----|--------|
| `Enter` | Start inline text editing on selected caption |
| `Escape` | Exit editing / deselect |
| `Up` / `Down` | Navigate between caption blocks |
| `Shift+S` | Split caption at word cursor position |
| `Shift+M` | Merge selected caption with next |
| `Ctrl+F` | Focus search bar |

### Timeline

| Key | Action |
|-----|--------|
| `S` (playhead over caption) | Split at playhead |
| `Delete` / `Backspace` | Remove selected caption block |
| `Alt` + drag edge | Disable snap-to-word (frame-precise) |
| `Ctrl+D` | Duplicate selected caption block |

### Style Panel

| Key | Action |
|-----|--------|
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo (existing history stack) |
| Arrow keys | Navigate preset grid |
| `Enter` | Apply selected preset |

### Interaction Details

- **Preset hover preview** — hovering a preset temporarily applies it to the player. Moving away reverts. Clicking commits.
- **Drag-to-dock panels** — transcript panel drag handle in header. Dock to left, bottom, or float. Persists in localStorage.
- **Font preview** — each font name in the picker renders in its own typeface. Lazy-loaded via intersection observer.

---

## 8. Implementation Tracks

Three parallel tracks sharing the data model and animation engine:

### Track A: Animation Engine + Presets
1. Build animation engine (`packages/renderer/src/animations/`)
2. Implement all 11 animation types + 5 easing functions
3. Update `AnimatedSubtitle.tsx` and `Composition.tsx` to use new engine
4. Expand presets from 6 → 12 with new `AnimationConfig` format
5. Update preset picker UI with 3 tabs and animated previews
6. Add `migrateStyle()` for backward compatibility

### Track B: Customization System
1. Add new fields to shared types
2. Build `resolveStyle()` and `migrateStyle()` in `packages/shared`
3. Build `fontRegistry` with curated Google Fonts list
4. Refactor `StylePanel.tsx` — progressive disclosure layout
5. Build `WordToolbar.tsx` floating popover
6. Wire per-caption overrides (double-click → scoped editing)
7. Wire per-word overrides (transcript word selection → toolbar)

### Track C: Hybrid Subtitle UX
1. Build `TranscriptPanel.tsx` — scrollable transcript with auto-follow
2. Inline text editing with word list sync
3. Split/merge gestures (scissor icon, drag-to-merge)
4. Build or refactor `CaptionTrack.tsx` — waveform + drag-resize
5. Snap-to-word boundary logic
6. Panel docking system (drag handle, localStorage persistence)
7. Keyboard shortcuts for all interactions
