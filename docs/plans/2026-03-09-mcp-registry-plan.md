# MCP Server Registry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make MCP servers JSON-driven and extensible — adding a new server requires only a JSON entry and optionally a TypeScript file, with zero Python changes.

**Architecture:** A `mcp-servers.json` registry file at `packages/mcp-servers/` describes all servers with template variables. A Python loader (`registry.py`) reads the JSON, resolves variables, and returns the Claude CLI config dict. Shared TypeScript utilities DRY up common patterns in custom servers.

**Tech Stack:** JSON Schema, Python 3, TypeScript

---

## Context

### Current state (after the revamp we just completed)

MCP servers are a proper TypeScript package at `packages/mcp-servers/` with two custom servers (`asset-server.ts`, `viewport-server.ts`) built with `tsc`. Two external servers (`freepik` via mcp-remote, `better-icons` via npm) are configured alongside them.

All 4 servers are hardcoded in `packages/worker/src/agents/claude_visual_generator.py`:
- `build_mcp_servers()` (~line 241) — builds the config dict with hardcoded paths
- `validate_mcp_servers()` (~line 286) — checks files exist with hardcoded paths

### What we're building

A JSON registry that replaces the hardcoded Python config. Template variables (`{dist}`, `{workspace}`, `{env.VAR}`) get resolved at runtime by a Python loader.

### Key file paths
- Registry: `packages/mcp-servers/mcp-servers.json`
- Schema: `packages/mcp-servers/mcp-servers.schema.json`
- Python loader: `packages/mcp-servers/registry.py`
- Shared TS utils: `packages/mcp-servers/src/lib/parse-args.ts`, `packages/mcp-servers/src/lib/errors.ts`
- Python agent: `packages/worker/src/agents/claude_visual_generator.py`
- Existing servers: `packages/mcp-servers/src/asset-server.ts`, `packages/mcp-servers/src/viewport-server.ts`

---

### Task 1: Create shared TypeScript utilities

**Files:**
- Create: `packages/mcp-servers/src/lib/parse-args.ts`
- Create: `packages/mcp-servers/src/lib/errors.ts`

**Step 1: Create `packages/mcp-servers/src/lib/parse-args.ts`**

```typescript
/**
 * Parse --workspace argument from process.argv.
 * Falls back to process.cwd() if not provided.
 */
export function parseWorkspace(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--workspace");
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : process.cwd();
}
```

**Step 2: Create `packages/mcp-servers/src/lib/errors.ts`**

```typescript
/**
 * Safely extract an error message from an unknown catch value.
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
```

**Step 3: Verify it compiles**

Run: `cd packages/mcp-servers && pnpm build`
Expected: No errors. `dist/lib/parse-args.js` and `dist/lib/errors.js` produced.

**Step 4: Commit**

```bash
git add packages/mcp-servers/src/lib/
git commit -m "feat(mcp-servers): add shared utility modules"
```

---

### Task 2: Refactor servers to use shared utilities

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts`
- Modify: `packages/mcp-servers/src/viewport-server.ts`

**Step 1: Update `asset-server.ts`**

At the top, add import:
```typescript
import { parseWorkspace } from "./lib/parse-args.js";
import { errorMessage } from "./lib/errors.js";
```

Replace the workspace arg parsing block (lines ~73-76):
```typescript
// OLD:
const args = process.argv.slice(2);
const wsIdx = args.indexOf("--workspace");
const WORKSPACE =
  wsIdx !== -1 && args[wsIdx + 1] ? args[wsIdx + 1] : process.cwd();

// NEW:
const WORKSPACE = parseWorkspace();
```

Remove the local `errorMessage` function definition (find it with `function errorMessage` — it's already imported).

**Step 2: Update `viewport-server.ts`**

Same changes — add imports, replace workspace parsing block, remove local `errorMessage`.

**Step 3: Verify it compiles and servers still start**

Run: `cd packages/mcp-servers && pnpm build`
Expected: No errors.

Test asset-server:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | timeout 5 node packages/mcp-servers/dist/asset-server.js --workspace /tmp/test 2>/dev/null
```
Expected: JSON-RPC response with capabilities.

Test viewport-server similarly.

**Step 4: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts packages/mcp-servers/src/viewport-server.ts
git commit -m "refactor(mcp-servers): use shared lib utilities"
```

---

### Task 3: Create the JSON Schema

**Files:**
- Create: `packages/mcp-servers/mcp-servers.schema.json`

**Step 1: Create `packages/mcp-servers/mcp-servers.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "mcp-servers.schema.json",
  "title": "MCP Server Registry",
  "description": "Registry of MCP servers available to the visual generation agent. Template variables use {name} syntax for path/runtime variables and {env.VAR} for environment variable references.",
  "type": "object",
  "required": ["servers"],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "variables": {
      "type": "object",
      "description": "Documentation of available template variables. Keys are variable names, values are human-readable descriptions.",
      "additionalProperties": {
        "type": "string"
      }
    },
    "servers": {
      "type": "object",
      "description": "Map of server name to server configuration.",
      "additionalProperties": {
        "$ref": "#/$defs/server"
      }
    }
  },
  "$defs": {
    "server": {
      "type": "object",
      "required": ["description", "type", "command", "args"],
      "additionalProperties": false,
      "properties": {
        "description": {
          "type": "string",
          "description": "Human-readable description of what this server provides."
        },
        "type": {
          "type": "string",
          "enum": ["stdio"],
          "description": "Transport type. Currently only stdio is supported."
        },
        "command": {
          "type": "string",
          "description": "Executable command to run (e.g. 'node')."
        },
        "args": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Command arguments. May contain {variable} templates resolved at runtime."
        },
        "env": {
          "type": "object",
          "description": "Environment variables to pass to the server process.",
          "additionalProperties": {
            "$ref": "#/$defs/envVar"
          }
        }
      }
    },
    "envVar": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "isRequired": {
          "type": "boolean",
          "description": "Whether this variable must be set. Default false."
        },
        "isSecret": {
          "type": "boolean",
          "description": "Whether this variable contains sensitive data (API keys, tokens). Default false."
        }
      }
    }
  }
}
```

**Step 2: Commit**

```bash
git add packages/mcp-servers/mcp-servers.schema.json
git commit -m "feat(mcp-servers): add JSON Schema for registry"
```

---

### Task 4: Create the registry JSON

**Files:**
- Create: `packages/mcp-servers/mcp-servers.json`

**Step 1: Create `packages/mcp-servers/mcp-servers.json`**

```json
{
  "$schema": "./mcp-servers.schema.json",
  "variables": {
    "dist": "Resolved path to packages/mcp-servers/dist/",
    "workspace": "Remotion workspace path (passed at runtime per job)",
    "mcp-remote": "Path to mcp-remote proxy.js entry point",
    "better-icons": "Path to better-icons index.js entry point"
  },
  "servers": {
    "assets": {
      "description": "Download files, search stock photos, read speaker grid for overlay placement",
      "type": "stdio",
      "command": "node",
      "args": ["{dist}/asset-server.js", "--workspace", "{workspace}"],
      "env": {
        "UNSPLASH_ACCESS_KEY": { "isRequired": false, "isSecret": true },
        "PEXELS_API_KEY": { "isRequired": false, "isSecret": true }
      }
    },
    "viewport": {
      "description": "Read scene dimensions from scenes.json, validate scene code against spec",
      "type": "stdio",
      "command": "node",
      "args": ["{dist}/viewport-server.js", "--workspace", "{workspace}"],
      "env": {}
    },
    "freepik": {
      "description": "Freepik image generation and stock asset search via MCP remote proxy",
      "type": "stdio",
      "command": "node",
      "args": ["{mcp-remote}", "https://api.freepik.com/mcp", "--header", "x-freepik-api-key:{env.FREEPIK_API_KEY}"],
      "env": {
        "FREEPIK_API_KEY": { "isRequired": false, "isSecret": true }
      }
    },
    "better-icons": {
      "description": "Search and retrieve icons from 200+ icon libraries via Iconify",
      "type": "stdio",
      "command": "node",
      "args": ["{better-icons}"],
      "env": {}
    }
  }
}
```

**Step 2: Commit**

```bash
git add packages/mcp-servers/mcp-servers.json
git commit -m "feat(mcp-servers): add server registry JSON"
```

---

### Task 5: Create the Python registry loader

**Files:**
- Create: `packages/mcp-servers/registry.py`

**Step 1: Create `packages/mcp-servers/registry.py`**

```python
"""
MCP Server Registry Loader

Reads mcp-servers.json registry file and resolves template variables
to produce a Claude CLI --mcp-config compatible dict.

Template variable syntax:
  {name}     - Resolved from the `variables` dict passed to load/validate
  {env.VAR}  - Resolved from os.environ at runtime
"""

import json
import os
import re
from pathlib import Path
from typing import Any


_REGISTRY_PATH = Path(__file__).parent / "mcp-servers.json"

# Matches {varName} or {env.VAR_NAME} in template strings
_VAR_PATTERN = re.compile(r"\{([^}]+)\}")


def _resolve_template(template: str, variables: dict[str, str]) -> str:
    """Resolve all {name} and {env.VAR} placeholders in a template string."""

    def replacer(match: re.Match) -> str:
        key = match.group(1)
        if key.startswith("env."):
            env_name = key[4:]
            return os.environ.get(env_name, "")
        if key in variables:
            return variables[key]
        raise ValueError(
            f"Unknown template variable '{{{key}}}' in MCP registry. "
            f"Available variables: {list(variables.keys())}"
        )

    return _VAR_PATTERN.sub(replacer, template)


def _resolve_env(
    env_decls: dict[str, Any],
) -> dict[str, str]:
    """Resolve environment variable declarations to actual values from os.environ."""
    resolved: dict[str, str] = {}
    for name, decl in env_decls.items():
        value = os.environ.get(name, "")
        if not value and decl.get("isRequired"):
            raise EnvironmentError(
                f"Required environment variable '{name}' is not set. "
                f"This MCP server needs it to function."
            )
        resolved[name] = value
    return resolved


def load_mcp_registry(variables: dict[str, str]) -> dict[str, Any]:
    """Load the MCP server registry and resolve all template variables.

    Args:
        variables: Template variable bindings. Must include all non-env
                   variables declared in the registry (e.g. dist, workspace,
                   mcp-remote, better-icons).

    Returns:
        Dict compatible with Claude CLI --mcp-config format:
        {
            "server-name": {
                "type": "stdio",
                "command": "node",
                "args": ["/resolved/path", ...],
                "env": {"KEY": "value"}
            }
        }
    """
    registry = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
    servers = registry.get("servers", {})
    result: dict[str, Any] = {}

    for name, config in servers.items():
        resolved_args = [
            _resolve_template(arg, variables) for arg in config["args"]
        ]
        resolved_env = _resolve_env(config.get("env", {}))

        entry: dict[str, Any] = {
            "type": config["type"],
            "command": config["command"],
            "args": resolved_args,
        }
        if resolved_env:
            entry["env"] = resolved_env

        result[name] = entry

    return result


def validate_mcp_registry(variables: dict[str, str]) -> None:
    """Validate that all MCP server entry-points exist on disk.

    Call at worker startup with path variables only (no runtime vars
    like 'workspace'). Skips args that contain unresolved variables.

    Raises FileNotFoundError if a required file is missing.
    """
    registry = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
    servers = registry.get("servers", {})
    missing: list[str] = []

    for name, config in servers.items():
        for arg in config["args"]:
            # Skip args with unresolved variables (runtime-only like {workspace})
            try:
                resolved = _resolve_template(arg, variables)
            except ValueError:
                continue

            # Check if the resolved arg looks like a file path
            if resolved.endswith(".js") or resolved.endswith(".py"):
                if not Path(resolved).exists():
                    missing.append(f"  {name}: {resolved}")

    if missing:
        raise FileNotFoundError(
            "MCP server files missing — run `pnpm install && pnpm build:mcp-servers`:\n"
            + "\n".join(missing)
        )
```

**Step 2: Test the loader manually**

Run from the repo root:
```bash
python -c "
import sys; sys.path.insert(0, '.')
from packages.mcp_servers.registry import load_mcp_registry
result = load_mcp_registry({
    'dist': 'packages/mcp-servers/dist',
    'workspace': '/tmp/test',
    'mcp-remote': 'node_modules/mcp-remote/dist/proxy.js',
    'better-icons': 'node_modules/better-icons/dist/index.js',
})
import json; print(json.dumps(result, indent=2))
"
```
Expected: JSON output with all 4 servers, resolved paths, no errors.

Note: The import path uses `packages.mcp_servers.registry` — Python treats the directory name `mcp-servers` with a hyphen as needing special import. The actual import in the Python agent will use a direct path-based approach (see Task 6).

**Step 3: Commit**

```bash
git add packages/mcp-servers/registry.py
git commit -m "feat(mcp-servers): add Python registry loader"
```

---

### Task 6: Wire up the Python agent to use the registry

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py` (~lines 224-310)

**Step 1: Add registry import**

Near the top of the file (after the existing `from pathlib import Path` import on line 19), add:

```python
# Add packages/mcp-servers to Python path so we can import registry
_MCP_SERVERS_PKG = Path(__file__).resolve().parent.parent.parent.parent / "packages" / "mcp-servers"
sys.path.insert(0, str(_MCP_SERVERS_PKG))
from registry import load_mcp_registry, validate_mcp_registry
```

Note: This must go AFTER the `sys` and `Path` imports but BEFORE the existing MCP server configuration section.

**Step 2: Replace the MCP configuration section**

Find the section starting at line ~224 (`# MCP Server Configuration`) through the end of `validate_mcp_servers()` (line ~310). Replace the following:

Keep these constants (they're still needed for path resolution):
```python
_WORKER_PKG_ROOT = Path(__file__).resolve().parent.parent.parent  # packages/worker
_NODE_MODULES = _WORKER_PKG_ROOT / "node_modules"
_MCP_REMOTE_JS = str(_NODE_MODULES / "mcp-remote" / "dist" / "proxy.js")
_BETTER_ICONS_JS = str(_NODE_MODULES / "better-icons" / "dist" / "index.js")
_MCP_SERVERS_DIST = _WORKER_PKG_ROOT.parent / "mcp-servers" / "dist"
```

Replace `build_mcp_servers()` with:
```python
# Registry variable bindings (paths resolved at module load)
_REGISTRY_VARS = {
    "dist": str(_MCP_SERVERS_DIST),
    "mcp-remote": _MCP_REMOTE_JS,
    "better-icons": _BETTER_ICONS_JS,
}


def build_mcp_servers(workspace: str) -> dict[str, Any]:
    """Build MCP server configuration from the JSON registry.

    Reads packages/mcp-servers/mcp-servers.json and resolves all template
    variables including the runtime workspace path.
    """
    return load_mcp_registry({**_REGISTRY_VARS, "workspace": workspace})
```

Replace `validate_mcp_servers()` with:
```python
def validate_mcp_servers() -> None:
    """Validate that all MCP server entry-points exist on startup.

    Reads the registry and checks that resolved file paths exist.
    Raises FileNotFoundError if a required file is missing.
    """
    # Also check that node is available
    node_path = shutil.which("node")
    if not node_path:
        raise FileNotFoundError(
            "node is not available in PATH — required to run MCP servers"
        )
    validate_mcp_registry(_REGISTRY_VARS)
```

**Step 3: Test the import works**

Run:
```bash
cd packages/worker && python -c "from src.agents.claude_visual_generator import build_mcp_servers, validate_mcp_servers; validate_mcp_servers(); print('Registry loaded OK')"
```
Expected: `Registry loaded OK`

**Step 4: Test build_mcp_servers returns correct config**

Run:
```bash
cd packages/worker && python -c "
from src.agents.claude_visual_generator import build_mcp_servers
import json
config = build_mcp_servers('/tmp/test-workspace')
print(json.dumps(config, indent=2))
print(f'Servers: {list(config.keys())}')
assert 'assets' in config
assert 'viewport' in config
assert 'freepik' in config
assert 'better-icons' in config
assert '/tmp/test-workspace' in str(config['assets']['args'])
print('All assertions passed')
"
```
Expected: JSON output with 4 servers, `All assertions passed`.

**Step 5: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(worker): wire up registry-driven MCP server config"
```

---

### Task 7: End-to-end verification

**Files:** None (verification only)

**Step 1: TypeScript build**

Run: `cd packages/mcp-servers && pnpm build`
Expected: No errors.

**Step 2: Both MCP servers respond to init handshake**

Test asset-server:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | timeout 5 node packages/mcp-servers/dist/asset-server.js --workspace /tmp/test 2>/dev/null
```

Test viewport-server:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | timeout 5 node packages/mcp-servers/dist/viewport-server.js --workspace /tmp/test 2>/dev/null
```

Expected: Both return JSON-RPC responses.

**Step 3: Python registry validation**

Run:
```bash
cd packages/worker && python -c "from src.agents.claude_visual_generator import validate_mcp_servers; validate_mcp_servers(); print('All MCP servers validated')"
```
Expected: `All MCP servers validated`

**Step 4: Verify adding a new server requires only JSON**

Confirm that `mcp-servers.json` is the single source of truth:
- `build_mcp_servers()` reads from registry (no hardcoded server entries)
- `validate_mcp_servers()` reads from registry (no hardcoded file checks)
- Adding a new entry to `mcp-servers.json` would auto-appear in the agent's MCP config
