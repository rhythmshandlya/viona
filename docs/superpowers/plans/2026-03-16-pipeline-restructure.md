# Professional Edit Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the sandbox pipeline from 6 agents (animator, researcher, trimmer, planner, verifier, healer) to 4 agents (Planner, Editor, Animator, Reviewer) implementing the 8-phase professional edit pipeline from the discussion notes.

**Architecture:** Replace the current orchestrator with a phased pipeline: Brainstorming → Transcript Cleanup (Editor) → Planning (Planner) → Editor Pass 1 (rough cut + mockups) → Animation Generation (setup + parallel Animators with self-healing) → Review (per-scene as Animators complete) → Editor Pass 2 (final assembly) → Refinement. Code assembles layered Animator prompts from modular pieces based on display mode.

**Tech Stack:** TypeScript, Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), Zod, Remotion, Express SSE

**Spec:** `docs/superpowers/specs/2026-03-15-pipeline-discussion-notes.md`

---

## File Structure

### Files to CREATE:
- `packages/sandbox/src/prompts/editor-system.md` — Editor agent prompt (trimming, rough cut, final assembly)
- `packages/sandbox/src/prompts/reviewer-system.md` — Reviewer agent prompt (adapted from verifier)
- `packages/sandbox/src/prompt-assembly.ts` — Layered Animator prompt builder
- `scripts/temp/test-orchestrator-config.ts` — Config validation test
- `scripts/temp/test-prompt-assembly.ts` — Prompt assembly test

### Files to MODIFY:
- `packages/sandbox/src/orchestrator.ts` — 4 agents, layered assembly, enhanced progress
- `packages/sandbox/src/prompts/orchestrator-system.md` — 8-phase pipeline
- `packages/sandbox/src/prompts/animator-system.md` — Add self-healing section
- `packages/sandbox/src/mcp-servers.ts` — Enhanced progress fields
- `packages/sandbox/src/prompts/prompt-loader.ts` — Add theme/display-mode prompt loading

### Files to DELETE:
- `packages/sandbox/src/prompts/trimmer-system.md` — Replaced by Editor
- `packages/sandbox/src/prompts/healer-system.md` — All agents self-heal
- `packages/sandbox/src/prompts/researcher-system.md` — Research is part of Planner
- `packages/sandbox/src/prompts/verifier-system.md` — Replaced by Reviewer

---

## Chunk 1: Prompt Assembly Module + Enhanced Progress

### Task 1: Create prompt-assembly.ts

**Files:**
- Create: `packages/sandbox/src/prompt-assembly.ts`

- [ ] **Step 1: Write the prompt assembly module**

Implements `buildAnimatorPrompt(config)` that assembles per-scene Animator prompts from modular pieces based on display mode, theme, and scene brief.

- [ ] **Step 2: Run tsc to verify compilation**

Run: `cd packages/sandbox && npx tsc --noEmit`

### Task 2: Update prompt-loader.ts

**Files:**
- Modify: `packages/sandbox/src/prompts/prompt-loader.ts`

- [ ] **Step 1: Add display-mode prompt loading functions**

Add `loadDisplayModeRules(mode)` and `loadThemePrompt(theme)` to the prompt loader.

- [ ] **Step 2: Run tsc to verify**

### Task 3: Enhance progress reporting

**Files:**
- Modify: `packages/sandbox/src/mcp-servers.ts`

- [ ] **Step 1: Add agentName, trackName, estimatedTimeRemaining to progress schema**

---

## Chunk 2: New Agent Prompts

### Task 4: Create Editor prompt

**Files:**
- Create: `packages/sandbox/src/prompts/editor-system.md`

- [ ] **Step 1: Write editor-system.md**

Covers Phase 2 (transcript cleanup with trimming rules from discussion notes), Phase 4 (rough cut + colored rect mockups), and Phase 7 (final assembly — replace mockups, transitions, captions, music).

### Task 5: Create Reviewer prompt

**Files:**
- Create: `packages/sandbox/src/prompts/reviewer-system.md`

- [ ] **Step 1: Write reviewer-system.md**

Adapted from verifier-system.md but with enhanced checks from discussion notes — composition, readability, display mode compliance, 70% canvas fill, 3+ elements, no flat backgrounds.

### Task 6: Update Animator prompt with self-healing

**Files:**
- Modify: `packages/sandbox/src/prompts/animator-system.md`

- [ ] **Step 1: Add self-healing section**

Add compilation error recovery instructions: run tsc after writing, fix errors, retry max 2 times.

---

## Chunk 3: Orchestrator Restructure

### Task 7: Rewrite orchestrator-system.md

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md`

- [ ] **Step 1: Rewrite for 8-phase pipeline**

Replace current 4-phase with 8-phase from discussion notes. Update agent dispatch rules for 4 agents. Add progress reporting with agent name, track, time remaining. Add captions-after-trimming in Phase 2. Add incremental preview guidance.

### Task 8: Update orchestrator.ts

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts`

- [ ] **Step 1: Replace 6 agent definitions with 4**

Remove: researcher, trimmer, healer, verifier. Add: editor. Rename: verifier → reviewer. Update tool registries. Give Planner WebSearch/WebFetch for research. Give Editor full manifest + caption tools. Give Animator self-healing tools (Bash for tsc). Give Reviewer render + viewport tools.

- [ ] **Step 2: Integrate layered prompt assembly for Animator**

Import `buildAnimatorPrompt` and use it when dispatching Animators.

- [ ] **Step 3: Run tsc to verify**

---

## Chunk 4: Cleanup + Testing

### Task 9: Delete dead prompt files

**Files:**
- Delete: `packages/sandbox/src/prompts/trimmer-system.md`
- Delete: `packages/sandbox/src/prompts/healer-system.md`
- Delete: `packages/sandbox/src/prompts/researcher-system.md`
- Delete: `packages/sandbox/src/prompts/verifier-system.md`

### Task 10: Write and run tests

**Files:**
- Create: `scripts/temp/test-orchestrator-config.ts`
- Create: `scripts/temp/test-prompt-assembly.ts`

- [ ] **Step 1: Write orchestrator config test**

Tests that `buildOrchestratorOptions()` returns correct agent definitions (4 agents, correct tools, correct models).

- [ ] **Step 2: Write prompt assembly test**

Tests that `buildAnimatorPrompt()` produces correct prompts for each display mode with proper dimensions.

- [ ] **Step 3: Run tsc --noEmit on entire sandbox package**

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit all changes**
