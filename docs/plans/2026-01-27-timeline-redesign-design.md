# Timeline Redesign — Design Document

**Goal:** Transform the timeline from a minimal canvas-based prototype into a professional, CapCut/Descript-inspired editing experience with visual richness, track management, and editing tools.

**Style:** Clean, modern, consumer-friendly. Minimal chrome, clear visual hierarchy, keyboard-driven power features.

**Architecture:** Modular canvas renderers per item type, composable interaction handlers, React-based track headers. Clean separation of rendering, interaction, and state.

---

## 1. Layout

Two-column layout:

```
┌──────────────┬─────────────────────────────────────────────┐
│  Track       │  Ruler (time markers)                       │
│  Headers     ├─────────────────────────────────────────────┤
│  (~140px)    │                                             │
│  🎬 Video    │  [████ video thumbnails ████][████ clip ███] │
│  🔊 Audio    │  [≈≈≈≈ waveform ≈≈≈≈≈≈≈≈≈≈]                │
│  💬 Captions │  [hello][world][this][is]                   │
│              │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

- **Track headers** (React, ~140px fixed width): type icon, editable name, lock toggle, visibility toggle, drag handle for reordering.
- **Canvas area**: items rendered per type with specialized renderers.
- **Ruler**: stays fixed vertically, scrolls horizontally with canvas.
- **Track headers**: scroll vertically in sync with canvas, stay fixed horizontally.

### Track Sizing

| Track Type | Default Height | Purpose |
|------------|---------------|---------|
| Video      | 64px          | Room for filmstrip thumbnails |
| Audio      | 48px          | Waveform visualization |
| Caption    | 36px          | Compact text preview |
| Collapsed  | 24px          | Chevron toggle to minimize |

## 2. Visual Richness

### Video Items
- Filmstrip thumbnail strip: evenly-spaced frames from video source
- Thumbnails fill item background, clipped to bounds
- Thin colored border on top edge (blue accent)
- Hover: filename tooltip
- Async generation with gradient placeholder until ready

### Audio Items
- Waveform visualization from audio data
- Fills item height, scales with zoom
- Green accent, lighter green peaks
- Enhancement badge (pill: "Enhanced" or progress %)

### Caption Items
- Text preview of first words, truncated with ellipsis
- Purple accent, translucent background
- Word count badge on right edge

### Shared Styling
- 6px rounded corners
- Resize handles appear on hover (thin bars at edges)
- Drag ghost: 0.6 opacity with smooth transition
- Selected: bright accent border + elevation shadow
- Snap lines: cyan vertical lines

### Performance
- **Thumbnails**: generated off-screen canvas, LRU cache keyed by (src + time)
- **Waveforms**: pre-computed Float32Array, rendered as canvas path
- **Culling**: skip thumbnail loading for off-screen items (extend existing visible-range check)

## 3. Track Management

### Track Headers (React Components)
- Type icon (video/audio/caption emoji or lucide icon)
- Editable name (double-click to rename)
- Lock toggle: prevents edits to items on track
- Visibility toggle (eye icon): hides track from preview
- Drag handle: vertical reordering
- Click header: select all items in track
- Chevron: collapse/expand track

### Track Reordering
- Drag track header vertically to reorder
- Drop indicator (line between tracks)
- Store updates track positions

## 4. Editing Tools

### Split Tool
- `S` key toggles split mode
- Cursor changes to scissors
- Vertical dashed line follows cursor
- Click any item to split at that time
- Video/audio: both halves keep source, trim offsets adjust
- Captions: words distributed to correct half
- `Escape` or `S` again exits split mode

### Context Menu (Right-Click)
- **On item**: Split here, Duplicate, Delete, Lock/Unlock, Copy
- **On empty track**: Paste, Add item
- **On track header**: Rename, Delete track, Lock all, Select all
- Styled to match editor theme (dark, rounded, subtle shadow)

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Delete` / `Backspace` | Delete selected items |
| `Ctrl+C` | Copy selected items |
| `Ctrl+V` | Paste items at playhead |
| `Ctrl+D` | Duplicate (paste after original) |
| `S` | Toggle split mode |
| `Home` / `End` | Jump to start/end |
| `Left` / `Right` | Nudge selected ±100ms |
| `Shift+Left/Right` | Nudge selected ±1 frame |
| `[` / `]` | Trim in/out by 100ms |

### Playback Auto-Scroll
- Timeline auto-scrolls to keep playhead visible during playback
- Smooth scroll animation (not jarring jumps)
- Only activates when playhead would leave visible area

## 5. Code Architecture

### Rendering Layer
```
canvas/
  CanvasRenderer.ts           — Orchestrator, delegates to item renderers
  renderers/
    BaseRenderer.ts           — Shared: rounded rect, selection highlight, resize handles
    VideoRenderer.ts          — Filmstrip thumbnail drawing
    AudioRenderer.ts          — Waveform drawing
    CaptionRenderer.ts        — Text preview drawing
    SnapLineRenderer.ts       — Snap feedback lines
    SelectionBoxRenderer.ts   — Multi-select box
  ThumbnailCache.ts           — Async thumbnail extraction + LRU cache
  WaveformCache.ts            — Audio waveform data extraction + cache
```

### Interaction Layer
```
interactions/
  DragManager.ts              — Existing, refined
  SnapEngine.ts               — Existing, refined
  SplitTool.ts                — Split mode state + split logic
  ContextMenu.ts              — Menu state + action dispatch
  ClipboardManager.ts         — Copy/paste/duplicate logic
  AutoScroll.ts               — Playhead-follow during playback
```

### Track Headers (React)
```
track-headers/
  TrackHeaders.tsx            — Container, vertical scroll sync
  TrackHeader.tsx             — Single track: icon, name, controls
```

### Key Principles
- Canvas for performance-critical rendering (items, waveforms, thumbnails)
- React for interactive controls (headers, context menu, zoom UI)
- State in Zustand store — renderers are pure functions reading state
- Interactions dispatch store actions
- No circular dependencies
- Adding new item type = one renderer file + register in CanvasRenderer
