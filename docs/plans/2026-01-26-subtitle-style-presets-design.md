# Subtitle Style Presets Design

**Date:** January 26, 2026
**Status:** Ready for Implementation
**Scope:** Curated subtitle style presets for social media video

---

## Overview

Add a preset-based subtitle styling system to the editor. Users select from 6 curated styles optimized for TikTok, Instagram Reels, and YouTube Shorts. No custom styling - presets only to reduce complexity and ensure quality output.

---

## Presets

### 1. Bold Pop (Default)
- **Font:** Inter, 56px, weight 800
- **Colors:** White text, yellow active highlight
- **Effects:** Black outline (2px), drop shadow
- **Animation:** Pop (word scales up when spoken)
- **Position:** Bottom

### 2. Minimal Clean
- **Font:** Inter, 44px, weight 600
- **Colors:** White text, no color change on active
- **Effects:** Subtle shadow only
- **Animation:** Fade (opacity change)
- **Position:** Bottom

### 3. Neon Glow
- **Font:** Inter, 52px, weight 700
- **Colors:** Cyan (#00ffff) text, pink (#ff00ff) active
- **Effects:** Glow shadow effect
- **Animation:** Karaoke (left-to-right fill)
- **Position:** Bottom

### 4. Box Highlight
- **Font:** Inter, 48px, weight 700
- **Colors:** White text on semi-transparent black box
- **Effects:** Yellow background on active word
- **Animation:** None (instant color swap)
- **Position:** Bottom

### 5. Centered Drama
- **Font:** Inter, 64px, weight 800
- **Colors:** White text, red (#ff3333) active
- **Effects:** Heavy drop shadow
- **Animation:** Pop
- **Position:** Center

### 6. Subtitle Classic
- **Font:** Inter, 40px, weight 600
- **Colors:** White text with black outline
- **Effects:** Standard subtitle look
- **Animation:** Fade in/out (whole caption, no word highlight)
- **Position:** Bottom

---

## UI Design

### Preset Picker Location
- Appears in right properties panel when a subtitle is selected
- Shows "Select a subtitle to style" when nothing selected

### Layout
```
┌─────────────────────────────────┐
│  Subtitle Style                 │
├─────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐       │
│  │Bold │ │Mini-│ │Neon │       │
│  │Pop ✓│ │mal  │ │Glow │       │
│  └─────┘ └─────┘ └─────┘       │
│  ┌─────┐ ┌─────┐ ┌─────┐       │
│  │Box  │ │Cent-│ │Class│       │
│  │High │ │ered │ │ic   │       │
│  └─────┘ └─────┘ └─────┘       │
├─────────────────────────────────┤
│  [Apply to All Subtitles]       │
└─────────────────────────────────┘
```

### Behavior
- Each preset displays a static preview thumbnail
- Click to apply immediately to selected subtitle
- Checkmark indicates current style
- "Apply to All" updates every subtitle in the project
- Changes reflect instantly in Remotion player preview

---

## Technical Implementation

### Preset Definition File

`apps/web/src/lib/subtitle-presets.ts`:

```typescript
export interface SubtitlePreset {
  id: string;
  name: string;
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
  animation: 'none' | 'pop' | 'fade' | 'highlight' | 'karaoke';
}

export const SUBTITLE_PRESETS: Record<string, SubtitlePreset> = {
  'bold-pop': { ... },
  'minimal-clean': { ... },
  'neon-glow': { ... },
  'box-highlight': { ... },
  'centered-drama': { ... },
  'subtitle-classic': { ... },
};

export const DEFAULT_PRESET = 'bold-pop';
```

### Data Flow

1. User selects preset in UI
2. Preset config stored in `timelineItems.data.style`
3. Project converter passes style to DesignCombo/Remotion
4. Renderer reads style and applies to `AnimatedSubtitle` component
5. Export uses same style data for final render

### Integration Points

| Component | Change |
|-----------|--------|
| `apps/web/src/lib/subtitle-presets.ts` | Create preset definitions |
| `apps/web/src/features/editor/control-item/preset-subtitle-style.tsx` | Create picker component |
| `apps/web/src/features/editor/control-item/index.tsx` | Add picker to panel |
| `packages/worker/src/processors/transcribe.ts` | Apply default preset |
| `packages/renderer/src/components/AnimatedSubtitle.tsx` | Already supports styles |

### Database
No schema changes. Style stored in existing `timelineItems.data` JSONB field.

---

## Edge Cases

| Case | Handling |
|------|----------|
| No subtitles in project | Disable panel, show "Transcribe video first" |
| Multiple subtitles selected | Apply style to all selected |
| Old project missing style | Fall back to "Bold Pop" defaults |
| Unknown preset ID | Fall back to "Bold Pop" |

---

## Out of Scope

- Custom font uploads
- Per-word styling (different styles for different words)
- Gradient colors
- Custom animation timing
- Style import/export

---

## Implementation Order

1. Create preset definitions file
2. Build preset picker component with thumbnails
3. Wire picker into properties panel
4. Add "Apply to All Subtitles" functionality
5. Update transcription worker to apply default preset
6. Create static preview thumbnail images

---

## Success Criteria

- [ ] All 6 presets selectable in editor
- [ ] Style applies instantly to preview
- [ ] "Apply to All" works correctly
- [ ] New transcriptions get default preset
- [ ] Exported video uses selected styles
- [ ] Old projects without style data still work
