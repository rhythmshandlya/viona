# Pipeline Issues — 2026-03-16

Tracking issues found during investigation session (project `de6f1f8e-ccdd-47cf-8c20-ed9269d14d98`).

---

## Issue 1: Orchestrator asks redundant questions instead of reading transcript

**Severity:** UX / Prompt bug
**Phase:** Phase 1 (Brainstorming)
**File:** `packages/sandbox/src/prompts/orchestrator-system.md`

**What happened:**
- User said "This is a video for meta ads"
- AI asked "What's the hook? Give me the core message or product you're pushing" — but the product/hook is already clearly described in the transcript
- User had to tell the AI "The product is described in the transcript"
- AI then read the transcript and identified it correctly (swimming coaching ad)

**Root cause:**
The Phase 1 prompt (lines 68-77) says:
1. "one friendly greeting + ask the user to describe their vision" (line 68)
2. "Proactively ask about: content focus and key messages" (lines 72-73)
3. "Detect the content type by skimming `/workspace/docs/transcript.json`" (line 77)

The AI follows instruction 1-2 (ask questions) BEFORE doing instruction 3 (read transcript). It should read the transcript FIRST and only ask questions about things NOT already evident from the content.

**Fix needed:**
Reorder Phase 1 logic: read transcript first, then only ask questions about things that can't be inferred. If the transcript clearly shows the product/message, skip those questions.

---

## Issue 2: Progress bar lost on page refresh — no persistence for sandbox pipeline

**Severity:** Critical — user loses all progress feedback
**Phase:** Any active phase (trimming, planning, generating, etc.)
**Files:**
- `packages/api/src/agent/agent-router.ts` (lines 406-431 — activeJob check)
- `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` (lines 650-676 — history load)
- `apps/web/src/features/editor-v2/hooks/use-progress.ts` (all state is in-memory)

**What happened:**
1. User said "yes" — orchestrator started running (trimming → planning, ~80 second operation)
2. Progress bar was showing via live SSE stream
3. User refreshed the page
4. Progress bar disappeared completely — no indication anything was running
5. The assistant message in DB was empty `[]` (created at stream start, never updated before refresh)
6. Frontend filtered out the empty assistant message (line 676: `loaded.filter((m) => m.content.length > 0 || m.role !== 'assistant')`)
7. User saw conversation ending at their "yes" with zero response
8. User had to re-send "show the plan" to trigger the entire pipeline again from scratch

**Root cause — progress only exists in the live SSE stream:**

The progress restoration path on refresh:
1. `GET /agent/conversation` queries the **BullMQ `jobs` table** for `pending`/`processing` rows (lines 409-414)
2. If an active job exists, frontend attaches a progress block to the last assistant message (lines 653-672)
3. **But the sandbox orchestrator is NOT a BullMQ job** — it's a live `query()` SDK call running inside the sandbox container
4. So `activeJob` is **always null** for sandbox pipeline work
5. No active job → no progress block → empty assistant message → filtered out → blank UI

The `useProgress` hook (use-progress.ts) stores all progress state in React `useState` — purely in-memory. SSE events feed it, but nothing persists to DB or Redis. Refresh = total loss.

**The old worker pipeline doesn't have this problem** because it creates a BullMQ job row in the DB with `status: 'processing'` and `progress`/`progressMessage` fields that survive refresh.

**Fix needed:**
The sandbox pipeline needs a persistence mechanism for progress state so that `GET /agent/conversation` can return it after refresh. Options:
1. Write progress to a DB row or Redis key when `onProgress` fires in the proxy intercept, and read it back in the GET endpoint
2. Have the sandbox write `generation-progress.json` (it's already specced in the orchestrator prompt) and have the GET endpoint read it from the sandbox
3. Create a lightweight "sandbox job" row in the jobs table when the orchestrator starts, update it on progress events, so the existing `activeJob` logic works

---

## Issue 3: Progress widget is over-designed and misplaced

**Severity:** UX design problem
**Phase:** All pipeline phases
**Files:**
- `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` (progress block rendering)
- `apps/web/src/features/editor-v2/components/ProgressBar.tsx`

**Two problems:**

### 3A: Progress bar rendered inside chat bubble — should be separate

The progress widget is rendered INSIDE the assistant's chat message bubble, mixed with text and widgets. A chat bubble contains text + a health indicator ("Connected") + a full progress bar + more text + widgets. The progress bar is an operational status indicator — it doesn't belong in a conversational message. It should be a separate, persistent UI element (e.g. pinned to the top/bottom of the panel, or in a dedicated status area).

### 3B: Progress widget is too complex — phase dot timeline is redundant

The current widget has three layers saying the same thing:
1. Status text: "All done — ready for review" (tells you the phase + state)
2. Progress bar: 100% filled (tells you the progress)
3. Phase dot timeline: Plan → Animate → Verify → Bundle → Done (repeats what 1+2 already say)

The phase dot timeline (`ProgressBar.tsx:272-360`) with connecting lines, colored dots, and labels is redundant. The status message already communicates what phase you're in. A simple progress bar with status text is sufficient.

**Target design — minimal ambient indicator:**

Like Claude Code's pulsing dot when it's reasoning. A small, always-visible indicator that shows:
- An animated dot/orb (pulsing, breathing, or orbiting) that signals "AI is working"
- A small percentage: "55%"
- Optionally a one-line status: "Animating scenes..."

That's it. No progress bar. No phase dots. No connecting lines. No agent badges. Just a living indicator that tells you the AI is working and roughly how far along it is. When idle, it disappears or goes static.

**Fix needed:**
1. Remove progress from chat messages entirely
2. Replace `ProgressBar.tsx` with a minimal indicator component — animated dot + percentage + optional status text
3. Render it as a persistent element outside the message list (e.g. pinned at top of chat panel, or in the editor toolbar)

---

## Issue 4: Orchestrator leaks internal thinking into chat stream

**Severity:** UX — user sees AI talking to itself
**Phase:** Phase 2→3 (trimming + planning)

**What happened:**
The assistant message contains leaked internal status text that was never meant for the user:

> "Both agents are working. Let me check if they've completed. The agents are still working. Let me wait for them to complete. Both agents are progressing well. The Editor has trimmed the video to 64 seconds and the Planner is creating the visual plan. Let me wait a bit more for completion. The Planner has completed. Now let me read the scenes.json and show you the plan for approval. Now let me show you the plan for approval:"

This reads like the orchestrator's internal monologue — checking on subagents, waiting, narrating its own process. The prompt says "Output ZERO text before tool calls" and "Use thinking for ALL reasoning", but the orchestrator is outputting its reasoning as visible text.

**Root cause:**
The orchestrator's `processStream` in `orchestrator.ts` captures ALL `text_delta` events and forwards them via `callbacks.onText`. There's no filtering — any text the SDK model produces (including status updates between tool calls) gets streamed to the user.

**Fix needed:**
Either:
1. Improve the orchestrator prompt to be stricter about not outputting status text between tool calls
2. Or filter/suppress text that appears between tool call sequences (text that occurs after a tool result but before the next tool call is likely internal monologue)

---

## Issue 5: Duplicate scene plan widgets — plan shown 3 times

**Severity:** UX bug
**Phase:** Phase 3 (Planning)

**What happened:**
The assistant message contains THREE scene plan widgets:
1. First widget: "9 scenes · 1m 4s" (from first plan attempt?)
2. Second widget: "9 scenes · 1m 4s" (duplicate)
3. Third widget: "6 scenes · 1m 4s" (the actual final plan from scenes.json)

Each has its own "Approve & Generate" / "Revise" buttons. The user doesn't know which one to interact with.

**Root cause:**
The orchestrator called `mcp__widgets__show_widget` with kind `scene_plan` multiple times during the same turn. Possible causes:
- The orchestrator read scenes.json, built the widget, showed it, then re-read and showed it again
- The first attempt used a different scene count (9 beats before validation merged some into 6)
- The post-planner validation step (lines 137-146 in orchestrator prompt) may have fixed violations and re-shown the widget

**Fix needed:**
1. The orchestrator should only call show_widget ONCE per plan — after validation is complete
2. The frontend could deduplicate scene_plan widgets (only show the last one)
3. The orchestrator prompt should explicitly state: "Show the plan widget exactly ONCE after all validation passes"

---

## Issue 6: Plan quality is mediocre — planner lacks creative expertise

**Severity:** Product quality — the plan IS the ceiling for the final video
**Phase:** Phase 3 (Planning)
**Files:**
- `packages/sandbox/src/prompts/planner-system.md` (the planner's entire creative brain)
- `packages/sandbox/src/prompts/orchestrator-system.md` (lines 535-538 — the "70-80% stacked" rule)

**What happened:**
The generated plan for the swimming coaching Meta ad was generic and uninspired:
- Almost all beats used `stacked` layout (speaker bottom, visuals top) — every scene felt the same
- Visual descriptions were formulaic: "card with text and icon" patterns repeated
- No emotional arc — beats felt like a slide deck, not a story
- The hook was weak — no pattern interrupt, no bold visual moment
- No creative use of fullscreen for dramatic reveals (the rigid "1-2 max" rule prevented it)
- Overlay mode barely used despite being ideal for speaker credibility in an ad

**Root cause — two problems:**

### Problem A: The "70-80% stacked" blanket rule is wrong for ads

The orchestrator prompt (line 536) and planner prompt (line 95) both enforce:
> "Stacked: 70-80% of beats. Visuals on TOP, speaker on BOTTOM."

This makes sense for educational explainers (Kurzgesagt-style) where visuals ARE the content. But for **Meta ads** and other short-form content:
- Ads need dramatic variety to hold attention in a scroll-past environment
- The speaker IS the product — they should dominate more beats (overlay mode)
- Fullscreen moments create "pattern interrupts" that stop the scroll — limiting to 1-2 is counterproductive for ads
- TikTok/Meta best practices: hook must be a pattern interrupt in the first 3 seconds (not a polite stacked layout)

The correct ratio depends on **content type**, not a blanket rule:
| Content Type | Stacked | Fullscreen | Overlay |
|-------------|---------|------------|---------|
| Educational explainer | 70-80% | 1-2 beats | 10-20% |
| Meta/TikTok ad | 30-40% | 20-30% | 30-40% |
| Product demo | 50-60% | 20-30% | 15-25% |
| Brand story | 40-50% | 15-20% | 30-40% |
| Tutorial | 70-80% | 5-10% | 10-20% |

### Problem B: The planner has no creative direction expertise

The planner prompt says "You are a senior creative director with 15 years experience" but doesn't actually embed creative direction knowledge. It has structural rules (sync points, frame counts, segment grouping) but nothing about:

1. **Emotional arc engineering** — the planner doesn't understand Hook → Build → Peak → Resolve timing or how to map emotional energy to beat intensity. Sourced from the motion-designer skill's "Motion Design Arc" and the storytelling-flow rules which define energy curves (High → Low → Build → Peak → Resolve).

2. **Hook psychology** — ads need a "pattern interrupt" in the first 3 seconds: a bold claim, a surprising visual, a question that creates a curiosity gap. The current 3-second rule only says "striking visual + motion from frame 0" — it doesn't understand WHY hooks work (curiosity gaps, identity triggers, open loops). Sourced from the youtube-video-analyst skill's Hook Architecture section and the tiktok-ads skill's "Hook (0-3s): Pattern interrupt; question; bold statement".

3. **Retention mechanics** — the planner doesn't use open loops, cliffhangers, or payoff points to keep viewers watching. Each beat is self-contained rather than creating tension that resolves later. Sourced from the youtube-video-analyst skill's "Retention Mechanics" section.

4. **Scene composition depth** — the planner knows "card with data" but not the layered composition model (foreground/midground/background parallax), the rule of thirds, Z-pattern reading flow, or focal point hierarchy. Every scene should have exactly ONE primary focal point per moment. Sourced from the motion-designer skill's scene-composition rules.

5. **Visual hierarchy as storytelling** — size, contrast, color, motion, and position should create a reading order that guides the eye. The planner's visual descriptions lack this — elements are described but their relative importance isn't choreographed. Sourced from the motion-designer skill's visual-hierarchy rules (the "Hierarchy Triangle": Primary 10-20% of frame, Secondary 20-30%, Tertiary 50-70%).

6. **Transition as narrative device** — transitions should serve the story (cut for energy, crossfade for mood shift, wipe for topic change, scale for focus) not be random. The planner only has cut/fade/zoom without guidance on WHEN to use each. Sourced from the motion-designer skill's transitions rules.

7. **Audio-visual sync beyond keySync** — professional motion graphics layer audio: background music (40-60% volume), SFX for emphasis (whoosh on transitions, pop on reveals, impact on dramatic moments), and silence for drama. The planner only thinks about keySync words, not sound design. Sourced from the motion-designer skill's audio design layer model.

8. **Content-type-specific formulas** — ads should follow proven formulas like Problem-Agitate-Solve (PAS) or Before-After-Bridge (BAB) with specific time allocations. The planner uses a generic story arc. Sourced from the explainer-video-guide skill's script formulas.

9. **Disney's 12 principles applied to motion graphics** — anticipation before reveals, follow-through on exits, squash-and-stretch for weight, overlapping action for polish. The planner doesn't reference these. Sourced from the creative-director skill's 12 Principles for Creative Leadership.

10. **The "Mute Test" goes deeper** — the self-verification table has "concept clear with sound off?" but doesn't enforce visual storytelling techniques like contrast (before/after states), progressive revelation (layer information), or callbacks (bookend elements). Sourced from the motion-designer skill's storytelling-flow rules.

**Fix needed:**

Two changes:

**1. Make layout ratios content-type-aware (orchestrator + planner prompts)**

Replace the blanket "70-80% stacked" rule with a content-type lookup. The orchestrator already identifies content type in Phase 1 (brainstorming) — pass this to the planner so it can select the right layout distribution. Example section to add:

```
## LAYOUT STRATEGY (Content-Type-Dependent)

Layout ratios depend on the content type identified in the brief:

| Content Type | Stacked | Fullscreen | Overlay | Hook Style |
|-------------|---------|------------|---------|------------|
| Educational | 70-80% | 1-2 beats | 10-20% | Curiosity question + bold visual |
| Ad (Meta/TikTok) | 30-40% | 20-30% | 30-40% | Pattern interrupt, bold claim |
| Product demo | 50-60% | 20-30% | 15-25% | Problem statement |
| Brand story | 40-50% | 15-20% | 30-40% | Emotional hook |

For ads: speaker IS the product. Use overlay heavily. Use fullscreen for
dramatic product reveals and stat callouts. Stacked for complex explanations only.
```

**2. Embed creative direction knowledge into the planner prompt**

Add a new `## CREATIVE DIRECTION` section to `planner-system.md` that teaches the planner HOW to think creatively, not just structurally. Key additions:

- **Emotional arc mapping**: Define energy curve per content type. Map each beat to an energy level (1-5). Enforce variety (never two adjacent beats at the same energy).
- **Hook formulas by content type**: Ads get pattern-interrupt hooks (bold claim, surprising stat, visual shock). Explainers get curiosity-gap hooks (question, mystery). Each with specific visual techniques.
- **Composition layers**: Every beat description must specify foreground/midground/background. Primary focal point gets 60% of visual weight. Use parallax for depth.
- **Transition intent**: Map transition types to narrative purpose. Cut = energy. Fade = mood shift. Zoom = focus. Wipe = topic change. The planner must justify each transition choice.
- **Retention through open loops**: At least 2 beats should set up visual elements that pay off later (e.g., a shape introduced in beat 1 that transforms in beat 4).
- **Ad-specific formulas**: When `contentType` is `ad`, enforce PAS or BAB structure with specific time allocations from the explainer-video-guide skill.
- **Anti-patterns checklist**: "Every beat is a card" = fail. "No energy variation" = fail. "Hook is just a title fade" = fail. "Same layout for 5+ consecutive beats" = fail.

**Source skills (installed at `~/.claude/skills/`):**
- `motion-designer` — scene composition, visual hierarchy, transitions, storytelling flow, timing/pacing, audio design
- `creative-director` — Disney's 12 principles as creative leadership framework
- `explainer-video-guide` — PAS/BAB script formulas, pacing rules, production workflow
- `youtube-video-analyst` — hook architecture, retention mechanics, emotional engineering, viral patterns
- `tiktok-ads` — ad format best practices, hook timing, creative velocity

---

## Issue 7: Video goes blank when playback crosses a cut point

**Severity:** Critical — core NLE functionality broken
**Phase:** Editor playback

**What happens:**
When the playback cursor crosses a cut boundary on the timeline, the video goes blank/black until the next segment's media loads. This breaks the fundamental NLE contract: scrubbing/playing across cuts must show the correct frame instantly.

### How the manifest-driven system works (context)

The system is fully manifest-driven:
1. Editor store holds items (video, audio, scene, text, image, caption, etc.) with `startMs`/`endMs`
2. `storeToManifest()` in `manifest-bridge.ts` serializes items to the manifest v2 format
3. Manifest is passed as `inputProps` to the Remotion `<Player>` — no bundle reload needed for manifest-only changes
4. `PlayerComposition.tsx` reads manifest items and renders them:
   - If scene items exist → **FullComposition path** (speaker video + scene transition layer + overlays)
   - If no scene items → **fallback flat-layer path** (all items in `<Sequence>` elements)
5. After the AI pipeline runs, scene items always exist → FullComposition path is the live path

In the FullComposition path, `PlayerComposition` picks the **first** `type === 'video'` item as the speaker video source, which is rendered as a single persistent `<Video>` element. Scene items render in `SceneTransitionLayer` inside `<Sequence>` elements.

### Root causes

**Files:**
- `apps/web/src/features/editor-v2/store/editor-store.ts` (lines 593-697 — `splitItemInDraft`)
- `apps/web/src/features/editor-v2/store/manifest-bridge.ts` (line 556 — `convertStoreItemData` for video)
- `packages/sandbox/template/src/PlayerComposition.tsx` (lines 111, 130 — single video assumption + overlay filter)

#### 7A: The manifest has no concept of video segments — only one continuous speaker video

`PlayerComposition.tsx` line 111:
```tsx
const videoItem = items.find(i => i.type === 'video');  // only FIRST video item
const sourceVideoFile = videoItem?.data?.src;
```

This single src is passed to `FullComposition` → `SpeakerVideo` → one persistent `<Video>` element that plays from frame 0 continuously. The manifest can contain multiple video items (after splits, or B-roll), but only the first one is used. The rest are silently dropped.

Line 130 — overlay filter excludes ALL video items:
```tsx
const overlayItems = items.filter(i =>
  i.type !== 'video' && i.type !== 'audio' && i.type !== 'scene'
);
```

**Result:** After splitting the video, the second half doesn't render. B-roll clips on overlay tracks don't render. The composition has no way to play different source regions or different files at different timeline positions.

#### 7B: Split doesn't adjust `startFrom` — right half replays from wrong position

`splitItemInDraft` (editor-store.ts line 677):
```tsx
const rightItem: TimelineItem = {
  data: JSON.parse(JSON.stringify(original.data)), // ← exact copy
};
```

Both halves get identical `data.startFrom`. After splitting video at 5s:
- Left: 0-5s, startFrom=0 → plays source 0-5s ✓
- Right: 5s-end, startFrom=0 → plays source 0-5s again ✗ (should start at 5s)

#### 7C: `trim` property exists in store but never reaches the manifest

`splitItemInDraft` sets `trim` on both halves:
```tsx
rightItem.trim = {
  startMs: original.trim.startMs + splitRelativeMs,
  endMs: original.trim.endMs,
};
```

But `convertStoreItemData` in `manifest-bridge.ts` never reads `item.trim`:
```tsx
case 'video':
  return { src: d.src, startFrom: d.startFrom ?? 0, ... }; // trim ignored
```

The trim data is computed correctly then thrown away at the manifest boundary.

#### 7D: Bundle reload on visual/scene splits causes full composition teardown

When splitting a scene (visual) item:
1. `splitItemInDraft` creates two items in the store
2. `api.splitVisualScene()` triggers AI regeneration → new scene .tsx files written
3. esbuild detects file changes → rebuilds bundle → `bundle:ready` WS event
4. `incrementBundleVersion()` → `useWorkspaceComposition` refetches the CJS bundle
5. During fetch+eval: `loading === true` → "Loading composition..." spinner → **full blank**
6. After eval: new Component instance → entire `<Player>` subtree remounts → video element recreated from scratch → **blank again** until video buffers

This gives TWO consecutive blanks. Every scene split = full composition reload.

#### 7E: No video preloading for any media items

When playback does cross a boundary where a new `<Video>` element mounts (in the fallback path, or when B-roll rendering is fixed), each new element starts cold:
- No `prefetch()` calls to warm the browser cache
- No pre-seeked video pool
- No thumbnail/still fallback while buffering
- `ThumbnailCache` exists for the timeline strip but not for the player canvas

### Fix approach

**1. Make the manifest carry video segment information properly:**
- Fix `splitItemInDraft` to adjust `data.startFrom` for the right half: `startFrom = (original.data.startFrom || 0) + splitRelativeMs`
- Either wire `trim` into `convertStoreItemData` or remove it and use `startFrom` directly (simpler)

**2. Teach `PlayerComposition` about multiple video items:**
- Distinguish "speaker source" from other video items. Options:
  - Flag on the item (`data.isSource: true`)
  - Track-based: first video-type track = speaker, others = B-roll
  - Item ordering convention
- Render non-source video items in the overlay layer inside `<Sequence>` elements
- For the speaker video, support a **segment list** (multiple items with same src but different `startFrom`/`startMs`/`endMs`) so jump cuts work

**3. Avoid full composition teardown on scene splits:**
- Scene code changes require bundle reload — this is unavoidable since scene .tsx files change
- But: don't destroy the video element during the reload. Keep the speaker video mounted in a layer OUTSIDE the bundle-dependent component tree
- Or: show the last rendered frame as a frozen snapshot during bundle reload (capture canvas → display as `<img>` while loading)

**4. Preload upcoming video sources:**
- Use Remotion's `prefetch()` API to pre-fetch video URLs before they're needed on the timeline
- For same-source segments (cuts in the speaker video), preloading isn't needed if the single `<Video>` element stays mounted — it just needs correct `startFrom` per segment

---

## Issue 8: Kill the template system — manifest IS the editor

**Severity:** Architecture — foundational change that unblocks creative freedom
**Phase:** Player rendering + AI pipeline

**What happened:**
The video appeared with the speaker on top and visuals on bottom — the root cause was `position: 'video-first'` hardcoded in `PlayerComposition.tsx`. This can't be changed from the manifest, the AI, or the editor. But this symptom reveals a fundamental architectural problem.

**The real problem — predefined layout modes limit creative freedom:**

The current system has 3 hardcoded display modes: `stacked`, `fullscreen`, `overlay`. The AI picks from these. But what if the creative brief asks for:
- Speaker in a small circle bottom-right, visuals filling the rest, ticker scrolling at top?
- Two video sources side-by-side with scene overlays?
- Speaker picture-in-picture that moves position between scenes?
- Any layout nobody has imagined yet?

With predefined modes, every new layout requires a code change to templates, a new mode in `getRectsForMode()`, a rebuild. The AI can never invent something new.

**The correct architecture — manifest items with spatial properties:**

Every item in the manifest has its own position, size, and time range. The player renders exactly what the manifest says — no layout computation, no display mode logic, no rect math.

```
# "Fullscreen scene" is NOT a display mode — it's just items placed on the timeline:
- Scene item:  {x: 0, y: 0, width: 1080, height: 1920, startMs: 5000, endMs: 10000}
- Audio item:  {startMs: 0, endMs: 60000, volume: 1}      ← speaker voice, uninterrupted
- Video item:  {startMs: 0, endMs: 5000, ...}              ← cut before scene starts
- Video item:  {startMs: 10000, endMs: 60000, ...}         ← resumes after scene ends

# "Speaker in circle bottom-right" is just item placement:
- Video item:  {x: 780, y: 1620, width: 250, height: 250, borderRadius: '50%'}
- Scene item:  {x: 0, y: 0, width: 1080, height: 1520}
```

The AI reasons about creative intent and expresses it as track items with coordinates and timing. It can invent any layout because it's not picking from a menu — it's editing a timeline.

**What the CJS bundle exports:** Only the scene registry (map of `sceneFile` → React component). Scene components contain custom animations, springs, interpolations — they must be compiled. Everything else (video, audio, text, images, captions, spatial arrangement) is manifest-driven.

**The player is dumb:** It iterates manifest items and renders each one:
- `type: 'video'` → `<Video>` at the item's position/size/time range
- `type: 'audio'` → `<Audio>` for the item's time range with its volume
- `type: 'scene'` → Look up component in scene registry, render at item's position/size
- `type: 'text'` → `<TextItem>` at position/size
- etc.

No `FullComposition`, no `SpeakerVideo`, no `getRectsForMode()`, no `computeLayoutForFrame()`, no display mode transitions. Just items on tracks rendered at their coordinates.

**Files to DELETE:**
- `packages/sandbox/template/src/composition/FullComposition.tsx`
- `packages/sandbox/template/src/composition/SpeakerVideo.tsx`
- `packages/sandbox/template/src/composition/utils.ts`
- `packages/sandbox/template/src/composition/SceneTransitionLayer.tsx`
- `packages/sandbox/template/src/composition/types.ts`

**Files to simplify:**
- `packages/sandbox/template/src/PlayerComposition.tsx` → thin wrapper that only loads scene registry
- `packages/sandbox/template/src/Root.tsx` → minimal Remotion entry point

**This enables:**
- AI can invent any layout by placing items spatially — no predefined modes
- Audio and video are independent tracks (fixes Issue 9)
- Multiple video items work naturally (fixes Issue 7)
- No bundle rebuild for layout changes (manifest-only = instant React re-render)
- Editor timeline directly maps to what the player renders — true NLE
- Future: audio ducking, B-roll, music tracks, voiceover replacement — all just manifest items

---

## Issue 9: Audio and video must be independent tracks — the AI edits the timeline

**Severity:** Critical — foundational NLE capability
**Phase:** Workspace init + AI pipeline + Player
**Files:**
- `packages/sandbox/src/workspace-init.ts` (downloads source.mp4, no audio extraction)

**What happened:**
Scene "LoveJourney.tsx" is fullscreen (43833-51400ms). Speaker's voice disappears completely during this scene because audio is coupled to the `<Video>` element — hiding the video kills the audio.

**Root cause:** `source.mp4` is a single muxed file. No audio extraction happens. The manifest has 0 audio items. Audio only plays because Remotion's `<Video>` element plays both streams. Remove the video → lose the audio.

**The correct architecture — AI edits independent tracks:**

Audio and video are separated at workspace-init (`ffmpeg -i source.mp4 -vn -acodec copy audio.aac`). The manifest starts with both as independent items on separate tracks. The AI agents then **edit the timeline** like a human editor would:

| Scenario | What the AI does to the manifest |
|----------|----------------------------------|
| Fullscreen scene (hide speaker, keep voice) | Cut video item for that range. Leave audio item intact. Place scene item at full canvas. |
| "Watch this video" (play asset with its audio) | Cut speaker audio for that range. Place video asset item with its audio. |
| Speaker explains over muted B-roll | Keep speaker audio. Place B-roll video item with `volume: 0`. |
| Speaker in circle, visuals filling rest | Place video item at `{x: 780, y: 1620, w: 250, h: 250}`. Place scene item at `{x: 0, y: 0, w: 1080, h: 1520}`. Audio unaffected. |
| Music bed under speaker | Add music audio item on separate track with `volume: 0.3`. |

There are **n possible scenarios**. The AI doesn't need predefined modes for each — it reasons about creative intent and expresses decisions as manifest operations: split items, adjust volume, trim, place spatially.

**What needs to happen:**
1. `workspace-init` extracts audio: `ffmpeg -i source.mp4 -vn -acodec copy audio.aac` and mutes the video: the video item in manifest gets `volume: 0`, audio item is separate
2. Manifest starts with independent video + audio items on separate tracks
3. The player renders each item independently — `<Video>` from video items, `<Audio>` from audio items (per Issue 8's manifest-driven player)
4. AI agents (planner, editor) manipulate tracks to express creative intent — cutting, muting, trimming, placing items spatially
5. The planner/editor prompts need to teach agents to think in tracks, not display modes

**This replaces the concept of "display modes" entirely.** There's no `displayMode: 'fullscreen'`. There's just: "video item doesn't exist in this time range, scene item is full-canvas, audio item plays through." The AI made editorial decisions and expressed them as manifest edits.

---

## Issue 10: Can't move or resize items in the preview — template ignores transforms

**Severity:** Critical — core editor interaction broken
**Phase:** Editor UX
**Files:**
- `apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx` (drag/resize overlay)
- `packages/sandbox/template/src/PlayerComposition.tsx` (ignores transforms for video/scene items)
- `packages/sandbox/template/src/composition/FullComposition.tsx` (positions items via hardcoded layout)

**What happened:**
Selecting any item (scene, video) from the timeline creates a selection box that wraps the entire preview. Trying to drag or resize does nothing visible — the content stays put.

**Root cause — three layered problems:**

### 10A: All items default to 100%×100% — selection box covers entire preview

Items from the AI pipeline have no explicit `transform` set. `ItemDragOverlay.tsx:34-41` defaults to:
```tsx
const DEFAULT_TRANSFORM = { x: 0, y: 0, width: '100%', height: '100%' };
```
The selection box renders at `(0,0)` spanning the full canvas (`1080×1920`). The user sees a purple border around the entire preview — there's nothing to "grab" because the selection IS the preview.

### 10B: Template ignores item transforms for video and scene items

Even when dragging updates the transform in the store → manifest, the FullComposition template **never reads** item-level transforms for video or scene items:

- **Video:** `PlayerComposition.tsx:111` takes the first video item's `data.src` and passes it to `FullComposition`. The video is positioned by `getRectsForMode()` / `computeLayoutForFrame()` — hardcoded layout logic. The item's `transform.x/y/width/height` is completely ignored.

- **Scene:** Scene items are passed to `SceneTransitionLayer`, which positions them using the same layout system. Item transforms are ignored.

- **Overlay items (text, image, shape):** These DO get wrapped in `<TransformWrapper>` (PlayerComposition.tsx:180-186) which reads `transform` and applies `position: absolute; left: x; top: y; width: w; height: h;`. Dragging text/image items works correctly.

| Item Type | Selection Box | Drag/Move Works? | Resize Works? |
|-----------|--------------|-------------------|---------------|
| Video | Full canvas (100%×100%) | No — template ignores | No — template ignores |
| Scene | Full canvas (100%×100%) | No — template ignores | No — template ignores |
| Text/Image/Shape | Correct (if transform set) | Yes (TransformWrapper) | Yes |
| Caption | Own overlay (CaptionDragOverlay) | Yes | Yes |

### 10C: No click-to-select on the canvas

Users can't click a visual element in the preview to select it. Selection only works from the timeline (`TimelineCanvas.tsx` hit testing). The `ItemDragOverlay` only renders AFTER an item is already selected via the timeline.

For a visual editor, users expect to click on an element they see, grab it, and move it. The current flow requires: timeline click → select item → see purple box on preview → drag box. This is unintuitive, especially since the purple box is full-canvas for most items and doesn't visually correspond to the element the user wants to move.

**Fix — this IS Issue 8:**

In the manifest-driven architecture:
1. Every item has explicit spatial coordinates in the manifest (`x`, `y`, `width`, `height`)
2. The player renders each item at its manifest coordinates — no template layout system
3. The drag overlay reads these coordinates → selection box matches the visual element
4. Dragging updates the coordinates in the manifest → player re-renders at new position → immediate visual feedback
5. Click-to-select becomes possible: hit-test canvas items against their manifest coordinates, select the one the user clicked

No templates, no layout modes, no hardcoded positioning. The manifest is the single source of truth for where everything renders.
