# Editor Performance Optimization Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate unnecessary React re-renders and canvas overhead in the Viona video editor to achieve smooth 60fps playback and interaction.

**Architecture:** Fix the highest-impact issues first — Zustand selector architecture, transient playback updates, canvas layer separation — then tackle medium-priority items. Each task is independent and can be committed separately.

**Tech Stack:** React 19, Zustand 5, Next.js 15, Remotion 4, Canvas 2D API, fast-deep-equal

---

## Chunk 1: Zustand Store & Selector Fixes (Highest Impact)

These tasks fix the root cause of most re-render issues: the monolithic `useEditorActions()` hook and inefficient equality checks.

---

### Task 1: Remove dead code `useDeepSelector` and install `fast-deep-equal`

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/use-editor-store.ts:19-32`

`useDeepSelector` uses `JSON.stringify()` for deep comparison but is currently **dead code** (defined but never called). Remove it and install `fast-deep-equal` as a utility for future use if deep comparison is needed elsewhere.

- [ ] **Step 1: Verify `useDeepSelector` is unused**

```bash
cd apps/web && grep -rn "useDeepSelector" src/ --include="*.tsx" --include="*.ts"
```

Should only show the definition at `use-editor-store.ts:19`. If it's used anywhere, replace its `JSON.stringify` with `fast-deep-equal` instead of deleting it.

- [ ] **Step 2: Install fast-deep-equal (for future use)**

```bash
cd apps/web && pnpm add fast-deep-equal
```

- [ ] **Step 3: Remove the dead `useDeepSelector` function**

In `apps/web/src/features/editor-v2/store/use-editor-store.ts`, delete lines 14-32 (the comment + function). If it IS used somewhere (found in Step 1), replace the implementation instead:

```typescript
import equal from 'fast-deep-equal';

function useDeepSelector<S, U>(selector: (state: S) => U): (state: S) => U {
  const prev = useRef<U>(undefined as U);
  return (state) => {
    const next = selector(state);
    if (equal(prev.current, next)) {
      return prev.current as U;
    }
    prev.current = next;
    return next;
  };
}
```

- [ ] **Step 4: Verify the editor loads and plays back correctly**

```bash
cd apps/web && pnpm dev
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/features/editor-v2/store/use-editor-store.ts
git commit -m "chore: remove dead useDeepSelector code, add fast-deep-equal dep"
```

---

### Task 2: Split `useEditorActions()` into domain-specific hooks

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/use-editor-store.ts:425-562`
- Modify: `apps/web/src/features/editor-v2/Editor.tsx` (imports)
- Modify: `apps/web/src/features/editor-v2/player/Player.tsx` (imports)
- Modify: `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx` (imports)
- Modify: All other files that import `useEditorActions`

**Why this matters:** `useEditorActions()` returns an object with 60+ action methods via `useShallow`. While Zustand action references are stable (they don't change between renders), the selector still runs on every state change and must shallow-compare a 60-property object each time. This creates measurable overhead — every state update triggers 60 property comparisons in every component that uses this hook. Splitting into domain-specific hooks with 5-10 properties each reduces this overhead ~10x per component and makes the codebase more maintainable.

- [ ] **Step 1: Find all consumers of `useEditorActions`**

```bash
cd apps/web && grep -rn "useEditorActions" src/ --include="*.tsx" --include="*.ts" | grep -v "export function useEditorActions"
```

Record which actions each consumer actually uses.

- [ ] **Step 2: Define domain-specific action hooks**

Add these hooks BELOW the existing `useEditorActions` (don't delete it yet) in `use-editor-store.ts`:

```typescript
/** Playback-only actions — use in Player, PlaybackBar */
export function usePlaybackActions() {
  return useEditorStore(
    useShallow((state) => ({
      play: state.play,
      pause: state.pause,
      togglePlayback: state.togglePlayback,
      seek: state.seek,
      setCurrentTime: state.setCurrentTime,
    }))
  );
}

/** Timeline item manipulation — use in TimelineCanvas, drag handlers */
export function useTimelineActions() {
  return useEditorStore(
    useShallow((state) => ({
      select: state.select,
      selectRange: state.selectRange,
      selectAll: state.selectAll,
      clearSelection: state.clearSelection,
      setSelectionBox: state.setSelectionBox,
      addItem: state.addItem,
      updateItem: state.updateItem,
      updateItemData: state.updateItemData,
      deleteItems: state.deleteItems,
      moveItem: state.moveItem,
      resizeItem: state.resizeItem,
      startDrag: state.startDrag,
      updateDrag: state.updateDrag,
      endDrag: state.endDrag,
      splitItem: state.splitItem,
      splitAllAtPlayhead: state.splitAllAtPlayhead,
      setSplitMode: state.setSplitMode,
      nudgeItems: state.nudgeItems,
      trimItems: state.trimItems,
      copyItems: state.copyItems,
      pasteItems: state.pasteItems,
      duplicateItems: state.duplicateItems,
      deleteTimeRange: state.deleteTimeRange,
    }))
  );
}

/** Caption editing — use in StylePanel, TranscriptPanel */
export function useCaptionActions() {
  return useEditorStore(
    useShallow((state) => ({
      updateAllCaptionStyles: state.updateAllCaptionStyles,
      updateSelectedCaptionStyles: state.updateSelectedCaptionStyles,
      updateWordStyleOverrides: state.updateWordStyleOverrides,
      setApplyStyleToAll: state.setApplyStyleToAll,
      selectAllCaptionsOnTrack: state.selectAllCaptionsOnTrack,
      splitCaption: state.splitCaption,
      mergeCaptions: state.mergeCaptions,
      updateCaptionText: state.updateCaptionText,
      setShowCaptions: state.setShowCaptions,
    }))
  );
}

/** Viewport — use in Timeline zoom/scroll controls */
export function useViewportActions() {
  return useEditorStore(
    useShallow((state) => ({
      setZoom: state.setZoom,
      setScrollX: state.setScrollX,
      setScrollY: state.setScrollY,
      zoomToFit: state.zoomToFit,
    }))
  );
}

/** History — use in undo/redo buttons */
export function useHistoryActions() {
  return useEditorStore(
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo,
      pushHistory: state.pushHistory,
    }))
  );
}

/** Project-level actions — use in Editor.tsx, Header */
export function useProjectActions() {
  return useEditorStore(
    useShallow((state) => ({
      loadProject: state.loadProject,
      reloadVisuals: state.reloadVisuals,
      refreshMediaUrls: state.refreshMediaUrls,
      saveProject: state.saveProject,
      setProject: state.setProject,
      updateVideoSettings: state.updateVideoSettings,
    }))
  );
}

/** AI/scene/element actions — use in AIAssistantPanel, Scene */
export function useAIActions() {
  return useEditorStore(
    useShallow((state) => ({
      setSelectedScene: state.setSelectedScene,
      setSelectedTimeRange: state.setSelectedTimeRange,
      setSelectedElement: state.setSelectedElement,
      setElementPickerEnabled: state.setElementPickerEnabled,
      setInspectModeEnabled: state.setInspectModeEnabled,
      requestAIEdit: state.requestAIEdit,
      setPendingAIMessage: state.setPendingAIMessage,
      changeDisplayModeWithAI: state.changeDisplayModeWithAI,
    }))
  );
}

/** Track management — use in TrackHeader, context menus */
export function useTrackActions() {
  return useEditorStore(
    useShallow((state) => ({
      addTrack: state.addTrack,
      updateTrack: state.updateTrack,
      deleteTrack: state.deleteTrack,
      reorderTracks: state.reorderTracks,
    }))
  );
}

/** Audio separation/enhancement — use in AudioPanel */
export function useAudioActions() {
  return useEditorStore(
    useShallow((state) => ({
      separateAudio: state.separateAudio,
      toggleEnhancement: state.toggleEnhancement,
      updateEnhancementStatus: state.updateEnhancementStatus,
    }))
  );
}

/** Transform & keyframes — use in PropertyPanel, KeyframeEditor */
export function useTransformActions() {
  return useEditorStore(
    useShallow((state) => ({
      updateTransform: state.updateTransform,
      updateFilters: state.updateFilters,
      updateKeyframes: state.updateKeyframes,
      addKeyframeAtTime: state.addKeyframeAtTime,
      deleteKeyframe: state.deleteKeyframe,
      updateKeyframeEasing: state.updateKeyframeEasing,
      updateVisualOverlayZone: state.updateVisualOverlayZone,
      updatePiPSettings: state.updatePiPSettings,
      updateSplitSettings: state.updateSplitSettings,
    }))
  );
}

/** Safe zone & overlay — use in SceneToolbar */
export function useSafeZoneActions() {
  return useEditorStore(
    useShallow((state) => ({
      setSafeZonePlatform: state.setSafeZonePlatform,
      setShowSafeZone: state.setShowSafeZone,
      openTransitionPicker: state.openTransitionPicker,
      closeTransitionPicker: state.closeTransitionPicker,
      getVideoSegmentation: state.getVideoSegmentation,
    }))
  );
}
```

- [ ] **Step 3: Migrate Player.tsx**

In `apps/web/src/features/editor-v2/player/Player.tsx:54`, replace:

```typescript
// Before
const { setCurrentTime, play, pause } = useEditorActions();

// After
const { setCurrentTime, play, pause } = usePlaybackActions();
```

Update the import to use `usePlaybackActions` instead of `useEditorActions`.

- [ ] **Step 4: Migrate TimelineCanvas.tsx**

In `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx:71-82`, replace:

```typescript
// Before
const { select, clearSelection, setSelectionBox, setCurrentTime, startDrag, updateDrag, endDrag, moveItem, resizeItem, splitItem } = useEditorActions();

// After
const { select, clearSelection, setSelectionBox, startDrag, updateDrag, endDrag, moveItem, resizeItem, splitItem } = useTimelineActions();
const { setCurrentTime } = usePlaybackActions();
```

- [ ] **Step 5: Migrate remaining consumers**

For each file found in Step 1, replace `useEditorActions()` with the narrowest domain hook that covers its needed actions. If a component needs actions from multiple domains, call multiple hooks (e.g. `usePlaybackActions()` + `useTimelineActions()`).

- [ ] **Step 6: Deprecate `useEditorActions`**

Add a deprecation comment to the old hook but keep it for now:

```typescript
/**
 * @deprecated Use domain-specific hooks instead:
 * usePlaybackActions, useTimelineActions, useCaptionActions, useViewportActions,
 * useHistoryActions, useProjectActions, useAIActions, useTrackActions,
 * useAudioActions, useTransformActions, useSafeZoneActions
 */
export function useEditorActions() {
```

- [ ] **Step 7: Verify and commit**

```bash
cd apps/web && pnpm dev
```

Open editor, test: playback, timeline drag, split, caption editing, AI panel, undo/redo.

```bash
git add apps/web/src/features/editor-v2/store/use-editor-store.ts apps/web/src/features/editor-v2/Editor.tsx apps/web/src/features/editor-v2/player/Player.tsx apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx
# Also add any other modified consumer files
git commit -m "perf: split useEditorActions into domain-specific hooks to reduce re-renders"
```

---

### Task 3: Transient playback updates (bypass React during playback)

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/Player.tsx:86-126`
- Modify: `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx:63,156-161`

**Why this matters:** During playback, `currentTimeMs` updates at 30fps via React state → Zustand → every subscriber re-renders. The timeline canvas re-renders, the playback bar re-renders, the Player re-renders. For a value that changes 30 times per second, this should bypass React entirely and write directly to the canvas/DOM.

**Important:** The store does NOT use `subscribeWithSelector` middleware, so use the basic `subscribe` pattern with manual comparison. Also, `setCurrentTime` in the store only clamps `Math.max(0, Math.min(timeMs, duration))` — no other side effects — so direct `setState` is safe as long as we clamp.

**Dependency note:** This task modifies Player.tsx which is also modified by Task 7. Execute Task 3 BEFORE Task 7, or combine them.

- [ ] **Step 1: Replace `useCurrentTimeMs()` with ref-based subscription in TimelineCanvas**

In `TimelineCanvas.tsx`:

1. Remove the `useCurrentTimeMs` import and its usage (line 63: `const currentTimeMs = useCurrentTimeMs();`)
2. Add a ref and subscription:

```typescript
// Replace: const currentTimeMs = useCurrentTimeMs();
// With:
const currentTimeMsRef = useRef(useEditorStore.getState().currentTimeMs);
```

3. In the `renderState` useMemo, replace `currentTimeMs` with `currentTimeMsRef.current` and remove it from the dependency array:

```typescript
const renderState: RenderState = useMemo(
  () => ({
    tracks,
    items,
    itemIds,
    selectedIds,
    currentTimeMs: currentTimeMsRef.current, // from ref, not hook
    duration,
    viewport,
    selectionBox,
    dragState,
    dragPreviews,
    snapLines,
    splitMode,
    splitCursorTimeMs,
    splitHoveredItemId,
  }),
  [tracks, items, itemIds, selectedIds, duration, viewport, selectionBox, dragState, dragPreviews, snapLines, splitMode, splitCursorTimeMs, splitHoveredItemId]
  // Note: currentTimeMs removed from deps — handled by subscription below
);
```

4. Add the subscription effect (after the existing `renderStateRef.current = renderState` assignment):

```typescript
// Transient playhead subscription — redraws canvas without React re-renders
useEffect(() => {
  let prev = useEditorStore.getState().currentTimeMs;
  const unsub = useEditorStore.subscribe((state) => {
    if (state.currentTimeMs !== prev) {
      prev = state.currentTimeMs;
      currentTimeMsRef.current = state.currentTimeMs;
      if (rendererRef.current) {
        renderStateRef.current = { ...renderStateRef.current, currentTimeMs: state.currentTimeMs };
        rendererRef.current.requestRender(renderStateRef.current);
      }
    }
  });
  return unsub;
}, []);
```

- [ ] **Step 2: In Player.tsx, use direct setState with clamping**

In the `frameupdate` handler, replace `setCurrentTime(timeMs)` with a direct store write that includes clamping (matching what `setCurrentTime` does):

```typescript
const handleFrameChange: CallbackListener<'frameupdate'> = (data) => {
  const frame = data.detail.frame;
  const timeMs = (frame / fps) * 1000;

  isInternalUpdate.current = true;
  // Direct setState with clamping — same as setCurrentTime action but avoids
  // going through the action reference which may cause React subscription churn
  const { duration } = useEditorStore.getState();
  useEditorStore.setState({ currentTimeMs: Math.max(0, Math.min(timeMs, duration)) });

  requestAnimationFrame(() => {
    isInternalUpdate.current = false;
  });
};
```

- [ ] **Step 3: Verify playhead moves smoothly during playback**

Test: Play video, verify playhead moves on canvas. Pause, drag timeline, verify playhead jumps correctly. Seek via clicking timeline, verify position updates.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/player/Player.tsx apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx
git commit -m "perf: use transient store subscription for playhead to bypass React renders during playback"
```

---

## Chunk 2: Canvas Rendering Optimizations

### Task 4: Cache `buildTrackYMap` per render call

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts:143-188, 497-506, 531, 655, 756`

`buildTrackYMap` is called 3+ times per `render()` — once in `drawItems` (line 246), once in `drawDragPreviews` (line 655), once in `drawResizeHandles` (line 756), and once in `drawSplitLine` (line 531). Each call iterates all tracks.

- [ ] **Step 1: Add a cached trackYMap field**

Add a private field to the class:

```typescript
private cachedTrackYMap: Map<string, number> = new Map();
```

- [ ] **Step 2: Compute once at the start of `render()`**

At the top of the `render()` method (after the clear), compute it once:

```typescript
public render(state: RenderState): void {
  const { ctx, options } = this;
  const width = this.getWidth();
  const height = this.getHeight();

  // Clear canvas
  ctx.fillStyle = options.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // Cache track Y positions for this frame
  this.cachedTrackYMap = this.buildTrackYMap(state);

  // ... rest of render
}
```

- [ ] **Step 3: Replace all `buildTrackYMap` calls with `this.cachedTrackYMap`**

In `drawItems`, `drawDragPreviews`, `drawResizeHandles`, and `drawSplitLine`, replace:
```typescript
const trackYMap = this.buildTrackYMap(state);
```
with:
```typescript
const trackYMap = this.cachedTrackYMap;
```

- [ ] **Step 4: Verify timeline renders correctly**

Open editor, verify: items on tracks, drag previews, resize handles, split line.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts
git commit -m "perf: cache buildTrackYMap per render frame instead of computing 3+ times"
```

---

### Task 5: Add text measurement cache to CanvasRenderer

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts` (lines 462, 464, 574, 835)
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/renderers/canvasUtils.ts` (lines 41, 46, 64)

`ctx.measureText()` is expensive and called in both `CanvasRenderer.ts` and `canvasUtils.ts` for text truncation and pill rendering. The cache must be accessible to both files — export it as a shared utility.

- [ ] **Step 1: Find where text measurement happens**

```bash
cd apps/web && grep -rn "measureText\|fillText" src/features/editor-v2/timeline/canvas/ --include="*.ts"
```

- [ ] **Step 2: Create a shared text measurement cache**

Create a new file `apps/web/src/features/editor-v2/timeline/canvas/text-cache.ts`:

```typescript
const textWidthCache = new Map<string, number>();

/**
 * Cached version of ctx.measureText().width.
 * Cache is shared across CanvasRenderer and canvasUtils.
 */
export function getCachedTextWidth(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  const key = `${font}|${text}`;
  let width = textWidthCache.get(key);
  if (width === undefined) {
    ctx.font = font;
    width = ctx.measureText(text).width;
    textWidthCache.set(key, width);
    // Prevent unbounded growth — evict oldest entry
    if (textWidthCache.size > 500) {
      const firstKey = textWidthCache.keys().next().value;
      if (firstKey) textWidthCache.delete(firstKey);
    }
  }
  return width;
}

/** Clear cache (call when font settings change, or on component unmount). */
export function clearTextCache(): void {
  textWidthCache.clear();
}
```

- [ ] **Step 3: Replace direct `measureText` calls in both files**

In `CanvasRenderer.ts` and `canvasUtils.ts`, import `getCachedTextWidth` and replace `ctx.measureText(text).width` calls. For truncation loops that call `measureText` in a while-loop (lines 464 and 46), the cache naturally accelerates repeated checks as the string gets shorter.

- [ ] **Step 4: Verify captions render with correct truncation**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/canvas/
git commit -m "perf: cache canvas text measurements to avoid repeated measureText calls"
```

---

## Chunk 3: Component-Level Fixes

### Task 6: Debounce ResizeObserver callbacks

**Files:**
- Modify: `apps/web/src/features/editor-v2/scene/Scene.tsx:102-109`
- Modify: `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx:138-154`

ResizeObserver fires on every pixel during drag-resize. Scene recalculates scale, TimelineCanvas re-renders the full canvas. Both should be debounced or coalesced with rAF.

- [ ] **Step 1: Add rAF coalescing to Scene.tsx ResizeObserver**

In `Scene.tsx`, replace lines 102-109:

```typescript
useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  calculateScale();
  let rafId: number | null = null;
  const ro = new ResizeObserver(() => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      calculateScale();
      rafId = null;
    });
  });
  ro.observe(el);
  return () => {
    ro.disconnect();
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}, [calculateScale]);
```

- [ ] **Step 2: Fix TimelineCanvas.tsx ResizeObserver to use `requestRender` instead of `render`**

In `TimelineCanvas.tsx`, the current code at line 145 calls `rendererRef.current.render()` (synchronous, direct), NOT `requestRender`. Change it to use `requestRender` which has built-in rAF coalescing:

```typescript
const observer = new ResizeObserver(() => {
  if (rendererRef.current) {
    rendererRef.current.resize();
    rendererRef.current.requestRender(renderStateRef.current); // was .render() — now uses rAF
  }
});
```

This change is real (not just a verification) — the current code calls `render()` directly which can fire many times during a drag-resize.

- [ ] **Step 3: Verify resize works smoothly**

Drag the timeline resize handle up/down. Resize the browser window. Verify no stuttering.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/scene/Scene.tsx apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx
git commit -m "perf: debounce ResizeObserver with rAF coalescing in Scene"
```

---

### Task 7: Stabilize Player event listeners

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/Player.tsx:86-126`

The `useEffect` at line 86 depends on `[playerInstance, fps, setCurrentTime, play, pause]`. Since `setCurrentTime`, `play`, and `pause` come from `useEditorActions()` (now `usePlaybackActions`), they may cause the effect to re-run if the hook returns new references. Fix by storing callbacks in refs.

- [ ] **Step 1: Store action callbacks in refs**

```typescript
// After the usePlaybackActions call, add:
const setCurrentTimeRef = useRef(setCurrentTime);
const playRef = useRef(play);
const pauseRef = useRef(pause);
useEffect(() => { setCurrentTimeRef.current = setCurrentTime; }, [setCurrentTime]);
useEffect(() => { playRef.current = play; }, [play]);
useEffect(() => { pauseRef.current = pause; }, [pause]);
```

- [ ] **Step 2: Update event listener effect to use refs**

```typescript
useEffect(() => {
  if (!playerInstance) return;

  const handleFrameChange: CallbackListener<'frameupdate'> = (data) => {
    const frame = data.detail.frame;
    const timeMs = (frame / fps) * 1000;
    isInternalUpdate.current = true;
    setCurrentTimeRef.current(timeMs);
    requestAnimationFrame(() => {
      isInternalUpdate.current = false;
    });
  };

  const handlePlay: CallbackListener<'play'> = () => playRef.current();
  const handlePause: CallbackListener<'pause'> = () => pauseRef.current();
  const handleEnded: CallbackListener<'ended'> = () => {
    pauseRef.current();
    setCurrentTimeRef.current(0);
  };

  playerInstance.addEventListener('frameupdate', handleFrameChange);
  playerInstance.addEventListener('play', handlePlay);
  playerInstance.addEventListener('pause', handlePause);
  playerInstance.addEventListener('ended', handleEnded);

  return () => {
    playerInstance.removeEventListener('frameupdate', handleFrameChange);
    playerInstance.removeEventListener('play', handlePlay);
    playerInstance.removeEventListener('pause', handlePause);
    playerInstance.removeEventListener('ended', handleEnded);
  };
}, [playerInstance, fps]); // Only re-run when player instance or fps changes
```

- [ ] **Step 3: Verify playback controls work**

Test: play, pause, seek, reach end of video (should auto-pause and reset to 0).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/player/Player.tsx
git commit -m "perf: stabilize Player event listeners with refs to prevent re-attachment"
```

---

### Task 8: Add exponential backoff to job polling

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx:440-481`

The fallback polling for visual generation jobs uses a fixed 2-second interval. For jobs that take 2+ minutes, this fires 60+ unnecessary API calls.

- [ ] **Step 1: Replace fixed interval with exponential backoff**

Replace the polling `useEffect` (lines 440-481) with:

```typescript
useEffect(() => {
  if (!visualsJobId || !isGeneratingVisuals) return;
  if (wsConnected) return;

  let delay = 2000;
  const MAX_DELAY = 15000;
  let timeoutId: ReturnType<typeof setTimeout>;

  const poll = async () => {
    try {
      const job = await api.getJob(visualsJobId);
      setVisualsProgress(job.progress || 0);

      if (job.status === 'complete') {
        setVisualsStatus('Complete!');
        setIsGeneratingVisuals(false);
        setVisualsComplete(true);
        clearCompositionCache();
        if (project?.id) reloadVisuals(project.id);
        setVisualsJobId(null);
        return; // Stop polling
      } else if (job.status === 'failed' || job.status === 'cancelled') {
        const errorMsg = job.status === 'cancelled'
          ? 'Generation was cancelled'
          : (job.error || 'Unknown error occurred');
        setVisualsStatus(job.status === 'cancelled' ? 'Cancelled' : 'Failed');
        setVisualsError(errorMsg);
        setIsGeneratingVisuals(false);
        setVisualsJobId(null);
        return; // Stop polling
      } else if (job.status === 'processing') {
        setVisualsStatus('Generating visuals with AI...');
      }
    } catch (err) {
      console.error('Failed to poll job status:', err);
    }

    // Exponential backoff: 2s → 4s → 8s → 15s cap
    delay = Math.min(delay * 2, MAX_DELAY);
    timeoutId = setTimeout(poll, delay);
  };

  timeoutId = setTimeout(poll, delay);
  return () => clearTimeout(timeoutId);
}, [visualsJobId, isGeneratingVisuals, project, reloadVisuals, wsConnected]);
```

- [ ] **Step 2: Verify job progress still updates in UI**

Start a visual generation, observe progress updates in the status bar.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx
git commit -m "perf: use exponential backoff for visual generation job polling"
```

---

## Chunk 4: Lazy Loading & Bundle Optimization

### Task 9: Lazy-load sidebar panels

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx` (imports and JSX)

The AI Assistant panel (2114 lines), Style panel (1740 lines), and Assets panel are all eagerly imported. They should be lazy-loaded since only one is visible at a time.

- [ ] **Step 1: Convert imports to lazy**

At the top of `Editor.tsx`, replace the static imports:

```typescript
// Before
import { AIAssistantPanel } from './components/AIAssistantPanel';
import { StylePanel } from './panels/StylePanel';
import { AssetsPanel } from './panels/AssetsPanel';
import { ExportModal } from './components/ExportModal';
import { TransitionPickerModal } from './components/TransitionPickerModal';

// After
import { Suspense, lazy } from 'react';
const AIAssistantPanel = lazy(() => import('./components/AIAssistantPanel').then(m => ({ default: m.AIAssistantPanel })));
const StylePanel = lazy(() => import('./panels/StylePanel').then(m => ({ default: m.StylePanel })));
const AssetsPanel = lazy(() => import('./panels/AssetsPanel').then(m => ({ default: m.AssetsPanel })));
const ExportModal = lazy(() => import('./components/ExportModal').then(m => ({ default: m.ExportModal })));
const TransitionPickerModal = lazy(() => import('./components/TransitionPickerModal').then(m => ({ default: m.TransitionPickerModal })));
```

Note: `React` is already imported at the top of the file. Add `Suspense` and `lazy` to the existing import if needed.

- [ ] **Step 2: Wrap lazy components in Suspense**

Find where these components are rendered in the JSX and wrap each with a `<Suspense>` fallback. Use a minimal loading indicator:

```tsx
<Suspense fallback={<div className="flex items-center justify-center h-full"><span className="text-zinc-500 text-sm">Loading...</span></div>}>
  <AIAssistantPanel ... />
</Suspense>
```

Do the same for `StylePanel`, `AssetsPanel`, `ExportModal`, and `TransitionPickerModal`.

- [ ] **Step 3: Verify panels load on first click**

Open editor. Click AI tab — panel should load after brief flash. Click Style tab. Click Assets tab. Each should work normally after initial load.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx
git commit -m "perf: lazy-load sidebar panels to reduce initial bundle size"
```

---

### Task 10: Enable React Compiler

**Files:**
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/package.json`

React Compiler auto-memoizes components and hooks at build time. It eliminates ~70% of unnecessary re-renders without code changes. Next.js 15 has built-in support.

- [ ] **Step 1: Install the compiler runtime**

Next.js 15 uses SWC (not Babel), so install the SWC-compatible compiler package:

```bash
cd apps/web && pnpm add -D babel-plugin-react-compiler react-compiler-runtime
```

Note: Despite the name, Next.js 15+ uses `babel-plugin-react-compiler` internally through its SWC integration when `experimental.reactCompiler` is enabled. It does NOT switch to Babel — SWC remains the compiler.

- [ ] **Step 2: Enable in next.config.ts**

Add the `experimental.reactCompiler` flag to the existing config:

```typescript
const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    reactCompiler: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // ... rest of existing config (output, webpack, etc.)
};
```

- [ ] **Step 3: Build and test**

```bash
cd apps/web && pnpm build
```

If the build succeeds, test the editor manually. The compiler may surface issues with non-idiomatic React patterns (mutating refs during render, reading `.current` during render, etc.).

**Known risk areas** in this codebase:
- `useDeepSelector` creates closures with refs during render (removed in Task 1 if dead code)
- `isInternalUpdate.current` is read during render in some components
- Any component that mutates refs outside of effects

If the build fails for specific files, add `'use no memo'` at the top of that file. Only do this as a last resort.

- [ ] **Step 4: Commit**

```bash
git add apps/web/next.config.ts apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "perf: enable React Compiler for automatic memoization"
```

---

## Chunk 5: Advanced Optimizations (Lower Priority)

### ~~Task 11: Renderer registry lookup optimization~~ — ALREADY DONE

The registry at `apps/web/src/features/editor-v2/timeline/canvas/renderers/registry.ts` already uses `Map<string, ItemRenderer>` with `.get()` and `.set()`. No changes needed.

---

### Task 12: Consolidate Editor.tsx useEffect chains

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx:160-298`

Multiple `useEffect` hooks fire on overlapping state changes. Group related effects to reduce subscription count and potential race conditions.

- [ ] **Step 1: Audit the effect chain**

List each useEffect, its dependencies, and what it does. Identify which ones can be merged:

| Effect | Deps | Purpose |
|--------|------|---------|
| Line 166 | `[projectId, loadProject]` | Load project |
| Line 171 | `[projectId, refreshMediaUrls]` | Refresh URLs every 3h |
| Line 181 | `[aiEditRequested]` | Open AI sidebar |
| Line 232 | `[]` | Sandbox cleanup on unmount |
| Line 244 | `[isPlaying]` | Exit inspect mode on play |
| Line 258 | `[project?.id, updateEnhancementStatus]` | WS enhancement handlers |

- [ ] **Step 2: Merge the inspect-mode + playback effect**

Lines 244-256 can be moved into the existing playback sync logic or kept as-is since it's a cheap check. Only merge if it reduces subscription count meaningfully.

- [ ] **Step 3: Convert workspace WS callbacks to use `useEditorStore.getState()` instead of reading from hooks**

The workspace WS callbacks at lines 189-229 already use `useEditorStore.getState()` — this is correct and avoids re-subscriptions. Verify no regressions.

- [ ] **Step 4: Commit if changes made**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx
git commit -m "refactor: consolidate Editor useEffect chains to reduce subscription overhead"
```

---

## Summary

| Task | Impact | Effort | Category |
|------|--------|--------|----------|
| 1. fast-deep-equal | High | 5 min | Selector perf |
| 2. Split useEditorActions | Critical | 30 min | Re-render elimination |
| 3. Transient playback | Critical | 20 min | 60fps playback |
| 4. Cache buildTrackYMap | High | 5 min | Canvas perf |
| 5. Text measurement cache | Medium | 15 min | Canvas perf |
| 6. Debounce ResizeObserver | Medium | 10 min | Resize smoothness |
| 7. Stabilize Player listeners | High | 10 min | Memory/re-renders |
| 8. Exponential backoff | Low | 10 min | API spam |
| 9. Lazy-load panels | Medium | 15 min | Bundle size |
| 10. React Compiler | High | 10 min | Auto-memoization |
| 11. Renderer registry | — | — | Already done |
| 12. Effect consolidation | Low | 15 min | Code quality |

**Recommended execution order:** 1 → 2 → 3+7 (same file) → 4 → 10 → 6 → 9 → 5 → 8 → 12

**Parallelization:** Tasks 1, 4, 5, 6, 8, 9 touch different files and can be parallelized. Tasks 3 and 7 both modify `Player.tsx:86-126` — do them sequentially (or combine). Task 2 modifies many consumer files so run it alone. Task 10 (React Compiler) should run last as it affects everything.
