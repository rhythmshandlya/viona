# Caption Editing Wiring Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix caption selection and editing so that clicking a caption in the timeline opens the left Style panel for editing, the CaptionDragOverlay works for preview repositioning, and the right panel (ItemInspector) does NOT open for captions. All changes persist to the backend manifest.

**Architecture:** This is a wiring fix — all UI components already exist (StylePanel, TranscriptPanel, CaptionDragOverlay, WordToolbar). The root causes are: (1) `data-caption-overlay` attribute missing from the Remotion caption renderer so CaptionDragOverlay never renders; (2) `CaptionDragOverlay` sets local state on click but doesn't wire to the editor store's `select()`; (3) the right panel auto-opens for ALL selected items including captions; (4) the left sidebar auto-switch to Style tab explicitly excludes captions. Caption selection via the timeline already works (no type filtering in TimelineCanvas). Preview click-selection is handled by CaptionDragOverlay (not Scene.tsx, since captions don't have `transform`).

**Tech Stack:** React, Remotion, Zustand (editor store)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `packages/sandbox/template/src/items/CaptionItem.tsx` | Modify (line 75) | Add `data-caption-overlay` attribute to wrapper div |
| `apps/web/src/features/editor-v2/components/CaptionDragOverlay.tsx` | Modify (lines 4-9, 151, 436-440, 506-509) | Wire click/deselect to store `select()` |
| `apps/web/src/features/editor-v2/Editor.tsx` | Modify (lines 134-141, 306-315) | Suppress right panel for captions; auto-switch left sidebar to Style tab for captions |

---

### Task 1: Add `data-caption-overlay` attribute to CaptionItem

**Files:**
- Modify: `packages/sandbox/template/src/items/CaptionItem.tsx:75`

The `CaptionDragOverlay` queries `container.querySelector('[data-caption-overlay]')` to measure the caption's bounding box. This attribute was specified in the original design (`docs/plans/2026-02-26-draggable-subtitles-implementation.md`) but never added. Without it, `measureBox()` returns `null` and the entire overlay never renders.

- [ ] **Step 1: Add data attribute to wrapper div**

In `packages/sandbox/template/src/items/CaptionItem.tsx`, change line 75 from:

```tsx
    <div style={positionStyles}>
```

to:

```tsx
    <div style={positionStyles} data-caption-overlay>
```

- [ ] **Step 2: Verify no other return paths exist**

The component has only one return path (line 74-95). The two early returns (lines 34, 42) return `null` when there are no words/active words — those correctly should NOT have the attribute since there's nothing to measure.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/src/items/CaptionItem.tsx
git commit -m "fix: add data-caption-overlay attribute to CaptionItem for drag overlay detection"
```

---

### Task 2: Wire CaptionDragOverlay click to editor store selection

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/CaptionDragOverlay.tsx:4-9, 151, 436-440, 506-509`

Currently the overlay's bounding box click handler (line 506-509) sets local `isSelected` state but never calls the store's `select()`. This means clicking a caption in the preview activates drag handles but doesn't trigger the style panel or any selection-dependent UI. Additionally, the background click handler (line 436-440) clears local state but doesn't deselect from the store, leaving stale selection.

- [ ] **Step 1: Import useEditorStore**

The file already imports from `'../store/use-editor-store'` (line 9). Add `useEditorStore` to the existing import.

Change lines 4-9 from:

```typescript
import {
  useShowCaptions,
  useCaptionItems,
  useSelectedIds,
  useCaptionActions,
} from '../store/use-editor-store';
```

to:

```typescript
import {
  useEditorStore,
  useShowCaptions,
  useCaptionItems,
  useSelectedIds,
  useCaptionActions,
} from '../store/use-editor-store';
```

- [ ] **Step 2: Get select function from store**

In the `CaptionDragOverlay` function body, after line 151 (`const { updateAllCaptionStyles, ... } = useCaptionActions();`), add:

```typescript
  const select = useEditorStore((s) => s.select);
```

- [ ] **Step 3: Wire click handler to store selection**

Change the bounding box `onPointerDown` handler (lines 506-509) from:

```tsx
        onPointerDown={(e) => {
          setIsSelected(true);
          handlePointerDown(e, 'move');
        }}
```

to:

```tsx
        onPointerDown={(e) => {
          setIsSelected(true);
          // Select the first caption item in the store so style panel activates
          if (captionItems.length > 0) {
            select([captionItems[0].id], 'replace');
          }
          handlePointerDown(e, 'move');
        }}
```

- [ ] **Step 4: Wire background click to store deselection**

Change the overlay container's `onPointerDown` handler (lines 436-440) from:

```tsx
      onPointerDown={(e) => {
        // Click on background (not a child) to deselect
        if (e.target === e.currentTarget && !isDragging) {
          setIsSelected(false);
        }
      }}
```

to:

```tsx
      onPointerDown={(e) => {
        // Click on background (not a child) to deselect
        if (e.target === e.currentTarget && !isDragging) {
          setIsSelected(false);
          select([], 'replace');
        }
      }}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/components/CaptionDragOverlay.tsx
git commit -m "fix: wire CaptionDragOverlay click/deselect to editor store selection"
```

---

### Task 3: Suppress right panel for captions, auto-open left Style tab

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx:134-141, 306-315`

Two changes needed:
1. The right panel (ItemInspector) auto-opens for ALL selected items (line 134-141). Captions should NOT open the right panel — their editing lives in the left Style tab.
2. The auto-switch to Style tab (line 306-315) explicitly EXCLUDES captions (`item.type !== 'caption'`). This should be inverted — captions SHOULD switch to Style tab (and open the sidebar if closed).

- [ ] **Step 1: Suppress right panel for caption selections**

Change the auto-open effect (lines 134-141) from:

```typescript
  // Auto-open right panel when an item is selected
  useEffect(() => {
    if (selectedIds.length > 0) {
      setPanelOpen(true);
    } else {
      setPanelOpen(false);
    }
  }, [selectedIds.length]);
```

to:

```typescript
  // Auto-open right panel when a non-caption item is selected
  useEffect(() => {
    if (selectedIds.length > 0) {
      const state = useEditorStore.getState();
      const allCaptions = selectedIds.every((id) => state.items[id]?.type === 'caption');
      if (!allCaptions) {
        setPanelOpen(true);
      } else {
        setPanelOpen(false);
      }
    } else {
      setPanelOpen(false);
    }
  }, [selectedIds]);
```

Note: Changed dependency from `selectedIds.length` to `selectedIds` since we now need to check item types, not just count.

- [ ] **Step 2: Auto-switch left sidebar to Style tab for captions**

Change the auto-switch effect (lines 306-315) from:

```typescript
  // Auto-switch to Style tab when a single non-caption item is selected and sidebar is open
  useEffect(() => {
    if (selectedIds.length === 1 && leftSidebarOpen) {
      const state = useEditorStore.getState();
      const item = state.items[selectedIds[0]];
      if (item && item.type !== 'caption' && item.type !== 'visual') {
        setLeftSidebarTab('style');
      }
    }
  }, [selectedIds, leftSidebarOpen]);
```

to:

```typescript
  // Auto-switch to Style tab when a single item is selected
  useEffect(() => {
    if (selectedIds.length === 1) {
      const state = useEditorStore.getState();
      const item = state.items[selectedIds[0]];
      if (item && item.type !== 'visual') {
        // For captions, always open sidebar and switch to Style tab
        if (item.type === 'caption') {
          setLeftSidebarOpen(true);
          setLeftSidebarTab('style');
        } else if (leftSidebarOpen) {
          setLeftSidebarTab('style');
        }
      }
    }
  }, [selectedIds, leftSidebarOpen]);
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx
git commit -m "fix: suppress right panel for captions, auto-open left Style tab on caption selection"
```

---

### Task 4: Manual end-to-end verification

- [ ] **Step 1: Verify CaptionItem renders with data attribute**

Open browser dev tools on a project with captions. Inspect the Remotion player container. Search for `[data-caption-overlay]`. Confirm the caption wrapper div has the attribute when a caption is active.

- [ ] **Step 2: Verify caption timeline selection opens Style tab**

Click a caption item in the timeline. Confirm:
- The left sidebar opens to the Style tab (NOT the right panel)
- Style controls show caption-specific settings (font, color, effects, position, templates)
- The CaptionDragOverlay shows bounding box and handles in the preview
- TranscriptPanel (Captions tab) highlights the selected caption

- [ ] **Step 3: Verify caption preview click-selection**

Click on a visible caption in the preview canvas (via CaptionDragOverlay). Confirm:
- The caption is selected in the store (timeline item highlights)
- The left Style tab opens
- Drag to reposition works with snap guides
- Resize handles change font size
- Rotation handle works

- [ ] **Step 4: Verify deselection**

Click on empty space in the preview. Confirm:
- Caption is deselected in the store (timeline highlight clears)
- Left sidebar state is preserved (doesn't close)

- [ ] **Step 5: Verify manifest persistence**

Make a caption style change (e.g., change font or position) via the Style panel. Then:
- Reload the page
- Confirm the change persisted (the backend manifest was updated)
- Check that `captionStyle` in the manifest has the updated values

- [ ] **Step 6: Verify non-regression**

- Select video/text/image items → right panel (ItemInspector) still opens
- Select audio items → right panel still opens, shows audio controls
- Click on empty canvas → deselects all items
- Play the video → captions render correctly during playback
