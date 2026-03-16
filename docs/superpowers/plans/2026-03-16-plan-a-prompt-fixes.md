# Plan A: Prompt & UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three prompt/UX bugs in the sandbox orchestrator — redundant questions, leaked internal thinking, and duplicate scene plan widgets.

**Architecture:** All three fixes are prompt-level or thin frontend filtering changes. No architectural changes. Issue 1 reorders the Phase 1 prompt to read the transcript before asking questions. Issue 4 adds server-side text filtering to suppress internal monologue between tool calls. Issue 5 adds frontend deduplication for scene_plan widgets and a prompt instruction to show the widget exactly once.

**Tech Stack:** Markdown prompts, TypeScript (Fastify backend, React frontend)

**Spec Reference:** `docs/superpowers/plans/2026-03-16-pipeline-issues.md` — Issues 1, 4, 5

---

## File Structure

### Files to modify:
- `packages/sandbox/src/prompts/orchestrator-system.md` — Phase 1 reorder (Issue 1), widget dedup instruction (Issue 5)
- `packages/api/src/sandbox/proxy.ts` — Text filtering for internal monologue (Issue 4)
- `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` — Widget dedup in rendering (Issue 5)

### Files NOT touched:
- `packages/sandbox/src/orchestrator.ts` — processStream forwards text_delta correctly; filtering belongs in the proxy layer
- `packages/sandbox/src/prompts/planner-system.md` — Planner doesn't produce duplicate widgets
- `apps/web/src/features/editor-v2/components/ProgressBar.tsx` — Separate plan (Plan B)

---

## Chunk 1: Fix orchestrator Phase 1 — read transcript before asking questions

### Task 1: Reorder Phase 1 brainstorming logic

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md:64-78`

**Context:** The orchestrator's Phase 1 section (lines 64-78) tells the AI to greet the user, ask about content focus/key messages, and THEN detect content type by reading the transcript. The AI follows instructions in order — it asks redundant questions before reading the transcript that already answers them.

- [ ] **Step 1: Read the current Phase 1 section**

Open `packages/sandbox/src/prompts/orchestrator-system.md` and read lines 64-78. The current structure is:

```markdown
### Phase 1: Brainstorming (Chat)

Viona engages as a creative partner. Understand what the user wants before committing.

- On first message: one friendly greeting + ask the user to describe their vision. Keep it to 1-2 sentences.
- If the user already described what they want, skip ahead.
- If the user pastes a detailed creative brief, use it as-is.
- If the user says "just do it" or similar, proceed with your own creative judgment.
- Proactively ask about:
  - Content focus and key messages
  - Desired layout and visual style
  - Theme preferences and brand colors
  - Any media assets they want included (logos, images, B-roll)
- Detect the content type (see Content Type Detection below) by skimming `/workspace/docs/transcript.json`. This determines trim aggressiveness in Phase 2.
```

- [ ] **Step 2: Replace Phase 1 with transcript-first logic**

Replace lines 64-78 with:

```markdown
### Phase 1: Brainstorming (Chat)

Viona engages as a creative partner. Understand what the user wants before committing.

**FIRST — before saying anything to the user:**
1. Read `/workspace/docs/transcript.json` to understand the content. Identify the topic, key messages, product/service, target audience, and emotional tone.
2. Detect the content type (see Content Type Detection below). This determines trim aggressiveness in Phase 2.

**THEN — engage the user:**
- On first message: one friendly greeting that shows you already understand the content (e.g., "I see this is a swimming coaching ad targeting parents — love the energy!"). Then ask what they'd like to focus on visually.
- If the user already described what they want, skip ahead.
- If the user pastes a detailed creative brief, use it as-is.
- If the user says "just do it" or similar, proceed with your own creative judgment.
- Only ask about things NOT evident from the transcript:
  - Layout and visual style preferences
  - Theme preferences and brand colors
  - Any additional media assets (logos, images, B-roll)
- Do NOT ask about content focus, key messages, or the product — you already know this from the transcript.
```

- [ ] **Step 3: Verify the change**

Run: `grep -n "FIRST — before saying" packages/sandbox/src/prompts/orchestrator-system.md`
Expected: Match on the new line confirming the replacement.

Run: `grep -n "Proactively ask about" packages/sandbox/src/prompts/orchestrator-system.md`
Expected: No matches (old instruction removed).

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator-system.md
git commit -m "fix: reorder Phase 1 — read transcript before asking questions (Issue 1)"
```

---

## Chunk 2: Filter internal monologue from chat stream

### Task 2: Add text suppression in the proxy intercept

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts:232-235`

**Context:** The orchestrator leaks internal thinking into the chat stream — text like "Both agents are working. Let me check if they've completed." This happens because `proxyPromptWithIntercept` forwards ALL `text` SSE events from the sandbox to the browser. The orchestrator prompt already says "Output ZERO text before tool calls" (line 40) but the model doesn't always comply.

The fix: suppress text events that arrive while the orchestrator is actively using tools (between a tool_use start and the final response). We track whether we're in a "tool phase" and buffer text. Only flush text to the browser when we get a non-tool text block (the final user-facing response).

**Simpler approach:** Since the orchestrator prompt says ALL reasoning should be in thinking blocks, any text between tool calls is internal monologue. We can detect this by tracking tool_use events. But the proxy only sees parsed SSE events (`text`, `widget`, `progress`, `done`), not raw SDK events. The sandbox agent-server emits these high-level events.

**Simplest approach that works:** The internal monologue has clear patterns — it's status narration between tool calls. Instead of complex state tracking, add a text filter that suppresses known monologue patterns. This is fragile but works immediately. The real fix is the prompt improvement (already done in Step 2 of Task 1 — "Output ZERO text before tool calls" is already there; the model just sometimes ignores it).

**Actually, best approach:** Buffer text events and only forward them when we see a `done` event or when sufficient text has accumulated that looks like a real response (contains markdown, questions, or is > 200 chars). Short text fragments between tool calls are likely monologue.

- [ ] **Step 1: Read the current text event handling**

Open `packages/api/src/sandbox/proxy.ts` and read lines 230-255 — the event dispatch switch block:

```typescript
case 'text':
  callbacks.onText?.(data.text ?? data);
  break;
```

- [ ] **Step 2: Add text buffering with flush logic**

In `proxyPromptWithIntercept`, add a text buffer above the event dispatch loop (around line 195, after the `let buffer = ''` line for SSE parsing):

```typescript
// --- Text buffering to suppress internal monologue ---
let textBuffer = '';
let lastToolEventTime = 0;
const MONOLOGUE_WINDOW_MS = 2000; // Text within 2s of a tool event is likely monologue
```

Then modify the event dispatch (lines 232-251). Replace the `'text'` case:

```typescript
case 'text': {
  const text = data.text ?? data;
  if (typeof text === 'string') {
    // If text arrives right after a tool event, buffer it (likely monologue)
    const timeSinceTool = Date.now() - lastToolEventTime;
    if (lastToolEventTime > 0 && timeSinceTool < MONOLOGUE_WINDOW_MS && text.length < 200) {
      textBuffer += text;
    } else {
      // Flush any buffered text + new text
      if (textBuffer) {
        callbacks.onText?.(textBuffer + text);
        textBuffer = '';
      } else {
        callbacks.onText?.(text);
      }
    }
  }
  break;
}
```

Add tracking for tool-related events. After the `'widget'` case (line 243), add:

```typescript
case 'tool_use':
case 'tool_result':
  lastToolEventTime = Date.now();
  break;
```

And in the `'done'` case (line 237), flush any remaining buffered text:

```typescript
case 'done': {
  // Flush any remaining buffered text before done
  if (textBuffer) {
    callbacks.onText?.(textBuffer);
    textBuffer = '';
  }
  callbacks.onDone?.(data).catch(() => {});
  break;
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `cd packages/api && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/sandbox/proxy.ts
git commit -m "fix: buffer text events near tool calls to suppress internal monologue (Issue 4)"
```

---

## Chunk 3: Deduplicate scene plan widgets

### Task 3: Add prompt instruction + frontend dedup for scene_plan widgets

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md:132` (add dedup instruction)
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx:1927` (render only last scene_plan)

**Context:** The orchestrator calls `show_widget` with kind `scene_plan` multiple times during planning — once before validation, once after, sometimes a third time. The user sees 3 plan widgets with different scene counts. The fix is two-pronged: tell the prompt to show it once, AND deduplicate in the frontend as a safety net.

- [ ] **Step 1: Add "exactly once" instruction to orchestrator prompt**

In `packages/sandbox/src/prompts/orchestrator-system.md`, find the scene_plan widget instruction (around line 132):

```
2. Show the plan to the user via `mcp__widgets__show_widget` with kind `"scene_plan"` ...
```

Add after this line:

```markdown
   **Show the scene_plan widget exactly ONCE** — after all validation passes and the final SCENE_PLAN.md is written. Do NOT show intermediate drafts. If validation corrects the plan, re-read the plan and show the corrected version only.
```

- [ ] **Step 2: Verify prompt change**

Run: `grep -n "exactly ONCE" packages/sandbox/src/prompts/orchestrator-system.md`
Expected: One match on the new line.

- [ ] **Step 3: Add frontend deduplication**

In `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`, find the `mergeAdjacentTextBlocks` function (around line 1680). Add a new dedup function right after it:

```typescript
/** Deduplicate widgets — keep only the LAST instance of each widget kind. */
function deduplicateWidgets(blocks: MessageBlock[]): MessageBlock[] {
  // Find the last index of each widget kind
  const lastWidgetIndex = new Map<string, number>();
  blocks.forEach((block, i) => {
    if (block.type === 'widget' && block.kind) {
      lastWidgetIndex.set(block.kind, i);
    }
  });

  // Filter out earlier duplicates
  return blocks.filter((block, i) => {
    if (block.type === 'widget' && block.kind && lastWidgetIndex.has(block.kind)) {
      return i === lastWidgetIndex.get(block.kind);
    }
    return true;
  });
}
```

Then update the message rendering (around line 1927) from:

```typescript
{mergeAdjacentTextBlocks(message.content).map((block, i) => renderBlock(block, i))}
```

to:

```typescript
{deduplicateWidgets(mergeAdjacentTextBlocks(message.content)).map((block, i) => renderBlock(block, i))}
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (or only pre-existing ones)

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator-system.md apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "fix: deduplicate scene_plan widgets — prompt instruction + frontend safety net (Issue 5)"
```

---

## What This Achieves

| Issue | Fix | Risk |
|-------|-----|------|
| **Issue 1**: Redundant questions | Phase 1 reads transcript first, only asks about unknowns | Low — prompt-only change |
| **Issue 4**: Leaked internal thinking | Text buffering near tool events suppresses monologue | Medium — time-based heuristic may occasionally suppress real text; 2s window + 200 char threshold mitigates this |
| **Issue 5**: Duplicate widgets | Prompt says "exactly once" + frontend keeps only last widget per kind | Low — frontend dedup is a safety net; prompt fix is primary |

## Known Tradeoffs

- **Issue 4 text buffering**: The 2-second window is a heuristic. If the model produces a short (< 200 char) genuine response within 2s of a tool event, it would be buffered and delayed (not lost — flushed on the next text chunk or on done). This is acceptable because genuine responses are typically longer and arrive after thinking, not immediately after tool completion.
- **Issue 5 frontend dedup**: Keeps only the LAST widget of each kind per message. If the orchestrator intentionally shows two different widget kinds (e.g., scene_plan and a choice widget), both are preserved. Only duplicates of the same kind are deduped.
