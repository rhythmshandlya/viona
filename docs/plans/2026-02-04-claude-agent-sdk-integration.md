# Claude Agent SDK Integration Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the real `claude-agent-sdk` Python package (Auto-Claude style) for visual generation.

**Architecture:** Use OAuth authentication, streaming responses, security hooks, and file checkpointing for production-grade visual generation.

**Tech Stack:** Python 3.10+, claude-agent-sdk, Remotion, TypeScript

---

## Overview

Replace the stub `claude_agent_sdk.py` with the real package, following Auto-Claude's battle-tested patterns for:
- OAuth authentication from Claude Code credentials
- Extended thinking for visual planning
- Security hooks to restrict Bash commands
- File checkpointing for recovery
- Streaming response display

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Setup Script (setup_claude_auth.py)                          │
│    - Check for existing OAuth token                             │
│    - Launch Claude CLI for /login if needed                     │
│    - Validate token after login                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Authentication Layer                                         │
│    - Read ~/.claude/.credentials.json                           │
│    - Fall back to CLAUDE_CODE_OAUTH_TOKEN env var               │
│    - Set token in environment for SDK                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Client Layer (ClaudeSDKClient + ClaudeAgentOptions)          │
│    - model: claude-sonnet-4-20250514                            │
│    - max_thinking_tokens: 16384                                 │
│    - max_buffer_size: 10MB                                      │
│    - enable_file_checkpointing: true                            │
│    - PreToolUse hook for Bash security                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Execution Layer                                              │
│    - client.query(message) to send                              │
│    - async for msg in client.receive_response() to stream       │
│    - Exponential backoff retry (2s, 4s, 8s)                     │
│    - Output verification + TypeScript check + Bundle            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Task 1: Create Setup Script

**File:** `packages/worker/src/agents/setup_claude_auth.py`

**Purpose:** Check for OAuth token, launch Claude CLI login if needed.

```python
#!/usr/bin/env python3
"""Claude Code Authentication Setup"""

import json
import os
import subprocess
import sys
from pathlib import Path


def get_credential_paths() -> list[Path]:
    """Get possible credential file locations."""
    paths = []
    if sys.platform == "win32":
        paths.extend([
            Path(os.path.expandvars(r"%USERPROFILE%\.claude\.credentials.json")),
            Path(os.path.expandvars(r"%USERPROFILE%\.claude\credentials.json")),
        ])
    home = Path.home()
    paths.extend([
        home / ".claude" / ".credentials.json",
        home / ".claude" / "credentials.json",
    ])
    return paths


def get_existing_token() -> str | None:
    """Check for existing valid OAuth token."""
    env_token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "")
    if env_token.startswith("sk-ant-oat01-"):
        return env_token

    for cred_path in get_credential_paths():
        if cred_path.exists():
            try:
                data = json.loads(cred_path.read_text())
                token = data.get("claudeAiOauth", {}).get("accessToken", "")
                if token.startswith("sk-ant-oat01-"):
                    return token
            except (json.JSONDecodeError, KeyError):
                continue
    return None


def launch_claude_login() -> bool:
    """Launch Claude CLI for interactive login."""
    print("\n" + "=" * 60)
    print("CLAUDE CODE AUTHENTICATION SETUP")
    print("=" * 60)
    print("\nNo valid OAuth token found.")
    print("\nThis will launch Claude Code CLI.")
    print("Once it starts, type: /login")
    print("Then complete OAuth in your browser.\n")
    print("Press Enter to continue (or Ctrl+C to cancel)...")

    try:
        input()
    except KeyboardInterrupt:
        print("\nCancelled.")
        return False

    try:
        result = subprocess.run(["claude"], shell=True)
        return result.returncode == 0
    except FileNotFoundError:
        print("\nError: Claude Code CLI not found.")
        return False


def main() -> int:
    token = get_existing_token()
    if token:
        print("✓ Valid OAuth token found")
        return 0

    if not launch_claude_login():
        return 1

    token = get_existing_token()
    if token:
        print("\n✓ Authentication successful!")
        return 0
    else:
        print("\n✗ Authentication failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
```

---

## Task 2: Update package.json

**File:** `packages/worker/package.json`

**Add script:**

```json
{
  "scripts": {
    "setup:auth": "python src/agents/setup_claude_auth.py"
  }
}
```

---

## Task 3: Rewrite Visual Generator

**File:** `packages/worker/src/agents/claude_visual_generator.py`

### 3.1: Imports and Security Hook

```python
#!/usr/bin/env python3
"""
Claude Code Visual Generator (Auto-Claude Style)

Uses real claude-agent-sdk with OAuth authentication.
"""

import asyncio
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from claude_agent_sdk.types import HookMatcher


async def bash_security_hook(
    input_data: dict,
    tool_use_id: str | None = None,
    context: Any = None,
) -> dict:
    """Only allow npm/npx commands."""
    if input_data.get("tool_name") != "Bash":
        return {}

    command = input_data.get("tool_input", {}).get("command", "")
    ALLOWED = ["npm ", "npx ", "npm.cmd ", "npx.cmd "]

    if any(command.strip().startswith(prefix) for prefix in ALLOWED):
        return {}

    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"Only npm/npx allowed. Got: {command[:50]}..."
        }
    }
```

### 3.2: Authentication

```python
def get_oauth_token() -> str | None:
    """Get OAuth token from credentials or environment."""
    env_token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "")
    if env_token.startswith("sk-ant-oat01-"):
        return env_token

    cred_paths = [
        Path.home() / ".claude" / ".credentials.json",
        Path.home() / ".claude" / "credentials.json",
    ]
    if sys.platform == "win32":
        cred_paths = [
            Path(os.path.expandvars(r"%USERPROFILE%\.claude\.credentials.json")),
            Path(os.path.expandvars(r"%USERPROFILE%\.claude\credentials.json")),
        ] + cred_paths

    for cred_path in cred_paths:
        if cred_path.exists():
            try:
                data = json.loads(cred_path.read_text())
                token = data.get("claudeAiOauth", {}).get("accessToken", "")
                if token.startswith("sk-ant-oat01-"):
                    return token
            except:
                continue
    return None


def configure_sdk_auth() -> None:
    """Configure environment for SDK authentication."""
    token = get_oauth_token()
    if not token:
        raise ValueError(
            "No OAuth token found.\n"
            "Run: python setup_claude_auth.py"
        )
    os.environ["CLAUDE_CODE_OAUTH_TOKEN"] = token
```

### 3.3: Security Settings

```python
def create_security_settings(workspace: str) -> dict:
    """Create security settings for the visual generator."""
    return {
        "sandbox": {
            "enabled": True,
            "autoAllowBashIfSandboxed": True,
        },
        "permissions": {
            "defaultMode": "acceptEdits",
            "allow": [
                "Read(./**)", "Write(./**)", "Edit(./**)",
                "Glob(./**)", "Grep(./**)",
                f"Read({workspace}/**)", f"Write({workspace}/**)",
                f"Edit({workspace}/**)", f"Glob({workspace}/**)",
                f"Grep({workspace}/**)",
                "Bash(*)",
            ],
        },
    }
```

### 3.4: Client Creation

```python
def create_visual_generator_client(
    workspace: Path,
    system_prompt: str,
    settings_path: Path,
    model: str = "claude-sonnet-4-20250514",
    max_turns: int = 50,
    max_thinking_tokens: int = 16384,
) -> ClaudeSDKClient:
    """Create Claude SDK client with Auto-Claude style configuration."""
    return ClaudeSDKClient(
        options=ClaudeAgentOptions(
            model=model,
            system_prompt=system_prompt,
            cwd=str(workspace),
            settings=str(settings_path),
            max_turns=max_turns,
            max_thinking_tokens=max_thinking_tokens,
            max_buffer_size=10 * 1024 * 1024,  # 10MB
            enable_file_checkpointing=True,
            allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
            hooks={
                "PreToolUse": [
                    HookMatcher(matcher="Bash", hooks=[bash_security_hook]),
                ],
            },
        )
    )
```

### 3.5: Execution with Streaming

```python
async def run_visual_generation(
    client: ClaudeSDKClient,
    user_message: str,
    workspace: Path,
    max_retries: int = 3,
) -> dict:
    """Run visual generation with streaming and retry."""
    RETRY_DELAYS = [2, 4, 8]

    for attempt in range(max_retries):
        try:
            print(f"\n[Attempt {attempt + 1}/{max_retries}] Sending query...")
            await client.query(user_message)

            response_text = ""
            tool_calls = []

            async for msg in client.receive_response():
                msg_type = type(msg).__name__

                if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__

                        if block_type == "TextBlock" and hasattr(block, "text"):
                            response_text += block.text
                            print(block.text, end="", flush=True)

                        elif block_type == "ToolUseBlock":
                            tool_calls.append({"name": block.name})
                            print(f"\n[Tool: {block.name}]", flush=True)

            print("\n")
            return {
                "success": True,
                "response_text": response_text,
                "tool_calls": tool_calls,
                "error": None,
                "attempts": attempt + 1,
            }

        except Exception as e:
            error_str = str(e).lower()
            is_concurrency = "400" in error_str and "concurren" in error_str

            if is_concurrency and attempt < max_retries - 1:
                delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                print(f"\n[Concurrency error, retrying in {delay}s...]")
                await asyncio.sleep(delay)
                continue

            return {
                "success": False,
                "response_text": "",
                "tool_calls": [],
                "error": str(e),
                "attempts": attempt + 1,
            }

    return {"success": False, "error": "Max retries exceeded", "attempts": max_retries}
```

### 3.6: Main Generator Class

```python
class ClaudeVisualGenerator:
    """Visual generator using Claude Agent SDK."""

    def __init__(
        self,
        workspace: Path,
        project_id: str,
        bundle_output: Path,
        model: str = "claude-sonnet-4-20250514",
        max_turns: int = 50,
        max_thinking_tokens: int = 16384,
    ):
        self.workspace = workspace
        self.project_id = project_id
        self.src_dir = workspace / "src" / project_id
        self.bundle_output = bundle_output
        self.model = model
        self.max_turns = max_turns
        self.max_thinking_tokens = max_thinking_tokens

        configure_sdk_auth()

    async def generate(
        self,
        transcript: str,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
    ) -> dict:
        """Generate Remotion composition from transcript."""

        # 1. Setup
        if self.src_dir.exists():
            shutil.rmtree(self.src_dir)
        self.src_dir.mkdir(parents=True)

        # 2. Write security settings
        settings_path = self.workspace / ".claude_settings.json"
        settings = create_security_settings(str(self.workspace))
        settings_path.write_text(json.dumps(settings, indent=2))

        # 3. Build prompts (use existing _build_system_prompt, _build_user_message)
        system_prompt = self._build_system_prompt(width, height, fps, duration_frames)
        user_message = self._build_user_message(transcript, width, height, duration_frames, fps)

        # 4. Create client
        print(f"[Generator] Model: {self.model}")
        print(f"[Generator] Workspace: {self.workspace}")

        client = create_visual_generator_client(
            workspace=self.workspace,
            system_prompt=system_prompt,
            settings_path=settings_path,
            model=self.model,
            max_turns=self.max_turns,
            max_thinking_tokens=self.max_thinking_tokens,
        )

        # 5. Run generation
        result = await run_visual_generation(client, user_message, self.src_dir)

        if not result["success"]:
            raise RuntimeError(f"Generation failed: {result['error']}")

        # 6. Verify TypeScript
        if not await self._verify_typescript():
            raise RuntimeError("TypeScript compilation failed")

        # 7. Bundle for frontend
        bundle_path = await self._run_bundle()

        return {
            "success": True,
            "bundleUrl": f"/bundles/{self.project_id}/index.html",
            "bundlePath": str(bundle_path),
            "attempts": result["attempts"],
        }

    async def _run_bundle(self) -> Path:
        """Bundle the Remotion project for frontend."""
        bundle_path = self.bundle_output / self.project_id
        bundle_path.mkdir(parents=True, exist_ok=True)

        result = subprocess.run(
            ["npx", "remotion", "bundle", "--out-dir", str(bundle_path)],
            cwd=str(self.workspace),
            capture_output=True,
            text=True,
            timeout=300,
            shell=True,
        )

        if result.returncode != 0:
            raise RuntimeError(f"Bundle failed: {result.stderr}")

        index_html = bundle_path / "index.html"
        if not index_html.exists():
            raise RuntimeError(f"Bundle missing index.html")

        return bundle_path
```

---

## Task 4: Delete Stub Module

**Delete:** `packages/worker/src/agents/claude_agent_sdk.py`

This stub was a workaround. Now using the real package.

---

## Task 5: Update Environment Validation

**File:** `packages/worker/src/processors/generate-visuals.ts`

Already updated to check for Claude CLI instead of stub module.

---

## Task 6: Update Tests

**Files:**
- `packages/worker/src/agents/test_claude_visual_generator.py`
- `packages/worker/src/agents/test_e2e.py`

Update to test new patterns:
- Security hook allows npm/npx
- Security hook blocks dangerous commands
- Client creation with real SDK
- Streaming response handling

---

## Workspace Architecture

```
remotion-template/          ← Source template (read-only)
├── package.json
├── tsconfig.json
├── .claude/skills/         ← AI agent skills
└── src/

workspace/                  ← Active working directory
├── package.json            ← Copied from template
├── node_modules/           ← Installed once, reused
├── .claude_settings.json   ← Written per job
└── src/
    └── {project_id}/       ← Generated code per project
        ├── constants.ts
        └── index.tsx

bundles/                    ← Output for frontend
└── {project_id}/
    ├── index.html          ← Remotion Player entry
    └── bundle.js
```

---

## Verification Checklist

- [ ] Setup script authenticates successfully
- [ ] OAuth token read from credentials file
- [ ] Security hook blocks `rm -rf /`
- [ ] Security hook allows `npm run build`
- [ ] Streaming shows tool calls in real-time
- [ ] Retry works on concurrency errors
- [ ] TypeScript validation catches errors
- [ ] Bundle creates index.html
- [ ] Frontend can load /bundles/{id}/index.html
