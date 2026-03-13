# MCP Server Registry Design

**Goal:** Make MCP servers JSON-driven, discoverable, and extensible — add a new server by editing one JSON file and (optionally) writing a TypeScript source file, with zero Python changes.

**Architecture:** A single `mcp-servers.json` registry file describes all MCP servers (custom and external) with template variables for runtime values. A Python loader reads the registry, resolves variables, and produces the Claude CLI `--mcp-config` dict. Shared TypeScript utilities eliminate boilerplate in custom servers.

---

## Registry File: `packages/mcp-servers/mcp-servers.json`

Single source of truth for all MCP servers available to the visual generation agent.

```json
{
  "$schema": "./mcp-servers.schema.json",
  "variables": {
    "dist": "Resolved path to packages/mcp-servers/dist/",
    "workspace": "Remotion workspace path (passed at runtime)",
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
      "description": "Read scene dimensions from scenes.json, validate scene code",
      "type": "stdio",
      "command": "node",
      "args": ["{dist}/viewport-server.js", "--workspace", "{workspace}"],
      "env": {}
    },
    "freepik": {
      "description": "Freepik image generation and stock asset search",
      "type": "stdio",
      "command": "node",
      "args": ["{mcp-remote}", "https://api.freepik.com/mcp", "--header", "x-freepik-api-key:{env.FREEPIK_API_KEY}"],
      "env": {
        "FREEPIK_API_KEY": { "isRequired": false, "isSecret": true }
      }
    },
    "better-icons": {
      "description": "Search and retrieve icons from 200+ icon libraries",
      "type": "stdio",
      "command": "node",
      "args": ["{better-icons}"],
      "env": {}
    }
  }
}
```

### Template Variables

Two syntaxes:

| Syntax | Resolved from | Example |
|--------|--------------|---------|
| `{name}` | Variables dict passed to loader | `{dist}`, `{workspace}`, `{mcp-remote}` |
| `{env.VAR}` | `os.environ` at runtime | `{env.FREEPIK_API_KEY}` |

Path variables (`dist`, `mcp-remote`, `better-icons`) are resolved from known filesystem locations. Runtime variables (`workspace`) are passed per invocation.

## JSON Schema: `packages/mcp-servers/mcp-servers.schema.json`

Validates `mcp-servers.json` structure and provides IDE autocomplete.

Schema shape:
- `variables` — object, keys are variable names, values are description strings
- `servers` — object, each key is a server name:
  - `description` (string, required)
  - `type` (enum: `"stdio"`, required)
  - `command` (string, required)
  - `args` (string[], required) — may contain `{variable}` templates
  - `env` (object, optional) — keys are env var names, values: `{ isRequired: boolean, isSecret: boolean }`

## Python Registry Loader: `packages/mcp-servers/registry.py`

### `load_mcp_registry(variables: dict[str, str]) -> dict[str, Any]`

1. Reads `mcp-servers.json` from its own directory
2. Iterates each server entry
3. Resolves `{name}` templates in `args` from the `variables` dict
4. Resolves `{env.VAR}` templates from `os.environ`
5. Resolves `env` declarations — reads values from `os.environ` (empty string if not set and not required)
6. Returns dict in Claude CLI `--mcp-config` format:
   ```python
   {
     "server-name": {
       "type": "stdio",
       "command": "node",
       "args": ["/resolved/path/to/server.js", ...],
       "env": {"KEY": "resolved-value"}
     }
   }
   ```

### `validate_mcp_registry(variables: dict[str, str]) -> None`

1. Loads registry
2. Resolves all path variables (skips runtime-only variables like `workspace`)
3. Checks that resolved file paths in `args` exist on disk
4. Raises `FileNotFoundError` with details if any are missing

## Shared TypeScript Utilities: `packages/mcp-servers/src/lib/`

DRY extraction from the two existing servers:

### `parse-args.ts`
```typescript
export function parseWorkspace(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--workspace");
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : process.cwd();
}
```

### `errors.ts`
```typescript
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
```

## Integration with Python Agent

`claude_visual_generator.py` changes:

```python
from packages.mcp_servers.registry import load_mcp_registry, validate_mcp_registry

# Variable bindings (resolved once at module load, except workspace)
_REGISTRY_VARS = {
    "dist": str(_MCP_SERVERS_DIST),
    "mcp-remote": _MCP_REMOTE_JS,
    "better-icons": _BETTER_ICONS_JS,
}

def build_mcp_servers(workspace: str) -> dict[str, Any]:
    return load_mcp_registry({**_REGISTRY_VARS, "workspace": workspace})

def validate_mcp_servers() -> None:
    validate_mcp_registry(_REGISTRY_VARS)
```

## Adding a New Server (developer workflow)

1. Write `packages/mcp-servers/src/my-server.ts` using shared lib
2. Add entry to `mcp-servers.json`
3. Run `pnpm build:mcp-servers`
4. Done — Python agent auto-discovers it

No Python code changes. No path resolution. No validation updates.
