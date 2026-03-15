# Professional Edit Pipeline — Discussion Notes

These are live notes from the design discussion. They capture decisions and alignment points.

---

## Identity: Viona

- The orchestrator IS Viona — she is the face of the entire app
- She/her pronouns
- To the user, Viona is their creative partner. The orchestration is invisible.
- She never mentions agents, subagents, dispatching, or technical internals
- From the user's perspective: Viona planned it, Viona edited it, Viona designed the sound
- The prompt changes from "You are the Creative Director for Viona" → "You are Viona — a sharp, opinionated AI creative partner..."

---

## Entry Point: Dashboard → Sandbox → Viona

- User is on the dashboard (shows all projects + a chat window to upload new video and input creative brief)
- User uploads a video and types a creative brief
- Sandbox launches
- Viona picks up the brief and starts a conversation
- Viona has enough context window to maintain conversation across multiple chats — she remembers decisions, preferences, and feedback from earlier in the conversation without losing track
- Viona can read the transcript of the uploaded video

---

## Phase 1: Brainstorming with the User

After reading the transcript and creative brief, Viona engages as a creative partner — not just collecting inputs.

### Proactive sourcing (based on transcript content)
- "The transcript mentions Claude raised $20B from Google — do you have an article I can refer to? I can generate screenshots from it"
- Asks for media files like a product demo if the transcript references a product
- Asks for YouTube video links that can be used to extract clips
- "Do you have a logo or brand kit I can use for the graphics?"
- "Want me to add your social handles as a lower third?"
- "Any vibe for background music? Upbeat, cinematic, lo-fi?"
- "Got a video you love the style of? Send me a link and I'll match the energy"
- "The transcript mentions 3 stats — which one is THE headline number you want to hit hardest?"
- "How do you want to end this? Subscribe CTA, website link, or just let it breathe?"
- "Is this for LinkedIn professionals or TikTok scrollers? Changes how punchy I make it"

### Layout & style decisions
- Asks about layout preference (stacked, fullscreen, overlay — no PiP)
- Asks about theme selection

### Exit
- Doesn't drag out the questions — mixes sourcing + layout + style in one fluid conversation
- Wraps up with: "Anything else or should I create a plan?"

---

## Phase 2: Transcript Cleanup (Trim Pass)

**Why this happens before planning:** The Planner assigns frame ranges to sections based on the video duration. If trimming happens after planning, every cut shifts all downstream timestamps — section boundaries, sync points, and animation timings all become wrong. Trimming first produces a cleaned timeline so the Planner works with accurate, final frame ranges.

The **Editor** is dispatched with a specialized trimming prompt that contains the full trimming rules below. The Editor reads the word-level transcript and cleans up the timeline via manifest operations. The source video is never modified — this is NLE editing. Content type (for adjusting trim aggressiveness) is inferred from the user brief and transcript during brainstorming (Phase 1) and passed to the Editor's trimming prompt.

**What the Planner receives:** The full transcript text (for content understanding) but with post-trim timestamps (for accurate frame ranges). Words are removed from the *timeline* but not from the transcript text the Planner reads.

### Trimming Rules (transcript-based, all manifest ops)

All trimming uses word-level transcript timestamps. Identify trim targets, then do manifest ops (split at start, split at end, remove or shorten the middle segment). No audio processing.

**Key technique:** Replace removed segments with a short gap (100–200ms padding), not a hard cut. Shorten rather than delete. This prevents the "robotic fast-talker" problem.

#### Tier 1 — Always remove:
- **Non-lexical fillers**: "um", "uh", "er", "ah", "hmm", "mmm" — replace with 100–200ms gap
- **Dead air > 2 seconds** — replace with 400ms gap
- **False starts / abandoned sentences** — speaker begins a thought, stops, restarts → keep only the completed version
- **Retakes** — two consecutive sentences with >70% word overlap → keep the last (cleanest) take
- **Mouth clicks, lip smacks** (if detectable from transcript/audio analysis)

#### Tier 2 — Remove when clearly filler (context-dependent):
- **Discourse markers**: "you know", "I mean", "like" (as filler, not comparison), "so" (as hedge) — only when they appear at phrase boundaries and carry no semantic weight
- **Hedge words**: "basically", "actually", "literally", "sort of", "kind of" — only when they add zero meaning
- **Self-corrections**: "We need to go to the — we should head to the store" → keep only the corrected version

#### Tier 3 — Shorten, don't delete:
- **Silences 750ms–2000ms** → shorten to 400–500ms (preserves natural rhythm while tightening pacing)
- Never fully remove — the pause is there for a reason, just too long

#### Never cut:
- **Pauses < 300ms** — natural inter-word and inter-phrase breathing spaces
- **Intentional dramatic pauses** — before reveals, punchlines, after emotional statements
- **"Like" as comparison** ("it looks like a sunset"), **"so" as conjunction** ("so we decided"), **"actually" as correction** ("actually, the data shows the opposite")
- **Comedic timing pauses**
- **Brief fillers < 150ms** — removing creates audible cut artifacts
- **Turn-holding signals in interviews** — "um" can signal "I'm still talking, don't interrupt"

#### Thresholds:

| Parameter | Value | Notes |
|---|---|---|
| Minimum silence to cut | 750ms (conservative), 500ms (moderate) | Start conservative, user can request tighter |
| Natural pause to keep | 300–500ms | Average natural between-utterance pause |
| Padding around cuts | 100–200ms each side | Prevents clipping word onsets/offsets |
| Long silence replacement | 400ms gap | Silences > 2s get replaced with this |
| Filler minimum duration | ~150ms | Below this, removal creates audible artifacts |

#### Content-type adjustment:

| Content Type | Trim Aggressiveness | Min Silence to Cut | Padding |
|---|---|---|---|
| High-energy YouTube | Aggressive | 300–500ms | 100ms |
| Educational / tutorial | Moderate | 500–800ms | 150–200ms |
| Podcast / interview | Conservative | 800–1000ms | 200–300ms |
| Professional / corporate | Moderate | 500–750ms | 150ms |

The content type is detected from the transcript or user brief. Trimming aggressiveness adjusts accordingly.

### Captions (added right after trimming)

After trimming, captions are generated from the post-trim transcript and added to the manifest immediately. This happens in Phase 2 — not later — because:
- The transcript word timestamps are already adjusted for the trim
- Captions are a function of the transcript, not the creative plan — they don't depend on planning decisions
- Having captions in the manifest early means the rough cut (Phase 4) is already readable
- The Planner can factor in caption positioning when reasoning about overlay placement

Captions are added as items on a dedicated caption track in the manifest, with word-level timing from the transcript.

---

## Phase 3: Planning Agent

Dispatched by Viona after the trim pass. Reads the transcript, creative brief, and any materials gathered during brainstorming (articles, links, brand assets). Works with the **post-trim timeline** — all frame ranges are accurate and final.

### Core job
For every section of the video, reason about what the viewer needs to SEE — and decide the layout (stacked, fullscreen, overlay), scene divisions, and treatment type.

### Content type reasoning
Content type (news, explainer, tutorial, vlog, etc.) sets the overall visual bias, but per-section reasoning overrides it:
- "Claude raised $20B from Google" → screenshot of the article, or clip of the announcement
- "Revenue grew 300% year over year" → animated graph / counter (motion graphic even in a news video)
- "The deal has 3 key conditions" → animated tree/diagram
- "Here's what the product looks like" → screen recording or demo clip

The planner reasons per claim — what does the viewer need to SEE to understand THIS specific thing? Sometimes it's evidence (screenshot, clip), sometimes it's visualization (motion graphic), sometimes it's just the speaker delivering it.

### Research is part of planning (not a separate agent)
The Planner handles all research during planning — there is no separate Researcher agent. The Planner:
- Scrapes articles or screenshots referenced in the transcript
- Finds analytics not mentioned in the video
- Sources supporting materials to enrich the plan
- Uses MCP tools for web search, screenshot capture, and asset sourcing

### Output: a single EDIT_PLAN.md (no JSON)
A creative treatment document. No JSON — it blocks creativity. Downstream agents (Editor, Animator) read the markdown.

Contents:
1. **Content analysis** — what the video is about, content type, audience
2. **Narrative arc** — hook, tension, insight, payoff, emotional energy map
3. **Scene-by-scene breakdown:**
   - Time range + transcript excerpt
   - Treatment (animation / zoom cut / B-roll / screenshot / text overlay / speaker only) + WHY
   - Layout mode (stacked / fullscreen / overlay) + WHY
   - Split ratio (for stacked mode — e.g., 55% visual / 45% speaker)
   - Zoom config (for zoom cut sections — scale factor, face position)
   - Sync points — key transcript moments tied to frame numbers that animations should hit
   - For overlay sections: where on screen (lower third, top strip, etc.)
   - Brief description of what the scene shows (NOT detailed animation specs — that's the Animator's job)
   - B-roll search queries (specific search terms for sourcing B-roll assets)
4. **Research & assets** — articles to screenshot, B-roll queries, user-provided media. All asset operations (B-roll sourcing, screenshot capture, media downloads) use MCP tools.
5. **Pacing strategy** — rhythm, breathing room, energy clustering

### What the planner does NOT do
Detailed visual/animation design. The Animator gets the scene brief, the dimensions, and figures out HOW to visualize it.

### Plan Review (Resume Pattern)
- Planner is dispatched once, produces a draft EDIT_PLAN.md
- Viona reviews it first (catches obvious issues), then shows to user
- User gives feedback → Viona resumes the Planner with the feedback (Claude Agent SDK session persistence — keeps full context from first run)
- Planner revises without re-reading transcript or re-analyzing — just picks up where it left off
- Repeat until user approves
- Planner never talks to user directly — Viona is the communication layer
- Execution only starts after approval

---

## Phase 4: Editor Pass 1 — Rough Cut + Mockups

After plan approval, before animations. Viona extracts structured data from EDIT_PLAN.md (scene boundaries, zoom configs, B-roll queries, display modes, split ratios) and dispatches the Editor with these instructions. The Editor builds the rough cut with placeholder mockups where animations will go.

**Core principle:** This is a non-linear editor. The source video is never modified. All editing is manifest operations — splits, updates, adds, removes. Remotion reads the manifest and renders the final output.

1. **Split video at section boundaries** — `split_video` at each scene's timestamp, creating discrete video segments in the manifest
2. **Apply zoom crops** — for `zoom_cut` sections, set `crop.scale` (1.2–1.4x) and `crop.y` (face position) on the zoomed segment
3. **Place B-roll** — after Researcher downloads assets, add image/video items on a B-roll overlay track
4. **Text overlays** — for `text_overlay` sections, add text items to the manifest with styling from the plan
5. **Animation mockups** — for `animation` sections, create colored rectangle placeholders in the manifest at the correct timing, display mode, and layout props. These are simple colored rects (matching the theme's primary color at low opacity) that visually mark where animations will go. They get replaced with real scene files in Phase 7.

After this pass, the manifest is a complete rough cut — the full video structure with zoom cuts, B-roll, text overlays, and mockup placeholders for animations. The video is "watchable" as a rough cut even before animations are generated.

---

## Phase 5: Animation Generation

After the rough cut, Viona generates all motion graphic scenes. This happens in two steps: setup, then parallel dispatch.

### Theme System

- Each video follows a theme (e.g., studio-dark, studio-light)
- The theme is a file with design rules: colors, fonts, spacing, background conventions, animation quality standards
- The theme drives visual consistency across all scenes

### Step 1: Setup Phase (Viona does this directly)

Viona creates shared scaffolding from the theme config before dispatching any Animators. This is mechanical — no creativity needed, no agent required.

Creates:
- `constants.ts` — colors, spring configs, font pairs, durations, staggers (all from theme)
- `components/Background.tsx` — theme's background pattern (e.g., DotGrid for studio theme)
- Folder structure: `components/`, `scenes/`

### Step 2: Parallel Animator Dispatch

One Animator subagent per animation scene, dispatched in parallel.

Each Animator:
- Creates one `.tsx` scene file (e.g., `scenes/HookTitle.tsx`)
- Imports from shared `constants.ts` and `Background.tsx` — visual consistency by construction
- No file conflicts — each writes to a unique file
- The manifest already references scene files by name (created during plan execution)

### Animator Prompt Assembly (Layered Injection)

The Animator prompt is NOT one monolithic blob. The orchestrator **code** (not Viona) assembles a focused prompt per-scene from modular pieces.

Viona's dispatch message includes:
- **Scene name** — which scene to animate
- **Display mode** — stacked / overlay / fullscreen
- **Split ratio** — e.g., 55 (for stacked mode)
- **Scene brief** — what to visualize (from the plan)
- **Sync points** — frame anchors tied to transcript
- **Duration** — frame count

The code reads the display mode + split ratio and computes:
- **Effective dimensions** (e.g., stacked at 55% split on 1080×1920 → 1080×864 visual panel)
- **Canvas dimensions**
- **Position** (video-bottom / video-top)

The code then builds the prompt from modules:

**Always included (every Animator):**
- Theme design system — colors, fonts, spacing rules, background conventions
- Animation rules — springs, interpolate clamping, stagger minimums, layering (primary 60%, secondary 30%, ambient 10%)
- Animation vocabulary — catalog of techniques to choose from

**Included based on display mode (only the relevant one):**
- Stacked rules — effective dimensions, aspect ratio considerations
- Overlay rules — transparent background, face-zone avoidance (15-58% Y off-limits), safe zones, max 2 elements
- Fullscreen rules — full canvas, vertical stacking, animated background required

**Included per-scene:**
- Scene brief from the plan
- Effective dimensions (computed by code)
- Duration in frames
- Sync points

Effective dimensions per display mode:

| Display Mode | Effective Width | Effective Height (at 55% split) |
|---|---|---|
| Stacked (video-bottom) | 1080 | 1920 × 0.45 = 864 |
| Fullscreen | 1080 | 1920 |
| Overlay | 1080 | 1920 (safe zones constrain usable area) |

### Why the code assembles — not Viona

- Viona doesn't need the theme file in her own context (saves tokens)
- The code can read theme files, display mode rules, and scene briefs from the filesystem
- `buildAnimatorPrompt(mode, theme, brief, dimensions)` is pure code — deterministic, no AI involved
- Each Animator subagent is dynamically defined with its assembled prompt
- Subagents in the Agent SDK can't load skills — content must be injected into the prompt

### No Animator coordination needed

- All Animators read from `constants.ts` and `Background.tsx` (read-only, already exists)
- Each writes to a unique scene file — no conflicts
- The scene registry auto-generates from the filesystem
- Manifest already has scene items pointing to the right filenames

---

## Phase 6: Review

A separate Reviewer agent checks each Animator's output against the scene brief from the plan (Option 1 + Option A from architecture discussion).

Review happens **as each scene completes** — not after all Animators finish. While Animator B is still working, the Reviewer can already be checking Animator A's output. This keeps the pipeline flowing and surfaces issues early.

### Per-scene review flow

As each Animator finishes:
1. Render a still of the scene via `render_still`
2. Dispatch **Reviewer** with: the rendered still, the scene brief from EDIT_PLAN.md, the expected display mode, the effective dimensions
3. Reviewer judges: composition, readability, spacing, visual density, display mode compliance
4. **Pass** → move to next scene
5. **Fail** → Reviewer provides specific actionable feedback ("bar labels overlap, increase spacing"). Viona resumes the Animator with the feedback. Re-render, re-review.
6. **Max 2 retries per scene.** After 2 failures, accept with a warning and move on.

### What the Reviewer checks

- **Canvas fill** — is ≥70% of the canvas filled with visual content? Large empty voids → fail
- **Element count** — does the scene have ≥3 distinct elements (primary + secondary + background)? Bare text on solid background → fail
- **Font readability** — is primary text large and bold enough to read on a phone screen?
- **Background** — is it a flat solid color? Must be gradient, pattern, or animated → fail if flat
- **Display mode compliance:**
  - Stacked: content fits within the visual panel dimensions
  - Overlay: transparent background, content in safe zones only, no face-zone obstruction
  - Fullscreen: content fills the full canvas
- **Animation quality** — sync points hit at the right frames, no frozen elements, springs configured properly

### Why a separate agent (not self-review)

- Fresh eyes — the creator reviewing their own work misses things
- The Reviewer reads the plan's brief + looks at the rendered still with no bias from the code
- Lightweight — it doesn't fix anything, just returns pass/fail with feedback
- Feedback routes back to the original Animator via resume (keeps the Animator's full context)

### Routing feedback

- **Animation issues** (bad code, wrong technique, missing elements) → resume the Animator that made it
- **Compilation errors** → the Animator self-heals (no separate Healer agent — all agents are responsible for their own clean output)

---

## Phase 7: Editor Pass 2 — Final Assembly

After all scenes are generated and reviewed, Viona resumes the Editor from Phase 4 (same session, full context from the rough cut).

1. **Replace mockups with real animations** — for each animation mockup placeholder, update the scene item to point to the generated .tsx file. How the item is placed depends on the display mode:

   **Stacked** (`displayMode: "default"`):
   - Scene item on overlay track with `displayMode: "default"`
   - Video item stays on the video track — speaker plays in the other portion of the split
   - `layoutProps: { splitRatio: <from plan>, position: "video-bottom" | "video-top" }`
   - Both scene and speaker are visible simultaneously, each in their portion

   **Fullscreen** (`displayMode: "fullscreen"`):
   - Scene item on overlay track with `displayMode: "fullscreen"`
   - Scene takes the entire canvas — speaker video is hidden for this time range
   - No `layoutProps` needed — scene covers everything
   - Use sparingly (1-2 per video max) for high-impact moments

   **Overlay** (`displayMode: "overlay"`):
   - Scene item on overlay track with `displayMode: "overlay"`
   - Speaker video plays fullscreen underneath (no split, no crop)
   - Scene has transparent background, content only in safe zones (top strip 0-15%, lower third 58-85%)
   - Lightweight — max 2 elements, 1-3 words each

   Each scene item includes:
   - `type: "scene"` on the overlay track
   - `startMs` / `endMs` from the plan's frame ranges
   - `data.sceneFile` pointing to the generated .tsx file (e.g., `HookTitle`)
   - `data.enter` / `data.exit` — transition type and duration from the plan

2. **Set transitions** — crossfade, fade, cut between scenes based on the plan
3. **Add background music** — download a royalty-free track matching the plan's mood, add as audio item spanning the full video, volume well below dialogue (0.12–0.25), fade in/out
4. **Caption styling** — configure caption appearance based on content type and theme
5. **Final retouch** — fix any timing issues, adjust zoom crop positions, tweak B-roll placement based on how animations landed
6. **Verify timeline integrity** — no gaps, no overlaps, scene items + video items cover the full duration
7. **Final coherence check** — read the full manifest end-to-end, verify it makes sense as a complete video

### Why two passes with resume

- Phase 4 (rough cut + mockups) builds the full video structure — the video is "watchable" even before animations exist
- Phase 7 (final assembly) replaces mockups with real animations, adds transitions, music, captions, and does final retouch
- Resume pattern keeps the Editor's context from Phase 4 — it knows what cuts it made, what mockups it placed, what the timeline looks like
- Single agent, two passes, full continuity

### Agents summary

Four agents total: **Planner, Editor, Animator, Reviewer**. All agents are self-healing — no separate Healer agent. Every agent is responsible for producing clean, compiling output.

---

## Phase 8: Refinement (Conversational Editing)

After the final assembly, the video is complete — but the user may want changes. This is Viona's domain.

- Viona presents the finished video to the user in the editor
- User can request changes conversationally: "Make the hook more punchy", "The graph animation is too fast", "I don't like the B-roll at 0:45"
- **Viona decides which agent to dispatch** based on the request:
  - Animation issue → resume the relevant Animator with feedback
  - Trim/pacing issue → resume the Editor
  - Scene composition issue → dispatch Reviewer for re-evaluation, then fix
  - New scene request → dispatch a new Animator
  - Simple manifest tweak (reorder, adjust timing) → Viona does it directly via manifest tools
- This is open-ended — the user iterates until satisfied
- Each refinement pass is a mini-pipeline: Viona understands the request, dispatches the right agent, integrates the result

---

## Progress & Preview UX

### Live progress display

During pipeline execution, the UI shows the user what's happening:
- **Which agent is working** — "Viona is trimming the transcript", "Animator is building the hook scene", "Reviewer is checking Scene 3"
- **Which track is being edited** — highlights the active track/region in the timeline
- **Time remaining** — estimated time left for the current phase and overall pipeline

This keeps the user informed without exposing internal agent architecture. The language is always Viona-centric ("I'm working on the animations" not "Animator subagent dispatched").

### Incremental preview

The user can preview results as they're being made — they don't have to wait for the full pipeline to finish:
- After Phase 2 (trim + captions): user can preview the cleaned-up video with captions
- After Phase 4 (rough cut): user can preview the full structure with zoom cuts, B-roll, and colored rect placeholders for animations
- As each animation completes (Phase 5): the placeholder is replaced and the user can preview that scene immediately
- After Phase 7 (final assembly): full video with transitions, music, and all animations

Each phase incrementally builds on the manifest. Since Remotion reads the manifest and renders, the user can hit "preview" at any point and see the current state.

---

## Agent Capabilities

- Viona and all agents have access to the codebase and CLI tools
- All asset operations (B-roll, screenshots, media downloads) use MCP tools
- Resume pattern (Claude Agent SDK session persistence) applies to ALL agents — not just the Planner. Any agent can be resumed with feedback while keeping its full context from the previous run.
