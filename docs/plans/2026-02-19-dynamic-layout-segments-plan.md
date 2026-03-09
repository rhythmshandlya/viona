# Dynamic Layout Segments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-scene display modes (fullscreen, pip, overlay) with transcript-driven timing and dimension-aware layout strategy, enabling dynamic switching between speaker-only, animation-only, and overlay segments.

**Architecture:** Visual items gain a `displayMode` property and optional `transition` config. The Director agent assigns these per scene and leaves gaps for speaker-only moments. The Composition renderer switches compositing mode per frame based on the active visual item's displayMode. No new DB tables — data flows through existing planData and timeline items.

**Tech Stack:** TypeScript, React (Remotion), Fastify, Drizzle ORM, Zustand, Claude Agent SDK (MCP tools)

---

### Task 1: Add shared type definitions

**Files:**
- Modify: `packages/shared/src/types/index.ts:286-299`

**Step 1: Add DisplayMode and LayoutTransition types after the VisualStyle interface**

After line 299 (end of `VisualData` interface), add:

```typescript
// ============================================
// Dynamic Layout Types
// ============================================

/** How a visual item composites with the speaker video */
export type DisplayMode = 'pip' | 'fullscreen' | 'overlay';

/** Transition type for layout segment boundaries */
export type LayoutTransitionType = 'cut' | 'fade' | 'zoom-in' | 'zoom-out';

/** Enter/exit transition for a visual layout segment */
export interface LayoutTransition {
  enter: { type: LayoutTransitionType; durationMs: number };
  exit: { type: LayoutTransitionType; durationMs: number };
}

export const DEFAULT_LAYOUT_TRANSITION: LayoutTransition = {
  enter: { type: 'cut', durationMs: 0 },
  exit: { type: 'cut', durationMs: 0 },
};

/**
 * Calculate what percentage of the source frame is visible when
 * cover-fitting it into the canvas. Used by the Director to decide
 * how aggressively to use speaker-only gaps.
 *
 * Returns a number between 0 and 1:
 *   1.0 = perfect fit (same aspect ratio)
 *   0.31 = 16:9 source on 9:16 canvas (heavy crop)
 */
export function coverageRatio(
  sourceW: number,
  sourceH: number,
  canvasW: number,
  canvasH: number,
): number {
  if (sourceW <= 0 || sourceH <= 0 || canvasW <= 0 || canvasH <= 0) return 1;
  const sourceAR = sourceW / sourceH;
  const canvasAR = canvasW / canvasH;
  return sourceAR > canvasAR
    ? canvasAR / sourceAR
    : sourceAR / canvasAR;
}

export type CoverageTier = 'flexible' | 'moderate' | 'conservative';

export function getCoverageTier(ratio: number): CoverageTier {
  if (ratio > 0.8) return 'flexible';
  if (ratio >= 0.5) return 'moderate';
  return 'conservative';
}
```

**Step 2: Commit**

```bash
git add packages/shared/src/types/index.ts
git commit -m "feat: add DisplayMode, LayoutTransition, and coverageRatio shared types"
```

---

### Task 2: Extend VisualItemData in editor store types

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts:325-335`

**Step 1: Add displayMode and transition to VisualItemData**

Replace the existing `VisualItemData` interface (lines 325-335):

```typescript
export interface VisualItemData {
  visualId: string;
  compositionId: string;
  bundleUrl: string;
  videoUrl?: string; // Rendered video URL for playback
  type: string; // 'process' | 'chart' | 'diagram' etc.
  description: string;
  width: number;
  height: number;
  fps: number;
  /** How this visual composites with speaker video. Defaults to 'pip' for backwards compat. */
  displayMode?: 'pip' | 'fullscreen' | 'overlay';
  /** Enter/exit transitions at segment boundaries */
  transition?: {
    enter: { type: 'cut' | 'fade' | 'zoom-in' | 'zoom-out'; durationMs: number };
    exit: { type: 'cut' | 'fade' | 'zoom-in' | 'zoom-out'; durationMs: number };
  };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat: add displayMode and transition to VisualItemData"
```

---

### Task 3: Update the Composition renderer for dynamic layout

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/Composition.tsx:251-591`

This is the core rendering change. The Composition currently decides layout once. We change it to decide per-frame based on whether a visual item exists at the current time and its `displayMode`.

**Step 1: Add transition interpolation helpers**

Add these helpers after the `buildSplitStyles` function (after line 249):

```typescript
/**
 * Calculate transition progress at a given time.
 * Returns 0 before transition starts, 0-1 during, 1 after.
 */
function getTransitionProgress(
  currentTimeMs: number,
  transitionStartMs: number,
  transitionDurationMs: number,
): number {
  if (transitionDurationMs <= 0) return 1;
  const elapsed = currentTimeMs - transitionStartMs;
  if (elapsed <= 0) return 0;
  if (elapsed >= transitionDurationMs) return 1;
  // Ease-out cubic for smooth transitions
  const t = elapsed / transitionDurationMs;
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Find the visual item active at a given time (ms).
 * Returns null during speaker-only gaps.
 */
function findActiveVisualItem(
  visualItems: TimelineItem[],
  currentTimeMs: number,
): TimelineItem | null {
  for (const item of visualItems) {
    if (currentTimeMs >= item.startMs && currentTimeMs < item.endMs) {
      return item;
    }
  }
  return null;
}
```

**Step 2: Refactor the Composition component to use per-frame layout switching**

Replace the layout decision block (the section from the comment `// Determine layout based on mode` at line 313 down through the JSX return at line 591) with a new implementation that:

1. Uses `useCurrentFrame()` to get the current frame
2. Finds the active visual item at the current time
3. Reads `displayMode` from the active item (defaulting to project-level `layoutSettings.mode`)
4. Renders differently per mode:
   - No active visual → fullscreen video (speaker-only gap)
   - `displayMode === 'fullscreen'` → fullscreen visual, hide video
   - `displayMode === 'pip'` → fullscreen visual + PiP video bubble
   - `displayMode === 'overlay'` → fullscreen video + visual layer on top at 0.7 opacity
5. Applies enter/exit transitions (opacity interpolation for fade, scale for zoom)

The key change is: instead of one `videoContainerStyle` and `visualContainerStyle` computed once, we compute them per-frame inside a wrapper component that uses `useCurrentFrame()`.

Create a new `DynamicLayoutWrapper` component that wraps the visual and video layers:

```typescript
function DynamicLayoutWrapper({
  visualItems,
  videoItems,
  audioItems,
  fps,
  layoutSettings,
  videoSettings,
  sourceDimensions,
  isAudioProject,
  hasSeparateAudio,
}: {
  visualItems: TimelineItem[];
  videoItems: TimelineItem[];
  audioItems: TimelineItem[];
  fps: number;
  layoutSettings: LayoutSettings;
  videoSettings: any;
  sourceDimensions: { width: number; height: number };
  isAudioProject: boolean;
  hasSeparateAudio: boolean;
}) {
  const frame = useCurrentFrame();
  const currentTimeMs = (frame / fps) * 1000;

  const activeVisualItem = findActiveVisualItem(visualItems, currentTimeMs);
  const visualData = activeVisualItem?.data as VisualItemData | undefined;
  const displayMode = visualData?.displayMode ?? 'pip'; // backwards compat
  const transition = visualData?.transition;

  // Calculate transition opacity for enter/exit
  let visualOpacity = 1;
  let videoOpacity = 1;

  if (activeVisualItem && transition) {
    const enterDuration = transition.enter?.durationMs ?? 0;
    const exitDuration = transition.exit?.durationMs ?? 0;

    if (transition.enter?.type === 'fade' && enterDuration > 0) {
      const enterProgress = getTransitionProgress(currentTimeMs, activeVisualItem.startMs, enterDuration);
      visualOpacity = Math.min(visualOpacity, enterProgress);
    }

    if (transition.exit?.type === 'fade' && exitDuration > 0) {
      const exitStart = activeVisualItem.endMs - exitDuration;
      const exitProgress = getTransitionProgress(currentTimeMs, exitStart, exitDuration);
      visualOpacity = Math.min(visualOpacity, 1 - exitProgress);
    }
  }

  // Audio projects: always fullscreen visuals, no video
  if (isAudioProject) {
    // ... existing audio project rendering (unchanged)
  }

  // Determine what to render based on active visual + displayMode
  const hasActiveVisual = !!activeVisualItem;
  const showVideoFullscreen = !hasActiveVisual || displayMode === 'overlay';
  const showVideoAsPip = hasActiveVisual && displayMode === 'pip';
  const showVisualFullscreen = hasActiveVisual; // all visual modes use fullscreen visual
  const hideVideo = hasActiveVisual && displayMode === 'fullscreen';

  // ... render accordingly
}
```

The exact implementation will be detailed in the code but follows this logic. The video layer renders in one of three states: fullscreen (gap or overlay), PiP bubble (pip mode), or hidden (fullscreen mode). The visual layer renders fullscreen whenever an active visual item exists, with opacity modulated for overlay mode (0.7) and transitions.

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/player/Composition.tsx
git commit -m "feat: dynamic layout switching in Composition renderer based on per-item displayMode"
```

---

### Task 4: Update Director system prompt with dynamic layout instructions

**Files:**
- Modify: `packages/api/src/agent/agent-system-prompt.ts:1-111`

**Step 1: Add dimension awareness to the ProjectContext interface and system prompt**

Add `sourceWidth` and `sourceHeight` to the `ProjectContext` interface:

```typescript
interface ProjectContext {
  projectId: string;
  title: string | null;
  projectType?: string;
  canvasWidth: number;
  canvasHeight: number;
  sourceWidth?: number;   // NEW
  sourceHeight?: number;  // NEW
  durationMs: number | null;
  fps: number;
  hasTranscript: boolean;
  hasVisuals: boolean;
  sceneCount: number;
}
```

**Step 2: Compute coverage ratio and inject layout strategy into the system prompt**

After the `PROJECT:` section, add a `DYNAMIC LAYOUT:` section that calculates the coverage ratio and tier, then provides guidance:

```typescript
// Inside buildSystemPrompt, after the PROJECT block:
const coverage = (!isAudio && ctx.sourceWidth && ctx.sourceHeight)
  ? coverageRatio(ctx.sourceWidth, ctx.sourceHeight, ctx.canvasWidth, ctx.canvasHeight)
  : 1.0;
const tier = getCoverageTier(coverage);

// Then include in the prompt string:
`
DYNAMIC LAYOUT:
Each scene has a displayMode controlling how animation and speaker video compose:
- fullscreen: Animation fills entire canvas, speaker hidden. Use for concepts, data, metaphors.
- pip: Animation fills canvas, speaker in corner bubble. Balanced default.
- overlay: Animation composited on top of speaker with transparency. Use for light reinforcement — floating icons, annotations, subtle motion.
- To show the speaker alone, leave a GAP between scenes (no scene for that time range).

Transition types (enter/exit per scene):
- cut: Instant. Fast-paced moments. (default)
- fade: Crossfade 300-500ms. Emotional or tonal shifts.
- zoom-in: Zoom into visual. Drilling into detail.
- zoom-out: Zoom out to reveal. Bigger picture.

Source video: ${ctx.sourceWidth}x${ctx.sourceHeight}
Canvas: ${ctx.canvasWidth}x${ctx.canvasHeight}
Speaker coverage when fullscreen: ${Math.round(coverage * 100)}% (${tier} strategy)
${tier === 'conservative' ? `- Minimize speaker-only gaps (heavy crop when speaker fills ${ctx.canvasWidth}x${ctx.canvasHeight} canvas).
- Prefer overlay mode. Reserve gaps for critical emotional moments only (1-2s max).` :
tier === 'moderate' ? `- Use speaker-only gaps sparingly (2-4 seconds max).
- Prefer overlay to keep visual context alongside the cropped speaker.` :
`- Speaker-only gaps look natural. Use freely for personal moments and transitions.
- All display modes available without restriction.`}

Rules:
- Scenes need NOT cover the full video. Gaps = speaker fullscreen.
- Align boundaries to sentence/phrase breaks in transcript.
- No single mode >10 seconds.
- Start with gap or pip (establish speaker). End with fullscreen or pip.
- For overlay scenes: describe visuals that work with transparency (no opaque backgrounds).
`
```

**Step 3: Remove or adjust the existing `LAYOUTS:` line**

The existing line `LAYOUTS: pip (visuals fullscreen, video overlay), split-vertical (stacked top/bottom)` should be updated to reflect that layout is now per-scene rather than global.

**Step 4: Commit**

```bash
git add packages/api/src/agent/agent-system-prompt.ts
git commit -m "feat: add dynamic layout and dimension-aware strategy to Director system prompt"
```

---

### Task 5: Update plan_visuals tool to pass source dimensions and coverage

**Files:**
- Modify: `packages/api/src/agent/agent-tools.ts:596-719` (plan_visuals tool)

**Step 1: Pass source video dimensions to the Director via the plan job**

In the `plan_visuals` tool handler (line 604), after fetching the project, compute the coverage ratio and include source dimensions in the queue data. The plan worker processor needs to receive these to inject into the Director's context.

Add `sourceWidth` and `sourceHeight` to the data passed to `queuePlanVisualsJob`:

```typescript
await queuePlanVisualsJob({
  projectId: ctx.projectId,
  jobId: job.id,
  stylePreset,
  layoutMode: isAudioProject ? 'pip' : layoutMode,
  dimensions,
  styleGuide,
  sourceWidth: project.sourceWidth,   // NEW
  sourceHeight: project.sourceHeight, // NEW
});
```

**Step 2: Update PlanVisualsJobData in queue.ts**

Add `sourceWidth?` and `sourceHeight?` to `PlanVisualsJobData` in `packages/api/src/services/queue.ts:136-143`:

```typescript
export interface PlanVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'apple' | 'google' | 'studio';
  layoutMode: VisualsLayoutMode;
  dimensions: VisualsDimensions;
  styleGuide?: string;
  sourceWidth?: number;   // NEW
  sourceHeight?: number;  // NEW
}
```

**Step 3: Commit**

```bash
git add packages/api/src/agent/agent-tools.ts packages/api/src/services/queue.ts
git commit -m "feat: pass source dimensions through plan_visuals pipeline for coverage calculation"
```

---

### Task 6: Update plan-visuals worker to pass dimensions to Director subprocess

**Files:**
- Modify: `packages/worker/src/processors/plan-visuals.ts:33-44,185-197,240-265`

**Step 1: Add sourceWidth/sourceHeight to PlanVisualsJobData**

Update the interface (line 33-44):

```typescript
export interface PlanVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'apple' | 'google' | 'studio';
  layoutMode: 'pip' | 'split-horizontal' | 'split-vertical';
  dimensions: { width: number; height: number };
  styleGuide?: string;
  sourceWidth?: number;   // NEW
  sourceHeight?: number;  // NEW
}
```

**Step 2: Pass source dimensions to DirectorPhaseOptions and subprocess args**

Add `sourceWidth` and `sourceHeight` to `DirectorPhaseOptions` (line 185-197):

```typescript
interface DirectorPhaseOptions {
  // ... existing fields
  sourceWidth?: number;  // NEW
  sourceHeight?: number; // NEW
}
```

Pass them into the `runDirectorPhase` call (line 125-137):

```typescript
const planData = await runDirectorPhase({
  // ... existing fields
  sourceWidth: job.data.sourceWidth,   // NEW
  sourceHeight: job.data.sourceHeight, // NEW
});
```

Add to the subprocess args array (line 240-265):

```typescript
if (options.sourceWidth && options.sourceHeight) {
  args.push('--source-width', String(options.sourceWidth));
  args.push('--source-height', String(options.sourceHeight));
}
```

The Python Director script receives these args and includes them in its prompt context. The Director agent then uses the coverage tier guidance from the system prompt to decide displayMode per scene.

**Step 3: Commit**

```bash
git add packages/worker/src/processors/plan-visuals.ts
git commit -m "feat: pass source video dimensions to Director subprocess for coverage-aware layout planning"
```

---

### Task 7: Update generate-visuals to store displayMode on timeline items

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals.ts:731-749`

**Step 1: Read displayMode and transition from plan scenes and write them to timeline items**

The scene metadata already flows through `metadata.visuals`. We need the plan scenes (from planData) to include `displayMode` and `transition`, then propagate them to the timeline items.

Update the timeline item creation loop (line 731-749):

```typescript
// Create one timeline item per scene so they appear as separate blocks on the track
for (const scene of metadata.visuals) {
  await tx.insert(timelineItems).values({
    trackId: visualsTrack.id,
    type: 'visual',
    startMs: scene.startMs,
    endMs: scene.endMs,
    data: {
      visualId,
      compositionId: metadata.compositionId,
      bundleUrl,
      type: scene.type || 'visual',
      description: scene.description || 'AI-generated visual',
      width: metadata.width,
      height: metadata.height,
      fps: metadata.fps,
      displayMode: scene.displayMode || 'pip',       // NEW
      transition: scene.transition || undefined,       // NEW
    },
  });
}
```

**Step 2: Ensure metadata.visuals carries displayMode from plan data**

The `VisualMetadata` interface (line 286-298) needs updating:

```typescript
interface VisualMetadata {
  compositionId: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  visuals: Array<{
    startMs: number;
    endMs: number;
    type: string;
    description: string;
    displayMode?: 'pip' | 'fullscreen' | 'overlay';    // NEW
    transition?: {                                       // NEW
      enter: { type: string; durationMs: number };
      exit: { type: string; durationMs: number };
    };
  }>;
}
```

The metadata is built from `scenes.json` which the Director writes. Since the Director now includes `displayMode` and `transition` per scene, these flow through naturally.

**Step 3: Commit**

```bash
git add packages/worker/src/processors/generate-visuals.ts
git commit -m "feat: propagate displayMode and transition from plan scenes to visual timeline items"
```

---

### Task 8: Update agent-router to pass source dimensions to system prompt

**Files:**
- Modify: `packages/api/src/agent/agent-router.ts`

**Step 1: Include sourceWidth and sourceHeight when building the system prompt context**

Find where `buildSystemPrompt` is called with the project context object. Add `sourceWidth` and `sourceHeight` from the project record:

```typescript
const systemPrompt = buildSystemPrompt({
  projectId: project.id,
  title: project.title,
  projectType: project.projectType,
  canvasWidth: videoSettings.canvasWidth ?? 1080,
  canvasHeight: videoSettings.canvasHeight ?? 1920,
  sourceWidth: project.sourceWidth,    // NEW
  sourceHeight: project.sourceHeight,  // NEW
  durationMs: project.durationMs,
  fps: project.fps || 30,
  hasTranscript: !!transcript,
  hasVisuals: !!visual,
  sceneCount,
});
```

**Step 2: Commit**

```bash
git add packages/api/src/agent/agent-router.ts
git commit -m "feat: pass source dimensions to agent system prompt for coverage calculation"
```

---

### Task 9: Update the plan widget to show displayMode and gaps

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

**Step 1: Update the scene_plan widget rendering**

In the plan widget (the `scene_plan` kind block), update the scene card rendering to:
1. Show a colored badge for each scene's displayMode (purple = fullscreen, blue = pip, orange = overlay)
2. Show gaps between scenes as "Speaker" segments with a green indicator

Find the scene rendering section in the plan widget and add displayMode badges:

```typescript
// Inside the scene card rendering:
const displayMode = scene.displayMode || 'pip';
const modeLabel = { pip: 'PiP', fullscreen: 'Fullscreen', overlay: 'Overlay' }[displayMode];
const modeColor = { pip: '#3b82f6', fullscreen: '#8b5cf6', overlay: '#f97316' }[displayMode];
```

Render a small badge next to the scene title showing the display mode.

**Step 2: Update mapScenesToWidget in agent-tools.ts to include displayMode**

In `mapScenesToWidget` (line 221-246 of agent-tools.ts), add `displayMode` and `transition` to the mapped scene object:

```typescript
return {
  // ... existing fields
  displayMode: s.displayMode || 'pip',         // NEW
  transition: s.transition || undefined,        // NEW
};
```

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx packages/api/src/agent/agent-tools.ts
git commit -m "feat: show displayMode badges and speaker gaps in plan review widget"
```

---

### Task 10: Update VisualRenderer to show displayMode on timeline

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/renderers/VisualRenderer.ts`

**Step 1: Add displayMode visual indicator**

Update the `draw` method to show a small mode badge based on `displayMode`:

```typescript
draw(ctx, item, rect, state): void {
  super.draw(ctx, item, rect, state);

  const data = item.data as VisualItemData;
  const { x, y, width, height } = rect;
  const displayMode = data.displayMode || 'pip';

  ctx.save();
  roundRect(ctx, x + 1, y + 1, width - 2, height - 2, 5);
  ctx.clip();

  // Mode-specific background gradient
  const colors = {
    pip: { start: 'rgba(59, 130, 246, 0.4)', end: 'rgba(96, 165, 250, 0.25)' },       // Blue
    fullscreen: { start: 'rgba(139, 92, 246, 0.4)', end: 'rgba(168, 85, 247, 0.25)' }, // Purple (current default)
    overlay: { start: 'rgba(249, 115, 22, 0.4)', end: 'rgba(251, 146, 60, 0.25)' },    // Orange
  }[displayMode] || { start: 'rgba(139, 92, 246, 0.4)', end: 'rgba(168, 85, 247, 0.25)' };

  const grad = ctx.createLinearGradient(x, y, x + width, y + height);
  grad.addColorStop(0, colors.start);
  grad.addColorStop(1, colors.end);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, width, height);

  // ... existing sparkle pattern (keep as-is) ...

  ctx.restore();

  // Mode-colored accent line on top edge
  const accentColor = { pip: '#3b82f6', fullscreen: '#8b5cf6', overlay: '#f97316' }[displayMode] || '#8b5cf6';
  ctx.fillStyle = accentColor;
  roundRect(ctx, x, y, width, 2, 0);
  ctx.fill();

  // Label: show displayMode + type
  if (width > 80) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const modeTag = displayMode === 'pip' ? '' : `[${displayMode.toUpperCase()}] `;
    const label = `${modeTag}${data.type || 'Visual'}`;
    ctx.fillText(label.substring(0, 25), x + 8, y + height / 2, width - 16);
  }
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/canvas/renderers/VisualRenderer.ts
git commit -m "feat: color-coded displayMode indicator on visual timeline items"
```

---

### Task 11: Add displayMode editing via context menu and properties panel

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx`
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts` (add `updateVisualDisplayMode` action)

**Step 1: Add a store action for updating visual item displayMode**

In `editor-store.ts`, add a new action:

```typescript
updateVisualDisplayMode: (itemId: string, displayMode: 'pip' | 'fullscreen' | 'overlay') => {
  set(produce((state) => {
    const item = state.items[itemId];
    if (item?.type === 'visual') {
      (item.data as VisualItemData).displayMode = displayMode;
    }
  }));
  get().pushHistory();
},
```

**Step 2: Add "Display Mode" submenu to the visual item context menu**

When right-clicking a visual item, show a submenu with three options:
- PiP (speaker in corner)
- Fullscreen (animation only)
- Overlay (animation over speaker)

Each option calls `updateVisualDisplayMode(itemId, mode)`.

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat: add displayMode context menu for visual items"
```

---

### Task 12: Update update_plan tool to handle displayMode changes

**Files:**
- Modify: `packages/api/src/agent/agent-tools.ts:392-594` (update_plan tool)

**Step 1: Add displayMode and transition to the update action schema**

In the `sceneUpdates` Zod schema (line 405-420), add:

```typescript
// For "update" action — add displayMode and transition
displayMode: z.enum(['pip', 'fullscreen', 'overlay']).optional().describe('Display mode for this scene'),
transition: z.object({
  enter: z.object({
    type: z.enum(['cut', 'fade', 'zoom-in', 'zoom-out']),
    durationMs: z.number(),
  }),
  exit: z.object({
    type: z.enum(['cut', 'fade', 'zoom-in', 'zoom-out']),
    durationMs: z.number(),
  }),
}).optional().describe('Enter/exit transition config'),
```

**Step 2: Handle displayMode and transition in the "update" action case**

In the `case 'update'` block (line 466-471), add:

```typescript
if (op.displayMode !== undefined) scene.displayMode = op.displayMode;
if (op.transition !== undefined) scene.transition = op.transition;
```

**Step 3: Commit**

```bash
git add packages/api/src/agent/agent-tools.ts
git commit -m "feat: support displayMode and transition in update_plan tool"
```

---

### Task 13: End-to-end integration test

**Files:**
- No new files — manual testing

**Step 1: Test the full flow**

1. Start dev environment: `pnpm dev`
2. Open a project with a video and transcript
3. Open the AI Assistant panel
4. Ask the agent to plan visuals — verify the plan includes `displayMode` per scene and gaps
5. Approve the plan and generate
6. Verify the timeline shows color-coded visual items with displayMode badges
7. Verify the player renders correctly:
   - Gaps between visual items → speaker fullscreen
   - `fullscreen` items → animation fills screen, no speaker
   - `pip` items → animation fills screen, speaker in corner
   - `overlay` items → speaker fills screen, animation on top
8. Right-click a visual item → change display mode → verify instant preview update
9. Ask the agent to "show just me when I talk about X" → verify it adjusts the plan

**Step 2: Test backwards compatibility**

1. Open an existing project with previously generated visuals
2. Verify it renders identically (all visual items default to `pip` when no `displayMode` is set)
3. Verify no errors in console

**Step 3: Test dimension awareness**

1. Create a project with a landscape video (16:9) on a portrait canvas (9:16)
2. Plan visuals → verify the Director uses conservative layout strategy (fewer gaps, more overlay)
3. Create a project with a portrait video (9:16) on a portrait canvas (9:16)
4. Plan visuals → verify the Director uses flexible strategy (more speaker gaps)

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: dynamic layout segments — per-scene displayMode with dimension-aware AI planning"
```

---

## Task Dependency Graph

```
Task 1 (shared types) ──┬──→ Task 2 (editor types) ──→ Task 3 (Composition renderer)
                        │                              ──→ Task 10 (VisualRenderer)
                        │                              ──→ Task 11 (context menu)
                        ├──→ Task 4 (system prompt) ──→ Task 8 (agent-router)
                        ├──→ Task 5 (plan_visuals tool) ──→ Task 6 (worker processor)
                        │                                ──→ Task 7 (generate-visuals)
                        └──→ Task 9 (plan widget)
                            Task 12 (update_plan tool)
                            Task 13 (integration test) — depends on all above
```

Tasks 2-12 can be parallelized in groups:
- **Group A (types + renderer):** Tasks 1 → 2 → 3 → 10 → 11
- **Group B (backend pipeline):** Tasks 4 → 5 → 6 → 7 → 8
- **Group C (UI + agent):** Tasks 9 → 12
- **Group D (test):** Task 13 (after all others)
