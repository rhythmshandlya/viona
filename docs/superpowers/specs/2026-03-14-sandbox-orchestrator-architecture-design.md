# Sandbox Orchestrator Architecture — Design Spec

## Goal

Replace the current split architecture (API agent + BullMQ worker + Python subprocess) with a unified sandbox-based orchestrator that:

- Runs all AI intelligence inside the sandbox container (planning, generation, editing)
- Supports heterogeneous edit types (animations, screenshots, B-roll, trimming, text overlays) — not just animations
- Uses Claude Agent SDK with programmatic subagents for parallel specialized tasks
- Provides live preview updates as edits land
- Follows a Lovable-style user flow: chat → plan → approve → execute → refine

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│                                                              │
│  Chat Panel ←──SSE──→ API (thin relay) ←──SSE──→ Sandbox    │
│  Remotion Player ← manifest + scene files + presigned URLs   │
│  WebSocket ← bundle-ready / manifest-updated events          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ API (Thin Relay)                                             │
│                                                              │
│  - Auth, rate limiting, concurrent stream limits (max 2)     │
│  - Conversation persistence (messages DB)                    │
│  - Forward prompt + history to sandbox POST /prompt          │
│  - Relay SSE events back to browser                          │
│  - Sandbox lifecycle (create/suspend/resume)                 │
│  - File proxy (bundle, public assets)                        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Sandbox Container                                            │
│                                                              │
│  Orchestrator Agent (Claude SDK, Opus)                       │
│    ├─ Reads skills from /workspace/.claude/skills/           │
│    ├─ Analyzes transcript, detects content type              │
│    ├─ Builds context through conversation (chat mode)        │
│    ├─ Creates edit plan in /workspace/docs/                  │
│    ├─ Shows plan to user for approval                        │
│    ├─ On approval, dispatches subagents:                     │
│    │   ├─ Animator (writes .tsx scene files)                 │
│    │   ├─ Researcher (web search, screenshots)               │
│    │   └─ Trimmer (silence detection, cuts)                  │
│    ├─ Handles simple edits directly (text, B-roll, manifest) │
│    └─ Streams progress → API → browser SSE                   │
│                                                              │
│  /workspace/                                                 │
│    ├─ manifest.json (v2, source of truth)                    │
│    ├─ docs/                                                  │
│    │   ├─ edit-plan.md (master creative plan)                │
│    │   ├─ trim-plan.md (silence/filler cuts)                 │
│    │   └─ research.md (web sources, screenshots)             │
│    ├─ src/scenes/*.tsx (animation scene files)               │
│    ├─ public/ (media, screenshots, B-roll)                   │
│    ├─ .build/ (CJS bundle)                                   │
│    └─ .claude/ (CLAUDE.md, skills/)                          │
│                                                              │
│  esbuild watcher → auto-rebuild on src/ changes              │
│  File server (8080) → serves bundle + public assets          │
│  Agent server (8081) → receives prompts, runs orchestrator   │
└──────────────────────────────────────────────────────────────┘
```

## 1. User Flow

### Phase 1: Understanding (Chat Mode)

User uploads video + describes what they want. Sandbox boots. The orchestrator builds context through conversation:

1. Reads transcript (already transcribed during upload/sandbox init)
2. Analyzes content type from transcript patterns
3. Asks clarifying questions one at a time — content type, style preference, treatment approach
4. Shows theme picker widget, layout picker widget as needed
5. Conversation history accumulates — every answer narrows the creative direction

The orchestrator does NOT start editing yet. It gathers intent.

### Phase 2: Planning

Once the orchestrator has enough context:

1. Reads planning skills: `editorial-planning` → `visual-treatment-guide` → `narrative-structure` → `transcript-analysis`
2. Analyzes full transcript with word-level timestamps
3. Detects narrative beats (hook, story, context, analysis, opinion, outro)
4. Assigns treatment per section based on conversation context
5. Writes `/workspace/docs/edit-plan.md`
6. Writes `/workspace/docs/trim-plan.md` if trimming needed
7. Sends plan summary to user as an expandable widget

User reviews the plan:
- Can approve as-is
- Can request changes: "move section 3 before 2" / "use animation instead of screenshot for section 5"
- Can ask questions: "why did you choose B-roll for that part?"
- Orchestrator updates plan files based on feedback

### Phase 3: Execution (Agent Mode)

User approves → orchestrator switches to execution:

1. **Trimmer first** (if trim plan exists) — changes timeline, must happen before other edits
2. **Shared setup** for animations — creates `constants.ts`, `Background.tsx`
3. **Parallel subagent dispatch** for independent sections:
   - Animator subagent for animation sections
   - Researcher subagent for screenshot/article sections
   - Orchestrator handles stock video, text overlays, speaker-only sections directly via manifest tools
4. **Live preview updates** — as each subagent writes files:
   - Scene files → esbuild rebuilds → `bundle-ready` event → preview updates
   - Manifest changes → `manifest-updated` event → preview refreshes
5. **Verification** — orchestrator checks manifest coherence after all subagents complete
6. **Done** — sends completion message to user

### Phase 4: Refinement

User sees the edited video playing. Continues chatting:

- "Make the intro more punchy" → re-dispatch Animator for section 1 with updated guidance
- "Add a screenshot of the article at 1:20" → dispatch Researcher
- "Remove the part where I stutter" → orchestrator applies manifest cuts directly
- "Change the color scheme" → update constants.ts, re-trigger builds

The edit plan is updated with each refinement to reflect current state. The conversation has full memory across the entire journey.

### State Flow

```
UPLOAD → CHAT (build context)
           ↓
         PLAN (create edit plan)
           ↓
       APPROVE ←→ REVISE
           ↓
       EXECUTE (dispatch subagents)
           ↓
       PREVIEW (user sees result)
           ↓
       REFINE ←→ EXECUTE (incremental)
```

## 2. Video Content Types & Treatments

### Content Types (detected from transcript analysis)

| Content Type | Signals | Primary Treatments |
|---|---|---|
| Talking head explainer | Abstract concepts, "let me explain", "how X works" | Animations, diagrams, motion graphics |
| News/commentary | Company names, dollar amounts, "according to", "reports say" | Screenshots, article captures, text overlays |
| Tutorial/how-to | Step-by-step language, "first", "next", "click on" | Screen recordings, zoom/highlight, callouts |
| Product review | Product names, comparisons, specs, "vs" | Product images, spec overlays, comparison graphics |
| Podcast/interview | Multiple speakers, conversational, Q&A | Speaker cuts, split screen, name lower thirds |
| Vlog/lifestyle | Personal narrative, "I went", "we did" | B-roll, music, transitions, text |
| Video essay | Analysis, citations, "in this film", references | Film clips, images, citations, text overlays |

### Treatment Types

| Treatment | What It Produces | Who Handles It |
|---|---|---|
| `animation` | Custom Remotion `.tsx` scene file | Animator subagent |
| `screenshot` | Web article screenshot + browser frame mockup | Researcher subagent |
| `image` | Stock photo/illustration from Pexels/Freepik | Researcher subagent |
| `stock-video` | Stock video clip as manifest video item | Orchestrator directly |
| `text-overlay` | Text/lower-third as manifest text item | Orchestrator directly |
| `speaker-only` | No overlay — just the speaker | Orchestrator directly (no-op or minimal text) |
| `trim` | Remove silence/filler/dead air | Trimmer subagent |

### Universal Edit Operations (apply to all content types)

- Trimming — silence removal, filler word cuts, dead air
- Captions/subtitles — already built in current system
- Text overlays — titles, lower thirds, callouts
- Transitions — between sections
- Audio — music selection, volume ducking, fade in/out (future)

## 3. Edit Plan Format

The master plan at `/workspace/docs/edit-plan.md`. Human-readable markdown.

```markdown
# Edit Plan

## Video Analysis
- Content type: news-commentary
- Duration: 3:24 (204s)
- Speaker: single, centered, face zone 20-55%
- Tone: fast-paced, informative
- Trim: yes (detected 3.8s dead air)

## Sections

### 1. Hook (0:00 - 0:08)
- **Treatment:** animation
- **Layout:** fullscreen
- **Visual:** Bold title "OpenAI's $50B Bet" fills screen,
  dollar signs particle stream behind
- **Technique:** kinetic-typography
- **Sync points:**
  - 0:02 "fifty billion" → title impacts
  - 0:05 "biggest ever" → counter animation
- **Connects to:** dollar sign element carries to section 2

### 2. The Story (0:08 - 0:45)
- **Treatment:** screenshot
- **Layout:** stacked (video 60%, screenshot 40%)
- **Source query:** "OpenAI $50B fundraise TechCrunch 2026"
- **Framing:** browser mockup, zoom into headline
- **Sync points:**
  - 0:12 "according to reports" → screenshot enters
  - 0:30 "SoftBank leading" → highlight investor name

### 3. Scale Context (0:45 - 1:20)
- **Treatment:** animation
- **Layout:** fullscreen
- **Visual:** comparison bar chart, OpenAI vs Anthropic vs Google
- **Technique:** data-viz
- **Sync points:**
  - 0:52 "three times more" → bars animate to scale
  - 1:05 "unprecedented" → camera zooms into gap
- **Builds from:** dollar sign from section 1

### 4. What They'll Build (1:20 - 1:55)
- **Treatment:** stock-video
- **Layout:** fullscreen with speaker PiP
- **Search:** "AI data center servers rack"
- **Sync points:**
  - 1:25 "massive compute" → video starts
  - 1:45 "training runs" → text overlay "100K GPUs"

### 5. My Take (1:55 - 2:30)
- **Treatment:** speaker-only
- **Layout:** speaker fullscreen
- **Overlay:** subtle text "hot take" at lower-third
- **Reason:** personal opinion, credibility moment

### 6. Outro (2:30 - 3:24)
- **Treatment:** animation
- **Layout:** fullscreen
- **Visual:** subscribe CTA, channel branding
- **Technique:** kinetic-typography
```

Key properties:
- **Treatment is the primary field** — drives which subagent handles it
- **Layout per section** — maps to manifest v2 transforms
- **Sync points tied to specific words** — same precision as current Director
- **Continuity fields** (`builds from`, `connects to`) — for animation sections only
- **No machine-specific fields** — no frame numbers, IDs, or JSON
- **Human-readable** — user can review and edit in approval widget

### Supporting Documents

**`/workspace/docs/trim-plan.md`** — created by Trimmer subagent:
```markdown
## Detected cuts
- 0:23.4 - 0:24.8: silence (1.4s)
- 1:05.2 - 1:06.1: filler "um" (0.9s)
- 2:45.0 - 2:46.5: dead air (1.5s)
## Recommended action: remove all (saves 3.8s)
```

**`/workspace/docs/research.md`** — created by Researcher subagent:
```markdown
## OpenAI $50B fundraise
- Source: https://techcrunch.com/...
- Screenshot saved: /workspace/public/research/openai-article.png
- Key quote: "..."
```

## 4. Orchestrator Agent Design

### System Prompt Composition

The orchestrator loads skills from `/workspace/.claude/skills/` via `settingSources: ['project']`. Its system prompt establishes:

1. Role: Creative editor and director
2. Content type detection rules (transcript patterns → type)
3. Treatment selection guide (when to use each treatment)
4. Edit plan format specification
5. Manifest v2 tool usage (how to write items, tracks, transforms)
6. Subagent dispatch rules (what each does, when to parallelize)
7. Quality standards (sync point cadence, pacing variety, visual rhythm)

### Available Tools

| Tool | Purpose |
|---|---|
| `Read` / `Write` / `Edit` / `Glob` / `Grep` | Filesystem (plans, docs, code) |
| `Bash` | Shell commands (ffprobe, ffmpeg for audio analysis) |
| `WebSearch` / `WebFetch` | Research articles, find references |
| `Agent` | Dispatch subagents (Animator, Researcher, Trimmer) |
| `Skill` | Read skills from .claude/skills/ |
| `mcp__manifest__*` | All manifest tools (read, add/update/remove items and tracks, split video) |
| `mcp__scenes__write_scene_file` | Write .tsx scene files |
| `mcp__scenes__delete_scene_file` | Delete scene files |
| `mcp__render__render_still` | Render PNG for verification |
| `mcp__render__trigger_rebuild` | Force esbuild rebuild |

### Decision Flow

```
User prompt arrives
  → Orchestrator reads transcript + manifest
  → Detects content type from transcript
  → Asks clarifying questions (theme, style, treatment preference)
  → Writes /workspace/docs/edit-plan.md
  → Shows plan widget to user
  → User approves
  → For each section:
      animation     → dispatch Animator subagent
      screenshot    → dispatch Researcher subagent
      trim          → dispatch Trimmer subagent (FIRST — changes timeline)
      stock-video   → orchestrator adds video manifest item directly
      text-overlay  → orchestrator adds text manifest item directly
      speaker-only  → orchestrator adds minimal manifest item directly
  → After subagents complete, verify manifest coherence
  → Send "done" to user
```

## 5. Subagent Designs

### Animator Subagent

**Model:** Opus
**Purpose:** Write Remotion `.tsx` scene files for animation sections.

**What it receives via Agent tool prompt:**
- Relevant section(s) from the edit plan
- Manifest context (canvas size, fps, duration, existing items)
- Style/theme info (colors, typography, preset)

**System prompt includes:**
- Shared modules: technical-rules, motion-design-principles, vocabulary, quality-checklist (existing, battle-tested)
- Scene component contract (useCurrentFrame, transparent background, relative sizing)
- Display-mode-specific rules (fullscreen, overlay, stacked — existing)
- Self-verification checklist

**What it does:**
1. Reads its assigned section from the edit plan
2. Plans the animation (layers, timing, choreography)
3. Creates `constants.ts` if not exists (shared colors, springs, timing)
4. Writes `src/scenes/Section{N}.tsx`
5. Renders a still via `render_still` → self-checks
6. Fixes issues if found (max 2 retries)
7. Adds a `scene` item to the manifest via manifest tools

**Tools:** `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `Skill`, manifest tools, scene tools, render still, asset MCP servers (Pexels, icons)

**What stays from current pipeline:**
- All shared prompt modules (technical-rules, motion-design, vocabulary, checklist)
- Interpolate clamping rules, spring configs, stagger patterns
- Overlay safe zone rules (0-15% top, 58-85% lower-third)
- Screenshot verification via render-still
- Display-mode-specific rules (fullscreen, overlay, stacked)

**What changes:**
- No separate Setup agent — orchestrator pre-creates constants.ts and Background.tsx
- No Python subprocess — runs as Claude SDK subagent directly
- No BullMQ job — dispatched by orchestrator via Agent tool
- Can handle one section or a batch of sections

### Researcher Subagent

**Model:** Sonnet (cheaper — research is tool-heavy, not creative)
**Purpose:** Find and capture web content for screenshot/article/image sections.

**What it receives:**
- Section from edit plan (what to research, source hints)
- Target dimensions for screenshots

**What it does:**
1. Uses `WebSearch` to find the article/source
2. Takes screenshot via Chromium (`Bash` — sandbox has Chromium installed)
3. Saves to `/workspace/public/research/article-{n}.png`
4. Writes findings to `/workspace/docs/research.md`
5. Adds an `image` item to the manifest with transform (browser frame, zoom to headline, etc.)
6. Uploads asset to MinIO for presigned URL

**Tools:** `WebSearch`, `WebFetch`, `Bash` (Chromium screenshots, MinIO CLI upload), `Read`, `Write`, manifest tools

### Trimmer Subagent

**Model:** Sonnet
**Purpose:** Detect and remove dead air, silences, filler words.

**What it receives:**
- Full transcript with word-level timestamps
- Audio file path

**What it does:**
1. Analyzes word timestamps for gaps (silence > 0.5s)
2. Uses `ffmpeg` via Bash for silence detection on audio
3. Detects filler words ("um", "uh", "like", "you know") from transcript
4. Writes `/workspace/docs/trim-plan.md` with all detected cuts
5. Applies cuts to manifest — splits video items at cut points, removes gaps
6. Adjusts all downstream item timing

**Tools:** `Bash` (ffmpeg), `Read`, `Write`, `Grep`, manifest tools (read, split_video, update_item, remove_item)

**Important:** Trimmer runs FIRST, before other subagents, because it changes the timeline. The edit plan uses **pre-trim timestamps** (original video timecodes). After trimming, the Trimmer adjusts downstream section timings in the edit plan to reflect the new timeline. Other subagents then work with the updated timings.

## 6. Skills Architecture

All custom-written, stored in `packages/sandbox/template/.claude/skills/`, copied into Docker image, available at `/workspace/.claude/skills/` at runtime.

### Existing Skills (keep — for Animator subagent)

```
framer-motion/           — Spring animation patterns, reusable components
motion-one/              — Spring configs, Disney's 12 principles, choreography
remotion-best-practices/ — Official Remotion patterns (30+ rule files)
video-engagement/        — Hook techniques, retention, scene structure
graphic-designer/        — CRAP principles, color theory, visual hierarchy
interaction-design/      — Microinteractions, motion design
marketing-visual-design/ — Video/social content strategy
```

### New Skills — Orchestrator

```
editorial-planning/          — Content type detection, section breakdown, edit plan format
visual-treatment-guide/      — Decision tree: animation vs screenshot vs broll vs text vs speaker-only
narrative-structure/         — Story arc detection (hook/tension/insight/payoff), emotional pacing
transcript-analysis/         — Sync point identification, filler detection, topic shift patterns
```

### New Skills — Editing Craft

```
cutting-and-pacing/          — Dmytryk's 7 rules, J/L cuts, retention rhythm (15-25s visual changes)
transitions/                 — Cut types, dissolves, wipes, match cuts — when to use each
lower-third-and-overlays/    — Text overlay design, placement, typography, animation timing
screenshot-and-research/     — Web research methodology, screenshot framing, browser mockups
```

### New Skills — Audio & Platform

```
sound-design/                — Sound hierarchy, music selection, SFX timing, volume ducking
platform-optimization/       — YouTube/TikTok/Reels export specs, aspect ratios, hook optimization
```

### Skill Loading Pattern

CLAUDE.md in the sandbox workspace mandates skill reading order:

**Orchestrator:** Before planning, read `editorial-planning` → `visual-treatment-guide` → `narrative-structure` → `transcript-analysis`

**Animator:** Before coding, read `framer-motion` → `motion-one` → `video-engagement` (existing pattern)

**Researcher:** Before searching, read `screenshot-and-research`

**Trimmer:** Before cutting, read `cutting-and-pacing`

## 7. API ↔ Sandbox Communication Protocol

### Layer 1: API (Thin Relay)

The API stops running Claude SDK. It becomes a relay:

**Responsibilities:**
- Authenticate user, manage conversation DB (messages persist across sessions)
- Forward prompt + conversation history to sandbox `POST /prompt`
- Relay SSE stream from sandbox back to browser
- Handle concurrent stream limits (max 2 per project)
- Manage sandbox lifecycle (create/suspend/resume)
- File proxy (bundle, public assets) — unchanged
- Event buffering for Last-Event-ID resumption — unchanged

**Prompt forwarding:**

```
POST /projects/:id/agent/chat (browser → API)
  → API saves user message to DB
  → API creates empty assistant message row
  → API calls POST sandbox:8081/prompt with:
      {
        prompt: "user message text",
        conversationHistory: [ last 50 messages from DB ],
        projectContext: { canvas, fps, transcript, theme, ... },
        sessionId: "previous SDK session ID or null"
      }
  → Sandbox returns SSE stream
  → API relays each event to browser:
      text → update assistant message in DB + forward to browser
      widget → capture in DB + forward to browser
      progress → forward to browser
      done → save sessionId to conversation DB + forward to browser
```

### Layer 2: Sandbox Agent Server (Orchestrator)

The agent-server runs Claude SDK `query()` with the full orchestrator configuration:

**SDK Configuration:**
- Model: Opus
- System prompt: built from skills + project context
- Allowed tools: filesystem + web + manifest MCP + scene MCP + render MCP + Agent
- Permission mode: `bypassPermissions` (sandbox is isolated)
- Setting sources: `['project']` (loads .claude/ skills and CLAUDE.md)
- Subagent definitions: Animator (Opus), Researcher (Sonnet), Trimmer (Sonnet)
- Max turns: 100 (generous for multi-subagent orchestration)
- Max budget: configurable per request
- Partial messages: enabled (stream text deltas)

**Session management:**
- If `sessionId` provided, attempt `resume: sessionId`
- On resume failure: start fresh `query()` with conversation history as text context
- Return new `sessionId` in `done` event for next turn

**SSE events emitted to API:**
- `text` — chat response text deltas
- `widget` — theme picker, layout picker, plan preview, progress indicators
- `progress` — status updates during subagent execution
- `manifest:updated` — manifest changed (triggers preview refresh via WebSocket)
- `bundle:ready` — esbuild completed (triggers preview bundle reload)
- `done` — orchestrator finished, includes sessionId and cost

### Layer 3: Callbacks (Unchanged)

Sandbox → API internal callbacks stay the same:
- `POST /internal/sandbox/:id/bundle-ready` — esbuild completed
- `POST /internal/sandbox/:id/manifest-updated` — manifest changed
- `POST /internal/sandbox/:id/checkpoint` — periodic manifest backup

These trigger WebSocket events to the browser via Redis pub/sub (existing pattern).

### Session & Conversation Persistence

**Conversation history** lives in the API database — survives sandbox death. One conversation per project, last 50 messages loaded as context.

**SDK session** lives in the sandbox — lost on suspend/destroy. On resume failure or fresh sandbox, the orchestrator gets conversation history as text and reads the edit plan from disk to understand current state.

**Edit plan** at `/workspace/docs/edit-plan.md` acts as a durable checkpoint — even if the SDK session is lost, the orchestrator can read the plan and understand what was planned and what was completed.

### Progress Streaming During Subagent Execution

Subagents run inside the SDK agent loop — the orchestrator can't stream text during subagent execution. Pattern:

1. Orchestrator emits progress text BEFORE dispatching: "Starting animations for section 1..."
2. Dispatches subagent → subagent writes scene file
3. esbuild watcher rebuilds → `bundle-ready` callback → browser preview updates live
4. Subagent returns result → orchestrator emits next progress text
5. Repeat for each section

The user sees:
- Chat text: progress messages from orchestrator between subagent calls
- Preview: live updates as files land (via WebSocket bundle-ready/manifest-updated events)
- Final summary when all sections complete

### Error Recovery

| Failure | Recovery |
|---|---|
| Sandbox dies mid-orchestration | API detects connection drop, marks session suspended. User refreshes → sandbox resumes from volume backup. Conversation replayed from DB. Edit plan on disk shows progress. |
| Subagent fails | Orchestrator receives error as Agent tool result. Can retry, skip section, or report to user. |
| SDK session expires | Next prompt falls back to text history. Orchestrator reads edit-plan.md + manifest for current state. |
| API restarts | Rehydrate: health check sandboxes, re-establish idle tracking. Conversations in DB intact. |
| Long subagent timeout | SDK's `maxTurns` / `maxBudgetUsd` prevent runaway. Orchestrator checkpoints progress to edit-plan.md between subagent calls. |
| User cancels mid-execution | Browser sends `POST /api/projects/:id/sandbox/cancel`. API calls sandbox `POST :8081/cancel` which aborts the running `query()` (SDK abort signal). Orchestrator stops, partially completed work stays on disk (scenes written so far, partial edit plan). User can resume later — orchestrator reads edit-plan.md to see what was done. |

### Cancellation

The browser's "Stop" button (already exists in stall detection UI) sends a cancel request:

```
Browser → POST /api/projects/:id/sandbox/cancel
  → API → POST sandbox:8081/cancel
    → Agent server aborts SDK query() via AbortController
    → SSE stream closes
    → Browser receives stream end
    → Partially completed files remain on disk
```

The project is always in a coherent partial state because:
- Each subagent writes complete files (never partial .tsx)
- Manifest updates are atomic (mutex-protected MCP tools)
- Edit plan is checkpointed between subagent dispatches

### Widget Response Routing

When the user responds to a widget (e.g., approves a plan), the response is sent as a new prompt turn:

```
POST sandbox:8081/prompt
  body: {
    prompt: "",  // empty text — response is in metadata
    widgetResponse: { widgetId: "plan-v1", value: "approve" },
    conversationHistory: [ ...previous messages... ],
    sessionId: "prev-session"
  }
```

The agent server injects the widget response into the SDK's conversation as a user message: `"[User approved the edit plan]"` or `"[User selected theme: modern-dark]"`. The orchestrator then continues from where it left off (SDK session resume provides continuity).

### Concurrent Manifest Safety

The manifest MCP server already uses a **mutex lock** (in `manifest-ops.ts`) — all read/write operations are serialized. Even if two streams are active (API allows max 2), manifest operations from different orchestrator sessions are queued. However, concurrent orchestration on the same project is not recommended — the "max 2 concurrent SSE streams" limit is for SSE transport reliability (reconnection), not for running two separate orchestrations. In practice, only one orchestration runs at a time per project.

## 8. End-to-End Workflows (Frontend Connected)

These workflows trace the complete flow from browser interaction through API relay through sandbox execution and back to browser preview updates.

### Workflow 1: User Sends Chat Message → Gets Text Response

```
Browser (AIAssistantPanel)                API (agent-router)                  Sandbox (agent-server)
─────────────────────────────             ──────────────────                  ──────────────────────
sendMessage("make it punchy")
  → _executeMessage()
  → api.chatWithSandboxAgent()
    POST /api/projects/:id/sandbox/prompt
    body: { prompt, conversationId }
                                          Auth + rate limit check
                                          Save user message to DB
                                          Create empty assistant row
                                          Load last 50 messages from DB
                                          POST sandbox:8081/prompt
                                          body: { prompt, history, context }
                                          Opens SSE stream ←─────────────────  Receives prompt
                                                                               Loads skills (editorial-planning, etc.)
                                                                               Runs Claude SDK query()
                                                                               Orchestrator reasons about request
                                          ← SSE event: text "I'll make..."  ←  SDK emits partial text
    ← SSE relayed to browser
    parseSSEStream() yields text event
    Appends to current message block
    UI re-renders with streaming text
                                          ← SSE event: text "...the intro" ←  More partial text
                                          Flush text to DB (2s debounce)
                                          ← SSE event: done { sessionId }   ←  SDK query() completes
    parseSSEStream() yields done
    Sets isStreaming = false
    Flushes message queue if any
                                          Save sessionId to conversation DB
                                          Save final assistant message to DB
```

### Workflow 2: Plan Creation → Widget Approval → Execution

```
Browser                                   API                                 Sandbox
───────                                   ───                                 ───────
User: "edit this video, make it engaging"
  → POST /sandbox/prompt
                                          → POST sandbox:8081/prompt
                                                                               Orchestrator analyzes transcript
                                                                               Reads planning skills
                                                                               Detects content type
                                          ← text "I'll create an edit plan"
  Shows streaming text
                                                                               Writes /workspace/docs/edit-plan.md
                                                                               Builds plan summary widget data
                                          ← widget { type: "scene-plan",
                                              scenes: [...], actions: [
                                                "approve", "edit", "reject"
                                              ]}
  Renders ScenePlanCard widget
  User reviews sections, clicks "Approve"
  handleWidgetResponse(widgetId, "approve")
  → POST /sandbox/prompt
    body: { prompt: "", widgetResponse:
      { widgetId, value: "approve" }}
                                          → POST sandbox:8081/prompt
                                            (resume: sessionId)
                                                                               Orchestrator receives approval
                                          ← text "Starting edits..."
                                          ← progress { phase: "trim",
                                              percent: 10, message:
                                              "Trimming silence..." }
  Updates ProgressBlock (phase bar)
                                                                               Dispatches Trimmer subagent
                                                                               Trimmer writes trim-plan.md
                                                                               Trimmer calls manifest split_video
                                                                               Manifest changes on disk
                                                                               → POST /internal/sandbox/:id/
                                                                                 manifest-updated
                                          Receives callback
                                          Redis pub/sub → WebSocket
  ← WS: { type: "manifest-updated" }
  useEditorStore: updates manifest
  WorkspacePlayer re-renders with
    new manifest (trimmed timeline)

                                          ← progress { phase: "animate",
                                              percent: 30, message:
                                              "Animating section 1..." }
  Updates ProgressBlock
                                                                               Dispatches Animator subagent
                                                                               Animator writes src/scenes/Section1.tsx
                                                                               esbuild watcher detects change
                                                                               esbuild rebuilds → .build/bundle.cjs
                                                                               → POST /internal/sandbox/:id/
                                                                                 bundle-ready
                                          Receives callback
                                          Redis pub/sub → WebSocket
  ← WS: { type: "bundle-ready",
      version: 42 }
  useEditorStore: increments bundleVersion
  useWorkspaceComposition:
    clearCompositionCache()
    Fetches new bundle from
      /api/projects/:id/sandbox/
      player-composition.cjs.js?v=42
    Evaluates CJS via new Function()
    Registers new scene component
  WorkspacePlayer re-renders
    → User sees Section 1 animation live!

                                                                               Animator adds scene item to manifest
                                                                               → POST manifest-updated callback
  ← WS: manifest-updated
  Player re-renders with updated manifest
    (scene item now positioned on timeline)

                                          ← progress { phase: "animate",
                                              percent: 60, message:
                                              "Animating section 3..." }
                                                                               Dispatches Animator for section 3
                                                                               (parallel with Researcher for section 2)

                                                                               Researcher searches web, captures screenshot
                                                                               Saves to /workspace/public/research/
                                                                               Adds image item to manifest
                                                                               → POST manifest-updated
  ← WS: manifest-updated
  Player shows screenshot in preview

                                                                               Animator writes Section3.tsx
                                                                               → POST bundle-ready
  ← WS: bundle-ready (version: 43)
  Player reloads bundle, shows new scene

                                          ← progress { phase: "verify",
                                              percent: 90 }
                                                                               Orchestrator verifies manifest coherence
                                          ← text "All done! Here's what..."
                                          ← done { sessionId, cost }
  Stops streaming
  Final preview shows complete edit
```

### Workflow 3: Refinement Edit (Post-Execution)

```
Browser                                   API                                 Sandbox
───────                                   ───                                 ───────
User clicks on section 3 in player
  → useEditorStore: setAIEditingContext({
      type: "item", itemId: "scene-3" })
  → usePendingAIMessage: "make section 3
      more dynamic with faster cuts"
  → Auto-sends via sendMessage()

  → POST /sandbox/prompt
    body: { prompt: "make section 3...",
      editingContext: { type: "item",
        itemId: "scene-3" }}
                                          → POST sandbox:8081/prompt
                                            (resume: sessionId)
                                                                               Orchestrator reads edit-plan.md
                                                                               Identifies section 3 is animation type
                                                                               Updates edit-plan.md section 3 notes
                                          ← text "I'll rework section 3..."
                                                                               Dispatches Animator with updated guidance
                                                                               Animator edits src/scenes/Section3.tsx
                                                                               → bundle-ready callback
  ← WS: bundle-ready (version: 44)
  Player hot-reloads just the changed scene
  User sees updated animation immediately

                                                                               Animator renders still → self-checks
                                          ← text "Done — section 3 now has..."
                                          ← done
```

### Workflow 4: Sandbox Resume After Suspend

```
Browser                                   API                                 Sandbox
───────                                   ───                                 ───────
User returns to project after 30 min
  → Page load fetches conversation from DB
  → Renders full message history
  → Checks sandbox status: suspended

User sends message: "change the colors"
  → POST /sandbox/prompt
                                          Sandbox status = suspended
                                          Resume sandbox from volume backup
                                          Wait for sandbox health check (ready)
                                          POST sandbox:8081/prompt
                                          body: { ..., sessionId: prev }
                                                                               Attempts SDK resume(sessionId)
                                                                               ✓ Resume succeeds → continues session
                                          ← text "I'll update the colors..."
  Normal flow continues...

  --- OR if resume fails ---
                                                                               ✗ Resume fails (session expired)
                                          ← SSE event: reset
  Clears current assistant message blocks
                                                                               Starts fresh query() with
                                                                                 conversation history as text
                                                                               Reads /workspace/docs/edit-plan.md
                                                                                 to understand current project state
                                          ← text "I'll update the colors..."
  Normal flow continues (user sees no gap)
```

### Workflow 5: Error Recovery (Sandbox Dies Mid-Stream)

```
Browser                                   API                                 Sandbox
───────                                   ───                                 ───────
  SSE stream active, progress at 60%
                                                                               Container OOM / crash
                                          SSE connection drops
                                          Detects sandbox health check failure
  parseSSEStream throws SSETimeoutError
    (90s inactivity timeout)
  Stall detection triggers:
    Shows "Connection lost. Retry?"

User clicks "Retry"
  → POST /sandbox/prompt (same message)
                                          Sandbox status = error
                                          Create new sandbox from backup
                                          Wait for ready
                                          POST sandbox:8081/prompt
                                          body: { ..., sessionId: null }
                                                                               Fresh query() with history from DB
                                                                               Reads edit-plan.md → sees sections
                                                                                 1-3 complete (files exist on disk)
                                                                               Resumes from section 4
                                          ← text "Picking up where we left
                                              off — sections 1-3 are done..."
                                          ← progress { phase: "animate",
                                              percent: 65 }
  Resumes progress display from section 4
```

### Frontend Component Responsibilities (New Architecture)

| Component | Current | New |
|---|---|---|
| `AIAssistantPanel` | Sends to API agent endpoint, handles SSE from API's Claude SDK | Sends to API relay endpoint, handles SSE relayed from sandbox. **No change to SSE parsing or widget handling.** |
| `parseSSEStream` | Parses SSE events from API | Unchanged — same SSE format from relay |
| `useJobWebSocket` | Subscribes to BullMQ job events (job:progress, job:complete) | Subscribes to sandbox events (bundle-ready, manifest-updated). **Event types change, hook structure stays.** |
| `useProgress` | Merges SSE + WS + HTTP progress | Same merge logic. SSE progress events come from sandbox via relay. WS events are bundle-ready/manifest-updated instead of job:progress. |
| `WorkspacePlayer` | Loads bundle from sandbox URL, renders with manifest | Unchanged — same bundle URL, same manifest format |
| `useWorkspaceComposition` | Fetches CJS bundle, evaluates, caches | Unchanged — same evaluation, cache clearing on bundle-ready |
| `ScenePlanCard` widget | Shows scene plan from API agent | Shows scene plan from sandbox orchestrator — **same widget data format** |
| `useEditorStore` | Tracks workspace status, bundle version, manifest | Same selectors. `bundleVersion` incremented by bundle-ready WS events. |

### Key Insight: Minimal Frontend Changes

The frontend is already built for the sandbox architecture:
- SSE parsing is transport-agnostic — it doesn't care if events originate from API's Claude SDK or are relayed from a sandbox
- Widget system is data-driven — widgets render from JSON payloads regardless of source
- Player already loads bundles from sandbox URLs and reloads on version changes
- WebSocket already receives sandbox callbacks (bundle-ready, manifest-updated)

The main frontend changes are:
1. **Remove BullMQ job subscription** — no more job:progress/job:complete events
2. **Add sandbox event subscription** — bundle-ready and manifest-updated via WebSocket
3. **Update progress phase names** — from "plan"/"animate"/"verify" to treatment-specific phases
4. **New widget types** (optional) — treatment picker, content type display

## 9. What Changes vs Current System

### Removed

| Component | Why |
|---|---|
| `packages/worker/src/processors/plan-visuals.ts` | Planning moves to sandbox orchestrator |
| `packages/worker/src/processors/generate-visuals/` | Generation moves to sandbox subagents |
| `packages/worker/src/agents/` | No more `claude` CLI subprocess — Claude SDK orchestrator in sandbox |
| `packages/worker/src/prompts/director/` | Replaced by orchestrator skills + edit plan format |
| `packages/worker/src/prompts/animator/` (partially) | Shared modules preserved, workflow prompts replaced by subagent definitions |
| `packages/api/src/agent/agent-tools.ts` | Tools move to sandbox MCP servers |
| BullMQ job queues for plan-visuals, generate-visuals | No more worker jobs for visual pipeline |

### Preserved

| Component | Why |
|---|---|
| Shared prompt modules (technical-rules, motion-design, vocabulary, quality-checklist) | Battle-tested, directly used in Animator subagent prompt |
| Manifest tools (sandbox/src/tools/manifest-ops.ts) | Already built for v2 manifest |
| Scene tools (sandbox/src/tools/scene-tools.ts) | Already built |
| Render still tool | Already built |
| esbuild watcher | Already built |
| Conversation store (API) | Unchanged — still persists messages |
| Sandbox lifecycle (create/suspend/resume/backup) | Unchanged |
| File proxy, WebSocket relay | Unchanged |
| Existing skills (framer-motion, motion-one, remotion-best-practices, etc.) | Unchanged — Animator subagent uses them |

### Modified

| Component | Change |
|---|---|
| `packages/api/src/agent/agent-router.ts` | From full SDK orchestrator → thin SSE relay |
| `packages/api/src/agent/agent-system-prompt.ts` | Simplified — just formats project context for relay |
| `packages/sandbox/src/agent-server.ts` | From stub → full Claude SDK orchestrator with subagent definitions |
| `packages/sandbox/Dockerfile` | Add web access for Researcher, ensure Chromium available for screenshots |
| `packages/sandbox/template/.claude/skills/` | Add new planning/editing skills |
| `packages/sandbox/template/.claude/CLAUDE.md` | Update skill loading order for orchestrator |

### New

| Component | Purpose |
|---|---|
| `packages/sandbox/src/orchestrator.ts` | SDK query configuration, subagent definitions, prompt building |
| `packages/sandbox/src/prompts/` (or skills) | Orchestrator, Animator, Researcher, Trimmer prompt content |
| `packages/sandbox/template/.claude/skills/editorial-planning/` | Content type detection, edit plan format |
| `packages/sandbox/template/.claude/skills/visual-treatment-guide/` | Treatment selection decision tree |
| `packages/sandbox/template/.claude/skills/narrative-structure/` | Story arc detection, emotional pacing |
| `packages/sandbox/template/.claude/skills/transcript-analysis/` | Sync point ID, filler detection, beat mapping |
| `packages/sandbox/template/.claude/skills/cutting-and-pacing/` | Cut rules, retention rhythm |
| `packages/sandbox/template/.claude/skills/transitions/` | Transition types and when to use each |
| `packages/sandbox/template/.claude/skills/lower-third-and-overlays/` | Text overlay design |
| `packages/sandbox/template/.claude/skills/screenshot-and-research/` | Web research, screenshot framing |
| `packages/sandbox/template/.claude/skills/sound-design/` | Audio decisions |
| `packages/sandbox/template/.claude/skills/platform-optimization/` | Export specs per platform |

## 10. Dependencies

- Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) in sandbox container
- Manifest v2 schema (from performant-preview-architecture-design.md spec)
- Generic PlayerComposition renderer (from same spec)
- Chromium in sandbox Docker image (already present for Remotion rendering)
- Web access from sandbox container (for Researcher subagent — WebSearch, WebFetch)
- MinIO/S3 SDK in sandbox (for asset upload + presigned URLs)

## 11. Non-Goals

- Timeline UI (Phase 2 of performant-preview-architecture-design.md)
- Real-time collaborative editing (single user + AI for now)
- Multi-camera podcast editing (future)
- Audio/music generation (future — can select from library but not generate)
- Short-form clip extraction from long-form (future — OpusClip-style)
