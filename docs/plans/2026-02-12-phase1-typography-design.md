# Phase 1: Typography System Enhancement

## Overview

Enhance the subtitle typography controls to match competitor capabilities (CapCut, Captions, Descript). This phase focuses on text rendering fundamentals: opacity, line height, and proper stroke controls.

## Current State Analysis

### Existing Typography Properties

| Property | Type | UI Control | Client Render | Server Render |
|----------|------|------------|---------------|---------------|
| `fontFamily` | `string` | Dropdown | Yes | Yes |
| `fontSize` | `number` | Slider (24-96) | Yes | Yes |
| `fontWeight` | `number` | Slider (400-900) | Yes | Yes |
| `letterSpacing` | `number` | Slider (0-10) | Yes | No |
| `textTransform` | `'none' \| 'uppercase' \| 'lowercase'` | Segmented | Yes | No |
| `textStroke` | `string` | None | No | No |
| `textShadow` | `string` | 3 presets only | Yes | Yes |

### Identified Gaps

1. **No opacity control** - Can't adjust text transparency
2. **No line height control** - Can't adjust vertical spacing between lines
3. **textStroke is dead code** - Exists in types but never rendered
4. **letterSpacing not rendered on server** - Client/server mismatch
5. **textTransform not rendered on server** - Client/server mismatch

---

## Phase 1a: Data Model Changes

### New Properties to Add

```typescript
// In packages/shared/src/types/index.ts
// In apps/web/src/features/editor-v2/store/types.ts

interface CaptionStyle {
  // ... existing properties ...

  // NEW: Typography enhancements
  opacity: number;              // 0-1, default 1
  lineHeight: number;           // 1.0-2.5, default 1.4

  // REPLACE textStroke string with structured object
  stroke: StrokeStyle | null;   // null = no stroke
}

interface StrokeStyle {
  width: number;     // 0-10px
  color: string;     // hex color
}
```

### Updated Default Values

```typescript
export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  // ... existing ...

  // New defaults
  opacity: 1,
  lineHeight: 1.4,
  stroke: null,  // No stroke by default
};
```

### Migration Strategy

The old `textStroke?: string` property (e.g., `"2px #000000"`) needs migration:

```typescript
function migrateTextStroke(legacy: string | undefined): StrokeStyle | null {
  if (!legacy) return null;
  // Parse "2px #000000" format
  const match = legacy.match(/(\d+)px\s+(#[0-9a-fA-F]{6})/);
  if (!match) return null;
  return {
    width: parseInt(match[1], 10),
    color: match[2],
  };
}
```

---

## Phase 1a: UI Changes

### StylePanel Updates

Location: `apps/web/src/features/editor-v2/panels/StylePanel.tsx`

Add controls in the "Customize" collapsible section:

```
[Existing: Font Family dropdown]
[Existing: Font Size slider]
[Existing: Font Weight slider]
[Existing: Letter Spacing slider]

[NEW] Opacity
  └─ Slider: 0% - 100% (step 1)
  └─ Display: "75%"

[NEW] Line Height
  └─ Slider: 1.0 - 2.5 (step 0.1)
  └─ Display: "1.4"

[Existing: Text Transform segmented]

--- divider ---

[Existing: Colors section]

--- divider ---

[NEW] Text Stroke
  └─ Toggle: Enable/Disable
  └─ When enabled:
     └─ Width slider: 0-10px (step 0.5)
     └─ Color picker
```

### UI Component Specifications

#### Opacity Slider
- Range: 0-100 (displayed as percentage)
- Internal value: 0-1
- Step: 1%
- Default: 100%
- Label: "Opacity"

#### Line Height Slider
- Range: 1.0-2.5
- Step: 0.1
- Default: 1.4
- Label: "Line Height"
- Display: numeric value (e.g., "1.4")

#### Stroke Controls
- Toggle switch to enable/disable
- When enabled, show:
  - Width slider (0-10px, step 0.5)
  - Color picker (same component as text color)
- Default when enabled: 2px, #000000

---

## Phase 1a: Client Rendering

### Composition.tsx Updates

Location: `apps/web/src/features/editor-v2/player/Composition.tsx`

Update `CaptionRenderer` to apply new properties:

```typescript
// In word span styles:
const wordStyle: React.CSSProperties = {
  // ... existing ...

  // NEW: Apply opacity
  opacity: style.opacity ?? 1,

  // NEW: Apply line height (on container)
  // lineHeight applied at container level

  // NEW: Apply stroke via WebkitTextStroke
  WebkitTextStroke: style.stroke
    ? `${style.stroke.width}px ${style.stroke.color}`
    : undefined,

  // FIX: Apply letterSpacing (currently missing)
  letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,

  // FIX: Apply textTransform (currently missing)
  textTransform: style.textTransform ?? 'none',
};
```

Container style updates:
```typescript
const positionStyles: React.CSSProperties = {
  // ... existing ...

  // NEW: Line height
  lineHeight: style.lineHeight ?? 1.4,
};
```

---

## Phase 1b: Server Rendering (Remotion)

### AnimatedSubtitle.tsx Updates

Location: `packages/renderer/src/components/AnimatedSubtitle.tsx`

#### Update SubtitleStyle interface:

```typescript
export interface SubtitleStyle {
  // ... existing ...

  // NEW
  opacity?: number;
  lineHeight?: number;
  stroke?: { width: number; color: string } | null;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
}
```

#### Update Word component CSS:

```typescript
const wordCss: React.CSSProperties = {
  // ... existing ...

  // NEW: Opacity
  opacity: style.opacity ?? 1,

  // NEW: Stroke
  WebkitTextStroke: style.stroke
    ? `${style.stroke.width}px ${style.stroke.color}`
    : undefined,

  // FIX: Letter spacing (missing)
  letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,

  // FIX: Text transform (missing)
  textTransform: style.textTransform ?? 'none',
};
```

#### Update container for line height:

```typescript
<div
  style={{
    ...positionStyles,
    // ... existing ...
    lineHeight: style.lineHeight ?? 1.4,
  }}
>
```

---

## Phase 1b: Render Pipeline Updates

### Worker Render Processor

Location: `packages/worker/src/processors/render.ts`

Ensure caption styles are passed through to Remotion:

```typescript
// When building props for Remotion render
const captionProps = {
  // ... existing ...
  style: {
    ...captionItem.data.style,
    // Ensure new properties are included
    opacity: captionItem.data.style.opacity ?? 1,
    lineHeight: captionItem.data.style.lineHeight ?? 1.4,
    stroke: captionItem.data.style.stroke ?? null,
  },
};
```

---

## Preset Updates

### Update SubtitlePreset interface

Location: `apps/web/src/lib/subtitle-presets.ts`

```typescript
export interface SubtitlePreset {
  // ... existing ...

  // NEW
  opacity?: number;       // Default: 1
  lineHeight?: number;    // Default: 1.4
  stroke?: { width: number; color: string } | null;  // Default: null
}
```

### Update existing presets

Most presets should keep defaults. Add stroke to presets that benefit from it:

```typescript
'mrbeast-bold': {
  // ... existing ...
  opacity: 1,
  lineHeight: 1.3,
  stroke: { width: 2, color: '#000000' },  // Bold outline
},

'hormozi': {
  // ... existing ...
  stroke: { width: 1.5, color: '#000000' },
},

// Cinematic presets - no stroke, subtle opacity
'cinema-fade': {
  // ... existing ...
  opacity: 0.95,
  lineHeight: 1.5,
  stroke: null,
},
```

---

## Testing Checklist

### Unit Tests
- [ ] Migration function converts legacy `textStroke` strings correctly
- [ ] Default values applied when properties missing
- [ ] Stroke null/object handling

### Integration Tests
- [ ] UI controls update store correctly
- [ ] Client preview reflects all typography changes
- [ ] Apply to all / selection modes work with new properties

### Render Parity Tests
- [ ] Export video with opacity < 1
- [ ] Export video with line height != 1.4
- [ ] Export video with stroke enabled
- [ ] Export video with letter spacing
- [ ] Export video with text transform uppercase
- [ ] Compare client preview screenshot to exported frame

---

## Files to Modify

### Phase 1a (Client)

| File | Changes |
|------|---------|
| `packages/shared/src/types/index.ts` | Add `opacity`, `lineHeight`, `StrokeStyle`, update `SubtitleStyle` |
| `apps/web/src/features/editor-v2/store/types.ts` | Mirror changes, update `CaptionStyle`, `DEFAULT_CAPTION_STYLE` |
| `apps/web/src/features/editor-v2/panels/StylePanel.tsx` | Add opacity slider, line height slider, stroke toggle + controls |
| `apps/web/src/features/editor-v2/player/Composition.tsx` | Apply new CSS properties in `CaptionRenderer` |
| `apps/web/src/lib/subtitle-presets.ts` | Update `SubtitlePreset` interface, update preset values |

### Phase 1b (Server)

| File | Changes |
|------|---------|
| `packages/renderer/src/components/AnimatedSubtitle.tsx` | Update `SubtitleStyle` interface, apply CSS properties |
| `packages/worker/src/processors/render.ts` | Ensure new properties passed to Remotion |

---

## Backward Compatibility

1. **Missing properties**: All new properties have sensible defaults
   - `opacity`: defaults to `1` (fully visible)
   - `lineHeight`: defaults to `1.4`
   - `stroke`: defaults to `null` (no stroke)

2. **Legacy `textStroke` string**: Migration function parses and converts

3. **Existing projects**: Will render identically (defaults match current behavior)

---

## Success Criteria

1. User can adjust text opacity from 0-100%
2. User can adjust line height from 1.0-2.5
3. User can enable text stroke with custom width and color
4. Letter spacing works in both preview and export
5. Text transform (uppercase/lowercase) works in both preview and export
6. Exported video matches client preview for all typography settings
7. Existing projects render identically after update (no visual regression)

---

## Estimated Scope

- **Type changes**: ~30 lines
- **UI changes**: ~100 lines (StylePanel)
- **Client render**: ~20 lines (Composition.tsx)
- **Server render**: ~30 lines (AnimatedSubtitle.tsx)
- **Presets**: ~50 lines
- **Total**: ~230 lines of changes

---

## Next Phase

After Phase 1 is complete and verified, proceed to **Phase 2: Positioning System** which will add:
- X/Y position sliders (pixel-level control)
- Rotation control
- Platform-specific safe zone guides
