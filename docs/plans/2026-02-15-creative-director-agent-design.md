# Creative Director Agent - Design Document

**Date:** 2026-02-15
**Status:** Approved

## Problem

Visual generation currently has no conversational AI agent on the frontend. Users interact through a command interface (type prompt, fire job, wait) with no collaborative planning, no real-time feedback in chat, and no persistent context across interactions.

## Solution

Build a **Creative Director agent** - a conversational AI that lives in the existing assistant panel and orchestrates visual generation and editing through natural dialogue.

The agent is a **conversational layer on top of the existing pipelines**. It does not generate or edit visuals directly - it delegates to the existing generation (`claude_visual_generator.py`, two-phase) and editing (`edit-visuals.ts`, Claude CLI) processors.

## Architecture

### Server-Side Agent

The agent runs on the Fastify API server. It uses the Claude API with tool use to have structured conversations, streaming responses to the frontend via SSE.

```
POST /api/projects/:id/agent/chat (SSE)
  │
  ▼
Agent Router
  │  - Loads conversation history from DB
  │  - Injects project context (transcript, visuals, dimensions)
  │  - Calls Claude API with tool definitions
  │
  ▼
Claude API (Tool Use)
  │  - System prompt: Creative Director role
  │  - Conversation history: prior messages
  │  - Tools: analyze, suggest, generate, edit
  │
  ▼
Tool Executor
  │  - analyze_transcript → DB query
  │  - get_scene_details → DB + S3 query
  │  - show_widget → SSE widget event to frontend
  │  - propose_plan → SSE scene plan widget
  │  - generate_visuals → BullMQ job (existing pipeline)
  │  - edit_visuals → BullMQ job (existing pipeline)
  │  - get_current_visuals → DB query
  │
  ▼
SSE Stream → Frontend Chat UI
```

### Agent Tools

| Tool | Purpose | Phase |
|------|---------|-------|
| `analyze_transcript(timeRange)` | Read transcript + word timestamps for a time range | Planning |
| `get_current_visuals()` | List all existing scenes for the project | Any |
| `get_scene_details(sceneId)` | Get metadata of an existing scene | Editing |
| `show_widget(type, options)` | Render interactive widget in chat | Planning |
| `propose_plan(scenes)` | Present scene plan for user approval | Planning |
| `generate_visuals(plan, style, layout)` | Queue generation job (existing pipeline) | Generation |
| `edit_visuals(prompt, sceneId?, elementName?)` | Queue edit job (existing pipeline) | Editing |
| `get_visual_source(compositionId)` | Retrieve source code from S3 | Editing |

### Existing Pipelines (Unchanged)

**Generation pipeline** (`generate-visuals.ts` + `claude_visual_generator.py`):
- Two-phase: Director plans scenes → Animator implements code
- Uses Claude Agent SDK with OAuth
- Outputs: Remotion bundle + source code in S3

**Editing pipeline** (`edit-visuals.ts`):
- Single-phase: Claude CLI subprocess
- Smart scene targeting with keyword detection
- Two modes: simple (1-5 line edits) and regenerate (full rewrite)
- Targets: specific scene, specific element, or global constants

## Conversational Flow

One continuous conversation per project. No hard phase transitions - the agent fluidly moves between planning, generating, and editing.

### Starting New Generation

1. User selects timeline range
2. Agent calls `analyze_transcript` to read that section
3. Agent describes what it understands about the content
4. Agent shows `theme_picker` widget
5. User selects theme → agent shows `layout_picker` widget
6. Agent proposes scene plan via `propose_plan` tool
7. User approves → agent calls `generate_visuals`
8. Curated progress messages stream in chat until complete

### Editing Existing Scenes

1. User selects a scene on the timeline
2. User describes what to change in chat
3. Agent calls `get_scene_details` to understand current state
4. If request is clear: calls `edit_visuals` directly
5. If ambiguous: asks one clarifying question, then edits
6. Progress streams in chat until complete

### General Interaction

- Agent decides naturally whether to ask questions or act directly
- No forced workflows - complexity of interaction matches complexity of request

## Frontend Design

### Rewriting AIAssistantPanel.tsx

Replace the command-based interface with a streaming chat with widget support.

**SSE connection** replaces job polling. Connect to `POST /api/projects/:id/agent/chat` and parse SSE events.

**Message types:**
```typescript
type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'widget'; widget: Widget }
  | { type: 'progress'; percent: number; message: string }
  | { type: 'scene_preview'; sceneId: number; description: string }

type Widget =
  | { kind: 'theme_picker'; options: StylePreset[] }
  | { kind: 'layout_picker'; options: LayoutMode[] }
  | { kind: 'scene_plan'; scenes: ScenePlan[]; requiresApproval: boolean }
  | { kind: 'confirmation'; message: string }
```

**Widget interaction:** Agent calls `show_widget` tool → SSE sends widget event → frontend renders widget inline → user interacts → response sent as new message with `widgetResponse` field → agent continues conversation.

**Conversation persistence:** On mount, fetch history from `GET /api/projects/:id/agent/conversation`. Past widgets render in disabled/read-only state.

## API Endpoints

### 1. Chat with Agent (SSE)

```
POST /api/projects/:id/agent/chat
Content-Type: application/json
Accept: text/event-stream

Body: {
  message: string
  conversationId?: string
  context?: {
    selectedTimeRange?: { startMs: number; endMs: number }
    selectedSceneId?: number
    selectedElement?: { name: string; sceneId: number }
  }
  widgetResponse?: { widgetId: string; value: any }
}

SSE Events:
  event: text     | data: { content: "..." }
  event: widget   | data: { id: "w1", kind: "theme_picker", options: [...] }
  event: progress | data: { percent: 45, message: "Creating Scene 2..." }
  event: done     | data: { conversationId: "conv-123" }
  event: error    | data: { message: "..." }
```

### 2. Get Conversation History

```
GET /api/projects/:id/agent/conversation

Response: {
  conversationId: string
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: MessageContent[]
    createdAt: string
  }>
}
```

### 3. Clear Conversation

```
DELETE /api/projects/:id/agent/conversation
```

## Database Changes

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  role TEXT NOT NULL,          -- 'user' | 'assistant' | 'tool_use' | 'tool_result'
  content JSONB NOT NULL,     -- text, widgets, tool calls
  created_at TIMESTAMP DEFAULT NOW()
);
```

One conversation per project. Messages appended as conversation progresses.

## Agent System Prompt

```
You are the Creative Director for Viona. You help users create
and refine AI-generated visuals for their talking-head videos.

CONTEXT:
- Project: {projectName}
- Canvas: {width}x{height}
- Duration: {durationSeconds}s at {fps}fps
- Has existing visuals: {yes/no}
- Transcript available: {yes/no}

BEHAVIOR:
- Be concise and creative - you're a director, not a lecturer
- When the user selects a timeline range, analyze that section first
- For new generation: ask about preferences using widgets, propose a plan
- For edits: if clear, just do it. If ambiguous, ask one question.
- Never expose technical details (Remotion, BullMQ, etc.)
- Speak in terms of "scenes", "animations", "visuals"
```

## Error Handling

- **SSE drops:** Auto-reconnect (3 attempts), re-fetch conversation state
- **Job failures:** Agent communicates naturally: "I ran into an issue. Want me to try a different approach?"
- **No transcript:** Agent detects and suggests starting transcription
- **No visuals for editing:** Agent suggests generating first
- **Concurrent requests:** One active SSE stream per project; disable input during generation
- **Long conversations:** Keep last N messages + system prompt; summarize older messages if token limit approached

## File Changes Summary

**New files:**
- `packages/api/src/agent/agent-router.ts` - Fastify route handler
- `packages/api/src/agent/agent-tools.ts` - Tool definitions and executors
- `packages/api/src/agent/agent-system-prompt.ts` - System prompt builder
- `packages/api/src/agent/conversation-store.ts` - Conversation persistence
- `packages/api/src/db/migrations/` - New migration for conversation tables

**Modified files:**
- `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` - Rewrite for streaming chat + widgets
- `apps/web/src/lib/api.ts` - New API methods for agent endpoints
- `packages/api/src/routes/index.ts` - Register agent routes
- `packages/api/src/db/schema.ts` - Add conversation tables

**Unchanged:**
- `packages/worker/src/processors/generate-visuals.ts`
- `packages/worker/src/processors/edit-visuals.ts`
- `packages/worker/src/agents/claude_visual_generator.py`
- All existing BullMQ infrastructure
