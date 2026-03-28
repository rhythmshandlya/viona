# Agent Chat System Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the 1,939-line AIAssistantPanel monolith into focused glassmorphic components, add a `report_plan` MCP tool with full backend plumbing, and implement three-phase agentic progress relay.

**Architecture:** Extract chat rendering into `ai-chat/` folder with 7 focused components. Add `agent_plan` SSE event flowing through 7 backend layers (widget-tools → mcp-servers → agent-server → orchestrator → proxy → agent-router → frontend). Apply liquid glass design tokens via CSS variables.

**Tech Stack:** React 19, Tailwind CSS 4, framer-motion, Zod, Fastify SSE, Claude Agent SDK MCP servers, Redis

**Spec:** `docs/superpowers/specs/2026-03-17-agent-chat-redesign-design.md`

---

## Chunk 1: Shared Types + Backend Plumbing

### Task 1: Add shared AgentPlan types to progress-types.ts

**Files:**
- Modify: `packages/shared/src/progress-types.ts`

- [ ] **Step 1: Add AgentPlan interfaces**

At the bottom of `packages/shared/src/progress-types.ts`, before the closing exports, add:

```typescript
/* ── Agent Plan (chat redesign) ── */

export interface AgentSubtask {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  tools?: string[];
}

export interface AgentTask {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  agent?: string;
  subtasks?: AgentSubtask[];
}

export interface AgentPlan {
  title: string;
  tasks: AgentTask[];
}

/**
 * ProgressPayload is the MCP tool input shape (subset of ProgressState).
 * ProgressState (above) is the full Redis-persisted state with timestamps.
 */
export interface ProgressPayload {
  phase: string;
  percent?: number;
  message: string;
  agentName?: string;
  trackName?: string;
  estimatedTimeRemaining?: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/progress-types.ts
git commit -m "feat(shared): add AgentPlan, AgentTask, ProgressPayload types"
```

---

### Task 2: Extend WidgetCallbacks with onPlan

**Files:**
- Modify: `packages/sandbox/src/tools/widget-tools.ts`
- Modify: `packages/sandbox/package.json`

- [ ] **Step 1: Add `@viona/shared` as a dependency of sandbox**

The sandbox package does not currently depend on `@viona/shared`. Add it:

```bash
cd packages/sandbox && pnpm add @viona/shared@workspace:*
```

- [ ] **Step 2: Add onPlan to WidgetCallbacks interface**

In `packages/sandbox/src/tools/widget-tools.ts`, add import for the shared type and extend the interface:

```typescript
import type { AgentPlan } from '@viona/shared/progress-types.js';
```

Add to the `WidgetCallbacks` interface:

```typescript
onPlan: (plan: AgentPlan) => void;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: Errors in files that create WidgetCallbacks (agent-server.ts) — this is expected, we fix it in Task 3.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/package.json packages/sandbox/src/tools/widget-tools.ts pnpm-lock.yaml
git commit -m "feat(sandbox): add onPlan callback to WidgetCallbacks"
```

---

### Task 3: Add report_plan MCP tool to widgets server

**Files:**
- Modify: `packages/sandbox/src/mcp-servers.ts`

- [ ] **Step 1: Add report_plan tool to widgets server**

In `packages/sandbox/src/mcp-servers.ts`, add the `report_plan` tool to the `widgetServer` tools array (after `report_progress`):

```typescript
tool(
  'report_plan',
  'Report the current execution plan to the user. Shows a live task tree with status indicators. Call this at the start of workflow dispatch (all tasks pending), then again as each task transitions to running/complete/failed.',
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
  },
  async (input) => {
    widgetCallbacks.onPlan({ title: input.title, tasks: input.tasks });
    return { content: [{ type: 'text' as const, text: 'Plan reported.' }] };
  },
),
```

- [ ] **Step 2: Verify the tool is registered**

Check that the widgetServer tools array now has 3 tools: `show_widget`, `report_progress`, `report_plan`.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/mcp-servers.ts
git commit -m "feat(sandbox): add report_plan MCP tool to widgets server"
```

---

### Task 4: Wire onPlan through agent-server.ts

**Files:**
- Modify: `packages/sandbox/src/agent-server.ts`

- [ ] **Step 1: Add onPlan callback in MCP server creation**

In `packages/sandbox/src/agent-server.ts`, find where `createMcpServers` is called with `onWidget` and `onProgress` callbacks. Add `onPlan`:

```typescript
onPlan: (plan) => {
  sendSSE('agent_plan', plan);
},
```

This wires the MCP tool callback directly to SSE output, same pattern as `onWidget` and `onProgress`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No errors (WidgetCallbacks now satisfied)

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/agent-server.ts
git commit -m "feat(sandbox): wire onPlan callback to SSE in agent-server"
```

---

### Task 5: Add report_plan to WIDGET_TOOL_NAMES

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts`

- [ ] **Step 1: Update WIDGET_TOOL_NAMES constant**

In `packages/sandbox/src/orchestrator.ts`, find the `WIDGET_TOOL_NAMES` array and add the new tool:

```typescript
const WIDGET_TOOL_NAMES = [
  'mcp__widgets__show_widget',
  'mcp__widgets__report_progress',
  'mcp__widgets__report_plan',
];
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "feat(sandbox): register report_plan in WIDGET_TOOL_NAMES"
```

---

### Task 6: Add agent_plan interception in proxy.ts

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts`

- [ ] **Step 1: Add onPlan to InterceptCallbacks interface**

In `packages/api/src/sandbox/proxy.ts`, add the import and extend the interface:

```typescript
import type { AgentPlan } from '@viona/shared/progress-types.js';
```

Add to `InterceptCallbacks`:

```typescript
onPlan?: (plan: AgentPlan) => void;
```

- [ ] **Step 2: Add agent_plan case to the SSE event switch**

In the `proxyPromptWithIntercept` function, find the switch statement that handles event types. Add a new case before the `default`:

```typescript
case 'agent_plan': {
  const plan = JSON.parse(data);
  // Persist to Redis for refresh recovery
  const redisKey = `sandbox:plan:${projectId}`;
  await redis.set(redisKey, JSON.stringify(plan), 'EX', 1800);
  writeSSE('agent_plan', data);
  callbacks.onPlan?.(plan);
  break;
}
```

Note: `projectId` is available in the closure from the function parameters. The Redis key pattern matches existing `sandbox:progress:${projectId}` and `sandbox:activity:${projectId}`.

- [ ] **Step 3: Add sandbox:plan cleanup to the `done` handler**

In the existing `case 'done':` handler in the same switch statement (where `sandbox:progress` and `sandbox:activity` are deleted), add:

```typescript
await redis.del(`sandbox:plan:${projectId}`);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/sandbox/proxy.ts
git commit -m "feat(api): intercept agent_plan SSE events in proxy with Redis persistence"
```

---

### Task 7: Add onPlan persistence in agent-router.ts

**Files:**
- Modify: `packages/api/src/agent/agent-router.ts`

- [ ] **Step 1: Add onPlan callback in proxyPromptWithIntercept call**

In `packages/api/src/agent/agent-router.ts`, find where `proxyPromptWithIntercept` is called with `onText`, `onWidget`, `onProgress`, etc. Add the `onPlan` callback:

```typescript
onPlan: (plan) => {
  // Flush any pending text before the plan block
  flushText();
  // Upsert: replace existing plan block or append new one
  const existingIdx = contentBlocks.findIndex((b: any) => b.type === 'plan');
  if (existingIdx >= 0) {
    contentBlocks[existingIdx] = { type: 'plan', plan };
  } else {
    contentBlocks.push({ type: 'plan', plan });
  }
  sendSSE('agent_plan', plan);
},
```

- [ ] **Step 2: Add plan recovery to GET conversation endpoint**

In the GET `/projects/:id/agent/conversation` handler, alongside the existing Redis checks for `sandbox:progress:${projectId}` and `sandbox:activity:${projectId}`, add a check for `sandbox:plan:${projectId}`:

```typescript
const planJson = await redis.get(`sandbox:plan:${projectId}`);
const sandboxPlan = planJson ? JSON.parse(planJson) : null;
```

Include `sandboxPlan` in the response payload.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors (pre-existing type errors in workspace-service.ts are unrelated)

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/agent/agent-router.ts
git commit -m "feat(api): persist agent_plan blocks in conversation messages with Redis recovery"
```

---

## Chunk 2: Frontend Types + Component Decomposition

### Task 8: Add CSS variables for chat glassmorphism

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add chat CSS variables to the editor theme block**

In `apps/web/src/app/globals.css`, find the `.editor-theme` or `:root` block where editor variables are defined. Add the chat-specific tokens:

```css
/* ── Chat Glassmorphism ── */
--chat-bubble-assistant-bg: rgba(255, 255, 255, 0.04);
--chat-bubble-assistant-border: rgba(255, 255, 255, 0.08);
--chat-bubble-user-bg: rgba(139, 92, 246, 0.12);
--chat-bubble-user-border: rgba(139, 92, 246, 0.15);
--chat-input-bg: rgba(255, 255, 255, 0.06);
--chat-input-border: rgba(255, 255, 255, 0.1);
--chat-plan-bg: rgba(255, 255, 255, 0.03);
--chat-plan-border: rgba(255, 255, 255, 0.06);
--chat-progress-bg: rgba(255, 255, 255, 0.04);
--chat-chip-bg: rgba(255, 255, 255, 0.08);
```

Note: `rgba(139, 92, 246, ...)` is the editor accent `#8B5CF6` in RGB.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): add chat glassmorphism CSS variables"
```

---

### Task 9: Create chat types.ts

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ai-chat/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
import type { AgentPlan, AgentTask, AgentSubtask, ProgressPayload } from '@viona/shared/progress-types';

/* ── Re-exports for convenience ── */
export type { AgentPlan, AgentTask, AgentSubtask, ProgressPayload };

/* ── Message Block Types ── */

export interface TextBlock {
  type: 'text';
  text: string;
  hidden?: boolean;
}

export interface WidgetBlock {
  type: 'widget';
  widget: {
    id: string;
    kind: 'theme_picker' | 'scene_plan' | 'choice' | 'confirmation';
    message?: string;
    scenes?: unknown[];
    options?: unknown[];
    metadata?: Record<string, unknown>;
    planJobId?: string;
    [key: string]: unknown;
  };
  response?: unknown;
}

export interface PlanBlock {
  type: 'plan';
  plan: AgentPlan;
}

/** @deprecated Kept for backward compat with historical DB messages */
export interface ProgressBlock {
  type: 'progress';
  [key: string]: unknown;
}

export type MessageBlock = TextBlock | WidgetBlock | PlanBlock | ProgressBlock;

/* ── Message ── */

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: MessageBlock[];
  createdAt: string;
  queued?: boolean;
}

/* ── Progress State (transient, not persisted in messages) ── */

export interface ProgressState {
  phase: string;
  message: string;
  agentName?: string;
  trackName?: string;
  estimatedTimeRemaining?: number;
  startedAt: number;
}

/* ── Agent Activity ── */

export interface ActivityState {
  agent: string;
  action: string | null;
  startedAt: number;
}

/* ── Agent style config ── */

export const AGENT_STYLES: Record<string, { color: string; icon: string }> = {
  Editor:   { color: '#60a5fa', icon: '✂' },
  Planner:  { color: '#a78bfa', icon: '◈' },
  Animator: { color: '#34d399', icon: '◆' },
  Reviewer: { color: '#fbbf24', icon: '◉' },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ai-chat/types.ts
git commit -m "feat(web): create shared chat type definitions"
```

---

### Task 10: Create ChatBubble component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ai-chat/ChatBubble.tsx`

- [ ] **Step 1: Create the ChatBubble component**

```tsx
'use client';

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  text: string;
  isStreaming?: boolean;
}

export const ChatBubble = memo(function ChatBubble({ role, text, isStreaming }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
      className={cn(
        'relative px-3.5 py-2.5 rounded-2xl backdrop-blur-xl text-sm',
        isUser
          ? 'ml-auto max-w-[85%] rounded-tr-md bg-[var(--chat-bubble-user-bg)] border border-[var(--chat-bubble-user-border)] text-white/95'
          : 'mr-2 rounded-tl-md bg-[var(--chat-bubble-assistant-bg)] border border-[var(--chat-bubble-assistant-border)] text-white/90',
      )}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap break-words">{text}</p>
      ) : (
        <div className="prose-agent">
          <MarkdownRenderer>{text}</MarkdownRenderer>
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-white/40 rounded-sm animate-pulse align-middle" />
          )}
        </div>
      )}
    </motion.div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ai-chat/ChatBubble.tsx
git commit -m "feat(web): create glassmorphic ChatBubble component"
```

---

### Task 11: Create WidgetRenderer component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ai-chat/WidgetRenderer.tsx`

- [ ] **Step 1: Create the WidgetRenderer component**

This component dispatches to existing widget components based on `kind`. Extract the widget rendering logic from the current `AIAssistantPanel.tsx` (around lines 900-1000).

```tsx
'use client';

import React, { memo } from 'react';
import type { WidgetBlock } from './types';

// Import existing widget components
import { ScenePlanCard } from '../agent-widgets/ScenePlanCard';

interface WidgetRendererProps {
  block: WidgetBlock;
  onWidgetResponse: (widgetId: string, value: unknown) => void;
  onEditScene?: (sceneIndex: number, sceneTitle: string) => void;
  onScenesUpdate?: (planJobId: string, scenes: unknown[]) => void | Promise<void>;
  disabled?: boolean;
}

export const WidgetRenderer = memo(function WidgetRenderer({
  block,
  onWidgetResponse,
  onEditScene,
  onScenesUpdate,
  disabled,
}: WidgetRendererProps) {
  const { widget } = block;
  const isApproved = block.response != null;

  switch (widget.kind) {
    case 'scene_plan':
      return (
        <div className="w-full my-2">
          <ScenePlanCard
            scenes={(widget.scenes as any[]) ?? []}
            scenePlanMarkdown={widget.scenePlanMarkdown as string | undefined}
            metadata={widget.metadata as any}
            planJobId={widget.planJobId}
            onApprove={(iconSelections) =>
              onWidgetResponse(widget.id, { approved: true, iconSelections })
            }
            onReject={() => onWidgetResponse(widget.id, { approved: false })}
            onEditScene={onEditScene}
            onScenesUpdate={onScenesUpdate}
            disabled={disabled || isApproved}
            approved={isApproved}
          />
        </div>
      );

    case 'choice':
      return (
        <div className="w-full my-2 p-3 rounded-xl bg-[var(--chat-plan-bg)] border border-[var(--chat-plan-border)] backdrop-blur-xl">
          <p className="text-sm text-white/70 mb-2">{widget.message as string}</p>
          <div className="flex flex-wrap gap-2">
            {((widget.options as any[]) ?? []).map((opt: any, i: number) => (
              <button
                key={i}
                className="px-3 py-1.5 text-sm rounded-lg bg-[var(--chat-chip-bg)] border border-white/[0.08] text-white/80 hover:bg-white/[0.12] transition-colors disabled:opacity-40"
                disabled={disabled || isApproved}
                onClick={() => onWidgetResponse(widget.id, opt.value ?? opt)}
              >
                {opt.label ?? opt}
              </button>
            ))}
          </div>
        </div>
      );

    case 'confirmation':
      return (
        <div className="w-full my-2 p-3 rounded-xl bg-[var(--chat-plan-bg)] border border-[var(--chat-plan-border)] backdrop-blur-xl">
          <p className="text-sm text-white/70 mb-2">{widget.message as string}</p>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--editor-accent)]/20 border border-[var(--editor-accent)]/30 text-white/90 hover:bg-[var(--editor-accent)]/30 transition-colors disabled:opacity-40"
              disabled={disabled || isApproved}
              onClick={() => onWidgetResponse(widget.id, { confirmed: true })}
            >
              Confirm
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--chat-chip-bg)] border border-white/[0.08] text-white/70 hover:bg-white/[0.12] transition-colors disabled:opacity-40"
              disabled={disabled || isApproved}
              onClick={() => onWidgetResponse(widget.id, { confirmed: false })}
            >
              Cancel
            </button>
          </div>
        </div>
      );

    case 'theme_picker':
      // Theme picker widget — render as simple choice for now
      return (
        <div className="w-full my-2 p-3 rounded-xl bg-[var(--chat-plan-bg)] border border-[var(--chat-plan-border)] backdrop-blur-xl">
          <p className="text-sm text-white/70 mb-2">Choose a visual theme:</p>
          <div className="flex flex-wrap gap-2">
            {((widget.options as any[]) ?? []).map((opt: any, i: number) => (
              <button
                key={i}
                className="px-3 py-1.5 text-sm rounded-lg bg-[var(--chat-chip-bg)] border border-white/[0.08] text-white/80 hover:bg-white/[0.12] transition-colors disabled:opacity-40"
                disabled={disabled || isApproved}
                onClick={() => onWidgetResponse(widget.id, opt.value ?? opt)}
              >
                {opt.label ?? opt}
              </button>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ai-chat/WidgetRenderer.tsx
git commit -m "feat(web): create WidgetRenderer component for chat widgets"
```

---

### Task 12: Create AgentPlanWidget component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ai-chat/AgentPlanWidget.tsx`

- [ ] **Step 1: Create the AgentPlanWidget component**

Adapt the reference `agent-plan.tsx` component provided in the spec, restyled for the dark glassmorphic editor theme:

```tsx
'use client';

import React, { useState, memo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { CheckCircle2, Circle, CircleDotDashed, CircleX, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentPlan, AgentTask, AgentSubtask } from './types';
import { AGENT_STYLES } from './types';

interface AgentPlanWidgetProps {
  plan: AgentPlan;
}

const StatusIcon = memo(function StatusIcon({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  switch (status) {
    case 'complete':
      return <CheckCircle2 className={cn(cls, 'text-green-400')} />;
    case 'running':
      return <CircleDotDashed className={cn(cls, 'text-blue-400 animate-spin')} style={{ animationDuration: '3s' }} />;
    case 'failed':
      return <CircleX className={cn(cls, 'text-red-400')} />;
    default:
      return <Circle className={cn(cls, 'text-white/20')} />;
  }
});

const SubtaskRow = memo(function SubtaskRow({ subtask }: { subtask: AgentSubtask }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 py-0.5 pl-6"
    >
      <StatusIcon status={subtask.status} />
      <span className={cn(
        'text-xs',
        subtask.status === 'complete' ? 'text-white/30 line-through' : 'text-white/60',
      )}>
        {subtask.title}
      </span>
      {subtask.tools && subtask.tools.length > 0 && (
        <div className="flex gap-1 ml-auto">
          {subtask.tools.map((t, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 text-[10px] rounded bg-white/[0.06] text-white/30 border border-white/[0.04]"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
});

const TaskRow = memo(function TaskRow({ task }: { task: AgentTask }) {
  const [expanded, setExpanded] = useState(task.status === 'running');
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const agentStyle = task.agent ? AGENT_STYLES[task.agent] : null;

  return (
    <div>
      <motion.div
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.03] cursor-pointer transition-colors"
        onClick={() => hasSubtasks && setExpanded(!expanded)}
        layout
      >
        {hasSubtasks && (
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="h-3 w-3 text-white/20" />
          </motion.div>
        )}
        {!hasSubtasks && <div className="w-3" />}

        <StatusIcon status={task.status} size="md" />

        <span className={cn(
          'text-sm flex-1',
          task.status === 'complete' ? 'text-white/40 line-through' : 'text-white/80',
        )}>
          {task.title}
        </span>

        {agentStyle && task.status === 'running' && (
          <span
            className="px-1.5 py-0.5 text-[10px] rounded-full border"
            style={{
              color: agentStyle.color,
              borderColor: `${agentStyle.color}33`,
              backgroundColor: `${agentStyle.color}15`,
            }}
          >
            {agentStyle.icon} {task.agent}
          </span>
        )}
      </motion.div>

      <AnimatePresence>
        {expanded && hasSubtasks && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="overflow-hidden relative"
          >
            <div className="absolute top-0 bottom-0 left-[22px] border-l border-dashed border-white/[0.08]" />
            {task.subtasks!.map((st) => (
              <SubtaskRow key={st.id} subtask={st} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export const AgentPlanWidget = memo(function AgentPlanWidget({ plan }: AgentPlanWidgetProps) {
  const completedCount = plan.tasks.filter(t => t.status === 'complete').length;
  const totalCount = plan.tasks.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0.65, 0.3, 0.9] }}
      className="w-full my-2 rounded-xl bg-[var(--chat-plan-bg)] border border-[var(--chat-plan-border)] backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
        <span className="text-xs text-white/50 font-normal">{plan.title}</span>
        <span className="text-[10px] text-white/30">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Task list */}
      <LayoutGroup>
        <div className="p-1.5 space-y-0.5">
          {plan.tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      </LayoutGroup>
    </motion.div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ai-chat/AgentPlanWidget.tsx
git commit -m "feat(web): create AgentPlanWidget with glassmorphic task tree"
```

---

### Task 13: Create ProgressIndicator component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ai-chat/ProgressIndicator.tsx`

- [ ] **Step 1: Create the ProgressIndicator component**

This replaces `ActivityBar.tsx` as an inline chat element:

```tsx
'use client';

import React, { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ProgressState } from './types';
import { AGENT_STYLES } from './types';

interface ProgressIndicatorProps {
  progress: ProgressState | null;
  isVisible: boolean;
}

function formatElapsed(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
}

export const ProgressIndicator = memo(function ProgressIndicator({
  progress,
  isVisible,
}: ProgressIndicatorProps) {
  const [, setTick] = useState(0);

  // Tick every second to update elapsed time
  useEffect(() => {
    if (!isVisible || !progress) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isVisible, progress]);

  const agentStyle = progress?.agentName ? AGENT_STYLES[progress.agentName] : null;

  return (
    <AnimatePresence>
      {isVisible && progress && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
          className="w-full my-1"
        >
          <div className="flex items-center gap-2.5 h-8 px-3 rounded-lg bg-[var(--chat-progress-bg)] backdrop-blur-xl">
            {/* Pulsing dot */}
            <span
              className="relative flex h-2 w-2"
            >
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                style={{ backgroundColor: agentStyle?.color ?? '#60a5fa' }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ backgroundColor: agentStyle?.color ?? '#60a5fa' }}
              />
            </span>

            {/* Agent badge */}
            {progress.agentName && agentStyle && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full border"
                style={{
                  color: agentStyle.color,
                  borderColor: `${agentStyle.color}33`,
                  backgroundColor: `${agentStyle.color}15`,
                }}
              >
                {agentStyle.icon} {progress.agentName}
              </span>
            )}

            {/* Status message */}
            <span className="flex-1 text-xs text-white/50 truncate">
              {progress.message}
            </span>

            {/* Elapsed time */}
            <span className="text-xs text-white/30 tabular-nums">
              {formatElapsed(progress.startedAt)}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ai-chat/ProgressIndicator.tsx
git commit -m "feat(web): create inline ProgressIndicator replacing ActivityBar"
```

---

### Task 14: Create ChatInput component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ai-chat/ChatInput.tsx`

- [ ] **Step 1: Create the ChatInput component**

Extract input logic from AIAssistantPanel. Glass card with context chips, auto-resize textarea, and action buttons:

```tsx
'use client';

import React, { memo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, X, Crosshair, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextChip {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onRemove: () => void;
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  placeholder?: string;
  contextChips?: ContextChip[];
  disabled?: boolean;
}

export const ChatInput = memo(function ChatInput({
  value,
  onChange,
  onSend,
  isStreaming,
  placeholder = 'Ask Viona anything...',
  contextChips = [],
  disabled,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !isStreaming && !disabled) {
          onSend();
        }
      }
    },
    [value, isStreaming, disabled, onSend],
  );

  const canSend = value.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div className="rounded-xl bg-[var(--chat-input-bg)] border border-[var(--chat-input-border)] backdrop-blur-xl p-2">
      {/* Context chips */}
      <AnimatePresence>
        {contextChips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-1.5 mb-2 px-1"
          >
            {contextChips.map((chip) => (
              <motion.span
                key={chip.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--chat-chip-bg)] text-white/60 border border-white/[0.06]"
              >
                {chip.icon}
                {chip.label}
                <button
                  onClick={chip.onRemove}
                  className="ml-0.5 hover:text-white/80 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isStreaming}
        rows={1}
        className={cn(
          'w-full bg-transparent text-sm text-white/90 placeholder:text-white/25 resize-none outline-none px-1',
          'min-h-[36px] max-h-[160px]',
        )}
      />

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-1.5 px-0.5">
        <div className="flex items-center gap-1">
          {/* Action icons slot — can be extended */}
        </div>

        {/* Send button */}
        <motion.button
          whileHover={canSend ? { scale: 1.05 } : undefined}
          whileTap={canSend ? { scale: 0.95 } : undefined}
          onClick={canSend ? onSend : undefined}
          disabled={!canSend}
          className={cn(
            'flex items-center justify-center h-7 w-7 rounded-full transition-all',
            canSend
              ? 'bg-[var(--editor-accent)]/80 hover:bg-[var(--editor-accent)] text-white shadow-sm shadow-[var(--editor-accent)]/20'
              : 'bg-white/[0.06] text-white/20 cursor-not-allowed',
          )}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </motion.button>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ai-chat/ChatInput.tsx
git commit -m "feat(web): create glassmorphic ChatInput with context chips"
```

---

### Task 15: Create ChatMessageList component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ai-chat/ChatMessageList.tsx`

- [ ] **Step 1: Create the ChatMessageList component**

Simple scroll container that renders message blocks, grouping adjacent text blocks into bubbles:

```tsx
'use client';

import React, { memo, useRef, useEffect } from 'react';
import type { Message, TextBlock, WidgetBlock, PlanBlock, ProgressState } from './types';
import { ChatBubble } from './ChatBubble';
import { WidgetRenderer } from './WidgetRenderer';
import { AgentPlanWidget } from './AgentPlanWidget';
import { ProgressIndicator } from './ProgressIndicator';

interface ChatMessageListProps {
  messages: Message[];
  isStreaming: boolean;
  currentProgress: ProgressState | null;
  onWidgetResponse: (widgetId: string, value: unknown) => void;
  onEditScene?: (sceneIndex: number, sceneTitle: string) => void;
  onScenesUpdate?: (planJobId: string, scenes: unknown[]) => void | Promise<void>;
}

/** Group adjacent text blocks into a single string for one bubble. */
function renderMessageBlocks(
  msg: Message,
  isLastMessage: boolean,
  isStreaming: boolean,
  onWidgetResponse: (widgetId: string, value: unknown) => void,
  onEditScene?: (sceneIndex: number, sceneTitle: string) => void,
  onScenesUpdate?: (planJobId: string, scenes: unknown[]) => void | Promise<void>,
) {
  const elements: React.ReactNode[] = [];
  let textAccum = '';

  const flushText = () => {
    if (textAccum.trim()) {
      elements.push(
        <ChatBubble
          key={`text-${elements.length}`}
          role={msg.role}
          text={textAccum}
          isStreaming={isLastMessage && isStreaming && msg.role === 'assistant'}
        />,
      );
    }
    textAccum = '';
  };

  for (const block of msg.content) {
    if (block.type === 'text' && !(block as TextBlock).hidden) {
      textAccum += (textAccum ? '\n' : '') + (block as TextBlock).text;
    } else if (block.type === 'widget') {
      flushText();
      elements.push(
        <WidgetRenderer
          key={`widget-${(block as WidgetBlock).widget.id}`}
          block={block as WidgetBlock}
          onWidgetResponse={onWidgetResponse}
          onEditScene={onEditScene}
          onScenesUpdate={onScenesUpdate}
          disabled={isStreaming}
        />,
      );
    } else if (block.type === 'plan') {
      flushText();
      elements.push(
        <AgentPlanWidget
          key={`plan-${elements.length}`}
          plan={(block as PlanBlock).plan}
        />,
      );
    }
  }

  flushText();
  return elements;
}

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  isStreaming,
  currentProgress,
  onWidgetResponse,
  onEditScene,
  onScenesUpdate,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Only auto-scroll if user is near bottom (within 120px)
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming, currentProgress]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
      {messages.map((msg, i) => (
        <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
          <div className={msg.role === 'user' ? 'max-w-[85%]' : 'w-full space-y-2'}>
            {renderMessageBlocks(
              msg,
              i === messages.length - 1,
              isStreaming,
              onWidgetResponse,
              onEditScene,
              onScenesUpdate,
            )}
          </div>
        </div>
      ))}

      {/* Inline progress indicator — shown after last message during streaming */}
      <ProgressIndicator
        progress={currentProgress}
        isVisible={isStreaming && currentProgress != null}
      />

      <div ref={bottomRef} />
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ai-chat/ChatMessageList.tsx
git commit -m "feat(web): create ChatMessageList with block segmentation and auto-scroll"
```

---

## Chunk 3: Container Rewrite + Prompt Update + Cleanup

### Task 16: Rewrite AIAssistantPanel as thin container

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

This is the largest task. The goal is to rewrite the 1,939-line monolith as a thin container (~400 lines) that:
- Owns SSE connection lifecycle
- Manages message state array
- Manages transient progress state
- Delegates rendering to child components

- [ ] **Step 1: Study the existing SSE handler**

Read the full existing `AIAssistantPanel.tsx` carefully. Map out:
- State variables that must be preserved
- SSE event handler logic (lines ~620-730)
- Widget response submission logic
- Message queue system
- Scene context/editing context building
- The `sendMessage` function flow

- [ ] **Step 2: Rewrite the component**

Replace the contents of `AIAssistantPanel.tsx` with the thin container version. The key structure:

```tsx
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { parseSSEStream } from '@/lib/sse-parser';
import { api } from '@/lib/api';
import { ChatMessageList } from './ai-chat/ChatMessageList';
import { ChatInput } from './ai-chat/ChatInput';
import type { Message, MessageBlock, TextBlock, WidgetBlock, PlanBlock, ProgressState, ActivityState } from './ai-chat/types';
import { Crosshair, Clock } from 'lucide-react';

// Import editor store hooks (preserved from original)
import {
  useVideoSettings,
  useProjectActions,
  useAIActions,
  useTimelineActions,
  useAIEditingContext,
} from '../store/use-editor-store';
```

The component body should:

1. **State**: `messages`, `isStreaming`, `inputValue`, `currentProgress`, `activityState`, `conversationId`, `sessionId`
2. **Refs**: `abortControllerRef`, `eventSourceRef`
3. **Load conversation** on mount (fetch GET `/agent/conversation`)
4. **SSE handler** as a `useCallback`:
   - `text` → append to last assistant message's text blocks
   - `widget` → flush text, push widget block
   - `agent_plan` → find-and-replace plan block in last assistant message (merge-not-append)
   - `progress` → update `currentProgress` state (transient, not in message blocks)
   - `activity` → update `activityState`, sync to editor store
   - `done` → finalize message, clear streaming state, reload visuals
   - `error` → append error text
   - `reset` → clear last assistant message's text + plan blocks
   - `heartbeat` → reset stall timer
5. **sendMessage** function: POST to `/agent/chat`, create user message + empty assistant message, start SSE parsing
6. **Widget response** handler: POST to `/agent/chat` with `widgetResponse` payload
7. **Context chips** built from editor store (selected scene, time range, element)
8. **Render**: `ChatMessageList` + `ChatInput`

**Preserve** (copy these patterns from the existing file):
- `messageQueueRef` and `isStreamingRef` — message queue system for buffering messages received while the UI is updating (~lines 130-160)
- `stallTimerRef` and stall detection logic (slow/stuck states) — reset on heartbeat/text/activity events (~lines 200-250)
- `clearCompositionCache()` import from `../player/useWorkspaceComposition` — called in `done` handler to reload visuals after generation
- `useAIEditRequested()` and `usePendingAIMessage()` hooks — trigger automatic sends when user clicks "Edit with AI" in context menus
- `useSelectedTimeRange()` hook — provides time range context for targeted edits
- `activeJobId` state and `useJobWebSocket()` hook — for BullMQ job progress tracking during visual generation
- `sandboxBootAttempted` / `bootAndRetryRef` — auto-boot sandbox on first message and retry if boot was needed
- `SSETimeoutError` handling from `@/lib/sse-parser` — retry/reconnect on SSE timeout
- `attachmentFiles` state — for file upload attachments in the chat
- Conversation loading from GET `/agent/conversation` on mount — populates messages, handles `sandboxProgress`, `sandboxActivity`, and now `sandboxPlan`
- Widget response persistence — POST to `/agent/chat` with `widgetResponse` body
- `sceneTags` tracking for context chips

**New behavior** (add to the rewrite):
- `agent_plan` SSE case: find-and-replace plan block in last assistant message (see spec's merge-not-append strategy)
- `progress` SSE case: update `currentProgress` transient state (no longer stored in message blocks)
- `reset` SSE case: clear text blocks AND plan blocks from last assistant message
- Build context chips from editor store state (selected scene, time range, element) and pass to `ChatInput`

**Remove** (no longer needed — moved to child components):
- All inline JSX rendering of messages, bubbles, and markdown (~lines 850-1700)
- `ActivityBar` import and `<ActivityBar>` rendering
- Inline widget rendering switch statements (now in `WidgetRenderer`)
- `ensureKeyframes()` CSS animation injection (now in `ProgressIndicator`)
- `ProgressBlock` type definition (now in `ai-chat/types.ts`)
- `formatElapsed()` function (now in `ProgressIndicator`)
- `GENERATION_PHASES` and `ProgressMeta` type (progress is now transient state)
- `ActivityLog` and `HealthIndicator` sub-components (replaced by `ProgressIndicator`)

- [ ] **Step 3: Verify the app builds**

Run: `cd apps/web && npx next build` (or `npx tsc --noEmit` for faster check)
Expected: Compiles without errors related to the chat system

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "refactor(web): rewrite AIAssistantPanel as thin container delegating to ai-chat/ components"
```

---

### Task 17: Update orchestrator prompt with report_plan guidance

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md`

- [ ] **Step 1: Add report_plan tool documentation**

Find the section in `orchestrator-system.md` where `report_progress` usage is documented. Add a parallel section for `report_plan`:

```markdown
### Plan Reporting

Use `mcp__widgets__report_plan` to show a live task tree during workflow execution.

**When to call:**
1. At the start of workflow dispatch — all tasks `pending`
2. As each task transitions to `running`
3. When a task finishes — `complete` or `failed`
4. At the end — all tasks `complete`

**Three-phase progress model:**
- **Phase 1 (Planning):** Use `report_progress` only with `agentName: "Planner"`. No plan widget needed.
- **Phase 2 (Workflow):** Use BOTH `report_plan` (task tree) AND `report_progress` (per-scene status). This is the only phase that shows the plan widget.
- **Phase 3 (Editing):** Use `report_progress` only with `agentName: "Editor"`. No plan widget needed for single edits.

**Example:**
```
mcp__widgets__report_plan({
  title: "Creating your visual story",
  tasks: [
    { id: "1", title: "Plan visual scenes", status: "complete", agent: "Planner" },
    { id: "2", title: "Generate scene 1 — Opening hook", status: "running", agent: "Animator",
      subtasks: [
        { id: "2.1", title: "Write animation code", status: "complete" },
        { id: "2.2", title: "Render preview", status: "running" }
      ]
    },
    { id: "3", title: "Generate scene 2 — Key insight", status: "pending", agent: "Animator" },
    { id: "4", title: "Quality review", status: "pending", agent: "Reviewer" }
  ]
})
```

**Rules:**
- Task titles should be user-friendly (no internal IDs, tool names, or file paths)
- Use agent names: Planner, Editor, Animator, Reviewer
- Update the SAME plan (don't create a new one each time)
- Keep subtask titles concise (under 40 chars)
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator-system.md
git commit -m "feat(sandbox): add report_plan usage guide to orchestrator prompt"
```

---

### Task 18: Cleanup — remove ActivityBar and barrel export

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` (if ActivityBar import remains)
- Optionally delete: `apps/web/src/features/editor-v2/components/ActivityBar.tsx` (if no other imports)

- [ ] **Step 1: Check for other ActivityBar imports**

Search the codebase for any imports of `ActivityBar` outside the rewritten `AIAssistantPanel.tsx`. If none exist, the file can be deleted.

- [ ] **Step 2: Remove ActivityBar.tsx if unused**

```bash
git rm apps/web/src/features/editor-v2/components/ActivityBar.tsx
```

- [ ] **Step 3: Create barrel export for ai-chat/**

Create `apps/web/src/features/editor-v2/components/ai-chat/index.ts`:

```typescript
export { ChatBubble } from './ChatBubble';
export { ChatInput } from './ChatInput';
export { ChatMessageList } from './ChatMessageList';
export { AgentPlanWidget } from './AgentPlanWidget';
export { ProgressIndicator } from './ProgressIndicator';
export { WidgetRenderer } from './WidgetRenderer';
export * from './types';
```

- [ ] **Step 4: Final build verification**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src/features/editor-v2/components/ai-chat/ apps/web/src/features/editor-v2/components/ActivityBar.tsx
git commit -m "chore(web): remove ActivityBar, add ai-chat barrel export"
```

---

## Execution Order & Dependencies

```
Task 1 (shared types)
  └─▶ Task 2 (widget callbacks)
       └─▶ Task 3 (MCP tool)
            └─▶ Task 4 (agent-server wiring)
                 ├─▶ Task 5 (WIDGET_TOOL_NAMES)
                 └─▶ Task 6 (proxy interception)
                      └─▶ Task 7 (agent-router persistence)

Task 8 (CSS variables) ─── no deps, parallel with backend ───┐
Task 9 (chat types) ─────────────────────────────────────────┤
Task 10 (ChatBubble) ──── depends on Task 9 ─────────────────┤
Task 11 (WidgetRenderer) ── depends on Task 9 ───────────────┤
Task 12 (AgentPlanWidget) ── depends on Task 9 ──────────────┤
Task 13 (ProgressIndicator) ── depends on Task 9 ────────────┤
Task 14 (ChatInput) ──── depends on Task 9 ──────────────────┤
Task 15 (ChatMessageList) ── depends on 10-14 ───────────────┤
                                                              ▼
Task 16 (container rewrite) ── depends on Tasks 7, 15 ── CRITICAL PATH
Task 17 (orchestrator prompt) ── depends on Task 5 ── parallel with 16
Task 18 (cleanup) ── depends on Task 16
```

Backend (Tasks 1-7) and frontend components (Tasks 8-15) can be built in parallel. Task 16 (container rewrite) is the critical integration point that depends on both tracks.
