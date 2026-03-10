# Codebase Review Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all Critical and Important issues found in the dev-vs-main code review across API, Frontend, and Templates packages.

**Architecture:** Targeted bugfixes grouped by package. No new features — only fixes for security, correctness, and type safety issues.

**Tech Stack:** TypeScript, Fastify, Zod, React, Remotion, Drizzle ORM

---

## Task 1: API — Add YouTube config + fix runtime crash

**Files:**
- Modify: `packages/api/src/config.ts`

**Step 1: Add youtube section to config**

```ts
// In the config object, after the `stytch` block, add:
youtube: {
  apiKey: process.env.YOUTUBE_API_KEY || '',
},
```

**Step 2: Verify no crash**

Run: `cd packages/api && npx tsx -e "import { config } from './src/config.js'; console.log('youtube.apiKey type:', typeof config.youtube.apiKey)"`
Expected: `youtube.apiKey type: string`

**Step 3: Commit**

```bash
git add packages/api/src/config.ts
git commit -m "fix(api): add missing youtube config section — prevents runtime crash in youtube-search.ts"
```

---

## Task 2: API — Register YouTube routes + add auth middleware

**Files:**
- Modify: `packages/api/src/index.ts`
- Modify: `packages/api/src/routes/youtube-clips.ts`

**Step 1: Register routes in index.ts**

In `packages/api/src/index.ts`, add the import at the top:

```ts
import { youtubeClipRoutes } from './routes/youtube-clips.js';
```

And register it alongside other route registrations:

```ts
await fastify.register(youtubeClipRoutes, { prefix: '/api' });
```

**Step 2: Add auth to all YouTube routes**

In `packages/api/src/routes/youtube-clips.ts`, import the auth middleware and add `{ preHandler: authMiddleware }` to every route definition. Check how other routes (e.g., `projects.ts`) import and use `authMiddleware` — follow the same pattern.

Each route (`/youtube/stream-info`, `/youtube/proxy/:tokenId`, `/youtube/extract`, `/youtube/search`) must include the preHandler.

**Step 3: Remove wildcard CORS from proxy route**

Remove the manual `Access-Control-Allow-Origin: *` header from the proxy endpoint response — Fastify's CORS plugin handles this.

**Step 4: Commit**

```bash
git add packages/api/src/index.ts packages/api/src/routes/youtube-clips.ts
git commit -m "fix(api): register YouTube routes + add auth middleware to all endpoints"
```

---

## Task 3: API — Guard debug endpoint + add auth to S3 bundle routes

**Files:**
- Modify: `packages/api/src/index.ts`

**Step 1: Wrap debug endpoint in dev-only guard**

Find the `/debug/claude-test` route (around line 221) and wrap it:

```ts
if (process.env.NODE_ENV !== 'production') {
  fastify.get('/debug/claude-test', async (request, reply) => {
    // existing code
  });
}
```

**Step 2: Add auth to bundle/source endpoints**

The `/api/bundles/:compositionId/*` and `/api/sources/:compositionId/*` routes (around lines 87-215) need authentication. Add `preHandler: authMiddleware` to each route. Then verify the requesting user owns the project by checking the compositionId against the user's projects in the database.

Note: If these endpoints are used by the Remotion renderer (server-side, no auth cookie), you may need to use a different auth mechanism (e.g., a short-lived token or internal API key check). Investigate before blindly adding auth — check how the renderer calls these endpoints.

**Step 3: Commit**

```bash
git add packages/api/src/index.ts
git commit -m "fix(api): guard debug endpoint for dev-only, add auth to S3 bundle routes"
```

---

## Task 4: API — Fix stream token memory leak + event buffer leak

**Files:**
- Modify: `packages/api/src/services/youtube-clip.ts`
- Modify: `packages/api/src/agent/agent-router.ts`

**Step 1: Add max token cap to YouTubeClipService**

In `youtube-clip.ts`, add a max token constant and eviction:

```ts
private readonly MAX_TOKENS = 10_000;

// In the method that creates tokens, before adding:
if (this.streamTokens.size >= this.MAX_TOKENS) {
  // Evict oldest token
  const oldestKey = this.streamTokens.keys().next().value;
  if (oldestKey) this.streamTokens.delete(oldestKey);
}
```

**Step 2: Add periodic sweep to projectEventBuffers**

In `agent-router.ts`, near the `projectEventBuffers` Map declaration (around line 24), add a periodic sweep:

```ts
// Sweep stale buffers every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, buffer] of projectEventBuffers) {
    if (buffer.lastUpdated && now - buffer.lastUpdated > 5 * 60 * 1000) {
      projectEventBuffers.delete(key);
    }
  }
}, 5 * 60 * 1000);
```

Check the buffer object's shape — if it doesn't have a `lastUpdated` field, add one that gets set whenever events are appended.

**Step 3: Commit**

```bash
git add packages/api/src/services/youtube-clip.ts packages/api/src/agent/agent-router.ts
git commit -m "fix(api): cap stream tokens at 10k + sweep stale event buffers"
```

---

## Task 5: API — Fix scene split ID collision + add projectAssets description

**Files:**
- Modify: `packages/api/src/agent/agent-tools.ts`
- Modify: `packages/api/src/db/schema.ts`

**Step 1: Fix split scene ID collision**

In `agent-tools.ts`, find the split logic (around line 519-529). Change the second half's ID from `scene.id + 1` to a temporary unique value:

```ts
// Instead of: id: scene.id + 1
// Use a large temporary ID that won't collide:
id: 9000 + Math.random() * 1000,
```

The re-indexing at line 600 will assign correct sequential IDs afterward, so the temporary value just needs to be unique within the loop.

**Step 2: Add description to projectAssets schema**

In `packages/api/src/db/schema.ts`, in the `projectAssets` table definition (around line 132-144), add:

```ts
description: text('description'),
```

after the `label` field.

**Step 3: Commit**

```bash
git add packages/api/src/agent/agent-tools.ts packages/api/src/db/schema.ts
git commit -m "fix(api): use temp ID for split scenes + add description to projectAssets schema"
```

---

## Task 6: API — Reduce `as any` casts with proper types

**Files:**
- Modify: `packages/api/src/agent/agent-tools.ts`

**Step 1: Define ScenePlanScene interface**

At the top of the file (or in a shared types file), add:

```ts
interface ScenePlanScene {
  id: number;
  name: string;
  visual: string;
  emotion: string;
  timestampRange: [number, number];
  frames: [number, number];
  displayMode?: string;
  transition?: string;
  keySync?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  buildsFrom?: string | null;
  connectsTo?: string | null;
  requires3D?: boolean;
  icons?: string[];
}
```

**Step 2: Replace `as any` with proper type**

Replace all `scenesArray` element accesses from `(scene as any).id` to properly typed access. Change the array type from `Record<string, unknown>[]` to `ScenePlanScene[]`.

**Step 3: Add Fastify request type augmentation**

Create or update a `fastify.d.ts` declaration file in `packages/api/src/`:

```ts
declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; email: string };
  }
}
```

Then remove all `(request as any).user` casts in `agent-router.ts`.

**Step 4: Commit**

```bash
git add packages/api/src/agent/agent-tools.ts packages/api/src/agent/agent-router.ts packages/api/src/fastify.d.ts
git commit -m "fix(api): replace as-any casts with proper ScenePlanScene type + Fastify request augmentation"
```

---

## Task 7: Frontend — Fix onYouTubeClipAdded prop + isDirty type

**Files:**
- Modify: `apps/web/src/features/editor-v2/panels/AssetsPanel.tsx`
- Modify: `apps/web/src/features/editor-v2/store/types.ts`

**Step 1: Add onYouTubeClipAdded to AssetsPanelProps**

In `AssetsPanel.tsx`, update the interface:

```ts
interface AssetsPanelProps {
  className?: string;
  onEditWithAI?: (asset: ExtractedAsset) => void;
  onYouTubeClipAdded?: (clip: { url: string; startMs: number; endMs: number; title: string }) => void;
}
```

Check how `Editor.tsx` calls the callback to get the exact clip type. Then wire it through the component where YouTube clips are added.

**Step 2: Add isDirty to EditorState**

In `types.ts`, add to the `EditorState` interface (around line 589, after `isSaving`):

```ts
isDirty: boolean;
```

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/panels/AssetsPanel.tsx apps/web/src/features/editor-v2/store/types.ts
git commit -m "fix(web): add missing onYouTubeClipAdded prop + isDirty to EditorState type"
```

---

## Task 8: Frontend — Fix TemplateCard memoization + ExportModal stale closure

**Files:**
- Modify: `apps/templates/src/components/TemplateCard.tsx`
- Modify: `apps/web/src/features/editor-v2/components/ExportModal.tsx`

**Step 1: Memoize previewFrames in TemplateCard**

Wrap the `previewFrames` array in `useMemo`:

```tsx
const previewFrames = useMemo(() => [
  previewFrame,
  Math.min(Math.round(fps * 3), durationInFrames - 1),
  Math.min(Math.round(fps * 6), durationInFrames - 1),
], [previewFrame, fps, durationInFrames]);
```

**Step 2: Fix jobId stale closure in ExportModal**

Add a ref to track the current jobId:

```tsx
const jobIdRef = useRef<string | null>(null);

// When setting jobId:
setJobId(newJobId);
jobIdRef.current = newJobId;

// In WebSocket callbacks, use jobIdRef.current instead of jobId
```

**Step 3: Replace `as any` in ExportModal**

Change `const data = item.data as any;` to use the proper type from the shared types package.

**Step 4: Commit**

```bash
git add apps/templates/src/components/TemplateCard.tsx apps/web/src/features/editor-v2/components/ExportModal.tsx
git commit -m "fix(web): memoize previewFrames + fix ExportModal stale closure and any cast"
```

---

## Task 9: Frontend — Fix MentionAutocomplete event propagation + YouTubeClipModal

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/MentionAutocomplete.tsx`
- Modify: `apps/web/src/components/youtube-clip-modal.tsx`

**Step 1: Add stopPropagation to MentionAutocomplete**

In the `keydown` handler (around lines 140-161), add `e.stopPropagation()` alongside `e.preventDefault()` for Arrow/Enter/Escape keys to prevent conflicts with global keyboard shortcuts.

**Step 2: Enforce 10-minute limit in YouTubeClipModal**

Where the Extract button is rendered (around line 353), disable it when `clipDuration > 600`:

```tsx
disabled={clipDuration <= 0 || clipDuration > 600}
```

**Step 3: Add onError to video element**

Add an `onError` handler to the `<video>` element (around line 234):

```tsx
onError={() => setError('Failed to load video stream. Try a different URL.')}
```

**Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/components/MentionAutocomplete.tsx apps/web/src/components/youtube-clip-modal.tsx
git commit -m "fix(web): stop event propagation in MentionAutocomplete + enforce clip duration limit"
```

---

## Task 10: Frontend — Fix Header escape + Editor callback memoization

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/Header.tsx`
- Modify: `apps/web/src/features/editor-v2/Editor.tsx`

**Step 1: Revert title on Escape in Header**

In the Escape key handler (around line 85-87), reset the title state back to the project title:

```tsx
if (e.key === 'Escape') {
  setTitle(project?.title || '');
  setIsEditing(false);
}
```

**Step 2: Memoize onYouTubeClipAdded callback in Editor**

Wrap the inline function at line 594 in `useCallback` with appropriate dependencies.

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/Header.tsx apps/web/src/features/editor-v2/Editor.tsx
git commit -m "fix(web): revert title on Escape + memoize Editor callbacks"
```

---

## Task 11: Templates — Fix division by zero in bezier calculations

**Files:**
- Modify: `packages/templates/src/lib/map/tile-math.ts`
- Modify: `packages/templates/src/lib/map/components/AnimatedPath.tsx`

**Step 1: Guard against zero distance in tile-math.ts**

At line 209-210, replace:

```ts
const nx = -dy / dist;
const ny = dx / dist;
```

with:

```ts
const nx = dist > 0 ? -dy / dist : 0;
const ny = dist > 0 ? dx / dist : 0;
```

**Step 2: Same guard in AnimatedPath.tsx**

At lines 54-55, apply identical fix:

```ts
const nx = dist > 0 ? -dy / dist : 0;
const ny = dist > 0 ? dx / dist : 0;
```

**Step 3: Commit**

```bash
git add packages/templates/src/lib/map/tile-math.ts packages/templates/src/lib/map/components/AnimatedPath.tsx
git commit -m "fix(templates): guard against division by zero when start/end coords are identical"
```

---

## Task 12: Templates — Fix watercolor-map mask collisions + schema gaps

**Files:**
- Modify: `packages/templates/src/templates/watercolor-map/index.tsx`
- Modify: `packages/templates/src/templates/indiana-jones/schema.ts`
- Modify: `packages/templates/src/templates/watercolor-map/schema.ts`

**Step 1: Add unique maskId to AnimatedPath instances**

In `watercolor-map/index.tsx`, for the hubAndSpoke paths (around line 216):

```tsx
<AnimatedPath maskId={`spoke-${i}`} ... />
```

For the multiStop paths (around line 242):

```tsx
<AnimatedPath maskId={`seg-${i}`} ... />
```

**Step 2: Add missing mapStyle options to schemas**

In `indiana-jones/schema.ts` and `watercolor-map/schema.ts`, update the mapStyle enum to include all 9 styles:

```ts
mapStyle: z
  .enum(['satellite', 'watercolor', 'toner', 'tonerLite', 'terrain', 'osm', 'darkMatter', 'voyager', 'positron'])
  .default('terrain'),
```

**Step 3: Commit**

```bash
git add packages/templates/src/templates/watercolor-map/index.tsx packages/templates/src/templates/indiana-jones/schema.ts packages/templates/src/templates/watercolor-map/schema.ts
git commit -m "fix(templates): unique maskIds for AnimatedPath + add missing map styles to schemas"
```

---

## Task 13: Templates — Fix Indiana Jones perf issues + unused code

**Files:**
- Modify: `packages/templates/src/templates/indiana-jones/index.tsx`

**Step 1: Remove unused styleConfig**

Delete line 38:

```ts
// Remove: const styleConfig = MAP_STYLES[props.mapStyle];
```

**Step 2: Memoize totalKm**

Replace the IIFE (lines 131-140) with:

```tsx
const totalKm = useMemo(() => {
  let km = 0;
  for (let i = 0; i < allCoords.length - 1; i++) {
    km += haversineDistance(
      allCoords[i].lat, allCoords[i].lng,
      allCoords[i + 1].lat, allCoords[i + 1].lng
    );
  }
  return km;
}, [allCoords]);
```

Add `useMemo` to the React import if not already there.

**Step 3: Guard spring against negative frames**

Replace lines 143-147:

```tsx
const distanceEnterProgress = spring({
  frame: Math.max(0, frame - drawStartFrame),
  fps,
  config: { damping: 26, stiffness: 120, mass: 1.0 },
});
```

Same for `compassEnterProgress` — use `Math.max(0, frame - 15)`.

**Step 4: Commit**

```bash
git add packages/templates/src/templates/indiana-jones/index.tsx
git commit -m "fix(templates): remove unused styleConfig, memoize totalKm, guard negative spring frames"
```

---

## Task 14: Templates — Fix SerifLabel scaling

**Files:**
- Modify: `packages/templates/src/templates/indiana-jones/components/SerifLabel.tsx`

**Step 1: Scale font size with useScale**

Check if `useScale` is available in this template. If so, replace the hardcoded `fontSize: 16` with a scaled value:

```tsx
const s = useScale();
// ...
fontSize: s(16),
```

If `useScale` is not available, derive from the canvas height prop or leave a comment explaining why it's hardcoded.

**Step 2: Commit**

```bash
git add packages/templates/src/templates/indiana-jones/components/SerifLabel.tsx
git commit -m "fix(templates): scale SerifLabel font size with canvas dimensions"
```

---

## Task 15: Worker — Fix stale `'modern'` fallback in plan-visuals

**Files:**
- Modify: `packages/worker/src/processors/plan-visuals.ts`

**Step 1: Fix stale preset fallback**

At line 161, change:

```ts
stylePreset: stylePreset || 'modern',
```

to:

```ts
stylePreset: stylePreset || 'studio-dark',
```

**Step 2: Commit**

```bash
git add packages/worker/src/processors/plan-visuals.ts
git commit -m "fix(worker): change stale 'modern' fallback to 'studio-dark' in plan-visuals"
```

---

## Task 16: Worker — Migrate assistant_director.py to .md loader

**Files:**
- Modify: `packages/worker/src/agents/prompts/assistant_director.py`

**Step 1: Replace inline prompt with loader call**

The file has a 124-line inline `ASSISTANT_DIRECTOR_SYSTEM_PROMPT` string, but `prompts/assistant-director/system.md` already exists with matching content. Replace the inline string:

```python
from prompts._loader import load_prompt

ASSISTANT_DIRECTOR_SYSTEM_PROMPT = load_prompt('assistant-director/system')
```

Remove the old multi-line string constant.

**Step 2: Verify .md file content matches**

Diff the inline string against `packages/worker/src/prompts/assistant-director/system.md` to ensure they match. If there are differences, the `.md` file is canonical — update it if needed.

**Step 3: Commit**

```bash
git add packages/worker/src/agents/prompts/assistant_director.py
git commit -m "fix(worker): migrate assistant_director.py prompt to .md loader (consistency)"
```

---

## Task 17: Worker — Fix fullscreen-rules dimension hardcoding + overlay-rules fragility

**Files:**
- Modify: `packages/worker/src/prompts/animator/fullscreen-rules.md`
- Modify: `packages/worker/src/agents/prompts/animator.py`

**Step 1: Add dimension placeholders to fullscreen-rules.md**

Replace hardcoded `1080x1920`, `1080`, `1920` with `{ew}x{eh}`, `{ew}`, `{eh}` placeholders — matching the pattern used in `overlay-rules.md`.

**Step 2: Update get_display_mode_rules() to substitute dimensions for fullscreen**

In `animator.py`, the fullscreen branch (around line 658) currently returns `FULLSCREEN_RULES` directly. Change to:

```python
return FULLSCREEN_RULES.replace("{ew}", str(ew)).replace("{eh}", str(eh))
```

This matches the overlay branch pattern.

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/animator/fullscreen-rules.md packages/worker/src/agents/prompts/animator.py
git commit -m "fix(worker): parameterize fullscreen-rules dimensions + match overlay-rules pattern"
```

---

## Task 18: Worker — Fix edit-visuals timeout escalation + cleanup imports

**Files:**
- Modify: `packages/worker/src/processors/edit-visuals.ts`

**Step 1: Add SIGTERM→SIGKILL escalation**

In the timeout handler (around line 937), replace the simple `subprocess.kill('SIGTERM')` with escalation matching `plan-visuals.ts`:

```ts
subprocess.kill('SIGTERM');
setTimeout(() => {
  try { subprocess.kill('SIGKILL'); } catch {}
}, 10_000);
```

**Step 2: Clean up duplicate writeFile imports**

Remove the duplicate `writeFile` import at line 18 and the dynamic `import('fs/promises')` at line 52. Use the `writeFileAsync` alias from line 13 throughout, or rename it to `writeFile` and remove the others.

**Step 3: Commit**

```bash
git add packages/worker/src/processors/edit-visuals.ts
git commit -m "fix(worker): add SIGKILL escalation to edit-visuals timeout + clean duplicate imports"
```

---

## Task 19: Worker — Extract shared STUDIO_THEMES + remove dead code

**Files:**
- Create: `packages/worker/src/agents/prompts/_themes.py`
- Modify: `packages/worker/src/agents/prompts/animator.py`
- Modify: `packages/worker/src/agents/prompts/director.py`

**Step 1: Create shared _themes.py**

Create `packages/worker/src/agents/prompts/_themes.py` with the unified `STUDIO_THEMES` dict. Use the animator version (which has `accentDefault` and `secondaryDefault` extra keys) as canonical:

```python
STUDIO_THEMES = {
    "studio-dark": {
        "bg": "#0B0F1A",
        "surface": "rgba(255,255,255,0.06)",
        "border": "rgba(255,255,255,0.1)",
        "text": "#F1F3F5",
        "textMuted": "#868E96",
        "accent": "#7C5CFC",
        "accentDefault": "#7C5CFC",
        "secondaryDefault": "#3B82F6",
    },
    "studio-light": {
        "bg": "#F8F9FB",
        "surface": "rgba(0,0,0,0.03)",
        "border": "rgba(0,0,0,0.08)",
        "text": "#1A1A2E",
        "textMuted": "#6B7280",
        "accent": "#6C47FF",
        "accentDefault": "#6C47FF",
        "secondaryDefault": "#2563EB",
    },
}
```

**Step 2: Import from both animator.py and director.py**

Replace the local `STUDIO_THEMES` dict in each file with:

```python
from prompts._themes import STUDIO_THEMES
```

For `director.py`, which doesn't use `accentDefault`/`secondaryDefault`, the extra keys are harmless.

**Step 3: Remove unused project_id from scene template format call**

In `animator.py` around line 786, remove `project_id=project_id` from the `.format()` call.

**Step 4: Commit**

```bash
git add packages/worker/src/agents/prompts/_themes.py packages/worker/src/agents/prompts/animator.py packages/worker/src/agents/prompts/director.py
git commit -m "fix(worker): extract shared STUDIO_THEMES + remove unused format arg"
```

---

## Excluded (Nit-level, skip unless convenient)

- Duplicate `VideoSelection` type (minor DRY violation)
- Hardcoded light theme in ExportModal/StyleSelectionModal (cosmetic, no dark mode yet)
- ThemePicker color swatch index keys (static array, harmless)
- Hardcoded SVG filter ID in VintageOverlay (unlikely multi-instance scenario)
- Indiana Jones meta.json vs metadata.json naming (matches existing convention)
- Possibly unused `listTemplates` import in generate-visuals.ts
- `AD_MOTION_UTILITIES` loaded but never consumed (5 dead motion .md files)
- `__pycache__` files tracked in workspace
