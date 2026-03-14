# Frontend Player Swap Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the frontend's 1959-line `Composition.tsx` with `FullComposition` loaded from the workspace bundle, achieving preview === export rendering parity.

**Architecture:** The workspace spin-up downloads scene sources from S3, generates a `PlayerComposition.tsx` that wires `FullComposition` with auto-discovered scenes, and the bundler compiles it to CJS. The frontend loads the CJS module via a `useWorkspaceComposition` hook and renders it in `RemotionPlayer` with manifest-derived `inputProps`. This eliminates `Composition.tsx`, `DynamicVisualLoader`, and duplicated layout/caption code.

**Tech Stack:** Remotion, esbuild, React, TypeScript, MinIO/S3, @remotion/player

---

## File Structure

**Create:**
| File | Responsibility |
|------|---------------|
| `packages/api/src/workspace/workspace-scenes.ts` | Download scene sources from S3 into workspace `src/scenes/` |
| `packages/api/src/workspace/workspace-codegen.ts` | Generate `PlayerComposition.tsx` with scene imports + manifest→props conversion |
| `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts` | Hook: loads CJS from workspace bundle endpoint, provides module shims, returns React component |
| `apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx` | Wraps `RemotionPlayer` with loaded workspace composition + manifest inputProps |

**Modify:**
| File | Change |
|------|--------|
| `packages/api/src/workspace/workspace-service.ts` | Call scene download + codegen during spin-up |
| `packages/api/src/workspace/bundler-service.ts` | Add CJS compilation step after Remotion bundle |
| `apps/web/src/features/editor-v2/player/Player.tsx` | Switch from `Composition` to `WorkspacePlayer` |

**Delete (final task):**
| File | Replaced By |
|------|------------|
| `apps/web/src/features/editor-v2/player/Composition.tsx` (~1959 lines) | `FullComposition` from workspace bundle |
| `apps/web/src/features/editor-v2/player/DynamicVisualLoader.tsx` (~328 lines) | `useWorkspaceComposition` hook |
| `apps/web/src/features/editor-v2/player/layout-utils.ts` | `composition/utils.ts` in workspace |

---

## Chunk 1: Workspace Scene Infrastructure

### Task 1: Download Scene Sources from S3 During Workspace Spin-Up

**Files:**
- Create: `packages/api/src/workspace/workspace-scenes.ts`
- Modify: `packages/api/src/workspace/workspace-service.ts`

This fills in the TODO at line 78 of `workspace-service.ts`. During spin-up, for each visual item in the manifest, we download the scene `.tsx` source files from S3 (`outputs/sources/{compositionId}/`) into the workspace's `src/scenes/{compositionId}/` directory, preserving the internal directory structure (so imports between scene files continue to work).

After downloading, we remap the manifest's `sceneFile` values from the generic `scenes/Scene1.tsx` (produced by `dbToManifest`) to the actual workspace paths: `scenes/{compositionId}/index.tsx`.

**Key insight**: `dbToManifest` generates `sceneFile: "scenes/Scene${sourceSceneId}.tsx"` which doesn't correspond to actual files. The real scene files are stored in S3 under `sources/{compositionId}/` with an `index.tsx` entry point. We need to map each visual item to its composition's actual path.

- [ ] **Step 1: Create `workspace-scenes.ts`**

```typescript
// packages/api/src/workspace/workspace-scenes.ts

import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { Readable } from 'stream';
import { getObjectStream, listObjects } from '../services/minio.js';
import { getScenesPath } from './workspace-config.js';
import type { Manifest } from '@viona/shared';

/**
 * Download scene source files from S3 into the workspace.
 *
 * Each composition gets its own subdirectory under src/scenes/:
 *   src/scenes/{compositionId}/
 *     index.tsx          ← entry point (exports MainComposition)
 *     constants.ts
 *     scenes/Scene1.tsx  ← internal scenes
 *     components/...     ← shared components
 *
 * This preserves the internal import structure so Scene imports work.
 */
export async function downloadSceneSources(
  projectId: string,
  compositionIds: string[],
): Promise<string[]> {
  const scenesPath = getScenesPath(projectId);
  const downloadedCompositions: string[] = [];

  // Deduplicate compositionIds (split scenes share the same compositionId)
  const uniqueIds = [...new Set(compositionIds)];

  for (const compositionId of uniqueIds) {
    const sourcePrefix = `sources/${compositionId}/`;

    // List all source files for this composition
    let keys: string[];
    try {
      keys = await listObjects('outputs', sourcePrefix);
    } catch {
      // No sources for this composition (legacy or deleted) — skip
      continue;
    }

    if (keys.length === 0) continue;

    const compositionDir = join(scenesPath, compositionId);
    await mkdir(compositionDir, { recursive: true });

    let hasIndexFile = false;

    // Download all source files preserving directory structure
    for (const key of keys) {
      // key is the full S3 key, e.g. "sources/{id}/scenes/Scene1.tsx"
      // Strip the source prefix to get relative path within composition
      const relativePath = key.replace(sourcePrefix, '');

      // Skip non-source files (markdown, json metadata)
      if (!/\.(tsx?|css)$/.test(relativePath)) continue;
      // Skip __composition__ infrastructure (workspace has its own)
      if (relativePath.startsWith('__composition__/')) continue;

      const destPath = join(compositionDir, relativePath);

      // Download file content
      try {
        const stream = await getObjectStream('outputs', key);
        const chunks: Buffer[] = [];
        for await (const chunk of stream as Readable) {
          chunks.push(Buffer.from(chunk));
        }
        const content = Buffer.concat(chunks);

        await mkdir(dirname(destPath), { recursive: true });
        await writeFile(destPath, content);

        if (relativePath === 'index.tsx') hasIndexFile = true;
      } catch {
        // Non-fatal: skip files that fail to download
        console.warn(`[workspace] Failed to download ${key} for ${projectId}`);
      }
    }

    if (hasIndexFile) {
      downloadedCompositions.push(compositionId);
    }
  }

  return downloadedCompositions;
}

/**
 * Build a mapping from visual item ID → compositionId from raw DB items.
 * Used to remap manifest sceneFile values after download.
 */
export function buildVisualCompositionMap(
  dbItems: Array<{ id: string; type: string; data: Record<string, unknown> }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of dbItems) {
    if (item.type === 'visual') {
      const compositionId = item.data?.compositionId as string;
      if (compositionId) {
        map.set(item.id, compositionId);
      }
    }
  }
  return map;
}

/**
 * Remap manifest sceneFile values from generic paths (scenes/Scene1.tsx)
 * to actual workspace paths (scenes/{compositionId}/index.tsx).
 *
 * Mutates the manifest in place.
 */
export function remapManifestSceneFiles(
  manifest: Manifest,
  visualCompositionMap: Map<string, string>,
  downloadedCompositions: string[],
): void {
  for (const item of manifest.items) {
    if (item.type !== 'visual') continue;

    const compositionId = visualCompositionMap.get(item.id);
    if (!compositionId) continue;
    if (!downloadedCompositions.includes(compositionId)) continue;

    // Update sceneFile to point to the actual composition entry point
    (item.data as any).sceneFile = `scenes/${compositionId}/index.tsx`;
  }
}

/**
 * Extract unique compositionIds from raw DB visual items.
 */
export function extractCompositionIds(
  dbItems: Array<{ type: string; data: Record<string, unknown> }>,
): string[] {
  return [...new Set(
    dbItems
      .filter(item => item.type === 'visual')
      .map(item => item.data?.compositionId as string)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  )];
}
```

- [ ] **Step 2: Wire into workspace spin-up**

In `packages/api/src/workspace/workspace-service.ts`, replace the TODO comment (lines 77-79) with scene download + manifest remapping:

```typescript
// Add import at top:
import {
  downloadSceneSources,
  extractCompositionIds,
  buildVisualCompositionMap,
  remapManifestSceneFiles,
} from './workspace-scenes.js';

// Replace lines 77-79 (the TODO comment) with:
  // 3. Download scene sources from S3 for existing visuals
  const dbItemsForScenes = allItems.map(item => ({
    id: item.id,
    type: item.type,
    data: (item.data as Record<string, unknown>) ?? {},
  }));
  const compositionIds = extractCompositionIds(dbItemsForScenes);
  const downloadedCompositions = await downloadSceneSources(projectId, compositionIds);

  // 3b. Remap manifest sceneFile values to match actual workspace paths
  const visualCompositionMap = buildVisualCompositionMap(dbItemsForScenes);
  remapManifestSceneFiles(manifest, visualCompositionMap, downloadedCompositions);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/workspace/workspace-scenes.ts packages/api/src/workspace/workspace-service.ts
git commit -m "feat(workspace): download scene sources from S3 during spin-up"
```

---

### Task 2: Generate PlayerComposition with Scene Imports

**Files:**
- Create: `packages/api/src/workspace/workspace-codegen.ts`
- Modify: `packages/api/src/workspace/workspace-service.ts`

The codegen generates a `PlayerComposition.tsx` in the workspace's `src/` directory. This file:
1. Imports `FullComposition` from the local `composition/` directory
2. Imports all scene entry points discovered in `src/scenes/`
3. Creates a `SCENE_MAP` registry mapping `sceneFile` paths → React components
4. Converts manifest JSON props → `FullCompositionProps` inline
5. Renders `FullComposition` with the converted props

- [ ] **Step 1: Create `workspace-codegen.ts`**

```typescript
// packages/api/src/workspace/workspace-codegen.ts

import { readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { getWorkspaceSrcPath, getScenesPath } from './workspace-config.js';

/**
 * Scene entry discovered in the workspace's src/scenes/ directory.
 * Each entry maps a sceneFile path (as used in manifest) to an import path.
 */
interface SceneEntry {
  /** Key used in manifest visual items, e.g. "scenes/Scene1.tsx" */
  sceneFileKey: string;
  /** Import path relative to PlayerComposition.tsx, e.g. "./scenes/abc123_index" */
  importPath: string;
  /** Variable name for the import, e.g. "Scene_abc123" */
  importName: string;
}

/**
 * Discover scene entry points in the workspace's src/scenes/ directory.
 *
 * Scenes are stored in subdirectories by compositionId:
 *   src/scenes/{compositionId}/
 *     index.tsx  ← entry point (exports MainComposition)
 *     scenes/Scene1.tsx, etc. ← internal scenes
 *
 * We import each composition's index.tsx as a separate entry.
 * The sceneFile key matches what remapManifestSceneFiles() produces.
 */
async function discoverScenes(projectId: string): Promise<SceneEntry[]> {
  const scenesPath = getScenesPath(projectId);
  const entries: SceneEntry[] = [];

  let dirs: string[];
  try {
    const dirents = await readdir(scenesPath, { withFileTypes: true });
    dirs = dirents.filter(d => d.isDirectory()).map(d => d.name);
  } catch {
    return []; // No scenes directory yet
  }

  for (const compositionId of dirs) {
    // Check if this directory has an index.tsx entry point
    try {
      const files = await readdir(join(scenesPath, compositionId));
      if (!files.includes('index.tsx')) continue;
    } catch {
      continue;
    }

    const importName = `Scene_${compositionId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    entries.push({
      sceneFileKey: `scenes/${compositionId}/index.tsx`,
      importPath: `./scenes/${compositionId}/index`,
      importName,
    });
  }

  return entries;
}

/**
 * Generate PlayerComposition.tsx in the workspace.
 *
 * This composition:
 * - Accepts { manifest, videoUrl?, audioUrl? } as Remotion inputProps
 * - Converts manifest to FullCompositionProps
 * - Maps sceneFile references to imported scene components
 * - Renders FullComposition
 */
export async function generatePlayerComposition(projectId: string): Promise<void> {
  const srcPath = getWorkspaceSrcPath(projectId);
  const scenes = await discoverScenes(projectId);

  const sceneImports = scenes
    .map(s => `import { MainComposition as ${s.importName} } from '${s.importPath}';`)
    .join('\n');

  const sceneMapEntries = scenes
    .map(s => `  '${s.sceneFileKey}': ${s.importName},`)
    .join('\n');

  const code = `/**
 * Auto-generated PlayerComposition for frontend preview.
 * DO NOT EDIT — regenerated on workspace spin-up and scene changes.
 */
import React from 'react';
import { useVideoConfig } from 'remotion';
import { FullComposition } from './composition/FullComposition';
import type { SceneItem, SubtitleItemData, SubtitleWordData, SubtitleStyle, LayoutSegment } from './composition/types';
${sceneImports}

const SCENE_MAP: Record<string, React.FC> = {
${sceneMapEntries}
};

interface PlayerCompositionProps {
  manifest: any;
  videoUrl?: string;
  audioUrl?: string;
}

/**
 * Convert manifest visual items to LayoutSegment[] for display mode transitions.
 */
function buildLayoutSegments(items: any[], fps: number, totalDurationMs: number): LayoutSegment[] {
  const GAP_THRESHOLD_MS = 50;
  const visuals = items
    .filter((i: any) => i.type === 'visual')
    .sort((a: any, b: any) => a.startMs - b.startMs);

  const segments: LayoutSegment[] = [];
  let lastEndMs = 0;

  for (const item of visuals) {
    if (item.startMs > lastEndMs + GAP_THRESHOLD_MS) {
      segments.push({
        startFrame: Math.round((lastEndMs / 1000) * fps),
        endFrame: Math.round((item.startMs / 1000) * fps),
        displayMode: 'default',
      });
    }

    let dm: string = item.data?.displayMode || 'default';
    if (dm === 'pip') dm = 'default';

    segments.push({
      startFrame: Math.round((item.startMs / 1000) * fps),
      endFrame: Math.round((item.endMs / 1000) * fps),
      displayMode: dm as 'default' | 'fullscreen' | 'overlay',
    });

    lastEndMs = item.endMs;
  }

  if (lastEndMs < totalDurationMs - GAP_THRESHOLD_MS) {
    segments.push({
      startFrame: Math.round((lastEndMs / 1000) * fps),
      endFrame: Math.round((totalDurationMs / 1000) * fps),
      displayMode: 'default',
    });
  }

  if (segments.length === 0) {
    segments.push({
      startFrame: 0,
      endFrame: Math.round((totalDurationMs / 1000) * fps),
      displayMode: 'default',
    });
  }

  return segments;
}

/**
 * Convert manifest visual items to SceneItem[] for transitions.
 */
function buildSceneItems(items: any[], fps: number): SceneItem[] {
  return items
    .filter((i: any) => i.type === 'visual')
    .sort((a: any, b: any) => a.startMs - b.startMs)
    .map((item: any) => ({
      id: item.id,
      startFrame: Math.round((item.startMs / 1000) * fps),
      endFrame: Math.round((item.endMs / 1000) * fps),
      sceneFile: item.data?.sceneFile || '',
      displayMode: item.data?.displayMode || 'default',
      frameOffset: item.data?.frameOffset ?? undefined,
      enter: item.data?.transition?.enter,
      exit: item.data?.transition?.exit,
    }));
}

/**
 * Convert manifest caption items to SubtitleItemData[].
 */
function buildSubtitles(items: any[]): SubtitleItemData[] {
  return items
    .filter((i: any) => i.type === 'caption')
    .sort((a: any, b: any) => a.startMs - b.startMs)
    .map((item: any) => ({
      startMs: item.startMs,
      endMs: item.endMs,
      words: (item.data?.words || []).map((w: any) => ({
        text: w.text,
        startMs: w.startMs + item.startMs,
        endMs: w.endMs + item.startMs,
        ...(w.styleOverrides ? { styleOverrides: w.styleOverrides } : {}),
      })),
    }));
}

export const PlayerComposition: React.FC<PlayerCompositionProps> = ({
  manifest,
  videoUrl,
  audioUrl,
}) => {
  const { fps } = useVideoConfig();

  const layoutSegments = buildLayoutSegments(manifest.items, fps, manifest.durationMs);
  const sceneItems = buildSceneItems(manifest.items, fps);
  const subtitles = buildSubtitles(manifest.items);

  const renderScene = (sceneFile: string, frameOffset: number) => {
    const SceneComponent = SCENE_MAP[sceneFile];
    if (!SceneComponent) return null;
    return <SceneComponent />;
  };

  const layout = manifest.layout || {};
  const vs = manifest.videoSettings || {};

  return (
    <FullComposition
      layoutMode={layout.mode || 'stacked'}
      splitSettings={{
        position: layout.split?.position || 'visuals-first',
        ratio: layout.split?.ratio ?? 50,
        gap: layout.split?.gap ?? 0,
      }}
      pipSettings={layout.mode === 'pip' ? {
        position: layout.pip?.position || 'bottom-right',
        offsetX: layout.pip?.offsetX ?? 0,
        offsetY: layout.pip?.offsetY ?? 0,
        size: layout.pip?.size ?? 25,
        shape: layout.pip?.shape || 'circle',
        borderRadius: layout.pip?.borderRadius ?? 9999,
        borderWidth: layout.pip?.borderWidth ?? 2,
        borderColor: layout.pip?.borderColor || '#FFFFFF',
        shadowEnabled: layout.pip?.shadowEnabled ?? true,
        shadowColor: layout.pip?.shadowColor || '#000000',
        shadowBlur: layout.pip?.shadowBlur ?? 10,
        opacity: layout.pip?.opacity ?? 1,
        rotation: layout.pip?.rotation ?? 0,
      } : undefined}
      layoutSegments={layoutSegments}
      sceneItems={sceneItems.length > 0 ? sceneItems : undefined}
      renderScene={sceneItems.length > 0 ? renderScene : undefined}
      videoCropSettings={{
        sourceWidth: vs.sourceWidth ?? 1920,
        sourceHeight: vs.sourceHeight ?? 1080,
        cropX: vs.cropX ?? 50,
        cropY: vs.cropY ?? 50,
        scale: vs.scale ?? 1,
      }}
      sourceVideoFile={videoUrl}
      audioFile={audioUrl}
      backgroundColor="#000000"
      subtitles={subtitles.length > 0 ? subtitles : undefined}
      defaultSubtitleStyle={manifest.captionStyle as SubtitleStyle}
    />
  );
};
`;

  await writeFile(join(srcPath, 'PlayerComposition.tsx'), code, 'utf-8');
}

/**
 * Update Root.tsx to register the PlayerComposition.
 * Adds a "Preview" composition alongside any existing ones.
 */
export async function updateRootWithPlayerComposition(
  projectId: string,
  durationMs: number,
  fps: number,
  canvasWidth: number,
  canvasHeight: number,
): Promise<void> {
  const srcPath = getWorkspaceSrcPath(projectId);

  const code = `import React from "react";
import "./index.css";
import { Composition } from "remotion";
import { PlayerComposition } from "./PlayerComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Preview"
        component={PlayerComposition}
        durationInFrames={${Math.ceil((durationMs / 1000) * fps)}}
        fps={${fps}}
        width={${canvasWidth}}
        height={${canvasHeight}}
        defaultProps={{
          manifest: {},
          videoUrl: undefined,
          audioUrl: undefined,
        }}
      />
    </>
  );
};
`;

  await writeFile(join(srcPath, 'Root.tsx'), code, 'utf-8');
}
```

- [ ] **Step 2: Wire codegen into workspace spin-up**

In `packages/api/src/workspace/workspace-service.ts`, add codegen after scene download:

```typescript
// Add import at top:
import { generatePlayerComposition, updateRootWithPlayerComposition } from './workspace-codegen.js';

// After the scene download call (new line 82), add:
  // 4. Generate PlayerComposition with scene imports
  await generatePlayerComposition(projectId);
  await updateRootWithPlayerComposition(
    projectId,
    manifest.durationMs,
    manifest.fps,
    manifest.canvas?.width ?? 1080,
    manifest.canvas?.height ?? 1920,
  );
```

Also update the step numbering comments for the remaining steps (manifest write becomes step 5, etc.).

- [ ] **Step 3: Copy composition infrastructure to workspace**

The workspace needs the `composition/` directory (FullComposition, SubtitleLayer, etc.) to exist in `src/`. Add a copy step in `workspace-service.ts` after directory creation:

```typescript
// Add import at top:
import { cp } from 'fs/promises';
import { resolve } from 'path';

// After mkdir calls (line 34), add:
  // 2b. Copy composition infrastructure from remotion-template
  const templateCompositionDir = resolve(
    process.cwd(), '..', 'worker', 'remotion-template', 'src', 'composition',
  );
  const workspaceCompositionDir = join(srcPath, 'composition');
  try {
    await cp(templateCompositionDir, workspaceCompositionDir, { recursive: true });
  } catch (err) {
    console.warn(`[workspace] Failed to copy composition infrastructure:`, err);
  }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/workspace/workspace-codegen.ts packages/api/src/workspace/workspace-service.ts
git commit -m "feat(workspace): generate PlayerComposition with scene imports during spin-up"
```

---

### Task 3: Add CJS Compilation Step to Bundler Service

**Files:**
- Modify: `packages/api/src/workspace/bundler-service.ts`

After `npx remotion bundle` runs, also compile `PlayerComposition.tsx` to CJS using esbuild (same approach as `packages/worker/src/processors/edit-visuals/build.ts`). The CJS file is served at `/api/workspace/{projectId}/bundle/player-composition.cjs.js`.

- [ ] **Step 1: Add CJS compilation method to BundlerService**

In `packages/api/src/workspace/bundler-service.ts`, add after the `runRemotionBundle` method:

```typescript
  /**
   * Compile PlayerComposition to CommonJS for frontend dynamic loading.
   * Uses esbuild to bundle PlayerComposition.tsx + all its dependencies
   * (FullComposition, scenes, animations, etc.) into a single CJS file.
   */
  private compilePlayerCjs(srcPath: string, outDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const entryPoint = join(srcPath, 'PlayerComposition.tsx');
      const cjsOutput = join(outDir, 'player-composition.cjs.js');

      const args = [
        'esbuild',
        entryPoint,
        '--bundle',
        '--format=cjs',
        '--platform=browser',
        '--target=es2020',
        '--external:react',
        '--external:react/jsx-runtime',
        '--external:react/jsx-dev-runtime',
        '--external:remotion',
        '--external:@remotion/noise',
        '--external:@remotion/shapes',
        '--external:@remotion/paths',
        '--external:@remotion/three',
        '--external:@remotion/google-fonts/*',
        '--external:remotion/no-react',
        `--outfile=${cjsOutput}`,
      ];

      const proc = spawn('npx', args, {
        cwd: join(srcPath, '..'), // workspace root
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      let stderr = '';
      proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`CJS compilation failed (exit ${code}): ${stderr.slice(0, 500)}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn esbuild: ${err.message}`));
      });

      setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('CJS compilation timed out after 60s'));
      }, 60_000);
    });
  }
```

- [ ] **Step 2: Call CJS compilation after Remotion bundle**

In the `buildBundle` method, add CJS compilation after the Remotion bundle succeeds:

```typescript
  private async buildBundle(projectId: string): Promise<string> {
    const workspacePath = getWorkspacePath(projectId);
    const srcPath = getWorkspaceSrcPath(projectId);
    const outDir = join(this.bundleOutputDir, projectId);

    // Compute hash of all source files
    const hash = await this.computeSourceHash(srcPath);
    const cached = this.cache.get(projectId);
    if (cached && cached.hash === hash) {
      return cached.bundlePath; // Skip rebuild
    }

    // Ensure output directory exists
    await mkdir(outDir, { recursive: true });

    // Run Remotion bundle (for export renders)
    const entryPoint = join(srcPath, 'index.tsx');
    await this.runRemotionBundle(entryPoint, outDir, workspacePath);

    // Compile PlayerComposition to CJS (for frontend preview)
    await this.compilePlayerCjs(srcPath, outDir);

    // Update cache
    this.cache.set(projectId, { bundlePath: outDir, hash, builtAt: Date.now() });

    return outDir;
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/workspace/bundler-service.ts
git commit -m "feat(bundler): compile PlayerComposition to CJS for frontend loading"
```

---

## Chunk 2: Frontend Composition Loader

### Task 4: Create `useWorkspaceComposition` Hook

**Files:**
- Create: `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts`

This hook loads the `PlayerComposition` from the workspace's CJS bundle. It reuses the module shim pattern from `DynamicVisualLoader` but loads the full composition (not individual scenes).

- [ ] **Step 1: Create the hook**

```typescript
// apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as React from 'react';
import * as Remotion from 'remotion';
import * as RemotionNoise from '@remotion/noise';
import * as RemotionShapes from '@remotion/shapes';
import * as RemotionPaths from '@remotion/paths';
import { FONT_REGISTRY, loadFont } from '@/lib/font-registry';

// @remotion/three is heavy (Three.js) — lazy-load only when needed
let _remotionThree: typeof import('@remotion/three') | null = null;
async function getRemotionThree() {
  if (!_remotionThree) {
    try {
      _remotionThree = await import('@remotion/three');
    } catch {
      _remotionThree = {} as any; // Not installed — return empty module
    }
  }
  return _remotionThree;
}

interface UseWorkspaceCompositionResult {
  /** The loaded PlayerComposition component, or null while loading */
  Component: React.ComponentType<any> | null;
  /** True while the CJS is being fetched/evaluated */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Force reload the composition (e.g. after bundle:ready event) */
  reload: () => void;
}

// Module cache keyed by URL + version
const compositionCache = new Map<string, React.ComponentType<any>>();

/**
 * Create a custom require() function that provides React, Remotion,
 * and Remotion sub-packages to the loaded CJS module.
 *
 * The workspace bundle URL is used to resolve staticFile() calls
 * to the correct API endpoint for assets.
 */
function createRequire(bundleBaseUrl: string, apiUrl: string) {
  return (moduleName: string): any => {
    if (moduleName === 'react') return React;
    if (moduleName === 'react/jsx-runtime') {
      const jsx = (type: any, props: any, key?: string) => {
        if (props?.children && Array.isArray(props.children)) {
          props = {
            ...props,
            children: props.children.map((child: any, i: number) => {
              if (React.isValidElement(child) && child.key === null) {
                return React.cloneElement(child, { key: `auto-${i}` });
              }
              return child;
            }),
          };
        }
        if (key !== undefined) {
          return React.createElement(type, { ...props, key });
        }
        return React.createElement(type, props);
      };
      return { jsx, jsxs: jsx, Fragment: React.Fragment };
    }
    if (moduleName === 'react/jsx-dev-runtime') {
      const jsxDEV = (type: any, props: any, key?: string) => {
        if (key !== undefined) {
          return React.createElement(type, { ...props, key });
        }
        return React.createElement(type, props);
      };
      return { jsxDEV, Fragment: React.Fragment };
    }
    if (moduleName === 'remotion') {
      const customStaticFile = (relativePath: string) => {
        const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
        return `${apiUrl}${bundleBaseUrl}/public/${cleanPath}`;
      };
      return {
        ...Remotion,
        Composition: () => null,
        staticFile: customStaticFile,
      };
    }
    if (moduleName === '@remotion/noise') return RemotionNoise;
    if (moduleName === '@remotion/shapes') return RemotionShapes;
    if (moduleName === '@remotion/paths') return RemotionPaths;
    if (moduleName === '@remotion/three') {
      // Return lazy-loaded module — may be empty object if not installed
      return _remotionThree ?? {};
    }
    if (moduleName.startsWith('@remotion/google-fonts/')) {
      const fontName = moduleName.replace('@remotion/google-fonts/', '').replace(/-/g, ' ');
      return {
        loadFont: () => ({ fontFamily: `'${fontName}', sans-serif` }),
        getInfo: () => ({ fontFamily: fontName }),
      };
    }
    if (moduleName === 'remotion/no-react') {
      return { NoReactInternals: { ENABLE_V5_BREAKING_CHANGES: false } };
    }
    throw new Error(`[useWorkspaceComposition] Unknown module: ${moduleName}`);
  };
}

/**
 * Hook that loads the PlayerComposition from the workspace bundle.
 *
 * @param bundleUrl - Base URL for the workspace bundle (e.g. "/api/workspace/{id}/bundle")
 * @param bundleVersion - Incremented when bundle rebuilds, busts cache
 */
export function useWorkspaceComposition(
  bundleUrl: string | null,
  bundleVersion: number,
): UseWorkspaceCompositionResult {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const load = useCallback(async () => {
    if (!bundleUrl) {
      setLoading(false);
      return;
    }

    const cjsUrl = `${apiUrl}${bundleUrl}/player-composition.cjs.js?v=${bundleVersion}`;
    const cacheKey = `${cjsUrl}:${reloadCounter}`;

    // Check cache
    if (compositionCache.has(cacheKey)) {
      setComponent(() => compositionCache.get(cacheKey)!);
      setLoading(false);
      setError(null);
      return;
    }

    // Prevent duplicate loads
    if (loadingRef.current === cacheKey) return;
    loadingRef.current = cacheKey;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(cjsUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch composition: ${response.status}`);
      }
      const code = await response.text();

      // Pre-load @remotion/three before CJS eval (lazy, only loads once)
      await getRemotionThree();

      // Execute CJS module with custom require
      const customRequire = createRequire(bundleUrl, apiUrl);
      const moduleObj: { exports: Record<string, unknown> } = { exports: {} };

      // eslint-disable-next-line no-new-func
      const moduleFunction = new Function('module', 'exports', 'require', code);
      moduleFunction(moduleObj, moduleObj.exports, customRequire);

      // Extract PlayerComposition from exports
      const PlayerComp = (
        moduleObj.exports.PlayerComposition ||
        moduleObj.exports.default ||
        Object.values(moduleObj.exports).find(v => typeof v === 'function')
      ) as React.ComponentType<any> | undefined;

      if (!PlayerComp) {
        throw new Error(
          `PlayerComposition not found in bundle. Exports: ${Object.keys(moduleObj.exports).join(', ')}`,
        );
      }

      // Load fonts referenced in the code
      for (const entry of FONT_REGISTRY) {
        if (code.includes(entry.family)) {
          loadFont(entry);
        }
      }

      compositionCache.set(cacheKey, PlayerComp);
      setComponent(() => PlayerComp);
      setError(null);
    } catch (err) {
      console.error('[useWorkspaceComposition] Failed to load:', err);
      setError(err instanceof Error ? err.message : 'Failed to load composition');
    } finally {
      setLoading(false);
    }
  }, [bundleUrl, bundleVersion, apiUrl, reloadCounter]);

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => {
    loadingRef.current = null;
    setReloadCounter(c => c + 1);
  }, []);

  return { Component, loading, error, reload };
}

/**
 * Clear the composition cache. Call when workspace tears down.
 */
export function clearCompositionCache() {
  compositionCache.clear();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No new errors from our file

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts
git commit -m "feat(player): add useWorkspaceComposition hook for loading workspace bundle"
```

---

### Task 5: Create WorkspacePlayer Component

**Files:**
- Create: `apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx`

This component wraps `RemotionPlayer` with the loaded workspace composition. It reads the manifest from the Zustand store and passes it as `inputProps` to the loaded `PlayerComposition`.

- [ ] **Step 1: Create `WorkspacePlayer.tsx`**

```typescript
// apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx

'use client';

import React, { useMemo } from 'react';
import { Player as RemotionPlayer } from '@remotion/player';
import { AbsoluteFill } from 'remotion';
import { useWorkspaceComposition } from './useWorkspaceComposition';

interface WorkspacePlayerProps {
  /** Manifest JSON from the workspace (source of truth) */
  manifest: Record<string, unknown>;
  /** Presigned URL for the source video */
  videoUrl?: string;
  /** Presigned URL for the audio file (audio-only projects) */
  audioUrl?: string;
  /** Workspace bundle base URL, e.g. "/api/workspace/{id}/bundle" */
  bundleUrl: string | null;
  /** Incremented on bundle rebuild to force reload */
  bundleVersion: number;
  /** Canvas width in pixels */
  compositionWidth: number;
  /** Canvas height in pixels */
  compositionHeight: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Frames per second */
  fps: number;
  /** Ref for RemotionPlayer (for play/pause/seek) */
  playerRef?: React.Ref<any>;
  /** Additional class names */
  className?: string;
}

const LoadingFallback: React.FC = () => (
  <AbsoluteFill>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#0f172a',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            border: '2px solid #a855f7',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ color: '#94a3b8', fontSize: 14 }}>Loading composition...</span>
      </div>
    </div>
  </AbsoluteFill>
);

const ErrorFallback: React.FC<{ message: string }> = ({ message }) => (
  <AbsoluteFill>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#1a0a0a',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16 }}>
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span style={{ color: '#f87171', fontSize: 14, textAlign: 'center' }}>{message}</span>
      </div>
    </div>
  </AbsoluteFill>
);

export const WorkspacePlayer: React.FC<WorkspacePlayerProps> = ({
  manifest,
  videoUrl,
  audioUrl,
  bundleUrl,
  bundleVersion,
  compositionWidth,
  compositionHeight,
  durationMs,
  fps,
  playerRef,
  className,
}) => {
  const { Component, loading, error } = useWorkspaceComposition(bundleUrl, bundleVersion);

  const durationInFrames = Math.max(1, Math.ceil((durationMs / 1000) * fps));

  const inputProps = useMemo(() => ({
    manifest,
    videoUrl,
    audioUrl,
  }), [manifest, videoUrl, audioUrl]);

  // Show loading/error states when composition isn't ready
  if (loading || !Component) {
    return (
      <div className={className} style={{ width: '100%', height: '100%', position: 'relative' }}>
        <LoadingFallback />
      </div>
    );
  }

  if (error) {
    return (
      <div className={className} style={{ width: '100%', height: '100%', position: 'relative' }}>
        <ErrorFallback message={error} />
      </div>
    );
  }

  return (
    <RemotionPlayer
      ref={playerRef}
      component={Component}
      inputProps={inputProps}
      durationInFrames={durationInFrames}
      compositionWidth={compositionWidth}
      compositionHeight={compositionHeight}
      fps={fps}
      className={className}
      style={{ width: '100%', height: '100%' }}
      controls={false}
      loop={false}
      clickToPlay={false}
      acknowledgeRemotionLicense
    />
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No new errors from our file

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx
git commit -m "feat(player): add WorkspacePlayer component with loaded workspace composition"
```

---

### Task 6: Wire WorkspacePlayer into Editor

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/Player.tsx`
- Modify: `apps/web/src/features/editor-v2/store/use-editor-store.ts` (if needed — add manifest selector)

Replace the current `RemotionPlayer` + `Composition` setup with `WorkspacePlayer`.

- [ ] **Step 1: Check existing store selectors**

The `Player.tsx` currently reads from the store:
- `useProject()` → canvas dimensions
- `useDuration()` → duration in ms
- `useFps()` → frames per second
- `useCurrentTimeMs()` → playback position
- `useIsPlaying()` → playback state

For `WorkspacePlayer`, we additionally need:
- The manifest JSON (to pass as inputProps)
- The workspace bundle URL
- The workspace bundle version
- The video stream URL

Check `use-editor-store.ts` for existing selectors. If a `useManifest()` selector doesn't exist, we need to either:
a) Read the manifest from the API each time (wasteful)
b) Store the manifest in Zustand and keep it synced
c) Reconstruct manifest from store data

Option (b) is likely already implemented — check for `workspaceManifest` or similar in the store state. If not, add a `manifest` field that gets populated during `loadProject` and updated via WebSocket `manifest:updated` events.

Look in `editor-store.ts` at the `loadProject` action — it calls `spinUpWorkspace` which returns a manifest. Check if the manifest is stored anywhere.

- [ ] **Step 2: Add manifest to store**

The store does NOT currently have a `workspaceManifest` field. Add one:

In `apps/web/src/features/editor-v2/store/types.ts`, add to `EditorState`:
```typescript
  /** Raw workspace manifest JSON — source of truth for WorkspacePlayer */
  workspaceManifest: Record<string, unknown> | null;
```

In `editor-store.ts`, in the `loadProject` action, after `manifestToStore()` call:
```typescript
  set({ workspaceManifest: manifest as Record<string, unknown> });
```

In the WebSocket `manifest:updated` handler:
```typescript
  // Re-read manifest from API and update store
  const updated = await api.readManifest(projectId);
  set({ workspaceManifest: updated as Record<string, unknown> });
```

Add a selector in `use-editor-store.ts`:
```typescript
export const useWorkspaceManifest = () => useEditorStore(s => s.workspaceManifest);
```

- [ ] **Step 3: Replace Player.tsx**

Rewrite `apps/web/src/features/editor-v2/player/Player.tsx`:

```typescript
'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import type { PlayerRef } from '@remotion/player';
import { WorkspacePlayer } from './WorkspacePlayer';
import { playerRef as sharedPlayerRef } from './player-ref';
import {
  useProject,
  useDuration,
  useFps,
  useCurrentTimeMs,
  useIsPlaying,
  useSafeZonePlatform,
  useWorkspaceManifest,
} from '../store/use-editor-store';
import { useEditorStore } from '../store/editor-store';
import { SafeZoneOverlay } from '../overlays/SafeZoneOverlay';

export function Player() {
  const playerRefLocal = useRef<PlayerRef>(null);

  // Store selectors
  const project = useProject();
  const durationMs = useDuration();
  const fps = useFps();
  const currentTimeMs = useCurrentTimeMs();
  const isPlaying = useIsPlaying();
  const safeZonePlatform = useSafeZonePlatform();
  const manifest = useWorkspaceManifest();

  // Workspace state
  const bundleUrl = useEditorStore(s => s.workspaceBundleUrl);
  const bundleVersion = useEditorStore(s => s.workspaceBundleVersion);
  const videoUrl = project?.videoUrl ?? undefined;

  // Canvas dimensions (nested under videoSettings)
  const compositionWidth = project?.videoSettings.canvasWidth ?? 1080;
  const compositionHeight = project?.videoSettings.canvasHeight ?? 1920;

  // Share player ref
  useEffect(() => {
    sharedPlayerRef.current = playerRefLocal.current;
    return () => { sharedPlayerRef.current = null; };
  }, []);

  // Sync store → player: play/pause
  const isInternalUpdateRef = useRef(false);
  useEffect(() => {
    const player = playerRefLocal.current;
    if (!player) return;
    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying]);

  // Sync store → player: seek
  useEffect(() => {
    const player = playerRefLocal.current;
    if (!player || isInternalUpdateRef.current) return;
    const frame = Math.round((currentTimeMs / 1000) * fps);
    player.seekTo(frame);
  }, [currentTimeMs, fps]);

  // Sync player → store: frame updates
  const handleFrameUpdate = useCallback((e: { detail: { frame: number } }) => {
    isInternalUpdateRef.current = true;
    const timeMs = (e.detail.frame / fps) * 1000;
    useEditorStore.getState().setCurrentTime(timeMs);
    requestAnimationFrame(() => { isInternalUpdateRef.current = false; });
  }, [fps]);

  const handlePlay = useCallback(() => {
    isInternalUpdateRef.current = true;
    useEditorStore.getState().play();
    requestAnimationFrame(() => { isInternalUpdateRef.current = false; });
  }, []);

  const handlePause = useCallback(() => {
    isInternalUpdateRef.current = true;
    useEditorStore.getState().pause();
    requestAnimationFrame(() => { isInternalUpdateRef.current = false; });
  }, []);

  const handleEnded = useCallback(() => {
    isInternalUpdateRef.current = true;
    useEditorStore.getState().pause();
    requestAnimationFrame(() => { isInternalUpdateRef.current = false; });
  }, []);

  // Attach player event listeners
  useEffect(() => {
    const player = playerRefLocal.current;
    if (!player) return;

    const el = player as unknown as EventTarget;
    el.addEventListener('frameupdate', handleFrameUpdate as any);
    el.addEventListener('play', handlePlay);
    el.addEventListener('pause', handlePause);
    el.addEventListener('ended', handleEnded);

    return () => {
      el.removeEventListener('frameupdate', handleFrameUpdate as any);
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('pause', handlePause);
      el.removeEventListener('ended', handleEnded);
    };
  }, [handleFrameUpdate, handlePlay, handlePause, handleEnded]);

  if (!manifest) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
        <span className="text-zinc-500 text-sm">Loading workspace...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <WorkspacePlayer
        manifest={manifest}
        videoUrl={videoUrl}
        bundleUrl={bundleUrl}
        bundleVersion={bundleVersion ?? 0}
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        durationMs={durationMs}
        fps={fps}
        playerRef={playerRefLocal}
        className="w-full h-full"
      />
      {safeZonePlatform && <SafeZoneOverlay platform={safeZonePlatform} />}
    </div>
  );
}
```

**Important notes for the implementer:**
- Store API: `play()` / `pause()` / `togglePlayback()` — NOT `setIsPlaying(bool)`. Canvas dimensions: `project.videoSettings.canvasWidth`/`canvasHeight`. Video URL: `project.videoUrl`.
- Read `use-editor-store.ts` and `editor-store.ts` first and adjust import names if they don't match.
- The video URL for preview comes from `project.videoUrl` (presigned URL), not from the manifest (which has local file paths).
- The `SafeZoneOverlay` import path may need adjustment — find where it's currently imported in the existing `Player.tsx`.
- Player event listener patterns should match the existing `Player.tsx` — read the current file to preserve any edge case handling.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/player/Player.tsx apps/web/src/features/editor-v2/store/types.ts apps/web/src/features/editor-v2/store/editor-store.ts apps/web/src/features/editor-v2/store/use-editor-store.ts
git commit -m "feat(player): swap to WorkspacePlayer rendering FullComposition from workspace bundle"
```

---

## Chunk 3: Cleanup and Verification

### Task 7: Delete Old Rendering Code

**Files:**
- Delete: `apps/web/src/features/editor-v2/player/Composition.tsx` (~1959 lines)
- Delete: `apps/web/src/features/editor-v2/player/DynamicVisualLoader.tsx` (~328 lines)
- Delete: `apps/web/src/features/editor-v2/player/layout-utils.ts` (~261 lines)

These files are replaced by:
- `Composition.tsx` → `FullComposition` loaded from workspace bundle
- `DynamicVisualLoader.tsx` → `useWorkspaceComposition` hook
- `layout-utils.ts` → `composition/utils.ts` in workspace

- [ ] **Step 1: Find and update any remaining imports**

Search for imports of the deleted files across the codebase:

```bash
cd /c/Users/armaa/Documents/cllipify
grep -rn "from.*Composition" apps/web/src/features/editor-v2/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"
grep -rn "DynamicVisualLoader" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -rn "layout-utils" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -rn "clearVisualCache\|getCacheVersion" apps/web/src/ --include="*.ts" --include="*.tsx"
```

For each import found:
- If it's in `Player.tsx` — already replaced in Task 6
- If it's in other files (e.g., store actions calling `clearVisualCache`) — update or remove

Common places that import `DynamicVisualLoader`:
- `Composition.tsx` itself (deleted)
- Store actions that call `clearVisualCache()` — replace with `clearCompositionCache()` from `useWorkspaceComposition.ts`

- [ ] **Step 2: Delete the files**

```bash
rm apps/web/src/features/editor-v2/player/Composition.tsx
rm apps/web/src/features/editor-v2/player/DynamicVisualLoader.tsx
rm apps/web/src/features/editor-v2/player/layout-utils.ts
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false 2>&1 | head -20`

Fix any remaining broken imports. Common fixes:
- Replace `clearVisualCache` → `clearCompositionCache` from the new module
- Remove unused imports of deleted files
- Update any type imports that came from `Composition.tsx`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(player): delete Composition.tsx, DynamicVisualLoader, layout-utils (~2,548 lines)"
```

---

### Task 8: TypeScript Compilation Check + Final Verification

**Files:**
- All modified packages

- [ ] **Step 1: Verify API package compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 2: Verify worker package compiles**

Run: `cd packages/worker && npx tsc --noEmit --pretty false`
Expected: No errors

- [ ] **Step 3: Verify web app compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false 2>&1 | head -30`
Expected: No new errors from our changes

- [ ] **Step 4: Verify remotion-template compiles (pre-existing errors only)**

Run: `cd packages/worker/remotion-template && npx tsc --noEmit --pretty false 2>&1 | grep -v "Cannot find module" | head -10`
Expected: Only pre-existing missing module errors (no @types/react, no remotion declarations)

- [ ] **Step 5: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: resolve TypeScript errors from player swap"
```

---

## Key Implementation Notes

### Scene File Namespacing

Scene sources are downloaded from S3 preserving directory structure under compositionId subdirectories:
- S3: `sources/{compositionId}/index.tsx` → workspace: `src/scenes/{compositionId}/index.tsx`
- S3: `sources/{compositionId}/scenes/Scene1.tsx` → workspace: `src/scenes/{compositionId}/scenes/Scene1.tsx`
- S3: `sources/{compositionId}/components/Background.tsx` → workspace: `src/scenes/{compositionId}/components/Background.tsx`

This preserves internal imports (e.g. `import { Scene1 } from './scenes/Scene1'` in index.tsx).

The `PlayerComposition.tsx` codegen discovers subdirectories with `index.tsx` entry points and creates imports for each.

### Existing Infrastructure (Already Implemented)

The following infrastructure already exists and does NOT need to be created:
- **Bundle serving route:** `GET /projects/:id/workspace/bundle/*` in `workspace-routes.ts` — serves any file from the bundle output directory, including `player-composition.cjs.js`
- **Bundle version tracking:** `workspaceBundleVersion` state + `incrementBundleVersion()` action in the Zustand store
- **WebSocket handler:** `bundle:ready` handler already calls `incrementBundleVersion()` to trigger frontend reload

### Manifest as InputProps

The manifest is passed as a serializable JSON object via Remotion's `inputProps`. This means:
- The manifest must be serializable (no functions, dates, etc.) — it already is
- The `PlayerComposition` receives it as `any` and extracts fields
- Video/audio URLs are passed separately (they're presigned URLs, not in the manifest)

### Module Shim Consistency

The `useWorkspaceComposition` hook's `createRequire` function must provide the same module shims as `DynamicVisualLoader` did. The key shims are:
- `react`, `react/jsx-runtime`, `react/jsx-dev-runtime` — React runtime
- `remotion` — with `staticFile()` overridden to point to workspace bundle assets
- `@remotion/noise`, `@remotion/shapes`, `@remotion/paths`, `@remotion/three` — Remotion sub-packages
- `@remotion/google-fonts/*` — font loading shim
- `remotion/no-react` — internal Remotion module

### Word Classification

The manifest word schema has an optional `classification` field (`'power' | 'medium' | 'filler'`), but `FullComposition`'s `SubtitleWordData` type does NOT include it. `AnimatedSubtitle.tsx` performs runtime classification via `POWER_WORD_SET` instead. The codegen's `buildSubtitles` correctly omits `classification` — this is intentional, not a bug.

### Backward Compatibility

During the transition:
- Projects with no visual items will render correctly (FullComposition handles empty sceneItems gracefully)
- Projects with scenes that haven't been downloaded from S3 (download failures) will show empty visuals in the affected scenes but won't crash
- The workspace bundle rebuild on `bundle:ready` will trigger `useWorkspaceComposition` to reload

### What This Eliminates

| Removed | Lines | Replaced By |
|---------|-------|------------|
| `Composition.tsx` | ~1,959 | FullComposition from workspace bundle |
| `DynamicVisualLoader.tsx` | ~328 | `useWorkspaceComposition` hook (~180 lines) |
| `layout-utils.ts` | ~261 | `composition/utils.ts` in workspace |
| **Total removed** | **~2,548** | **~180 new lines** (hook + WorkspacePlayer) |

The layout computation, caption rendering, video handling, PiP logic, and display mode transitions all now come from a single source (FullComposition in the workspace). Preview and export use the same rendering engine.
