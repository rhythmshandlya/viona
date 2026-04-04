# Editor Performance Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editor performant with depth-composited projects — eliminate proxy chain, use low-res proxies for editing, fix React re-renders, replace canvas pixel loop with WebGL, compress matte files.

**Architecture:** Five phases executed sequentially. Phase 1 (MinIO direct serving) unblocks Phase 2 (proxy workflow). Phases 3 (matte compression), 4 (WebGL compositor), and 5 (Zustand transient updates) are independent. All media served via MinIO presigned URLs. Proxy files used for editing, full-res for rendering. WebGL shader replaces canvas2D pixel loop. React re-renders eliminated via transient zustand patterns.

**Tech Stack:** MinIO/S3 presigned URLs, WebGL 1.0 fragment shaders, Zustand transient subscriptions, FFmpeg proxy generation, Remotion Player

**Spec:** `docs/superpowers/specs/2026-04-04-editor-performance-overhaul-design.md`

---

## Phase 1: MinIO Direct Serving

### Task 1: Configure MinIO CORS

**Files:**
- Create: `scripts/configure-minio-cors.sh`

- [ ] **Step 1: Create CORS configuration script**

```bash
#!/bin/bash
# Configure MinIO CORS for presigned URL access from the browser
# Run once per environment (local dev, staging, production)

MINIO_ALIAS="${MINIO_ALIAS:-local}"
BUCKET="${BUCKET_NAME:-viona}"

# Create CORS config
cat > /tmp/minio-cors.json << 'EOF'
{
  "CORSRules": [{
    "AllowedOrigins": ["http://localhost:3000", "http://localhost:4000", "https://*.up.railway.app"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges", "ETag", "Content-Type"],
    "MaxAgeSeconds": 86400
  }]
}
EOF

mc anonymous set-json /tmp/minio-cors.json "${MINIO_ALIAS}/${BUCKET}"
echo "CORS configured for ${MINIO_ALIAS}/${BUCKET}"
```

- [ ] **Step 2: Run against local MinIO and verify**

Run: `mc alias set local http://localhost:9000 viona viona123 && bash scripts/configure-minio-cors.sh`

Verify by curling a presigned URL with Origin header:
```bash
curl -I -H "Origin: http://localhost:3000" "<presigned-url>"
# Should include: Access-Control-Allow-Origin: http://localhost:3000
```

- [ ] **Step 3: Commit**

```bash
git add scripts/configure-minio-cors.sh
git commit -m "infra: add MinIO CORS configuration script for presigned URL access"
```

---

### Task 2: Make asset-sync recursive and re-runnable

**Files:**
- Modify: `packages/sandbox/src/asset-sync.ts:51-113`

- [ ] **Step 1: Read the current `syncAssets` function**

Read `packages/sandbox/src/asset-sync.ts` in full. Note:
- Line 58: `readdir(PUBLIC_DIR, { withFileTypes: true })` — only reads top-level
- Line 83: `fPutObject` — uploads each file
- Line 94: `presignedGetObject` — generates presigned URL
- The function writes presigned URLs into `manifest.assets`

- [ ] **Step 2: Add recursive directory walk**

Replace the flat `readdir` at line 58 with a recursive walk that preserves relative paths:

```typescript
import { readdir } from 'fs/promises';
import { join, relative } from 'path';

async function walkDir(dir: string, baseDir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkDir(fullPath, baseDir));
    } else if (entry.isFile()) {
      // Relative path from PUBLIC_DIR, using forward slashes for manifest keys
      files.push(relative(baseDir, fullPath).replace(/\\/g, '/'));
    }
  }
  return files;
}
```

In `syncAssets()`, replace:
```typescript
const entries = await readdir(PUBLIC_DIR, { withFileTypes: true });
files = entries.filter(e => e.isFile()).map(e => e.name);
```
with:
```typescript
files = await walkDir(PUBLIC_DIR, PUBLIC_DIR);
```

And update the `fPutObject` call to use the full path:
```typescript
const filePath = join(PUBLIC_DIR, file); // file is now relative like "matte/scene-1.mp4"
await minio.fPutObject(bucket, objectKey, filePath);
```

- [ ] **Step 3: Increase presigned URL TTL to 24 hours**

Change the TTL constant (line 12 area):
```typescript
const PRESIGNED_TTL = 24 * 60 * 60; // 24 hours
```

- [ ] **Step 4: Test locally — verify matte files get presigned URLs**

Start a sandbox for any project with matte files. Check the manifest:
```bash
docker exec sandbox-<projectId> cat /workspace/manifest.json | python -c "import json,sys; m=json.load(sys.stdin); [print(f'{k}: {v[:80]}...') for k,v in m.get('assets',{}).items() if 'matte' in k]"
```
Expected: presigned URLs for `matte/scene-1.mp4`, `matte/scene-1-fgr.mp4`, etc.

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/asset-sync.ts
git commit -m "feat(asset-sync): recursive directory walk for matte files, 24h presigned TTL"
```

---

### Task 3: Re-run syncAssets after matte download

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts:1049-1120`
- Modify: `packages/sandbox/src/asset-sync.ts` (export syncAssets if not already)

- [ ] **Step 1: Read `check_segmentation_status` in asset-server.ts**

Read `packages/mcp-servers/src/asset-server.ts` around lines 1049-1120. Note where matte/fgr/bg files are downloaded to the workspace. Find the return point where status is 'complete'.

- [ ] **Step 2: Import and call syncAssets after matte download**

After all matte/fgr/bg files are downloaded (around line 1115), add:

```typescript
// Re-sync assets to MinIO so presigned URLs include new matte files
try {
  const { syncAssets } = await import('../asset-sync.js');
  await syncAssets();
  logger.info('Assets re-synced after matte download');
} catch (err) {
  logger.warn({ err }, 'Failed to re-sync assets after matte download (non-critical)');
}
```

Ensure `syncAssets` is exported from `asset-sync.ts`:
```typescript
export async function syncAssets(): Promise<void> {
```

- [ ] **Step 3: Test — trigger segmentation and verify assets update**

After segmentation completes for a project, check:
```bash
docker exec sandbox-<projectId> cat /workspace/manifest.json | python -c "import json,sys; m=json.load(sys.stdin); print(len([k for k in m.get('assets',{}) if 'matte' in k]), 'matte assets')"
```
Expected: > 0 matte assets with presigned URLs.

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts packages/sandbox/src/asset-sync.ts
git commit -m "feat(asset-sync): re-run after matte download so presigned URLs include matte files"
```

---

### Task 4: Add crossorigin to all Video elements

**Files:**
- Modify: `packages/sandbox/template/src/items/MatteItem.tsx:84,93`
- Modify: `packages/sandbox/template/src/items/VideoItem.tsx:44,63`
- Modify: `packages/sandbox/template/src/composition/SandwichComposite.tsx` (find all `<Video` elements)

- [ ] **Step 1: Add `crossOrigin="anonymous"` to MatteItem Video elements**

In `packages/sandbox/template/src/items/MatteItem.tsx`, add `crossOrigin="anonymous"` to both `<Video>` elements (lines 84 and 93):

```tsx
<Video
  ref={fgrVideoRef}
  src={fgrSrc}
  startFrom={startFromFrames}
  crossOrigin="anonymous"
  style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
  pauseWhenBuffering
  muted
  onLoadedData={doRender}
/>
<Video
  ref={matteVideoRef}
  src={matteSrc}
  startFrom={startFromFrames}
  crossOrigin="anonymous"
  style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
  pauseWhenBuffering
  muted
  onLoadedData={doRender}
/>
```

- [ ] **Step 2: Add `crossOrigin="anonymous"` to VideoItem Video elements**

In `packages/sandbox/template/src/items/VideoItem.tsx`, add to both `<Video>` elements (lines 44 and 63):

```tsx
crossOrigin="anonymous"
```

- [ ] **Step 3: Add `crossOrigin="anonymous"` to SandwichComposite Video elements**

In `packages/sandbox/template/src/composition/SandwichComposite.tsx`, add to all `<Video>` elements.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/template/src/items/MatteItem.tsx packages/sandbox/template/src/items/VideoItem.tsx packages/sandbox/template/src/composition/SandwichComposite.tsx
git commit -m "feat: add crossOrigin=anonymous to all Video elements for MinIO CORS"
```

---

### Task 5: Stop stripping assets map in WorkspacePlayer

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx:192-201`

- [ ] **Step 1: Read the current inputProps computation**

Read `apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx` around lines 192-201. Note the `assets: {}` stripping.

- [ ] **Step 2: Pass the full assets map through**

Replace the inputProps computation:

```typescript
// Before:
const inputProps = useMemo(() => {
  const m = manifest as any;
  if (m?.assets) {
    const { assets: _a, ...rest } = m;
    return { manifest: { ...rest, assets: {} } };
  }
  return { manifest };
}, [manifest]);

// After:
const inputProps = useMemo(() => {
  return { manifest };
}, [manifest]);
```

- [ ] **Step 3: Update preload URL resolution to use assets map**

In the same file, find `resolveMedia` (around line 85). Update it to check the manifest assets map first:

```typescript
const resolveMedia = (src: string) => {
  // Check assets map first (presigned URLs from MinIO)
  if (manifest?.assets?.[src]) return manifest.assets[src];
  if (/^https?:\/\/|^blob:/.test(src)) return src;
  if (src.startsWith('/api/')) return src;
  const cleanPath = src.startsWith('/') ? src.slice(1) : src;
  const directUrl = resolveDirectMediaUrl(bundleUrl, cleanPath);
  if (directUrl) return directUrl;
  return `${publicBase}/${cleanPath}`;
};
```

- [ ] **Step 4: Test — verify media loads from presigned URLs**

Open a project in the editor. Check browser DevTools Network tab:
- Video/audio/image requests should go to MinIO presigned URLs (different origin)
- NOT to `/api/projects/{id}/sandbox/public/*`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx
git commit -m "feat: pass full assets map to Remotion Player for MinIO direct serving"
```

---

### Task 6: Remove resolveDirectMediaUrl special case

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts:98-108,134`

- [ ] **Step 1: Read resolveDirectMediaUrl and customStaticFile**

Read `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts` around lines 98-137.

- [ ] **Step 2: Remove the special case**

The `resolveDirectMediaUrl` function hardcodes `source.mp4 → /api/projects/{id}/video`. With presigned URLs in the assets map, this is no longer needed. In `customStaticFile`, remove the `resolveDirectMediaUrl` call:

```typescript
// In customStaticFile (around line 123):
const customStaticFile = (src: string) => {
  if (/^https?:\/\/|^blob:/.test(src)) return src;
  if (src.startsWith('/api/')) return src;
  const cleanPath = src.startsWith('/') ? src.slice(1) : src;
  // Removed: resolveDirectMediaUrl bypass — all media resolves from assets map now
  return `${publicBase}/${cleanPath}`;
};
```

Keep `resolveDirectMediaUrl` function for now (may be used elsewhere) but remove its call from `customStaticFile`.

- [ ] **Step 3: Test — verify source.mp4 loads from presigned URL**

Open a project. In DevTools Network, verify `source.mp4` loads from a MinIO presigned URL, NOT from `/api/projects/{id}/video`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts
git commit -m "refactor: remove resolveDirectMediaUrl bypass, all media from assets map"
```

---

## Phase 2: Proxy Workflow

### Task 7: Generate proxy matte files after segmentation

**Files:**
- Modify: `packages/worker/src/processors/segmentation.ts:87-107`

- [ ] **Step 1: Read the current matte upload section**

Read `packages/worker/src/processors/segmentation.ts` around lines 87-107 where matte and fgr are uploaded to MinIO.

- [ ] **Step 2: Add FFmpeg proxy generation after full-res upload**

After the full-res matte and fgr are uploaded (around line 107), add proxy generation:

```typescript
// Generate proxy files via FFmpeg downscale (not re-inference)
const matteProxyPath = mattePath.replace(/\.mp4$/, '-proxy.mp4');
const fgrProxyPath = mattePath.replace(/\.mp4$/, '-fgr-proxy.mp4');

try {
  await execFileAsync('ffmpeg', [
    '-i', mattePath,
    '-vf', 'scale=-2:480',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
    '-y', matteProxyPath,
  ], { timeout: 30_000, cwd: workDir });

  const fgrFullPath = mattePath.replace(/\.mp4$/, '-fgr.mp4');
  if (existsSync(fgrFullPath)) {
    await execFileAsync('ffmpeg', [
      '-i', fgrFullPath,
      '-vf', 'scale=-2:480',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      '-y', fgrProxyPath,
    ], { timeout: 30_000, cwd: workDir });
  }

  // Upload proxies
  const matteProxyKey = outputKey.replace(/\.mp4$/, '-proxy.mp4');
  const fgrProxyKey = outputKey.replace(/\.mp4$/, '-fgr-proxy.mp4');
  if (existsSync(matteProxyPath)) {
    await uploadFile('outputs', matteProxyKey, matteProxyPath);
    logger.info({ matteProxyKey }, 'Matte proxy uploaded');
  }
  if (existsSync(fgrProxyPath)) {
    await uploadFile('outputs', fgrProxyKey, fgrProxyPath);
    logger.info({ fgrProxyKey }, 'FGR proxy uploaded');
  }
} catch (proxyErr) {
  logger.warn({ err: proxyErr }, 'Proxy generation failed (non-critical)');
}
```

- [ ] **Step 3: Test — run segmentation and verify proxy files**

Trigger segmentation for a project. After completion, check MinIO:
```bash
mc ls local/viona/outputs/mattes/<projectId>/
# Should show: scene-1.mp4, scene-1-fgr.mp4, scene-1-proxy.mp4, scene-1-fgr-proxy.mp4
```

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/processors/segmentation.ts
git commit -m "feat(segmentation): generate proxy matte/fgr files via FFmpeg downscale"
```

---

### Task 8: Download proxy files to sandbox and update preloading

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts` (check_segmentation_status — download proxies too)
- Modify: `apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx` (preload proxy URLs)

- [ ] **Step 1: Download proxy files in check_segmentation_status**

In `packages/mcp-servers/src/asset-server.ts`, after downloading full-res matte/fgr files (around line 1073), also download proxies:

```typescript
// Download proxy files (non-critical — editing still works with full-res fallback)
for (const suffix of ['-proxy.mp4', '-fgr-proxy.mp4']) {
  const proxyLocalPath = localMattePath.replace('.mp4', suffix);
  const proxyEndpoint = `${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/segment/${job.jobId}/proxy${suffix}`;
  try {
    const proxyRes = await fetch(proxyEndpoint, { headers: { Authorization: `Bearer ${SANDBOX_SECRET}` } });
    if (proxyRes.ok) {
      const proxyBuffer = Buffer.from(await proxyRes.arrayBuffer());
      await writeFile(proxyLocalPath, proxyBuffer);
    }
  } catch {
    // Proxy not available — editing will use full-res via deriveProxyKey fallback
  }
}
```

Note: This requires adding a proxy download endpoint in the API, OR uploading proxies to a known MinIO path and having `syncAssets()` pick them up automatically. The simpler approach: since `syncAssets()` (Task 3) now runs after matte download, proxies just need to be in the workspace `public/matte/` directory. Add an FFmpeg downscale step in the sandbox instead:

```typescript
// Generate proxies locally in the sandbox after downloading full-res files
const { execFile } = await import('child_process');
const { promisify } = await import('util');
const execFileAsync = promisify(execFile);

for (const file of ['scene-1.mp4', 'scene-1-fgr.mp4']) {
  const fullPath = path.join(MATTE_DIR, file);
  const proxyPath = fullPath.replace('.mp4', '-proxy.mp4');
  if (existsSync(fullPath) && !existsSync(proxyPath)) {
    try {
      await execFileAsync('ffmpeg', [
        '-i', fullPath, '-vf', 'scale=-2:480',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
        '-y', proxyPath,
      ], { timeout: 30_000 });
    } catch { /* non-critical */ }
  }
}
```

- [ ] **Step 2: Update WorkspacePlayer preloading to use proxy URLs**

In `apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx`, update the `resolveMedia` function (from Task 5) to also try proxy keys:

```typescript
const resolveMedia = (src: string) => {
  // Try proxy first for editing preview
  const proxyKey = deriveProxyKey(src);
  if (proxyKey && manifest?.assets?.[proxyKey]) return manifest.assets[proxyKey];
  // Fall back to full-res
  if (manifest?.assets?.[src]) return manifest.assets[src];
  if (/^https?:\/\/|^blob:/.test(src)) return src;
  if (src.startsWith('/api/')) return src;
  const cleanPath = src.startsWith('/') ? src.slice(1) : src;
  return `${publicBase}/${cleanPath}`;
};
```

Import `deriveProxyKey` from the sandbox template's `resolveMediaSrc.ts` or duplicate the simple logic:

```typescript
const PROXY_SUFFIXES: Record<string, string> = {
  '.mp4': '-proxy.mp4', '.webm': '-proxy.mp4',
  '.aac': '-proxy.aac', '.mp3': '-proxy.aac', '.wav': '-proxy.aac', '.m4a': '-proxy.aac',
  '.png': '-proxy.webp', '.jpg': '-proxy.webp', '.jpeg': '-proxy.webp', '.webp': '-proxy.webp',
};

function deriveProxyKey(src: string): string | null {
  if (!src || src.includes('-proxy.')) return null;
  const ext = src.match(/\.\w+$/)?.[0];
  if (!ext || !PROXY_SUFFIXES[ext]) return null;
  return src.replace(/\.\w+$/, PROXY_SUFFIXES[ext]);
}
```

- [ ] **Step 3: Test — verify editor loads proxy files**

Open a project in the editor. In DevTools Network:
- Should see requests for `source-proxy.mp4`, `audio-proxy.aac`, `matte/scene-1-proxy.mp4`, `matte/scene-1-fgr-proxy.mp4`
- NOT full-res files

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx
git commit -m "feat: proxy workflow — generate/download/preload proxy files for editing"
```

---

### Task 9: Fix SandwichComposite to use resolveMediaSrc

**Files:**
- Modify: `packages/sandbox/template/src/composition/SandwichComposite.tsx`

- [ ] **Step 1: Read current SandwichComposite**

Read `packages/sandbox/template/src/composition/SandwichComposite.tsx`. Find its local `resolveSrc()` function (around line 163-168) that bypasses the assets map.

- [ ] **Step 2: Replace resolveSrc with resolveMediaSrc**

Add `assets` to the component props and replace `resolveSrc` with `resolveMediaSrc`:

```typescript
import { resolveMediaSrc } from '../items/resolveMediaSrc';

// In the component props interface, add:
assets?: Record<string, string>;

// Replace all resolveSrc(path) calls with:
resolveMediaSrc(path, assets || {})
```

- [ ] **Step 3: Update callers to pass assets**

In `PlayerComposition.tsx` or wherever `SandwichComposite` is used, pass the `assets` prop from the manifest.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/template/src/composition/SandwichComposite.tsx
git commit -m "refactor: SandwichComposite uses resolveMediaSrc for proxy/presigned URL support"
```

---

## Phase 3: Matte Compression

### Task 10: Separate matte encoder quality

**Files:**
- Modify: `packages/worker/scripts/segment_person.py:148-165,252-254`

- [ ] **Step 1: Read make_ffmpeg_encoder**

Read `packages/worker/scripts/segment_person.py` around lines 148-165. Note the shared QP 18 / CRF 18 for both matte and fgr.

- [ ] **Step 2: Add quality parameter to make_ffmpeg_encoder**

```python
def make_ffmpeg_encoder(output_path: str, w: int, h: int, fps_str: str, qp: int = 18):
    """Create an FFmpeg encoder subprocess for raw RGB24 → H.264 MP4."""
    if w <= 4096 and h <= 4096:
        try:
            enc_args = [
                'ffmpeg', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                '-s', f'{w}x{h}', '-r', fps_str,
                '-i', 'pipe:0',
                '-c:v', 'h264_nvenc', '-preset', 'p1',
                '-rc', 'constqp', f'-qp', str(qp),
                '-pix_fmt', 'yuv420p',
                output_path,
            ]
            # ... (rest unchanged)
        except FileNotFoundError:
            pass
    # libx264 fallback — map QP to CRF (roughly equivalent)
    crf = qp  # QP and CRF values are similar in scale
    enc_args = [
        'ffmpeg', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
        '-s', f'{w}x{h}', '-r', fps_str,
        '-i', 'pipe:0',
        '-c:v', 'libx264', '-preset', 'ultrafast', f'-crf', str(crf),
        '-pix_fmt', 'yuv420p',
        output_path,
    ]
    # ... (rest unchanged)
```

- [ ] **Step 3: Use different quality for matte vs fgr**

At lines 252-254, change:

```python
# Before:
encoder = make_ffmpeg_encoder(output_path, out_w, out_h, effective_fps_str)
fgr_encoder = make_ffmpeg_encoder(fgr_output_path, out_w, out_h, effective_fps_str)

# After:
encoder = make_ffmpeg_encoder(output_path, out_w, out_h, effective_fps_str, qp=24)      # matte: lower quality OK
fgr_encoder = make_ffmpeg_encoder(fgr_output_path, out_w, out_h, effective_fps_str, qp=21)  # fgr: moderate savings
```

- [ ] **Step 4: Test — run segmentation and compare file sizes**

Run segmentation. Compare output sizes:
- Matte should be ~50% smaller (14MB → ~7MB)
- FGR should be ~20-30% smaller (169MB → ~120MB)

- [ ] **Step 5: Commit**

```bash
git add packages/worker/scripts/segment_person.py
git commit -m "feat(segmentation): separate encoder quality for matte (QP 24) vs fgr (QP 21)"
```

---

## Phase 4: WebGL Matte Compositor

### Task 11: Replace MatteItem canvas2D with WebGL

**Files:**
- Modify: `packages/sandbox/template/src/items/MatteItem.tsx`

- [ ] **Step 1: Read current MatteItem**

Read `packages/sandbox/template/src/items/MatteItem.tsx` in full (110 lines).

- [ ] **Step 2: Rewrite with WebGL compositor**

Replace the entire component:

```tsx
import React, { useRef, useEffect, useCallback } from "react";
import { Video, useCurrentFrame, useVideoConfig } from "remotion";
import { resolveMediaSrc } from "./resolveMediaSrc";

interface MatteItemData {
  fgrSrc: string;
  matteSrc: string;
  startFrom?: number;
}

interface MatteItemProps {
  data: MatteItemData;
  assets: Record<string, string>;
}

const VERT_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAG_SHADER = `
precision mediump float;
uniform sampler2D uFgr;
uniform sampler2D uMatte;
varying vec2 vUv;
void main() {
  vec4 fgr = texture2D(uFgr, vUv);
  float alpha = texture2D(uMatte, vUv).r;
  gl_FragColor = vec4(fgr.rgb * alpha, alpha);
}`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function initWebGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true });
  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SHADER);

  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
  }

  const aPosition = gl.getAttribLocation(program, "aPosition");
  const uFgr = gl.getUniformLocation(program, "uFgr");
  const uMatte = gl.getUniformLocation(program, "uMatte");

  // Fullscreen quad
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  // Two video textures
  const createTex = () => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  };
  const fgrTex = createTex();
  const matteTex = createTex();

  // Y-flip for video textures
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // Enable blending for correct CSS compositing
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied alpha blending

  return { gl, program, aPosition, uFgr, uMatte, buf, fgrTex, matteTex };
}

export const MatteItem: React.FC<MatteItemProps> = React.memo(({ data, assets }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fgrVideoRef = useRef<HTMLVideoElement>(null);
  const matteVideoRef = useRef<HTMLVideoElement>(null);
  const glRef = useRef<ReturnType<typeof initWebGL>>(null);
  const lastTimeRef = useRef<number>(-1);

  const fgrSrc = resolveMediaSrc(data.fgrSrc, assets);
  const matteSrc = resolveMediaSrc(data.matteSrc, assets);
  const startFromFrames = Math.round(((data.startFrom ?? 0) / 1000) * fps);

  // Initialize WebGL on mount
  useEffect(() => {
    if (!canvasRef.current) return;
    glRef.current = initWebGL(canvasRef.current);
    if (!glRef.current) {
      console.warn("WebGL not available for MatteItem, falling back to canvas2D");
    }

    const canvas = canvasRef.current;
    const handleLost = (e: Event) => { e.preventDefault(); glRef.current = null; };
    const handleRestored = () => { glRef.current = initWebGL(canvas); };
    canvas.addEventListener("webglcontextlost", handleLost);
    canvas.addEventListener("webglcontextrestored", handleRestored);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
      glRef.current = null;
    };
  }, []);

  const doRender = useCallback(() => {
    const fgrVideo = fgrVideoRef.current;
    const matteVideo = matteVideoRef.current;
    if (!fgrVideo || !matteVideo) return;
    if (fgrVideo.readyState < 2 || matteVideo.readyState < 2) return;
    if (fgrVideo.currentTime === lastTimeRef.current) return;
    lastTimeRef.current = fgrVideo.currentTime;

    const ctx = glRef.current;
    if (!ctx) return; // WebGL unavailable — silent no-op (fallback could be added)

    const { gl, program, aPosition, uFgr, uMatte, buf, fgrTex, matteTex } = ctx;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // Update fgr texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fgrTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fgrVideo);
    gl.uniform1i(uFgr, 0);

    // Update matte texture
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, matteTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, matteVideo);
    gl.uniform1i(uMatte, 1);

    // Draw fullscreen quad
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [width, height]);

  useEffect(() => { doRender(); }, [frame, doRender]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <Video
        ref={fgrVideoRef}
        src={fgrSrc}
        startFrom={startFromFrames}
        crossOrigin="anonymous"
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        pauseWhenBuffering
        muted
        onLoadedData={doRender}
      />
      <Video
        ref={matteVideoRef}
        src={matteSrc}
        startFrom={startFromFrames}
        crossOrigin="anonymous"
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        pauseWhenBuffering
        muted
        onLoadedData={doRender}
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
});
```

- [ ] **Step 3: Test — open a depth-composited project**

Open project 06ad02a2 in the editor. The matte compositing should work without the black halo, with smooth playback. Check:
- Person cutout is visible (not upside down — Y-flip is handled)
- Transparent background works (layers below show through)
- No "SecurityError" in console (CORS is configured from Phase 1)
- Playback is smooth (no UI freezes)

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/template/src/items/MatteItem.tsx
git commit -m "feat: replace MatteItem canvas2D pixel loop with WebGL shader compositor"
```

---

## Phase 5: Zustand Transient Updates

### Task 12: Quick wins — getState() in handlers (6 components)

**Files:**
- Modify: `apps/web/src/features/editor-v2/scene/Scene.tsx:92`
- Modify: `apps/web/src/features/editor-v2/panels/StylePanel.tsx:53`
- Modify: `apps/web/src/features/editor-v2/components/keyframe-editor/KeyframeList.tsx:54`
- Modify: `apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts:81`
- Modify: `apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx:93`
- Modify: `apps/web/src/features/editor-v2/timeline/TimelineRuler.tsx:63`

- [ ] **Step 1: Fix Scene.tsx**

Read `apps/web/src/features/editor-v2/scene/Scene.tsx`. At line 92, it subscribes:
```typescript
const currentTimeMs = useCurrentTimeMs();
```

Remove this subscription. Wherever `currentTimeMs` is used (lines 123-135, 150), replace with:
```typescript
const currentTimeMs = useEditorStore.getState().currentTimeMs;
```
Inside the click handler (which is the only place it's used). This eliminates the per-frame re-render of the entire Scene component.

- [ ] **Step 2: Fix StylePanel.tsx**

Read `apps/web/src/features/editor-v2/panels/StylePanel.tsx:53`. Replace `useCurrentTimeMs()` subscription with `useEditorStore.getState().currentTimeMs` inside the callback that uses it.

- [ ] **Step 3: Fix KeyframeList.tsx**

Read `apps/web/src/features/editor-v2/components/keyframe-editor/KeyframeList.tsx:54`. Same pattern — `getState()` inside the "add keyframe" handler.

- [ ] **Step 4: Fix use-keyboard-shortcuts.ts**

Read `apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts:81`. Replace subscription with `getState()` inside keydown handlers.

- [ ] **Step 5: Fix ContextMenu.tsx**

Read `apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx:93`. Replace subscription with `getState()` inside action callbacks.

- [ ] **Step 6: Fix TimelineRuler.tsx**

Read `apps/web/src/features/editor-v2/timeline/TimelineRuler.tsx:63`. Remove `currentTimeMs` from `useEffect` dependency array if it's not used in the draw code.

- [ ] **Step 7: Test — verify no re-renders during playback**

Open React DevTools Profiler. Play video. These 6 components should NOT show up in the flame chart during playback. Before this fix, they would appear every frame (~33ms intervals).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/editor-v2/scene/Scene.tsx apps/web/src/features/editor-v2/panels/StylePanel.tsx apps/web/src/features/editor-v2/components/keyframe-editor/KeyframeList.tsx apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx apps/web/src/features/editor-v2/timeline/TimelineRuler.tsx
git commit -m "perf: eliminate 6 unnecessary per-frame re-renders via getState() in handlers"
```

---

### Task 13: Subscribe + ref for Playhead and PlaybackBar

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/Playhead.tsx`
- Modify: `apps/web/src/features/editor-v2/components/PlaybackBar.tsx`

- [ ] **Step 1: Read Playhead.tsx**

Read `apps/web/src/features/editor-v2/timeline/Playhead.tsx`. Find how it uses `currentTimeMs` to position the playhead element.

- [ ] **Step 2: Convert Playhead to subscribe + ref**

Replace the React re-render pattern with direct DOM mutation:

```tsx
const playheadRef = useRef<HTMLDivElement>(null);

// Remove: const currentTimeMs = useCurrentTimeMs();

useEffect(() => {
  return useEditorStore.subscribe(
    (state) => state.currentTimeMs,
    (timeMs) => {
      if (playheadRef.current) {
        const x = timeMs * pxPerMs; // pxPerMs from timeline zoom context
        playheadRef.current.style.transform = `translateX(${x}px)`;
      }
    }
  );
}, [pxPerMs]);
```

- [ ] **Step 3: Convert PlaybackBar similarly**

Read `apps/web/src/features/editor-v2/components/PlaybackBar.tsx`. Apply the same subscribe + ref pattern for the time display and progress bar width.

- [ ] **Step 4: Test — verify smooth playhead movement without re-renders**

Play video. Playhead should move smoothly. React DevTools Profiler should NOT show Playhead or PlaybackBar re-rendering.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/Playhead.tsx apps/web/src/features/editor-v2/components/PlaybackBar.tsx
git commit -m "perf: Playhead and PlaybackBar use subscribe+ref instead of React re-renders"
```

---

### Task 14: Memoize PlayerComposition and ItemRenderer

**Files:**
- Modify: `packages/sandbox/template/src/PlayerComposition.tsx`

- [ ] **Step 1: Read PlayerComposition**

Read `packages/sandbox/template/src/PlayerComposition.tsx`. Note:
- `PlayerComposition` is a plain `React.FC` (not memoized)
- `ItemRenderer` is a plain function component (not memoized)
- `sortedTracks` and `trackItems` create new arrays every render

- [ ] **Step 2: Wrap both in React.memo and memoize arrays**

```tsx
// At the top of the file, add useMemo import
import React, { useMemo } from 'react';

// Wrap PlayerComposition
export const PlayerComposition: React.FC<Props> = React.memo(({ manifest }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const { canvas, captionPreset } = manifest;
  const items = manifest.items || [];
  const assets = manifest.assets || {};

  const sortedTracks = useMemo(
    () => [...(manifest.tracks || [])].sort((a, b) => a.position - b.position),
    [manifest.tracks]
  );

  // ... rest of render
});

// Wrap ItemRenderer
const ItemRenderer: React.FC<ItemRendererProps> = React.memo(({ item, assets, fps, durationInFrames, canvas, captionPreset }) => {
  // ... existing switch/case
});
```

- [ ] **Step 3: Test — verify fewer re-renders on manifest changes**

Edit an item in the editor (move, resize). React DevTools Profiler should show only the changed item re-rendering, not the entire composition tree.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/template/src/PlayerComposition.tsx
git commit -m "perf: memoize PlayerComposition and ItemRenderer, useMemo for track sorting"
```

---

### Task 15: Conditional subscriptions for remaining components

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx`
- Modify: `apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx`
- Modify: `apps/web/src/features/editor-v2/components/PreviewControls.tsx`

- [ ] **Step 1: Fix ItemDragOverlay**

Read `apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx:98`. Guard the `currentTimeMs` subscription on whether a drag is active:

```tsx
// Only subscribe when actively dragging a keyframed item
const isDragging = useEditorStore((s) => !!s.dragState);
const currentTimeMs = isDragging ? useEditorStore((s) => s.currentTimeMs) : 0;
```

Or better: use `getState()` inside the drag handler callbacks.

- [ ] **Step 2: Fix TranscriptPanel**

Read `apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx:39`. Instead of subscribing to raw `currentTimeMs`, subscribe to a derived value (active word index) that only changes at word boundaries:

```tsx
const activeWordIndex = useEditorStore((state) => {
  // Only re-render when the active word changes, not every frame
  const timeMs = state.currentTimeMs;
  return state.transcript?.words?.findIndex(
    (w) => w.startMs <= timeMs && w.endMs >= timeMs
  ) ?? -1;
});
```

- [ ] **Step 3: Fix PreviewControls**

Read `apps/web/src/features/editor-v2/components/PreviewControls.tsx:50`. Use subscribe + ref for the timecode display, `getState()` for button handlers.

- [ ] **Step 4: Test**

Play video. These components should NOT re-render every frame in React DevTools Profiler.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx apps/web/src/features/editor-v2/components/PreviewControls.tsx
git commit -m "perf: conditional/derived subscriptions for remaining high-frequency components"
```
