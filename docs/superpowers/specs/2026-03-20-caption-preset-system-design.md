# Caption Preset System Design

## Problem

Caption editing is broken across multiple layers:

1. **ID mismatch**: Frontend store uses DB-generated IDs for caption items. Sandbox manifest uses agent-generated IDs. Per-item style operations (`updateItem`) fail with "Item not found" because the sandbox doesn't recognize DB IDs.
2. **Split source of truth**: Frontend stores caption style on each item's `data.style`. Sandbox stores it on `manifest.captionStyle` (global). The Remotion renderer reads the global field. These two models contradict each other.
3. **No preset abstraction**: Caption presets (Hormozi, MrBeast, etc.) are defined as flat style objects in `subtitle-presets.ts` with no support for word emphasis rules, multi-font mappings, or speaker-aware layout. The system can't grow.
4. **Missing re-render**: `syncWorkspaceManifest()` was never called after caption style updates, so the local player didn't reflect changes.
5. **Click propagation**: Clicking a caption in the video preview selected the video underneath due to event bubbling.

## Design Principles

- **Preset is the central authority.** All caption appearance is governed by a `CaptionPreset` object. Both AI and users operate by selecting or tweaking presets — never by setting inline styles on individual items.
- **Caption items carry content, not style.** Items hold words (text + timing + optional role assignment). Style resolution happens at render time: `preset + word.role → final appearance`.
- **One path for all style operations.** Every style change — preset selection, font size tweak, position drag — goes through `updateCaptionPreset()`. No item IDs involved. No routing between global vs per-item paths.
- **Schema-ready for future complexity.** The preset model has extension points for speaker-aware positioning, dynamic line breaking, multi-font hierarchies, and dynamic resizing — without requiring schema changes when those features ship.

## Data Model

### CaptionPreset

Lives at `manifest.captionPreset`. Replaces `manifest.captionStyle`.

```typescript
interface CaptionPreset {
  // Identity
  presetId: string;              // 'hormozi', 'mrbeast', 'karaoke', custom ID

  // Typography (base)
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  textTransform: TextTransform;
  lineHeight: number;

  // Colors (base)
  color: string;                 // Inactive word color
  activeColor: string;           // Active/highlighted word color
  backgroundColor: string;
  activeBackgroundColor: string;
  backgroundPadding: { x: number; y: number };
  backgroundRadius: number;
  opacity: number;

  // Effects
  stroke: StrokeConfig | null;
  textShadow: string | null;
  textStroke: string | null;
  effects: EffectsConfig;

  // Layout & Position
  position: CaptionPosition;
  displayMode: CaptionDisplayMode;  // 'word-by-word' | 'phrase' | 'karaoke'
  wordsPerPhrase: number;

  // Animation
  animation: AnimationConfig;

  // Word Emphasis Rules
  wordEmphasis?: {
    enabled: boolean;
    roles: Record<string, WordRoleStyle>;
  };

  // Future extension points (not implemented, schema-ready)
  // speakers?: SpeakerConfig;
  // lineBreaking?: LineBreakingConfig;
  // dynamicResize?: DynamicResizeConfig;
}
```

### CaptionPosition

Already exists in `types.ts`. The preset uses the same type:

```typescript
interface CaptionPosition {
  anchor?: 'top' | 'center' | 'bottom';
  mode?: 'anchor' | 'free';     // 'free' when user drags to custom position
  x?: number;                    // 0-100% of canvas (free mode)
  y?: number;                    // 0-100% of canvas (free mode)
  offsetX?: number;              // Pixel offset from anchor (anchor mode)
  offsetY?: number;
  width?: number;                // 20-100% of canvas
  rotation?: number;
  textAlign?: 'left' | 'center' | 'right';
}
```

Note: The existing `CaptionPosition` type in `types.ts` has required fields (`anchor`, `offsetX`, etc.). The preset should accept `Partial<CaptionPosition>` with defaults resolved at the renderer boundary. The sandbox renderer (`CaptionItem.tsx`) currently only handles anchor mode. Free mode support (`x`/`y` positioning) is out of scope for this spec — the CaptionDragOverlay converts free-mode coordinates to `offsetX`/`offsetY` for the renderer. Full free-mode rendering can be added later.

### CaptionDisplayMode

No change needed — the existing type already covers the three supported modes:

```typescript
type CaptionDisplayMode = 'word-by-word' | 'phrase' | 'karaoke';
```

`dynamic-hierarchy` is deprecated and removed from display mode options.

### WordRoleStyle

Per-role overrides. The preset defines roles (e.g., `power`, `medium`, `filler`). AI assigns words to roles. The renderer resolves role style over preset defaults.

```typescript
interface WordRoleStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  activeColor?: string;
  scale?: number;
  letterSpacing?: number;
  textTransform?: TextTransform;
  emphasisBg?: string;
}
```

### Caption Item Data (content only)

```typescript
interface CaptionItemData {
  words: CaptionWord[];
  // No style field. Style comes from the preset.
}

interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
  role?: string;         // References preset.wordEmphasis.roles key
  speakerId?: string;    // Future: for speaker-aware positioning
}
```

### Future: Speaker Config

Not implemented now. The preset schema supports it when ready:

```typescript
interface SpeakerConfig {
  enabled: boolean;
  profiles: Record<string, {
    position?: CaptionPosition;
    style?: Partial<WordRoleStyle>;
  }>;
  lineBreaking?: {
    strategy: 'auto' | 'semantic' | 'fixed';
    maxCharsPerLine?: number;
    preferBreakAtPunctuation?: boolean;
  };
}
```

## Data Flow

```
User selects preset       AI selects preset
        │                        │
        ▼                        ▼
┌────────────────────────────────────┐
│      manifest.captionPreset        │  ← Single source of truth
│      (global style contract)       │
└─────────────────┬──────────────────┘
                  │
┌─────────────────┴──────────────────┐
│      manifest.items (captions)     │  ← Content only
│      words[], timing, roles        │
│      NO per-item style             │
└─────────────────┬──────────────────┘
                  │
┌─────────────────┴──────────────────┐
│      Renderer resolves:            │
│      preset + word.role → style    │
└────────────────────────────────────┘
```

### Style Update Path

All style operations use one path:

```
StylePanel / DragOverlay / AI
  → updateCaptionPreset(updates)
    → set({ captionPreset: merged })
    → pushHistory()
    → syncWorkspaceManifest()
    → dispatchManifestOp({ op: 'update_caption_preset', updates })
      → PATCH /workspace/manifest
        → sandbox deep-merges into manifest.captionPreset
```

No item IDs. No routing between global and per-item paths. One function, one dispatch.

### Word Content Update Path

Word-level edits (text editing, role assignment, caption splitting/merging) remain per-item:

```
Caption text editor / AI word classifier
  → updateCaptionWords(captionId, words)
    → dispatchOps([{ tool: 'updateItem', input: { itemId, data: { words } } }])
```

These ops reference item IDs and are subject to the same frontend/sandbox ID mismatch. However, word content editing is only triggered from contexts where IDs are consistent: the caption split/merge UI operates on frontend IDs and dispatches to the API (not sandbox), while AI word classification operates entirely within the sandbox using sandbox IDs. Cross-context word editing (frontend editing sandbox items by ID) is a known limitation — out of scope for this spec but acknowledged as a future sync concern.

### Dual Dispatch: API Server + Sandbox

Style updates go through two paths simultaneously:

1. **API server** (persistence): `dispatchManifestOp()` → `api.applyManifestOp()` → `PATCH /workspace/manifest` → `applyManifestOperation()` in `workspace-service.ts` → applies `update_caption_preset` op via `manifest-ops.ts` → persisted to disk
2. **Sandbox** (live preview): The API route calls `emitManifestUpdated()` which notifies the sandbox of the change. The sandbox re-reads the manifest.

Both the shared `manifest-ops.ts` (used by API server) and the sandbox `updateCaptionPresetTool` (used by AI agents) need to be updated to use `captionPreset`.

## Migration

### Manifest

On load, if `captionPreset` is missing but `captionStyle` exists:
```typescript
manifest.captionPreset = {
  ...manifest.captionStyle,
  presetId: manifest.captionStyle.presetId ?? 'default',
};
delete manifest.captionStyle;
```

### Word Fields: `classification` + `styleOverrides` → `role`

The existing codebase uses two word-level fields for emphasis:
- `CaptionWord.classification?: 'power' | 'medium' | 'filler'` — semantic role assigned by AI
- `CaptionWord.styleOverrides?: Record<string, unknown>` — inline style overrides per word

These are replaced by:
- `CaptionWord.role?: string` — references a key in `preset.wordEmphasis.roles`

Migration: `classification` maps directly to `role` (same values: `'power'`, `'medium'`, `'filler'`). Existing `styleOverrides` are dropped — the preset's `wordEmphasis.roles` defines what each role looks like. The hardcoded `classifyWordTier()` function in `AnimatedSubtitle.tsx` becomes a runtime fallback: if a word has no `role` set, the renderer can classify it on-the-fly using the same word lists, then resolve against the preset's roles.

On manifest load, migrate existing words:
```typescript
for (const item of manifest.items) {
  if (item.type === 'caption') {
    for (const word of item.data.words) {
      if (word.classification && !word.role) {
        word.role = word.classification;
        delete word.classification;
      }
      delete word.styleOverrides;
    }
  }
}
```

### Frontend Store

- Add top-level `captionPreset: CaptionPreset` to `EditorState`
- `loadProject()`: Extract style from first caption item's `data.style` (if present) into `state.captionPreset`. Strip `data.style` from all caption items.
- `syncWorkspaceManifest()`: Read `state.captionPreset` directly instead of fishing through first caption item

### Store Actions

Remove:
- `updateAllCaptionStyles()`
- `updateSelectedCaptionStyles()`

Add:
- `updateCaptionPreset(updates: Partial<CaptionPreset>)` — merges into `state.captionPreset`, pushes history, syncs manifest, dispatches op

### Shared Manifest Ops

- `update_caption_style` op → `update_caption_preset` op
- Deep merge for nested objects (`position`, `animation`, `effects`, `wordEmphasis`)
- Shallow replace for scalars

### Sandbox Tools

- `updateCaptionStyleTool` → `updateCaptionPresetTool`
- Same deep-merge implementation, operates on `manifest.captionPreset`

### Subtitle Presets (`subtitle-presets.ts`)

**Curated preset list.** Remove all presets except these 9 (+ default):

| Preset ID | Name | Display Modes |
|-----------|------|---------------|
| `default` | Default | word-by-word, phrase, karaoke |
| `hormozi` | Hormozi | word-by-word, phrase, karaoke |
| `ali-abdaal` | Ali Abdaal | word-by-word, phrase, karaoke |
| `nas-daily` | Nas Daily | word-by-word, phrase |
| `netflix` | Netflix | phrase, karaoke |
| `behind-person` | Behind Person | word-by-word, phrase |
| `retro-vhs` | Retro VHS | word-by-word, phrase |
| `cottagecore` | Cottagecore | word-by-word, phrase, karaoke |
| `apple-clean` | Apple | phrase, karaoke |
| `google-material` | Google | word-by-word, phrase |

**Display mode variants.** Each preset that works with multiple display modes gets variant entries. The preset picker shows the base preset; selecting it shows the available display mode variants as a sub-option. Internally, the preset ID encodes the variant: `hormozi` (default mode), `hormozi:phrase`, `hormozi:karaoke`. The `presetId` field on `CaptionPreset` stores the full variant ID.

Implementation: Each preset definition includes a `supportedModes: CaptionDisplayMode[]` array. The first mode is the default. When the user selects a preset, it applies with the default mode. The display mode picker in the StylePanel only shows modes from `supportedModes`.

**Deprecate `dynamic-hierarchy`.** Remove the `dynamic-hierarchy` preset and display mode. The AI word emphasis feature can be re-introduced later through the `wordEmphasis` system on individual presets.

- `SubtitlePreset` type gains optional `wordEmphasis` and `supportedModes` fields
- All presets not in the curated list above are removed
- Categories simplified — remove the category system for now (only 10 presets)

### DB

No schema change. Caption items in the `items` table keep `data.words` in JSONB. Global style is on the manifest (also JSONB on the project).

## Renderer Changes

The sandbox has two caption renderers:
- **`CaptionItem.tsx`** (~96 lines) — simple renderer used by the manifest item pipeline. Reads `captionStyle` prop. This is what `PlayerComposition.tsx` routes caption items to.
- **`AnimatedSubtitle.tsx`** (~750 lines) — full-featured renderer with dynamic hierarchy, animations, word-level overrides. Used by scene compositions via `SubtitleLayer.tsx`.

Both need updating: `CaptionItem.tsx` for the manifest-driven caption items (the common path), and `AnimatedSubtitle.tsx` to read from preset roles instead of inline `styleOverrides`. The `classifyWordTier()` function in `AnimatedSubtitle.tsx` becomes a runtime fallback when `word.role` is not set.

### Sandbox `CaptionItem.tsx`

Words render individually with role resolution:

```tsx
activeWords.map((word, i) => {
  const roleStyle = word.role
    ? captionPreset.wordEmphasis?.roles?.[word.role]
    : undefined;

  return (
    <span key={i} style={{
      fontFamily: roleStyle?.fontFamily ?? captionPreset.fontFamily,
      fontSize: roleStyle?.fontSize ?? captionPreset.fontSize,
      fontWeight: roleStyle?.fontWeight ?? captionPreset.fontWeight,
      color: roleStyle?.activeColor ?? captionPreset.activeColor,
      // ... each property: role override → preset default
    }}>
      {word.text}{' '}
    </span>
  );
});
```

Individual word rendering is required anyway for future features (dynamic sizing, per-word animation, emphasis backgrounds).

### Frontend `manifest-bridge.ts`

`storeToManifest()` takes `captionPreset` parameter, outputs `manifest.captionPreset`.

`manifestToStore()` reads `manifest.captionPreset` (fallback to `manifest.captionStyle`), stores at top level of state. Does NOT spread into per-item `data.style`.

## Frontend Controls

### StylePanel — Simplified

The current StylePanel has ~20 controls. Most are removed — presets handle them. The simplified panel has:

**Keep:**
- **Preset picker** — grid of 10 presets. Selecting one is a full reset.
- **Display mode** — word-by-word / phrase / karaoke. Only shows modes from the active preset's `supportedModes`.
- **Words per phrase** — slider, only visible when display mode is phrase or karaoke.
- **Colors** — all colors used by the caption (text, active, background, active background). Multi-color editor, not individual pickers.
- **Font family** — dropdown/picker.
- **Font size** — slider.
- **Font weight** — dropdown (400, 500, 600, 700, 800, 900).
- **Letter spacing** — slider.
- **Text transform** — none / uppercase / lowercase toggle.
- **Line height** — slider.
- **Background padding** — x/y sliders.
- **Background radius** — slider.

**Remove:**
- Position controls (anchor, offset sliders) — handled by drag in preview.
- Animation/transition controls — preset owns these.
- Opacity slider — preset owns.
- Stroke/text shadow/text stroke — preset owns.
- Effects (shadow, glow) — preset owns.
- "Apply to selected only" toggle — all style is global.

All updates go through `updateCaptionPreset()`. `applyPreset()` does full replacement. Individual knobs do partial merge.

### CaptionDragOverlay

- `updateStyle` always calls `updateCaptionPreset()`
- Position drag writes to `captionPreset.position`
- Font resize writes to `captionPreset.fontSize`
- Rotation writes to `captionPreset.position.rotation`
- No item IDs at any point

## Bug Fixes Included

1. **ID mismatch** — eliminated by design. Style ops never reference item IDs.
2. **Split source of truth** — one field: `manifest.captionPreset`.
3. **Missing re-render** — `syncWorkspaceManifest()` called in `updateCaptionPreset()`.
4. **Click propagation** — `onClick stopPropagation` on CaptionDragOverlay's bounding box and hover zone.
5. **Drag errors** — drag overlay uses global preset path, not per-item ops.

## Scope

### Build Now
1. `CaptionPreset` data model on manifest (replaces `captionStyle`)
2. `updateCaptionPreset()` store action (replaces two style functions)
3. Renderer resolves preset + word roles
4. Migration: `captionStyle` → `captionPreset`, strip `data.style` from items, `classification` → `role`
5. Curate presets: keep 9 + default, remove the rest, add `supportedModes` and display mode variants
6. Simplify StylePanel: remove position/animation/effects/opacity controls, keep typography + colors + background + display mode
7. Deprecate `dynamic-hierarchy` display mode
8. StylePanel and DragOverlay use single dispatch path
9. Click propagation fix
10. Sync re-render fix

### Designed For, Not Built
- `speakers` config for speaker-aware positioning + line breaking
- Complex `wordEmphasis` presets (multi-font, dynamic sizing curves)
- Auto line-breaking strategies
- Dynamic resize curves
- Custom user-created presets
- Re-introduce dynamic-hierarchy via `wordEmphasis` on individual presets
