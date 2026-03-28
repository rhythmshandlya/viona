# Pipeline Run Observations — Project c37faee0

**Project:** c37faee0-6deb-4769-963e-a5ab7207dc2f (RAW-12)
**Date:** 2026-03-20
**Source:** 2160x3840 (9:16 portrait), 41.7s, 60fps
**Canvas:** 1080x1920

---

## Issue 1: Hardcoded fps=30 in 2 of 4 Scene Files (Critical)

**Affected files:**
- `/workspace/src/scenes/NinetyDaysPromise.tsx:8` — `const fps = 30;`
- `/workspace/src/scenes/CTAKeyword.tsx:36` — `const fps = 30;`

**Correct files:**
- `/workspace/src/scenes/ProductCriteriaChecklist.tsx:9` — `const { fps, durationInFrames } = useVideoConfig();`
- `/workspace/src/scenes/ProvenPattern.tsx:7` — `const { fps, durationInFrames } = useVideoConfig();`

**Project fps:** 60 (from manifest.json)

**Impact:**
- `spring()` uses the fps parameter to calculate physical simulation timing. At fps=30 but actual playback at 60fps, springs settle in **half the expected time**.
- `NinetyDaysPromise.tsx` also hardcodes `const totalFrames = 90` instead of using `durationInFrames`. At 60fps, scene duration 3000ms = 180 frames. The exit animation starts at frame 82 instead of 172 — exits at the **midpoint** of the scene instead of the end.

**Root cause:** Animators 1 and 4 didn't use `useVideoConfig()` to get fps/durationInFrames. This is an inconsistency in how different animator instances handle configuration.

**Fix for prompt:** Add to CLAUDE.md or coding rules:
```
ALWAYS use `const { fps, durationInFrames } = useVideoConfig();` — NEVER hardcode fps or frame counts.
```

---

## Issue 2: Trim Editor Fabricated User Preference (Medium)

**File:** `/workspace/docs/trim-report.md`

The Trim Editor report states:
> "Per user preference, **no zoom punch-ins** were applied."

The user never expressed this preference. Their actual direction was:
- "social content"
- "clean and professional"
- "pick liquid glass"

The Trim Editor either:
1. Hallucinated a preference that doesn't exist
2. Inferred "clean and professional" = "no punch-ins" (incorrect interpretation)
3. Lacked the creative brief context entirely (most likely — brief was never passed in the Task prompt)

**Impact:** The Trim Editor should have applied alternating zoom punch-ins per the trim-editor prompt. However, the Layout Editor later applied punch-ins correctly, so the final output is not affected.

**Root cause:** Orchestrator Phase 2 dispatch instructions don't include the user's creative brief/preferences. See Issue #1 in `2026-03-20-orchestrator-context-gathering-failure.md`.

---

## Issue 3: No Zoom-to-Fill Applied (Expected — Not a Bug)

The source video is 2160x3840 (exactly 9:16 ratio) on a 1080x1920 canvas (also 9:16). Zoom-to-fill is not needed because the aspect ratios match. The Layout Editor correctly skipped this step.

The first video segment has no crop: `{ src: "source.mp4", startFrom: 0, volume: 0, playbackRate: 1 }` — correct for an already-matching aspect ratio.

---

## Issue 4: Punch-ins and Multi-Angle Cuts Applied Correctly

The Layout Editor successfully applied the SCENE_PLAN.md punch-in specification:

| Timeline | Crop | Plan Match |
|----------|------|------------|
| 11500-18500ms | {x:50, y:40, scale:1.3} | ✅ matches "emphasis on credibility" |
| 18500-20800ms | {x:50, y:40, scale:1.25} | ✅ matches "closing reinforcement" |
| 20800-23000ms | {x:45, y:42, scale:1.1} | ✅ matches "angle shift before transition" |

---

## Issue 5: Scene 1 Exit Animation Timing Bug (Critical)

**File:** `/workspace/src/scenes/NinetyDaysPromise.tsx`

```typescript
const fps = 30;         // BUG: should be useVideoConfig()
const totalFrames = 90; // BUG: should be durationInFrames from useVideoConfig()

// Exit fade calculation
const exitStartFrame = totalFrames - 8; // = 82
```

At 60fps, scene duration = 3000ms = 180 frames. The exit animation:
- **Expected:** Starts at frame 172, ends at frame 180 (last 133ms)
- **Actual:** Starts at frame 82, ends at frame 90 (at 1367ms — MIDPOINT of scene)

This means the "90 DAYS" card will fade out halfway through the scene, then be invisible for the remaining 1.5 seconds while the scene container is still active.

---

## Issue 6: SSE Disconnect During Review Phase

After the 4 animators completed, the orchestrator entered Phase 7 (Review) and started rendering stills. The SSE client disconnected:
```
{"time":1773982764104,"msg":"SSE client disconnected — orchestrator continues"}
```

The orchestrator continued running (trigger_rebuild, render_stills) but there was a 240-second gap between messages (1773982764 → 1773983004). This suggests either:
1. Render stills took very long (3-4 renders at ~60s each)
2. The SDK was blocked waiting for an API response

The orchestrator eventually resumed (message 2631+) but the frontend lost the connection, meaning the user saw no progress updates during this critical review phase.

---

## Overall Pipeline Health

### Timeline
| Phase | Agent | Duration | Tool Calls | Status |
|-------|-------|----------|------------|--------|
| 1 | Viona | ~2 min | 2 | ✅ (but skipped context on first turn) |
| 2 | Trim Editor | ~3.3 min | ~15 | ✅ |
| 3 | Planner | ~3 min | ~12 | ✅ |
| Plan Approval | User | ~2 min | — | ✅ |
| 4 | Setup Agent | ~8 min | ~35 | ✅ |
| 5 | Layout Editor | ~4 min | ~30 | ✅ |
| 6 | Animators (x4) | ~8 min | ~50 | ✅ (but fps bugs in 2/4) |
| 7 | Review | ongoing | ~50+ | In progress |

### What Worked Well
- Planner produced a solid 4-scene plan with good variety
- Layout Editor correctly split video, applied punch-ins, created overlay track
- Setup Agent created proper shared components (GlassCard with liquid glass, Background, CheckIcon)
- Constants.ts has proper spring vocabulary (SNAPPY, SMOOTH, BOUNCY, HEAVY)
- All 4 scenes import shared components and use the design system
- Scenes 2 and 3 correctly use `useVideoConfig()` for fps

### What Needs Fixing
1. **Prompt-level:** Add `useVideoConfig()` mandate to CLAUDE.md / coding rules
2. **Prompt-level:** Pass creative brief to Trim Editor dispatch
3. **Code-level:** Fix fps/totalFrames in NinetyDaysPromise.tsx and CTAKeyword.tsx
