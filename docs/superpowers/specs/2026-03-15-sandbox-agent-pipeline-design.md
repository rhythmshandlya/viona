# Sandbox Agent Pipeline — Design Spec

**Date:** 2026-03-15
**Status:** Revised (v2)
**Scope:** Replace the worker's visual generation pipeline with a manifest-centric, sighted agent running inside the sandbox container.

---

## 1. Overview

Build an autonomous video editing agent that runs inside the sandbox Docker container. The agent plans, generates Remotion motion graphics, edits the manifest v2 timeline, and refines — all through natural conversation in the editor sidebar.

### Key Design Decisions (v2)

1. **Manifest is the control plane.** The manifest controls timing, layout, transitions, and display modes. Scene files are visual components the manifest references. Editing the timeline never requires touching scene code.

2. **Speaker visible by default.** Most scenes use `default` (stacked) display mode — speaker visible at bottom, visuals on top. Fullscreen (no speaker) is the exception, only when explicitly requested or for complex diagrams that genuinely need full canvas. The hook/intro MUST always show the speaker.

3. **Motion graphics are the MOAT.** The AI should lean heavily into animation treatments. A typical 6-beat plan should produce 4-5 animation scenes. Stock footage and text overlays supplement — they don't replace.

4. **Meaningful scene file names.** Not `Scene1.tsx`, `Scene2.tsx`. Use descriptive names: `HookTitle.tsx`, `AlgorithmDiagram.tsx`, `ResultsCounter.tsx`. The Planner assigns names; the Animator uses them.

5. **Scenes are optional per beat.** Only `animation` beats need scene `.tsx` files. Stock footage → manifest `broll` item. Text overlays → manifest `text` item. Screenshots → manifest `image` item. Speaker-only → gap in timeline.

6. **Sighted agent, not blind.** Unlike the worker pipeline, the sandbox agent can `render_still` at any frame to SEE the actual composition (video + visuals together). Prompts should replace blind assumptions with visual verification.

7. **Maximum reuse of worker prompts.** The worker has ~188KB of proven animation knowledge (springs, Disney principles, motion design, scene patterns, overlay rules, etc.). Reuse the KNOWLEDGE, adapt the PROCESS for sighted context.

8. **Live preview during generation.** As the AI writes scenes, esbuild rebuilds → WebSocket event → frontend fetches new bundle → Remotion Player updates. User watches scenes appear in real-time.

---

**What changes:**
- Sandbox becomes the primary editing engine (not just a manifest editor)
- Worker retains only: transcription (Whisper) and head-tracking (ML/GPU)
- Agent uses Claude Agent SDK (`query()`) with orchestrator-worker pattern
- Existing MCP servers (Assets, Viewport, Freepik, Better-Icons) wired into sandbox
- Enhanced `/init` endpoint to accept transcript, user brief, and head-tracking data
- Planner and Verifier/Healer subagents added to existing orchestrator/animator/researcher/trimmer set

**What stays the same:**
- Sandbox infrastructure (Docker + Railway, API proxy, auth, idle management)
- Frontend AI chat panel (SSE streaming, widgets)
- Manifest v2 format and bridge
- esbuild watcher + Player hot-reload
- **Existing prompt suite** — `orchestrator-system.md` (1406 lines), `animator-system.md` (60KB), `trimmer-system.md`, `researcher-system.md` are kept and extended, not rewritten
- Layout mode system (default/fullscreen/overlay) with display mode rules

---

## 2. Agent Architecture

### 2.1 Orchestrator-Worker Pattern

One persistent **Orchestrator** agent manages the conversation and dispatches specialized **subagents** for heavy work. This follows Anthropic's recommended pattern for unpredictable problem spaces.

```
Orchestrator (Opus, persistent session, all MCP tools)
│
│ EXISTING SUBAGENTS (already defined in orchestrator.ts, prompts exist):
│
├── Animator (Opus) — animator-system.md (60KB, battle-tested)
│   Purpose: Write Scene*.tsx Remotion code for a single scene
│   Tools: Read, Write, Edit, Glob, Grep, Bash, Skill,
│           scenes MCP, render MCP, assets MCP, viewport MCP
│   Trigger: Per scene after plan approval
│   Key: Understands display modes (default/fullscreen/overlay),
│         overlay safe zones, frame-perfect sync points
│
├── Researcher (Sonnet) — researcher-system.md
│   Purpose: Find/capture visual assets (screenshots, stock images, icons)
│   Tools: Read, Write, Bash, WebSearch, WebFetch,
│           assets MCP, freepik MCP, better-icons MCP
│   Trigger: When agent needs external assets
│
├── Trimmer (Sonnet) — trimmer-system.md
│   Purpose: Detect silence, filler words, apply precise cuts via manifest
│   Tools: Read, Write, Bash, Grep, manifest MCP (split, delete, update)
│   Trigger: When user asks to clean up audio/remove dead air
│
│ NEW SUBAGENTS (to add):
│
├── Planner (Opus) — planner-system.md (480 lines, adapted from Director)
│   Purpose: Analyze transcript, create scene plan, output SCENE_PLAN.md + scenes.json
│   Tools: Read, Write, Glob, Grep, manifest MCP, render MCP (render_still for sighted planning)
│   Trigger: When orchestrator has enough context to plan
│   Key: 4-pass transcript analysis, visual metaphor mappings (18 concepts),
│         8 AutoAE composition patterns, meaningful sceneFile naming,
│         beat type system (animation/stock_video/screenshot/text_overlay/speaker_only),
│         speaker-visible-by-default enforcement, sighted speaker position detection
│   Note: NO widgets MCP — returns plan to orchestrator for show_widget.
│
├── Verifier (Sonnet) — verifier-system.md (sighted, combined visual + code review)
│   Purpose: Screenshot scenes at 3 key frames, compare against plan, code quality check
│   Tools: Read, Glob, Grep, render MCP, viewport MCP
│   Trigger: After each scene is generated
│   Key: 16-point visual screenshot review + 11-point code quality review,
│         sighted verification (sees video + speaker + visuals together)
│
└── Healer (Sonnet) — healer-system.md
    Purpose: Fix TypeScript errors, interpolate clamping issues
    Tools: Read, Edit, Glob, Grep, Bash, render MCP, scenes MCP
    Trigger: When TS verification fails
```

### 2.2 Why This Structure

- **Orchestrator stays lean**: It manages conversation + delegates heavy work. Its context window doesn't fill up with scene code.
- **Subagent isolation**: Each subagent gets only the context it needs. Animator gets one scene description, not the full transcript.
- **Model routing**: Opus for creative work (planning, animation), Sonnet for mechanical work (verification, fixing, search).
- **Parallelization possible**: Multiple Animators could run in parallel (future optimization).

### 2.3 Session Persistence

- Every orchestrator turn uses Agent SDK `resume: sessionId`
- `sessionId` stored in DB per conversation (existing `sdk_session_id` column)
- On resume failure: fallback to text-based conversation history + `generation-progress.json`
- Subagents are single-shot (no resume needed)

---

## 3. The Four Phases

The orchestrator doesn't have hardcoded phase transitions. It has tools and subagents that naturally enable four phases. The system prompt guides the expected flow but the agent adapts.

### Phase 1: Brief Ingestion

**Trigger:** `/init` endpoint receives video + transcript + user brief.

**Flow:**
1. API calls `POST /init` with:
   - Video file (downloaded to `/workspace/public/source.mp4`)
   - Word-level transcript with timestamps
   - User's text description (short or long)
   - Video metadata (duration, dimensions, fps)
   - Head-tracking data (if available)
2. Sandbox stores transcript at `/workspace/docs/transcript.json`
3. Sandbox stores brief at `/workspace/docs/user-brief.md`
4. Orchestrator system prompt includes: canvas dimensions, fps, duration, brief summary
5. Full transcript available via `Read` tool on demand

**Orchestrator behavior:** Reads the brief, acknowledges understanding, asks first planning question or proceeds directly to planning if brief is detailed enough.

### Phase 2: Conversational Planning

**Trigger:** Orchestrator decides it has enough context (or user says "go ahead").

**Flow:**
1. Orchestrator asks clarifying questions directly (no subagent needed for Q&A)
   - Style preferences, tone, key moments to emphasize
   - Uses `show_widget` for rich inputs (style picker, layout options)
2. When ready, dispatches **Planner subagent** with:
   - Full word-level transcript (file path)
   - User brief
   - All gathered preferences from conversation
   - Canvas dimensions, fps, duration
   - Head-tracking safe zones (if available)
3. Planner outputs:
   - `SCENE_PLAN.md` — human-readable visual story with timing
   - `scenes.json` — machine-readable scene data (v2 segment format)
4. Orchestrator presents plan via `show_widget` (scene_plan widget type)
5. User approves, requests changes, or asks to redo
6. On approval, orchestrator moves to Phase 3

**Scene plan validation (programmatic, not agent):**
- Duration bounds: 210-450 frames per scene (7-15 sec at 30fps)
- Contiguity check (no gaps or overlaps)
- Full video coverage
- Auto-repair minor violations

### Phase 3: Execution (Manifest-First)

**Trigger:** User approves the scene plan.

**Flow:**
1. **Manifest structure first**: Orchestrator reads `scenes.json` and creates manifest tracks/items for all beats
2. Orchestrator dispatches **Researcher subagent** to fetch assets referenced in the plan
   - Stock photos via Pexels/Unsplash MCP
   - Icons via Freepik/Better-Icons MCP
   - Web images via Assets MCP `download_file`
2. **Orchestrator creates manifest structure first** — reads `scenes.json` and translates beats into manifest items:
   - `animation` beats → `type: "visual"` item with `data.sceneFile` = meaningful name
   - `stock_video` beats → `type: "broll"` item (Researcher fetches footage)
   - `screenshot` beats → `type: "image"` item (Researcher captures)
   - `text_overlay` beats → `type: "text"` item (direct manifest, no subagent)
   - `speaker_only` beats → gap in timeline (no item needed)
3. Orchestrator dispatches **Animator subagent** for each `animation` beat with:
   - Beat description from SCENE_PLAN.md
   - Meaningful `sceneFile` name from plan (e.g., `HookTitle`, `AlgorithmDiagram`)
   - Available asset paths in workspace
   - Canvas dimensions, fps
   - Shared technical rules (Remotion patterns, interpolate clamping)
4. Animator writes scene file using plan's `sceneFile` name (e.g., `scenes/HookTitle.tsx`)
5. esbuild watcher detects change → rebuilds → Player hot-reloads
6. Orchestrator dispatches **Verifier subagent**:
   - Screenshots scene via `render_still` MCP tool
   - Compares against plan description
   - Reports pass/fail with specific issues
7. If verification fails: Orchestrator dispatches **Healer subagent** to fix
8. After all scenes: run `tsc` verification via Bash tool
   - If errors: Healer fixes, re-verify (max 3 attempts)
   - Validate interpolate() clamping (both extrapolateLeft + extrapolateRight)
9. Orchestrator reports progress via `report_progress` MCP tool throughout
10. Updates `generation-progress.json` after each scene completes

**Scene registry management:**
- After each scene file is written, `scene-registry.ts` auto-regenerates
- Maps filenames to React components (supports any valid PascalCase name)
- `SceneItem` looks up by `data.sceneFile` key from manifest

### Phase 4: Refinement

**Trigger:** User sends follow-up messages after generation.

**Flow:**
1. Same session resume — orchestrator has full conversation context
2. User requests changes: "make the intro more energetic", "change colors on scene 3", "add a text overlay at 0:15"
3. Orchestrator decides approach:
   - **Simple edits** (text, timing, transforms): Direct manifest MCP tool calls
   - **Scene changes** (restyle, restructure): Dispatch Animator subagent for that scene
   - **New elements** (add a shape, image): Manifest + asset tools
4. esbuild rebuilds → Player updates live
5. Checkpoint manifest after each edit

---

## 4. MCP Tool Servers

### 4.1 Existing Sandbox MCP Servers (Keep)

**manifest** — Manifest v2 CRUD operations
- `readManifest` — Read full or filtered manifest
- `readItem` — Read single item by ID
- `addTrack` — Create track (video/audio/overlay/caption)
- `updateTrack` — Update track metadata
- `removeTrack` — Remove track + items
- `addItem` — Add item with type, timing, data, transform, keyframes, filters
- `updateItem` — Deep-merge update item properties
- `removeItem` — Delete item
- `splitVideo` — Split video at timestamp
- `updateManifest` — Replace entire manifest

**scenes** — Scene file management
- `writeSceneFile` — Write Scene*.tsx to workspace
- `deleteSceneFile` — Remove scene file

**render** — Preview rendering
- `renderStill` — Screenshot a frame via Remotion still
- `triggerRebuild` — Force esbuild rebuild

**widgets** — Frontend communication
- `showWidget` — Show interactive widget (theme_picker, layout_picker, scene_plan, choice, confirmation)
- `reportProgress` — Update progress bar in chat

### 4.2 New MCP Servers (Add to Sandbox)

**assets** — Asset fetching and management (port from `packages/mcp-servers/src/asset-server.ts`)
- `download_file` — Download URL to `public/assets/`, extract ZIPs
- `search_unsplash` — Stock photo search
- `search_pexels` — Stock photo search
- `download_stock_photo` — Download with attribution
- `get_speaker_grid` — Head-tracking spatial grid

**viewport** — Scene validation (port from `packages/mcp-servers/src/viewport-server.ts`)
- `get_scene_dimensions` — Effective dimensions per scene
- `validate_scene_code` — TS/Remotion code validation
- `submit_verdict` — Structured pass/fail verdict

**freepik** — Icon/illustration search (remote MCP proxy)
- All Freepik MCP tools via `mcp-remote` proxy

**better-icons** — Icon search across 200+ libraries
- All Iconify tools

### 4.3 No Workspace MCP Server

The agent already has `Read`, `Write`, `Bash`, `Glob`, `Grep` with `bypassPermissions`. Workspace files (transcript, brief, progress, scene registry) are accessed directly via built-in tools. No wrapper MCP server needed — it would create redundant code paths.

- Transcript: `Read /workspace/docs/transcript.json`
- Brief: `Read /workspace/docs/user-brief.md`
- Progress: `Read/Write /workspace/generation-progress.json`
- TS verify: `Bash tsc --noEmit`
- Scene registry: `Write /workspace/src/scene-registry.ts`

### 4.4 MCP Integration Approach

The 4 existing MCP servers (manifest, scenes, render, widgets) use `createSdkMcpServer()` — in-process SDK MCP. This is the right approach for tools that need access to Node.js state (callbacks, file locks).

The 4 new external MCP servers (assets, viewport, freepik, better-icons) run as **stdio subprocess servers** via the existing `packages/mcp-servers/` compiled entry points. The sandbox Docker image includes these as pre-installed Node.js scripts.

Configuration mirrors the worker's `mcp-servers.json` registry but resolved for the sandbox workspace path (`/workspace`).

**Subagent MCP access:** The SDK passes MCP servers configured in `query()` options to all subagents automatically. Subagents access MCP tools via the standard `mcp__{server}__{tool}` naming convention. The `allowedTools` list on each subagent controls which MCP tools it can use (e.g., Researcher gets `mcp__assets__*` but not `mcp__manifest__*`).

---

## 5. Prompt Architecture

### 5.1 Prompt Reuse Strategy

The worker has ~188KB of proven animation knowledge across 31 files. The sandbox reuses this knowledge but adapts the PROCESS for the sighted, manifest-centric context.

**Knowledge layers:**

| Layer | Source | How It's Used |
|-------|--------|---------------|
| **Universal knowledge** (springs, Disney principles, motion design, vocabulary, quality checklist) | `worker/prompts/shared/` (17.8KB) | Prepended to Planner + Animator + Verifier via `loadPromptWithShared()` |
| **Scene planning methodology** (4-pass transcript analysis, visual metaphors, scene validation) | `worker/prompts/director/system.md` (29KB) | Key sections adapted into `planner-system.md` |
| **Animation choreography** (overlay rules, fullscreen rules, composition patterns, continuous motion) | `worker/prompts/animator/` (94KB) | Key sections injected into `animator-system.md` |
| **Scene patterns** (versus, ranking, radial, spotlight, graph, speech bubble, etc.) | `worker/prompts/generate-visuals/scene-patterns.md` (3.4KB) | Included in Planner prompt as technique catalog |
| **Design system** (DotGrid, useScale, font pairs, card styling, animation standards) | `worker/prompts/themes/` (14KB) | Injected into Animator based on selected theme |
| **Code references** (responsive sizing, physics, spring configs by style) | `worker/prompts/references/` (15KB) | Available to Animator as skill files |

**What changes from worker → sandbox:**

| Worker (blind) | Sandbox (sighted) |
|---|---|
| "Assume overlay zones from speaker grid data" | "Render a still with `render_still` and verify visuals don't block speaker" |
| "Write all segments, then create Composition.tsx" | Scene files are standalone — manifest + PlayerComposition handles assembly |
| "Write IMPLEMENTATION_LOG.md for reasoning" | Use thinking blocks — reasoning is internal |
| "Hope keySync timing matches the spoken word" | "Render a still at keySync frame and verify animation is visible" |
| "Run `npx tsc --noEmit` then bundle" | Same TS check, but also `render_still` to visually verify |
| "Create Composition.tsx with persistent audio carrier" | Not needed — PlayerComposition reads manifest items |
| Scene1.tsx, Scene2.tsx (numbered) | HookTitle.tsx, AlgorithmDiagram.tsx (meaningful names) |

### 5.2 Prompt Files

**Extended (DONE):**
- `orchestrator-system.md` — Added: speaker-visible-by-default rule, motion-graphics-emphasis rule, meaningful scene names, manifest-first Phase 3 execution flow
- `animator-system.md` — Added: beat type awareness, meaningful sceneFile naming, sighted verification emphasis, workspace structure with themes
- `researcher-system.md` — Keep as-is
- `trimmer-system.md` — Keep as-is

**Rewritten (DONE, incorporating worker knowledge):**
- `planner-system.md` (480 lines) — Director's 4-pass transcript analysis, 18 visual metaphor mappings, 8 AutoAE scene patterns, scene split/merge signals, technique variety enforcement, cross-scene anchoring, meaningful `sceneFile` naming, beat `type` field, speaker-visible-by-default, motion-graphics emphasis, sighted `render_still` for speaker detection, 14-point validation rules, 17-point self-verification table
- `verifier-system.md` (100 lines) — Combined worker's `verify.md` (16-point screenshot review at 3 frames) + `scene-verify.md` (11-point code review). Sighted verification via `render_still`.
- `healer-system.md` — Added render_still verification after fix, scene naming note

### 5.3 Shared Modules (loaded via loadPromptWithShared)

Copied from `packages/worker/src/prompts/shared/` into sandbox at build time:

| Module | Size | Content | Loaded By |
|--------|------|---------|-----------|
| `technical-rules.md` | 4.9KB | Spring presets (SMOOTH/SNAPPY/BOUNCY/HEAVY/STIFF/GENTLE/OVERLAY), easing guide, interpolate clamping, frame timing, key sync pattern, responsive sizing | Planner, Animator, Verifier |
| `motion-design-principles.md` | 4.7KB | Disney's 5 principles for short-form, 3-layer structure (60/30/10), choreography phases, 7 hard rules | Planner, Animator |
| `vocabulary.md` | 4.5KB | 14 element animation techniques, 11 scene archetypes, text animation names, transition types | Planner, Animator |
| `quality-checklist.md` | 2.8KB | 27-point per-scene checklist, plan verification checklist, transcript coverage rules | Animator, Verifier |

### 5.4 Display Mode Rules

**CRITICAL: Speaker visible by default.**

| Mode | Usage | Animator Rules |
|------|-------|---------------|
| `default` | **70-80% of beats** — the norm | Visuals on top, speaker below. Scene fills visual panel area. Background.tsx (DotGrid) included. |
| `fullscreen` | **1-2 beats max** — only when user requests or diagram needs full canvas | Full canvas, no speaker. Top 20% title, middle 40% content, bottom 25% secondary. Background included. |
| `overlay` | **1-2 beats max** — speaker credibility moments | Speaker fullscreen, visuals ON TOP. Transparent bg MANDATORY. Two zones only: top 0-15%, lower-third 58-85%. Max 2 elements, 1-3 words each. |

**Hook is NEVER fullscreen.** The speaker must be visible in the first scene to establish connection.

### 5.5 Scene File Rules

- **Meaningful names**: `HookTitle.tsx`, `ProcessFlow.tsx`, `KeyInsight.tsx` — not `Scene1.tsx`
- **Only for animation beats**: Stock footage, text overlays, screenshots → manifest items only, no scene file
- **Standalone components**: No timing logic, no Sequence management. The manifest controls when/where/how the scene appears
- **Scene registry auto-generates**: esbuild watcher scans `/workspace/src/scenes/`, generates `scene-registry.ts` mapping filenames to components

---

## 6. Data Flow

### 6.1 Initialization

```
User uploads video + provides text description
    │
    ├── Worker: transcribe → word-level transcript with timestamps
    ├── Worker: head-track → speaker bounding boxes + safe zones
    │
    ▼
API: POST /projects/:id/sandbox (create/resume sandbox)
    │
    ▼
API: POST /sandbox/init
    ├── Downloads video → /workspace/public/source.mp4
    ├── Probes duration via ffprobe
    ├── Writes transcript → /workspace/docs/transcript.json
    ├── Writes user brief → /workspace/docs/user-brief.md
    ├── Writes head-tracking data → /workspace/docs/speaker-grid.json
    ├── Writes initial manifest.json (video track + source item)
    ├── Copies shared prompt modules → /workspace/docs/shared/
    ├── Copies theme design system files → /workspace/docs/themes/
    ├── Starts esbuild watcher
    └── Starts periodic checkpointing
```

### 6.2 Conversation Turn

```
User types message in AI chat
    │
    ▼
Frontend: POST /api/projects/:id/agent/prompt (SSE)
    │
    ▼
API: proxyPromptWithIntercept → Sandbox POST /prompt
    │
    ▼
Sandbox agent-server:
    ├── Build orchestrator options (system prompt + subagents + MCP servers)
    ├── query() with resume: sessionId (or fresh if first turn)
    ├── Stream events → SSE → API → Frontend
    │   ├── text → chat text
    │   ├── widget → inline widget
    │   ├── progress → progress bar
    │   └── done → session ID captured
    │
    ├── Agent may dispatch subagents:
    │   ├── Planner → writes SCENE_PLAN.md + scenes.json
    │   ├── Researcher → downloads assets
    │   ├── Animator → writes scene .tsx files (meaningful names) via manifest
    │   ├── Verifier → screenshots + quality check
    │   └── Healer → fixes TS errors
    │
    ├── File changes trigger esbuild → Player hot-reload
    └── Manifest changes trigger checkpoint → DB sync
```

### 6.3 Progress Tracking

`/workspace/generation-progress.json`:
```json
{
  "phase": "execution",
  "planApproved": true,
  "totalScenes": 8,
  "completedScenes": [1, 2, 3],
  "failedScenes": [],
  "currentScene": 4,
  "tsVerified": false,
  "lastError": null,
  "updatedAt": "2026-03-15T10:30:00Z"
}
```

Read by orchestrator on resume to understand state after context compaction.

---

## 7. Enhanced Init Endpoint

Current `/init` accepts: `{ manifest, videoUrl?, audioUrl? }`

New `/init` is **additive** — all new fields are optional. If `transcript` is missing (transcription not yet complete), the sandbox initializes without it. The orchestrator detects this and either waits for a subsequent `POST /transcript` call or asks the user to wait. Existing init flow (video download, ffprobe, manifest write) is unchanged.

New `/init` accepts:
```typescript
{
  manifest: ManifestV2;
  videoUrl?: string;        // S3 key for source video
  audioUrl?: string;        // S3 key for separate audio
  transcript: {
    words: Array<{
      word: string;
      start: number;       // seconds
      end: number;         // seconds
      confidence: number;
    }>;
    text: string;           // full text
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
  userBrief: string;        // user's text description
  headTracking?: {
    speakerGrid: number[][]; // 6x6 spatial occupancy grid
    safePlacement: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  };
  projectMeta: {
    width: number;
    height: number;
    fps: number;
    durationMs: number;
  };
}
```

---

## 8. Docker Image Changes

The sandbox Dockerfile needs additional dependencies:

```dockerfile
# Already present: node:20-slim base, ffmpeg + ffprobe (for video probing)
FROM node:20-slim

# Add for MCP servers
COPY packages/mcp-servers/dist/ /app/mcp-servers/
RUN npm install -g mcp-remote better-icons

# Add for asset fetching (ZIP extraction from Freepik)
RUN apt-get update && apt-get install -y \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Add shared prompt modules (from worker's battle-tested prompt suite)
COPY packages/worker/src/prompts/shared/ /app/prompts/shared/

# Add theme design system files
COPY packages/worker/src/prompts/themes/ /app/prompts/themes/

# Existing: workspace template, sandbox code, node_modules
```

Environment variables to add:
```
FREEPIK_API_KEY      — Freepik icon/illustration search
PEXELS_API_KEY       — Pexels stock photo search
UNSPLASH_ACCESS_KEY  — Unsplash stock photo search
```

---

## 9. File System Layout (Updated)

```
/workspace/
├── manifest.json                    # Source of truth during session
├── docs/
│   ├── transcript.json              # Word-level transcript (NEW)
│   ├── user-brief.md                # User's description (NEW)
│   ├── speaker-grid.json            # Head-tracking data (NEW)
│   ├── SCENE_PLAN.md                # Generated by Planner (NEW)
│   ├── shared/                      # Shared prompt modules
│   │   ├── technical-rules.md
│   │   ├── motion-design-principles.md
│   │   ├── vocabulary.md
│   │   └── quality-checklist.md
│   └── themes/                      # Theme design system files (NEW)
│       ├── themes.json              # Theme catalog with color palettes
│       └── studio/
│           ├── design-system.md     # Animation patterns, component library
│           ├── director-style.md    # Planning guidance for theme
│           ├── dark/style-guide.md  # Dark variant specifics
│           └── light/style-guide.md # Light variant specifics
├── generation-progress.json         # Phase tracking (NEW)
├── scenes.json                      # Machine-readable scene data (NEW)
├── src/
│   ├── PlayerComposition.tsx        # Entry point
│   ├── scene-registry.ts            # Auto-generated scene imports
│   ├── scenes/                      # AI-generated scene files
│   │   ├── HookTitle.tsx            # Meaningful names from Planner
│   │   ├── AlgorithmDiagram.tsx
│   │   ├── ResultsCounter.tsx
│   │   └── ...                      # Only animation beats get files
│   ├── components/                  # Shared components (Background.tsx, etc.)
│   └── composition/                 # Remotion infrastructure
├── public/
│   ├── source.mp4                   # Source video
│   ├── audio.mp3                    # Separate audio (optional)
│   └── assets/                      # Downloaded stock assets (NEW)
│       ├── photo-1.jpg
│       ├── icon-arrow.svg
│       └── ...
├── .build/
│   └── player-composition.cjs.js    # esbuild output
└── node_modules → /app/node_modules # Symlink
```

---

## 10. Error Handling

### 10.1 Agent Errors

| Error | Recovery |
|-------|----------|
| Resume fails | Fallback to text history + progress file |
| Subagent fails | Orchestrator retries once, then reports to user |
| TS verification fails | Healer attempts fix (max 3 times), then warns user |
| Scene verification fails | Healer patches (max 2 times), then accepts with warning |
| MCP tool fails | Agent retries once, then adapts approach |
| Abort (user cancel) | Checkpoint current state, respond with partial progress |
| Context compaction | Orchestrator reads generation-progress.json to recover state |

### 10.2 Infrastructure Errors

| Error | Recovery |
|-------|----------|
| esbuild fails | Agent reads error, fixes source, retriggers |
| ffprobe fails | Use manifest duration as fallback |
| Asset download fails | Agent continues without asset, notes in plan |
| Sandbox suspend during generation | State preserved in volume backup, resumes on next open |

---

## 11. Security

- Agent runs with `bypassPermissions` inside sandbox (isolated container)
- Bash commands restricted: Agent can run npm/node commands but sandbox has no network egress except to API callback URL and asset CDNs
- MCP tools validate inputs (e.g., asset-server blocks localhost/private IPs)
- All API communication uses Bearer token auth
- Frontend never connects directly to sandbox

---

## 12. What's NOT in Scope (Future Phases)

- **Template library** — Pre-built reusable Remotion components. For now, agent writes all code from scratch.
- **Remotion Lambda rendering** — Final video export via serverless rendering. For now, preview-only via Player.
- **E2B migration** — Replace Docker/Railway with Firecracker microVMs. Separate initiative.
- **Parallel Animator dispatch** — Run multiple scene Animators concurrently. Sequential for now.
- **Budget controls** — `maxBudgetUsd` per session. Add when cost data is available.
- **Hooks for observability** — PostToolUse logging, Notification forwarding. Nice-to-have.

---

## 13. Success Criteria

1. User can upload a video, describe what they want, and the agent produces a complete set of motion graphics scenes
2. Agent asks relevant questions before planning (not a one-shot generation)
3. Scene plan is presented as an interactive widget for approval
4. Each generated scene renders correctly in the Player (no blank scenes, no TS errors)
5. User can request refinements and see changes live
6. Session persists across page refreshes (resume works)
7. All existing MCP tools (manifest, scenes, render, widgets) continue working
8. Asset search/download works for stock photos and icons
