# Export Pipeline Simplification — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1014-line dual-path render processor with a ~200-line unified pipeline that renders directly from the workspace bundle + manifest, eliminating `manifest-to-props.ts`, the legacy DB-based render path, and the `@viona/renderer` dependency.

**Architecture:** The export pipeline snapshots the workspace manifest and passes it as `inputProps` to `renderMedia()` using the workspace's Remotion bundle (which contains `PlayerComposition` → `FullComposition` with all scenes, captions, and layout code). This is the same bundle the frontend preview uses — guaranteeing preview === export. Font resolution moves into the codegen'd `PlayerComposition.tsx` via `@remotion/google-fonts`, and media files are copied into the bundle's `public/` directory.

**Note on ExportShell:** The spec envisions separate `PreviewShell` and `ExportShell` wrappers around `CompositionCore`. The current implementation uses `PlayerComposition` (which wraps `FullComposition`) for both preview and export, with composition ID `'Preview'`. This is a justified simplification — `PlayerComposition` already IS the thin wrapper, and having a single component guarantees byte-identical rendering. If export-specific behavior is needed later (e.g., watermarks), a separate composition ID can be registered in `Root.tsx` without changing the core architecture.

**Edge case — projects without visuals:** Projects with only captions and/or video (no AI-generated scenes) are fully supported. The codegen produces an empty `SCENE_MAP`, and `FullComposition` renders video + captions without any scenes. This unified path replaces the legacy no-visuals FFmpeg/Remotion fallback paths.

**Tech Stack:** Remotion `renderMedia()` + `selectComposition()`, BullMQ, MinIO/S3, esbuild (existing bundler-service)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/worker/src/processors/render/index.ts` | **Rewrite** | Slim unified render processor (~200 lines) |
| `packages/worker/src/processors/render/manifest-to-props.ts` | **Delete** | Replaced by codegen in PlayerComposition |
| `packages/worker/src/processors/render/subtitles.ts` | **Delete** | Captions handled by FullComposition |
| `packages/worker/src/processors/render/types.ts` | **Simplify** | Keep `RenderJobData`, `RenderRemotionOptions`, `VideoCropSettings`, `LayoutSegment`. Remove legacy types. |
| `packages/api/src/workspace/workspace-service.ts` | **Modify** | Add `getWorkspaceBundlePath()` export |
| `packages/api/src/workspace/bundler-service.ts` | **Modify** | Expose `getBundleOutputDir()` for worker |
| `packages/api/src/routes/projects.ts` | **Modify** | Include `bundlePath` in render job data |
| `packages/shared/src/queue-types.ts` | **Modify** | Add `bundlePath` + `workspaceSrcPath` to `RenderJobData` |

---

## Chunk 1: Slim Down the Render Processor

### Task 1: Add workspace paths to render job data

The worker needs to know where the workspace bundle and source files are. Currently the render route only passes `manifest` — we need to also pass `bundlePath` (the Remotion bundle output directory) and `workspaceSrcPath` (for copying media to public/).

**Files:**
- Modify: `packages/shared/src/queue-types.ts`
- Modify: `packages/api/src/routes/projects.ts:835-883`
- Modify: `packages/api/src/workspace/bundler-service.ts`

- [ ] **Step 1: Add fields to shared RenderJobData type**

In `packages/shared/src/queue-types.ts`, find the `RenderJobData` interface (or wherever the shared render job type lives — it may be in `packages/worker/src/processors/render/types.ts`). Add:

```typescript
/** Path to workspace Remotion bundle directory (set when workspace is active) */
workspaceBundlePath?: string;
```

If the shared type is actually in `packages/worker/src/processors/render/types.ts`, add it there in the `RenderJobData` interface after the `manifest` field:

```typescript
/** Path to workspace Remotion bundle directory */
workspaceBundlePath?: string;
```

- [ ] **Step 2: Expose bundle path from bundler-service**

In `packages/api/src/workspace/bundler-service.ts`, the `getBundlePath(projectId)` method already exists (line ~255). Verify it returns the correct path:

```typescript
getBundlePath(projectId: string): string {
  return join(this.bundleOutputDir, projectId);
}
```

This is already correct — no change needed if it exists.

- [ ] **Step 3: Pass workspace bundle path in render route**

In `packages/api/src/routes/projects.ts`, in the `POST /projects/:id/render` handler (line ~836), after snapshotting the manifest, also resolve the workspace bundle path:

```typescript
// Snapshot workspace manifest if active (immutable copy for export)
let manifestSnapshot = null;
let workspaceBundlePath: string | null = null;
if (await isWorkspaceActive(id)) {
  manifestSnapshot = await snapshotManifest(id);
  workspaceBundlePath = bundlerService.getBundlePath(id);
}

// Queue the job with layout settings and workspace data
await queueRenderJob({
  projectId: id,
  jobId: job.id,
  projectType: project.projectType || 'video',
  layoutSettings: body.layoutSettings,
  fullscreenSegments: body.fullscreenSegments,
  visualDisplayData: body.visualDisplayData,
  ...(manifestSnapshot ? { manifest: manifestSnapshot } : {}),
  ...(workspaceBundlePath ? { workspaceBundlePath } : {}),
});
```

Add the import for `bundlerService` at the top of the file if not already imported:

```typescript
import { bundlerService } from '../workspace/bundler-service.js';
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/queue-types.ts packages/api/src/routes/projects.ts packages/api/src/workspace/bundler-service.ts packages/worker/src/processors/render/types.ts
git commit -m "feat(render): pass workspace bundle path in render job data"
```

---

### Task 2: Rewrite renderFromManifest to use workspace bundle directly

Replace the current `renderFromManifest()` (lines 83-230 in `index.ts`) which converts manifest → FullCompositionProps via `manifestToProps()` and uses the old per-visual bundle. The new version passes the manifest directly as `inputProps` to `renderMedia()` using the workspace bundle.

**Files:**
- Modify: `packages/worker/src/processors/render/index.ts:83-230`

- [ ] **Step 1: Rewrite renderFromManifest**

Replace the `renderFromManifest` function with this implementation that passes manifest directly as inputProps:

```typescript
/**
 * Workspace-based render path.
 * Uses the workspace Remotion bundle directly with manifest as inputProps.
 * The bundle's PlayerComposition handles all conversion internally.
 */
async function renderFromManifest(
  jobData: RenderJobData,
  workDir: string,
  jobId: string,
): Promise<boolean> {
  const manifest = jobData.manifest;
  const bundlePath = jobData.workspaceBundlePath;
  if (!manifest || !bundlePath) return false;

  const projectId = jobData.projectId;

  await publishJobProgress(jobId, 5, 'Preparing workspace-based render...');

  // 1. Load project for source media keys
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new Error(`Project not found: ${projectId}`);

  // 2. Download source media
  const isAudioProject = (jobData.projectType || project.projectType || 'video') === 'audio';
  let sourceVideoPath: string | undefined;
  let audioPath: string | undefined;

  if (isAudioProject) {
    if (project.audioKey) {
      const audioExt = project.audioKey.match(/\.[^.]+$/)?.[0] || '.mp3';
      audioPath = join(workDir, `input${audioExt}`);
      await downloadFile('uploads', project.audioKey, audioPath);
    }
  } else {
    if (project.videoKey) {
      sourceVideoPath = join(workDir, 'input.mp4');
      await downloadFile('uploads', project.videoKey!, sourceVideoPath);
    }
  }

  await publishJobProgress(jobId, 15, 'Preparing bundle assets...');

  // 3. Copy source media into bundle's public/ directory
  const bundlePublicDir = join(bundlePath, 'public');
  await mkdir(bundlePublicDir, { recursive: true });

  let videoUrl: string | undefined;
  let audioUrl: string | undefined;

  if (sourceVideoPath) {
    await copyFile(sourceVideoPath, join(bundlePublicDir, 'source.mp4'));
    videoUrl = 'source.mp4';
  }
  if (isAudioProject && audioPath) {
    // Preserve original extension (.mp3, .m4a, .wav, etc.) — don't rename to .mp4
    const audioFilename = `audio${audioPath.match(/\.[^.]+$/)?.[0] || '.mp3'}`;
    await copyFile(audioPath, join(bundlePublicDir, audioFilename));
    audioUrl = audioFilename;
  }

  // 4. Handle video clips (YouTube clips for scenes)
  if (jobData.videoClipData?.length) {
    const { clips: videoClipPaths } = await downloadVideoClipsForRender(
      projectId, workDir, jobData.videoClipData,
    );
    if (videoClipPaths.size > 0) {
      const bundleClipsDir = join(bundlePublicDir, 'assets', 'clips');
      await mkdir(bundleClipsDir, { recursive: true });
      for (const [, clipPath] of videoClipPaths) {
        await copyFile(clipPath, join(bundleClipsDir, basename(clipPath)));
      }
    }
  }

  // 5. Handle enhanced audio
  const allItems = (manifest as any).items || [];
  const enhancedAudioItem = allItems.find((item: any) =>
    item.type === 'audio' && item.data?.isEnhanced && item.data?.src,
  );

  if (enhancedAudioItem) {
    const audioSrc = enhancedAudioItem.data.src as string;
    const audioKeyMatch = audioSrc.match(/\/media\/outputs\/(.+)$/);
    if (audioKeyMatch) {
      try {
        const enhancedPath = join(workDir, 'enhanced.m4a');
        await downloadFile('outputs', audioKeyMatch[1], enhancedPath);
        await copyFile(enhancedPath, join(bundlePublicDir, 'enhanced.m4a'));
        audioUrl = 'enhanced.m4a';
      } catch (err) {
        logger.warn({ err }, 'Failed to download enhanced audio, using original');
      }
    }
  }

  await publishJobProgress(jobId, 25, 'Rendering video...');

  // 6. Build inputProps — manifest + media URLs
  const inputProps = {
    manifest,
    videoUrl,
    audioUrl,
  };

  const propsPath = join(workDir, 'input-props.json');
  await writeFile(propsPath, JSON.stringify(inputProps), 'utf-8');

  // 7. Render with Remotion
  const outputPath = join(workDir, 'output.mp4');
  await renderWithRemotion({
    bundlePath,
    compositionId: 'Preview',
    outputPath,
    propsPath,
    onProgress: (progress) => {
      const jobProgress = 25 + Math.round(progress * 65);
      publishJobProgress(jobId, jobProgress, `Rendering: ${Math.round(progress * 100)}%`);
    },
  });

  await publishJobProgress(jobId, 92, 'Uploading output...');

  // 8. Upload to S3
  const outputKey = `${nanoid()}/output.mp4`;
  await uploadFile('outputs', outputKey, outputPath);

  // 9. Update project + job
  await db.update(projects).set({
    status: 'complete',
    outputKey,
    updatedAt: new Date(),
  }).where(eq(projects.id, projectId));

  await db.update(jobs)
    .set({ status: 'complete', progress: 100, completedAt: new Date() })
    .where(eq(jobs.id, jobId));

  await publishJobProgress(jobId, 100, 'Complete');
  await publishJobComplete(jobId, projectId);

  return true;
}
```

Key differences from the old version:
- Uses `jobData.workspaceBundlePath` instead of deriving bundle from `visuals` table
- Passes `{ manifest, videoUrl, audioUrl }` as inputProps (matching `PlayerComposition` props)
- Uses composition ID `'Preview'` (registered by codegen'd Root.tsx)
- No `manifestToProps()` call — PlayerComposition does conversion internally
- No font resolution — `@remotion/google-fonts` in the bundle handles it in headless Chrome

- [ ] **Step 2: Remove manifestToProps import**

At the top of `index.ts`, remove:
```typescript
import { manifestToProps } from './manifest-to-props.js';
```

Also remove unused type import if present:
```typescript
import type { Manifest } from '@viona/shared';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/worker && npx tsc --noEmit --pretty false`
Expected: No new errors (legacy path still uses some of the old imports, but `manifestToProps` should only be used in `renderFromManifest`).

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/processors/render/index.ts
git commit -m "feat(render): rewrite renderFromManifest to use workspace bundle directly"
```

---

### Task 3: Delete legacy render path and supporting files

Now that `renderFromManifest` handles all workspace-based renders, the 700+ line legacy DB-based fallback path (lines 254-965) can be removed. Projects without an active workspace will need to spin one up before rendering — this is already the expected flow per the spec.

**Files:**
- Modify: `packages/worker/src/processors/render/index.ts:232-1014`
- Delete: `packages/worker/src/processors/render/manifest-to-props.ts`
- Delete: `packages/worker/src/processors/render/subtitles.ts`

- [ ] **Step 1: Simplify processRenderJob**

Replace the entire `processRenderJob` function (lines 232-1014) with a slim version:

```typescript
export async function processRenderJob(job: Job<RenderJobData>) {
  const { projectId, jobId } = job.data;
  setJobProjectId(jobId, projectId);
  const workDir = join(tmpdir(), `viona-render-${nanoid()}`);

  try {
    await mkdir(workDir, { recursive: true });

    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    // Render from workspace manifest + bundle
    const handled = await renderFromManifest(job.data, workDir, jobId);
    if (!handled) {
      throw new Error(
        'Workspace render not available — manifest or bundle path missing. ' +
        'Ensure the workspace is active before exporting.',
      );
    }

  } catch (error) {
    logger.error({ projectId, err: error }, 'Render failed');

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
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
```

- [ ] **Step 2: Clean up imports at top of index.ts**

Remove unused imports from the top of the file. The new version needs:

```typescript
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, writeFile, copyFile } from 'fs/promises';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { db, projects, jobs } from '../../db/index.js';
import { downloadFile, uploadFile } from '../../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError, setJobProjectId } from '../../services/redis.js';
import { logger } from '../../logger.js';
import {
  downloadVideoClipsForRender,
  renderWithRemotion,
} from './ffmpeg.js';
import type { RenderJobData } from './types.js';
```

Remove these imports that are no longer needed:
- `readFile` from fs/promises
- `tracks, timelineItems, visuals` from db
- `convertToSubtitles` from subtitles
- `resolveAvailableFontFamily, ensureFontsDir, downloadFont, SYSTEM_FONTS_DIR` from fonts
- `hasZoneBasedVisuals` from ffmpeg
- `manifestToProps` from manifest-to-props
- `escapePathForFilter` from types
- `config` from config
- Type imports: `Manifest`, `VideoCropSettings`, `SegmentationData`, `LayoutSegment`

- [ ] **Step 3: Remove re-exports**

Remove the re-export lines near the top of the file:
```typescript
// Remove these:
export { convertToSubtitles } from './subtitles.js';
export { resolveAvailableFontFamily } from './fonts.js';
```

Keep only:
```typescript
export type { RenderJobData } from './types.js';
```

- [ ] **Step 4: Remove the top-level buildLayoutSegments function**

The `buildLayoutSegments` function (lines 38-76) is part of the legacy path. Delete it. The codegen'd PlayerComposition has its own inline version.

- [ ] **Step 5: Delete manifest-to-props.ts**

```bash
rm packages/worker/src/processors/render/manifest-to-props.ts
```

- [ ] **Step 6: Delete subtitles.ts**

```bash
rm packages/worker/src/processors/render/subtitles.ts
```

- [ ] **Step 7: Check for remaining references to deleted files**

Search for imports of `manifest-to-props` and `subtitles` (from the render directory) across the codebase. Fix any remaining references.

Run: Search for `from.*manifest-to-props` and `from.*\/subtitles` in `packages/worker/src/`.

If `subtitles.ts` is imported elsewhere, check whether the callers actually still need it. The `convertToSubtitles` function was only used by the legacy render path.

- [ ] **Step 8: Verify TypeScript compiles**

Run: `cd packages/worker && npx tsc --noEmit --pretty false`
Expected: No new errors.

- [ ] **Step 9: Commit**

```bash
git add packages/worker/src/processors/render/index.ts
git rm packages/worker/src/processors/render/manifest-to-props.ts packages/worker/src/processors/render/subtitles.ts
git commit -m "refactor(render): delete legacy DB-based render path and manifest-to-props (~800 LOC)"
```

---

## Chunk 2: Clean Up Types and Font Handling

### Task 4: Simplify render types

Remove legacy types from `types.ts` that were only used by the deleted render path.

**Files:**
- Modify: `packages/worker/src/processors/render/types.ts`

- [ ] **Step 1: Remove unused types**

In `packages/worker/src/processors/render/types.ts`, remove these types that are no longer referenced:

- `FullscreenSegment` (line 77-80) — was used by legacy path
- `DisplayModeSegment` (line 91-96) — was used by legacy path
- `LayoutSettings` (line 52-75) — layout info now comes from manifest
- `PIP_SIZE_MAP` (line 13-18) — PiP resolution now in PlayerComposition

Keep:
- `RenderJobData` (with new `workspaceBundlePath` field)
- `RenderRemotionOptions`
- `VideoCropSettings` (still used by ffmpeg.ts `buildVideoCropFilter`)
- `LayoutSegment` (still used by ffmpeg.ts)
- `VideoAssetEntry`, `VideoManifest`, `VideoClipOverride` (used by ffmpeg.ts clip downloading)
- `OverlayZone` (used by ffmpeg.ts)
- YouTube URL patterns and `isValidYouTubeUrl`
- `SegmentationData` — check if still used; if not, remove
- `escapePathForFilter` — check if still used by fonts.ts; if so, keep

- [ ] **Step 2: Remove unused fields from RenderJobData**

In `RenderJobData`, remove fields only consumed by the legacy path:

```typescript
export interface RenderJobData {
  projectId: string;
  jobId: string;
  projectType?: string;
  // Video clip trim data from user-edited templateProps
  videoClipData?: Array<{
    sourceSceneId: number;
    sourceVideoUrl: string;
    trimStartSeconds: number;
    trimEndSeconds: number;
  }>;
  /** Workspace manifest snapshot — when present, workspace render path is used */
  manifest?: unknown;
  /** Path to workspace Remotion bundle directory */
  workspaceBundlePath?: string;
}
```

Remove:
- `layoutSettings?: LayoutSettings` — layout from manifest
- `fullscreenSegments?: FullscreenSegment[]` — no longer used
- `visualDisplayData?: Array<...>` — visual data from manifest

- [ ] **Step 3: Update render route to stop sending removed fields**

In `packages/api/src/routes/projects.ts`, update the `queueRenderJob` call to remove the deleted fields but keep `videoClipData` (still needed for YouTube clip downloading in the new render path):

```typescript
const body = request.body as { videoClipData?: Array<{ sourceSceneId: number; sourceVideoUrl: string; trimStartSeconds: number; trimEndSeconds: number }> } || {};

await queueRenderJob({
  projectId: id,
  jobId: job.id,
  projectType: project.projectType || 'video',
  videoClipData: body.videoClipData,
  ...(manifestSnapshot ? { manifest: manifestSnapshot } : {}),
  ...(workspaceBundlePath ? { workspaceBundlePath } : {}),
});
```

Remove `layoutSettings`, `fullscreenSegments`, `visualDisplayData` from the call and from the body type extraction.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/worker && npx tsc --noEmit --pretty false`
Run: `cd packages/api && npx tsc --noEmit --pretty false`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/processors/render/types.ts packages/api/src/routes/projects.ts
git commit -m "refactor(render): remove legacy render types and job data fields"
```

---

### Task 5: Add Google Font loading to PlayerComposition codegen

The legacy render path manually resolved fonts via `ensureFontsDir()` + `resolveAvailableFontFamily()`. The new path relies on `@remotion/google-fonts` loading fonts in headless Chrome during `renderMedia()`. The codegen'd `PlayerComposition.tsx` needs to import and call `loadFont()` for the manifest's caption font.

**Files:**
- Modify: `packages/api/src/workspace/workspace-codegen.ts:59-234`

- [ ] **Step 1: Add font loading to generated PlayerComposition code**

Use the static codegen approach: at codegen time, read the manifest to determine the caption font family, then generate a static `import { loadFont }` from `@remotion/google-fonts`. This is deterministic and works with both webpack (Remotion bundle) and esbuild (CJS compilation).

In `workspace-codegen.ts`, in the `generatePlayerComposition` function, after discovering scenes, read the manifest to get the font:

```typescript
// In generatePlayerComposition(), read manifest to get font family
const manifestPath = getManifestPath(projectId);
let captionFontFamily = 'Inter';
try {
  const manifestJson = await readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestJson);
  captionFontFamily = manifest.captionStyle?.fontFamily || 'Inter';
} catch {
  // Manifest may not exist yet during initial codegen — default to Inter
}

const fontModuleName = captionFontFamily.replace(/\s+/g, '');
const fontImport = captionFontFamily !== 'Inter'
  ? `import { loadFont } from '@remotion/google-fonts/${fontModuleName}';\nloadFont();\n`
  : '';
```

Then include `${fontImport}` in the generated code template string after the existing imports:

```typescript
const code = `import React from 'react';
import { useVideoConfig } from 'remotion';
import { FullComposition } from './composition/index';
import type { SceneItem, SubtitleItemData, SubtitleWordData, SubtitleStyle, LayoutSegment } from './composition/types';
${sceneImports}
${fontImport}
// Scene registry — maps sceneFile paths to React components
...
`;
```

When the user changes their caption font, the workspace service calls `generatePlayerComposition` again + triggers a rebuild, which regenerates the font import automatically.

- [ ] **Step 2: Add readFile import to workspace-codegen.ts**

At the top of `workspace-codegen.ts`, add `readFile` to the fs/promises import:

```typescript
import { readdir, readFile, writeFile } from 'fs/promises';
```

Also add the `getManifestPath` import:

```typescript
import { getWorkspaceSrcPath, getScenesPath, getManifestPath } from './workspace-config.js';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/workspace/workspace-codegen.ts
git commit -m "feat(codegen): add Google Fonts loading to generated PlayerComposition"
```

---

### Task 6: Verify fonts.ts is still needed and clean up

The `fonts.ts` module had two consumers: the legacy render path (deleted) and potentially the visual generation pipeline. Check if it's still imported anywhere and remove if unused.

**Files:**
- Possibly modify: `packages/worker/src/processors/render/fonts.ts`
- Modify: `packages/worker/src/processors/render/index.ts` (remove font imports if present)

- [ ] **Step 1: Search for fonts.ts imports**

Search the worker package for any remaining imports of fonts.ts functions:

```
grep -r "from.*\/fonts" packages/worker/src/ --include="*.ts"
```

If the only consumer was `render/index.ts` (now cleaned up) and the re-export in `render/index.ts` (now removed), then `fonts.ts` is unused by the render pipeline.

However, `fonts.ts` may still be needed for:
- Visual generation pipeline (if it resolves fonts for scene rendering)
- Other processors

If `fonts.ts` is only referenced from `render/index.ts`, do NOT delete it yet — it contains useful font infrastructure that may be needed by the visual generation pipeline. Just ensure it's no longer imported from `render/index.ts`.

- [ ] **Step 2: Verify no broken imports**

Run: `cd packages/worker && npx tsc --noEmit --pretty false`
Expected: No new errors.

- [ ] **Step 3: Commit (if changes needed)**

```bash
git add packages/worker/src/processors/render/
git commit -m "refactor(render): clean up unused font imports"
```

---

## Chunk 3: End-to-End Verification

### Task 7: Ensure render route handles non-workspace projects gracefully

When a project's workspace is not active, the render should fail with a clear error rather than silently falling through. The render route should ensure the workspace is spun up before queuing the render.

**Files:**
- Modify: `packages/api/src/routes/projects.ts:835-883`

- [ ] **Step 1: Ensure workspace is active and bundle is built before render**

In the render route handler, after checking project ownership, add workspace activation and bundle build wait:

```typescript
// Ensure workspace is active for rendering
if (!(await isWorkspaceActive(id))) {
  // Spin up workspace — this generates manifest, copies composition, runs codegen
  // NOTE: spinUpWorkspace queues a bundle build async (fire-and-forget via .then())
  await spinUpWorkspace(id);
}

// Always await a bundle build to ensure it's ready for export.
// enqueueBuild is idempotent — if the bundle is already built and source hash matches,
// it returns immediately from cache. If a build is already queued from spinUpWorkspace,
// the debounce timer deduplicates it. The returned Promise resolves when the build completes.
await bundlerService.enqueueBuild(id, 'user');

// Snapshot workspace manifest (now guaranteed to exist)
const manifestSnapshot = await snapshotManifest(id);
if (!manifestSnapshot) {
  return reply.status(500).send({ error: 'Failed to snapshot workspace manifest' });
}

const workspaceBundlePath = bundlerService.getBundlePath(id);
```

Add import for `spinUpWorkspace`:

```typescript
import { isWorkspaceActive, snapshotManifest, spinUpWorkspace } from '../workspace/workspace-service.js';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/projects.ts
git commit -m "feat(render): ensure workspace is active before export rendering"
```

---

### Task 8: Verify full pipeline compiles and check line count

Final verification that all packages compile and the render processor is significantly smaller.

**Files:**
- No changes — verification only

- [ ] **Step 1: Verify all packages compile**

```bash
cd packages/api && npx tsc --noEmit --pretty false
cd ../worker && npx tsc --noEmit --pretty false
cd ../../apps/web && npx tsc --noEmit --pretty false
```

Expected: No new TypeScript errors in any package.

- [ ] **Step 2: Count lines in new render/index.ts**

```bash
wc -l packages/worker/src/processors/render/index.ts
```

Expected: ~150-200 lines (down from 1014).

- [ ] **Step 3: Verify manifest-to-props.ts and subtitles.ts are gone**

```bash
ls packages/worker/src/processors/render/manifest-to-props.ts 2>&1
ls packages/worker/src/processors/render/subtitles.ts 2>&1
```

Expected: "No such file or directory" for both.

- [ ] **Step 4: Check for any remaining @viona/renderer imports in worker**

```bash
grep -r "@viona/renderer" packages/worker/src/ --include="*.ts"
```

If `@viona/renderer` is still imported anywhere (e.g., `subtitles.ts` was importing its types), those imports need to be removed or the consuming code deleted.

The `@viona/renderer` package itself is NOT deleted in this plan — that's a separate cleanup task. This plan only removes the worker's dependency on it for the render pipeline.

- [ ] **Step 5: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore(render): fix remaining compilation issues from pipeline simplification"
```

---

## Summary

**Before:** 1014-line `render/index.ts` + 287-line `manifest-to-props.ts` + 18-line `subtitles.ts` = ~1,319 lines
**After:** ~150-200-line `render/index.ts` = ~175 lines

**Net deletion:** ~1,100+ lines

**What was eliminated:**
- Legacy DB-based render path (~700 lines of layout/subtitle/font/FFmpeg code)
- `manifest-to-props.ts` (287 lines) — conversion duplicated by codegen
- `subtitles.ts` (18 lines) — captions handled by FullComposition
- Manual font resolution — replaced by `@remotion/google-fonts` in bundle
- Multiple render paths (audio-only FFmpeg, no-visuals Remotion, visual Remotion) — unified into single `renderMedia()` call

**What was preserved:**
- `ffmpeg.ts` — still needed for video clip downloading (`downloadVideoClipsForRender`) and `renderWithRemotion` (the `renderMedia` wrapper)
- `fonts.ts` — may still be used by visual generation pipeline
- `types.ts` — slimmed but kept for `RenderJobData`, `VideoCropSettings`, etc.

**Note on line count:** The spec estimated ~100 lines. The actual result is ~175-200 lines due to enhanced audio handling, video clip downloading, and audio-only project support that the spec's estimate didn't account for. The core render flow (manifest → inputProps → renderMedia → upload) is ~40 lines; the rest is media file preparation.
