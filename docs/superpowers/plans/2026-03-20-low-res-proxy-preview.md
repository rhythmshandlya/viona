# Low-Res Proxy Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 480p video / 960px image / 64k audio proxies during sandbox workspace init so the editor preview runs smoothly on mid-range devices, while keeping originals for final export.

**Architecture:** During workspace init, a new `generateProxies()` function scans `/workspace/public/` and creates lightweight proxy files via ffmpeg. A shared `resolveMediaSrc()` module handles the proxy-vs-original swap in two contexts: the browser Player (via `customStaticFile` URL rewriting) and sandbox Remotion rendering (via `getRemotionEnvironment().isRendering` gate). No manifest schema changes — the swap is transparent.

**Tech Stack:** ffmpeg/ffprobe CLI, Remotion `getRemotionEnvironment()`, TypeScript, Express static serving

**Spec:** `docs/superpowers/specs/2026-03-20-low-res-proxy-preview-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `packages/sandbox/src/workspace-init.ts` | Add `generateProxies()` + `probeDimensions()` |
| Create | `packages/sandbox/template/src/items/resolveMediaSrc.ts` | Shared proxy-aware media resolution |
| Modify | `packages/sandbox/template/src/items/VideoItem.tsx` | Use shared `resolveMediaSrc` |
| Modify | `packages/sandbox/template/src/items/AudioItem.tsx` | Use shared `resolveMediaSrc` |
| Modify | `packages/sandbox/template/src/items/ImageItem.tsx` | Use shared `resolveMediaSrc` |
| Modify | `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts` | Proxy-aware `customStaticFile` + `getRemotionEnvironment` shim |

**Task dependencies:** Task 2 depends on Task 1. Tasks 3 and 4 are independent of each other. Task 5 depends on all previous tasks.

---

### Task 1: Create shared `resolveMediaSrc` module

**Files:**
- Create: `packages/sandbox/template/src/items/resolveMediaSrc.ts`

- [ ] **Step 1: Create the shared module**

```typescript
// packages/sandbox/template/src/items/resolveMediaSrc.ts
import { getRemotionEnvironment, staticFile } from 'remotion';

/**
 * Map of source file extensions → proxy file suffix.
 * Used by both sandbox composition and browser Player shim.
 */
export const PROXY_EXTENSIONS: Record<string, string> = {
  '.mp4': '-proxy.mp4',
  '.webm': '-proxy.mp4',
  '.png': '-proxy.webp',
  '.jpg': '-proxy.webp',
  '.jpeg': '-proxy.webp',
  '.webp': '-proxy.webp',
  '.aac': '-proxy.aac',
  '.mp3': '-proxy.aac',
  '.wav': '-proxy.aac',
  '.m4a': '-proxy.aac',
};

/**
 * Derive the proxy filename for a given source path.
 * Returns null if the extension is not in the proxy map.
 *
 * Example: "source.mp4" → "source-proxy.mp4"
 */
export function deriveProxyKey(src: string): string | null {
  const ext = src.match(/\.\w+$/)?.[0]?.toLowerCase();
  if (ext && PROXY_EXTENSIONS[ext]) {
    return src.replace(/\.\w+$/, PROXY_EXTENSIONS[ext]);
  }
  return null;
}

/**
 * Resolve a media source path to a playable URL.
 *
 * In preview mode: prefers proxy variant if available in assets map.
 * In render mode (remotion render / remotion still): always uses original for full quality.
 *
 * Note: getRemotionEnvironment().isRendering is true for BOTH `remotion render` and
 * `remotion still`. This means QC screenshots also use originals. If QC speed matters
 * more than pixel accuracy, this gate can be refined later.
 *
 * Resolution order: proxy (if preview) → assets map → absolute URL → staticFile
 */
export function resolveMediaSrc(
  src: string,
  assets: Record<string, string>,
): string {
  const { isRendering } = getRemotionEnvironment();

  // In preview mode, prefer proxy if available in assets
  if (!isRendering) {
    const proxyKey = deriveProxyKey(src);
    if (proxyKey && assets[proxyKey]) return assets[proxyKey];
  }

  // Standard resolution: assets map → absolute URL → staticFile
  if (assets[src]) return assets[src];
  if (/^https?:\/\/|^blob:/.test(src)) return src;
  return staticFile(src);
}
```

**Important:** The esbuild config marks `remotion` as external, so `require('remotion')` resolves via the `customRequire` shim in `useWorkspaceComposition.ts`. The shim does NOT include `getRemotionEnvironment` by default. Task 3 adds it as a stub. In the browser Player context, the stub returns `{ isRendering: false }` (always preview mode), which is correct.

- [ ] **Step 2: Verify the template builds**

Run: `cd packages/sandbox && npm run build:template 2>&1 | head -20`

If there's no `build:template` script, check with: `cat packages/sandbox/package.json | grep -A5 scripts`

The template is CJS-bundled by esbuild for the sandbox. Verify no import errors.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/src/items/resolveMediaSrc.ts
git commit -m "feat(sandbox): add shared resolveMediaSrc with proxy support"
```

---

### Task 2: Refactor item components to use shared resolver

**Files:**
- Modify: `packages/sandbox/template/src/items/VideoItem.tsx` (lines 1-9)
- Modify: `packages/sandbox/template/src/items/AudioItem.tsx` (lines 1-27)
- Modify: `packages/sandbox/template/src/items/ImageItem.tsx` (lines 1-21)

- [ ] **Step 1: Update VideoItem.tsx**

Remove the inline `resolveMediaSrc` function (lines 4-9) and its `staticFile` import. Import from the shared module instead.

Before (lines 1-9):
```typescript
import React from 'react';
import { Video, staticFile } from 'remotion';

/** Resolve media source: assets map → URL → staticFile fallback */
export function resolveMediaSrc(src: string, assets: Record<string, string>): string {
  if (assets[src]) return assets[src];
  if (/^https?:\/\/|^blob:/.test(src)) return src;
  return staticFile(src);
}
```

After:
```typescript
import React from 'react';
import { Video } from 'remotion';
import { resolveMediaSrc } from './resolveMediaSrc';
```

The rest of the file stays identical — `resolveMediaSrc(data.src, assets)` call on line 40 already matches the shared function signature.

- [ ] **Step 2: Update AudioItem.tsx**

Replace the inline resolution logic with the shared import.

Before (lines 1-27):
```typescript
import React from 'react';
import { Audio, staticFile } from 'remotion';

// ... interfaces ...

export const AudioItem: React.FC<AudioItemProps> = ({ data, assets, fps }) => {
  let src: string;
  if (assets[data.src]) {
    src = assets[data.src];
  } else if (/^https?:\/\/|^blob:/.test(data.src)) {
    src = data.src;
  } else {
    src = staticFile(data.src);
  }
```

After:
```typescript
import React from 'react';
import { Audio } from 'remotion';
import { resolveMediaSrc } from './resolveMediaSrc';

interface AudioItemData {
  src: string;
  startFrom?: number;
  volume?: number;
  playbackRate?: number;
}

interface AudioItemProps {
  data: AudioItemData;
  assets: Record<string, string>;
  fps: number;
}

export const AudioItem: React.FC<AudioItemProps> = ({ data, assets, fps }) => {
  const src = resolveMediaSrc(data.src, assets);
```

Remove the `let src` block and the `staticFile` import.

- [ ] **Step 3: Update ImageItem.tsx**

Same pattern as AudioItem.

Before (lines 1-21):
```typescript
import React from 'react';
import { Img, staticFile } from 'remotion';

// ... interfaces ...

export const ImageItem: React.FC<ImageItemProps> = ({ data, assets }) => {
  let src: string;
  if (assets[data.src]) {
    src = assets[data.src];
  } else if (/^https?:\/\/|^blob:/.test(data.src)) {
    src = data.src;
  } else {
    src = staticFile(data.src);
  }
```

After:
```typescript
import React from 'react';
import { Img } from 'remotion';
import { resolveMediaSrc } from './resolveMediaSrc';

interface ImageItemData {
  src: string;
}

interface ImageItemProps {
  data: ImageItemData;
  assets: Record<string, string>;
}

export const ImageItem: React.FC<ImageItemProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
```

- [ ] **Step 4: Verify template still builds**

Run: `cd packages/sandbox && npm run build:template 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/template/src/items/VideoItem.tsx packages/sandbox/template/src/items/AudioItem.tsx packages/sandbox/template/src/items/ImageItem.tsx
git commit -m "refactor(sandbox): use shared resolveMediaSrc in all item components"
```

---

### Task 3: Add proxy-aware `customStaticFile` in browser Player

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts` (lines 88-104)

This is the primary swap point for browser preview performance. The web Player strips the assets map, so all media goes through `customStaticFile` → we rewrite the URL path to prefer the proxy file.

- [ ] **Step 1: Add `deriveProxyKey` helper above `createRequire`**

Insert before `function createRequire(bundleBaseUrl: string)` (line 88):

```typescript
// ---------------------------------------------------------------------------
// Proxy key derivation — matches proxy naming from sandbox workspace-init
// ---------------------------------------------------------------------------
const PROXY_EXTENSIONS: Record<string, string> = {
  '.mp4': '-proxy.mp4',
  '.webm': '-proxy.mp4',
  '.png': '-proxy.webp',
  '.jpg': '-proxy.webp',
  '.jpeg': '-proxy.webp',
  '.webp': '-proxy.webp',
  '.aac': '-proxy.aac',
  '.mp3': '-proxy.aac',
  '.wav': '-proxy.aac',
  '.m4a': '-proxy.aac',
};

function deriveProxyKey(src: string): string | null {
  const ext = src.match(/\.\w+$/)?.[0]?.toLowerCase();
  if (ext && PROXY_EXTENSIONS[ext]) {
    return src.replace(/\.\w+$/, PROXY_EXTENSIONS[ext]);
  }
  return null;
}
```

- [ ] **Step 2: Modify `customStaticFile` to prefer proxy paths**

Replace lines 89-104 (the `customStaticFile` function body inside `createRequire`):

Before:
```typescript
  const customStaticFile = (relativePath: string) => {
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;

    // Check assets map first (presigned S3 URL)
    if (_currentAssetsMap[cleanPath]) {
      return _currentAssetsMap[cleanPath];
    }

    // Fallback to same-origin proxy URL (no cross-origin apiUrl prefix).
    // Next.js rewrites /api/* to the backend, so media elements send cookies.
    const projectIdMatch = bundleBaseUrl.match(/\/projects\/([^/]+)\/(workspace|sandbox)\//);
    const publicBase = projectIdMatch
      ? `/api/projects/${projectIdMatch[1]}/${projectIdMatch[2]}/public`
      : `${bundleBaseUrl}/public`;
    return `${publicBase}/${cleanPath}`;
  };
```

After:
```typescript
  const customStaticFile = (relativePath: string) => {
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;

    // Check assets map first (presigned S3 URL)
    if (_currentAssetsMap[cleanPath]) {
      return _currentAssetsMap[cleanPath];
    }

    // Same-origin proxy URL — Next.js rewrites /api/* to the backend
    const projectIdMatch = bundleBaseUrl.match(/\/projects\/([^/]+)\/(workspace|sandbox)\//);
    const publicBase = projectIdMatch
      ? `/api/projects/${projectIdMatch[1]}/${projectIdMatch[2]}/public`
      : `${bundleBaseUrl}/public`;

    // Prefer proxy file for preview performance (480p video, 960px images, 64k audio).
    // If the proxy file doesn't exist on disk (generation skipped/failed), the request
    // will 404 and Remotion handles media load errors gracefully. This is an acceptable
    // tradeoff — proxy generation is reliable, and the fallback is "no video shown"
    // rather than a crash.
    const proxyKey = deriveProxyKey(cleanPath);
    if (proxyKey) {
      return `${publicBase}/${proxyKey}`;
    }

    return `${publicBase}/${cleanPath}`;
  };
```

- [ ] **Step 3: Add `getRemotionEnvironment` stub to the remotion shim**

The CJS bundle's `require('remotion')` is handled by the `customRequire` shim in the same file. The shared `resolveMediaSrc.ts` calls `getRemotionEnvironment()`, which must exist in the shimmed module. In the browser Player, this is always preview mode (never rendering).

Find the remotion shim return block (around line 143):

```typescript
      return {
        ...Remotion,
        Sequence: PremountSequence,
        Composition: () => null,
        staticFile: customStaticFile,
        OffthreadVideo: Remotion.Video,
      };
```

Add `getRemotionEnvironment` to it:

```typescript
      return {
        ...Remotion,
        Sequence: PremountSequence,
        Composition: () => null,
        staticFile: customStaticFile,
        OffthreadVideo: Remotion.Video,
        // Stub for resolveMediaSrc proxy logic — browser Player is always preview mode
        getRemotionEnvironment: () => ({ isRendering: false, isPlayer: true }),
      };
```

- [ ] **Step 4: Verify frontend builds**

Run: `cd apps/web && npx next build 2>&1 | tail -20`

Or if there's a typecheck script: `cd apps/web && npx tsc --noEmit 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts
git commit -m "feat(editor): proxy-aware customStaticFile for low-res preview"
```

---

### Task 4: Add `generateProxies()` to workspace init

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts`

This is the backend change that actually creates the proxy files. Uses ffmpeg/ffprobe CLIs via the same `execFileAsync` pattern already used in the file for audio extraction.

- [ ] **Step 1: Add `probeDimensions` helper**

Insert after the existing `probeVideoDurationMs` function (after line 71):

```typescript
/**
 * Probe width and height of a video or image file using ffprobe.
 * Returns { width, height } or null on failure.
 */
async function probeDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'v:0',
      filePath,
    ]);
    const info = JSON.parse(stdout);
    const stream = info.streams?.[0];
    if (stream?.width && stream?.height) {
      return { width: stream.width, height: stream.height };
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Add `generateProxies` function**

Insert after `probeDimensions`.

**First**, add `readdir` to the existing static import at the top of the file (line 1):

Before:
```typescript
import { mkdir, writeFile, cp, access, symlink, readlink, copyFile, rm } from 'fs/promises';
```

After:
```typescript
import { mkdir, writeFile, cp, access, symlink, readlink, copyFile, rm, readdir } from 'fs/promises';
```

Then add the function:

```typescript
const VIDEO_EXTS = new Set(['.mp4', '.webm']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const AUDIO_EXTS = new Set(['.aac', '.mp3', '.wav', '.m4a']);

const PROXY_SUFFIXES: Record<string, string> = {
  '.mp4': '-proxy.mp4',  '.webm': '-proxy.mp4',
  '.png': '-proxy.webp', '.jpg': '-proxy.webp', '.jpeg': '-proxy.webp', '.webp': '-proxy.webp',
  '.aac': '-proxy.aac',  '.mp3': '-proxy.aac',  '.wav': '-proxy.aac',  '.m4a': '-proxy.aac',
};

/**
 * Generate low-res proxy files for all media in the public directory.
 * Video → 480p, Image → 960px wide WebP, Audio → 64kbps mono AAC.
 * Skips files already below threshold or that already have a proxy.
 * Failures are logged and silently skipped — editor falls back to originals.
 */
async function generateProxies(publicDir: string): Promise<void> {
  const entries = await readdir(publicDir, { withFileTypes: true });
  const files = entries.filter(e => e.isFile()).map(e => e.name);

  for (const file of files) {
    if (file.includes('-proxy.')) continue;

    const ext = file.match(/\.\w+$/)?.[0]?.toLowerCase() || '';
    const suffix = PROXY_SUFFIXES[ext];
    if (!suffix) continue;

    const base = file.replace(/\.\w+$/, '');
    const input = join(publicDir, file);
    const output = join(publicDir, `${base}${suffix}`);

    try {
      if (VIDEO_EXTS.has(ext)) {
        const dims = await probeDimensions(input);
        if (dims && dims.height <= 480) {
          logger.info({ file }, 'Skipping proxy — already ≤480p');
          continue;
        }
        await execFileAsync('ffmpeg', [
          '-i', input,
          '-vf', 'scale=-2:480',
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
          '-c:a', 'aac', '-b:a', '128k',
          '-y', output,
        ], { timeout: 120_000 });
        logger.info({ file, output: `${base}${suffix}` }, 'Video proxy generated');

      } else if (IMAGE_EXTS.has(ext)) {
        const dims = await probeDimensions(input);
        if (dims && dims.width <= 960) {
          logger.info({ file }, 'Skipping proxy — already ≤960px wide');
          continue;
        }
        await execFileAsync('ffmpeg', [
          '-i', input,
          '-vf', "scale='min(960,iw)':-2",
          '-q:v', '70',
          '-y', output,
        ], { timeout: 30_000 });
        logger.info({ file, output: `${base}${suffix}` }, 'Image proxy generated');

      } else if (AUDIO_EXTS.has(ext)) {
        await execFileAsync('ffmpeg', [
          '-i', input,
          '-c:a', 'aac', '-ac', '1', '-b:a', '64k',
          '-y', output,
        ], { timeout: 60_000 });
        logger.info({ file, output: `${base}${suffix}` }, 'Audio proxy generated');
      }
    } catch (err) {
      logger.warn({ err, file }, 'Proxy generation failed — will use original');
    }
  }
}
```

- [ ] **Step 3: Call `generateProxies` inside `initWorkspaceInDir`**

In `initWorkspaceInDir()`, insert the call after the audio download section (after line 140, the `if (payload.audioUrl)` block) and before the manifest patching (line 142):

```typescript
  // Generate low-res proxy files for preview performance
  await generateProxies(join(baseDir, 'public'));
```

The exact insertion point is between these two existing code blocks:

```typescript
  // Download separate audio if provided (overrides extracted)
  if (payload.audioUrl) {
    // ...
  }

  // >>> INSERT HERE <<<

  // Patch manifest with detected duration and fix video item endMs
  const manifest = payload.manifest as Record<string, any>;
```

- [ ] **Step 4: Verify sandbox builds**

Run: `cd packages/sandbox && npm run build 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "feat(sandbox): generate low-res proxy files during workspace init"
```

---

### Task 5: End-to-end verification

Manual testing since this involves sandbox Docker container + browser + ffmpeg.

- [ ] **Step 1: Rebuild sandbox Docker image**

Run: `cd packages/sandbox && docker build -t viona-sandbox . 2>&1 | tail -10`

- [ ] **Step 2: Test with a real project**

1. Open a project in the editor
2. Check browser DevTools Network tab — video requests should be for `source-proxy.mp4` not `source.mp4`
3. Check sandbox logs for `Video proxy generated` / `Audio proxy generated` messages
4. Verify playback works smoothly — scrubbing, seeking, split boundaries
5. Verify the proxy file is smaller: `docker exec <container> ls -lh /workspace/public/`

- [ ] **Step 3: Test export uses full-res**

1. Trigger a render/export
2. Check that the output video quality matches the original source, not the 480p proxy
3. In sandbox logs during render, `getRemotionEnvironment().isRendering` should be `true`

- [ ] **Step 4: Test fallback (no proxy)**

1. Delete the proxy file from the workspace: `docker exec <container> rm /workspace/public/source-proxy.mp4`
2. Reload the editor — should fall back to original `source.mp4` gracefully
3. No crashes, just full-res playback

- [ ] **Step 5: Final commit with any fixes**

```bash
git add -A
git commit -m "feat: low-res proxy preview system

Generate 480p video / 960px image / 64k audio proxies during
workspace init. Browser Player and sandbox preview use proxies;
final export uses original full-res files."
```
