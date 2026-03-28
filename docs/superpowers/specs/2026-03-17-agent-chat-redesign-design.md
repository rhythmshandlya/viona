# Agent Chat System Redesign

**Date:** 2026-03-17
**Status:** Design

## Problem

`AIAssistantPanel.tsx` is a 1,939-line monolith handling SSE streaming, message rendering, widget display, progress tracking, activity state, and input management. The UI lacks glassmorphic consistency with the rest of the editor, progress reporting is disconnected from actual agent phases, and the chat input is basic.

## Goals

1. Decompose the monolith into focused, testable components
2. Glassmorphic visual design consistent with the liquid glass editor aesthetic
3. Three-phase progress relay matching actual agent workflow (planning → workflow → editing)
4. Polished chat input with context chips, attachments, and action affordances
5. Agent plan widget showing a live task tree during orchestration

---

## Section 1 — Component Architecture

### Current State

One file (`AIAssistantPanel.tsx`, 1,939 lines) owns everything: SSE connection, message parsing, widget rendering, progress tracking, activity state sync, input handling, scroll management, and stall detection.

### Target Structure

```
features/editor-v2/components/ai-chat/
├── AIAssistantPanel.tsx      — Container: SSE connection, message state, scroll
├── ChatMessageList.tsx       — Scrollable message list with auto-scroll
├── ChatBubble.tsx            — Single message bubble (user or assistant)
├── ChatInput.tsx             — Glass input card with context chips & actions
├── AgentPlanWidget.tsx       — Collapsible task tree widget
├── ProgressIndicator.tsx     — Inline progress bar replacing ActivityBar
├── WidgetRenderer.tsx        — Widget type dispatcher (scene_plan, theme_picker, etc.)
└── types.ts                  — Shared types for the chat system
```

### Responsibilities

| Component | Owns | Receives |
|-----------|------|----------|
| `AIAssistantPanel` | SSE lifecycle, message array, streaming state | Editor store context (selected scene, time range, element) |
| `ChatMessageList` | Scroll position, auto-scroll logic (simple `overflow-y-auto` + `scrollIntoView`, defer virtualization to follow-up if needed) | `messages[]`, `isStreaming` |
| `ChatBubble` | Text rendering, markdown, segment grouping | Single `Message`, role |
| `ChatInput` | Textarea, context chips, submit | `onSend`, `isStreaming`, editing context |
| `AgentPlanWidget` | Task tree expansion, status icons | `AgentPlan` data from SSE |
| `ProgressIndicator` | Phase display, elapsed time, agent badge | Current phase, agent name, message |
| `WidgetRenderer` | Widget type routing | Widget data, `onResponse` callback |

### Message Segmentation

Messages contain interleaved content blocks. Adjacent text blocks merge into a single bubble; widgets and progress indicators break out as full-width elements between bubbles.

```typescript
type MessageBlock =
  | { type: 'text'; text: string }
  | { type: 'widget'; widget: WidgetData }
  | { type: 'plan'; plan: AgentPlan };
```

Note: The existing `ProgressBlock` type is deprecated and only kept for rendering old DB messages. New progress is **not** stored as a message block — it's transient state shown by `ProgressIndicator` via a React state variable (`currentProgress`). The `plan` block type IS persisted in message content for refresh recovery.

### SSE Event Types (Extended)

Existing events remain unchanged. New events added:

| Event | Payload | Handler |
|-------|---------|---------|
| `text` | `{ text: string }` | Append to current text block |
| `widget` | `{ kind, id, ...data }` | Insert widget block |
| `progress` | `{ phase, message, agentName, ... }` | Update progress indicator |
| `activity` | `{ agent, action }` | Update activity badge |
| **`agent_plan`** | `{ tasks: AgentTask[] }` | **NEW** — Insert/update plan widget |
| `heartbeat` | — | Reset stall timer |
| `error` | `{ message }` | Show error state |
| `done` | — | Finalize message |
| `reset` | — | Clear partial state (text blocks + plan blocks) |

---

## Section 2 — Visual Design

### Design Language

All chat elements follow the editor's liquid glass aesthetic: `backdrop-blur-xl`, translucent backgrounds, subtle `white/10` borders, Sora font at weight 400, hierarchy through size and opacity only.

Define glassmorphic tokens as CSS variables in `globals.css` for consistency with the existing editor theme system:

```css
--chat-bubble-assistant-bg: rgba(255, 255, 255, 0.04);
--chat-bubble-user-bg: rgba(var(--accent-rgb), 0.12);
--chat-bubble-border: rgba(255, 255, 255, 0.08);
--chat-input-bg: rgba(255, 255, 255, 0.06);
--chat-input-border: rgba(255, 255, 255, 0.1);
--chat-plan-bg: rgba(255, 255, 255, 0.03);
--chat-plan-border: rgba(255, 255, 255, 0.06);
```

### Chat Bubbles

**Assistant bubbles:**
- Background: `bg-white/[0.04]` with `backdrop-blur-xl`
- Border: `border border-white/[0.08]`
- Text: `text-white/90`, Sora 400, `text-sm`
- Rounded: `rounded-2xl` with `rounded-tl-md` (tail on top-left)
- Full width minus small margin

**User bubbles:**
- Background: `bg-accent/[0.12]` with `backdrop-blur-lg`
- Border: `border border-accent/[0.15]`
- Text: `text-white/95`, Sora 400, `text-sm`
- Rounded: `rounded-2xl` with `rounded-tr-md` (tail on top-right)
- Right-aligned, max-width 85%

### Agent Plan Widget

Appears inline in the message flow when the orchestrator calls `report_plan`.

- Container: `bg-white/[0.03]` glass card, `border border-white/[0.06]`, `rounded-xl`
- Header: Plan title + collapse toggle
- Task rows: indented list with status icons
  - `pending` → dim circle
  - `running` → pulsing blue dot + agent badge
  - `complete` → green checkmark
  - `failed` → red X
- Subtasks: nested under parent with connecting line
- Tool badges: small pills showing which tools were used (e.g., "render_still", "write_scene")
- Expand/collapse per task group

### Progress Indicator

Replaces the current `ActivityBar` as an inline element in the chat flow.

- Slim glass bar: `bg-white/[0.04]`, `h-8`, `rounded-lg`
- Left: pulsing dot colored by agent (Editor=blue, Planner=purple, Animator=green, Reviewer=yellow)
- Center: status message in `text-xs text-white/60`
- Right: elapsed time in `text-xs text-white/40`
- Appears below the latest assistant message during streaming
- Animates in/out with `framer-motion` fade + slide

### Chat Input

Glass card fixed at the bottom of the chat panel.

- Container: `bg-white/[0.06]`, `backdrop-blur-xl`, `border border-white/[0.1]`, `rounded-xl`
- Textarea: transparent, auto-resizing, Sora 400, placeholder `text-white/30`
- Context chips row (above textarea): show selected scene, time range, or element as small glass pills
  - Each chip: `bg-white/[0.08]`, `rounded-full`, `text-xs`, with dismiss X
- Bottom row: attachment button (left), send button (right, accent glow when content present)
- Send button: `bg-accent/80` circle with arrow icon, `hover:bg-accent`

---

## Section 3 — Backend: Progress Relay & Agent Plan

### Three Progress Relay Phases

The agent pipeline has three distinct phases where progress should be reported to the user. Each phase uses different mechanisms and granularity.

#### Phase 1 — Planning

The orchestrator is thinking, analyzing the transcript, and building a visual plan.

- **Source:** Orchestrator calls `report_progress` MCP tool
- **SSE event:** `progress`
- **Display:** Inline progress indicator with Planner agent badge
- **Messages:** "Analyzing your video...", "Planning visual scenes...", "Reviewing transcript..."
- **Duration:** 10-30 seconds typically

#### Phase 2 — Workflow Running

The orchestrator dispatches subagents (Editor, Animator) to execute the plan. This is the longest phase with the most granular progress.

- **Source:** Orchestrator calls `report_progress` with per-scene updates + `report_plan` with task tree
- **SSE events:** `progress` + `agent_plan`
- **Display:** Agent plan widget (task tree) + progress indicator showing active agent/track
- **Messages:** "Generating scene 2 of 5...", "Rendering overlays...", "Building captions..."
- **Duration:** 1-5 minutes depending on complexity

#### Phase 3 — Agent Editing

After initial generation, conversational edits where the agent modifies specific scenes or elements.

- **Source:** Orchestrator calls `report_progress` with Editor agent
- **SSE event:** `progress`
- **Display:** Inline progress indicator with Editor agent badge
- **Messages:** "Updating scene 3...", "Adjusting timing...", "Applying your changes..."
- **Duration:** 10-60 seconds per edit

### Shared Types

Add to `packages/shared/src/progress-types.ts`:

```typescript
interface AgentSubtask {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  tools?: string[];
}

interface AgentTask {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  agent?: string;
  subtasks?: AgentSubtask[];
}

interface AgentPlan {
  title: string;
  tasks: AgentTask[];
}

interface ProgressPayload {
  phase: string;
  percent?: number;  // Optional in MCP tool schema, defaults to 0 in handler
  message: string;
  agentName?: string;
  trackName?: string;
  estimatedTimeRemaining?: number;
}
```

### New MCP Tool: `report_plan`

Added to the widgets MCP server alongside `show_widget` and `report_progress`.

```typescript
// Zod schema for the tool
{
  title: z.string().describe('Plan title shown in the widget header'),
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    status: z.enum(['pending', 'running', 'complete', 'failed']),
    agent: z.string().optional().describe('Agent handling this task: Editor, Planner, Animator, Reviewer'),
    subtasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      status: z.enum(['pending', 'running', 'complete', 'failed']),
      tools: z.array(z.string()).optional().describe('Tool names used for this subtask'),
    })).optional(),
  })),
}
```

### Full Backend Plumbing

The `agent_plan` event must flow through four layers. Here's every touch point:

**1. WidgetCallbacks (`packages/sandbox/src/tools/widget-tools.ts`)**

```typescript
interface WidgetCallbacks {
  onWidget: (widget: Record<string, unknown>) => void;
  onProgress: (progress: ProgressPayload) => void;
  onPlan: (plan: AgentPlan) => void;  // NEW
}
```

**2. MCP Server (`packages/sandbox/src/mcp-servers.ts`)**

Add `report_plan` tool to the widgets server. The tool calls `widgetCallbacks.onPlan(input)`.

**3. Agent Server (`packages/sandbox/src/agent-server.ts`)**

Wire `onPlan` when creating MCP servers:

```typescript
const mcpServers = createMcpServers({
  onWidget: (widget) => sendSSE('widget', widget),
  onProgress: (progress) => sendSSE('progress', progress),
  onPlan: (plan) => sendSSE('agent_plan', plan),  // NEW
});
```

**4. WIDGET_TOOL_NAMES (`packages/sandbox/src/orchestrator.ts`)**

Update the constant to include the new tool:

```typescript
const WIDGET_TOOL_NAMES = [
  'mcp__widgets__show_widget',
  'mcp__widgets__report_progress',
  'mcp__widgets__report_plan',  // NEW
];
```

**5. InterceptCallbacks (`packages/api/src/sandbox/proxy.ts`)**

Add `onPlan` to the `InterceptCallbacks` interface and a new `case 'agent_plan':` in the proxy switch statement:

```typescript
case 'agent_plan': {
  writeSSE('agent_plan', data);
  callbacks.onPlan?.(data);
  break;
}
```

Note: `onPlan` only exists on `WidgetCallbacks` and `InterceptCallbacks` — it does NOT go through `OrchestratorCallbacks` (which handles text/done/error). The plan flows directly from MCP tool → widget callback → SSE, same as `onWidget` and `onProgress`.

**6. Agent Router (`packages/api/src/agent/agent-router.ts`)**

Add `onPlan` callback that upserts (not appends) the plan block in `contentBlocks`:

```typescript
onPlan: (plan) => {
  flushText();
  const existingIdx = contentBlocks.findIndex(b => b.type === 'plan');
  if (existingIdx >= 0) {
    contentBlocks[existingIdx] = { type: 'plan', plan };
  } else {
    contentBlocks.push({ type: 'plan', plan });
  }
  sseWriter.send('agent_plan', plan);
},
```

This ensures the plan survives page refresh (persisted in DB message content) and updates in-place since the plan is mutable.

**7. Redis persistence (optional, recommended)**

Store current plan in `sandbox:plan:${projectId}` Redis key (matching existing `sandbox:progress:${projectId}` and `sandbox:activity:${projectId}` patterns). The GET conversation endpoint should check this key alongside the existing progress/activity checks. TTL matches existing keys (1 hour).

### SSE Event: `agent_plan`

```typescript
// SSE payload
{
  event: 'agent_plan',
  data: {
    title: string;
    tasks: AgentTask[];
  }
}
```

The plan is **mutable** — the orchestrator calls `report_plan` multiple times as tasks progress. Each call replaces the previous plan state (same widget, updated statuses). The frontend should animate status transitions.

### Frontend SSE Handler

On receiving `agent_plan`, the handler uses a **merge-not-append** strategy:

```typescript
case 'agent_plan': {
  const plan = JSON.parse(event.data);
  setMessages(prev => {
    const updated = [...prev];
    const lastMsg = updated[updated.length - 1];
    if (lastMsg?.role === 'assistant') {
      const planIdx = lastMsg.content.findIndex(b => b.type === 'plan');
      if (planIdx >= 0) {
        lastMsg.content[planIdx] = { type: 'plan', plan };
      } else {
        lastMsg.content.push({ type: 'plan', plan });
      }
    }
    return updated;
  });
  break;
}
```

On `reset`, clear both text blocks and plan blocks from the current assistant message.

### Orchestrator Prompt Update

Add to the orchestrator system prompt:

1. Instruction to call `report_plan` at the start of workflow dispatch with full task tree (all tasks `pending`)
2. Instruction to call `report_plan` again as each task transitions to `running` → `complete`/`failed`
3. Instruction to use `report_progress` for lightweight status messages between plan updates
4. Map the three phases to prompt guidance:
   - Phase 1 (planning): Use `report_progress` with `agentName: "Planner"`
   - Phase 2 (workflow): Use both `report_plan` (task tree) and `report_progress` (per-scene status)
   - Phase 3 (editing): Use `report_progress` with `agentName: "Editor"`

---

## Section 4 — Data Flow

### End-to-End SSE Flow

```
User sends message
  → Frontend POST /agent/chat
    → API creates DB message
    → API calls proxyPromptWithIntercept
      → Sandbox orchestrator runs
        → Calls report_progress (Phase 1: planning)
        → Calls report_plan (task tree, all pending)
        → Dispatches subagents
          → Calls report_plan (task updates)
          → Calls report_progress (per-scene status)
        → Calls report_plan (all complete)
        → Returns text response
      ← Sandbox proxy streams events
    ← API forwards SSE events
  ← Frontend updates message blocks
```

### State Management

Chat state lives in `AIAssistantPanel` (local React state), not the editor store. The editor store only holds:
- `agentActivity` — for the global activity indicator
- `selectedSceneId`, `selectedTimeRange`, `selectedElement` — context passed to chat input

This keeps the chat self-contained and avoids polluting the editor store with ephemeral streaming state.

---

## Migration Strategy

1. Create `ai-chat/` folder with new components
2. Extract types first (`types.ts`)
3. Move rendering logic into `ChatBubble`, `ChatMessageList`, `WidgetRenderer`
4. Extract input into `ChatInput` with context chips
5. Build `AgentPlanWidget` and `ProgressIndicator` as new components
6. Add `report_plan` MCP tool + `onPlan` callback + `agent_plan` SSE event
7. Update orchestrator prompt with three-phase progress guidance
8. Rewire `AIAssistantPanel` as thin container
9. Remove `ActivityBar` (replaced by inline `ProgressIndicator`)
10. Apply glassmorphic styles throughout

The existing SSE protocol is backwards-compatible — new events are additive. Old clients ignore unknown event types.
