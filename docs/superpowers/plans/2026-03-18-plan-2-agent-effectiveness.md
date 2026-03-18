# Plan 2: Agent Effectiveness & Debugging Capability

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the orchestrator agent actually capable of debugging runtime errors by: (1) disabling ENABLE_TOOL_SEARCH so all 55 tools load upfront, (2) adding explicit debugging guidance to the prompt, (3) switching to the `claude_code` preset system prompt for stronger tool-use behavior, and (4) adding session context management to prevent context overflow on resume.

**Architecture:** The agent failed to fix a trivial `interpolate` bug because it fell into a text-reasoning loop instead of calling Read/Grep/Edit. Three factors contributed: (a) 55 tools may trigger auto tool-search deferral making tools harder to discover, (b) the orchestrator prompt has no debugging guidance — only pipeline phases, (c) resumed sessions grow unboundedly causing context overflow. We fix all three.

**Tech Stack:** TypeScript, `@anthropic-ai/claude-agent-sdk` v0.2.42, orchestrator prompt (Markdown)

---

### Task 1: Disable ENABLE_TOOL_SEARCH — load all tools upfront

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:167-256` (the `buildOrchestratorOptions` return object)

With 55 tools across 7 MCP servers, the SDK's auto `ENABLE_TOOL_SEARCH` (default threshold: 10% of context window) likely defers MCP tool loading. The model must use `ToolSearch` to discover deferred tools — an extra step that doesn't always happen. Since we use `bypassPermissions` and want all tools immediately available, disable tool search.

- [ ] **Step 1: Add `env` option to disable tool search**

In `buildOrchestratorOptions`, add to the return object (after line 250 `thinking`):

```typescript
env: {
  ENABLE_TOOL_SEARCH: 'false',
},
```

Full context — the return object should include:
```typescript
return {
  model: 'opus',
  systemPrompt,
  cwd: '/workspace',
  settingSources: ['project'],
  allowedTools: [ ... ],
  permissionMode: 'bypassPermissions' as const,
  allowDangerouslySkipPermissions: true,
  agents: { ... },
  maxTurns: 100,
  includePartialMessages: true,
  thinking: { type: 'adaptive' as const },
  env: {
    ENABLE_TOOL_SEARCH: 'false',
  },
  persistSession: true,
  mcpServers: { ... },
};
```

- [ ] **Step 2: Verify in logs**

After rebuilding the sandbox, the init message should still show `tools: 55`. If tool search had been deferring tools, we'd previously see fewer tools listed in the init. Compare before/after.

---

### Task 2: Switch to preset system prompt format

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:163-169`

The SDK docs say a custom string `systemPrompt` replaces the default. While essential tool instructions survive via the "minimal executor prompt," the full `claude_code` preset includes stronger agentic coding patterns (planning, multi-step reasoning, file exploration, debugging heuristics). Using the preset with `append` gives us both worlds.

- [ ] **Step 1: Change systemPrompt from raw string to preset with append**

Replace lines 163-169:

```typescript
const systemPrompt = injectContext(orchestratorPrompt, ctx);

// ...

return {
  model: 'opus',
  systemPrompt,
```

With:

```typescript
const orchestratorInstructions = injectContext(orchestratorPrompt, ctx);

// ...

return {
  model: 'opus',
  systemPrompt: {
    type: 'preset' as const,
    preset: 'claude_code' as const,
    append: orchestratorInstructions,
  },
```

This gives the model Claude Code's full system prompt (including tool usage patterns, debugging heuristics, and file exploration strategies) with the orchestrator pipeline instructions appended.

**Trade-off:** The Claude Code preset prompt is large (~10-15K tokens). This reduces available context for conversation history. But the improved tool-use behavior is worth it — the model will actually grep for errors instead of narrating.

- [ ] **Step 2: Do NOT change subagent prompts**

Subagents (planner, editor, animator, reviewer) have focused, domain-specific prompts. They don't need the full Claude Code preset. The orchestrator is the one that needs debugging/exploration capabilities. Leave subagent `prompt` fields as raw strings.

---

### Task 3: Add debugging guidance to orchestrator prompt (Phase 8)

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md:259-280` (Phase 8 Refinement section)

The Phase 8 dispatch table covers creative changes but has zero guidance for runtime errors. The model doesn't know to grep for error patterns.

- [ ] **Step 1: Add a "Runtime Errors" section to Phase 8**

After the existing dispatch table (line 273), add a new row and a detailed subsection:

In the table, add this row:
```markdown
| Runtime error (interpolate, type error, import, render failure) | Debug directly — grep for the error pattern, read the file, fix the code, trigger rebuild |
```

Then after the table's "Rules for refinement" section (line 280), add:

```markdown
### Debugging Runtime Errors

When the user reports a runtime error (e.g., "inputRange must be strictly monotonically increasing"):

1. **Extract the error signature.** Identify the key pattern — array values, function name, or error message.
2. **Grep for it.** Use `Grep` to search scene files and source code for the pattern. For `interpolate` errors, search for `interpolate(` calls in `/workspace/src/scenes/`.
3. **Read the matching file.** Use `Read` to see the full context around the problematic code.
4. **Fix the code.** Use `Edit` to make the minimal fix. Common fixes:
   - `inputRange` not monotonically increasing → reverse the array or swap inputRange/outputRange
   - Missing `extrapolateLeft: 'clamp'` / `extrapolateRight: 'clamp'` → add both
   - Import errors → check the export name and path
5. **Trigger rebuild** via `mcp__render__trigger_rebuild`.
6. **Verify** with `mcp__render__render_still` at a representative frame.

DO NOT narrate what you're checking. Call tools silently, find the bug, fix it, confirm it's fixed. One sentence to the user: "Fixed — the interpolate call had a reversed input range."

NEVER cycle through files in text without actually reading them. If you're uncertain where the error is, grep first.
```

- [ ] **Step 2: Add a general debugging principle to the RULES section**

At the end of the RULES section (line 787), add:

```markdown
- For runtime errors: grep first, read the file, fix the code, rebuild. Never reason about code you haven't read.
```

---

### Task 4: Session context management — prevent unbounded growth

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:435-477` (the execute section)
- Modify: `packages/sandbox/src/agent-server.ts:86-210` (the /prompt handler)

Resumed sessions grow unboundedly. After 4-5 resumes with tool-heavy turns, the context can hit 4800+ messages, degrading model behavior. We need a policy.

- [ ] **Step 1: Track context size from init message and log it**

In the init handler (Task 1's enhanced logging already covers this), also extract the context token count if available. The `SDKSystemMessage` doesn't directly expose context tokens, but we can estimate from `messageCount` after resume.

Add after the `processStream` function, before the execute section:

```typescript
let estimatedContextMessages = 0;
```

In the init handler, if the session has a resume, note the starting message count:
```typescript
// After init logging
if (request.sessionId) {
  // On resume, messageCount starts accumulating from the replayed history
  // We'll check the count after the first assistant message
}
```

- [ ] **Step 2: Add a fresh-session fallback when context is too large**

In the execute section, after a resume completes, check if the context was excessively large:

```typescript
if (request.sessionId) {
  logger.info({ sessionId: request.sessionId }, 'Resuming session');
  emitProgress('connecting', 'Resuming session...', 'Viona');
  emitActivity('Viona', 'resuming session', 'connecting');
  try {
    const iter = query(buildQueryOpts(true));
    await processStream(iter);

    // If the resumed session used 0 tools despite being asked to act,
    // log a warning (could indicate context overflow)
    if (toolUses === 0 && textChunks > 100) {
      logger.warn({
        textChunks,
        toolUses,
        messageCount,
        sessionId: request.sessionId,
      }, 'Possible context overflow — high text output with zero tool usage');
    }
  } catch (resumeErr) {
    // ... existing fallback
  }
}
```

- [ ] **Step 3: Add a conversation turn limit for session resume**

In the API layer, track how many turns a session has had. When a session exceeds a threshold (e.g., 20 turns), start a fresh session instead of resuming. This prevents unbounded context growth.

In `packages/api/src/agent/agent-router.ts`, before building the proxy body, add:

```typescript
// If conversation has too many messages, start fresh (prevent context overflow)
const MAX_RESUME_MESSAGES = 40; // ~20 user + 20 assistant turns
const messageCount = storedMessages.length;
const shouldResume = conversation.sdkSessionId && messageCount < MAX_RESUME_MESSAGES;

// In the proxy body:
sessionId: shouldResume ? conversation.sdkSessionId : null,
```

When NOT resuming, the orchestrator falls back to text-based conversation history (already handled by lines 289-294 in `orchestrator.ts`). This is a lossy but bounded context.

- [ ] **Step 4: Trim conversation history for non-resume requests**

When sending text-based conversation history (non-resume), limit to the last N messages instead of the full history:

In `orchestrator.ts` lines 289-294, the history is injected as text. The API already sends `conversationHistory` — ensure it's trimmed at the API layer.

In `agent-router.ts`, when building `conversationHistory` for the proxy body, limit to last 20 messages:

```typescript
conversationHistory: storedMessages
  .slice(-20)  // Last 20 messages to prevent context overflow
  .map(m => ({ role: m.role, content: formatMessageContent(m.content) })),
```

---

### Task 5: Add tool-use health check warning

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts` (after processStream completes)

If the model produces a long text response with 0 tool calls when the prompt suggests action is needed, emit a warning that helps diagnose degenerate behavior.

- [ ] **Step 1: Add post-stream health check**

After the `processStream` call completes (before the `finishJob` call at line 483), add:

```typescript
// Health check: detect text-only responses that should have used tools
const userPrompt = request.prompt.toLowerCase();
const isActionable = userPrompt.includes('fix') || userPrompt.includes('error') ||
  userPrompt.includes('change') || userPrompt.includes('update') ||
  userPrompt.includes('add') || userPrompt.includes('remove') ||
  userPrompt.includes('edit') || userPrompt.includes('debug');

if (isActionable && toolUses === 0 && textChunks > 50) {
  logger.warn({
    prompt: request.prompt.substring(0, 100),
    textChunks,
    toolUses,
    messageCount,
  }, 'Agent produced long text response without tool use for actionable request');
}
```

This doesn't change behavior — it just logs a warning so we can spot degenerate runs in the logs.
