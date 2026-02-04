# Claude Code Visual Generator Design

**Date:** 2026-02-04
**Status:** Approved
**Goal:** Replace OpenHands with Claude Code SDK for visual generation

## Overview

Replace the OpenHands-based visual generator with Claude Agent SDK, using Claude Pro/Max subscription (OAuth) instead of API keys. This eliminates per-token API costs and improves code quality.

## Architecture

### Current Flow (OpenHands)

```
Worker receives job
    ↓
Visual Director (Gemini) → visual-plan.json
    ↓
OpenHands Agent (Docker) → writes code
    ↓
TypeScript Validator (custom tool)
    ↓
Visual Evaluator → scores output
    ↓
Self-healing loop (repeat)
    ↓
Bundle & return
```

### New Flow (Claude Code)

```
Worker receives job
    ↓
Claude Code Session (OAuth)
    ├── Extended thinking (planning)
    ├── Write code (native tools)
    ├── TypeScript validation (bash)
    └── Self-correct if errors
    ↓
Bundle & return
```

### Worker Pool Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Worker Pool                          │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   Worker 1   │   Worker 2   │   Worker 3   │      ...       │
│  workspace/  │  workspace/  │  workspace/  │                │
└──────┬───────┴──────┬───────┴──────┬───────┴────────────────┘
       │              │              │
       └──────────────┼──────────────┘
                      ▼
              ┌───────────────┐
              │    BullMQ     │
              │  Job Queue    │
              └───────┬───────┘
                      ▼
              ┌───────────────┐
              │    Bundles    │
              │   (shared)    │
              └───────────────┘
```

Each worker has a dedicated workspace. Scale by adding workers.

## Authentication

Uses OAuth from Claude Pro/Max subscription. Reference: Auto-Claude `apps/backend/core/auth.py`

```python
def get_oauth_token_from_credential_store() -> str | None:
    """
    Get OAuth token from Windows credential files.
    Reference: Auto-Claude apps/backend/core/auth.py lines 476-530
    """
    cred_paths = [
        os.path.expandvars(r"%USERPROFILE%\.claude\.credentials.json"),
        os.path.expandvars(r"%USERPROFILE%\.claude\credentials.json"),
        os.path.expandvars(r"%LOCALAPPDATA%\Claude\credentials.json"),
    ]

    for cred_path in cred_paths:
        if os.path.exists(cred_path):
            try:
                with open(cred_path, encoding="utf-8") as f:
                    data = json.load(f)
                    token = data.get("claudeAiOauth", {}).get("accessToken")
                    if token and token.startswith("sk-ant-oat01-"):
                        return token
            except (json.JSONDecodeError, KeyError):
                continue
    return None


def require_oauth_token() -> str:
    """Reference: Auto-Claude apps/backend/core/auth.py lines 782-831"""
    token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")
    if token and token.startswith("sk-ant-oat01-"):
        return token

    token = get_oauth_token_from_credential_store()
    if token:
        return token

    raise ValueError(
        "No OAuth token found.\n\n"
        "Claude Visual Generator requires Claude Pro/Max subscription.\n"
        "API keys (ANTHROPIC_API_KEY) are NOT supported.\n\n"
        "To authenticate:\n"
        "  1. Run: claude\n"
        "  2. Type: /login\n"
        "  3. Complete OAuth in browser\n"
    )


def configure_sdk_auth():
    """Reference: Auto-Claude apps/backend/core/auth.py lines 951-999"""
    token = require_oauth_token()
    os.environ["CLAUDE_CODE_OAUTH_TOKEN"] = token
```

## Session Configuration

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

client = ClaudeSDKClient(options=ClaudeAgentOptions(
    model="claude-sonnet-4-20250514",
    system_prompt=SYSTEM_PROMPT,
    cwd=str(workspace),
    max_turns=100,
    max_thinking_tokens=10000,  # Extended thinking for planning
    settings=str(security_settings_path),
))
```

Security settings (reference: Auto-Claude `apps/backend/core/client.py` lines 603-654):

```json
{
  "sandbox": {"enabled": true, "autoAllowBashIfSandboxed": true},
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Read(./**)", "Write(./**)", "Edit(./**)",
      "Glob(./**)", "Grep(./**)",
      "Bash(*)"
    ]
  }
}
```

## System Prompt

```python
SYSTEM_PROMPT = """
You are a Remotion video generator. You create animated educational videos from transcripts.

## WORKSPACE
- Working directory: {workspace_dir}
- Output: src/{project_id}/index.tsx (single file, all components)
- Constants: src/{project_id}/constants.ts (colors, timing)

## PROCESS
1. **THINK** (use extended thinking): Plan the visual story
   - Identify 4-6 key moments from transcript
   - Design metaphors (abstract concepts → visual representations)
   - Plan timing (frames) for each scene

2. **WRITE**: Create the Remotion composition
   - Write constants.ts first (COLORS, TIMING, SIZES)
   - Write index.tsx with all scenes

3. **VALIDATE**: Run TypeScript check
   - Execute: npx tsc --noEmit --pretty false
   - Fix any errors before finishing

## ANIMATION RULES (CRITICAL)
- Spring config: {damping: 22, stiffness: 90, mass: 0.9}
- Stagger elements by 6+ frames (never animate all at once)
- No Math.sin/cos on text positions
- Use interpolate() with extrapolateRight: 'clamp'

## CONSTRAINTS
- Single file output (no splitting into components/)
- {width}x{height} resolution, {fps} FPS, {duration_frames} total frames
- Must pass TypeScript validation before finishing
"""
```

## User Message

```python
USER_MESSAGE = """
## PROJECT: {project_id}

## VIDEO SPECS
- Resolution: {width}x{height}
- Duration: {duration_frames} frames ({duration_seconds}s)
- FPS: {fps}

## TRANSCRIPT
{transcript}

## YOUR TASK
Create a visually engaging Remotion video that explains this content.

Requirements:
1. Plan 4-6 scenes that build understanding progressively
2. Use visual metaphors (don't just show text)
3. Include smooth animations with proper spring physics
4. Ensure all elements are readable at {width}x{height}

Output files:
- src/{project_id}/constants.ts
- src/{project_id}/index.tsx

When TypeScript validation passes, call finish with a summary.
"""
```

## Generator Implementation

```python
class ClaudeVisualGenerator:
    def __init__(
        self,
        workspace: Path,
        project_id: str,
        bundle_output: Path
    ):
        self.workspace = workspace
        self.project_id = project_id
        self.src_dir = workspace / "src" / project_id
        self.bundle_output = bundle_output
        configure_sdk_auth()

    async def generate(
        self,
        transcript: str,
        width: int,
        height: int,
        duration_frames: int,
        fps: int = 30,
        timeout_seconds: int = 300,
        max_retries: int = 2,
    ) -> dict:
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                # Clean previous
                if self.src_dir.exists():
                    shutil.rmtree(self.src_dir)
                self.src_dir.mkdir(parents=True)

                # Run Claude Code
                client = ClaudeSDKClient(options=ClaudeAgentOptions(
                    model="claude-sonnet-4-20250514",
                    system_prompt=self._build_system_prompt(width, height, fps),
                    cwd=str(self.workspace),
                    max_turns=100,
                    max_thinking_tokens=10000,
                    settings=str(self._write_security_settings()),
                ))

                await client.run(self._build_user_message(...))

                # Verify output
                if not (self.src_dir / "index.tsx").exists():
                    raise ValidationError("index.tsx not found")

                if not await self._verify_typescript():
                    raise ValidationError("TypeScript failed")

                # Bundle
                await self._run_bundle()

                return {
                    "success": True,
                    "bundleUrl": f"/bundles/{self.project_id}/index.html",
                }

            except AuthenticationError:
                raise  # Don't retry auth errors
            except Exception as e:
                last_error = e
                continue

        raise GenerationError(f"Failed after {max_retries + 1} attempts: {last_error}")
```

## Files to Create

| File | Purpose |
|------|---------|
| `packages/worker/src/agents/claude_visual_generator.py` | Main generator |
| `packages/worker/src/workspace.ts` | Workspace management |
| `packages/worker/remotion-template/` | Base Remotion project |
| `packages/worker/requirements.txt` | Python dependencies |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/worker/src/config.ts` | Add workerId, workspace config |
| `packages/worker/src/index.ts` | Add workspace init on startup |
| `packages/worker/src/processors/generate-visuals.ts` | Replace OpenHands call |

## Files to Delete

| File | Reason |
|------|--------|
| `docker/openhands-sandbox/` | No longer needed |
| `packages/worker/src/agents/visual_generator.py` | Old OpenHands version |

## Migration Plan

### Phase 1: Setup
- Create remotion-template/ with base Remotion project
- Create requirements.txt with claude-agent-sdk
- Add worker config (WORKER_ID, WORKSPACE_PATH)

### Phase 2: Build New Generator
- Create claude_visual_generator.py
- Test OAuth token reading
- Test Claude SDK client creation

### Phase 3: Integrate with Worker
- Modify index.ts for workspace init
- Modify generate-visuals.ts to use new generator
- Test end-to-end

### Phase 4: Verify & Cleanup
- Run multiple jobs
- Test error handling
- Delete old OpenHands code

### Rollback Plan

Feature flag for safe rollback:

```typescript
const useClaudeGenerator = process.env.USE_CLAUDE_GENERATOR === 'true';

if (useClaudeGenerator) {
  result = await claudeGenerator.generate(...);
} else {
  result = await runOpenHandsAgent(...);
}
```

## Cost Comparison

| Approach | Cost |
|----------|------|
| OpenHands + OpenRouter | ~$0.10-0.50 per generation |
| Claude Code + OAuth | $0 (included in subscription) |

## Key References

All authentication code references Auto-Claude:
- `apps/backend/core/auth.py` lines 476-530 (credential store)
- `apps/backend/core/auth.py` lines 782-831 (require token)
- `apps/backend/core/auth.py` lines 951-999 (configure SDK)
- `apps/backend/core/client.py` lines 603-654 (security settings)
- `apps/backend/core/client.py` lines 444-837 (ClaudeAgentOptions)
