# Scene Split on Timeline Cut — Design

**Date**: 2026-03-02
**Status**: Approved

## Problem

When a user cuts a visual timeline item, both resulting halves currently share the same `sourceSceneId` and reference the same underlying Remotion scene file (e.g., `scenes/scene_2.tsx`). They are not truly independent — editing one affects the other, and there is no way to give each half unique AI-generated content.

## Goal

When a user cuts/splits a visual timeline item, the two halves should each get their own scene file (`scene_Xa.tsx` / `scene_Xb.tsx` conceptually, implemented as new sequential IDs), each backed by newly AI-generated Remotion code matching their respective time ranges.

## Approach: Clone-Then-Regenerate (Background)

1. **Instant**: Timeline splits as usual (existing `splitItem` behavior). Both new items are added to a `regeneratingItems` set in the editor store.
2. **Background**: A new `split-visual-scene` BullMQ job loads context, runs AI Phase 2 generation for each half, rebundles once, and updates the DB + timeline items.
3. **Completion**: Client receives WebSocket notification, removes items from regenerating state, reloads visuals.

## Data Flow

```
User cuts Scene2 at 7500ms
  │
  ▼
splitItem() [editor-store.ts]
  - Splits timeline item left + right (existing)
  - If type === 'visual': calls api.splitVisualScene(...)
  - Adds both IDs to regeneratingItems Set
  │
  ▼
POST /projects/:id/split-visual-scene [API route]
  - Creates DB job record
  - Queues split-visual-scene job
  - Returns jobId
  │
  ▼
Worker: processSplitVisualSceneJob
  1. Download source files from MinIO
  2. Read scenes.json → get scene timing + frame range for sourceSceneId
  3. Calculate split point in frames
  4. Assign new IDs: next two available sequential scene IDs
  5. Run Phase 2 AI generation for each half (no re-planning)
     - Left: transcript words for startMs → splitAtMs, using original scene context
     - Right: transcript words for splitAtMs → endMs, using original scene context
  6. Update index.tsx: replace original <Sequence> with two new ones
  7. Update scenes.json: replace original entry with two new entries
  8. Remotion bundle (once)
  9. Upload new bundle to MinIO
  10. Update DB:
      - visuals.timestamps: replace original with two new entries
      - timelineItem[leftId].data.sourceSceneId = newLeftId
      - timelineItem[rightId].data.sourceSceneId = newRightId
  11. Publish job complete via WebSocket
  │
  ▼
Client receives WebSocket completion
  - Removes items from regeneratingItems
  - Calls reloadVisuals()
  - Preview updates
```

## New Job Data Structure

```typescript
interface SplitVisualSceneJobData {
  projectId: string;
  jobId: string;
  compositionId: string;   // e.g. "proj_abc_def"
  sourceSceneId: number;   // 1-indexed scene being split
  splitAtMs: number;       // Absolute timeline position of cut
  leftItemId: string;      // New timeline item ID (left half)
  rightItemId: string;     // New timeline item ID (right half)
}
```

## Files to Change

| Layer | File | Change |
|-------|------|--------|
| Queue | `packages/api/src/services/queue.ts` | Add `SplitVisualSceneJobData`, queue, `queueSplitVisualSceneJob` |
| API Route | `packages/api/src/routes/projects.ts` | Add `POST /projects/:id/split-visual-scene` |
| Worker Processor | `packages/worker/src/processors/split-visual-scene.ts` | New processor (main logic) |
| Worker Index | `packages/worker/src/index.ts` | Register new worker |
| Web API Client | `apps/web/src/lib/api.ts` | Add `splitVisualScene()` method |
| Editor Store | `apps/web/src/features/editor-v2/store/editor-store.ts` | Hook `splitItem` + add `regeneratingItems` state |
| Timeline UI | Visual item component | Show "Regenerating..." overlay on regenerating items |

## AI Generation Context Per Half

Each half receives Phase 2 (scene generation only, no re-planning) with:
- Original `SCENE_PLAN.md` (visual metaphor, style, persistent elements — for continuity)
- Original `scene_N.tsx` source code (so AI understands the visual language being used)
- Transcript words covering only that half's time range
- New frame duration for the half

## Scene ID Assignment

New scene IDs are assigned sequentially (next available numbers after existing scenes). This avoids naming conflicts when scenes are split multiple times and keeps `index.tsx` clean.

Example:
- Before: `scene_1`, `scene_2`, `scene_3`
- After splitting `scene_2`: `scene_1`, `scene_4`, `scene_5`, `scene_3`
  (scene_4 is the left half, scene_5 is the right half)
  (scene_2 file is deleted from the workspace)

## UI State

- `regeneratingItems: Set<string>` added to editor store (not persisted to DB)
- Visual timeline items in this set show a loading overlay/badge
- Cleared when job completes via WebSocket
