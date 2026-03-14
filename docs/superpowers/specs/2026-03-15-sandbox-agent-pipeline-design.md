# Sandbox Agent Pipeline — Design Spec

**Date:** 2026-03-15
**Status:** Draft
**Scope:** Replace the worker's visual generation pipeline with a conversational agent running inside the sandbox container.

---

## 1. Overview

Build an autonomous video editing agent that runs inside the sandbox Docker container. The agent plans, generates Remotion motion graphics, edits the manifest v2 timeline, and refines — all through natural conversation in the editor sidebar.

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
├── Planner (Opus) — NEW planner-system.md
│   Purpose: Analyze transcript, create scene plan, output SCENE_PLAN.md + scenes.json
│   Tools: Read, Write, Glob, Grep, manifest MCP
│   Trigger: When orchestrator has enough context to plan
│   Note: Display mode selection per scene (default/fullscreen/overlay)
│         guided by display-mode-table.md rules.
│         NO widgets MCP — Planner returns plan to orchestrator,
│         orchestrator presents it via show_widget.
│
├── Verifier (Sonnet) — NEW verifier-system.md
│   Purpose: Screenshot scenes, compare against plan, report quality issues
│   Tools: Read, Glob, Grep, render MCP, viewport MCP
│   Trigger: After each scene is generated
│
└── Healer (Sonnet) — NEW healer-system.md
    Purpose: Fix TypeScript errors, interpolate clamping issues
    Tools: Read, Edit, Glob, Grep, Bash
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

### Phase 3: Execution

**Trigger:** User approves the scene plan.

**Flow per scene:**
1. Orchestrator dispatches **Researcher subagent** to fetch assets referenced in the plan
   - Stock photos via Pexels/Unsplash MCP
   - Icons via Freepik/Better-Icons MCP
   - Web images via Assets MCP `download_file`
2. Orchestrator dispatches **Animator subagent** with:
   - Single scene description from SCENE_PLAN.md
   - Available asset paths in workspace
   - Canvas dimensions, fps
   - Shared technical rules (Remotion patterns, interpolate clamping)
3. Animator writes `scenes/Scene{N}.tsx`
4. Animator updates manifest v2 via manifest MCP tools:
   - Adds scene item to overlay track with correct timing
   - Sets transform (position, size, opacity)
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
- After each Scene*.tsx is written, `scene-registry.ts` is regenerated
- Maps scene numbers to React components
- `PlayerComposition.tsx` imports from registry

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

### 5.1 Existing Prompts (KEEP — already battle-tested)

The sandbox already has carefully written prompts in `packages/sandbox/src/prompts/`:

**`orchestrator-system.md`** (1406 lines) — Creative Director
- Sharp, opinionated personality ("talks like creative partner")
- Four phases: Understanding → Planning → Execution → Refinement
- Content type detection (tutorial, podcast, interview, vlog, presentation, keynote)
- Treatment selection (animation, screenshot, stock_video, text_overlay, speaker_only, trim)
- Edit plan format with vivid visual descriptions
- Subagent dispatch rules, manifest tool usage, widget usage
- Quality standards and verification protocols

**`animator-system.md`** (~60KB) — Motion Graphics Engineer
- ONE SCENE AT A TIME with reasoning BEFORE coding
- Display mode rules: default, fullscreen, overlay (with full layout specs)
- Frame-perfect sync points from word-level timestamps
- Shared module knowledge: technical-rules, motion-design-principles, vocabulary, quality-checklist
- Overlay safe zones: top strip (0-15%), speaker face (15-58% OFF-LIMITS), lower-third (58-85%), subtitle area (85-100%)
- interpolate() clamping rules (both extrapolateLeft + extrapolateRight)
- useCurrentFrame() is 0-relative inside `<Sequence>` (critical bug)

**`researcher-system.md`** (181 lines) — Asset Researcher
- Screenshot capture via headless Chromium
- Stock image search (Pexels/Unsplash, download via curl, resize with ffmpeg)
- Asset naming convention: descriptive kebab-case

**`trimmer-system.md`** (232 lines) — Audio Trimmer
- Silence detection via ffmpeg
- Filler word detection from transcript
- Precise cuts via manifest split/delete tools
- Safety: never trim speech, 100ms padding, preserve natural pauses

### 5.2 Prompt Extensions Required

**Orchestrator (`orchestrator-system.md`) — extend with:**
- Planner subagent definition and dispatch rules
- Verifier subagent definition and dispatch rules
- Healer subagent definition and dispatch rules
- Progress tracking protocol (`generation-progress.json`)
- Scene plan widget approval flow
- Context recovery protocol (read progress file after compaction)

**`PromptContext` type — extend with:**
```typescript
interface PromptContext {
  // Existing:
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  durationMs: number;
  hasTranscript: boolean;
  theme: string;
  projectType: string;
  // New:
  briefSummary: string;         // First 500 chars of user brief
  hasHeadTracking: boolean;
  totalScenes?: number;         // Set after planning
  currentPhase?: string;        // From generation-progress.json
}
```

### 5.3 New Prompts to Write

**`planner-system.md`** — Scene Planning Specialist (NEW)
- Adapted from worker's `packages/worker/src/prompts/director/system.md` (29KB) for conversational context
- Worker also has `director/director.py` with `build_director_user_message()` — adapt the context assembly logic
- Display mode selection per scene using `display-mode-table.md` rules:
  - `"default"` — 60-70% of scenes, standard PiP/stacked layout
  - `"fullscreen"` — 1-3 key moments, speaker hidden, full canvas
  - `"overlay"` — speaker credibility, transparent bg, spatially aware
- scenes.json v2 format with segment grouping
- SCENE_PLAN.md format with timing + visual descriptions
- `[IMAGE: keyword]` tagging for asset fetching
- Scene duration bounds: 210-450 frames (7-15 sec at 30fps)
- Transition types: cut (default), fade, zoom-in, zoom-out
- Self-verification table requirement

**`verifier-system.md`** — Quality Reviewer (NEW)
- Screenshot interpretation against plan description
- Display mode compliance checking (overlay must have no bg, fullscreen must fill canvas)
- Pass/fail with structured verdict (uses viewport MCP `submit_verdict`)
- Max 2 fix rounds per scene

**`healer-system.md`** — TypeScript Fixer (NEW)
- Common Remotion TS errors and patterns
- interpolate() input range monotonicity rules
- Minimal fix philosophy — targeted patches only
- tsc output parsing

### 5.4 Layout Mode System (Critical for Quality)

The layout mode system is how scenes are composed relative to the speaker video. This MUST be properly conveyed through the prompt chain:

**Orchestrator** → decides content type → influences display mode distribution
**Planner** → assigns display mode per scene → writes to scenes.json
**Animator** → implements scene code following mode-specific rules:

| Mode | Animator Rules | Manifest Transform |
|------|---------------|-------------------|
| `default` | Standard layout, speaker visible in PiP bubble | Scene item: `width: 100%, height: 100%` on overlay track |
| `fullscreen` | Full canvas, no speaker, big bold elements. Top 20% title, middle 40% content, bottom 25% secondary, bottom 15% reserved for subtitles | Scene item: `width: 100%, height: 100%`, video item hidden or scaled down |
| `overlay` | Transparent background MANDATORY. Two zones only: top strip (0-15%), lower-third (58-85%). Max 2 elements, 1-3 words each. Speaker grid awareness. | Scene item: `width: 100%, height: 100%` with transparent bg |

**Overlay rules enforced by Verifier:**
- NO `backgroundColor` on ANY element
- NO content in 15-58% Y range (speaker zone)
- Max container width: 55% of canvas
- Full opacity (1.0) at rest
- Gentle spring entrances only (damping ≥ 28, stiffness ≤ 60)

### 5.5 Shared Modules

Already exist in `packages/worker/src/prompts/shared/`, copied to sandbox workspace at `/workspace/docs/shared/`:
- `technical-rules.md` — Remotion API, animation constraints
- `motion-design-principles.md` — Disney 12 principles, engagement
- `vocabulary.md` — Scene description conventions
- `quality-checklist.md` — Auto-verification criteria

Prepended to Animator and Healer prompts via existing `loadPromptWithShared()`.

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
    │   ├── Animator → writes Scene*.tsx + updates manifest
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
│   └── shared/                      # Shared prompt modules
│       ├── technical-rules.md
│       ├── motion-design-principles.md
│       ├── vocabulary.md
│       └── quality-checklist.md
├── generation-progress.json         # Phase tracking (NEW)
├── scenes.json                      # Machine-readable scene data (NEW)
├── src/
│   ├── PlayerComposition.tsx        # Entry point
│   ├── scene-registry.ts            # Auto-generated scene imports
│   ├── scenes/                      # AI-generated scene files (NEW)
│   │   ├── Scene1.tsx
│   │   ├── Scene2.tsx
│   │   └── ...
│   ├── components/                  # Shared components
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
