# Visual Generator Refactor Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Break `claude_visual_generator.py` (4,622 lines) into focused, readable modules under `packages/worker/src/agents/`.

**Architecture:** Extract infrastructure code into standalone modules. Keep `ClaudeVisualGenerator` class as the core, importing from helpers. Delete dead legacy code. No behavior changes — pure refactor.

**Tech Stack:** Python 3.11+, Claude Agent SDK, httpx

**Constraint:** TypeScript spawns `claude_visual_generator.py` as a subprocess via absolute path. The file must remain the CLI entry point. Extracted modules are imported from it.

---

## Current State (4,622 lines)

```
claude_visual_generator.py
├── SDK monkey-patches (lines 51-157)          ~107 lines
├── Utilities (safe_print, emit_progress)       ~25 lines
├── CLI path discovery (get_claude_cli_path)     ~73 lines
├── MCP server config                           ~100 lines
├── Bash security hook                          ~72 lines
├── OAuth token management                      ~460 lines  ← 7 dead legacy functions
├── Skills directive                             ~25 lines
├── Security settings                            ~30 lines
├── ClaudeVisualGenerator class                ~3,370 lines
└── CLI main() entry point                      ~360 lines
```

## Target State

```
packages/worker/src/agents/
├── claude_visual_generator.py    ~3,500 lines  (class + main + imports)
├── oauth.py                        ~270 lines  (token management, dead code deleted)
├── sdk_config.py                   ~280 lines  (MCP, security, CLI path, patches, skills)
├── transcript_formatter.py           (unchanged)
└── __pycache__/
```

Two new files. Dead code deleted. No `__init__.py` needed (not used as a package — only subprocess invocation).

---

### Task 1: Delete dead legacy OAuth functions

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

These 7 functions are defined but never called from anywhere in the codebase:

```python
# DELETE all of these (lines 745-816):
get_credential_file_path()
get_oauth_credentials()
get_oauth_token_from_credential_store()
check_token_validity()
async_require_oauth_token()
require_oauth_token()
configure_sdk_auth()
configure_sdk_auth_async()
```

Also delete the `# Legacy functions for backwards compatibility` comment.

**Verify:** `grep -rn "require_oauth_token\|configure_sdk_auth\|check_token_validity\|get_oauth_credentials\|get_credential_file_path" packages/worker/src/` should only show the definitions (which you're deleting).

---

### Task 2: Extract `oauth.py`

**Files:**
- Create: `packages/worker/src/agents/oauth.py`
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

Move these to `oauth.py`:
- `OAuthTokens` dataclass (lines 358-407)
- `TokenStorage` abstract class (lines 410-419)
- `FileTokenStorage` class (lines 422-478)
- `DatabaseTokenStorage` class (lines 481-515)
- `EnvTokenStorage` class (lines 518-552)
- `_get_default_storage()` function (lines 555-562)
- `OAuthTokenManager` class (lines 565-735)
- `get_token_manager()` function (lines 737-742)

`oauth.py` header:

```python
"""OAuth token management for Claude Agent SDK authentication."""

import asyncio
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
```

In `claude_visual_generator.py`, replace the entire OAuth section with:

```python
from oauth import get_token_manager
```

**Verify:** Run `python -c "import sys; sys.path.insert(0, 'packages/worker/src/agents'); from oauth import get_token_manager; print('OK')"` from repo root.

---

### Task 3: Extract `sdk_config.py`

**Files:**
- Create: `packages/worker/src/agents/sdk_config.py`
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

Move these to `sdk_config.py`:

1. **SDK monkey-patches** (lines 51-157) — `_patched_parse_message`, `_patched_receive_messages`, and the try/except import block that applies them
2. **`safe_print()`** and **`emit_progress()`** (lines 158-178)
3. **`get_claude_cli_path()`** + module-level `CLAUDE_CLI_PATH` assignment (lines 181-228)
4. **MCP config**: `build_mcp_servers()`, `validate_mcp_servers()` + module-level validation call (lines 230-278)
5. **Bash security**: `is_safe_npm_command()`, `bash_security_hook()` (lines 281-334)
6. **`get_skills_directive()`** (lines 824-839)
7. **`create_security_settings()`** (lines 851-878)

`sdk_config.py` header:

```python
"""SDK configuration, MCP servers, security hooks, and CLI utilities."""

import json
import os
import platform
import re
import shutil
import sys
from pathlib import Path
from typing import Any
```

Exports from `sdk_config.py`:

```python
# Module-level constants (computed on import)
CLAUDE_CLI_PATH = get_claude_cli_path()

# Functions used by ClaudeVisualGenerator
__all__ = [
    "CLAUDE_CLI_PATH",
    "safe_print",
    "emit_progress",
    "build_mcp_servers",
    "bash_security_hook",
    "is_safe_npm_command",
    "get_skills_directive",
    "create_security_settings",
]
```

In `claude_visual_generator.py`, replace all extracted sections with:

```python
from sdk_config import (
    CLAUDE_CLI_PATH,
    safe_print,
    emit_progress,
    build_mcp_servers,
    bash_security_hook,
    get_skills_directive,
    create_security_settings,
)
```

**Important:** The SDK monkey-patches must run at import time (top of `sdk_config.py`), and `sdk_config` must be imported before any SDK usage. Since `claude_visual_generator.py` imports it at the top, this is satisfied.

**Important:** `validate_mcp_servers()` runs at module load in the current code. Keep that behavior — call it at the bottom of `sdk_config.py` module scope.

**Verify:** Run `python -c "import sys; sys.path.insert(0, 'packages/worker/src/agents'); from sdk_config import CLAUDE_CLI_PATH, emit_progress, build_mcp_servers; print('CLI:', CLAUDE_CLI_PATH)"` from repo root.

---

### Task 4: Update `claude_visual_generator.py` imports and verify

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

After Tasks 1-3, the top of `claude_visual_generator.py` should look like:

```python
"""
Claude Visual Generator — orchestrates the visual generation pipeline.

Phases:
  0. Assistant Director → CREATIVE_BRIEF.md
  1. Director → SCENE_PLAN.md + scenes.json
  2. Animator (sequential) → Scene*.tsx files
  2e. Visual verification → screenshot review + fixes
  3. Bundle → Remotion bundle + CJS compilation
"""

import asyncio
import json
import math
import os
import re
import shutil
import sys
import time
from pathlib import Path
from typing import Any

from oauth import get_token_manager
from sdk_config import (
    CLAUDE_CLI_PATH,
    safe_print,
    emit_progress,
    build_mcp_servers,
    bash_security_hook,
    get_skills_directive,
    create_security_settings,
)

try:
    from claude_agent_sdk import (
        ClaudeSDKClient,
        ClaudeAgentOptions,
        HookMatcher,
    )
    from claude_agent_sdk._internal.transport import SubprocessCLITransport
except ImportError:
    print("[ClaudeGenerator] WARNING: claude_agent_sdk not available")
```

Remove all the old sections that were extracted. The file should now contain only:
- Imports (as above)
- `ClaudeVisualGenerator` class
- `main()` async function
- `if __name__ == "__main__":` block

**Verify:**
1. Run `python packages/worker/src/agents/claude_visual_generator.py --help` — should print argparse help
2. Run `python scripts/temp/test-prompts.py` — should pass all checks
3. Grep for any broken references: `grep -n "CLAUDE_CLI_PATH\|emit_progress\|safe_print\|get_token_manager\|build_mcp_servers\|bash_security_hook\|get_skills_directive\|create_security_settings" packages/worker/src/agents/claude_visual_generator.py` — all should be usage sites, not definitions

---

## Summary

| Metric | Before | After |
|---|---|---|
| `claude_visual_generator.py` | 4,622 lines | ~3,500 lines |
| `oauth.py` | — | ~270 lines |
| `sdk_config.py` | — | ~280 lines |
| Dead code | ~75 lines | 0 |
| Total lines | 4,622 | ~4,050 |
| Files | 1 | 3 |

Net reduction: ~570 lines deleted (dead code + duplicate comments/headers). Each file has a single responsibility.
