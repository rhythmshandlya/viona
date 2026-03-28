# Progress & Streaming Issues

Tracked issues with the AI assistant's progress reporting and streaming feedback during sandbox pipeline execution.

---

## Issue 1: No visual feedback during Planner subagent execution

**Severity:** High — user sees a dead chat for potentially minutes during planning
**Reported:** 2026-03-16

### What happens

1. User asks Viona to create visuals
2. Orchestrator sends initial text (e.g. "Planning your scenes...") → text appears in chat
3. Orchestrator dispatches Planner via SDK `Agent` tool
4. **Planner runs for 1-3+ minutes — zero SSE events reach the frontend** (only heartbeats)
5. Planner finishes → orchestrator reads plan → `show_widget` sends the scene_plan widget
6. User suddenly sees the plan appear after minutes of nothing

### Root causes

**A) Bouncing dots vanish once any content exists**

`AIAssistantPanel.tsx:1901` — the typing indicator condition:
```jsx
{message.content.length === 0 && isStreaming && (
  <div className="flex gap-1 py-1">
    <span className="animate-bounce" />...
  </div>
)}
```

Once Viona's initial text arrives, `content.length > 0` and the dots disappear permanently — even though `isStreaming` is still true and active work continues in the background.

**B) SDK subagent execution produces zero parent-stream events**

`orchestrator.ts:271` — `processStream()` only forwards `text_delta` events. When the orchestrator dispatches the Planner via the SDK `Agent` tool, the subagent runs internally within the SDK. No `text_delta` events are produced on the parent stream during subagent execution. Only heartbeats keep the SSE connection alive.

**C) Planner subagent has no access to `report_progress`**

`orchestrator.ts:156-161` — the Planner's tool list:
```
tools: ['Read', 'Write', 'Glob', 'Grep', 'WebSearch', 'WebFetch',
        ...MANIFEST_TOOL_NAMES, ...RENDER_TOOL_NAMES, ...ASSET_TOOL_NAMES]
```

`WIDGET_TOOL_NAMES` (which includes `report_progress`) is NOT in the Planner's tools. The Planner cannot report progress even if it wanted to.

**D) Orchestrator prompt has no inline progress instruction for Phase 3**

Phases 5/6/7 have explicit `**Progress:**` instructions telling the orchestrator to call `report_progress` before/after dispatch. Phases 2/3/4 do not. The general progress checkpoints table exists but is far from the phase instructions — the LLM doesn't reliably follow it.

### Affected phases

| Phase | Has inline progress instruction? | Subagent has widget tools? |
|-------|----------------------------------|---------------------------|
| Phase 2 (Trimming) | No | No (Editor) |
| Phase 3 (Planning) | No | No (Planner) |
| Phase 4 (Rough Cut) | No | No (Editor) |
| Phase 5 (Animation) | Yes | No (Animator) |
| Phase 6 (Review) | Yes | No (Reviewer) |
| Phase 7 (Assembly) | Yes | No (Editor) |

Note: Even for Phases 5-7 the orchestrator itself calls `report_progress` between subagent dispatches — the subagents never call it directly.

### Files involved

- `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` — typing indicator logic, SSE event handling
- `packages/sandbox/src/orchestrator.ts` — `processStream()` event filtering, subagent tool lists
- `packages/sandbox/src/agent-server.ts` — SSE event emission from sandbox
- `packages/sandbox/src/mcp-servers.ts` — `report_progress` tool definition
- `packages/api/src/sandbox/proxy.ts` — SSE proxy with monologue suppression
- `packages/sandbox/src/prompts/orchestrator-system.md` — phase instructions, progress checkpoints
- `apps/web/src/features/editor-v2/hooks/use-progress.ts` — unified progress state hook

---

## Issue 2: Progress shows meaningless percentages instead of activity status

**Severity:** High — misleading UX, percentage is non-deterministic
**Reported:** 2026-03-16

### What happens

The `ActivityIndicator` and `ProgressBar` both prominently display a percentage (`42%`, `67%`, etc.). This number is whatever the LLM decides to report via `report_progress` — it's not measured from any real metric. The user sees a number that jumps around unpredictably and conveys no useful information.

What the user actually needs is a qualitative activity indicator — a pulsing dot with a human-readable status like:

> ● Editor is trimming the video
> ● Planner is researching scenes
> ● Animator is building Scene 3 of 6

This is analogous to Claude's "thinking" indicator — the user doesn't need to know what % Claude is at, just that it's actively working and roughly what it's doing.

### Current behavior

**`ActivityIndicator.tsx`** (pinned above messages):
- Shows `{Math.round(percent)}%` prominently with bold weight
- Message text is secondary, truncated with ellipsis
- The pulsing orb animation is good — but paired with a fake number

**`ProgressBar.tsx`** (inline in message content):
- Shows `{roundedPercent}%` in the top-right
- Has a progress bar fill width based on `displayPercent`
- Phase timeline dots (Trim → Plan → Cut → Animate → Review → Assemble) — these are useful
- Agent badge (Editor, Planner, etc.) and track badge — these are useful
- `useSmoothProgress` artificially interpolates between LLM-reported values with auto-creep

### Why the percentage is wrong

1. **Non-deterministic source**: The LLM picks a number when calling `report_progress`. There's no ground truth — the same pipeline run might report 40% or 55% at the same logical point.
2. **Synthetic smoothing hides the problem**: `useSmoothProgress` interpolates and auto-creeps (0.8%/sec) to prevent visual stalls. This means the displayed number is doubly fake — a smooth interpolation of a made-up number.
3. **High-water mark prevents correction**: `use-progress.ts` never lets the percent go backward. If the LLM over-reports early, the bar gets stuck near the top for the rest of the pipeline.
4. **Phase boundaries don't align**: The orchestrator prompt defines percent checkpoints (e.g. "planning = 15%", "rough-cut = 20%") but the LLM doesn't hit them precisely, so the phase timeline highlight and the percent can disagree.

### What it should look like

Replace the percent-centric UI with an **activity-centric** indicator:

- **Pulsing dot + status text** — the primary element. e.g. `● Planner is analyzing transcript...`
- **Phase timeline** — keep the dot-based phase markers (Trim → Plan → Cut → Animate → Review → Assemble). Highlight the current phase. No percent needed — just which phase is active.
- **Agent badge** — keep. Knowing which agent is working is useful context.
- **No numeric percentage** — remove from both `ActivityIndicator` and `ProgressBar`
- **No progress bar fill** — remove the horizontal bar. A bar implies measurable progress which doesn't exist.
- **Optional elapsed time** — `2m 15s` since phase started is honest and useful, unlike a fake ETA.

### Files involved

- `apps/web/src/features/editor-v2/components/ActivityIndicator.tsx` — shows `{Math.round(percent)}%` prominently
- `apps/web/src/features/editor-v2/components/ProgressBar.tsx` — shows bar fill + `{roundedPercent}%` + phase timeline
- `apps/web/src/features/editor-v2/hooks/use-smooth-progress.ts` — synthetic percent interpolation (may become unnecessary)
- `apps/web/src/features/editor-v2/hooks/use-progress.ts` — high-water mark logic, percent-centric state shape
- `packages/shared/src/progress-types.ts` — `ProgressState` type definition
- `packages/sandbox/src/mcp-servers.ts` — `report_progress` tool schema (percent field)
- `packages/sandbox/src/prompts/orchestrator-system.md` — percent checkpoint table

---

## Industry Research: How AI Agents Show Progress

Researched 2026-03-16 to inform the redesign of Issues 1 & 2.

### Key finding: Nobody uses percentages for AI agent work

The only exception is ChatGPT Deep Research's rough progress bar for 5-10 min research sessions. Every other product uses **action labels** and **phase indicators** instead.

### Patterns by product

**Claude.ai** — Pulsing shimmer on message area during thinking. Collapsible "Thinking..." block for extended thinking. Tool use shows labeled blocks ("Searching the web...", "Reading [source]..."). Research mode shows an expanding log of actions. No percentages anywhere.

**ChatGPT** — Collapsible status line per tool call ("Searching...", "Running code...", "Creating image..."). DALL-E shows a shimmer placeholder rectangle. Deep Research has a progress bar + scrollable action log side panel. Agent mode shows an action plan then steps through it.

**Cursor / Windsurf** — Real-time action label ("Searching codebase...", "Editing files..."). File pills show context being used. Plan mode generates a checklist — items get checked off as completed. Multi-agent view shows parallel agent cards each with their own status. No percentages.

**v0.dev** — Streaming code on the left, live preview updating on the right. The preview rendering IS the progress. No explicit progress indicator.

**Devin** — Most elaborate: four-tab workspace (Planner, Shell, Browser, Editor) with real-time following. Planner tab shows graded accordion steps. Full timeline scrubber at bottom for session replay. Checkpoint restore at any point.

**Bolt / Lovable / Replit** — File tree populating + terminal output + live preview. The app being built is the progress signal. Replit Agent 4 shows parallel agent progress cards.

### Pattern taxonomy

| Pattern | Products | Our equivalent |
|---------|----------|---------------|
| Pulsing dot + action label | Claude, ChatGPT, Cursor | `ActivityIndicator` (needs redesign) |
| Collapsible tool blocks | Claude, ChatGPT | Not implemented |
| Phase checklist with checkmarks | Cursor, Windsurf | Phase timeline dots (keep, improve) |
| Agent identity badge | None (unique to us) | Agent badge in `ProgressBar` (keep) |
| Live preview | v0, Bolt, Lovable | We have the Remotion player — could update incrementally |
| Shimmer placeholder | ChatGPT (images) | Could use for scene placeholders |
| Timeline scrubber / replay | Devin | Out of scope for now |
| Streaming text | Everyone | Already implemented |

### Design direction for Viona

Based on research, the right model for our pipeline is:

1. **Activity indicator** (replaces `ActivityIndicator`) — pulsing dot + action description. Always visible during streaming. e.g. `● Planner is researching scenes...`

2. **Phase markers** (keep from `ProgressBar`) — horizontal dots: Trim → Plan → Cut → Animate → Review → Assemble. Current phase highlighted, completed phases checked. No fill bar between them.

3. **Agent badge** (keep from `ProgressBar`) — color-coded pill showing which agent is active (Editor, Planner, Animator, Reviewer). This is a differentiator — no other product shows sub-agent identity.

4. **Drop entirely**: numeric percentage, progress bar fill, `useSmoothProgress` auto-creep, high-water mark, ETA estimates.

5. **Optional addition**: elapsed time since phase started (`2m 15s`) — honest and useful.

6. **Optional addition**: collapsible detail for power users — what tools the agent is using, which files it's reading. Similar to Claude.ai's research mode log.

---

## Issue 3: All text arrives after work completes — no real-time intent signal

**Severity:** High — user has zero feedback during long operations, then gets a wall of content
**Reported:** 2026-03-16

### What happens

The user sees this appear all at once after minutes of silence:

> "Perfect — clean, professional, you front and center with one full-screen animation moment. Let me trim the transcript and build the plan."
> [Scene Plan widget — 6 scenes]
> "Here's the plan — 6 scenes with you front and center 76% of the time..."

The text "Let me trim the transcript and build the plan" reads like it should appear BEFORE the work starts. But it actually arrived AFTER — the orchestrator wrote all text as a retrospective summary once the Planner finished.

### Root cause: orchestrator prompt suppresses pre-action text

`orchestrator-system.md` — streaming behavior section:

```
- Output ZERO text before tool calls. Call tools silently.
- Use thinking for ALL reasoning. The user should only see your final, clean response AFTER all tools complete.
```

This instruction was designed to prevent the LLM from narrating every tool call ("Now I'll read the transcript... Now I'll dispatch the Planner..."). But the side effect is that the LLM batches ALL text output until after tools complete:

1. Orchestrator thinks → decides to dispatch Planner
2. Calls tools silently (reads transcript, dispatches Planner, reads plan, shows widget)
3. ALL tools complete
4. THEN writes text: "Let me trim and build the plan" + "Here's the plan — 6 scenes..."

The user experiences this as: minutes of nothing → sudden wall of text + widget.

### The conflict

The prompt has two competing goals:
- **Don't narrate tool calls** — correct, the user shouldn't see "Now calling mcp__manifest__read_manifest..."
- **Show intent before action** — the user SHOULD see "Planning your scenes..." before a multi-minute operation starts

The current prompt conflates these. "Output ZERO text before tool calls" prevents both internal narration AND useful intent signals.

### What should happen

The orchestrator should emit a short intent message BEFORE dispatching a long-running subagent, then go silent during execution, then emit the result:

1. Text: "Planning your scenes..." → appears immediately in chat
2. Activity indicator: `● Planner is analyzing transcript...` → pulsing during work
3. Widget: [Scene Plan] → appears when Planner finishes
4. Text: "Here's the plan — 6 scenes..." → appears after widget

This requires changing the prompt to distinguish between:
- **Forbidden**: narrating individual tool calls ("Reading transcript.json...", "Calling show_widget...")
- **Required**: short intent signal before multi-minute subagent dispatches ("Trimming the transcript...", "Planning scenes...", "Generating animations...")

### Files involved

- `packages/sandbox/src/prompts/orchestrator-system.md` — "Output ZERO text before tool calls" instruction in STREAMING BEHAVIOR section
- `packages/sandbox/src/orchestrator.ts` — `processStream()` text forwarding (works fine technically — the LLM just doesn't emit text early)
- `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` — message rendering (would naturally handle split text if the LLM emitted it)

---

## Issue 4: Scene plan widget is embedded inside the chat bubble

**Severity:** Medium — poor UX for the most important decision point in the pipeline
**Reported:** 2026-03-16

### What happens

The scene plan widget (the 6-scene plan with "Approve & Generate" / "Revise" buttons) renders inline inside Viona's chat message bubble, sandwiched between text blocks:

```
┌─────────────────────────────────────────────┐
│ "Perfect — clean, professional...            │
│  Let me trim the transcript and build..."    │
│                                              │
│  ┌─────────────────────────────────────┐     │
│  │ 📄 Scene Plan          6 scenes     │     │
│  │                                     │     │
│  │  [Approve & Generate]  [Revise]     │     │
│  └─────────────────────────────────────┘     │
│                                              │
│ "Here's the plan — 6 scenes with you         │
│  front and center 76% of the time..."        │
└─────────────────────────────────────────────┘
```

### Why this is wrong

1. **The plan is the single most important artifact in the pipeline.** It determines everything that follows — scene layout, animation, pacing. It deserves prominent, dedicated screen real estate, not a collapsed card inside a chat bubble.

2. **Chat bubbles scroll away.** If the user sends another message or Viona responds, the plan card scrolls up and becomes hard to find. The user needs to reference the plan throughout the session.

3. **The plan has rich content** — scene descriptions, timing, visual treatments, spatial layout. A collapsed card with an expand button can't do this justice. It needs a proper panel or modal.

4. **Approve/Revise is a critical gate.** The entire pipeline blocks on this decision. Burying the CTA inside a chat bubble makes it easy to miss, especially if the user stepped away during the planning phase.

### What it should look like

The scene plan should render as a **dedicated panel or overlay** — separate from the chat flow:

- **Option A — Side panel**: Scene plan appears in the main editor area (right of chat), like a document. Chat shows a compact reference card ("I've prepared a 6-scene plan →") with a link to focus the panel.
- **Option B — Modal/drawer**: Full-screen or half-screen overlay with the complete plan, scene-by-scene breakdown, and prominent Approve/Revise buttons. Chat shows "Plan ready for review" with a button to open it.
- **Option C — Pinned card**: The plan card pins to the top of the chat panel (above the scroll area) until the user acts on it. It doesn't scroll away with messages.

In all options, the plan card in chat should be a **compact reference** (title + scene count + CTA), not the full plan content.

### Files involved

- `apps/web/src/features/editor-v2/components/agent-widgets/ScenePlanCard.tsx` — current inline plan widget
- `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` — renders widgets inline in message content blocks
- `packages/sandbox/src/mcp-servers.ts` — `show_widget` tool with kind `scene_plan`
