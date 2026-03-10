# MCP Servers Revamp Design

**Goal:** Convert the inline MCP servers from raw `.js` files with an isolated `node_modules/` into a proper TypeScript pnpm workspace package.

**Architecture:** New `packages/mcp-servers` workspace package. Two MCP servers (asset-server, viewport-server) converted to TypeScript, built with `tsc`, invoked by the Python visual generator agent at runtime via `node dist/asset-server.js`.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `zod`, `unzipper`

---

## Current State

- `packages/worker/src/agents/mcp-servers/` contains two raw `.js` MCP servers
- Own `package.json` + `node_modules/` (66MB), not in pnpm lockfile
- `puppeteer` dependency (60MB) for a `screenshot` tool that is unused
- Dependencies (`zod`, `@modelcontextprotocol/sdk`) duplicated from monorepo
- Python agent (`claude_visual_generator.py`) spawns them via `node <path>.js --workspace <dir>`

## Design

### Package Structure

```
packages/mcp-servers/
├── package.json          # @viona/mcp-servers
├── tsconfig.json
├── src/
│   ├── asset-server.ts   # Asset download, stock photo search, speaker grid
│   └── viewport-server.ts # Scene dimensions, code validation
└── dist/                 # tsc output (gitignored)
    ├── asset-server.js
    └── viewport-server.js
```

### Dependencies

**package.json:**
- `@modelcontextprotocol/sdk` — MCP protocol implementation
- `zod` — Schema validation (required by MCP SDK `registerTool`)
- `unzipper` — ZIP extraction for Freepik downloads

**Removed:** `puppeteer` (~60MB) — the `screenshot` tool is dropped.

### asset-server.ts

Tools provided to the Animator agent:

| Tool | Purpose |
|------|---------|
| `download_file` | Fetch URL → save to `public/assets/{filename}`, auto-extracts images from ZIP |
| `search_unsplash` | Search Unsplash API for stock photos |
| `search_pexels` | Search Pexels API for stock photos |
| `download_stock_photo` | Download from Unsplash/Pexels with attribution headers |
| `get_speaker_grid` | Read `head_tracking.json`, return 6x6 grid of speaker position for overlay placement |

**Removed:** `screenshot` tool (puppeteer-based, unused).

Conversion notes:
- Add TypeScript interfaces for tool params, head tracking data, grid results
- Keep existing SSRF protection (`validateUrl`), file size guards, filename sanitization
- Keep ZIP extraction logic for Freepik responses

### viewport-server.ts

Tools provided to the Animator agent:

| Tool | Purpose |
|------|---------|
| `get_scene_dimensions` | Read `scenes.json`, return effective dimensions per scene |
| `validate_scene_code` | Static analysis of scene `.tsx` for dimension/overlay correctness |

Conversion notes:
- Add interfaces for `ScenesJson`, `SceneEntry`, `ValidationResult`
- Keep all existing validation checks (effective dimensions, clipping, overlay transparency, hardcoded pixels)

### Python Agent Updates

In `claude_visual_generator.py` → `build_mcp_servers()`:

```python
# Old path (inside agents/)
agents_dir / "mcp-servers" / "asset-server.js"

# New path (workspace package dist/)
_WORKER_PKG_ROOT.parent / "mcp-servers" / "dist" / "asset-server.js"
```

Add both servers to `validate_mcp_servers()` startup checks (currently only validates freepik + better-icons).

### Build Integration

- `tsc` compiles `src/*.ts` → `dist/*.js` (ES modules, target ES2022)
- `pnpm-workspace.yaml` already globs `packages/*` — auto-discovered
- Add `"build:mcp-servers": "pnpm --filter @viona/mcp-servers build"` to root `package.json`

### Cleanup

Delete entirely:
- `packages/worker/src/agents/mcp-servers/` (directory, package.json, node_modules, .js files)
