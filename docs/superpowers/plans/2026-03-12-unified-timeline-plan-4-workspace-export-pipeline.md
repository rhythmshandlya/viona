# Workspace-Based Export Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the render processor to use the workspace manifest as its data source instead of reconstructing composition props from DB queries. The existing `FullComposition` rendering engine stays intact — this plan changes *how we feed it data*, not *how it renders*.

**Architecture:** The render processor currently reads the DB directly, builds layout segments, resolves fonts, constructs subtitles, and assembles a massive `composition-props.json`. After this plan, it reads the workspace manifest (snapshot at render time), converts it to `FullCompositionProps` via a bridge function, and passes that to `renderMedia()`. This eliminates ~500 lines of DB orchestration while keeping the battle-tested rendering path. A future plan will unify FullComposition and the frontend Composition.tsx into CompositionCore.

**Tech Stack:** Node.js, Remotion `renderMedia()`, `@viona/shared` manifest types, existing FullComposition

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Create | `packages/worker/src/processors/render/manifest-to-props.ts` | Convert manifest → FullCompositionProps |
| Modify | `packages/worker/src/processors/render/index.ts` | Add workspace render path alongside existing DB path |
| Modify | `packages/api/src/workspace/workspace-service.ts` | Add `snapshotManifest()` for atomic manifest copy |
| Modify | `packages/api/src/routes/projects.ts` | Pass workspace flag to render job |
| Create | `scripts/temp/test-manifest-to-props.ts` | Tests for manifest → props conversion |

---

## Chunk 1: Manifest → FullCompositionProps Bridge

### Task 1: Create manifest-to-props Converter

The core of this plan — a function that converts a `@viona/shared` Manifest into the `FullCompositionProps` that the existing `FullComposition.tsx` expects.

**Key type mapping:**

| Manifest field | FullCompositionProps field |
|---|---|
| `manifest.layout.mode` | `layoutMode: 'stacked' \| 'pip'` |
| `manifest.layout.split` | `splitSettings: { position, ratio, gap }` |
| `manifest.layout.pip` | `pipSettings: PiPSettings` |
| `manifest.videoSettings` + `manifest.canvas` | `videoCropSettings: { sourceWidth, sourceHeight, cropX, cropY, scale }` |
| `manifest.items` (type=visual) | `layoutSegments: LayoutSegment[]` (frame-based) |
| `manifest.items` (type=caption) + `manifest.captionStyle` | `subtitles: SubtitleItemData[]` + `defaultSubtitleStyle` |
| Source video path | `sourceVideoFile: 'source.mp4'` |

**Files:**
- Create: `packages/worker/src/processors/render/manifest-to-props.ts`
- Reference: `packages/worker/remotion-template/src/composition/types.ts` (FullCompositionProps type)

- [ ] **Step 1: Read FullCompositionProps type**

Read `packages/worker/remotion-template/src/composition/types.ts` to understand the exact shape expected by FullComposition.

- [ ] **Step 2: Read existing layout segment builder**

Read the `buildLayoutSegments()` function in `packages/worker/src/processors/render/index.ts` (around lines 36-74) and the subtitle conversion in `packages/worker/src/processors/render/subtitles.ts`. These show the current logic we need to replicate from manifest data.

- [ ] **Step 3: Write the converter**

```typescript
/**
 * Manifest → FullCompositionProps converter.
 *
 * Bridges the @viona/shared Manifest format to the FullCompositionProps
 * expected by the existing FullComposition.tsx rendering engine.
 */
import type { Manifest } from '@viona/shared';
import type {
  FullCompositionProps,
  LayoutSegment,
  SplitSettings,
  PiPSettings,
  VideoCropSettings,
  SubtitleItemData,
  SubtitleWordData,
  SubtitleStyle,
  LayoutMode,
} from '../../remotion-template/src/composition/types.js';

interface ManifestToPropsOptions {
  fps: number;
  /** Path to source video relative to bundle public/ */
  sourceVideoFile?: string;
  /** Path to audio file relative to bundle public/ */
  audioFile?: string;
  /** Project type */
  projectType?: 'video' | 'audio';
}

/** Resolve manifest pip.size (named string or number) to a numeric percentage */
const PIP_SIZE_MAP: Record<string, number> = { small: 18, medium: 25, large: 35, custom: 25 };

function resolvePipSize(size: unknown): number {
  if (typeof size === 'number') return size;
  if (typeof size === 'string') return PIP_SIZE_MAP[size] ?? 25;
  return 25;
}

/**
 * Convert a workspace manifest into FullCompositionProps.
 */
export function manifestToFullCompositionProps(
  manifest: Manifest,
  options: ManifestToPropsOptions,
): FullCompositionProps {
  const fps = options.fps || manifest.fps || 30;

  // Layout mode
  const layoutMode: LayoutMode = manifest.layout?.mode === 'pip' ? 'pip' : 'stacked';

  // Split settings
  const splitSettings: SplitSettings = {
    position: (manifest.layout?.split?.position as SplitSettings['position']) ?? 'visuals-first',
    ratio: manifest.layout?.split?.ratio ?? 50,
    gap: manifest.layout?.split?.gap ?? 0,
  };

  // PiP settings — resolve named size to numeric, omit extra fields (e.g. crop)
  const pipSettings: PiPSettings | undefined = layoutMode === 'pip' && manifest.layout?.pip ? {
    position: (manifest.layout.pip as any).position || 'bottom-right',
    offsetX: (manifest.layout.pip as any).offsetX || 20,
    offsetY: (manifest.layout.pip as any).offsetY || 20,
    size: resolvePipSize((manifest.layout.pip as any).size),
    shape: (manifest.layout.pip as any).shape || 'rounded',
    borderRadius: (manifest.layout.pip as any).borderRadius || 16,
    borderWidth: (manifest.layout.pip as any).borderWidth || 0,
    borderColor: (manifest.layout.pip as any).borderColor || '#ffffff',
    shadowEnabled: (manifest.layout.pip as any).shadowEnabled ?? true,
    shadowColor: (manifest.layout.pip as any).shadowColor || 'rgba(0,0,0,0.3)',
    shadowBlur: (manifest.layout.pip as any).shadowBlur || 12,
    opacity: (manifest.layout.pip as any).opacity ?? 1,
    rotation: (manifest.layout.pip as any).rotation || 0,
  } : undefined;

  // Video crop settings from manifest.videoSettings + manifest.canvas
  const videoCropSettings: VideoCropSettings = {
    sourceWidth: manifest.videoSettings?.sourceWidth ?? 1920,
    sourceHeight: manifest.videoSettings?.sourceHeight ?? 1080,
    cropX: manifest.videoSettings?.cropX ?? 50,
    cropY: manifest.videoSettings?.cropY ?? 50,
    scale: manifest.videoSettings?.scale ?? 1,
  };

  // Build layout segments from visual items
  const layoutSegments = buildLayoutSegmentsFromManifest(manifest, fps);

  // Build subtitles from caption items
  const subtitles = buildSubtitlesFromManifest(manifest);

  // Default subtitle style from manifest.captionStyle
  const defaultSubtitleStyle: SubtitleStyle | undefined = manifest.captionStyle
    ? { ...manifest.captionStyle } as SubtitleStyle
    : undefined;

  return {
    layoutMode,
    splitSettings,
    pipSettings,
    layoutSegments,
    videoCropSettings,
    sourceVideoFile: options.sourceVideoFile,
    audioFile: options.audioFile,
    backgroundColor: '#000000',
    subtitles: subtitles.length > 0 ? subtitles : undefined,
    defaultSubtitleStyle,
  };
}

/**
 * Build frame-based layout segments from manifest visual items.
 * Fills gaps between visuals with 'default' display mode.
 */
function buildLayoutSegmentsFromManifest(manifest: Manifest, fps: number): LayoutSegment[] {
  // Extract visual items, sorted by startMs
  const visualItems = manifest.items
    .filter(item => item.type === 'visual')
    .sort((a, b) => a.startMs - b.startMs);

  if (visualItems.length === 0) {
    // No visuals — entire duration is 'default' mode
    const totalFrames = Math.ceil((manifest.durationMs / 1000) * fps);
    return [{ startFrame: 0, endFrame: totalFrames, displayMode: 'default' }];
  }

  const segments: LayoutSegment[] = [];
  let lastEndFrame = 0;
  const GAP_THRESHOLD_MS = 50; // Ignore gaps smaller than 50ms

  for (const item of visualItems) {
    const startFrame = Math.round((item.startMs / 1000) * fps);
    const endFrame = Math.round((item.endMs / 1000) * fps);

    // Fill gap before this visual with 'default'
    if (startFrame > lastEndFrame + Math.round((GAP_THRESHOLD_MS / 1000) * fps)) {
      segments.push({ startFrame: lastEndFrame, endFrame: startFrame, displayMode: 'default' });
    }

    // Normalize display mode: 'pip' → 'default' (legacy compat)
    let displayMode = item.data?.displayMode ?? 'default';
    if (displayMode === 'pip') displayMode = 'default';
    if (displayMode !== 'default' && displayMode !== 'fullscreen' && displayMode !== 'overlay') {
      displayMode = 'default';
    }

    segments.push({
      startFrame,
      endFrame,
      displayMode: displayMode as 'default' | 'fullscreen' | 'overlay',
    });

    lastEndFrame = endFrame;
  }

  // Fill trailing gap
  const totalFrames = Math.ceil((manifest.durationMs / 1000) * fps);
  if (lastEndFrame < totalFrames) {
    segments.push({ startFrame: lastEndFrame, endFrame: totalFrames, displayMode: 'default' });
  }

  return segments;
}

/**
 * Build subtitle items from manifest caption items.
 * Caption words in manifest use relative timing (relative to item start).
 * FullComposition expects absolute timing.
 */
function buildSubtitlesFromManifest(manifest: Manifest): SubtitleItemData[] {
  return manifest.items
    .filter(item => item.type === 'caption')
    .sort((a, b) => a.startMs - b.startMs)
    .map(item => ({
      startMs: item.startMs,
      endMs: item.endMs,
      words: (item.data?.words ?? []).map((w: any): SubtitleWordData => ({
        text: w.text,
        // Manifest caption words use relative timing — convert to absolute
        startMs: w.startMs + item.startMs,
        endMs: w.endMs + item.startMs,
        ...(w.styleOverrides ? { styleOverrides: w.styleOverrides } : {}),
      })),
    }));
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/processors/render/manifest-to-props.ts
git commit -m "feat(render): add manifest-to-FullCompositionProps converter"
```

---

### Task 2: Tests for Manifest → Props Converter

**Files:**
- Create: `scripts/temp/test-manifest-to-props.ts`

- [ ] **Step 1: Write tests**

```typescript
import { manifestToFullCompositionProps } from '../../packages/worker/src/processors/render/manifest-to-props';

// Test 1: Minimal manifest — no visuals, no captions
const minimal = {
  version: 1,
  fps: 30,
  durationMs: 10000,
  canvas: { width: 1080, height: 1920 },
  tracks: [{ id: 't1', type: 'video', name: 'Video', position: 0 }],
  items: [{ id: 'i1', trackId: 't1', type: 'video', startMs: 0, endMs: 10000, data: { src: 'source.mp4', crop: { x: 50, y: 50, scale: 1 }, volume: 1, playbackRate: 1 } }],
  layout: { mode: 'stacked', split: { position: 'visuals-first', ratio: 50, gap: 0 }, pip: {} },
  videoSettings: { cropX: 50, cropY: 50, scale: 1, sourceWidth: 1920, sourceHeight: 1080 },
};

const r1 = manifestToFullCompositionProps(minimal as any, { fps: 30, sourceVideoFile: 'source.mp4' });
console.assert(r1.layoutMode === 'stacked', `Expected stacked, got ${r1.layoutMode}`);
console.assert(r1.sourceVideoFile === 'source.mp4', 'Missing sourceVideoFile');
console.assert(r1.layoutSegments.length === 1, `Expected 1 default segment, got ${r1.layoutSegments.length}`);
console.assert(r1.layoutSegments[0].displayMode === 'default', 'Expected default displayMode');
console.assert(r1.layoutSegments[0].endFrame === 300, `Expected 300 frames, got ${r1.layoutSegments[0].endFrame}`);
console.assert(r1.subtitles === undefined, 'Expected no subtitles');
console.assert(r1.videoCropSettings.cropX === 50, 'Expected cropX 50');

// Test 2: Visual items → layout segments
const withVisuals = {
  ...minimal,
  tracks: [...minimal.tracks, { id: 't2', type: 'visual', name: 'Visuals', position: 1 }],
  items: [
    ...minimal.items,
    { id: 'v1', trackId: 't2', type: 'visual', startMs: 0, endMs: 5000, data: { sceneFile: 'scenes/Scene1.tsx', displayMode: 'default', frameOffset: 0 } },
    { id: 'v2', trackId: 't2', type: 'visual', startMs: 5000, endMs: 10000, data: { sceneFile: 'scenes/Scene2.tsx', displayMode: 'fullscreen', frameOffset: 0 } },
  ],
};

const r2 = manifestToFullCompositionProps(withVisuals as any, { fps: 30, sourceVideoFile: 'source.mp4' });
console.assert(r2.layoutSegments.length === 2, `Expected 2 segments, got ${r2.layoutSegments.length}`);
console.assert(r2.layoutSegments[0].displayMode === 'default', 'First segment should be default');
console.assert(r2.layoutSegments[0].startFrame === 0, 'First segment starts at 0');
console.assert(r2.layoutSegments[0].endFrame === 150, `First segment ends at 150, got ${r2.layoutSegments[0].endFrame}`);
console.assert(r2.layoutSegments[1].displayMode === 'fullscreen', 'Second segment should be fullscreen');

// Test 3: Caption items → subtitles with absolute timing
const withCaptions = {
  ...minimal,
  tracks: [...minimal.tracks, { id: 't3', type: 'caption', name: 'Captions', position: 2 }],
  items: [
    ...minimal.items,
    { id: 'c1', trackId: 't3', type: 'caption', startMs: 1000, endMs: 3000, data: { words: [
      { text: 'Hello', startMs: 0, endMs: 1000 },
      { text: 'World', startMs: 1000, endMs: 2000 },
    ] } },
  ],
};

const r3 = manifestToFullCompositionProps(withCaptions as any, { fps: 30, sourceVideoFile: 'source.mp4' });
console.assert(r3.subtitles!.length === 1, `Expected 1 subtitle, got ${r3.subtitles?.length}`);
// Words should be absolute: 0+1000=1000, 1000+1000=2000
console.assert(r3.subtitles![0].words[0].startMs === 1000, `Expected word start 1000, got ${r3.subtitles![0].words[0].startMs}`);
console.assert(r3.subtitles![0].words[1].startMs === 2000, `Expected word start 2000, got ${r3.subtitles![0].words[1].startMs}`);

// Test 4: PiP layout mode
const pipManifest = {
  ...minimal,
  layout: { mode: 'pip', split: { position: 'visuals-first', ratio: 50, gap: 0 }, pip: { position: 'bottom-right', size: 'medium' } },
};

const r4 = manifestToFullCompositionProps(pipManifest as any, { fps: 30, sourceVideoFile: 'source.mp4' });
console.assert(r4.layoutMode === 'pip', `Expected pip, got ${r4.layoutMode}`);
console.assert(r4.pipSettings?.position === 'bottom-right', 'Expected pip position bottom-right');

// Test 5: Gap filling between visuals
const withGap = {
  ...minimal,
  tracks: [...minimal.tracks, { id: 't2', type: 'visual', name: 'Visuals', position: 1 }],
  items: [
    ...minimal.items,
    { id: 'v1', trackId: 't2', type: 'visual', startMs: 2000, endMs: 5000, data: { sceneFile: 'scenes/Scene1.tsx', displayMode: 'default', frameOffset: 0 } },
    { id: 'v2', trackId: 't2', type: 'visual', startMs: 7000, endMs: 10000, data: { sceneFile: 'scenes/Scene2.tsx', displayMode: 'overlay', frameOffset: 0 } },
  ],
};

const r5 = manifestToFullCompositionProps(withGap as any, { fps: 30, sourceVideoFile: 'source.mp4' });
// Expect: [0-60 default gap] [60-150 default] [150-210 default gap] [210-300 overlay]
console.assert(r5.layoutSegments.length === 4, `Expected 4 segments (with gaps), got ${r5.layoutSegments.length}`);
console.assert(r5.layoutSegments[0].displayMode === 'default', 'First gap should be default');
console.assert(r5.layoutSegments[3].displayMode === 'overlay', 'Last segment should be overlay');

// Test 6: Display mode normalization (pip → default)
const withPipMode = {
  ...minimal,
  tracks: [...minimal.tracks, { id: 't2', type: 'visual', name: 'Visuals', position: 1 }],
  items: [
    ...minimal.items,
    { id: 'v1', trackId: 't2', type: 'visual', startMs: 0, endMs: 10000, data: { sceneFile: 'scenes/Scene1.tsx', displayMode: 'pip', frameOffset: 0 } },
  ],
};

const r6 = manifestToFullCompositionProps(withPipMode as any, { fps: 30, sourceVideoFile: 'source.mp4' });
console.assert(r6.layoutSegments[0].displayMode === 'default', `pip should normalize to default, got ${r6.layoutSegments[0].displayMode}`);

console.log('All manifest-to-props tests passed!');
```

- [ ] **Step 2: Run tests**

Run: `npx tsx scripts/temp/test-manifest-to-props.ts`
Expected: "All manifest-to-props tests passed!"

- [ ] **Step 3: Commit**

```bash
git add scripts/temp/test-manifest-to-props.ts
git commit -m "test: add manifest-to-FullCompositionProps conversion tests"
```

---

## Chunk 2: Workspace Manifest Snapshot

### Task 3: Add Manifest Snapshot to Workspace Service

The render processor needs an immutable snapshot of the manifest so the user can continue editing during export. Add a `snapshotManifest()` function.

**Files:**
- Modify: `packages/api/src/workspace/workspace-service.ts`

- [ ] **Step 1: Read workspace-service.ts**

Read the file to understand the existing functions.

- [ ] **Step 2: Add snapshotManifest function**

Add this exported function:

```typescript
/**
 * Create an atomic snapshot of the workspace manifest.
 * Used by the render processor to get an immutable copy that won't change
 * during export while the user continues editing.
 */
export async function snapshotManifest(projectId: string): Promise<Manifest | null> {
  if (!(await isWorkspaceActive(projectId))) {
    return null;
  }

  const manifest = await readManifest(projectId);
  // Return a deep clone so mutations to the live manifest don't affect the snapshot
  return structuredClone(manifest);
}
```

Import `Manifest` type from `@viona/shared` if not already imported.

- [ ] **Step 3: Export from barrel**

Ensure `snapshotManifest` is exported from `packages/api/src/workspace/index.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/workspace/workspace-service.ts packages/api/src/workspace/index.ts
git commit -m "feat(workspace): add snapshotManifest for atomic manifest copy during export"
```

---

## Chunk 3: Render Processor Workspace Path

### Task 4: Add Workspace Render Path to Render Processor

Add a workspace-based render path that runs alongside the existing DB-based path. When the workspace is active, the processor reads the manifest snapshot and converts it to FullCompositionProps. When the workspace is inactive, it falls back to the existing DB orchestration.

**Files:**
- Modify: `packages/worker/src/processors/render/index.ts`

- [ ] **Step 1: Read the current render processor**

Read `packages/worker/src/processors/render/index.ts` fully. Understand the three render paths (full composition, audio-only, video-no-visuals).

- [ ] **Step 2: Add imports**

At the top of the file, add:
```typescript
import { manifestToFullCompositionProps } from './manifest-to-props.js';
```

- [ ] **Step 3: Add workspace render function**

Add a new function `renderFromManifest()` that handles the workspace-based render path. Place it before the main `processRenderJob()` function.

**Important implementation notes (read the existing code first):**
- `renderWithRemotion()` takes `onProgress: (progress: number) => void` where `progress` is a 0-1 fraction — NOT `(frame, totalFrames)`
- `renderWithRemotion()` calls `ensureBundleExists()` internally — do NOT call it separately
- Bundle path: `join(config.remotion.bundleOutputDir, compositionId.replace(/_/g, '-'))`
- Storage functions are `downloadFile` and `uploadFile` from `../../services/minio.js`
- `downloadVideoClipsForRender(projectId, workDir, videoClipData)` — projectId first, not clipData
- Must update job status via `db.update(jobs)` and call `publishJobComplete(jobId, projectId)` on success

```typescript
/**
 * Workspace-based render path.
 * Reads manifest from job data, converts to FullCompositionProps, renders with Remotion.
 * Returns true if it handled the render, false to fall back to legacy path.
 */
async function renderFromManifest(
  jobData: RenderJobData,
  workDir: string,
  jobId: string,
): Promise<boolean> {
  // Check if manifest was provided in job data
  const manifest = (jobData as any).manifest;
  if (!manifest) return false;

  const projectId = jobData.projectId;
  const fps = manifest.fps || 30;

  await publishJobProgress(jobId, 5, 'Preparing workspace-based render...');

  // 1. Load project for metadata (video key, etc.)
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

  await publishJobProgress(jobId, 15, 'Converting manifest to composition props...');

  // 3. Convert manifest → FullCompositionProps
  const compositionProps = manifestToFullCompositionProps(manifest, {
    fps,
    sourceVideoFile: sourceVideoPath ? 'source.mp4' : undefined,
    audioFile: isAudioProject ? 'audio.mp4' : undefined,
    projectType: jobData.projectType,
  });

  // 4. Check if we have a visual composition to bundle
  const projectVisual = await db.query.visuals.findFirst({
    where: eq(visuals.projectId, projectId),
  });

  if (!projectVisual) {
    // No visuals — can't use full composition path, fall back
    return false;
  }

  await publishJobProgress(jobId, 25, 'Preparing bundle...');

  // 5. Derive bundle path (same as existing render processor)
  const bundleDirName = projectVisual.compositionId.replace(/_/g, '-');
  const bundlePath = join(config.remotion.bundleOutputDir, bundleDirName);
  const bundlePublicDir = join(bundlePath, 'public');
  await mkdir(bundlePublicDir, { recursive: true });

  // 6. Copy source media into bundle's public/
  if (sourceVideoPath) {
    await copyFile(sourceVideoPath, join(bundlePublicDir, 'source.mp4'));
  }
  if (isAudioProject && audioPath) {
    await copyFile(audioPath, join(bundlePublicDir, 'audio.mp4'));
  }

  // 7. Handle video clips (YouTube clips for template scenes)
  if (jobData.videoClipData?.length) {
    const { clips: videoClipPaths } = await downloadVideoClipsForRender(projectId, workDir, jobData.videoClipData);
    if (videoClipPaths.size > 0) {
      const bundleClipsDir = join(bundlePath, 'public', 'assets', 'clips');
      await mkdir(bundleClipsDir, { recursive: true });
      for (const [sceneId, clipPath] of videoClipPaths) {
        await copyFile(clipPath, join(bundleClipsDir, basename(clipPath)));
      }
    }
  }

  // 8. Resolve fonts (reuse existing font resolution)
  const defaultStyle = compositionProps.defaultSubtitleStyle as any;
  if (compositionProps.subtitles?.length && defaultStyle) {
    const rawFontFamily = defaultStyle.fontFamily || 'Inter';
    const fontsDir = await ensureFontsDir(rawFontFamily);
    const resolvedFontFamily = resolveAvailableFontFamily(rawFontFamily);
    defaultStyle.fontFamily = resolvedFontFamily;

    // Resolve font families in all subtitle word overrides
    for (const sub of compositionProps.subtitles) {
      const style = sub.style as any;
      if (style?.fontFamily) {
        style.fontFamily = resolveAvailableFontFamily(style.fontFamily);
      }
      for (const word of sub.words) {
        if (word.styleOverrides?.fontFamily) {
          (word.styleOverrides as any).fontFamily = resolveAvailableFontFamily(word.styleOverrides.fontFamily);
        }
      }
    }
  }

  await publishJobProgress(jobId, 35, 'Rendering video...');

  // 9. Write props and render
  const outputPath = join(workDir, 'output.mp4');
  const propsPath = join(workDir, 'composition-props.json');
  await writeFile(propsPath, JSON.stringify(compositionProps), 'utf-8');

  await renderWithRemotion({
    bundlePath,
    compositionId: projectVisual.compositionId,
    outputPath,
    propsPath,
    onProgress: (progress) => {
      const jobProgress = 35 + Math.round(progress * 55);
      publishJobProgress(jobId, jobProgress, `Rendering: ${Math.round(progress * 100)}%`);
    },
  });

  await publishJobProgress(jobId, 92, 'Uploading output...');

  // 10. Upload to S3
  const outputKey = `${nanoid()}/output.mp4`;
  await uploadFile('outputs', outputKey, outputPath);

  // 11. Update project + job
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

- [ ] **Step 4: Wire into processRenderJob**

Inside `processRenderJob()`, AFTER `await mkdir(workDir, { recursive: true })` and the initial job status update, but BEFORE loading project data, add:

```typescript
  // Try workspace-based render first (Plan 4)
  try {
    const handled = await renderFromManifest(job.data, workDir, jobId);
    if (handled) return;
  } catch (err) {
    logger.warn({ err, projectId }, 'Workspace render failed, falling back to legacy');
  }
  // Fall through to existing DB-based render
```

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/processors/render/index.ts
git commit -m "feat(render): add workspace-based render path with manifest-to-props conversion"
```

---

### Task 5: Pass Manifest Snapshot to Render Job

When the user clicks Export and the workspace is active, the API should snapshot the manifest and include it in the render job data.

**Files:**
- Modify: `packages/api/src/routes/projects.ts` (the render endpoint)

- [ ] **Step 1: Read the render route**

Read `packages/api/src/routes/projects.ts` and find the `POST /projects/:id/render` route handler.

- [ ] **Step 2: Add manifest snapshot to render job**

Before the job is enqueued, check if the workspace is active. If so, snapshot the manifest and include it in the job data:

```typescript
import { isWorkspaceActive, snapshotManifest } from '../workspace/workspace-service.js';

// Inside the render route handler, before enqueueing the job:
let manifestSnapshot = null;
if (await isWorkspaceActive(projectId)) {
  manifestSnapshot = await snapshotManifest(projectId);
}

// When creating the job data, add the manifest:
const jobData = {
  projectId,
  jobId,
  projectType: project.projectType,
  // ... existing fields ...
  ...(manifestSnapshot ? { manifest: manifestSnapshot } : {}),
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routes/projects.ts
git commit -m "feat(api): snapshot workspace manifest when enqueueing render job"
```

---

## Chunk 4: Verification

### Task 6: TypeScript Compilation Check

Verify all modified packages compile without errors.

**Files:** None (verification only)

- [ ] **Step 1: Check shared package compiles**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Check worker package compiles**

Run: `cd packages/worker && npx tsc --noEmit`
Expected: No errors (or only pre-existing errors)

- [ ] **Step 3: Check API package compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors (or only pre-existing errors)

- [ ] **Step 4: Run manifest-to-props tests**

Run: `npx tsx scripts/temp/test-manifest-to-props.ts`
Expected: "All manifest-to-props tests passed!"

- [ ] **Step 5: Commit (if any fixes needed)**

Fix any compilation errors and commit.
