# Dynamic Layout Segments Design

**Date:** 2026-02-19
**Status:** Approved

## Problem

Viona currently uses a fixed layout mode (PiP, split, or full-canvas) for the entire video. This produces static, predictable compositions. Professional short-form video alternates between showing the speaker, showing visuals, and combining both — switching dynamically based on content. We need the same capability.

## Capabilities

1. **Speaker breaks** — animation pauses, speaker takes full screen
2. **Animation only** — speaker hidden, animation fills screen
3. **Overlay** — animation composited on top of speaker video
4. **Transcript-driven timing** — AI Director picks optimal switch points
5. **Direct editing** — users adjust layout via existing timeline interactions
6. **Dimension-aware** — layout strategy adapts to source-to-canvas aspect ratio fit

## Approach: Visual Items as Layout Control

In professional editors (Premiere, DaVinci, Final Cut), layout is not a separate track. What you see is determined by which clips exist on which layers and when. A gap on an upper layer reveals the layer below.

Viona already has this structure: visual items sit on a visual track above the video track. We extend this by adding a `displayMode` property to visual items and allowing gaps between them.

| Timeline state at time T | What renders |
|---|---|
| Visual item with `displayMode: 'fullscreen'` | Animation fills screen, speaker hidden |
| Visual item with `displayMode: 'pip'` | Animation fills screen, speaker in PiP corner |
| Visual item with `displayMode: 'overlay'` | Animation composited on top of speaker |
| **Gap** — no visual item | Speaker fills screen (natural) |

"Speaker-only" is not a mode — it is the absence of a visual item. Trimming, splitting, or deleting visual items creates speaker-only gaps naturally, using the same interactions the timeline already supports.

---

## Data Model

### Visual Item Extension

```typescript
// Added to existing VisualItemData in store/types.ts
interface VisualItemData {
  // ... existing fields (visualId, compositionId, bundleUrl, etc.)
  displayMode: 'pip' | 'fullscreen' | 'overlay';   // NEW
  transition?: {                                      // NEW
    enter: { type: TransitionType; durationMs: number };
    exit: { type: TransitionType; durationMs: number };
  };
}

type TransitionType = 'cut' | 'fade' | 'zoom-in' | 'zoom-out';
```

### Scene Plan Extension

```typescript
// Added to scene objects in scenes.json
interface Scene {
  // ... existing fields (id, name, visual, timestampRange, etc.)
  displayMode: 'pip' | 'fullscreen' | 'overlay';     // NEW
  transition?: {                                       // NEW
    enter: { type: TransitionType; durationMs: number };
    exit: { type: TransitionType; durationMs: number };
  };
}
```

### Defaults & Backwards Compatibility

- `displayMode` defaults to `'pip'` (backwards compatible with current behavior)
- `transition` defaults to `{ enter: { type: 'cut', durationMs: 0 }, exit: { type: 'cut', durationMs: 0 } }`
- Existing projects with no `displayMode` on their visual items render as `'pip'` — zero breakage
- No migration needed

---

## Dimension Awareness

### The Problem

When the speaker goes fullscreen during a gap, the source video must fill the entire canvas. If the source aspect ratio doesn't match the canvas, the result is heavy cropping via the existing cover-fill crop/pan system.

| Source → Canvas | Visible Area | Quality |
|---|---|---|
| 16:9 → 9:16 | ~31% of source frame | Poor — heavy crop |
| 4:3 → 9:16 | ~42% of source frame | Poor |
| 1:1 → 9:16 | ~56% of source frame | Moderate |
| 9:16 → 9:16 | 100% | Perfect |
| 16:9 → 16:9 | 100% | Perfect |

### Coverage Ratio

We calculate a **coverage ratio** — what percentage of the source frame is visible when it fills the canvas with cover-fit:

```typescript
function coverageRatio(sourceW: number, sourceH: number, canvasW: number, canvasH: number): number {
  const sourceAR = sourceW / sourceH;
  const canvasAR = canvasW / canvasH;
  if (sourceAR > canvasAR) {
    // Source is wider than canvas — cropped horizontally
    return canvasAR / sourceAR; // e.g., (9/16) / (16/9) = 0.316
  } else {
    // Source is taller than canvas — cropped vertically
    return sourceAR / canvasAR;
  }
}
```

### Director Strategy Tiers

The coverage ratio is passed to the Director as context. The Director adjusts its layout strategy:

| Coverage | Tier | Strategy |
|---|---|---|
| **> 80%** | Great match | Gaps look natural. Use speaker-only breaks freely. All display modes available. |
| **50–80%** | Moderate | Use speaker-only gaps sparingly (2-4 seconds max). Prefer `overlay` to keep visual context alongside the cropped speaker. `pip` as baseline. |
| **< 50%** | Poor match | Minimize speaker-only gaps — only for critical emotional moments (1-2 seconds). Prefer `overlay` heavily. `pip` as baseline. Speaker-only should feel intentional, not accidental. |
| **No video** | Audio-only | Skip layout planning entirely. All scenes fullscreen. Gaps render as background. |

### System Prompt Input

The Director receives this as part of its context:

```
Source video: 1920x1080 (16:9 landscape)
Canvas: 1080x1920 (9:16 portrait)
Speaker coverage when fullscreen: 31% (poor match — landscape source on portrait canvas)

Layout strategy: CONSERVATIVE
- Minimize speaker-only gaps. When the speaker is shown fullscreen,
  only ~31% of the original frame is visible (heavy center-crop).
- Prefer overlay mode to keep visual context alongside the speaker.
- Use pip as the default baseline.
- Reserve speaker-only gaps for critical emotional moments only (1-2s max).
```

Or for a good match:

```
Source video: 1080x1920 (9:16 portrait)
Canvas: 1080x1920 (9:16 portrait)
Speaker coverage when fullscreen: 100% (perfect match)

Layout strategy: FLEXIBLE
- Speaker-only gaps look natural. Use them freely for personal moments,
  transitions, and emotional beats.
- All display modes available without restriction.
```

---

## Director Integration (Planning Phase)

The Director already analyzes the transcript to create scenes. We extend its responsibilities:

1. Director reads transcript with word-level timestamps (existing)
2. **NEW:** Director receives source/canvas dimensions and coverage ratio
3. Director creates scenes with visual descriptions (existing)
4. **NEW:** Director assigns `displayMode` per scene based on content + coverage tier
5. **NEW:** Director leaves intentional gaps between scenes for speaker-only moments (when coverage allows)

### Display Mode Selection Heuristics

| Content Signal | Great Match (>80%) | Poor Match (<50%) |
|---|---|---|
| Concrete nouns, visual concepts, data | `fullscreen` | `fullscreen` |
| Personal statements, emotion, direct address | Gap (speaker-only) | `overlay` (speaker stays visible with light animation) |
| Lists, processes, explanations | `overlay` | `overlay` |
| General narration | `pip` | `pip` |
| Emphasis, dramatic pause | Gap (1-3s) | Gap (1-2s max) or `pip` |

### Pacing Rules

- No single mode should run longer than ~8-10 seconds without a switch
- Align scene/gap boundaries to sentence or phrase boundaries in the transcript
- Start with a gap or `pip` (establish the speaker first) — unless coverage is poor, then start with `pip`
- End with `fullscreen` or `pip` (visual punctuation)

### System Prompt Addition

```
## Dynamic Layout

Each scene has a displayMode controlling how animation and speaker video compose:
- fullscreen: Animation fills entire canvas, speaker hidden. Use when the visual
  needs full attention — concepts, data visualization, metaphors.
- pip: Animation fills canvas, speaker in corner bubble. Balanced default.
- overlay: Animation composited on top of speaker with transparency. Use for
  light reinforcement — icons, subtle motion, annotations.
- To show the speaker alone, leave a GAP between scenes. No scene needed.

Transition types (enter/exit per scene):
- cut: Instant switch. Fast-paced, high-energy moments.
- fade: Crossfade (300-500ms). Tonal or emotional shifts.
- zoom-in: Zoom into incoming visual. Drilling into detail.
- zoom-out: Zoom out to reveal. Bigger-picture reveals.

DIMENSION AWARENESS:
You will be told the speaker coverage ratio and layout strategy tier.
- FLEXIBLE (>80% coverage): Speaker-only gaps look great. Use freely.
- MODERATE (50-80%): Speaker gaps 2-4 seconds max. Prefer overlay.
- CONSERVATIVE (<50%): Minimize gaps. 1-2 seconds max for critical
  moments. Overlay is your primary tool for showing the speaker.

Rules:
- Scenes need NOT cover the full video. Gaps = speaker fullscreen.
- Align boundaries to sentence/phrase breaks in transcript.
- No single mode >10 seconds. Keep it dynamic.
- Start with gap or pip (establish speaker). End with fullscreen or pip.
- For overlay scenes: describe visuals that work with transparency
  (no opaque backgrounds, use floating elements/icons/text).
```

### Plan Output Example (Good Match)

```
Source: 1080x1920, Canvas: 1080x1920, Coverage: 100% → FLEXIBLE

[0.0s - 2.8s]  GAP (speaker-only)     — "Hi everyone, I'm Sarah"
[2.8s - 7.2s]  Scene 1: fullscreen     — Growth metaphor animation
                enter: fade 400ms, exit: cut
[7.2s - 9.5s]  GAP (speaker-only)      — "Here's how we did it"
[9.5s - 15.0s] Scene 2: overlay        — Retention metrics floating over speaker
                enter: fade 300ms, exit: fade 300ms
[15.0s - 20.0s] Scene 3: fullscreen    — Process diagram
                 enter: cut, exit: fade 400ms
```

### Plan Output Example (Poor Match)

```
Source: 1920x1080, Canvas: 1080x1920, Coverage: 31% → CONSERVATIVE

[0.0s - 1.5s]  GAP (speaker-only)      — "Hi everyone" (brief, intentional)
[1.5s - 7.2s]  Scene 1: pip            — Growth metaphor, speaker in corner
                enter: fade 300ms, exit: cut
[7.2s - 12.0s] Scene 2: overlay        — Retention metrics over speaker
                enter: fade 300ms, exit: fade 300ms
[12.0s - 18.0s] Scene 3: fullscreen    — Process diagram (no speaker needed)
                 enter: zoom-in 400ms, exit: cut
[18.0s - 20.0s] Scene 4: overlay       — Closing thought with floating icons
                 enter: fade 300ms, exit: fade 400ms
```

Notice: poor match uses more overlay, fewer gaps, and the one gap is very short.

---

## Composition Renderer (Playback)

The `Composition.tsx` component currently applies one layout mode for the entire video. We change it to read per-item `displayMode` and handle gaps.

### Per-Frame Rendering Logic

```typescript
const currentTimeMs = (frame / fps) * 1000;
const activeVisualItem = visualItems.find(
  item => currentTimeMs >= item.startMs && currentTimeMs < item.endMs
);

if (!activeVisualItem) {
  // GAP — speaker fullscreen, no visual layer
  return <VideoLayer style={fullscreen} />;
}

const { displayMode, transition } = activeVisualItem.data;

switch (displayMode) {
  case 'fullscreen':
    return <VisualLayer style={fullscreen} />;

  case 'pip':
    return (
      <>
        <VisualLayer style={fullscreen} />
        <VideoLayer style={pipBubble} />
      </>
    );

  case 'overlay':
    return (
      <>
        <VideoLayer style={fullscreen} />
        <VisualLayer style={{ ...fullscreen, opacity: 0.7 }} />
      </>
    );
}
```

### Transition Rendering

At visual item boundaries (enter/exit), interpolate between states:

```typescript
const enterProgress = getTransitionProgress(
  currentTimeMs,
  item.startMs,
  item.data.transition?.enter.durationMs ?? 0
);

const exitProgress = getTransitionProgress(
  currentTimeMs,
  item.endMs - (item.data.transition?.exit.durationMs ?? 0),
  item.data.transition?.exit.durationMs ?? 0
);
```

| Transition | Visual Effect |
|---|---|
| `cut` | Instant — no interpolation |
| `fade` | Opacity 0→1 (enter) or 1→0 (exit) |
| `zoom-in` | Scale 1.3→1.0 with opacity 0→1 |
| `zoom-out` | Scale 0.7→1.0 with opacity 0→1 |

At segment boundaries:
- Outgoing item's exit transition controls how it leaves
- Incoming item's enter transition controls how it arrives
- During a gap, speaker is fullscreen with no interpolation

### Transition Clamping

Transition duration is clamped: `min(specifiedDuration, itemDurationMs / 2)`. A 200ms item cannot have a 400ms fade.

---

## Timeline UI Changes

No new track. The existing visual track and interactions handle everything.

### Display Mode Indicator

Each visual item on the canvas shows its mode visually:

| Mode | Visual Treatment |
|---|---|
| `fullscreen` | Solid purple fill (current default look) |
| `pip` | Purple fill with small camera icon badge |
| `overlay` | Hatched/semi-transparent purple fill |

### User Interactions

All existing interactions work naturally for layout editing:

| Action | Layout Effect |
|---|---|
| **Trim visual item edges** | Grows/shrinks speaker-only gaps |
| **Split visual item** | Two items; delete one half to create a gap |
| **Delete visual item** | Creates a speaker-only gap |
| **Drag visual item** | Repositions when the visual appears |
| **Click visual item** | Select; panel shows displayMode + transition controls |
| **Right-click** | Context menu: change display mode, change transitions |

### Display Mode Controls (on item select)

When a visual item is selected, the properties panel shows:

- **Display mode** dropdown: Fullscreen / PiP / Overlay
- **Enter transition** dropdown + duration slider
- **Exit transition** dropdown + duration slider

These edits update visual item data in the store → Composition re-renders immediately. No worker job.

---

## Pipeline Integration

### Plan Phase (plan-visuals.ts) — Modified

Input additions:
- Source video dimensions (already available from project)
- Canvas dimensions (already available from project settings)
- Computed coverage ratio and strategy tier

Output additions:
- Scenes include `displayMode` and `transition` fields
- Scenes may have gaps between them (not all time covered)

Validation:
- Scenes must not overlap
- Gaps are valid and intentional
- Each scene has a valid `displayMode`
- Transitions have reasonable durations (0-1000ms)

### Plan Review Widget — Modified

The plan widget shows the scene timeline with gaps visible:

```
[GAP ][Scene 1: fullscreen ][GAP ][Scene 2: overlay   ][Scene 3: fullscreen ]
 ▪▪▪▪  ████████████████████  ▪▪▪▪  ░░░░░░░░░░░░░░░░░░  █████████████████████
```

Each scene block shows its display mode. Gaps show as dotted/empty space labeled "Speaker". User approves or asks the agent to adjust.

### Generation Phase (generate-visuals.ts) — Minimal Changes

The Animator generates fullscreen compositions as today. Display mode is a rendering concern — the Animator does not need to handle it.

One optimization: overlay scenes should hint to the Animator that animations need transparency-friendly design (floating elements, no opaque backgrounds).

### Visual Item Creation — Modified

When generation completes and timeline items are created from scenes:

```typescript
for (const scene of plan.scenes) {
  createTimelineItem({
    type: 'visual',
    startMs: scene.timestampRange[0] * 1000,
    endMs: scene.timestampRange[1] * 1000,
    data: {
      ...existingVisualData,
      displayMode: scene.displayMode,
      transition: scene.transition,
    }
  });
}
// Gaps between scenes → no item → speaker fullscreen
```

### Agent Editing — Modified

The `update_plan` tool handles layout changes:

```typescript
// Change display mode
{ action: 'update', sceneId: 1, updates: { displayMode: 'overlay' } }

// Change transitions
{ action: 'update', sceneId: 1, updates: { transition: { enter: { type: 'fade', durationMs: 400 }, exit: { type: 'cut', durationMs: 0 } } } }

// Create a speaker gap by splitting a scene
{ action: 'split', sceneId: 1, atTimestamp: 5.0 }
// Then delete one half or shrink it

// Remove a gap by extending a scene's time range
{ action: 'update', sceneId: 1, updates: { timestampRange: [2.0, 10.0] } }
```

Natural language examples:
- "Show just me when I talk about my childhood" → finds timestamp → trims scene to create gap
- "Make the intro animation fullscreen" → updates displayMode
- "Add a fade when the data chart appears" → updates transition
- "Too many switches, simplify" → agent merges adjacent same-mode scenes, removes short gaps

---

## Edge Cases

### Audio-only projects
- No speaker video → display mode irrelevant
- Director skips layout planning entirely
- All scenes render fullscreen; gaps render as background color

### Short videos (< 5 seconds)
- Director creates 1-2 scenes max, at most one gap
- Pacing rules relax for short content

### Overlay opacity
- Default: 0.7 (animation 70% opaque over speaker)
- Can be extended to per-item `overlayOpacity` later if needed

### No source video dimensions available
- Default to FLEXIBLE strategy (assume good match)
- Coverage ratio = 1.0

---

## Files to Modify

| File | Change |
|---|---|
| `packages/shared/src/types/index.ts` | Add `DisplayMode`, `TransitionType`, `LayoutTransition` types |
| `apps/web/src/features/editor-v2/store/types.ts` | Add `displayMode`, `transition` to `VisualItemData` |
| `apps/web/src/features/editor-v2/player/Composition.tsx` | Per-frame display mode rendering, transition interpolation, gap handling |
| `packages/api/src/agent/agent-system-prompt.ts` | Dynamic layout instructions, dimension awareness, coverage tiers |
| `packages/api/src/agent/agent-tools.ts` | Pass dimensions/coverage to Director, handle new update_plan actions |
| `packages/worker/src/processors/plan-visuals.ts` | Compute coverage ratio, pass to Director, validate plan output |
| `packages/worker/src/processors/generate-visuals.ts` | Map scene displayMode/transition to visual item data |
| `apps/web/src/features/editor-v2/timeline/canvas/renderers/VisualRenderer.ts` | Display mode badge/indicator on timeline items |
| `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` | Plan widget shows gaps + display modes |

## Non-Goals (this iteration)

- Beat-sync / music-driven layout switching
- Per-item overlay opacity control (default 0.7)
- Automatic speaker detection for multi-speaker switching
- Split-screen display mode (existing separate feature)
