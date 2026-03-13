# Agent Architecture Hardening Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the three gaps identified against professional agent architecture patterns: fragile verdict parsing, unenforced pipeline timeout, and coordinator observability.

**Architecture:** Pure refactor of `claude_visual_generator.py`. No new files, no behavior changes beyond the three fixes. All verification agents switch from regex-based PASS/FAIL text parsing to structured JSON output via a `submit_verdict` MCP tool on the viewport server.

**Tech Stack:** Python 3.11+, Claude Agent SDK, TypeScript (MCP viewport server)

**Constraint:** `claude_visual_generator.py` is spawned as a subprocess — must remain the CLI entry point.

---

### Task 1: Add `submit_verdict` tool to viewport MCP server

**Files:**
- Modify: `packages/mcp-servers/src/viewport-server.ts`

Add a new MCP tool `submit_verdict` that verification agents call instead of writing free-text PASS/FAIL:

```typescript
server.tool(
  "submit_verdict",
  "Submit your verification verdict as structured data. MUST be called exactly once at the end of verification.",
  {
    passed: z.boolean().describe("true if scene/composition passes all checks, false if issues found"),
    issues: z.array(z.string()).describe("List of specific issues found. Empty array if passed."),
    acceptance_criteria: z.array(z.string()).optional().describe("Checklist items for fix agent. Only include if passed=false."),
  },
  async ({ passed, issues, acceptance_criteria }) => {
    // Tool just returns the structured data — the Python caller reads it from the tool result
    return {
      content: [{ type: "text", text: JSON.stringify({ passed, issues, acceptance_criteria: acceptance_criteria || [] }) }],
    };
  }
);
```

Build the MCP server:
```bash
cd packages/mcp-servers && npm run build
```

**Verify:** `node packages/mcp-servers/dist/viewport-server.js` starts without errors.

---

### Task 2: Create `_parse_verdict_from_response()` helper in visual generator

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

Add a helper method to `ClaudeVisualGenerator` that extracts structured verdicts from agent responses. It looks for `submit_verdict` tool calls first, falls back to the existing regex parsing for backwards compatibility:

```python
def _parse_verdict_from_response(
    self,
    messages: list,
    label: str = "Verify",
) -> tuple[bool, list[str]]:
    """Parse structured verdict from agent response messages.

    Prefers submit_verdict tool results (structured JSON).
    Falls back to regex PASS/FAIL parsing for backwards compatibility.

    Args:
        messages: List of SDK message objects collected during response
        label: Label for logging (e.g. "SceneVerify3", "CompVerify")

    Returns:
        (passed, issues_list)
    """
    # 1. Check for submit_verdict tool use
    for msg in messages:
        if not hasattr(msg, "content"):
            continue
        for block in msg.content:
            block_type = type(block).__name__
            if block_type == "ToolResultBlock" and hasattr(block, "content"):
                # Tool result content is a string — try parsing as JSON verdict
                try:
                    content_str = block.content if isinstance(block.content, str) else ""
                    # Also handle list-of-dicts format
                    if isinstance(block.content, list):
                        for item in block.content:
                            if isinstance(item, dict) and item.get("type") == "text":
                                content_str = item["text"]
                                break
                    data = json.loads(content_str)
                    if "passed" in data:
                        passed = bool(data["passed"])
                        issues = data.get("issues", [])
                        criteria = data.get("acceptance_criteria", [])
                        if criteria:
                            issues.append("ACCEPTANCE CRITERIA: " + " | ".join(criteria))
                        print(f"[{label}] Structured verdict: {'PASS' if passed else 'FAIL'} ({len(issues)} issues)")
                        return passed, issues
                except (json.JSONDecodeError, TypeError, KeyError):
                    pass
            # Also check ToolUseBlock for submit_verdict calls
            if block_type == "ToolUseBlock" and hasattr(block, "name"):
                if block.name == "mcp__viewport__submit_verdict" and hasattr(block, "input"):
                    inp = block.input
                    if isinstance(inp, dict) and "passed" in inp:
                        passed = bool(inp["passed"])
                        issues = inp.get("issues", [])
                        criteria = inp.get("acceptance_criteria", [])
                        if criteria:
                            issues.append("ACCEPTANCE CRITERIA: " + " | ".join(criteria))
                        print(f"[{label}] Structured verdict (from tool call): {'PASS' if passed else 'FAIL'} ({len(issues)} issues)")
                        return passed, issues

    # 2. Fallback: regex parsing of response text
    response_text = ""
    for msg in messages:
        if not hasattr(msg, "content"):
            continue
        for block in msg.content:
            block_type = type(block).__name__
            if block_type == "TextBlock" and hasattr(block, "text"):
                response_text += block.text

    print(f"[{label}] No structured verdict found, falling back to text parsing")
    return self._parse_verdict_text_fallback(response_text)


def _parse_verdict_text_fallback(
    self,
    response_text: str,
) -> tuple[bool, list[str]]:
    """Legacy fallback: parse PASS/FAIL from free text."""
    lines = response_text.split("\n")
    verdict = None
    verdict_line_idx = -1

    for idx, line in enumerate(lines):
        stripped = line.strip().upper()
        if stripped == "PASS" or stripped.startswith("PASS:") or stripped.startswith("PASS.") or stripped.startswith("PASS -"):
            verdict = "PASS"
        elif stripped in ("FAIL", "ISSUES") or any(
            stripped.startswith(p) for p in ("FAIL:", "FAIL.", "FAIL -", "ISSUES:", "ISSUES.", "ISSUES -")
        ):
            verdict = "FAIL"
            verdict_line_idx = idx

    if verdict == "PASS":
        return True, []

    if verdict == "FAIL" and verdict_line_idx >= 0:
        issues: list[str] = []
        for line in lines[verdict_line_idx + 1:]:
            stripped = line.strip()
            m = re.match(r'^\d+[.)]\s+(.+)', stripped)
            if m:
                issues.append(m.group(1))
        return False, issues

    # Ambiguous — no clear verdict, treat as pass
    return True, []
```

**Verify:** No syntax errors — `python -c "import ast; ast.parse(open('packages/worker/src/agents/claude_visual_generator.py').read()); print('OK')"` from repo root.

---

### Task 3: Refactor `_run_scene_verify()` to use structured verdicts

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

Changes to `_run_scene_verify()` (starts at line ~1722):

1. Add `mcp__viewport__submit_verdict` to `allowed_tools`
2. Add viewport MCP server to agent config
3. Collect all messages (not just text) during response streaming
4. Replace the manual PASS/FAIL parsing with `self._parse_verdict_from_response(messages, f"SceneVerify{scene_num}")`
5. Update the verification prompt's user message to instruct: "Call the `mcp__viewport__submit_verdict` tool with your verdict."

Updated allowed_tools:
```python
allowed_tools=["Read", "Bash", "mcp__viewport__submit_verdict"],
```

Add MCP servers:
```python
mcp_servers={"viewport": mcp_servers["viewport"]},
```

Note: `mcp_servers` is not currently in scope inside `_run_scene_verify`. It needs to be passed as a parameter or built inline. Since `build_mcp_servers` is already imported from `sdk_config`, build it inline:

```python
mcp_servers_config = build_mcp_servers(str(self.workspace))
# ... in ClaudeAgentOptions:
mcp_servers={"viewport": mcp_servers_config["viewport"]},
```

Replace the response collection and parsing block (lines ~1787-1828) with:

```python
messages = []
async with client:
    await client.query(user_msg)
    async for msg in client.receive_response():
        messages.append(msg)
        msg_type = type(msg).__name__
        if msg_type == "AssistantMessage" and hasattr(msg, "content"):
            for block in msg.content:
                block_type = type(block).__name__
                if block_type == "ToolUseBlock" and hasattr(block, "name"):
                    print(f"\n[SceneVerify{scene_num} Tool: {block.name}]", flush=True)

return self._parse_verdict_from_response(messages, f"SceneVerify{scene_num}")
```

**Verify:** `python -c "import ast; ast.parse(open('packages/worker/src/agents/claude_visual_generator.py').read()); print('OK')"` passes.

---

### Task 4: Refactor `_run_composition_verify()` to use structured verdicts

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

Same pattern as Task 3 for `_run_composition_verify()` (starts at line ~2046):

1. Add `mcp__viewport__submit_verdict` to `allowed_tools`
2. Add viewport MCP server
3. Collect all messages during streaming
4. Replace parsing with `self._parse_verdict_from_response(messages, "CompVerify")`
5. Update user message to instruct calling `submit_verdict`

Updated allowed_tools:
```python
allowed_tools=["Read", "Bash", "Edit", "Glob", "mcp__viewport__submit_verdict"],
```

**Verify:** Same AST parse check.

---

### Task 5: Refactor `_run_visual_verify()` to use structured verdicts

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

Same pattern for `_run_visual_verify()` (starts at line ~919):

1. Add `mcp__viewport__submit_verdict` to `allowed_tools` (currently only `["Read"]`)
2. Add viewport MCP server
3. Collect all messages during streaming
4. Replace the parsing block (lines ~1009-1036) with `self._parse_verdict_from_response(messages, f"VisualVerify{scene_num}")`
5. Update user message: replace "Output PASS or FAIL with numbered issues." with "Call the `mcp__viewport__submit_verdict` tool with your verdict."

Updated allowed_tools:
```python
allowed_tools=["Read", "mcp__viewport__submit_verdict"],
```

**Verify:** Same AST parse check.

---

### Task 6: Update verification prompts to instruct structured verdict output

**Files:**
- Modify: `packages/worker/src/prompts/animator/scene-verify.md`
- Modify: `packages/worker/src/prompts/animator/composition-verify.md`
- Modify: `packages/worker/src/prompts/animator/verify.md`

In each file, find the output format instructions (usually at the bottom telling the agent to write "PASS" or "FAIL") and add/replace with:

```markdown
## Output

After your analysis, you MUST call the `mcp__viewport__submit_verdict` tool exactly once:

- If everything looks correct: `submit_verdict(passed=true, issues=[])`
- If issues found: `submit_verdict(passed=false, issues=["issue 1", "issue 2"], acceptance_criteria=["fix criterion 1"])`

Do NOT write PASS or FAIL as text. Use the tool.
```

Keep any existing analysis instructions — only change the output format section.

**Verify:** Read each file and confirm the new instructions are present.

---

### Task 7: Enforce `timeout_seconds` in `generate_two_phase()`

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

Wrap the retry loop inside `generate_two_phase()` (starts at line ~2939) with `asyncio.wait_for()`:

Replace the current structure:
```python
last_error: Exception | None = None
director_result: dict = {}

for attempt in range(max_retries + 1):
    try:
        # ... entire pipeline ...
```

With:
```python
last_error: Exception | None = None
director_result: dict = {}

try:
    return await asyncio.wait_for(
        self._generate_two_phase_inner(
            transcript=transcript,
            words=words,
            width=width,
            height=height,
            duration_frames=duration_frames,
            fps=fps,
            max_retries=max_retries,
            style_preset=style_preset,
            layout_mode=layout_mode,
            style_guide=style_guide,
            source_width=source_width,
            source_height=source_height,
            safe_placement=safe_placement,
        ),
        timeout=timeout_seconds,
    )
except asyncio.TimeoutError:
    raise RuntimeError(
        f"Pipeline timed out after {timeout_seconds}s ({timeout_seconds // 60} minutes). "
        f"Check for hung SDK clients or MCP server deadlocks."
    )
```

Extract the entire retry loop (from `for attempt in range(max_retries + 1):` through the end of the method) into a new private method `_generate_two_phase_inner()` with the same parameters minus `timeout_seconds`.

The new method signature:
```python
async def _generate_two_phase_inner(
    self,
    transcript: str,
    words: list[dict] | None,
    width: int,
    height: int,
    duration_frames: int,
    fps: int,
    max_retries: int,
    style_preset: str,
    layout_mode: str,
    style_guide: str | None,
    source_width: int | None,
    source_height: int | None,
    safe_placement: list[str] | None,
) -> dict[str, Any]:
```

Move the OAuth validation + retry loop into `_generate_two_phase_inner`. Keep `generate_two_phase` as the thin wrapper that adds the timeout.

**Verify:** `python packages/worker/src/agents/claude_visual_generator.py --help` still works.

---

### Task 8: Add `Read` and `Glob` to coordinator's allowed tools

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

In the coordinator client setup (line ~2669), change:

```python
allowed_tools=["Bash", "Task"],
```

To:

```python
allowed_tools=["Bash", "Task", "Read", "Glob"],
```

Also update the coordinator's system prompt (line ~2663) to mention the new capability:

```python
"append": "You are an animation coordinator. Your ONLY job is to dispatch scene-generator subagents via the Task tool in batches. You must NOT implement scenes yourself. Do NOT use Write or Edit. After each batch completes, use Glob to verify the expected scene files were created (e.g., `src/{project_id}/scenes/Scene*.tsx`). If any are missing, report which ones failed. ONLY use the Task tool to delegate work. Dispatch each batch in a single response, then wait for all tasks in that batch to complete before starting the next batch.",
```

Note: the `{project_id}` in the prompt needs to be an f-string interpolation — it already is since the entire string is inside an f-string context.

**Verify:** Same AST parse check.

---

## Summary

| Task | What | Risk |
|---|---|---|
| 1 | Add submit_verdict MCP tool | Low — additive, no existing behavior changed |
| 2 | Create verdict parser helper | Low — new method, no existing code modified |
| 3-5 | Refactor 3 verify methods | Medium — changes existing parsing but fallback preserved |
| 6 | Update prompt files | Low — additive instructions |
| 7 | Enforce timeout | Medium — structural change to entry point |
| 8 | Coordinator observability | Low — adds 2 tools to allowed list |
