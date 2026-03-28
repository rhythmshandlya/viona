# V2 Migration Cleanup — Dead Code Deletion

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all deprecated worker processors (generate-visuals, edit-visuals, plan-visuals, render), their API routes, queue definitions, shared types, and frontend API methods — leaving only the sandbox-based pipeline and active utility workers.

**Architecture:** The sandbox now handles all creative work (visual generation, editing, rendering). The worker retains only utility jobs: transcribe, head-tracking, generate-reframe, generate-caption-styles, svg-animation, preload-project, youtube-clip. This plan deletes everything that dispatched to the old pipeline.

**Tech Stack:** TypeScript, BullMQ, Fastify, Next.js, Zustand

**Scope note:** This plan covers dead code deletion only. The frontend store refactor (eliminating manifest-bridge.ts, replacing store/types.ts with manifest v2 types) is a separate, larger effort that should be planned after this cleanup is complete.

---

## File Structure

### Files to DELETE entirely:
- `packages/worker/src/processors/generate-visuals/` (9 files — entire directory)
- `packages/worker/src/processors/edit-visuals/` (5 files — entire directory)
- `packages/worker/src/processors/render/` (5 files — entire directory)
- `packages/worker/src/processors/plan-visuals.ts`
- `packages/worker/src/processors/segmentation.ts`
- `packages/worker/src/processors/segmentation.test.ts`
- `packages/worker/src/processors/effective-dimensions.test.ts` (tests deprecated layout logic)
- `packages/worker/src/services/image-fetcher.ts` (only used by generate-visuals)
- `packages/worker/src/services/freepik.ts` (only used by generate-visuals MCP tools)
- `packages/worker/src/services/pexels.ts` (only used by generate-visuals MCP tools)
- `packages/worker/src/services/iconify.ts` (imports from freepik.ts, only used by plan-visuals)
- `packages/worker/src/monitor/` (entire directory — only used by generate-visuals subprocess)
- `packages/worker/src/utils/template.ts` (already staged for deletion)
- `packages/shared/src/queue-types.ts` (all types deprecated)
- `apps/web/src/store/use-reelify-store.ts` (legacy v1 store, dead code)
- `apps/web/src/lib/project-converter.ts` (only imported by use-reelify-store.ts)

### Files to MODIFY:
- `packages/worker/src/index.ts` — Remove 4 deprecated worker registrations + imports + env check
- `packages/worker/src/processors/index.ts` — Remove deprecated exports
- `packages/worker/src/services/index.ts` — Remove re-exports of deleted services
- `packages/worker/src/config.ts` — Remove `claudeAgent` config block and stock API keys (keep `remotion` — used by svg-animation)
- `packages/api/src/services/queue.ts` — Remove deprecated queue definitions + imports
- `packages/api/src/routes/projects.ts` — Remove 3 deprecated route handlers + imports
- `packages/shared/src/index.ts` — Remove queue-types re-export
- `packages/shared/tsup.config.ts` — Remove queue-types from build entry points
- `apps/web/src/lib/api.ts` — Remove deprecated API client methods + splitVisualScene
- `apps/web/src/features/editor-v2/components/ExportModal.tsx` — Note: render call needs future sandbox replacement
- `apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx` — Remove dead type imports

---

## Task 1: Delete Deprecated Worker Processors

**Files:**
- Delete: `packages/worker/src/processors/generate-visuals/` (entire directory)
- Delete: `packages/worker/src/processors/edit-visuals/` (entire directory)
- Delete: `packages/worker/src/processors/render/` (entire directory)
- Delete: `packages/worker/src/processors/plan-visuals.ts`
- Delete: `packages/worker/src/processors/segmentation.ts`
- Delete: `packages/worker/src/processors/segmentation.test.ts`
- Delete: `packages/worker/src/processors/effective-dimensions.test.ts`

- [ ] **Step 1: Delete generate-visuals directory**

```bash
rm -rf packages/worker/src/processors/generate-visuals
```

Contains: `index.ts`, `subprocess.ts`, `storage.ts`, `types.ts`, `validation.ts`, `template-resolver.ts`, `resolve-templates-cli.ts`, `visual-progress-mapper.ts`, `generate-visuals.test.ts`

- [ ] **Step 2: Delete edit-visuals directory**

```bash
rm -rf packages/worker/src/processors/edit-visuals
```

Contains: `index.ts`, `editor.ts`, `context.ts`, `types.ts`, `build.ts`

- [ ] **Step 3: Delete render directory**

```bash
rm -rf packages/worker/src/processors/render
```

Contains: `index.ts`, `ffmpeg.ts`, `fonts.ts`, `types.ts`, `render.test.ts`

- [ ] **Step 4: Delete standalone deprecated processors**

```bash
rm packages/worker/src/processors/plan-visuals.ts
rm packages/worker/src/processors/segmentation.ts
rm packages/worker/src/processors/segmentation.test.ts
rm packages/worker/src/processors/effective-dimensions.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A packages/worker/src/processors/
git commit -m "$(cat <<'EOF'
chore(worker): delete deprecated processors

Remove generate-visuals, edit-visuals, plan-visuals, render, and
segmentation processors. All creative work now handled by sandbox.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Delete Deprecated Worker Services, Monitor, and Utils

**Files:**
- Delete: `packages/worker/src/services/image-fetcher.ts`
- Delete: `packages/worker/src/services/freepik.ts`
- Delete: `packages/worker/src/services/pexels.ts`
- Delete: `packages/worker/src/services/iconify.ts` (imports from freepik.ts)
- Delete: `packages/worker/src/monitor/` (entire directory — only used by generate-visuals subprocess)
- Delete: `packages/worker/src/utils/template.ts`
- Modify: `packages/worker/src/services/index.ts` (remove re-exports of deleted files)

- [ ] **Step 1: Verify these services are only used by deleted processors**

```bash
cd packages/worker && grep -r "image-fetcher\|freepik\|pexels\|iconify" src/ --include="*.ts" | grep -v "node_modules" | grep -v "services/image-fetcher\|services/freepik\|services/pexels\|services/iconify\|services/index"
```

Expected: No references outside the deleted processor directories (which were already deleted in Task 1).

Also verify monitor/ and template.ts:
```bash
grep -r "monitor/\|utils/template" src/ --include="*.ts" | grep -v "node_modules" | grep -v "monitor/"
```

Expected: No references.

- [ ] **Step 2: Delete the files and directory**

```bash
rm packages/worker/src/services/image-fetcher.ts
rm packages/worker/src/services/freepik.ts
rm packages/worker/src/services/pexels.ts
rm packages/worker/src/services/iconify.ts
rm -rf packages/worker/src/monitor
rm packages/worker/src/utils/template.ts
```

- [ ] **Step 3: Clean up `packages/worker/src/services/index.ts`**

Remove re-exports of deleted services (freepik, iconify, image-fetcher, pexels). Keep only exports for `redis.ts` and `minio.ts`.

- [ ] **Step 4: Commit**

```bash
git add -A packages/worker/src/services/ packages/worker/src/utils/ packages/worker/src/monitor/
git commit -m "$(cat <<'EOF'
chore(worker): delete deprecated services, monitor, and utils

Remove image-fetcher, freepik, pexels, iconify services (only used by
deleted generate-visuals processor), monitor/ directory (subprocess
monitoring for deleted pipeline), and template util.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Clean Up Worker Index and Processor Exports

**Files:**
- Modify: `packages/worker/src/index.ts`
- Modify: `packages/worker/src/processors/index.ts`

- [ ] **Step 1: Update `packages/worker/src/index.ts`**

Remove these imports (lines 5, 7-8, 11):
```typescript
import { processRenderJob, RenderJobData } from './processors/render/index.js';
import { processGenerateVisualsJob, GenerateVisualsJobData, validateEnvironment } from './processors/generate-visuals/index.js';
import { processEditVisualsJob, EditVisualsJobData } from './processors/edit-visuals/index.js';
import { processPlanVisualsJob, PlanVisualsJobData } from './processors/plan-visuals.js';
```

Remove the environment validation block (lines 35-41):
```typescript
  const envCheck = await validateEnvironment();
  if (!envCheck.valid) {
    logger.warn({ error: envCheck.error }, 'Visual generation environment not configured - generate-visuals jobs will fail');
  } else {
    logger.info('Visual generation environment validated');
  }
```

Remove the CLAUDE_CODE_OAUTH_TOKEN warning (lines 31-33):
```typescript
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    logger.warn('CLAUDE_CODE_OAUTH_TOKEN not set — visual generation will not work in production. Run `claude setup-token` to generate one.');
  }
```

Remove these worker registrations:
- `renderWorker` (lines 94-114) — render queue worker + event handlers
- `generateVisualsWorker` (lines 117-147) — generate-visuals queue worker + event handlers
- `planVisualsWorker` (lines 150-179) — plan-visuals queue worker + event handlers
- `editVisualsWorker` (lines 182-211) — edit-visuals queue worker + event handlers

Update `allWorkers` array (line 346-352) to remove the 4 deleted workers:
```typescript
  const allWorkers = [
    transcribeWorker,
    svgAnimationWorker, preloadProjectWorker,
    headTrackingWorker, generateReframeWorker, generateCaptionStylesWorker,
    youtubeClipWorker,
  ];
```

- [ ] **Step 2: Update `packages/worker/src/processors/index.ts`**

Remove these lines:
```typescript
export { processRenderJob } from './render/index.js';
export type { RenderJobData } from './render/index.js';

export { processGenerateVisualsJob, validateEnvironment, cancelJob, getRunningJobs } from './generate-visuals/index.js';
export type { GenerateVisualsJobData } from './generate-visuals/index.js';

export { processEditVisualsJob } from './edit-visuals/index.js';
export type { EditVisualsJobData } from './edit-visuals/index.js';

export { processPlanVisualsJob, cancelPlanJob } from './plan-visuals.js';
export type { PlanVisualsJobData } from './plan-visuals.js';

export { processSegmentation } from './segmentation.js';
export type { SegmentationJobData, FaceBbox, SegmentationResult } from './segmentation.js';
```

Keep:
```typescript
export { processSvgAnimationJob } from './svg-animation/index.js';
export type { SvgAnimationJobData, SvgAnimationMetadata } from './svg-animation/index.js';

export { processGenerateCaptionStylesJob } from './generate-caption-styles.js';
export type { GenerateCaptionStylesJobData } from './generate-caption-styles.js';

export { processGenerateReframeJob } from './generate-reframe.js';
export type { GenerateReframeJobData } from './generate-reframe.js';

export { processHeadTrackingJob } from './head-tracking.js';
export type { HeadTrackingJobData } from './head-tracking.js';

export { processPreloadProjectJob } from './preload-project.js';
export type { PreloadProjectJobData } from './preload-project.js';

export { processTranscribeJob, mapWordTypeToOverrides } from './transcribe.js';
export type { TranscribeJobData, PerWordStyleOverrides, WordTier } from './transcribe.js';

export { processYouTubeClipJob } from './youtube-clip.js';
export type { YouTubeClipJobData, ClipResult } from './youtube-clip.js';
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/worker && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors related to deleted processors.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/index.ts packages/worker/src/processors/index.ts
git commit -m "$(cat <<'EOF'
chore(worker): remove deprecated processor registrations and exports

Clean up index.ts and processors/index.ts to remove references to
deleted generate-visuals, edit-visuals, plan-visuals, render, and
segmentation processors.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Clean Up Worker Config

**Files:**
- Modify: `packages/worker/src/config.ts`

**IMPORTANT:** The `remotion` config block must be KEPT — it is actively used by `svg-animation/index.ts` (line 166: `config.remotion.bundleOutputDir`).

- [ ] **Step 1: Verify `claudeAgent` is only used by deleted code, and `remotion` IS still used**

```bash
cd packages/worker && grep -r "config\.claudeAgent" src/ --include="*.ts" | grep -v "config.ts" | grep -v "node_modules"
```

Expected: No references (all consumers deleted).

```bash
cd packages/worker && grep -r "config\.remotion" src/ --include="*.ts" | grep -v "config.ts" | grep -v "node_modules"
```

Expected: Hit in `svg-animation/index.ts` — confirms we must keep it.

Also check stock API key usage:
```bash
cd packages/worker && grep -r "config\.freepik\|config\.unsplash\|config\.pexels\|config\.youtube" src/ --include="*.ts" | grep -v "config.ts" | grep -v "node_modules"
```

If these are only referenced by deleted services, remove them.

- [ ] **Step 2: Remove deprecated config blocks from `packages/worker/src/config.ts`**

Remove `claudeAgent` block (lines 45-56):
```typescript
  claudeAgent: {
    model: process.env.CLAUDE_AGENT_MODEL || 'claude-opus-4-6',
    maxThinkingTokens: parseInt(process.env.CLAUDE_AGENT_MAX_THINKING_TOKENS || '10000', 10),
    maxTurns: parseInt(process.env.CLAUDE_AGENT_MAX_TURNS || '100', 10),
    timeoutSeconds: parseInt(process.env.CLAUDE_AGENT_TIMEOUT || '5400', 10),
    maxRetries: parseInt(process.env.CLAUDE_AGENT_MAX_RETRIES || '4', 10),
  },
```

**KEEP** `remotion` block (lines 135-142) — used by active svg-animation processor.

Remove stock API key blocks if only used by deleted services (lines 117-133):
```typescript
  freepik: { apiKey: process.env.FREEPIK_API_KEY || '' },
  unsplash: { accessKey: process.env.UNSPLASH_ACCESS_KEY || '' },
  pexels: { apiKey: process.env.PEXELS_API_KEY || '' },
  youtube: { apiKey: process.env.YOUTUBE_API_KEY || '' },
```

Remove the production env check for `CLAUDE_CODE_OAUTH_TOKEN` (line 14) from `prodEnvSchema`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/worker && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/config.ts
git commit -m "$(cat <<'EOF'
chore(worker): remove deprecated config blocks

Remove claudeAgent, remotion, and stock API key config blocks —
only used by deleted processors.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Clean Up API Queue Definitions

**Files:**
- Modify: `packages/api/src/services/queue.ts`

- [ ] **Step 1: Remove deprecated imports and re-exports (lines 4-19)**

Remove:
```typescript
import type {
  VisualsLayoutMode,
  VisualsDimensions,
  VideoSelection,
  GenerateVisualsJobData,
  PlanVisualsJobData,
  EditVisualsJobData,
} from '@viona/shared';
export type {
  VisualsLayoutMode,
  VisualsDimensions,
  VideoSelection,
  GenerateVisualsJobData,
  PlanVisualsJobData,
  EditVisualsJobData,
};
```

- [ ] **Step 2: Remove deprecated queue definitions**

Remove `renderQueue` + `RenderJobData` + `queueRenderJob` (lines 41-81):
```typescript
export const renderQueue = new Queue('render', { ... });
export interface RenderJobData { ... }
export async function queueRenderJob(data: RenderJobData) { ... }
```

Remove `generateVisualsQueue` + `queueGenerateVisualsJob` (lines 109-122):
```typescript
export const generateVisualsQueue = new Queue('generate-visuals', { ... });
export async function queueGenerateVisualsJob(data: GenerateVisualsJobData) { ... }
```

Remove `planVisualsQueue` + `queuePlanVisualsJob` (lines 126-139):
```typescript
export const planVisualsQueue = new Queue('plan-visuals', { ... });
export async function queuePlanVisualsJob(data: PlanVisualsJobData) { ... }
```

Remove `editVisualsQueue` + `queueEditVisualsJob` (lines 143-156):
```typescript
export const editVisualsQueue = new Queue('edit-visuals', { ... });
export async function queueEditVisualsJob(data: EditVisualsJobData) { ... }
```

Remove `splitVisualSceneQueue` + `SplitVisualSceneJobData` + `queueSplitVisualSceneJob` (lines 158-183) — ghost job with no processor:
```typescript
export interface SplitVisualSceneJobData { ... }
export const splitVisualSceneQueue = new Queue('split-visual-scene', { ... });
export async function queueSplitVisualSceneJob(data: SplitVisualSceneJobData) { ... }
```

Remove `segmentationQueue` + `SegmentationJobData` + `queueSegmentationJob` (lines 334-353):
```typescript
export interface SegmentationJobData { ... }
export const segmentationQueue = new Queue('segmentation', { ... });
export async function queueSegmentationJob(data: SegmentationJobData) { ... }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/api && npx tsc --noEmit 2>&1 | head -30
```

Expected: Errors in `projects.ts` for references to deleted queue functions — those are fixed in Task 6.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/services/queue.ts
git commit -m "$(cat <<'EOF'
chore(api): remove deprecated queue definitions

Delete generateVisuals, planVisuals, editVisuals, render,
splitVisualScene, and segmentation queues. All creative work
now handled by sandbox.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Delete Deprecated API Routes

**Files:**
- Modify: `packages/api/src/routes/projects.ts`

- [ ] **Step 1: Remove deprecated imports from the import line**

In `packages/api/src/routes/projects.ts` line 7, update the import from `../services/queue.js` to remove:
- `queueRenderJob`
- `queueGenerateVisualsJob`
- `queueEditVisualsJob`
- `segmentationQueue`

Keep:
- `queueTranscribeJob`
- `queueEnhanceAudioJob` (still active — audio enhancement pipeline)
- `queueSvgAnimationJob`
- `queuePreloadProjectJob`
- `queueHeadTrackingJob`
- `queueGenerateCaptionStylesJob`
- `publishJobCancel`

- [ ] **Step 2: Delete the render route handler**

Remove `POST /projects/:id/render` (lines ~860-917). This is the route that snapshots workspace manifest and dispatches to `queueRenderJob`.

- [ ] **Step 3: Delete the generate-visuals route handler**

Remove `POST /projects/:id/generate-visuals` (lines ~950-1024). This is the route that dispatches to `queueGenerateVisualsJob`.

- [ ] **Step 4: Delete the edit-visuals route handler**

Remove `POST /projects/:id/edit-visuals` (lines ~1026-1103). This is the route that dispatches to `queueEditVisualsJob`.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd packages/api && npx tsc --noEmit 2>&1 | head -30
```

Expected: Clean compile (or only unrelated errors).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/projects.ts
git commit -m "$(cat <<'EOF'
chore(api): delete deprecated generate-visuals, edit-visuals, render routes

These routes dispatched to the old BullMQ worker pipeline.
All creative work now goes through sandbox endpoints.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Delete Shared Package Queue Types

**Files:**
- Delete: `packages/shared/src/queue-types.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/tsup.config.ts` (remove queue-types from build entry points)

- [ ] **Step 1: Verify no remaining imports of queue-types after earlier tasks**

```bash
grep -r "from.*queue-types\|from.*@viona/shared.*import.*Layout\|from.*@viona/shared.*import.*Visuals\|from.*@viona/shared.*import.*Render" packages/ apps/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts"
```

Expected: No references (all consumers deleted in Tasks 5-6).

The entire file is deprecated types:
- `VisualsLayoutMode`, `VisualsDimensions`, `StylePreset`, `VideoSelection`
- `GenerateVisualsOptions` / `generateVisualsOptionsSchema`
- `GenerateVisualsJobData`, `PlanVisualsJobData`, `EditVisualsJobData`
- `pipSettingsSchema` / `splitSettingsSchema` / `layoutSettingsSchema`
- `RenderOptions` / `renderOptionsSchema`

- [ ] **Step 2: Delete the file**

```bash
rm packages/shared/src/queue-types.ts
```

- [ ] **Step 3: Update `packages/shared/src/index.ts`**

Remove:
```typescript
export * from './queue-types'
```

- [ ] **Step 4: Update `packages/shared/tsup.config.ts`**

Remove `'src/queue-types.ts'` from the `entry` array. The build entry point referencing a deleted file will fail the build.

- [ ] **Step 5: Verify TypeScript compiles across all packages**

```bash
npx tsc --noEmit -p packages/shared/tsconfig.json 2>&1 | head -30
npx tsc --noEmit -p packages/api/tsconfig.json 2>&1 | head -20
npx tsc --noEmit -p packages/worker/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/queue-types.ts packages/shared/src/index.ts packages/shared/tsup.config.ts
git commit -m "$(cat <<'EOF'
chore(shared): delete deprecated queue-types

Remove VisualsLayoutMode, GenerateVisualsJobData, EditVisualsJobData,
PlanVisualsJobData, layout settings, and render options — all from
deprecated worker pipeline. Update tsup.config.ts entry points.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Clean Up Frontend API Client and Dead Stores

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/features/editor-v2/components/ExportModal.tsx`
- Modify: `apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx`
- Delete: `apps/web/src/store/use-reelify-store.ts` (legacy v1 store, dead code)
- Delete: `apps/web/src/lib/project-converter.ts` (only imported by use-reelify-store.ts)

- [ ] **Step 1: Verify `use-reelify-store.ts` and `project-converter.ts` are dead code**

```bash
cd apps/web && grep -r "use-reelify-store\|useReelifyStore\|project-converter\|projectConverter" src/ --include="*.ts" --include="*.tsx" | grep -v "use-reelify-store.ts" | grep -v "project-converter.ts"
```

Expected: No references — these are legacy v1 store files replaced by editor-v2/store.

- [ ] **Step 2: Delete dead frontend files**

```bash
rm apps/web/src/store/use-reelify-store.ts
rm apps/web/src/lib/project-converter.ts
```

- [ ] **Step 3: Remove deprecated API methods from `apps/web/src/lib/api.ts`**

Remove `renderProject` method (line 342-347):
```typescript
  async renderProject(projectId: string, options?: RenderOptions): Promise<ProcessProjectResponse> { ... }
```

Remove `generateVisuals` method (line 363-368):
```typescript
  async generateVisuals(projectId: string, options: GenerateVisualsOptions): Promise<GenerateVisualsResponse> { ... }
```

Remove `editVisuals` method (line 380-396):
```typescript
  async editVisuals(projectId: string, prompt: string, context?: EditVisualsContext): Promise<EditVisualsResponse> { ... }
```

Remove `splitVisualScene` method (if present ~line 742) — ghost endpoint, no backend route:
```typescript
  async splitVisualScene(...): Promise<...> { ... }
```

Also remove the related type imports and interfaces used only by these methods:
- `GenerateVisualsOptions` / `GenerateVisualsResponse`
- `EditVisualsContext` / `EditVisualsResponse`
- `RenderOptions`

- [ ] **Step 4: Fix ExportModal.tsx**

In `apps/web/src/features/editor-v2/components/ExportModal.tsx`, the `api.renderProject()` call (line 160) will break. Add a `// TODO: Replace with sandbox export endpoint` comment and either:
- Disable the export button with a tooltip "Export coming soon"
- Or remove the entire export flow temporarily

- [ ] **Step 5: Fix StyleSelectionModal.tsx**

In `apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx`, remove imports of `StylePreset`, `GenerateVisualsOptions` from `@/lib/api` (these types come from the deleted queue-types). Replace with inline types or remove the component if it's only used for the deprecated generate-visuals flow.

- [ ] **Step 6: Clean up splitVisualScene caller in editor-store.ts**

In `apps/web/src/features/editor-v2/store/editor-store.ts` (~line 2005), there's a code path that calls `api.splitVisualScene()`. Remove this ghost call path — the split can still work locally without dispatching to a non-existent backend endpoint.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/features/editor-v2/components/ExportModal.tsx apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx apps/web/src/features/editor-v2/store/editor-store.ts apps/web/src/store/ apps/web/src/lib/project-converter.ts
git commit -m "$(cat <<'EOF'
chore(web): remove deprecated API methods and dead frontend code

Delete renderProject, generateVisuals, editVisuals, splitVisualScene
from API client. Remove dead use-reelify-store and project-converter.
Fix StyleSelectionModal dead type imports. ExportModal marked TODO
for sandbox export migration.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Clean Up Shared Legacy Types

**Files:**
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: Identify which legacy types are still imported**

```bash
grep -r "from.*@viona/shared.*import\|from.*shared.*types" packages/ apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".d.ts" | grep -v "index.ts"
```

Check specifically for imports of deprecated types:
```bash
grep -r "TimelineItemType\b\|VisualType\b\|VisualData\b\|VisualStyle\b\|EffectData\b\|TimelineItemData\b\|TimelineItem\b\|SubtitleItem\b\|VisualItem\b\|TrackType\b\|Track\b\|Project\b\|ProjectWithTracks\b\|ProjectFull\b\|Job\b\|JobType\b\|JobStatus\b\|CreateProjectResponse\b\|ProcessProjectResponse\b\|RenderProjectResponse\b\|DownloadResponse\b\|WSMessage\b\|WSMessageType\b" packages/shared/src/types/ apps/ packages/api/ packages/worker/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".d.ts" | grep -v "types/index.ts"
```

- [ ] **Step 2: Remove confirmed dead types**

Types that are definitely dead (only used by deleted code):
- `TimelineItemType` ('subtitle' | 'visual' | 'audio' | 'effect') — legacy DB-era enum
- `VisualType` — never used meaningfully
- `VisualStyle` / `VisualData` — legacy visual data format
- `EffectData` — never implemented
- `TimelineItemData` — union of dead types
- `TimelineItem<T>` — generic wrapper replaced by manifest v2 discriminated union
- `SubtitleItem` / `VisualItem` — convenience aliases for dead TimelineItem
- `TrackType` — legacy track type enum
- `Track` (the legacy one with projectId, locked, visible) — replaced by manifest v2 tracks
- `Project` / `ProjectWithTracks` / `ProjectFull` — if not used outside deleted code
- `Job` / `JobType` / `JobStatus` — check if API still uses these

Types to KEEP (still used by active code):
- `SubtitleDisplayMode` — used by caption rendering
- `CaptionPosition` / `DEFAULT_CAPTION_POSITION` / `migratePosition` — used by caption positioning
- `AnimationType` / `EasingType` / `AnimationConfig` — used by caption animations
- `SubtitleStyle` / `SubtitleData` / `SubtitleWord` — used by API responses, manifest-convert
- `StrokeStyle` / `CaptionEffects` / `ShadowEffect` / `GlowEffect` — used by caption effects
- `WordStyleOverrides` — used by caption word styling
- `VideoSettings` / `DEFAULT_VIDEO_SETTINGS` — used by editor
- `SafeZone` / `PLATFORM_SAFE_ZONES` — used by safe zone overlay
- `CanvasFormat` / `CANVAS_FORMATS` — used by canvas format selector
- `DEFAULT_FPS` / `DEFAULT_CANVAS_WIDTH` / `DEFAULT_CANVAS_HEIGHT` — used throughout
- `coverageRatio` / `getCoverageTier` — used by sandbox orchestrator
- `DEFAULT_SUBTITLE_STYLE` / `DEFAULT_CAPTION_EFFECTS` / `DEFAULT_SHADOW` / `DEFAULT_GLOW` — used by caption defaults
- `migrateTextShadow` — used by legacy data migration in manifest-convert
- `Transcript` / `TranscriptWord` — used by transcribe processor + API
- `ProjectStatus` — check if used by API

- [ ] **Step 3: Remove dead types, keep active ones**

After verifying imports, remove the confirmed dead types. The file should shrink significantly but retain all caption, animation, video settings, and safe zone types.

- [ ] **Step 4: Verify TypeScript compiles across all packages**

```bash
npx tsc --noEmit -p packages/shared/tsconfig.json 2>&1 | head -20
npx tsc --noEmit -p packages/api/tsconfig.json 2>&1 | head -20
npx tsc --noEmit -p packages/worker/tsconfig.json 2>&1 | head -20
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/index.ts
git commit -m "$(cat <<'EOF'
chore(shared): remove dead legacy types

Delete TimelineItem, Track, Project, Job, VisualData, EffectData and
other types replaced by manifest v2 discriminated unions. Keep caption
styling, animation, safe zone, and video settings types still in use.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Delete Already-Staged Files

**Files:**
- Delete: `apps/web/src/features/editor-v2/components/ActivityIndicator.tsx`
- Delete: `apps/web/src/features/editor-v2/components/ActivityLog.tsx`
- Delete: `apps/web/src/features/editor-v2/components/HealthIndicator.tsx`
- Delete: `apps/web/src/features/editor-v2/components/ProgressBar.tsx`
- Delete: `apps/web/src/features/editor-v2/hooks/use-smooth-progress.ts`
- Delete: `packages/shared/src/manifest-migrate.ts`

These files are already marked for deletion in git status (`D` status).

- [ ] **Step 1: Verify no remaining imports reference these files**

```bash
grep -r "ActivityIndicator\|ActivityLog\|HealthIndicator\|ProgressBar\|use-smooth-progress\|manifest-migrate" apps/web/src/ packages/shared/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Expected: No references (or only in already-modified files that removed the imports).

- [ ] **Step 2: Stage the deletions**

```bash
git add apps/web/src/features/editor-v2/components/ActivityIndicator.tsx
git add apps/web/src/features/editor-v2/components/ActivityLog.tsx
git add apps/web/src/features/editor-v2/components/HealthIndicator.tsx
git add apps/web/src/features/editor-v2/components/ProgressBar.tsx
git add apps/web/src/features/editor-v2/hooks/use-smooth-progress.ts
git add packages/shared/src/manifest-migrate.ts
```

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore: delete replaced UI components and migration util

Remove ActivityIndicator, ActivityLog, HealthIndicator, ProgressBar
(replaced by new progress streaming UI), use-smooth-progress
(replaced by new progress hooks), and manifest-migrate (v1→v2
migration no longer needed).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full TypeScript check across monorepo**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | tail -20
```

Or if there's a monorepo build command:
```bash
npm run build 2>&1 | tail -30
```

Fix any remaining type errors from the cleanup.

- [ ] **Step 2: Verify no broken imports at runtime**

```bash
cd packages/worker && node -e "import('./dist/index.js').catch(e => console.error(e))" 2>&1 | head -10
```

Or just check that the main packages compile without errors.

- [ ] **Step 3: Search for any remaining references to deleted code**

```bash
grep -r "generate-visuals\|edit-visuals\|plan-visuals\|processRender\|processGenerate\|processEdit\|processPlan\|segmentation" packages/worker/src/ packages/api/src/ apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".md" | grep -v "// " | head -20
```

Expected: No meaningful references (comments/docs are acceptable).

- [ ] **Step 4: Final commit if any fix-ups needed**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: fix remaining references from deprecated code cleanup

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Summary of What's Deleted vs Kept

### Worker Processors
| Processor | Status |
|-----------|--------|
| generate-visuals/ | **DELETED** |
| edit-visuals/ | **DELETED** |
| render/ | **DELETED** |
| plan-visuals.ts | **DELETED** |
| segmentation.ts | **DELETED** |
| transcribe.ts | KEPT |
| head-tracking.ts | KEPT |
| generate-reframe.ts | KEPT |
| generate-caption-styles.ts | KEPT |
| svg-animation/ | KEPT |
| preload-project.ts | KEPT |
| youtube-clip.ts | KEPT |

### API Routes
| Route | Status |
|-------|--------|
| POST /projects/:id/generate-visuals | **DELETED** |
| POST /projects/:id/edit-visuals | **DELETED** |
| POST /projects/:id/render | **DELETED** |
| POST /projects/:id/sandbox/* | KEPT |
| POST /projects/:id/generate-caption-styles | KEPT |
| POST /projects/:id/transcribe | KEPT |

### Queue Definitions
| Queue | Status |
|-------|--------|
| generateVisualsQueue | **DELETED** |
| planVisualsQueue | **DELETED** |
| editVisualsQueue | **DELETED** |
| renderQueue | **DELETED** |
| splitVisualSceneQueue | **DELETED** (ghost — no processor) |
| segmentationQueue | **DELETED** |
| transcribeQueue | KEPT |
| enhanceAudioQueue | KEPT |
| svgAnimationQueue | KEPT |
| preloadProjectQueue | KEPT |
| headTrackingQueue | KEPT |
| generateReframeQueue | KEPT |
| generateCaptionStylesQueue | KEPT |
| youtubeClipQueue | KEPT |

### Follow-Up Work (NOT in this plan)
- **Frontend store refactor:** Eliminate manifest-bridge.ts, replace store/types.ts with manifest v2 type imports
- **Sandbox export:** Wire ExportModal to sandbox render endpoint (currently disabled with TODO)
- **Worker prompts:** Keep `packages/worker/src/prompts/` for reference/reuse in sandbox
- **editor-store.ts splitItem visual path:** May still reference ghost splitVisualScene pattern — verify after cleanup
- **StyleSelectionModal.tsx:** May need deeper refactor if it was only used for the old generate-visuals flow
