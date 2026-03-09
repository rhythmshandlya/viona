# Complete Remaining Features — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete all remaining incomplete features across the editor: timeline redesign (store actions, renderers, split/clipboard/context-menu, keyboard shortcuts, layout integration), subtitle system V2 (AnimatedSubtitle V2, style migration, StylePanel refactor, font registry, TranscriptPanel, WordToolbar, keyboard shortcuts), and minor stubs (export, title save).

**Architecture:** All changes are in the existing monorepo (`apps/web`, `packages/renderer`, `packages/shared`). State management via Zustand+Immer. Canvas-based timeline rendering. Remotion for video composition. React 19, TypeScript, Tailwind CSS.

**Tech Stack:** TypeScript, React 19, Zustand+Immer, Canvas 2D, Remotion 4, lucide-react, Tailwind CSS, Google Fonts API

---

## What's Already Done (Do NOT Redo)

### Timeline Redesign — Completed:
- ✅ Task 2: Renderer registry (`renderers/types.ts`, `registry.ts`)
- ✅ Task 3: BaseRenderer (`renderers/BaseRenderer.ts`, `canvasUtils.ts`)
- ✅ Task 7: Track Headers (`track-headers/TrackHeaders.tsx`, `TrackHeader.tsx`)
- ✅ Task 12: AutoScroll (`interactions/AutoScroll.ts`)
- ✅ Barrel export (`renderers/index.ts`, `track-headers/index.ts`)

### Subtitle V2 — Completed:
- ✅ Task 1: Shared types updated (`packages/shared/src/types/index.ts`)
- ✅ Task 2: Editor store types updated (`store/types.ts`) — AnimationType, EasingType, AnimationConfig, WordStyleOverrides, CaptionWord.styleOverrides, CaptionStyle V2 fields, CaptionItemData.styleOverrides all exist
- ✅ Task 3: Animation engine built (`packages/renderer/src/animations/*`) — all 11 animations, 5 easings, resolve, migrate, index
- ✅ Task 6: Presets expanded to 12 (`apps/web/src/lib/subtitle-presets.ts`) — 5 viral, 4 cinematic, 3 minimal with V2 AnimationConfig

### Social Preview — Fully Complete:
- ✅ `SocialPreviewOverlay.tsx`, `SceneToolbar.tsx`, `social-platforms.ts` integrated into `Scene.tsx`

### Audio Quality — Fully Complete

---

## Remaining Tasks

### Phase 1: Timeline Store Actions (Task 1)
### Phase 2: Timeline Renderers (Tasks 4-6)
### Phase 3: Timeline Layout Integration (Task 8)
### Phase 4: Timeline Interactions (Tasks 9-11)
### Phase 5: Subtitle V2 — Renderer Integration (Tasks 4-5, 7)
### Phase 6: Subtitle V2 — UI (Tasks 8-11)
### Phase 7: Keyboard Shortcuts (Timeline Task 13 + Subtitle Task 13)
### Phase 8: Editor Panel Wiring + Minor Stubs (Subtitle Task 14 + stubs)
### Phase 9: Build Verification

---

### Task 1: Store — Add splitItem, duplicateItems, clipboard, nudge, trim

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`
- Modify: `apps/web/src/features/editor-v2/store/use-editor-store.ts`

**Step 1:** Add to `EditorState` in `types.ts` (after line 307, before closing brace of `EditorState`):

```typescript
clipboard: TimelineItem[] | null;
splitMode: boolean;
```

Add default values in `editor-store.ts` `initialState`:

```typescript
clipboard: null,
splitMode: false,
```

**Step 2:** Add to `EditorActions` in `types.ts`:

```typescript
// Split
splitItem: (itemId: string, atMs: number) => void;
setSplitMode: (active: boolean) => void;

// Clipboard
copyItems: (ids: string[]) => void;
pasteItems: (atMs: number) => void;
duplicateItems: (ids: string[]) => void;

// Nudge & Trim
nudgeItems: (ids: string[], deltaMs: number) => void;
trimItems: (ids: string[], edge: 'start' | 'end', deltaMs: number) => void;

// Subtitle-specific
splitCaption: (captionId: string, wordIndex: number) => void;
mergeCaptions: (captionId1: string, captionId2: string) => void;
updateCaptionText: (captionId: string, newText: string) => void;
```

**Step 3:** Implement all actions in `editor-store.ts`.

`splitItem` logic:
1. Get item by id. Calculate `splitRelativeMs = atMs - item.startMs`.
2. For video/audio: create two items. First: `(startMs, atMs)` with trim from original trim.startMs to splitRelativeMs. Second: `(atMs, endMs)` with trim from splitRelativeMs to original trim.endMs.
3. For caption: partition `words` array. Left half words: those with `endMs <= splitRelativeMs`. Right half: rest. Adjust right half word timings by subtracting splitRelativeMs. Build new text from word arrays.
4. Delete original item, add two new items. Push history.

`duplicateItems` logic:
1. For each item id, deep-clone the item with a new nanoid.
2. Place clone at `original.endMs` with same duration.
3. Select the cloned items. Push history.

`copyItems`: Deep-clone selected items into `state.clipboard`.

`pasteItems(atMs)`: Clone clipboard items. Calculate offset from the earliest item's startMs to `atMs`. Apply offset to all cloned items. Add to store. Select pasted items. Push history.

`nudgeItems(ids, deltaMs)`: For each id, shift startMs and endMs by deltaMs. Clamp `startMs >= 0`. Push history.

`trimItems(ids, edge, deltaMs)`: If `edge === 'start'`, adjust startMs += deltaMs (clamp to endMs - 100). If `edge === 'end'`, adjust endMs += deltaMs (clamp to startMs + 100). Push history.

`splitCaption(captionId, wordIndex)`: Split caption item at word boundary. Left gets words[0..wordIndex-1], right gets words[wordIndex..end]. Adjust timings.

`mergeCaptions(id1, id2)`: Combine words from both, use startMs of first and endMs of second. Delete both, create merged item. Push history.

`updateCaptionText(captionId, newText)`: Update the `text` field on the CaptionItemData. Push history.

`setSplitMode(active)`: Set `state.splitMode = active`.

**Step 4:** Expose all new actions in `use-editor-store.ts` `useEditorActions`:

Add to the return object: `splitItem`, `setSplitMode`, `copyItems`, `pasteItems`, `duplicateItems`, `nudgeItems`, `trimItems`, `splitCaption`, `mergeCaptions`, `updateCaptionText`.

Add new selectors: `useClipboard()`, `useSplitMode()`.

**Step 5:** Commit.

```bash
git add apps/web/src/features/editor-v2/store/
git commit -m "feat(timeline): add split, clipboard, nudge, trim store actions"
```

---

### Task 2: VideoRenderer with ThumbnailCache

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/canvas/ThumbnailCache.ts`
- Create: `apps/web/src/features/editor-v2/timeline/canvas/renderers/VideoRenderer.ts`

**ThumbnailCache.ts:**
- LRU cache (max 200 entries) keyed by `${src}:${timeMs}`
- `getThumbnail(src, timeMs): ImageBitmap | null` — returns cached or null
- `requestThumbnail(src, timeMs, callback): void` — async extraction:
  1. Create a hidden `<video>` element (pool max 2 concurrent)
  2. Seek to timeMs, wait for `seeked` event
  3. Draw video frame to offscreen canvas (scaled to track height)
  4. Create ImageBitmap, store in LRU cache
  5. Call callback to trigger re-render
- `clear()` — flush entire cache
- Export singleton: `getThumbnailCache()`

**VideoRenderer.ts:**

```typescript
import { BaseRenderer } from './BaseRenderer';
import { ItemRect, RenderItemState } from './types';
import { TimelineItem, VideoItemData } from '../../../store/types';
import { getThumbnailCache } from '../ThumbnailCache';
import { truncateText } from './canvasUtils';

export class VideoRenderer extends BaseRenderer {
  private requestRedraw: () => void;

  constructor(requestRedraw: () => void) {
    super();
    this.requestRedraw = requestRedraw;
  }

  draw(ctx: CanvasRenderingContext2D, item: TimelineItem, rect: ItemRect, state: RenderItemState): void {
    super.draw(ctx, item, rect, state);
    const data = item.data as VideoItemData;
    const { x, y, width, height } = rect;

    // Clip to rounded rect
    ctx.save();
    // ... roundRect clip path ...

    // Calculate filmstrip thumbnails
    const thumbHeight = height - 8;
    const thumbWidth = thumbHeight * (16 / 9); // assume 16:9 aspect
    const thumbCount = Math.max(1, Math.floor(width / thumbWidth));
    const durationMs = item.endMs - item.startMs;
    const cache = getThumbnailCache();

    for (let i = 0; i < thumbCount; i++) {
      const thumbX = x + (i / thumbCount) * width;
      const timeMs = item.startMs + (i / thumbCount) * durationMs;
      const bitmap = cache.getThumbnail(data.src, Math.round(timeMs));

      if (bitmap) {
        ctx.drawImage(bitmap, thumbX, y + 4, width / thumbCount, thumbHeight);
      } else {
        // Gradient placeholder
        const grad = ctx.createLinearGradient(thumbX, y + 4, thumbX + width / thumbCount, y + 4);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        grad.addColorStop(1, 'rgba(59, 130, 246, 0.15)');
        ctx.fillStyle = grad;
        ctx.fillRect(thumbX, y + 4, width / thumbCount, thumbHeight);
        // Request async
        cache.requestThumbnail(data.src, Math.round(timeMs), this.requestRedraw);
      }
    }

    ctx.restore();

    // Blue accent line on top
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(x, y, width, 2);

    // Muted indicator
    if (data.muted && width > 60) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('Muted', x + 8, y + height / 2);
    }
  }
}
```

Register: In `renderers/index.ts`, add `export { VideoRenderer } from './VideoRenderer';`

**Step 3:** Commit.

```bash
git add apps/web/src/features/editor-v2/timeline/canvas/
git commit -m "feat(timeline): add VideoRenderer with filmstrip thumbnail cache"
```

---

### Task 3: AudioRenderer with WaveformCache

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/canvas/WaveformCache.ts`
- Create: `apps/web/src/features/editor-v2/timeline/canvas/renderers/AudioRenderer.ts`

**WaveformCache.ts:**
- Cache keyed by `src` → `Float32Array` of peak values
- `getWaveform(src): Float32Array | null`
- `requestWaveform(src, callback): void`:
  1. Fetch audio file
  2. Decode with `AudioContext.decodeAudioData()`
  3. Downsample to ~500 peaks
  4. Store, call callback
- Export singleton: `getWaveformCache()`

**AudioRenderer.ts:**
- Extends `BaseRenderer`
- Draws waveform (mirrored around center) if cached, else fake sine wave + async request
- Enhancement badge using `drawPill()` from canvasUtils
- Color: `#4ade80` for peaks

Register for type `'audio'`.

**Step 2:** Commit.

```bash
git add apps/web/src/features/editor-v2/timeline/canvas/
git commit -m "feat(timeline): add AudioRenderer with waveform cache"
```

---

### Task 4: CaptionRenderer — improved text preview

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/canvas/renderers/CaptionRenderer.ts`

**CaptionRenderer.ts:**
- Extends `BaseRenderer`
- Draws truncated text preview (semi-bold 11px, white 90% opacity, 8px left padding)
- Word count badge on right edge: `"{N} words"` pill (only if width > 120px)
- Display mode indicator at top-left: "W" / "P" / "K" letter (only if width > 80px)

Register for type `'caption'`.

**Step 2:** Commit.

```bash
git add apps/web/src/features/editor-v2/timeline/canvas/renderers/CaptionRenderer.ts
git commit -m "feat(timeline): add CaptionRenderer with text preview and word count badge"
```

---

### Task 5: Integrate renderer registry into CanvasRenderer

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts`
- Modify: `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx`

**Step 1:** In `CanvasRenderer.ts`, modify `drawItem()` to look up renderer from registry:

```typescript
import { getRenderer } from './renderers/registry';
import { ItemRect, RenderItemState } from './renderers/types';

// In drawItem(), after calculating rect:
const renderer = getRenderer(item.type);
if (renderer) {
  const rect: ItemRect = { x, y, width, height };
  const renderState: RenderItemState = {
    isSelected,
    isHovered: false, // TODO: track hover per-item
    isDragPreview: false,
    isInvalid: false,
    zoom: viewport.zoom,
  };
  renderer.draw(ctx, item, rect, renderState);
  return; // Skip fallback
}
// ... keep existing fallback code ...
```

**Step 2:** In `TimelineCanvas.tsx`, register all renderers on mount:

```typescript
import { registerRenderer } from './canvas/renderers/registry';
import { VideoRenderer } from './canvas/renderers/VideoRenderer';
import { AudioRenderer } from './canvas/renderers/AudioRenderer';
import { CaptionRenderer } from './canvas/renderers/CaptionRenderer';
import { BaseRenderer } from './canvas/renderers/BaseRenderer';

// In component, useEffect on mount:
useEffect(() => {
  const requestRedraw = () => {
    if (rendererRef.current) {
      rendererRef.current.requestRender(renderState);
    }
  };
  registerRenderer('video', new VideoRenderer(requestRedraw));
  registerRenderer('audio', new AudioRenderer(requestRedraw));
  registerRenderer('caption', new CaptionRenderer());
  registerRenderer('text', new BaseRenderer());
  registerRenderer('image', new BaseRenderer());
}, []);
```

**Step 3:** Add `splitMode` and `splitCursorTimeMs` to `RenderState` in `CanvasRenderer.ts`.

**Step 4:** Commit.

```bash
git add apps/web/src/features/editor-v2/timeline/
git commit -m "feat(timeline): integrate renderer registry into CanvasRenderer"
```

---

### Task 6: Timeline layout — two-column with track headers

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/Timeline.tsx`
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts` (track heights per type)

**Step 1:** In `Timeline.tsx`, wrap existing layout in flex-row. Add `<TrackHeaders />` as left column (140px fixed). Right column: existing ruler + canvas + playhead + zoom.

```tsx
import { TrackHeaders } from './track-headers';

// In render:
<div className={`flex flex-row ${className || ''}`}>
  {/* Track headers - fixed width */}
  <TrackHeaders rulerHeight={24} />

  {/* Canvas area */}
  <div className="flex-1 relative overflow-hidden">
    {/* existing ruler, canvas, playhead, zoom controls */}
  </div>
</div>
```

**Step 2:** In `editor-store.ts` `convertApiProject`, set track heights per type:

```typescript
const TRACK_HEIGHTS: Record<string, number> = {
  video: 64,
  audio: 48,
  caption: 36,
  text: 36,
  overlay: 36,
};

// When creating tracks:
height: TRACK_HEIGHTS[t.type as string] || DEFAULT_TRACK_HEIGHT,
```

**Step 3:** Integrate AutoScroll into Timeline. Add `useEffect` that calls `autoScroll.update()` when `currentTimeMs` changes during playback.

```typescript
import { getAutoScroll } from './interactions/AutoScroll';

// In Timeline component:
const currentTimeMs = useCurrentTimeMs();
const isPlaying = useIsPlaying();
const viewport = useViewport();
const { setScrollX } = useEditorActions();
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!isPlaying) return;
  const autoScroll = getAutoScroll();
  const canvasWidth = containerRef.current?.getBoundingClientRect().width || 0;
  autoScroll.update(currentTimeMs, isPlaying, viewport, canvasWidth, setScrollX);
}, [currentTimeMs, isPlaying, viewport, setScrollX]);
```

**Step 4:** Commit.

```bash
git add apps/web/src/features/editor-v2/timeline/ apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat(timeline): two-column layout with track headers and auto-scroll"
```

---

### Task 7: SplitTool interaction handler

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/interactions/SplitTool.ts`
- Modify: `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx`
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts`

**SplitTool.ts:**
```typescript
import { TimelineItem } from '../../store/types';

export class SplitTool {
  private cursorTimeMs: number = 0;

  setCursorTime(timeMs: number): void { this.cursorTimeMs = timeMs; }
  getCursorTime(): number { return this.cursorTimeMs; }

  findItemAtPosition(
    timeMs: number,
    trackId: string,
    items: Record<string, TimelineItem>,
    itemIds: string[]
  ): string | null {
    for (const id of itemIds) {
      const item = items[id];
      if (item?.trackId === trackId && item.startMs <= timeMs && item.endMs > timeMs) {
        return id;
      }
    }
    return null;
  }
}

let instance: SplitTool | null = null;
export function getSplitTool(): SplitTool {
  if (!instance) instance = new SplitTool();
  return instance;
}
```

**TimelineCanvas.tsx integration:**
- Read `splitMode` from store via `useSplitMode()`
- When split mode active:
  - Set canvas cursor to `'crosshair'`
  - On pointer move: update SplitTool cursor time
  - On click: use HitTester to find track, then `splitTool.findItemAtPosition()`, call `splitItem(itemId, timeMs)`
  - Don't start drags in split mode
- Pass `splitMode` and `splitCursorTimeMs` to render state

**CanvasRenderer.ts:**
- Add `drawSplitLine(state)` — vertical dashed red/orange line at cursor time position, full height

**Step 2:** Commit.

```bash
git add apps/web/src/features/editor-v2/timeline/
git commit -m "feat(timeline): add split tool with crosshair cursor and split line"
```

---

### Task 8: ClipboardManager interaction handler

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/interactions/ClipboardManager.ts`

```typescript
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

let instance: ClipboardManager | null = null;
export function getClipboardManager(): ClipboardManager {
  if (!instance) instance = new ClipboardManager();
  return instance;
}
```

**Step 2:** Commit.

```bash
git add apps/web/src/features/editor-v2/timeline/interactions/ClipboardManager.ts
git commit -m "feat(timeline): add clipboard manager for copy/paste/duplicate"
```

---

### Task 9: ContextMenu — right-click menu

**Files:**
- Create: `apps/web/src/features/editor-v2/timeline/context-menu/useContextMenu.ts`
- Create: `apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx`
- Create: `apps/web/src/features/editor-v2/timeline/context-menu/index.ts`
- Modify: `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx`

**useContextMenu.ts:**
- Hook managing `{ isOpen, x, y, target }` state
- `target: { type: 'item' | 'track' | 'empty'; itemId?: string; trackId?: string; timeMs: number }`
- Returns `{ state, open(e, target), close() }`

**ContextMenu.tsx:**
- React portal, positioned at (x, y), dark themed
- Menu items based on target type:
  - On item: Split Here (S), separator, Copy (Ctrl+C), Duplicate (Ctrl+D), Delete (Del), separator, Lock/Unlock
  - On empty track: Paste (Ctrl+V)
- Click outside or Escape closes menu
- Each item calls corresponding store action and closes
- Style: `--editor-bg-elevated`, 8px radius, shadow, 200px max width

**TimelineCanvas.tsx:**
- Add `onContextMenu` handler on canvas
- Prevent default, use HitTester to determine target, call `contextMenu.open(e, target)`
- Render `<ContextMenu />` alongside canvas

**Step 4:** Commit.

```bash
git add apps/web/src/features/editor-v2/timeline/context-menu/ apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx
git commit -m "feat(timeline): add right-click context menu with split/copy/delete actions"
```

---

### Task 10: Update AnimatedSubtitle to use V2 animation engine

**Files:**
- Modify: `packages/renderer/src/components/AnimatedSubtitle.tsx`

**Step 1:** Rewrite the `Word` component to use the animation engine instead of the manual switch statement:

```typescript
import { resolveAnimation, isAnimationConfig, migrateAnimation } from '../animations';
import type { AnimationConfig } from '../animations';

const Word: React.FC<WordProps> = ({ word, style, currentTimeMs, globalStartMs }) => {
  // Resolve animation config (handle legacy strings)
  const animConfig: AnimationConfig = isAnimationConfig(style.animation)
    ? style.animation
    : migrateAnimation(style.animation as string);

  const wordStartMs = word.startMs;
  const wordEndMs = word.endMs;
  const isActive = currentTimeMs >= wordStartMs && currentTimeMs < wordEndMs;
  const hasAppeared = currentTimeMs >= wordStartMs;
  const elapsedMs = currentTimeMs - wordStartMs;
  const wordDurationMs = wordEndMs - wordStartMs;

  const { style: animStyle } = resolveAnimation(animConfig, {
    elapsedMs: Math.max(0, elapsedMs),
    wordDurationMs,
    isActive,
    hasAppeared: hasAppeared && !isActive,
    isFuture: !hasAppeared,
  });

  // Per-word overrides
  const overrides = (word as any).styleOverrides;

  const wordCss: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: ((overrides?.scale || 1) * (style.fontSize || 48)),
    fontWeight: overrides?.fontWeight || style.fontWeight,
    color: isActive
      ? (overrides?.color || style.activeColor)
      : (overrides?.color || style.color),
    backgroundColor: overrides?.emphasisBg
      || (isActive ? style.activeBackgroundColor : style.backgroundColor),
    padding: '4px 8px',
    borderRadius: '8px',
    textShadow: style.textShadow || '2px 2px 4px rgba(0, 0, 0, 0.8)',
    display: 'inline-block',
    ...animStyle,
  };

  return <span style={wordCss}>{word.text}</span>;
};
```

Keep the main `AnimatedSubtitle` component structure (position logic) but pass `currentTimeMs` down to Word.

**Step 2:** Build renderer: `pnpm --filter @viona/renderer build`

**Step 3:** Commit.

```bash
git add packages/renderer/src/components/AnimatedSubtitle.tsx
git commit -m "feat(subtitles): integrate V2 animation engine into AnimatedSubtitle"
```

---

### Task 11: Update Composition.tsx for editor preview

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/Composition.tsx`

**Step 1:** If the editor's `Composition.tsx` has inline animation logic for captions (scale/opacity/color for pop/fade/highlight), replace it with imports from the animation engine:

```typescript
import { resolveAnimation, isAnimationConfig, migrateAnimation } from '@viona/renderer';
```

Apply the same pattern as Task 10 — use `resolveAnimation()` for each word instead of manual switch.

Handle `WordStyleOverrides` (color, fontWeight, scale, emphasisBg) the same way.

**Step 2:** Commit.

```bash
git add apps/web/src/features/editor-v2/player/Composition.tsx
git commit -m "feat(subtitles): use V2 animation engine in editor preview composition"
```

---

### Task 12: Add style migration to editor store

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`

**Step 1:** In `convertApiProject`, after merging caption style with defaults (around line 187), migrate legacy animation strings:

```typescript
import { migrateAnimation } from '@viona/renderer';
import { isAnimationConfig } from '@viona/renderer';

// After: const captionStyle = { ...DEFAULT_CAPTION_STYLE, ...(apiCaptionStyle as Partial<CaptionStyle>) };
// Add:
if (captionStyle.animation && typeof captionStyle.animation === 'string') {
  captionStyle.animation = migrateAnimation(captionStyle.animation);
}
```

This ensures old projects with `animation: 'pop'` get transparently upgraded.

**Step 2:** Commit.

```bash
git add apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat(subtitles): auto-migrate legacy animation strings on project load"
```

---

### Task 13: Refactor StylePanel with progressive disclosure

**Files:**
- Modify: `apps/web/src/features/editor-v2/panels/StylePanel.tsx`

**Step 1:** Rewrite with:
- Three category tabs (Viral / Cinematic / Minimal) using `PRESET_CATEGORIES`
- Grid of preset cards filtered by active tab, each showing preview text with the preset's `activeColor` and `textShadow`
- Clicking a preset applies ALL its fields (font, animation, colors, effects, displayMode, position)
- Below presets: Position selector (Top/Center/Bottom) and Display Mode (Word/Phrase/Karaoke)
- Collapsible "Customize" section (default collapsed) with:
  - Font family dropdown (from font registry)
  - Font size slider (24-96px)
  - Font weight slider (400-900)
  - Letter spacing slider (0-10px)
  - Text transform buttons (Aa / AA / aa)
  - Text color picker
  - Active color picker
  - Background color picker
  - Active background color picker
  - Background padding slider
  - Background radius slider
  - Text shadow selector (None / Soft / Hard)
  - "Reset to preset" button
- Apply to All toggle at top

**Step 2:** Commit.

```bash
git add apps/web/src/features/editor-v2/panels/StylePanel.tsx
git commit -m "feat(subtitles): refactor StylePanel with tabbed presets and progressive disclosure"
```

---

### Task 14: Font registry

**Files:**
- Create: `apps/web/src/lib/font-registry.ts`

**Step 1:** Create with ~20 curated Google Fonts:

```typescript
export interface FontEntry {
  family: string;
  weights: number[];
  category: 'sans-serif' | 'serif' | 'mono' | 'display';
  googleUrl: string;
}

export const FONT_REGISTRY: FontEntry[] = [
  // Sans-serif
  { family: 'Inter', weights: [400,500,600,700,800,900], category: 'sans-serif', googleUrl: 'Inter:wght@400;500;600;700;800;900' },
  { family: 'Montserrat', weights: [400,500,600,700,800,900], category: 'sans-serif', googleUrl: 'Montserrat:wght@400;500;600;700;800;900' },
  { family: 'Poppins', weights: [400,500,600,700,800,900], category: 'sans-serif', googleUrl: 'Poppins:wght@400;500;600;700;800;900' },
  { family: 'Source Sans 3', weights: [400,600,700], category: 'sans-serif', googleUrl: 'Source+Sans+3:wght@400;600;700' },
  { family: 'Space Grotesk', weights: [400,500,600,700], category: 'sans-serif', googleUrl: 'Space+Grotesk:wght@400;500;600;700' },
  { family: 'DM Sans', weights: [400,500,600,700], category: 'sans-serif', googleUrl: 'DM+Sans:wght@400;500;600;700' },
  { family: 'Outfit', weights: [400,500,600,700,800], category: 'sans-serif', googleUrl: 'Outfit:wght@400;500;600;700;800' },
  { family: 'Nunito', weights: [400,600,700,800,900], category: 'sans-serif', googleUrl: 'Nunito:wght@400;600;700;800;900' },
  // Serif
  { family: 'Playfair Display', weights: [400,500,600,700,800,900], category: 'serif', googleUrl: 'Playfair+Display:wght@400;500;600;700;800;900' },
  { family: 'Lora', weights: [400,500,600,700], category: 'serif', googleUrl: 'Lora:wght@400;500;600;700' },
  { family: 'Merriweather', weights: [400,700,900], category: 'serif', googleUrl: 'Merriweather:wght@400;700;900' },
  // Mono
  { family: 'JetBrains Mono', weights: [400,500,600,700,800], category: 'mono', googleUrl: 'JetBrains+Mono:wght@400;500;600;700;800' },
  { family: 'Fira Code', weights: [400,500,600,700], category: 'mono', googleUrl: 'Fira+Code:wght@400;500;600;700' },
  // Display
  { family: 'Bebas Neue', weights: [400], category: 'display', googleUrl: 'Bebas+Neue' },
  { family: 'Rubik', weights: [400,500,600,700,800,900], category: 'display', googleUrl: 'Rubik:wght@400;500;600;700;800;900' },
];

export async function loadFont(entry: FontEntry): Promise<void> {
  const id = `font-${entry.family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${entry.googleUrl}&display=swap`;
  document.head.appendChild(link);
  await document.fonts.ready;
}

export function getFontsByCategory() {
  return {
    'sans-serif': FONT_REGISTRY.filter(f => f.category === 'sans-serif'),
    'serif': FONT_REGISTRY.filter(f => f.category === 'serif'),
    'mono': FONT_REGISTRY.filter(f => f.category === 'mono'),
    'display': FONT_REGISTRY.filter(f => f.category === 'display'),
  };
}
```

**Step 2:** Commit.

```bash
git add apps/web/src/lib/font-registry.ts
git commit -m "feat(subtitles): add curated Google Fonts registry with dynamic loading"
```

---

### Task 15: TranscriptPanel

**Files:**
- Create: `apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx`

**Step 1:** Build scrollable transcript panel:
- Header with "Transcript" title, "Following" toggle button, search icon
- Scrollable list of caption blocks sorted by startMs
- Each block shows: timestamp (right-aligned), text content (left), edit/split icons on hover
- Active caption highlighted (green accent left border) based on currentTimeMs
- Click caption → seeks to that time
- Click text → inline editing (contentEditable div, Enter to confirm, Escape to cancel)
- Auto-scroll: when "Following" is active, scroll to keep current caption visible
- Search bar: Ctrl+F opens, filters captions by text match

Uses:
- `useCaptionItems()` for sorted captions
- `useCurrentTimeMs()` for active highlight
- `useEditorActions()` for `seek()`, `updateCaptionText()`, `splitCaption()`

Layout: 320px wide panel with scroll, each caption card has subtle border, hover reveals actions.

**Step 2:** Commit.

```bash
git add apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx
git commit -m "feat(subtitles): add transcript panel with inline editing and auto-follow"
```

---

### Task 16: WordToolbar (Per-Word Styling)

**Files:**
- Create: `apps/web/src/features/editor-v2/panels/WordToolbar.tsx`

**Step 1:** Small floating popover above a selected word. Four buttons:
- Color: native color input
- Bold: toggle (sets fontWeight: 900 or removes)
- Scale: toggle (sets scale: 1.2 or removes)
- Highlight BG: color picker for emphasisBg

Props: `captionId`, `wordIndex`, `word`, `position: {x, y}`, `onClose`

Uses `updateWordStyleOverrides()` from store (already in types.ts and editor-store.ts from earlier commits).

**Step 2:** Commit.

```bash
git add apps/web/src/features/editor-v2/panels/WordToolbar.tsx
git commit -m "feat(subtitles): add per-word styling toolbar"
```

---

### Task 17: Keyboard shortcuts — all new shortcuts

**Files:**
- Modify: `apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts`

**Step 1:** Add all new shortcuts:

```typescript
// S: Toggle split mode
// Ctrl+C: Copy selected items
// Ctrl+V: Paste at playhead
// Ctrl+D: Duplicate selected items
// End: Seek to duration end
// ArrowLeft (with selection): Nudge items left (-100ms, Shift: -1 frame)
// ArrowRight (with selection): Nudge items right (+100ms, Shift: +1 frame)
// ArrowLeft (no selection): Frame-step back
// ArrowRight (no selection): Frame-step forward
// [: Trim start in by 100ms
// ]: Trim end out by 100ms
// Escape: Exit split mode first, then clear selection
// T: Toggle transcript panel
// 1/2/3: Switch display mode (word-by-word / phrase / karaoke)
```

Pull needed values from store: `useCurrentTimeMs`, `useDuration`, `useFps`, `useSplitMode` + new actions.

The `T` shortcut and `1/2/3` shortcuts need a callback to toggle transcript panel (passed via props or context). For display mode, call `updateAllCaptionStyles({ displayMode: ... })`.

**Step 2:** Commit.

```bash
git add apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts
git commit -m "feat: add keyboard shortcuts for split, clipboard, nudge, trim, panels"
```

---

### Task 18: Wire panels + minor stubs

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx`
- Modify: `apps/web/src/features/editor-v2/components/Header.tsx`

**Step 1:** Add transcript panel toggle state and layout:

```typescript
const [showTranscript, setShowTranscript] = useState(false);
```

Update layout to include transcript panel on left side of main content:

```tsx
<div className="flex-1 flex relative overflow-hidden">
  {/* Transcript Panel */}
  {showTranscript && (
    <div className="w-80 flex-shrink-0 border-r border-[var(--editor-border-subtle)] overflow-hidden">
      <TranscriptPanel />
    </div>
  )}

  {/* Scene */}
  <div className="flex-1 relative">
    <Scene className="w-full h-full" />
    {showContextPanel && selectedIds.length > 0 && (
      <ContextPanel onClose={handleCloseContextPanel} />
    )}
  </div>
</div>
```

**Step 2:** Fix export stub in `Editor.tsx`:

```typescript
const handleExport = async () => {
  if (!project) return;
  try {
    const { jobId } = await api.renderProject(project.id);
    // Show notification or progress indicator
    console.log('Render started:', jobId);
  } catch (err) {
    console.error('Export failed:', err);
  }
};
```

**Step 3:** Fix title persistence in `Header.tsx`:

```typescript
const handleTitleBlur = () => {
  setIsEditingTitle(false);
  if (project && title.trim()) {
    api.updateProject(project.id, { title: title.trim() }).catch(() => {
      // Silently fail — title is cosmetic
    });
  }
};
```

**Step 4:** Add transcript toggle button to Header:

```tsx
<button
  onClick={() => onToggleTranscript?.()}
  className="p-2 rounded-md hover:bg-[var(--editor-bg-hover)] transition-colors"
  title="Toggle Transcript (T)"
>
  <MessageSquare className="w-4 h-4 text-[var(--editor-text-secondary)]" />
</button>
```

Pass `onToggleTranscript` prop from Editor.

**Step 5:** Commit.

```bash
git add apps/web/src/features/editor-v2/Editor.tsx apps/web/src/features/editor-v2/components/Header.tsx
git commit -m "feat: wire transcript panel, fix export stub, add title persistence"
```

---

### Task 19: Build verification

**Files:** None new.

**Step 1:** Run TypeScript check: `cd apps/web && npx tsc --noEmit`
**Step 2:** Fix any type errors discovered.
**Step 3:** Verify all imports resolve correctly.
**Step 4:** Commit any fixes.

```bash
git add -A
git commit -m "fix: resolve TypeScript errors from feature integration"
```

---

## Dependency Graph

```
Task 1 (Store actions) ──┬── Task 7 (SplitTool)
                          ├── Task 8 (ClipboardManager)
                          ├── Task 9 (ContextMenu)
                          └── Task 17 (Keyboard shortcuts)

Task 2 (VideoRenderer) ─┐
Task 3 (AudioRenderer)  ├── Task 5 (Integrate registry) ── Task 6 (Layout)
Task 4 (CaptionRenderer)┘

Task 10 (AnimatedSubtitle V2) ── Task 11 (Composition V2) ── Task 12 (Style migration)

Task 13 (StylePanel refactor) ── Task 14 (Font registry)

Task 15 (TranscriptPanel) ── Task 16 (WordToolbar)

Task 18 (Wire panels + stubs) ── depends on Tasks 15, 17

Task 19 (Build verify) ── depends on all
```

**Parallel groups:**
- Group A: Tasks 1, 2, 3, 4, 10, 13, 14, 15
- Group B: Tasks 5, 7, 8, 11, 12, 16
- Group C: Tasks 6, 9, 17
- Group D: Task 18
- Group E: Task 19
