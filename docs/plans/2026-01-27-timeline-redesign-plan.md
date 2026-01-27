# Timeline Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the timeline from a minimal canvas prototype into a CapCut/Descript-style professional editor with modular renderers, track headers, waveforms, thumbnails, split tool, clipboard, context menu, and auto-scroll.

**Architecture:** Modular canvas item renderers (registry pattern), React track headers, composable interaction handlers, all wired through existing Zustand+Immer store.

**Tech Stack:** TypeScript, React 19, Zustand+Immer, Canvas 2D, lucide-react icons, Tailwind CSS

---

### Task 1: Store — Add splitItem, duplicateItems, and clipboard actions

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts` (add action types)
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts` (implement actions)
- Modify: `apps/web/src/features/editor-v2/store/use-editor-store.ts` (expose in useEditorActions)

**What to implement:**

Add to `EditorState`:
```typescript
clipboard: TimelineItem[] | null;  // Copied items
splitMode: boolean;                 // Whether split tool is active
```

Add to `EditorActions`:
```typescript
// Split
splitItem: (itemId: string, atMs: number) => void;
setSplitMode: (active: boolean) => void;

// Clipboard
copyItems: (ids: string[]) => void;
pasteItems: (atMs: number) => void;
duplicateItems: (ids: string[]) => void;

// Nudge
nudgeItems: (ids: string[], deltaMs: number) => void;
trimItems: (ids: string[], edge: 'start' | 'end', deltaMs: number) => void;
```

**splitItem logic:**
1. Get item by ID, calculate split point relative to item start
2. For video/audio: create two items — first: (startMs → atMs), second: (atMs → endMs). Both keep same src. Adjust `trim` offsets so each half plays the correct portion.
3. For caption: partition `words` array — words with `endMs <= splitRelativeMs` go to left, rest go to right. Adjust word timings in right half (subtract splitRelativeMs from each word's startMs/endMs). Update `text` for each half.
4. Delete original, add two new items, push history.

**duplicateItems logic:**
1. For each item in ids, clone with new nanoid.
2. Place clone immediately after the original (startMs = original.endMs, endMs = original.endMs + duration).
3. Push history.

**copyItems logic:**
1. Deep-clone items into `state.clipboard`.

**pasteItems logic:**
1. Clone clipboard items, offset to `atMs`, add to store.
2. Select the pasted items. Push history.

**nudgeItems logic:**
1. For each id, adjust startMs and endMs by deltaMs. Clamp startMs >= 0. Push history.

**trimItems logic:**
1. If edge='start': adjust startMs by deltaMs, clamp to endMs - 100.
2. If edge='end': adjust endMs by deltaMs, clamp to startMs + 100.
3. Push history.

Expose all new actions in `useEditorActions` in `use-editor-store.ts`.

---

### Task 2: Extract renderer registry from CanvasRenderer

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/canvas/renderers/types.ts`
- Create: `apps/web/src/features/editor-v2/timeline/canvas/renderers/registry.ts`
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts`

**What to implement:**

`types.ts` — renderer interface:
```typescript
import { TimelineItem, Track, Viewport } from '../../../store/types';

export interface ItemRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderItemState {
  isSelected: boolean;
  isHovered: boolean;
  isDragPreview: boolean;
  isInvalid: boolean;
  zoom: number;
}

export interface ItemRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    item: TimelineItem,
    rect: ItemRect,
    state: RenderItemState
  ): void;
}
```

`registry.ts` — renderer registry:
```typescript
import { TimelineItemType } from '../../../store/types';
import { ItemRenderer } from './types';

const renderers = new Map<string, ItemRenderer>();

export function registerRenderer(type: string, renderer: ItemRenderer): void {
  renderers.set(type, renderer);
}

export function getRenderer(type: string): ItemRenderer | undefined {
  return renderers.get(type);
}
```

**Modify CanvasRenderer.ts:**
- Replace `drawItem` method to look up renderer from registry: `getRenderer(item.type)?.draw(ctx, item, rect, state)`
- Keep the `drawVideoItem`, `drawAudioItem`, `drawCaptionItem`, `drawDefaultItem` as fallback (call them if no renderer is registered)
- Move `roundRect` to a standalone `canvasUtils.ts` helper so renderers can import it
- Create: `apps/web/src/features/editor-v2/timeline/canvas/renderers/canvasUtils.ts` with `roundRect`, `truncateText`, and `drawPill` helpers

This is a REFACTOR only — visual output should not change. The existing draw methods stay as fallback.

---

### Task 3: BaseRenderer — shared drawing for all item types

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/canvas/renderers/BaseRenderer.ts`

**What to implement:**

```typescript
import { ItemRenderer, ItemRect, RenderItemState } from './types';
import { TimelineItem } from '../../../store/types';
import { roundRect } from './canvasUtils';

export class BaseRenderer implements ItemRenderer {
  protected colors: Record<string, string>;

  constructor(colors: Record<string, string>) {
    this.colors = colors;
  }

  draw(ctx: CanvasRenderingContext2D, item: TimelineItem, rect: ItemRect, state: RenderItemState): void {
    // 1. Draw rounded-rect background with item-type color
    //    Use 6px radius (upgrade from current 4px)
    // 2. If selected: draw accent border (2px, white)
    //    Add subtle box-shadow effect (darker bottom edge)
    // 3. If hovered (not selected): draw subtle border (1px, 30% white)
    // 4. Draw resize handles at edges when selected or hovered
    //    Left handle: thin 3px-wide bar, full height, subtle white
    //    Right handle: same
    // This is a base class — subclasses call super.draw() then add content
  }

  // Draw resize handles
  protected drawResizeHandles(ctx: CanvasRenderingContext2D, rect: ItemRect): void {
    // Left edge: 3px wide, 60% height, centered, rounded
    // Right edge: same
    // Color: rgba(255,255,255,0.6)
  }
}
```

Register as default fallback in registry for any unrecognized type.

---

### Task 4: VideoRenderer with ThumbnailCache

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/canvas/renderers/VideoRenderer.ts`
- Create: `apps/web/src/features/editor-v2/timeline/canvas/ThumbnailCache.ts`

**ThumbnailCache.ts:**
- LRU cache (max 200 entries) keyed by `${src}:${timeMs}`
- `getThumbnail(src, timeMs): ImageBitmap | null` — returns cached bitmap or null
- `requestThumbnail(src, timeMs, callback): void` — async extraction:
  1. Create a hidden `<video>` element (pooled, max 2 concurrent)
  2. Seek to timeMs, wait for `seeked` event
  3. Draw video frame to offscreen canvas (64x64 or scaled to track height)
  4. Create ImageBitmap, store in LRU cache
  5. Call callback to trigger re-render
- `clear()` — flush cache

**VideoRenderer.ts:**
```typescript
import { BaseRenderer } from './BaseRenderer';
import { thumbnailCache } from '../ThumbnailCache';

export class VideoRenderer extends BaseRenderer {
  draw(ctx, item, rect, state): void {
    super.draw(ctx, item, rect, state);

    const data = item.data as VideoItemData;

    // 1. Calculate how many thumbnails fit in the item width
    //    Each thumbnail: (rect.height - 8) aspect-preserving width
    //    Spacing: 0px (edge-to-edge filmstrip)
    // 2. For each thumbnail slot:
    //    - Calculate the source time: item.startMs + (slotIndex / totalSlots) * duration
    //    - Try thumbnailCache.getThumbnail(data.src, timeMs)
    //    - If cached: draw ImageBitmap clipped to slot
    //    - If not cached: draw gradient placeholder, request async
    // 3. Draw thin blue accent line on top edge (2px)
    // 4. Clip all thumbnails to rounded rect (use ctx.clip())
  }
}
```

Register in registry for type 'video'.

**Note:** The callback from ThumbnailCache should trigger a re-render of the canvas. Pass a `requestRedraw` callback into the VideoRenderer constructor, which the TimelineCanvas component provides.

---

### Task 5: AudioRenderer with WaveformCache

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/canvas/renderers/AudioRenderer.ts`
- Create: `apps/web/src/features/editor-v2/timeline/canvas/WaveformCache.ts`

**WaveformCache.ts:**
- Cache keyed by `src` → `Float32Array` of peak values (downsampled)
- `getWaveform(src): Float32Array | null`
- `requestWaveform(src, callback): void`:
  1. Fetch audio file via fetch()
  2. Decode with AudioContext.decodeAudioBuffer()
  3. Downsample to ~500 peaks (peak per chunk)
  4. Store in cache, call callback
- `clear()` — flush cache

**AudioRenderer.ts:**
```typescript
export class AudioRenderer extends BaseRenderer {
  draw(ctx, item, rect, state): void {
    super.draw(ctx, item, rect, state);

    const data = item.data as AudioItemData;

    // 1. Try waveformCache.getWaveform(data.src)
    // 2. If available:
    //    - Draw waveform as filled path (mirrored around center)
    //    - Color: lighter green (#4ade80) for peaks
    //    - Scale peaks to fill 70% of height
    //    - Respect zoom: calculate which samples map to visible pixels
    // 3. If not available:
    //    - Draw the existing fake sine wave (current behavior)
    //    - Request async waveform generation
    // 4. Draw enhancement badge (existing logic, but improved pill style):
    //    - "Enhancing..." with animated dots
    //    - "Enhanced ✓" green pill
    //    - Use canvasUtils.drawPill() helper
  }
}
```

If `data.waveformData` already exists in the store (from API), use that directly instead of fetching.

---

### Task 6: CaptionRenderer — improved text preview

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/canvas/renderers/CaptionRenderer.ts`

**CaptionRenderer.ts:**
```typescript
export class CaptionRenderer extends BaseRenderer {
  draw(ctx, item, rect, state): void {
    super.draw(ctx, item, rect, state);

    const data = item.data as CaptionItemData;

    // 1. Draw text preview:
    //    - First N words that fit, with "..." truncation
    //    - Font: 11px system-ui (existing), but use semi-bold
    //    - Color: white with 90% opacity
    //    - Left-padded 8px
    // 2. Draw word count badge on right edge:
    //    - Small pill: "{N} words"
    //    - Background: rgba(255,255,255,0.1)
    //    - Text: rgba(255,255,255,0.5)
    //    - Only show if rect.width > 120px
    // 3. Draw display mode indicator:
    //    - Tiny icon or letter at the top-left corner
    //    - "W" for word-by-word, "P" for phrase, "K" for karaoke
    //    - Only if rect.width > 80px
  }
}
```

Register for type 'caption'.

---

### Task 7: Track Headers — React components

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/track-headers/TrackHeaders.tsx`
- Create: `apps/web/src/features/editor-v2/timeline/track-headers/TrackHeader.tsx`

**TrackHeaders.tsx:**
```typescript
// Container that:
// 1. Renders one TrackHeader per track
// 2. Syncs vertical scroll with canvas (reads viewport.scrollY from store)
// 3. Has fixed width (140px)
// 4. Applies negative translateY for scrollY offset
// 5. Background: --editor-bg-surface
// 6. Right border: --editor-border-subtle
```

**TrackHeader.tsx:**
```typescript
// Single track header:
// Props: track: Track
// Layout (vertical stack, centered):
//   Row 1: Type icon (lucide: Film for video, Volume2 for audio, MessageSquare for caption)
//          + Track name (truncated, 11px text)
//   Row 2: Lock toggle (Lock/Unlock icon, 14px)
//          + Visibility toggle (Eye/EyeOff icon, 14px)
//
// Click: select all items in track
// Double-click name: inline editable (input)
// Hover: show subtle bg highlight
// Height: matches track.height (from store)
// If collapsed: just show icon + chevron
//
// Use store actions: updateTrack (for lock, visibility, name)
// Use: useTracks, useEditorActions from store
```

Style: dark theme matching editor CSS variables, minimal chrome, 140px wide.

---

### Task 8: Timeline layout — two-column with track headers

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/Timeline.tsx`

**What to change:**

Current layout:
```
[ruler]
[canvas]
[playhead overlay]
[zoom controls]
```

New layout:
```
[140px track headers] | [ruler area]
[140px track headers] | [canvas area]
                      | [playhead overlay]
                      | [zoom controls]
```

Implementation:
1. Wrap in flex-row container
2. Left column: `<TrackHeaders />` (140px fixed width)
3. Right column: existing ruler + canvas + playhead + zoom controls
4. The ruler needs `left: 0` to align with canvas (not track headers)
5. Add a small gap/border between headers and canvas
6. Track headers' top section (at ruler height) shows label "Tracks" or is blank
7. Pass `trackHeaderWidth` to CanvasRenderer options (set to 0 since headers are separate)

Also update track heights based on type:
- When loading project, set video tracks to 64px, audio to 48px, caption to 36px
- Modify `convertApiProject` in `editor-store.ts` to set `height` per track type

---

### Task 9: SplitTool interaction handler

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/interactions/SplitTool.ts`
- Modify: `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx` (integrate split tool)
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts` (render split line)

**SplitTool.ts:**
```typescript
export class SplitTool {
  private isActive: boolean = false;
  private cursorTimeMs: number = 0;

  setActive(active: boolean): void { this.isActive = active; }
  getIsActive(): boolean { return this.isActive; }
  setCursorTime(timeMs: number): void { this.cursorTimeMs = timeMs; }
  getCursorTime(): number { return this.cursorTimeMs; }

  // Find the item under the cursor at the given time and track
  findItemAtPosition(
    timeMs: number,
    trackId: string,
    items: Record<string, TimelineItem>,
    itemIds: string[]
  ): string | null {
    // Find item on this track that contains this time
    for (const id of itemIds) {
      const item = items[id];
      if (item?.trackId === trackId && item.startMs <= timeMs && item.endMs > timeMs) {
        return id;
      }
    }
    return null;
  }
}
```

**TimelineCanvas integration:**
- Read `splitMode` from store
- When split mode active:
  - Set cursor to 'crosshair' (or custom scissors cursor via CSS)
  - On pointer move: update SplitTool cursor time (for rendering the split line)
  - On click: find item under cursor, call `splitItem(itemId, timeMs)`
  - Don't start drags in split mode
- CanvasRenderer: if split mode, draw a vertical dashed red line at the cursor position

**CanvasRenderer addition:**
Add to `RenderState`:
```typescript
splitMode?: boolean;
splitCursorTimeMs?: number;
```

Add `drawSplitLine(state)` method — vertical dashed line at cursor time, full height, red/orange color.

---

### Task 10: ClipboardManager interaction handler

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/interactions/ClipboardManager.ts`

**ClipboardManager.ts:**
```typescript
// Thin wrapper that coordinates clipboard shortcuts with store actions.
// The actual data lives in the store (clipboard state).
export class ClipboardManager {
  copy(selectedIds: string[], copyAction: (ids: string[]) => void): void {
    if (selectedIds.length === 0) return;
    copyAction(selectedIds);
  }

  paste(currentTimeMs: number, pasteAction: (atMs: number) => void): void {
    pasteAction(currentTimeMs);
  }

  duplicate(selectedIds: string[], duplicateAction: (ids: string[]) => void): void {
    if (selectedIds.length === 0) return;
    duplicateAction(selectedIds);
  }
}
```

This is a simple module since the store holds all state. Its value is in providing a clean API for keyboard shortcuts.

---

### Task 11: ContextMenu — right-click menu

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx`
- Create: `apps/web/src/features/editor-v2/timeline/context-menu/useContextMenu.ts`
- Modify: `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx` (integrate context menu)

**useContextMenu.ts:**
```typescript
// Hook that manages context menu state
interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  target: {
    type: 'item' | 'track' | 'empty';
    itemId?: string;
    trackId?: string;
    timeMs: number;
  };
}
// Returns: { state, open(e, target), close() }
```

**ContextMenu.tsx:**
```typescript
// React portal component positioned at (x, y)
// Dark themed, rounded corners, subtle shadow
// Menu items based on target:
//
// On item:
//   Split Here         (S)
//   ─────────────
//   Copy               Ctrl+C
//   Duplicate           Ctrl+D
//   Delete              Del
//   ─────────────
//   Lock/Unlock
//
// On empty track:
//   Paste               Ctrl+V
//
// On track header (future):
//   Rename
//   Delete Track
//   Lock All
//   Select All
//
// Click outside or Escape closes menu
// Each item calls the corresponding store action and closes
```

Style:
- Background: `var(--editor-bg-elevated)`
- Border: `var(--editor-border-subtle)`
- Text: `var(--editor-text-primary)`
- Hover: `var(--editor-bg-hover)`
- Font: 12px system-ui
- Border radius: 8px
- Shadow: 0 4px 12px rgba(0,0,0,0.4)
- Max width: 200px

**TimelineCanvas integration:**
- Add `onContextMenu` handler to canvas element
- Prevent default browser context menu
- Call `contextMenu.open(e, hitResult)` with the hit test result
- Render `<ContextMenu />` alongside canvas

---

### Task 12: AutoScroll — playhead follows during playback

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/interactions/AutoScroll.ts`
- Modify: `apps/web/src/features/editor-v2/timeline/Timeline.tsx` (integrate auto-scroll)

**AutoScroll.ts:**
```typescript
export class AutoScroll {
  // Check if playhead is visible and scroll if needed
  update(
    currentTimeMs: number,
    isPlaying: boolean,
    viewport: Viewport,
    canvasWidth: number,
    setScrollX: (x: number) => void
  ): void {
    if (!isPlaying) return;

    const playheadX = currentTimeMs * viewport.zoom - viewport.scrollX;

    // If playhead is beyond 80% of visible width, scroll to center it
    if (playheadX > canvasWidth * 0.8) {
      const targetScrollX = currentTimeMs * viewport.zoom - canvasWidth * 0.3;
      setScrollX(Math.max(0, targetScrollX));
    }

    // If playhead is before 10% of visible width, scroll back
    if (playheadX < canvasWidth * 0.1 && viewport.scrollX > 0) {
      const targetScrollX = currentTimeMs * viewport.zoom - canvasWidth * 0.3;
      setScrollX(Math.max(0, targetScrollX));
    }
  }
}
```

**Timeline.tsx integration:**
- Use `useCurrentTimeMs()` and `useIsPlaying()` from store
- In a useEffect, call `autoScroll.update()` whenever currentTimeMs changes during playback
- Need canvas width — get from container ref `getBoundingClientRect().width`

---

### Task 13: Keyboard shortcuts — extend with new editing shortcuts

**Files:**
- Modify: `apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts`

**New shortcuts to add:**

```typescript
// S: Toggle split mode
if (e.code === 'KeyS' && !cmdOrCtrl && !e.shiftKey) {
  e.preventDefault();
  setSplitMode(!splitMode);
  return;
}

// Ctrl+C: Copy
if (cmdOrCtrl && e.code === 'KeyC') {
  e.preventDefault();
  copyItems(selectedIds);
  return;
}

// Ctrl+V: Paste at playhead
if (cmdOrCtrl && e.code === 'KeyV') {
  e.preventDefault();
  pasteItems(currentTimeMs);
  return;
}

// Ctrl+D: Duplicate
if (cmdOrCtrl && e.code === 'KeyD') {
  e.preventDefault();
  duplicateItems(selectedIds);
  return;
}

// Home: seek to 0 (already exists)
// End: seek to duration
if (e.code === 'End') {
  e.preventDefault();
  seek(duration);
  return;
}

// Left/Right: nudge items or frame-step
if (e.code === 'ArrowLeft' && !cmdOrCtrl && selectedIds.length > 0) {
  e.preventDefault();
  const delta = e.shiftKey ? -(1000 / fps) : -100;
  nudgeItems(selectedIds, delta);
  return;
}

if (e.code === 'ArrowRight' && !cmdOrCtrl && selectedIds.length > 0) {
  e.preventDefault();
  const delta = e.shiftKey ? (1000 / fps) : 100;
  nudgeItems(selectedIds, delta);
  return;
}

// [/]: Trim in/out
if (e.code === 'BracketLeft' && selectedIds.length > 0) {
  e.preventDefault();
  trimItems(selectedIds, 'start', 100);
  return;
}

if (e.code === 'BracketRight' && selectedIds.length > 0) {
  e.preventDefault();
  trimItems(selectedIds, 'end', 100);
  return;
}

// Escape: also exit split mode
if (e.code === 'Escape') {
  e.preventDefault();
  if (splitMode) {
    setSplitMode(false);
  } else {
    clearSelection();
  }
  return;
}
```

Needs: `useCurrentTimeMs`, `useDuration`, `useFps` from store. Also need new actions: `copyItems`, `pasteItems`, `duplicateItems`, `nudgeItems`, `trimItems`, `setSplitMode` — all from Task 1.

---

### Task 14: Build verification and integration testing

**Files:**
- No new files

**Steps:**
1. Run `pnpm tsc --noEmit` from `apps/web` to verify zero TypeScript errors
2. Check all imports resolve correctly
3. Verify the renderer registry is initialized on app load (renderers are registered)
4. Verify the Timeline layout renders track headers + canvas side by side
5. Fix any TypeScript or import errors

**Registry initialization:**
- Create `apps/web/src/features/editor-v2/timeline/canvas/renderers/index.ts` that imports all renderers and calls `registerRenderer()` for each type
- Import this file from `TimelineCanvas.tsx` to ensure renderers are registered

---

## Task Dependency Graph

```
Task 1 (Store actions) ─────────────────────────┬──── Task 9 (SplitTool)
                                                 ├──── Task 10 (Clipboard)
                                                 ├──── Task 11 (ContextMenu)
                                                 └──── Task 13 (Keyboard)

Task 2 (Renderer registry) ──── Task 3 (BaseRenderer) ──┬── Task 4 (VideoRenderer)
                                                         ├── Task 5 (AudioRenderer)
                                                         └── Task 6 (CaptionRenderer)

Task 7 (Track Headers) ──── Task 8 (Timeline layout)

Task 12 (AutoScroll) ──── standalone
Task 14 (Build verify) ──── depends on all
```

**Parallelizable groups:**
- Group A: Tasks 1, 2, 7, 12 (all independent foundations)
- Group B: Tasks 3, 8 (depend on Group A)
- Group C: Tasks 4, 5, 6, 9, 10, 11 (depend on Group B)
- Group D: Task 13 (depends on Tasks 1 and 9-11)
- Group E: Task 14 (depends on all)
