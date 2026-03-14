# P2: Timeline Interactions Polish — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the existing timeline trim handle UX with time tooltips during resize, snap feedback lines, and live duration labels.

**Architecture:** Trim handles already work (`resize-left`/`resize-right` drag types, `HitTester` edge detection, `CanvasRenderer.drawResizeHandles()`). This plan adds visual feedback: a time tooltip near the cursor during resize, dotted snap lines at snap targets, and a duration change label. All rendering is on the existing canvas 2D context.

**Tech Stack:** Canvas 2D API, React, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-14-basic-editor-capabilities-design.md` (P2 section)

**Depends on:** None (independent of P0/P1)

---

## File Map

### Modified Files

| File | Change |
|------|--------|
| `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts` | Add time tooltip, snap lines, duration label during resize |
| `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx` | Pass resize state to renderer |

---

### Task 1: Add time tooltip during resize

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts`

- [ ] **Step 1: Read CanvasRenderer.ts**

Read the file to find:
- `drawResizeHandles()` method
- The `draw()` method and where drag state is accessed
- How `RenderState` is passed to the renderer

- [ ] **Step 2: Add tooltip rendering method**

Add a method to CanvasRenderer:

```typescript
private drawTimeTooltip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  timeMs: number,
) {
  const minutes = Math.floor(timeMs / 60000);
  const seconds = Math.floor((timeMs % 60000) / 1000);
  const ms = Math.floor(timeMs % 1000);
  const label = `${minutes}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;

  ctx.font = '11px Inter, sans-serif';
  const metrics = ctx.measureText(label);
  const padding = 4;
  const boxW = metrics.width + padding * 2;
  const boxH = 18;
  const boxX = x - boxW / 2;
  const boxY = y - boxH - 6;

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 4);
  ctx.fill();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, boxY + boxH / 2);
}
```

- [ ] **Step 3: Call tooltip during resize drag**

In the `draw()` method, after existing drag state rendering, add:

```typescript
if (state.dragState?.type === 'resize-left' || state.dragState?.type === 'resize-right') {
  const cursorX = state.dragState.currentX;
  const timeMs = (cursorX + state.viewport.scrollX) / state.viewport.zoom;
  this.drawTimeTooltip(ctx, cursorX, state.dragState.currentY - 20, Math.max(0, timeMs));
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts
git commit -m "feat(timeline): add time tooltip during resize drag"
```

---

### Task 2: Add snap feedback lines

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts`

- [ ] **Step 1: Add snap line rendering**

In the `draw()` method, find where `snapLines` from `RenderState` are available. Draw dotted vertical lines at each snap position:

```typescript
if (state.snapLines && state.snapLines.length > 0) {
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = 'rgba(255, 200, 50, 0.6)';
  ctx.lineWidth = 1;
  for (const snap of state.snapLines) {
    const x = snap.position * state.viewport.zoom - state.viewport.scrollX;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  ctx.restore();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts
git commit -m "feat(timeline): add dotted snap feedback lines during drag"
```

---

### Task 3: Add duration change label

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts`

- [ ] **Step 1: Add duration delta label during resize**

During resize, show the change in duration (e.g., "+0.5s" or "-1.2s"):

```typescript
if (state.dragState?.type === 'resize-left' || state.dragState?.type === 'resize-right') {
  const itemId = state.dragState.itemId;
  if (itemId) {
    const item = state.items[itemId];
    if (item) {
      const originalDuration = item.endMs - item.startMs;
      // Compute new duration from drag preview
      const preview = state.dragPreviews?.find(p => p.itemId === itemId);
      if (preview) {
        const newDuration = preview.endMs - preview.startMs;
        const deltaMs = newDuration - originalDuration;
        const deltaS = (deltaMs / 1000).toFixed(1);
        const deltaLabel = deltaMs >= 0 ? `+${deltaS}s` : `${deltaS}s`;

        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = deltaMs >= 0 ? '#4ade80' : '#f87171';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const x = state.dragState.currentX;
        const y = state.dragState.currentY - 30;
        ctx.fillText(deltaLabel, x, y);
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts
git commit -m "feat(timeline): show duration delta label during resize"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Time tooltip during resize | Modify: CanvasRenderer.ts |
| 2 | Snap feedback lines | Modify: CanvasRenderer.ts |
| 3 | Duration change label | Modify: CanvasRenderer.ts |
