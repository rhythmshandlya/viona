# YouTube Clips End-to-End Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the 3 remaining integration gaps so YouTube clips work end-to-end in both manual (user adds clip) and AI autonomous (Director plans youtube-clip scenes) flows.

**Architecture:** The infrastructure is fully built (services, routes, queue, worker, template, modal, context panel, API client). What's missing is wiring: (1) Editor.tsx doesn't pass the `onYouTubeClipAdded` callback so clips never land on the timeline, (2) generate-visuals.ts doesn't handle `type: "youtube-clip"` scenes — they go through the Animator which generates code instead of using the registered template, (3) the timeline item data for AI-generated youtube-clip scenes is missing `templateId`/`templateProps` so `Composition.tsx` routes them to `DynamicVisualLoader` instead of `StaticTemplateRenderer`.

**Tech Stack:** Next.js (frontend), Fastify (API), BullMQ (worker), Remotion (video), Zustand (state), `@viona/templates` (template registry)

---

## Gap Analysis

### Gap 1: Editor.tsx missing `onYouTubeClipAdded` callback
- `AssetsPanel` accepts `onYouTubeClipAdded` prop and renders the modal + button
- `Editor.tsx:589-594` renders `<AssetsPanel>` but does NOT pass `onYouTubeClipAdded`
- Result: modal opens, user can trim+extract, but clip data goes nowhere

### Gap 2: generate-visuals.ts doesn't handle youtube-clip scene type
- When Director marks a scene as `type: "youtube-clip"`, the Animator still runs for ALL scenes
- The Animator prompt knows about youtube-clip but still generates custom `.tsx` code
- Timeline items are created at line 1171 with `bundleUrl` pointing to dynamic bundle
- Missing: `templateId: 'youtube-clip'` and `templateProps` in the item data
- Missing: video URL (from `videoManifest`) needs to be injected as `videoUrl` + `sourceVideoUrl`

### Gap 3: Composition.tsx routing for AI-generated youtube-clip scenes
- `Composition.tsx:1091-1098` already routes `group.templateId` to `StaticTemplateRenderer`
- But Gap 2 means AI-generated youtube-clip items never get `templateId` set
- Once Gap 2 is fixed, this should work automatically
- Need to verify the `templateProps` shape matches what the template expects

---

## Task 1: Wire `onYouTubeClipAdded` in Editor.tsx

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx:588-594`

**Step 1: Add the callback to AssetsPanel**

In `Editor.tsx`, find the `AssetsPanel` render (line 589) and add the `onYouTubeClipAdded` prop. The callback should use `addItem` from the editor store to place a `visual` item on the timeline with `templateId: 'youtube-clip'`.

```tsx
{leftSidebarTab === 'assets' && (
  <AssetsPanel
    onEditWithAI={() => {
      setLeftSidebarTab('agent');
      useEditorStore.setState({ aiEditRequested: true });
    }}
    onYouTubeClipAdded={(clip) => {
      const { addItem, tracks, fps } = useEditorStore.getState();

      // Find or note the visual track
      const visualTrack = tracks.find(t => t.type === 'visual');
      if (!visualTrack) {
        console.warn('[Editor] No visual track found for YouTube clip');
        return;
      }

      const currentFps = fps || 30;
      const durationMs = clip.duration * 1000;

      // Create timeline item with template-based visual data
      addItem(visualTrack.id, {
        type: 'visual',
        startMs: 0,
        endMs: durationMs,
        data: {
          compositionId: `youtube-clip-${clip.clipId}`,
          bundleUrl: '', // No bundle needed for template-based visuals
          type: 'youtube-clip',
          description: clip.sourceTitle || 'YouTube Clip',
          width: 1920,
          height: 1080,
          fps: currentFps,
          templateId: 'youtube-clip',
          templateProps: {
            clipUrl: clip.clipUrl,
            frame: clip.frameStyle || 'browser',
            trimStartSeconds: clip.startSeconds,
            trimEndSeconds: clip.endSeconds,
            backgroundColor: '#000000',
            muted: false,
            volume: 1,
          },
          sourceVideoUrl: clip.sourceUrl,
          videoUrl: clip.clipUrl,
          hasVideo: true,
        },
      });
    }}
  />
)}
```

**Step 2: Verify imports**

Ensure `useEditorStore` is imported in `Editor.tsx`. Check existing imports — it likely already imports individual hooks. We need the store itself for `getState()`.

```tsx
// Should already exist or add if missing:
import { useEditorStore } from './store/use-editor-store';
```

**Step 3: Test manually**

1. Open editor, go to Assets tab
2. Click YouTube button
3. Paste a YouTube URL, trim, select frame style, extract
4. Verify the clip appears as a timeline item
5. Verify the preview renders via `StaticTemplateRenderer` (not blank)
6. Verify ContextPanel shows youtube-clip controls when selected

**Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx
git commit -m "feat(editor): wire onYouTubeClipAdded to place clips on timeline"
```

---

## Task 2: Handle youtube-clip scenes in generate-visuals.ts

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals.ts:1128-1197`

**Step 1: Add templateId/templateProps for youtube-clip scenes**

In the timeline item creation loop (line 1128), detect when a scene has `type: "youtube-clip"` and set template-based fields instead of pointing at the dynamic bundle.

Find the loop at line 1128:
```typescript
for (let sceneIndex = 0; sceneIndex < metadata.visuals.length; sceneIndex++) {
```

Inside the loop, after the `sceneVideo` lookup (line 1169), add youtube-clip detection before the `insert`:

```typescript
const sourceSceneId = sceneIndex + 1;
const sceneVideo = videoManifest.videos.find(v => v.sceneId === String(sourceSceneId));

// Detect youtube-clip scenes: use template renderer instead of dynamic bundle
const isYouTubeClip = scene.type === 'youtube-clip';

await tx.insert(timelineItems).values({
  trackId: visualsTrack.id,
  type: 'visual',
  startMs: scene.startMs,
  endMs: scene.endMs,
  data: {
    visualId,
    compositionId: isYouTubeClip
      ? `youtube-clip-scene${sourceSceneId}`
      : metadata.compositionId,
    bundleUrl: isYouTubeClip ? '' : bundleUrl,
    type: scene.type || 'visual',
    description: scene.description || 'AI-generated visual',
    width: canvasWidth,
    height: canvasHeight,
    fps: metadata.fps,
    effectiveWidth: sceneEffectiveW,
    effectiveHeight: sceneEffectiveH,
    displayMode: sceneDm,
    transition: scene.transition || undefined,
    sourceSceneId,
    ...(speakerBbox ? { speakerBbox } : {}),
    // Template-based rendering for youtube-clip scenes
    ...(isYouTubeClip ? {
      templateId: 'youtube-clip',
      templateProps: {
        clipUrl: '', // Filled by render.ts during export; preview uses videoUrl
        frame: scene.frameStyle || 'browser',
        trimStartSeconds: sceneVideo?.trimStart ?? 0,
        trimEndSeconds: sceneVideo?.trimEnd ?? 30,
        backgroundColor: '#000000',
        muted: false,
        volume: 1,
      },
    } : {}),
    // Video clip URLs for preview and export
    ...(sceneVideo ? {
      sourceVideoUrl: sceneVideo.sourceUrl,
      videoUrl: sceneVideo.proxyUrl || '',
      hasVideo: true,
    } : {}),
  },
});
```

**Step 2: Ensure videoManifest has proxyUrl for youtube-clip scenes**

Check `prepareVideoAssets()` (around line 547). The `VideoAssetEntry` type should include a `proxyUrl` field for streaming preview. If `selectedVideos` entries contain a proxy URL, pass it through.

Look at the `VideoAssetEntry` interface and add `proxyUrl` if missing:

```typescript
interface VideoAssetEntry {
  sceneId: string;
  keyword: string;
  sourceUrl: string;
  trimStart: number;
  trimEnd: number;
  proxyUrl?: string; // Streaming proxy URL for editor preview
}
```

**Step 3: Test with AI flow**

1. Create a project with a topic that would benefit from YouTube clips
2. In the AI assistant, ask it to plan scenes with YouTube clips
3. Verify Director outputs `type: "youtube-clip"` in scenes.json
4. After generation, verify timeline items have `templateId: 'youtube-clip'`
5. Verify preview renders the template (may show "No video loaded" until export)

**Step 4: Commit**

```bash
git add packages/worker/src/processors/generate-visuals.ts
git commit -m "feat(worker): set templateId/templateProps for youtube-clip scenes"
```

---

## Task 3: Ensure render.ts injects clipUrl into template-based items

**Files:**
- Modify: `packages/worker/src/processors/render.ts` (verify, may already work)

**Step 1: Investigate current render flow**

The render processor already downloads YouTube clips via yt-dlp and stores them as `public/assets/clips/scene{N}-youtube-clip.mp4`. These are referenced via Remotion's `staticFile()`.

For template-based youtube-clip scenes, the clip URL needs to be injected differently. The `StaticTemplateRenderer` passes `templateProps.clipUrl` directly to the template component. During export/render, this should point to the downloaded file.

Check if render.ts updates `templateProps.clipUrl` for youtube-clip items. If not, add logic after clip download to update the timeline item's `templateProps.clipUrl` with the local file path.

**Step 2: Add clipUrl injection if missing**

In the render processor, after downloading video clips (around the clip download loop), find where scene data is prepared for Remotion bundling. If youtube-clip scenes use `StaticTemplateRenderer`, the template needs `clipUrl` pointing to the local file.

Since the Animator-generated code uses `staticFile('assets/clips/scene{N}-youtube-clip.mp4')`, and the template component also accepts `clipUrl` as a prop, the render flow should inject:

```typescript
// After downloading clip for scene N:
// If scene has templateId === 'youtube-clip', update templateProps.clipUrl
// to point to the staticFile path
if (sceneData.templateId === 'youtube-clip') {
  sceneData.templateProps = {
    ...sceneData.templateProps,
    clipUrl: `assets/clips/scene${sceneId}-youtube-clip.mp4`,
  };
}
```

**Step 3: Test export**

1. Add a YouTube clip via the manual flow
2. Export the video
3. Verify the clip appears in the exported video with the correct frame style
4. Verify audio from the clip is included

**Step 4: Commit**

```bash
git add packages/worker/src/processors/render.ts
git commit -m "feat(render): inject clipUrl into youtube-clip templateProps for export"
```

---

## Task 4: Verify end-to-end and edge cases

**Step 1: Manual flow test**

1. Open editor > Assets > YouTube button
2. Paste URL, trim to 5-10 seconds, select "phone" frame
3. Click "Add Clip"
4. Verify: item on timeline, preview shows phone frame with video, ContextPanel editable
5. Change frame style in ContextPanel, verify preview updates

**Step 2: AI autonomous flow test**

1. Start new project with a topic like "Top 3 AI tools demo"
2. Let Director plan scenes — expect at least one `type: "youtube-clip"`
3. After generation, verify youtube-clip scenes render as template
4. Export and verify clip downloads + renders correctly

**Step 3: Edge cases**

- YouTube clip with no frame style (should default to 'browser')
- Very short clip (< 3 seconds)
- Clip at end of timeline (verify no overflow)
- Expired proxy token (should auto-refresh via Composition.tsx)
- Missing YOUTUBE_API_KEY (search returns empty, but manual URL still works)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(youtube-clips): edge case fixes from end-to-end testing"
```

---

## File Summary

| File | Change Type | What |
|------|------------|------|
| `apps/web/src/features/editor-v2/Editor.tsx` | Modify (line ~589) | Add `onYouTubeClipAdded` callback with `addItem` |
| `packages/worker/src/processors/generate-visuals.ts` | Modify (line ~1170) | Detect `type: "youtube-clip"`, set `templateId`/`templateProps` |
| `packages/worker/src/processors/render.ts` | Verify/Modify | Ensure `clipUrl` injected into templateProps for export |

## What Already Works (no changes needed)

- `YouTubeClipModal` — complete with URL input, trim, frame style, extraction
- `StaticTemplateRenderer` — loads template from registry, renders with props
- `Composition.tsx` — already routes `templateId` to `StaticTemplateRenderer`, handles youtube-clip URL fixing
- `ContextPanel.tsx` — already has `YouTubeClipEditor` for youtube-clip props
- `AssetsPanel.tsx` — already has YouTube button, modal, state management
- `youtubeApi` in `api.ts` — all methods implemented
- Backend routes, services, queue, worker — all complete
- Director + Animator prompts — already know about youtube-clip
- `search_youtube` agent tool — already implemented
