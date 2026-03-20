# Issue: Orchestrator Skips Context Gathering on First Turn

**Project:** c37faee0-6deb-4769-963e-a5ab7207dc2f (RAW-12)
**Date:** 2026-03-20
**Severity:** High — pipeline proceeds without user preferences, downstream agents hallucinate context

---

## Summary

When the orchestrator receives a new project, it gives a generic greeting without reading the transcript or analyzing the content first. The user's creative brief (provided in conversation) is never persisted to `user-brief.md`, so downstream agents (Trim Editor, Planner, Animators) lack the user's creative direction.

## Observed Behavior

### Turn 1: Generic greeting (0 tool calls)
- Hidden system message: `[Start the conversation. Greet the user and offer to help.]`
- Orchestrator response: *"Hey! I'm Viona. Drop your footage and tell me what you're going for, or I can take a look at what's already in the workspace and we'll go from there."*
- **0 tool uses** — didn't read transcript.json, didn't call analyze_transcript
- This violates Phase 1: *"First — before saying anything: Read /workspace/docs/transcript.json. Call mcp__analysis__analyze_transcript."*

### Turn 2: Reads transcript, asks questions (correct)
- User said "yes"
- Orchestrator resumed, read transcript.json + read_manifest (2 tool calls)
- Correctly identified content: "42-second talking head video about launching a brand and picking a product in 90 days"
- Asked 3 good clarifying questions about goal, visual energy, brand colors

### Turn 3: Receives brief, skips persistence, dispatches Trim Editor
- User answered: "1. social content 2. clean and professional 3. pick liquid glass"
- Orchestrator proceeded directly to Phase 2 (Trim Editor dispatch) without:
  1. Writing `user-brief.md` to `/workspace/docs/`
  2. Acknowledging the brief to the user before proceeding
- The last assistant content saved to conversation_messages was `[]` (empty array)

### Downstream impact: Trim Editor hallucinates preferences
- Trim report says: *"Per user preference, no zoom punch-ins were applied"*
- The user never expressed this preference — the Trim Editor assumed it or lacked context

## Root Causes

### 1. Hidden init prompt overrides Phase 1 instructions
**File:** `packages/api/src/agent/agent-router.ts:142`

The first message sent to the orchestrator is `[Start the conversation. Greet the user and offer to help.]`. This overrides the Phase 1 system prompt instruction to read the transcript first. The model interprets the hidden prompt as "just greet" and skips the mandatory context-gathering step.

**Fix:** Either:
- a) Change the hidden init prompt to include context-gathering: `[Start the conversation. First read the transcript and analyze it, then greet the user showing you understand their content.]`
- b) Add a Phase 0 gate in the orchestrator system prompt that fires regardless of user message content
- c) Remove the generic greeting — have the orchestrator always read+analyze first, then greet with content-aware opener

### 2. No mechanism to persist conversational brief to workspace
**File:** `packages/sandbox/src/workspace-init.ts:219-223`

`user-brief.md` is only written during workspace init if `payload.userBrief` is provided (sourced from `project.description` in DB). This covers the case where a user provides a brief *before* the sandbox starts (e.g., via a project description field).

But when no upfront brief exists — the normal flow — the orchestrator asks clarifying questions (Phase 1) and the user provides creative direction *in conversation*. There is no mechanism for the orchestrator to persist these conversational answers to `user-brief.md`.

**File:** `packages/sandbox/src/prompts/orchestrator/system.md:93-94`

Phase 3 says "Pass to Planner: Content type, user's creative brief" — this relies on the orchestrator including the brief in the Task prompt text. But:
- No instruction tells the orchestrator to *write* the brief to a file after collecting it in conversation
- Downstream agents can't reference it independently
- If the orchestrator forgets to include it in the Task prompt, it's lost
- The Trim Editor (Phase 2) runs *before* the Planner — so even if the Planner gets the brief via Task prompt, the Trim Editor already ran without it

**Fix:** Add an explicit Phase 1 completion step to the orchestrator system prompt:
```
After collecting the user's creative direction (or if user says "just do it"),
write a summary to /workspace/docs/user-brief.md before proceeding to Phase 2.
Include: goal, style/theme, energy level, any specific requests.
```

### 3. Trim Editor dispatched without creative brief context
**File:** `packages/sandbox/src/prompts/orchestrator/system.md:80-86`

Phase 2 dispatch instructions say to pass:
- Content type + trim aggressiveness
- analyze_transcript output
- Instructions for what to preserve

It does NOT say to pass the user's creative brief / style preferences. The Trim Editor operates blind to user intent.

**Fix:** Add creative brief to Phase 2 dispatch context:
```
Pass to Trim Editor:
- Content type + trim aggressiveness
- The analyze_transcript output
- User's creative brief / style preferences (theme, energy level, etc.)
- Instructions for what to preserve
```

### 4. Empty assistant response in DB
**File:** `packages/api/src/agent/agent-router.ts` (message save logic)

The third turn's assistant content was saved as `[]` in conversation_messages. This likely means:
- The SSE connection was established
- The orchestrator started processing (extended thinking + tool calls)
- The assistant message was saved before any text was streamed
- Text was streamed to the SSE client but the DB record was never updated

This means on page reload, the user loses the entire assistant response for that turn.

**Fix:** Ensure assistant messages are updated in the DB after streaming completes, not just at creation time.

## Evidence

### Sandbox logs (summarized)
```
Turn 1: fresh session → 1 turn, 0 tool uses, $0.23 → "Orchestrator completed"
Turn 2: resume → 3 turns, 2 tool uses (Read, read_manifest), $0.11 → "Orchestrator completed"
Turn 3: resume → dispatched Trim Editor, then Planner (still running at time of report)
```

### Workspace state
```
/workspace/docs/user-brief.md        → DOES NOT EXIST
/workspace/docs/creative-brief.md    → DOES NOT EXIST
/workspace/docs/SCENE_PLAN.md        → DOES NOT EXIST (Planner still running)
/workspace/src/scenes/               → EMPTY
/workspace/docs/trim-report.md       → EXISTS (Trim Editor completed)
```

### Conversation messages
```
user:      [hidden] [Start the conversation. Greet the user and offer to help.]
assistant: Hey! I'm Viona. Drop your footage...
user:      yes
assistant: Let me see what we're working with... [3 questions]
user:      1. social content 2. clean and professional 3. pick liquid glass
assistant: []  ← EMPTY
```

## Impact

- User's creative preferences (liquid glass theme, clean/professional style) are not available to any downstream agent
- Trim Editor fabricated a preference ("no zoom punch-ins") that the user never stated
- Planner will plan scenes without knowing the user wants "liquid glass" or "clean and professional"
- Animators won't know the target aesthetic
- The entire pipeline output may not match what the user asked for
