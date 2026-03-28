# Plan 1: SDK Stream Processing & Observability

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the completely broken tool-use detection in the orchestrator stream processor so we can actually see what the agent is doing, and log SDK result metrics for cost/turn tracking.

**Architecture:** The SDK's `query()` iterator yields `SDKMessage` types. Tool uses are NOT top-level messages — they are content blocks inside `SDKAssistantMessage` (`type: 'assistant'`). The current code checks for `msg.type === 'tool_use'` which never matches any SDK message. We rewrite the stream processor to correctly parse assistant messages, detect tool_use/Agent blocks, track subagent lifecycles, and log the `SDKResultMessage` metrics. This directly enables all downstream features: mechanical progress, active task tracking, and cost monitoring.

**Tech Stack:** TypeScript, `@anthropic-ai/claude-agent-sdk` v0.2.42

**Key Reference — SDK Message Types (from `sdk.d.ts`):**
```
SDKAssistantMessage   { type: 'assistant', message: BetaMessage, parent_tool_use_id: string | null }
  └─ message.content[]: Array<{ type: 'text', text: string } | { type: 'tool_use', name: string, id: string, input: object }>
SDKUserMessage        { type: 'user', message: MessageParam, tool_use_result?: unknown }
SDKResultMessage      { type: 'result', subtype: 'success' | 'error_*', num_turns, total_cost_usd, usage, session_id }
SDKToolProgressMessage { type: 'tool_progress', tool_use_id, tool_name, elapsed_time_seconds }
SDKSystemMessage      { type: 'system', subtype: 'init', tools: string[], mcp_servers: { name, status }[] }
```

---

### Task 1: Rewrite tool-use detection from `SDKAssistantMessage` content blocks

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:329-431` (the `processStream` function)

The current code at lines 357-407 is entirely dead. It checks `msg.type === 'tool_use'` and `msg.type === 'tool_result'` — neither exists in the SDK message union. Replace with correct parsing.

- [ ] **Step 1: Replace the non-stream message handler (lines 356-407)**

Remove the entire block that checks `msg.type === 'tool_use'` and `msg.type === 'tool_result'`. Replace with:

```typescript
// --- Handle complete assistant messages (tool_use detection) ---
if (message.type === 'assistant') {
  const assistantMsg = message as SDKAssistantMessage;
  const content = assistantMsg.message?.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'tool_use') {
        toolUses++;
        const toolName = block.name;
        currentToolName = toolName;
        logger.info({ tool: toolName, toolUseId: block.id, messageCount }, 'Tool use');

        if (toolName?.startsWith('mcp__')) {
          const parts = toolName.split('__');
          const server = parts[1];
          const tool = parts.slice(2).join('__');
          const displayServer = MCP_SERVER_LABELS[server] ?? server;
          emitActivity(displayServer, tool, 'working');
          emitProgress('working', `${tool}`, displayServer);
          if (vionaTaskId) updateTask(vionaTaskId, tool);
        } else if (toolName === 'Agent') {
          // Subagent dispatch — the input has the agent key (planner/editor/animator/reviewer)
          const input = block.input as Record<string, unknown> | undefined;
          const agentKey = (input?.subagent_type ?? input?.description ?? '') as string;
          const label = SUBAGENT_LABELS[agentKey.toLowerCase()] ?? (agentKey || 'subagent');
          emitActivity('Viona', `dispatching ${label}`, 'working');
          emitProgress('working', `Dispatching ${label}`, 'Viona');
          const subTaskId = addTask(label, 'Starting...', agentKey.toLowerCase());
          subagentTaskIds.set(block.id, subTaskId);
        } else if (toolName) {
          emitActivity('Viona', toolName, 'working');
          emitProgress('working', toolName, 'Viona');
        }
      }
    }
  }
}

// --- Handle tool results (SDKUserMessage with tool_use_result) ---
if (message.type === 'user') {
  const userMsg = message as { type: 'user'; message?: { content?: unknown[] }; parent_tool_use_id?: string | null };
  if (currentToolName) {
    logger.info({ tool: currentToolName, messageCount }, 'Tool result');
    currentToolName = null;
  }
  // Complete subagent task — check parent_tool_use_id for Agent returns
  const parentId = userMsg.parent_tool_use_id;
  if (parentId && subagentTaskIds.has(parentId)) {
    // This is a message FROM a subagent context, not the completion
    // Subagent completion comes when the Agent tool_use_id gets its result
  }
}
```

- [ ] **Step 2: Add `SDKAssistantMessage` type import**

At the top of the file (line 17), the code imports `SDKPartialAssistantMessage` and `SDKMessage`. Add `SDKAssistantMessage` if not already in the union:

```typescript
import { query, type SDKPartialAssistantMessage, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

// Add a local type alias for clarity (the SDK exports this as part of SDKMessage union)
type SDKAssistantMessage = Extract<SDKMessage, { type: 'assistant' }>;
```

If the SDK doesn't export `SDKAssistantMessage` directly, use the discriminated union extract pattern above.

- [ ] **Step 3: Handle subagent completion via content block tracking**

The Agent tool's result comes back as an `SDKUserMessage` that corresponds to the tool_use_id of the Agent block. The SDK doesn't have a clean "tool completed" event — we must track which tool_use_ids are pending and complete them when we see the next assistant message (which means the turn completed):

After the assistant message handler, add:

```typescript
// When we see a new assistant message without parent_tool_use_id,
// all pending subagent tasks from the previous turn are done
if (message.type === 'assistant') {
  const parentId = (message as any).parent_tool_use_id;
  if (!parentId) {
    // Back at orchestrator level — complete any tracked subagent tasks
    for (const [toolUseId, taskId] of subagentTaskIds) {
      completeTask(taskId);
    }
    subagentTaskIds.clear();
  }
}
```

- [ ] **Step 4: Test that tool detection works**

Since this runs inside the Docker container, the test is:
1. Rebuild sandbox image: `docker build -t viona-sandbox:latest packages/sandbox/`
2. Recreate sandbox for a project
3. Send a chat message that triggers tool use (e.g., "read the transcript")
4. Check container logs for `Tool use` entries with tool names
5. Verify `toolUses > 0` in the `Orchestrator completed` log line

---

### Task 2: Log `SDKResultMessage` metrics (num_turns, cost, usage)

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:403-404`

Currently the result handler only logs `messageCount`, `textChunks`, `toolUses`. The `SDKResultMessage` contains critical metrics that are discarded.

- [ ] **Step 1: Parse and log result message fields**

Replace line 403-404:
```typescript
} else if (msg.type === 'result') {
  logger.info({ messageCount, textChunks, toolUses }, 'SDK result message');
}
```

With:
```typescript
} else if (msg.type === 'result') {
  const result = msg as Record<string, unknown>;
  logger.info({
    messageCount,
    textChunks,
    toolUses,
    subtype: result.subtype,
    numTurns: result.num_turns,
    totalCostUsd: result.total_cost_usd,
    durationMs: result.duration_ms,
    durationApiMs: result.duration_api_ms,
    stopReason: result.stop_reason,
    sessionId: result.session_id,
    errors: (result as any).errors,
    permissionDenials: (result.permission_denials as any[])?.length ?? 0,
  }, 'SDK result message');
}
```

- [ ] **Step 2: Pass cost to `finishJob` and `callbacks.onDone`**

Update the result extraction after the stream to include cost from the last result message. Add a variable before `processStream`:

```typescript
let lastResultCost: number | undefined;
let lastResultTurns: number | undefined;
```

Inside the result handler, capture:
```typescript
lastResultCost = result.total_cost_usd as number | undefined;
lastResultTurns = result.num_turns as number | undefined;
```

Then update the done callback (line 484):
```typescript
const doneResult = { sessionId: capturedSessionId ?? undefined, cost: lastResultCost };
```

---

### Task 3: Handle `SDKToolProgressMessage` for long-running tool tracking

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:356-407`

The SDK emits `SDKToolProgressMessage` (`type: 'tool_progress'`) periodically while a tool runs. This gives real-time elapsed time tracking.

- [ ] **Step 1: Add tool_progress handler**

Inside the non-stream message handler block, add:

```typescript
if (message.type === 'tool_progress') {
  const progress = message as { tool_use_id: string; tool_name: string; elapsed_time_seconds: number };
  // Update the Viona task with elapsed time info
  if (vionaTaskId && progress.tool_name) {
    updateTask(vionaTaskId, `${progress.tool_name} (${Math.round(progress.elapsed_time_seconds)}s)`);
  }
  // Log tools that take >10s
  if (progress.elapsed_time_seconds > 10) {
    logger.info({ tool: progress.tool_name, elapsed: progress.elapsed_time_seconds }, 'Long-running tool');
  }
}
```

---

### Task 4: Log MCP server connection status from init message

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:346-354`

The init message contains `mcp_servers: { name, status }[]`. We should log any failed connections — silent MCP failures are a known SDK issue.

- [ ] **Step 1: Enhance init message logging**

Replace lines 346-354:
```typescript
if ((message as any).type === 'system' && (message as any).subtype === 'init') {
  const init = message as Record<string, unknown>;
  const mcpServers = init.mcp_servers as Array<{ name: string; status: string }> | undefined;
  const failedServers = mcpServers?.filter(s => s.status !== 'connected') ?? [];

  logger.info({
    tools: (init.tools as any[])?.length ?? 0,
    mcpServers: mcpServers?.length ?? 0,
    failedMcpServers: failedServers.map(s => `${s.name}:${s.status}`),
    model: init.model,
    sessionId: init.session_id,
    permissionMode: init.permissionMode,
  }, 'SDK init message');

  if (failedServers.length > 0) {
    logger.warn({ failedServers }, 'Some MCP servers failed to connect');
  }
}
```

---

### Task 5: Fix double `failJob` on error path

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:489-498`
- Modify: `packages/sandbox/src/agent-server.ts:195-198`

`failJob()` is called inside orchestrator's catch AND in agent-server's catch. This sends up to 3 duplicate error events.

- [ ] **Step 1: Remove `failJob` from orchestrator's catch — let agent-server handle it**

In `orchestrator.ts`, replace lines 489-498:
```typescript
} catch (err) {
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const message = err instanceof Error ? err.message : String(err);
  logger.error({ err: message, elapsed, messageCount, textChunks, toolUses }, 'Orchestrator failed');

  // Don't call failJob here — agent-server.ts handles it in its catch block
  // to avoid double error notification.

  callbacks.onError(message);
}
```

The agent-server's catch at lines 195-198 already calls `failJob(msg)`, which is the correct single point of failure handling.

- [ ] **Step 2: Reset counters on resume fallback**

At line 465, when resume fails and retries fresh, reset counters:
```typescript
capturedSessionId = null;
textChunks = 0;
toolUses = 0;
messageCount = 0;
vionaTaskId = null;
subagentTaskIds.clear();
callbacks.onText('');
```
