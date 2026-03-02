# Scene Split on Timeline Cut — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a user cuts a visual timeline item, automatically split the underlying Remotion scene file into two independent halves via AI regeneration.

**Architecture:** On `splitItem()` for visual items, trigger a `split-visual-scene` BullMQ job that uses the existing Claude editor infrastructure to split the scene file, rebundle, and update DB/timeline items. The client tracks job status via WebSocket and shows a "regenerating" overlay until done.

**Tech Stack:** Zustand (immer), BullMQ, Drizzle ORM, Fastify, WebSocket (ws.ts), Remotion bundler, Claude editor (edit-visuals.ts utilities)

---

### Task 1: Add `split-visual-scene` job type to queue service

**Files:**
- Modify: `packages/api/src/services/queue.ts`
- Modify: `packages/worker/src/processors/edit-visuals.ts` (export shared utilities)

**Step 1: Add job data type and queue to `packages/api/src/services/queue.ts`**

After the `editVisualsQueue` block (around line 172), add:

```typescript
// Split visual scene job — triggered when user cuts a visual timeline item
export interface SplitVisualSceneJobData {
  projectId: string;
  jobId: string;
  compositionId: string;      // e.g. "proj-abc-def" (with hyphens)
  sourceSceneId: number;      // 1-indexed scene being split
  splitAtMs: number;          // Absolute timeline position of cut
  leftItemId: string;         // New timeline item ID for left half
  rightItemId: string;        // New timeline item ID for right half
  transcript?: string;        // Full transcript text with timestamps for context
}

export const splitVisualSceneQueue = new Queue('split-visual-scene', { connection });

export async function queueSplitVisualSceneJob(data: SplitVisualSceneJobData) {
  return splitVisualSceneQueue.add('split-visual-scene', data, {
    jobId: `${data.projectId}:split:${Date.now()}`,
    attempts: 1,
  });
}
```

**Step 2: Export shared utilities from `packages/worker/src/processors/edit-visuals.ts`**

Change the four helper functions from `async function` to `export async function`:
- Line 122: `async function uploadBundleToStorage` → `export async function uploadBundleToStorage`
- Line 145: `async function uploadSourceToStorage` → `export async function uploadSourceToStorage`
- Line 171: `async function compileCjs` → `export async function compileCjs`
- Line 214: `async function autoFixProjectFiles` → `export async function autoFixProjectFiles`

Also export `runClaudeEditor` (around line 594):
- `async function runClaudeEditor` → `export async function runClaudeEditor`

And export the interface:
- `interface ClaudeEditorOptions` → `export interface ClaudeEditorOptions`

And export `injectUserAssets` (around line 251):
- `async function injectUserAssets` → `export async function injectUserAssets`

**Step 3: Verify the file compiles (no test needed, just check no TS errors)**

Run: `cd /Users/sarthakpant/project/clippify && npx tsc -p packages/worker/tsconfig.json --noEmit 2>&1 | head -20`

**Step 4: Commit**

```bash
git add packages/api/src/services/queue.ts packages/worker/src/processors/edit-visuals.ts
git commit -m "feat: add split-visual-scene job type and export edit-visuals utilities"
```

---

### Task 2: Create the API route `POST /projects/:id/split-visual-scene`

**Files:**
- Modify: `packages/api/src/routes/projects.ts`

**Step 1: Add the route handler after the `edit-visuals` route (after line 1019)**

First, add `queueSplitVisualSceneJob, splitVisualSceneQueue` to the imports at the top of the file.

Then add the route:

```typescript
// Split visual scene — triggered by timeline cut on a visual item
// Creates a job that splits the Remotion scene file into two halves via AI
fastify.post('/projects/:id/split-visual-scene', { preHandler: authMiddleware }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = z.object({
    compositionId: z.string().min(1),
    sourceSceneId: z.number().int().min(1),
    splitAtMs: z.number().int().min(0),
    leftItemId: z.string().uuid(),
    rightItemId: z.string().uuid(),
  }).parse(request.body);

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return reply.status(404).send({ error: 'Project not found' });
  }

  if (!checkProjectOwnership(project.userId, request.user?.id)) {
    return reply.status(403).send({ error: 'Access denied' });
  }

  const visual = await db.query.visuals.findFirst({
    where: eq(visuals.projectId, id),
  });

  if (!visual) {
    return reply.status(400).send({ error: 'No visuals to split. Generate visuals first.' });
  }

  // Fetch transcript for context
  const transcript = await db.query.transcripts.findFirst({
    where: eq(transcripts.projectId, id),
  });
  const transcriptText = transcript?.words
    ? (transcript.words as Array<{ word: string; start: number; end: number }>)
        .map((w) => `[${w.start.toFixed(2)}] ${w.word}`)
        .join(' ')
    : undefined;

  // Create job record
  const [job] = await db.insert(jobs).values({
    projectId: id,
    type: 'split-visual-scene',
    status: 'pending',
  }).returning();

  await queueSplitVisualSceneJob({
    projectId: id,
    jobId: job.id,
    compositionId: body.compositionId,
    sourceSceneId: body.sourceSceneId,
    splitAtMs: body.splitAtMs,
    leftItemId: body.leftItemId,
    rightItemId: body.rightItemId,
    transcript: transcriptText,
  });

  return { jobId: job.id };
});
```

**Step 2: Add `transcripts` to the imports at the top of projects.ts if not present**

Check: `grep -n "^import.*transcripts" packages/api/src/routes/projects.ts`

If not imported, add it to the db imports.

**Step 3: Commit**

```bash
git add packages/api/src/routes/projects.ts
git commit -m "feat: add split-visual-scene API route"
```

---

### Task 3: Add `splitVisualScene()` to web API client

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Step 1: Add types and method**

After the `editVisuals()` method (around line 402), add:

```typescript
async splitVisualScene(
  projectId: string,
  options: {
    compositionId: string;
    sourceSceneId: number;
    splitAtMs: number;
    leftItemId: string;
    rightItemId: string;
  }
): Promise<{ jobId: string }> {
  return this.request(`/api/projects/${projectId}/split-visual-scene`, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: add splitVisualScene API client method"
```

---

### Task 4: Add regenerating state to editor store and hook `splitItem`

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`

**Step 1: Add state fields to `EditorState` in `types.ts`**

Find the `EditorState` interface (around line 560) and add before the closing brace:

```typescript
// Visual scene regeneration tracking
regeneratingVisualItemIds: Set<string>;
splitJobToItems: Record<string, [string, string]>;  // jobId -> [leftId, rightId]
```

**Step 2: Add actions to `EditorActions` in `types.ts`**

In the `EditorActions` interface (around line 604), add:

```typescript
// Scene split regeneration
clearRegeneratingItems: (itemIds: string[]) => void;
removeSplitJob: (jobId: string) => void;
```

**Step 3: Initialize the new state in `initialState` in `editor-store.ts`**

Find `const initialState: EditorState = {` (around line 58) and add:

```typescript
regeneratingVisualItemIds: new Set<string>(),
splitJobToItems: {},
```

**Step 4: Implement the new actions in the store**

In the actions section (after `splitAllAtPlayhead`), add:

```typescript
clearRegeneratingItems: (itemIds: string[]) => {
  set((state) => {
    for (const id of itemIds) {
      state.regeneratingVisualItemIds.delete(id);
    }
  });
},

removeSplitJob: (jobId: string) => {
  set((state) => {
    delete state.splitJobToItems[jobId];
  });
},
```

**Step 5: Modify `splitItem` to trigger AI regen for visual items**

Replace the existing `splitItem` action (around line 1620):

```typescript
splitItem: (itemId: string, atMs: number) => {
  const item = get().items[itemId];
  if (!item) return;

  const splitRelativeMs = atMs - item.startMs;
  const duration = item.endMs - item.startMs;

  if (splitRelativeMs <= 100 || splitRelativeMs >= duration - 100) return;

  // Capture pre-split info for visual items
  const isVisual = item.type === 'visual';
  const visualData = isVisual ? (item.data as VisualItemData) : null;

  let splitResult: [string, string] | null = null;

  set((state) => {
    splitResult = splitItemInDraft(state, itemId, atMs);
    if (splitResult && isVisual) {
      state.regeneratingVisualItemIds.add(splitResult[0]);
      state.regeneratingVisualItemIds.add(splitResult[1]);
    }
  });

  get().pushHistory();
  debouncedSave(() => get().saveProject());

  // Trigger AI regeneration for visual splits
  if (isVisual && splitResult && visualData?.sourceSceneId) {
    const [leftId, rightId] = splitResult;
    const projectId = get().project?.id;
    if (projectId) {
      api.splitVisualScene(projectId, {
        compositionId: visualData.compositionId,
        sourceSceneId: visualData.sourceSceneId,
        splitAtMs: atMs,
        leftItemId: leftId,
        rightItemId: rightId,
      }).then(({ jobId }) => {
        wsClient.subscribeToJob(jobId);
        set((state) => {
          state.splitJobToItems[jobId] = [leftId, rightId];
        });
      }).catch((err) => {
        console.error('[splitItem] Failed to trigger scene split:', err);
        set((state) => {
          state.regeneratingVisualItemIds.delete(leftId);
          state.regeneratingVisualItemIds.delete(rightId);
        });
      });
    }
  }
},
```

**Step 6: Add `wsClient` import to `editor-store.ts`**

At the top, add: `import { wsClient } from '@/lib/ws';`

**Step 7: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat: add regeneratingVisualItemIds state and hook splitItem for visual splits"
```

---

### Task 5: Show "Regenerating" overlay on visual timeline items

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/renderers/types.ts`
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts`
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/renderers/VisualRenderer.ts`
- Modify: `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx` (or wherever `RenderState` is built)

**Step 1: Add `isRegenerating` to `RenderItemState` in `types.ts`**

```typescript
export interface RenderItemState {
  isSelected: boolean;
  isHovered: boolean;
  isDragPreview: boolean;
  isInvalid: boolean;
  zoom: number;
  isRegenerating: boolean;   // NEW
}
```

**Step 2: Add `regeneratingItemIds` to `RenderState` in `CanvasRenderer.ts`**

```typescript
export interface RenderState {
  // ... existing fields ...
  regeneratingItemIds?: Set<string>;  // NEW
}
```

**Step 3: Pass `isRegenerating` when building `RenderItemState` in `CanvasRenderer.ts`**

Find `drawItem` (line 260) and the `renderState` construction (around line 284):

```typescript
const renderState: RenderItemState = {
  isSelected,
  isHovered: false,
  isDragPreview: false,
  isInvalid: false,         // (already existing, check actual value)
  zoom: viewport.zoom,
  isRegenerating: state.regeneratingItemIds?.has(item.id) ?? false,  // NEW
};
```

Note: `drawItem` doesn't currently receive `state`. You'll need to either pass `regeneratingItemIds` as a parameter or make `drawItems` pass it to `drawItem`. Look at how `drawItems` calls `drawItem` and thread the set through.

Actually, the cleaner fix: change `drawItem` signature to accept `regeneratingItemIds`:
```typescript
private drawItem(
  item: TimelineItem,
  track: Track,
  trackY: number,
  viewport: Viewport,
  isSelected: boolean,
  regeneratingItemIds?: Set<string>,   // NEW
): void {
```

And in `drawItems`, pass `state.regeneratingItemIds` to each `drawItem` call.

**Step 4: Draw regenerating overlay in `VisualRenderer.ts`**

After the existing draw logic (after the label drawing, before `ctx.restore`), add:

```typescript
// Show "Regenerating" overlay if scene AI is regenerating
if (state.isRegenerating && width > 60) {
  ctx.save();
  roundRect(ctx, x + 1, y + 1, width - 2, height - 2, 5);
  ctx.clip();

  // Semi-transparent dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(x, y, width, height);

  // Regenerating text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Regenerating...', x + width / 2, y + height / 2);
  ctx.textAlign = 'left'; // reset

  ctx.restore();
}
```

**Step 5: Thread `regeneratingVisualItemIds` into `RenderState` in `TimelineCanvas.tsx`**

Find where `RenderState` is built (the call to `canvasRenderer.requestRender` or similar). Add `regeneratingItemIds: store.regeneratingVisualItemIds` to it.

**Step 6: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/canvas/renderers/types.ts \
        apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts \
        apps/web/src/features/editor-v2/timeline/canvas/renderers/VisualRenderer.ts \
        apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx
git commit -m "feat: show regenerating overlay on visual timeline items during scene split"
```

---

### Task 6: Handle job completion in Editor.tsx

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx`

**Step 1: Find the WebSocket message handler in `Editor.tsx` (around line 180)**

In the `useEffect` that calls `wsClient.addHandler`, add handling for split job completion.

The existing handler checks `message.type === 'job:complete'` and looks for `payload.audioItemId`. Add a new check after that:

```typescript
} else if (message.type === 'job:complete') {
  const payload = message.payload as JobCompletePayload;

  // Handle audio enhancement completion (existing)
  if ((payload as any).audioItemId) {
    // ... existing audio handling ...
  }

  // Handle split-visual-scene completion (NEW)
  const splitJobItems = store.splitJobToItems[payload.jobId];
  if (splitJobItems) {
    const [leftId, rightId] = splitJobItems;
    store.clearRegeneratingItems([leftId, rightId]);
    store.removeSplitJob(payload.jobId);
    wsClient.unsubscribeFromJob(payload.jobId);
    // Reload visuals to get updated sourceSceneId and bundleUrl
    if (project?.id) {
      store.reloadVisuals(project.id);
    }
  }
}
```

Note: `store` is the Zustand store instance — use the same pattern already in `Editor.tsx` for accessing store state and actions. Check what `Editor.tsx` imports from the store and use the same access pattern.

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx
git commit -m "feat: handle split-visual-scene job completion in Editor WebSocket handler"
```

---

### Task 7: Create the worker processor `split-visual-scene.ts`

**Files:**
- Create: `packages/worker/src/processors/split-visual-scene.ts`

**Step 1: Create the file**

```typescript
/**
 * Split Visual Scene Processor
 *
 * Splits a Remotion scene file into two halves when the user cuts a
 * visual timeline item. Uses the Claude editor to:
 * 1. Create two new scene files (left half + right half)
 * 2. Update index.tsx to reference the new scenes
 * 3. Update scenes.json with new timing entries
 * 4. Rebundle and re-upload
 * 5. Update DB: timeline items + visuals.timestamps
 */

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { db, projects, jobs, visuals, transcripts, timelineItems, tracks } from '../db/index.js';
import {
  publishJobProgress,
  publishJobComplete,
  publishJobError,
  setJobProjectId,
} from '../services/redis.js';
import { downloadSourceFromStorage } from '../services/minio.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getWorkspacePath, createProjectDir } from '../workspace.js';
import {
  uploadBundleToStorage,
  uploadSourceToStorage,
  compileCjs,
  autoFixProjectFiles,
  injectUserAssets,
  runClaudeEditor,
} from './edit-visuals.js';

export interface SplitVisualSceneJobData {
  projectId: string;
  jobId: string;
  compositionId: string;
  sourceSceneId: number;
  splitAtMs: number;
  leftItemId: string;
  rightItemId: string;
  transcript?: string;
}

export async function processSplitVisualSceneJob(job: Job<SplitVisualSceneJobData>) {
  const {
    projectId, jobId, compositionId, sourceSceneId,
    splitAtMs, leftItemId, rightItemId, transcript,
  } = job.data;

  setJobProjectId(jobId, projectId);

  // Convert compositionId: proj-xxx-xxx → proj_xxx_xxx for workspace dirs
  const workspaceCompositionId = compositionId.replace(/-/g, '_');

  const lockExtender = setInterval(async () => {
    try { await job.extendLock(job.token!, 120_000); } catch { /* ignore */ }
  }, 55_000);

  try {
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Loading project...');

    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) throw new Error('Project not found');

    const visual = await db.query.visuals.findFirst({ where: eq(visuals.projectId, projectId) });
    if (!visual) throw new Error('No visuals found');

    // Fetch left and right timeline items to know their current data
    const leftItem = await db.query.timelineItems.findFirst({
      where: eq(timelineItems.id, leftItemId),
    });
    const rightItem = await db.query.timelineItems.findFirst({
      where: eq(timelineItems.id, rightItemId),
    });
    if (!leftItem || !rightItem) throw new Error('Split timeline items not found in DB');

    // Set up workspace
    const projectDir = createProjectDir(workspaceCompositionId);
    const indexPath = join(projectDir, 'index.tsx');
    const scenesJsonPath = join(projectDir, 'scenes.json');

    await publishJobProgress(jobId, 10, 'Restoring source files...');

    // Download sources if not already in workspace
    if (!existsSync(indexPath) || !existsSync(scenesJsonPath)) {
      const sourceCompositionId = compositionId.replace(/_/g, '-');
      await downloadSourceFromStorage(sourceCompositionId, projectDir);
    } else {
      await publishJobProgress(jobId, 20, 'Source files already in workspace');
    }

    await injectUserAssets(projectId, projectDir);

    // Read scenes.json to find the target scene and determine new IDs
    await publishJobProgress(jobId, 25, 'Analyzing scene structure...');

    const scenesContent = await readFile(scenesJsonPath, 'utf-8');
    const scenesData = JSON.parse(scenesContent);
    const scenes: Array<{ id: number; timestampRange: [number, number]; name?: string; visual?: string }> =
      scenesData.scenes || [];

    const targetScene = scenes.find((s) => s.id === sourceSceneId);
    if (!targetScene) {
      throw new Error(`Scene ${sourceSceneId} not found in scenes.json`);
    }

    // Assign new sequential scene IDs
    const maxExistingId = Math.max(...scenes.map((s) => s.id));
    const leftSceneId = maxExistingId + 1;
    const rightSceneId = maxExistingId + 2;

    // Calculate frame info
    const fps = visual.fps || 30;
    const sceneStartMs = targetScene.timestampRange[0] * 1000;
    const sceneEndMs = targetScene.timestampRange[1] * 1000;
    const sceneStartSec = targetScene.timestampRange[0];
    const sceneEndSec = targetScene.timestampRange[1];
    const splitSec = splitAtMs / 1000;

    const totalSceneDurationMs = sceneEndMs - sceneStartMs;
    const splitOffsetMs = splitAtMs - sceneStartMs;
    const leftDurationFrames = Math.round((splitOffsetMs / 1000) * fps);
    const rightDurationFrames = Math.round(((totalSceneDurationMs - splitOffsetMs) / 1000) * fps);
    const totalSceneFrames = Math.round((totalSceneDurationMs / 1000) * fps);

    logger.info({
      projectId, sourceSceneId, leftSceneId, rightSceneId,
      leftDurationFrames, rightDurationFrames,
    }, 'Splitting scene');

    // Build the Claude editor prompt
    const prompt = `Split scene_${sourceSceneId} into two independent halves.

Original scene covers: ${sceneStartSec.toFixed(3)}s to ${sceneEndSec.toFixed(3)}s (${totalSceneFrames} frames at ${fps}fps)
Split point: ${splitSec.toFixed(3)}s from video start (${leftDurationFrames} frames from scene start)

STEP 1 — Read the current scenes/scene_${sourceSceneId}.tsx.

STEP 2 — Create scenes/scene_${leftSceneId}.tsx (LEFT HALF):
- Copy scenes/scene_${sourceSceneId}.tsx as the starting point
- Rename the component export to Scene${leftSceneId}
- This component plays for exactly ${leftDurationFrames} frames total
- Scale all interpolation inputRanges that referenced [0, ${totalSceneFrames}] to [0, ${leftDurationFrames}]
- Keep the visual look representing the first half of the original content

STEP 3 — Create scenes/scene_${rightSceneId}.tsx (RIGHT HALF):
- Copy scenes/scene_${sourceSceneId}.tsx as the starting point
- Rename the component export to Scene${rightSceneId}
- This component plays for exactly ${rightDurationFrames} frames total
- Scale all interpolation inputRanges that referenced [0, ${totalSceneFrames}] to [0, ${rightDurationFrames}]
- Keep the visual look representing the second half of the original content

STEP 4 — Update index.tsx:
- Read current index.tsx
- Add at top: import Scene${leftSceneId} from './scenes/scene_${leftSceneId}'; and import Scene${rightSceneId} from './scenes/scene_${rightSceneId}';
- Remove the import for Scene${sourceSceneId} (or scene_${sourceSceneId})
- Find the <Sequence> block that contains scene_${sourceSceneId} and replace it with TWO consecutive Sequence blocks:
  <Sequence from={ORIGINAL_FROM} durationInFrames={${leftDurationFrames}} name="scene_${leftSceneId}">
    <Scene${leftSceneId} />
  </Sequence>
  <Sequence from={ORIGINAL_FROM + ${leftDurationFrames}} durationInFrames={${rightDurationFrames}} name="scene_${rightSceneId}">
    <Scene${rightSceneId} />
  </Sequence>
  (where ORIGINAL_FROM is whatever the original from= value was)

STEP 5 — Update scenes.json:
- Read current scenes.json
- Replace the entry with id: ${sourceSceneId} with TWO entries:
  { "id": ${leftSceneId}, "timestampRange": [${sceneStartSec.toFixed(3)}, ${splitSec.toFixed(3)}], "name": "Scene ${leftSceneId}", "visual": "${targetScene.visual || 'Left half of scene ' + sourceSceneId}" }
  { "id": ${rightSceneId}, "timestampRange": [${splitSec.toFixed(3)}, ${sceneEndSec.toFixed(3)}], "name": "Scene ${rightSceneId}", "visual": "${targetScene.visual || 'Right half of scene ' + sourceSceneId}" }
- Keep all other scene entries unchanged

Do NOT modify SCENE_PLAN.md, constants.ts, or any other scene files.`;

    await publishJobProgress(jobId, 30, 'AI splitting scene...');

    // List existing files for Claude context
    const listFiles = async (dir: string, base = ''): Promise<string[]> => {
      const { readdir } = await import('fs/promises');
      const entries = await readdir(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const rel = base ? `${base}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          files.push(...await listFiles(join(dir, entry.name), rel));
        } else {
          files.push(rel);
        }
      }
      return files;
    };
    const existingFiles = await listFiles(projectDir);

    const editResult = await runClaudeEditor({
      projectId: workspaceCompositionId,
      jobId,
      projectDir,
      prompt,
      existingFiles,
      transcript,
    });

    await publishJobProgress(jobId, 70, 'Auto-fixing generated scenes...');
    await autoFixProjectFiles(projectDir);

    // Read updated scenes.json to get new scene timing for DB
    const updatedScenesContent = await readFile(scenesJsonPath, 'utf-8');
    const updatedScenesData = JSON.parse(updatedScenesContent);
    const updatedScenes: Array<{ id: number; timestampRange: [number, number]; name?: string; visual?: string }> =
      updatedScenesData.scenes || [];

    // Compile and bundle
    await publishJobProgress(jobId, 75, 'Bundling composition...');
    const bundleDir = join(config.remotion.bundleOutputDir, compositionId);

    // The bundling is triggered by the Claude editor (it runs remotion bundle).
    // Verify the bundle exists.
    const bundleIndex = join(bundleDir, 'index.html');
    if (!existsSync(bundleIndex)) {
      throw new Error(`Bundle not found at ${bundleDir} after AI editing. The Claude editor may not have triggered bundling.`);
    }

    await publishJobProgress(jobId, 82, 'Compiling for preview...');
    await compileCjs(projectDir, bundleDir);

    await publishJobProgress(jobId, 85, 'Uploading bundle...');
    await uploadBundleToStorage(bundleDir, compositionId);

    await publishJobProgress(jobId, 90, 'Uploading sources...');
    const sourceUrl = await uploadSourceToStorage(projectDir, compositionId);

    await publishJobProgress(jobId, 93, 'Updating database...');

    // Build new timestamps array replacing sourceSceneId with leftSceneId + rightSceneId
    const currentTimestamps = (visual.timestamps || []) as Array<{
      startMs: number; endMs: number; type: string; description?: string; sourceSceneId?: number;
    }>;

    const newTimestamps = currentTimestamps.flatMap((ts) => {
      if (ts.sourceSceneId === sourceSceneId) {
        const leftScene = updatedScenes.find((s) => s.id === leftSceneId);
        const rightScene = updatedScenes.find((s) => s.id === rightSceneId);
        return [
          {
            startMs: leftScene ? Math.round(leftScene.timestampRange[0] * 1000) : sceneStartMs,
            endMs: leftScene ? Math.round(leftScene.timestampRange[1] * 1000) : Math.round(splitAtMs),
            type: ts.type,
            description: leftScene?.visual || ts.description || '',
            sourceSceneId: leftSceneId,
          },
          {
            startMs: rightScene ? Math.round(rightScene.timestampRange[0] * 1000) : Math.round(splitAtMs),
            endMs: rightScene ? Math.round(rightScene.timestampRange[1] * 1000) : sceneEndMs,
            type: ts.type,
            description: rightScene?.visual || ts.description || '',
            sourceSceneId: rightSceneId,
          },
        ];
      }
      return [ts];
    });

    // Update visuals record
    await db.update(visuals)
      .set({ sourceUrl, timestamps: newTimestamps })
      .where(eq(visuals.id, visual.id));

    // Update left timeline item's sourceSceneId
    const leftData = { ...(leftItem.data as Record<string, unknown>), sourceSceneId: leftSceneId };
    await db.update(timelineItems)
      .set({ data: leftData })
      .where(eq(timelineItems.id, leftItemId));

    // Update right timeline item's sourceSceneId
    const rightData = { ...(rightItem.data as Record<string, unknown>), sourceSceneId: rightSceneId };
    await db.update(timelineItems)
      .set({ data: rightData })
      .where(eq(timelineItems.id, rightItemId));

    // Mark job complete
    await db.update(jobs)
      .set({
        status: 'complete',
        progress: 100,
        completedAt: new Date(),
        metrics: { durationMs: editResult.durationMs, filesWritten: editResult.filesEdited },
      })
      .where(eq(jobs.id, jobId));

    await db.update(projects)
      .set({ status: 'ready', outputKey: null, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId, compositionId, leftSceneId, rightSceneId }, 'Scene split complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Scene split failed');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.update(jobs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(jobs.id, jobId));

    await db.update(projects)
      .set({ status: 'failed' })
      .where(eq(projects.id, projectId));

    await publishJobError(jobId, errorMessage);
    throw error;
  } finally {
    clearInterval(lockExtender);
  }
}
```

**Step 2: Verify TypeScript**

Run: `cd /Users/sarthakpant/project/clippify && npx tsc -p packages/worker/tsconfig.json --noEmit 2>&1 | head -30`

Fix any type errors before committing.

**Step 3: Commit**

```bash
git add packages/worker/src/processors/split-visual-scene.ts
git commit -m "feat: create split-visual-scene worker processor"
```

---

### Task 8: Register the new worker in `packages/worker/src/index.ts`

**Files:**
- Modify: `packages/worker/src/index.ts`

**Step 1: Add import**

Near the top of the file, after the existing processor imports, add:

```typescript
import { processSplitVisualSceneJob, SplitVisualSceneJobData } from './processors/split-visual-scene.js';
```

Also import the queue from the queue service:

```typescript
// (These are already imported from queue service — verify or add)
import { splitVisualSceneQueue } from '../../../packages/api/src/services/queue.js';
// NOTE: Check how other queues are referenced. The worker likely has its own Queue instances.
// Add the queue definition in the worker similarly to how generateVisualsQueue is defined.
```

**IMPORTANT NOTE:** The worker creates its own `Queue` instances for each job type (it doesn't import from the API package directly — they both connect to the same Redis). Look at lines 133-145 of `index.ts` to see how `generateVisualsWorker` is created:

```typescript
const generateVisualsWorker = new Worker<GenerateVisualsJobData>('generate-visuals', ...)
```

The queue name string (`'generate-visuals'`) is what links them. Just create a Worker with the same queue name string `'split-visual-scene'`.

**Step 2: Register the worker**

After the `editVisualsWorker` block (around line 230), add:

```typescript
const splitVisualSceneWorker = new Worker<SplitVisualSceneJobData>(
  'split-visual-scene',
  processSplitVisualSceneJob,
  {
    connection,
    concurrency: 2,
    lockDuration: 5_400_000, // 90 minutes
    maxStalledCount: 0,
  }
);

splitVisualSceneWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'split-visual-scene job completed');
});

splitVisualSceneWorker.on('failed', async (job, err) => {
  logger.error({ jobId: job?.id, err }, 'split-visual-scene job failed');
});
```

**Step 3: Add to `allWorkers` array** (around line 339-344):

```typescript
const allWorkers = [
  transcribeWorker, renderWorker,
  generateVisualsWorker, planVisualsWorker, editVisualsWorker,
  splitVisualSceneWorker,   // NEW
  svgAnimationWorker, preloadProjectWorker,
  headTrackingWorker, generateReframeWorker, generateCaptionStylesWorker,
];
```

**Step 4: Verify TypeScript**

Run: `cd /Users/sarthakpant/project/clippify && npx tsc -p packages/worker/tsconfig.json --noEmit 2>&1 | head -20`

**Step 5: Commit**

```bash
git add packages/worker/src/index.ts
git commit -m "feat: register split-visual-scene worker"
```

---

### Task 9: Handle the bundling step in the processor

**Context:** The `runClaudeEditor` function (via the Claude agent SDK) runs the Remotion bundler as part of its process. However, verify this by checking the Claude editor's system prompt in `edit-visuals.ts` around line 594+.

If the Claude editor does NOT trigger bundling (i.e., bundling is done separately after `runClaudeEditor` returns), then update the processor in Task 7 to call the bundler directly.

**Step 1: Check edit-visuals.ts to see if bundling happens inside runClaudeEditor or outside**

Read: `packages/worker/src/processors/edit-visuals.ts` lines 427-445

```
await publishJobProgress(jobId, 88, 'Verifying bundle...');
const bundleDir = join(config.remotion.bundleOutputDir, compositionId);
const bundleIndex = join(bundleDir, 'index.html');
try {
  await readFile(bundleIndex);
  // ...
} catch {
  throw new Error(`Bundle not found at ${bundleDir}. Editor may have failed to create it.`);
}
```

The comment says "Editor may have failed to create it" — so bundling IS done inside `runClaudeEditor` by the Claude agent itself (using the bundler tool). This confirms the Task 7 approach is correct: verify bundle exists after `runClaudeEditor`.

**No code change needed.** Just leave a note for the implementor: if the bundle verification fails, the Claude agent did not bundle — check the agent's tools and prompt.

---

### Task 10: Smoke test the full flow

**Manual test steps:**

1. Start all services: `pnpm dev` from project root
2. Open a project with generated visuals
3. In the timeline, use the split tool (S key) to cut a visual item
4. Verify:
   - Both halves immediately appear in the timeline with "Regenerating..." overlay
   - In the browser network tab: `POST /api/projects/:id/split-visual-scene` returns 200 with `{ jobId }`
   - In worker logs: `split-visual-scene` job appears and starts processing
   - After job completes: overlay disappears, visuals reload
   - Preview shows new content for each half

5. Check DB directly to verify:
   - `timeline_items` for both item IDs have different `sourceSceneId` values
   - `visuals.timestamps` has two entries where one existed before

**Step 1: Commit any final fixes**

```bash
git add -A
git commit -m "feat: complete scene split on timeline cut feature"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `packages/api/src/services/queue.ts` | +`SplitVisualSceneJobData`, `splitVisualSceneQueue`, `queueSplitVisualSceneJob` |
| `packages/worker/src/processors/edit-visuals.ts` | Export 6 shared utilities |
| `packages/api/src/routes/projects.ts` | +`POST /projects/:id/split-visual-scene` |
| `apps/web/src/lib/api.ts` | +`splitVisualScene()` |
| `apps/web/src/features/editor-v2/store/types.ts` | +`regeneratingVisualItemIds`, `splitJobToItems` state + actions |
| `apps/web/src/features/editor-v2/store/editor-store.ts` | Hook `splitItem` to trigger AI regen |
| `apps/web/src/features/editor-v2/timeline/canvas/renderers/types.ts` | +`isRegenerating` to `RenderItemState` |
| `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts` | Thread `regeneratingItemIds` through `drawItem` |
| `apps/web/src/features/editor-v2/timeline/canvas/renderers/VisualRenderer.ts` | Draw regenerating overlay |
| `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx` | Pass `regeneratingVisualItemIds` to render state |
| `apps/web/src/features/editor-v2/Editor.tsx` | Handle split job completion via WebSocket |
| `packages/worker/src/processors/split-visual-scene.ts` | New processor (main logic) |
| `packages/worker/src/index.ts` | Register new worker |
