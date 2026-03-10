# Worker Package Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Organize, standardize, and improve readability of `packages/worker` through moderate decomposition of large processors, prompt consolidation, barrel exports, and consistency fixes.

**Architecture:** Break 4 large processors (render, generate-visuals, edit-visuals, svg-animation) into sub-module folders. Consolidate all prompts under `src/prompts/`. Add barrel `index.ts` to every folder. Fix import inconsistencies.

**Tech Stack:** TypeScript, BullMQ, Remotion, Drizzle ORM, Python (prompts)

---

### Task 1: Fix import inconsistencies

**Files:**
- Modify: `packages/worker/src/workspace.ts`

**Step 1: Fix missing .js extension**

In `workspace.ts`, find the import on line 11:
```typescript
import { config } from './config';
```
Change to:
```typescript
import { config } from './config.js';
```

**Step 2: Scan for any other missing .js extensions**

Run: `cd packages/worker && grep -rn "from '\.\." src/ | grep -v "\.js'" | grep -v "\.py" | grep -v node_modules | grep -v ".d.ts"`

Fix any other occurrences found.

**Step 3: Commit**

```bash
git add packages/worker/src/workspace.ts
git commit -m "fix(worker): add missing .js extensions to ESM imports"
```

---

### Task 2: Decompose `render.ts` into `processors/render/`

**Files:**
- Create: `packages/worker/src/processors/render/types.ts`
- Create: `packages/worker/src/processors/render/fonts.ts`
- Create: `packages/worker/src/processors/render/subtitles.ts`
- Create: `packages/worker/src/processors/render/ffmpeg.ts`
- Create: `packages/worker/src/processors/render/index.ts`
- Delete: `packages/worker/src/processors/render.ts`
- Move: `packages/worker/src/processors/render.test.ts` → `packages/worker/src/processors/render/render.test.ts`

**Decomposition map** (from render.ts, 4514 lines):

**types.ts** — All interfaces and type aliases:
- `LayoutSettings` (line 674-697)
- `FullscreenSegment` (line 706-709)
- `VideoCropSettings` (line 712-718)
- `DisplayModeSegment` (line 764-770)
- `SegmentationData` (line 775-779)
- `RenderJobData` (line 814-837) — exported
- `VideoAssetEntry` (line 509-518)
- `VideoManifest` (line 520-522)
- `VideoClipOverride` (line 535-540)
- `RenderRemotionOptions` (line 2041-2046)
- `AddAudioAndSubtitlesOptions` (line 2541-2551)
- `RenderWithPiPLayoutOptions` (line 2655-2676)
- `FinalizeRemotionVideoOptions` (line 3343-3354)
- `CompositeFullVideoOptions` (line 3466-3477)
- `OverlayZone` type (line 773)
- Constants: `PIP_SIZE_MAP` (line 699-704), `YOUTUBE_URL_PATTERNS` (line 23-28)

**fonts.ts** — Font downloading, caching, metrics:
- `GOOGLE_FONT_URLS` constant (line 71-202)
- `FONT_FALLBACKS` constant
- `SYSTEM_FONTS_DIR`, `LOCAL_FONTS_CACHE` constants
- `downloadedFonts` Set (line 205)
- `resolveAvailableFontFamily()` (line 212-224) — exported
- `downloadFont()` (line 231-299)
- `readTTFMetrics()` (line 310-344)
- `getASSFontSizeMultiplier()` (line 351-427)
- `ensureFontsDir()` (line 433-501)
- `detectFontsInBundle()` (line 2185-2219)
- `injectGoogleFontsIntoBundle()` (line 2225-2243)

**subtitles.ts** — ASS subtitle generation:
- `convertToSubtitles()` (line 1782-1797) — exported
- `formatASSTime()` (line 2027-2035) — exported
- `hexToASSColor()` (line 3623-3656) — exported
- `getASSAlignment()` (line 3664-3670) — exported
- `generateASSSubtitles()` (line 1993-2025)
- `generateASSForComposite()` (line 3678-4420) — the big 743-line function
- Imports from: `fonts.ts` (resolveAvailableFontFamily)

**ffmpeg.ts** — All FFmpeg/video operations:
- `escapePathForFilter()` (line 53-64) — exported
- `buildVideoCropFilter()` (line 725-762) — exported
- `copyVideo()` (line 1799-1839)
- `encodeVideoWithAudio()` (line 1841-1908)
- `renderSubtitlesWithFFmpeg()` (line 1911-1991)
- `compositeVideos()` (line 2358-2459)
- `renderRemotionOnly()` (line 2465-2539)
- `addAudioAndSubtitles()` (line 2557-2653)
- `renderWithPiPLayout()` (line 2684-3341)
- `finalizeRemotionVideo()` (line 3360-3464)
- `compositeFullVideo()` (line 3483-3620)
- `encodeVideoWithSubtitles()` (line 4426-4514)
- Remotion bundle functions:
  - `ensureBundleExists()` (line 2052-2095)
  - `rebuildBundleFromCJS()` (line 2101-2179)
  - `renderWithRemotion()` (line 2250-2352)
- Video clip download functions:
  - `isValidYouTubeUrl()` (line 30-32)
  - `formatTimestamp()` (line 527-532)
  - `downloadVideoClipsForRender()` (line 547-672)
- Layout utilities:
  - `hasZoneBasedVisuals()` (line 784-789)
  - `groupVisualsByZone()` (line 794-812)
- Imports from: `subtitles.ts` (generateASSForComposite), `fonts.ts` (ensureFontsDir, detectFontsInBundle, injectGoogleFontsIntoBundle), `types.ts`

**index.ts** — Main orchestration + re-exports:
- `processRenderJob()` (line 839-1780) — the main entry point
- Re-exports all public API: `RenderJobData`, `convertToSubtitles`, `formatASSTime`, `hexToASSColor`, `getASSAlignment`, `escapePathForFilter`, `buildVideoCropFilter`, `resolveAvailableFontFamily`
- Imports from: all sibling modules

**Step 1:** Create the `render/` directory and all 5 files, moving code by the groups above. Keep all internal function signatures identical.

**Step 2:** Update `render/index.ts` to import from siblings and re-export the public API so that `import { processRenderJob } from './processors/render.js'` still works.

**Step 3:** Move `render.test.ts` to `render/render.test.ts`, update any imports.

**Step 4:** Delete the old `render.ts`.

**Step 5:** Verify the main `index.ts` import still works:
```typescript
// packages/worker/src/index.ts should import from:
import { processRenderJob } from './processors/render/index.js';
// or simply:
import { processRenderJob } from './processors/render.js';
```

**Step 6:** Run typecheck
```bash
cd packages/worker && pnpm typecheck
```

**Step 7: Commit**
```bash
git add packages/worker/src/processors/render/ packages/worker/src/processors/render.ts
git commit -m "refactor(worker): decompose render.ts into render/ sub-module"
```

---

### Task 3: Decompose `generate-visuals.ts` into `processors/generate-visuals/`

**Files:**
- Create: `packages/worker/src/processors/generate-visuals/types.ts`
- Create: `packages/worker/src/processors/generate-visuals/validation.ts`
- Create: `packages/worker/src/processors/generate-visuals/subprocess.ts`
- Create: `packages/worker/src/processors/generate-visuals/storage.ts`
- Create: `packages/worker/src/processors/generate-visuals/index.ts`
- Delete: `packages/worker/src/processors/generate-visuals.ts`
- Move: `packages/worker/src/processors/generate-visuals.test.ts` → `generate-visuals/generate-visuals.test.ts`

**Decomposition map** (from generate-visuals.ts, 1700 lines):

**types.ts** — All interfaces and types:
- `HeadTrackingFrame` (line 69-72)
- `SpeakerGrid` (line 74-78)
- `ExtractedAsset` (line 208-217)
- `VisualsLayoutMode` (line 440)
- `VisualsDimensions` (line 442-445)
- `VideoSelection` (line 452-458)
- `GenerateVisualsJobData` (line 460-476) — exported
- `VisualMetadata` (line 478-495)
- `JobMetrics` (line 497-508)
- `ClaudeCodeResult` (line 510-516)
- `VideoAssetEntry` (line 565-575)
- `VideoManifest` (line 577-579)
- `ClaudeCodeOptions` (line 1361-1382)

**validation.ts** — Pre-processing and validation helpers:
- `findPackagesRoot()` (line 36-45)
- `copyDirRecursive()` (line 50-63)
- `computeSpeakerGrid()` (line 87-203)
- `extractAssets()` (line 223-298)
- `injectUserAssets()` (line 522-560)
- `prepareVideoAssets()` (line 585-633)

**storage.ts** — S3 upload functions:
- `uploadBundleToStorage()` (line 380-400)
- `uploadSourceToStorage()` (line 416-438)

**subprocess.ts** — Claude Code subprocess management:
- `runningProcesses` Map (line 30)
- `validateEnvironment()` (line 308-359) — exported
- `cancelJob()` (line 361-370) — exported
- `getRunningJobs()` (line 372-374) — exported
- `runClaudeCodeGenerator()` (line 1390-1700)

**index.ts** — Main orchestration + re-exports:
- `RemotionRoot` component (line 835-848) — exported
- `processGenerateVisualsJob()` (line 635-1354) — main entry
- Re-exports: `GenerateVisualsJobData`, `validateEnvironment`, `cancelJob`, `getRunningJobs`

**Steps:** Same pattern as Task 2 — create directory, move code, update imports, delete old file, typecheck, commit.

```bash
git commit -m "refactor(worker): decompose generate-visuals.ts into sub-module"
```

---

### Task 4: Decompose `edit-visuals.ts` into `processors/edit-visuals/`

**Files:**
- Create: `packages/worker/src/processors/edit-visuals/types.ts`
- Create: `packages/worker/src/processors/edit-visuals/context.ts`
- Create: `packages/worker/src/processors/edit-visuals/editor.ts`
- Create: `packages/worker/src/processors/edit-visuals/build.ts`
- Create: `packages/worker/src/processors/edit-visuals/index.ts`
- Delete: `packages/worker/src/processors/edit-visuals.ts`

**Decomposition map** (from edit-visuals.ts, ~1000 lines):

**types.ts** — Interfaces:
- `ExtractedAsset` (line 34-43)
- `EditVisualsJobData` (line 214-223) — exported
- `ClaudeEditorOptions` (line 698-710)
- `ClaudeEditorResult` (line 712-715)

**context.ts** — Scene/layout/asset context building:
- `extractAssets()` (line 49-104)
- `buildLayoutContext()` (line 111-160)
- `buildRulesForMode()` (line 162-212)
- `injectUserAssets()` (line 372-408)

**editor.ts** — Claude subprocess interface:
- `runningProcesses` Map (line 29)
- `runClaudeEditor()` (line 723-993)

**build.ts** — Compilation and storage:
- `compileCjs()` (line 277-314)
- `autoFixProjectFiles()` (line 320-367)
- `uploadBundleToStorage()` (line 228-246)
- `uploadSourceToStorage()` (line 251-271)

**index.ts** — Main flow + re-exports:
- `processEditVisualsJob()` (line 410-696) — main entry
- Re-exports: `EditVisualsJobData`

**Steps:** Same pattern. Typecheck, commit.

```bash
git commit -m "refactor(worker): decompose edit-visuals.ts into sub-module"
```

---

### Task 5: Decompose `svg-animation.ts` into `processors/svg-animation/`

**Files:**
- Create: `packages/worker/src/processors/svg-animation/types.ts`
- Create: `packages/worker/src/processors/svg-animation/converter.ts`
- Create: `packages/worker/src/processors/svg-animation/components.ts`
- Create: `packages/worker/src/processors/svg-animation/build.ts`
- Create: `packages/worker/src/processors/svg-animation/index.ts`
- Delete: `packages/worker/src/processors/svg-animation.ts`

**Decomposition map** (from svg-animation.ts, ~1200 lines):

**types.ts** — Interfaces:
- `SvgAnimationJobData` (line 121-135) — exported
- `SvgAnimationMetadata` (line 137-143) — exported

**converter.ts** — Image-to-SVG conversion:
- `extractSearchKeywords()` (line 35-59)
- `findTimestampInTranscript()` (line 64-119)
- `convertImageToSvg()` (line 196-275)

**components.ts** — Remotion component generation:
- `generateAnimatedComposition()` (line 388-456)
- `generateImageAnimatedComposition()` (line 280-340)
- `generateIndexTsx()` (line 503-540)
- `generateImageIndexTsx()` (line 345-382)
- `generateSvgAnimationComponent()` (line 545-562)
- `generateDrawAnimationComponent()` (line 567-649)
- `generateMotionAnimationComponent()` (line 654-734)
- `generateImageAnimationComponent()` (line 740-830)
- `updateRootTsx()` (line 461-498)

**build.ts** — Compilation and storage:
- `compileCjs()` (line 835-869)
- `bundleComposition()` (line 874-927)
- `uploadBundleToStorage()` (line 148-166)
- `uploadSourceToStorage()` (line 171-191)

**index.ts** — Main flow + re-exports:
- `processSvgAnimationJob()` (line 929-1199) — main entry
- Re-exports: `SvgAnimationJobData`, `SvgAnimationMetadata`

**Steps:** Same pattern. Typecheck, commit.

```bash
git commit -m "refactor(worker): decompose svg-animation.ts into sub-module"
```

---

### Task 6: Consolidate prompts into `src/prompts/`

**Files:**
- Move: `packages/worker/src/agents/prompts/_loader.py` → `packages/worker/src/prompts/_loader.py`
- Move: `packages/worker/src/agents/prompts/animator.py` → `packages/worker/src/prompts/animator/animator.py`
- Move: `packages/worker/src/agents/prompts/director.py` → `packages/worker/src/prompts/director/director.py`
- Move: `packages/worker/src/agents/prompts/assistant_director.py` → `packages/worker/src/prompts/assistant-director/assistant_director.py`
- Move: `packages/worker/src/agents/prompts/_themes.py` → `packages/worker/src/prompts/_themes.py`
- Move: `packages/worker/src/agents/prompts/__init__.py` → `packages/worker/src/prompts/__init__.py`
- Create: `packages/worker/src/prompts/loader.ts` (TypeScript loader — currently missing, imported by `generate-visuals.ts` and `visual-references.ts`)
- Delete: duplicate `packages/worker/src/prompts/loader.py` (if it duplicates `_loader.py`)

**Step 1:** Move all Python prompt files to their new locations under `src/prompts/`.

**Step 2:** Update Python import paths in:
- `packages/worker/src/agents/claude_visual_generator.py` — update `from prompts.animator import ...` to new path
- `packages/worker/src/agents/visual_director.py` — same
- Any other Python files that import from `agents.prompts`

**Step 3:** Update `_loader.py` to resolve paths correctly from new location.

**Step 4:** Create `packages/worker/src/prompts/loader.ts`:
```typescript
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cache: Record<string, string> = {};

export function loadPrompt(name: string): string {
  if (name in cache) return cache[name];
  const path = join(__dirname, `${name}.md`);
  const content = readFileSync(path, 'utf-8');
  cache[name] = content;
  return content;
}

export function loadTemplate(name: string, variables?: Record<string, string | number>): string {
  const raw = loadPrompt(name);
  if (!variables) return raw;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key) => String(variables[key] ?? `{{${key}}}`));
}
```

**Step 5:** Verify Python imports still work:
```bash
cd packages/worker && python -c "from src.prompts.animator.animator import ANIMATOR_SYSTEM_PROMPT; print('OK')"
```

**Step 6:** Run typecheck:
```bash
cd packages/worker && pnpm typecheck
```

**Step 7: Commit**
```bash
git commit -m "refactor(worker): consolidate all prompts under src/prompts/"
```

---

### Task 7: Add barrel exports to all folders

**Files:**
- Create: `packages/worker/src/processors/index.ts`
- Create: `packages/worker/src/services/index.ts`
- Create: `packages/worker/src/utils/index.ts`
- Create: `packages/worker/src/types/index.ts`
- Create: `packages/worker/src/prompts/index.ts`
- Create barrel `index.ts` in each sub-module folder created in Tasks 2-5

**Step 1:** Create `processors/index.ts`:
```typescript
export { processRenderJob } from './render/index.js';
export type { RenderJobData } from './render/index.js';
export { processGenerateVisualsJob, validateEnvironment, cancelJob, getRunningJobs } from './generate-visuals/index.js';
export type { GenerateVisualsJobData } from './generate-visuals/index.js';
export { processEditVisualsJob } from './edit-visuals/index.js';
export type { EditVisualsJobData } from './edit-visuals/index.js';
export { processSvgAnimationJob } from './svg-animation/index.js';
export type { SvgAnimationJobData } from './svg-animation/index.js';
export { processTranscribeJob } from './transcribe.js';
export { processHeadTrackingJob } from './head-tracking.js';
export { processPreloadProjectJob } from './preload-project.js';
export { processGenerateReframeJob } from './generate-reframe.js';
export { processGenerateCaptionStylesJob } from './generate-caption-styles.js';
export { processSegmentationJob } from './segmentation.js';
export { processYoutubeClipJob } from './youtube-clip.js';
export { processPlanVisualsJob } from './plan-visuals.js';
```

**Step 2:** Create `services/index.ts`:
```typescript
export * from './redis.js';
export * from './minio.js';
export * from './freepik.js';
export * from './iconify.js';
export * from './image-fetcher.js';
```

**Step 3:** Create `utils/index.ts`:
```typescript
export * from './template.js';
export * from './python.js';
export * from './redis.js';
export * from './heartbeat-progress.js';
```

**Step 4:** Create `types/index.ts`:
```typescript
export * from './renderer.js';
```

**Step 5:** Create `prompts/index.ts`:
```typescript
export { loadPrompt, loadTemplate } from './loader.js';
export * from './generate-visuals.js';
export * from './visual-references.js';
export * from './studio-templates.js';
```

**Step 6:** Optionally update `src/index.ts` to use barrel imports where it makes sense (don't change working import paths if they're already correct).

**Step 7:** Run typecheck:
```bash
cd packages/worker && pnpm typecheck
```

**Step 8: Commit**
```bash
git commit -m "refactor(worker): add barrel index.ts exports to all folders"
```

---

### Task 8: Clean up dead references and final polish

**Files:**
- Modify: `packages/worker/src/services/image-fetcher.ts` (check for pexels references)
- Modify: `packages/worker/src/config.ts` (remove pexels config if service is deleted)
- Modify: `packages/worker/README.md` (update file structure to reflect new layout)

**Step 1:** Check `image-fetcher.ts` for references to deleted `pexels.ts` service. Remove or update.

**Step 2:** Check if `config.pexels` is still used anywhere. If not, remove from `config.ts`.

**Step 3:** Update README.md directory structure to reflect the new folder layout.

**Step 4:** Run full typecheck:
```bash
cd packages/worker && pnpm typecheck
```

**Step 5:** Run tests:
```bash
cd packages/worker && pnpm test
```

**Step 6: Commit**
```bash
git commit -m "chore(worker): clean up dead references and update README"
```

---

## Execution Order

Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (sequential — each builds on the previous)

Tasks 2-5 (processor decompositions) could theoretically run in parallel if using worktrees, but sequential is safer since they share the same `index.ts` import surface.
