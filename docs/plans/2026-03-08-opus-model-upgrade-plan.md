# Opus Model Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all 9 hardcoded Sonnet model references with Opus (`self.model`) and add extended thinking (`self.max_thinking_tokens`) to every agent in the visual generation pipeline.

**Architecture:** Single file change — `claude_visual_generator.py`. Each agent's `ClaudeAgentOptions` gets `model=self.model` instead of `"claude-sonnet-4-20250514"` and `max_thinking_tokens=self.max_thinking_tokens` added (or updated). The coordinator agent is an exception — it gets `max_thinking_tokens=2000` since it only dispatches tasks.

**Tech Stack:** Python, Claude Agent SDK

**Files to modify:**
- `packages/worker/src/agents/claude_visual_generator.py`

---

## Task 1: Upgrade TSC Self-Heal Agent (line ~3295)

**File:** `packages/worker/src/agents/claude_visual_generator.py`

**Step 1:** Edit line 3295

REPLACE:
```python
                    model="claude-sonnet-4-20250514",  # Use Sonnet for speed
```
WITH:
```python
                    model=self.model,
```

**Step 2:** Edit line 3303 — update existing `max_thinking_tokens`

REPLACE:
```python
                    max_thinking_tokens=3000,
```
WITH:
```python
                    max_thinking_tokens=self.max_thinking_tokens,
```

**Step 3:** Verify — search for remaining "sonnet" references near this block

---

## Task 2: Upgrade Scene Verify Agent (line ~3481)

**File:** `packages/worker/src/agents/claude_visual_generator.py`

**Step 1:** Edit line 3481

REPLACE:
```python
                    model="claude-sonnet-4-20250514",
```
WITH:
```python
                    model=self.model,
                    max_thinking_tokens=self.max_thinking_tokens,
```

---

## Task 3: Upgrade Composition Verify / Self-Heal Fix Agent (line ~3638)

**File:** `packages/worker/src/agents/claude_visual_generator.py`

**Step 1:** Edit line 3638

REPLACE:
```python
                        model="claude-sonnet-4-20250514",
```
WITH:
```python
                        model=self.model,
                        max_thinking_tokens=self.max_thinking_tokens,
```

---

## Task 4: Upgrade Director Agent (line ~4164)

**File:** `packages/worker/src/agents/claude_visual_generator.py`

**Step 1:** Edit line 4159 comment + line 4164 model

REPLACE:
```python
        # Director uses Sonnet for fast planning.
```
WITH:
```python
        # Director uses configured model (Opus) for high-quality planning.
```

**Step 2:** Edit line 4164

REPLACE:
```python
                model="claude-sonnet-4-20250514",
```
WITH:
```python
                model=self.model,
```

**Step 3:** Edit line 4172 — update existing `max_thinking_tokens`

REPLACE:
```python
                max_thinking_tokens=5000,
```
WITH:
```python
                max_thinking_tokens=self.max_thinking_tokens,
```

---

## Task 5: Upgrade Screenshot Verify Agent (line ~4621)

**File:** `packages/worker/src/agents/claude_visual_generator.py`

**Step 1:** Edit line 4621

REPLACE:
```python
                    model="claude-sonnet-4-20250514",
```
WITH:
```python
                    model=self.model,
                    max_thinking_tokens=self.max_thinking_tokens,
```

---

## Task 6: Upgrade Scene Fix Agent (line ~4843)

**File:** `packages/worker/src/agents/claude_visual_generator.py`

**Step 1:** Edit line 4843

REPLACE:
```python
                    model="claude-sonnet-4-20250514",
```
WITH:
```python
                    model=self.model,
                    max_thinking_tokens=self.max_thinking_tokens,
```

---

## Task 7: Upgrade Composition Verify Agent (line ~4947)

**File:** `packages/worker/src/agents/claude_visual_generator.py`

**Step 1:** Edit line 4947

REPLACE:
```python
                    model="claude-sonnet-4-20250514",
```
WITH:
```python
                    model=self.model,
                    max_thinking_tokens=self.max_thinking_tokens,
```

---

## Task 8: Upgrade Setup Agent (line ~5345)

**File:** `packages/worker/src/agents/claude_visual_generator.py`

**Step 1:** Edit line 5342 comment

REPLACE:
```python
            # Spawn setup agent (Sonnet for speed)
```
WITH:
```python
            # Spawn setup agent (Opus for quality)
```

**Step 2:** Edit line 5345

REPLACE:
```python
                    model="claude-sonnet-4-20250514",
```
WITH:
```python
                    model=self.model,
                    max_thinking_tokens=self.max_thinking_tokens,
```

---

## Task 9: Upgrade Coordinator Agent (line ~5512)

**File:** `packages/worker/src/agents/claude_visual_generator.py`

**Step 1:** Edit line 5512

REPLACE:
```python
                    model="claude-sonnet-4-20250514",
```
WITH:
```python
                    model=self.model,
                    max_thinking_tokens=2000,  # Coordinator only dispatches tasks
```

---

## Task 10: Verification

**Step 1:** Verify no remaining hardcoded Sonnet references

```bash
grep -n "claude-sonnet" packages/worker/src/agents/claude_visual_generator.py
```

Expected: 0 matches

**Step 2:** Verify all agents use self.model

```bash
grep -n "model=self.model" packages/worker/src/agents/claude_visual_generator.py
```

Expected: 11 matches (9 upgraded + 2 existing at lines ~4423 and ~5153)

**Step 3:** Verify thinking tokens present

```bash
grep -n "max_thinking_tokens" packages/worker/src/agents/claude_visual_generator.py
```

Expected: 11+ matches (all agents have it)

**Step 4:** Python syntax check

```bash
cd packages/worker && python -c "import ast; ast.parse(open('src/agents/claude_visual_generator.py').read()); print('OK')"
```

Expected: `OK`
