# Low-Res Proxy Preview System

**Date:** 2026-03-20
**Status:** Approved

## Problem

The editor preview plays source video/images/audio at full resolution. On mid-range devices this causes stuttering, high memory usage, and slow load times. A 1080p+ source video being decoded frame-by-frame in the Remotion Player is the primary bottleneck.

## Solution

Generate lightweight proxy files for all media during workspace init. The player preview uses proxies; final export uses originals. Both files coexist in `/workspace/public/`.

## Proxy Generation Rules

| Media Type | Extensions | Proxy Strategy | Output Name |
|---|---|---|---|
| Video | .mp4, .webm | 480p, libx264 ultrafast, CRF 28, AAC 128k | `{name}-proxy.mp4` |
| Image | .png, .jpg, .jpeg, .webp | Max 960px wide, WebP q70 | `{name}-proxy.webp` |
| Audio | .aac, .mp3, .wav, .m4a | 64kbps mono AAC | `{name}-proxy.aac` |

### Skip conditions
- Video source height already <= 480px
- Image source width already <= 960px
- Files that already contain `-proxy.` in the name

### Failure handling
- If ffmpeg fails for any file, log a warning and continue. The editor falls back to the original file transparently — no proxy file exists, so the proxy path 404s and the resolution logic uses the original.

## Architecture

### Two execution contexts

The composition code (`PlayerComposition`, `VideoItem`, etc.) runs in two distinct contexts:

1. **Web app Player (browser preview):** Composition is CJS-evaluated via `new Function()` in `useWorkspaceComposition.ts`. The `staticFile()` call is shimmed to `customStaticFile()` which builds URLs like `/api/projects/{id}/sandbox/public/{filename}`. The assets map is stripped (`assets: {}`), so all media resolves via the `staticFile` path.

2. **Sandbox rendering (`remotion render` / `remotion still`):** Runs in headless Chromium via Remotion CLI. `staticFile()` resolves to the local `/workspace/public/` directory. The assets map IS populated (manifest.json is copied to public/ before render).

This means the proxy swap must happen at **two different levels**:
- **Browser Player:** In the `customStaticFile` shim (rewrites the URL path to proxy)
- **Sandbox rendering:** In `resolveMediaSrc()` (rewrites via assets map lookup), with `getRemotionEnvironment().isRendering` to skip proxy during export

### File layout
```
/workspace/public/
  source.mp4           # Original full-res video (kept for export)
  source-proxy.mp4     # 480p proxy (used for preview)
  audio.aac            # Original extracted audio
  audio-proxy.aac      # 64k mono proxy
  some-image.png       # Original image (if any)
  some-image-proxy.webp # 960px proxy
```

### Data flow
```
workspace-init.ts
  1. Download source.mp4 from MinIO
  2. Extract audio.aac (existing)
  3. NEW: generateProxies() — scans /workspace/public/, generates proxy for each media file
  4. cpSync staging → workspace (existing)
  5. syncAssets() — uploads ALL files (originals + proxies), generates presigned URLs (existing, no changes)

manifest.assets after sync:
  {
    "source.mp4": "https://minio/.../source.mp4?sig=...",
    "source-proxy.mp4": "https://minio/.../source-proxy.mp4?sig=...",
    "audio.aac": "https://minio/.../audio.aac?sig=...",
    "audio-proxy.aac": "https://minio/.../audio-proxy.aac?sig=...",
    ...
  }
```

### Preview vs export swap

**Proxy extension map (shared between both contexts):**

```typescript
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

**Context 1 — Browser Player (`customStaticFile` in `useWorkspaceComposition.ts`):**
```typescript
const customStaticFile = (relativePath: string) => {
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;

  // Check assets map first (presigned S3 URL)
  if (_currentAssetsMap[cleanPath]) {
    return _currentAssetsMap[cleanPath];
  }

  const projectIdMatch = bundleBaseUrl.match(/\/projects\/([^/]+)\/(workspace|sandbox)\//);
  const publicBase = projectIdMatch
    ? `/api/projects/${projectIdMatch[1]}/${projectIdMatch[2]}/public`
    : `${bundleBaseUrl}/public`;

  // NEW: Prefer proxy path for preview performance
  const proxyKey = deriveProxyKey(cleanPath);
  if (proxyKey) {
    return `${publicBase}/${proxyKey}`;
  }

  return `${publicBase}/${cleanPath}`;
};
```

The proxy URL (e.g., `/api/projects/{id}/sandbox/public/source-proxy.mp4`) is served by the existing express.static middleware in the sandbox file server. If the proxy file doesn't exist (generation was skipped or failed), the request 404s, the `<Video>` element falls back naturally — but to be safe, the `resolveMediaSrc()` function in the composition also serves as a second line of defense.

**Context 2 — Sandbox composition (`resolveMediaSrc` in `resolveMediaSrc.ts`):**
```typescript
import { getRemotionEnvironment, staticFile } from 'remotion';

export function resolveMediaSrc(
  src: string,
  assets: Record<string, string>,
): string {
  const { isRendering } = getRemotionEnvironment();

  // During export render, always use originals (full quality)
  // During remotion still (QC screenshots), use proxies (speed)
  if (!isRendering) {
    // Preview mode — prefer proxy
    const proxyKey = deriveProxyKey(src);
    if (proxyKey && assets[proxyKey]) return assets[proxyKey];
  }

  // Standard resolution: assets map → absolute URL → staticFile
  if (assets[src]) return assets[src];
  if (/^https?:\/\/|^blob:/.test(src)) return src;
  return staticFile(src);
}
```

Note: `getRemotionEnvironment().isRendering` returns `true` during both `remotion render` and `remotion still`. For `remotion still` (QC screenshot checks), we actually want proxies for speed. The spec uses `isRendering` as the gate to use full-res only during final render. If QC accuracy matters, this can be toggled later.

## Changes

### 1. `packages/sandbox/src/workspace-init.ts` — Add `generateProxies()`

New async function called inside `initWorkspaceInDir()`, after audio extraction but before manifest write. Scans `public/` directory and generates a proxy for each media file using ffmpeg CLI (same `execFileAsync` pattern as existing audio extraction).

ffmpeg commands:
- **Video:** `ffmpeg -i input -vf scale=-2:480 -c:v libx264 -preset ultrafast -crf 28 -c:a aac -b:a 128k -y output`
- **Image:** `ffmpeg -i input -vf "scale='min(960,iw)':-2" -q:v 70 -y output.webp`
- **Audio:** `ffmpeg -i input -ac 1 -b:a 64k -y output.aac`

Dimension probing (skip if below threshold):
```
ffprobe -v quiet -print_format json -show_streams -select_streams v:0 input
```
Parse `width` and `height` from the video stream JSON. Skip video proxy if height <= 480, skip image proxy if width <= 960.

Expected init time impact: ~5-15s for a typical 60s 1080p source. Runs synchronously in init before the sandbox becomes responsive.

### 2. `packages/sandbox/template/src/items/resolveMediaSrc.ts` — New shared module

Extract the duplicated media resolution logic from VideoItem, AudioItem, and ImageItem into a single shared function. Contains the `PROXY_EXTENSIONS` map, `deriveProxyKey()` helper, and `resolveMediaSrc()` function with `getRemotionEnvironment().isRendering` check.

### 3. `packages/sandbox/template/src/items/VideoItem.tsx` — Use shared resolver

Remove inline `resolveMediaSrc` function, import from `./resolveMediaSrc`.

### 4. `packages/sandbox/template/src/items/AudioItem.tsx` — Use shared resolver

Remove inline resolution logic, import `resolveMediaSrc` from `./resolveMediaSrc`.

### 5. `packages/sandbox/template/src/items/ImageItem.tsx` — Use shared resolver

Remove inline resolution logic, import `resolveMediaSrc` from `./resolveMediaSrc`.

### 6. `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts` — Proxy-aware `customStaticFile`

Add the `PROXY_EXTENSIONS` map and `deriveProxyKey()` helper. Modify `customStaticFile` to rewrite paths to proxy variants before constructing the URL. This is the primary swap point for browser preview performance.

### 7. `packages/sandbox/src/asset-sync.ts` — No changes

Already scans all files in `/workspace/public/` and generates presigned URLs. Proxy files are picked up automatically.

### 8. `packages/sandbox/src/tools/render-video.ts` — No changes needed

`getRemotionEnvironment().isRendering` handles the swap automatically inside the composition code. No env var plumbing required.

### 9. Manifest schema — No changes

Items still reference `"src": "source.mp4"` in the manifest. The proxy swap is transparent, happening at render-time in `resolveMediaSrc()` and at URL construction time in `customStaticFile`.

## What stays the same
- Manifest schema and all manifest-ops tools
- Agent tools and orchestrator
- Frontend prefetch/premounting (just fetches smaller files now)
- Timeline operations (split, trim, delete)
- All item components' rendering logic (only the src resolution changes)
- `render-video.ts` (no env var changes needed)

## Expected size reduction

| Source | Proxy | Reduction |
|---|---|---|
| 1080p 60s video ~50MB | 480p CRF 28 ~5-8MB | ~85-90% |
| 4K 60s video ~200MB | 480p CRF 28 ~5-8MB | ~96% |
| 4K image ~8MB | 960px WebP ~200KB | ~97% |
| WAV audio 60s ~10MB | 64k AAC ~500KB | ~95% |

## Edge cases

- **Portrait video (1080x1920):** `scale=-2:480` → 270x480 (correct, maintains aspect ratio)
- **Source already below threshold:** Skip proxy generation, no proxy file created. Browser: `customStaticFile` returns proxy URL that 404s, `<Video>` element handles gracefully. Sandbox: `resolveMediaSrc` finds no proxy key in assets → uses original.
- **ffmpeg failure on any file:** Warning logged, no proxy file → asset-sync skips it → original used. Editor works identically, just slower.
- **Agent-generated assets (scenes, shapes):** Code-rendered in browser, no source files in `/workspace/public/` — unaffected
- **Caption/text items:** No media files — unaffected
- **Non-standard extensions:** No proxy generated, `deriveProxyKey` returns null, falls through to original. Safe by default.
- **Multiple video sources (user imports additional clips):** Each gets a proxy via the same `generateProxies()` scan. The generic `deriveProxyKey()` pattern handles any filename.
- **Workspace reset:** `resetWorkspace()` doesn't touch `/workspace/public/`, so proxies persist across resets.
- **Proxy 404 in browser:** If proxy file doesn't exist but `customStaticFile` returns the proxy URL, the `<Video>`/`<Img>` element will fail to load. Mitigation: the sandbox file server serves 404 for missing files, and Remotion handles media load errors gracefully (shows nothing rather than crashing). For extra safety, we could add a fallback fetch check, but this adds latency — better to rely on proxy generation being reliable.
- **Odd-dimension video (e.g., 1079px wide):** `scale=-2:480` ensures output width is divisible by 2 (required by x264). Safe.
