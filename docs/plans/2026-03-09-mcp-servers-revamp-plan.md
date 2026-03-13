# MCP Servers Revamp Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert inline MCP servers from raw `.js` with isolated `node_modules/` into a proper TypeScript pnpm workspace package at `packages/mcp-servers/`.

**Architecture:** New `packages/mcp-servers` workspace package with two MCP servers (asset-server, viewport-server) converted to TypeScript and built with `tsc`. The Python visual generator spawns them at runtime via `node dist/asset-server.js`. The `screenshot` tool and `puppeteer` dependency are removed.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `zod`, `unzipper`

---

## Context

### How MCP servers work in this codebase

The visual generation pipeline has a Python agent (`packages/worker/src/agents/claude_visual_generator.py`) that spawns the Claude CLI as a subprocess. The CLI is configured with MCP servers — standalone Node.js processes that communicate over stdio JSON-RPC. Each MCP server exposes "tools" that the AI agent can call during visual generation.

Currently there are 4 MCP servers configured in `build_mcp_servers()` (line ~240 of `claude_visual_generator.py`):
1. **freepik** — external, via `mcp-remote` proxy (no changes needed)
2. **better-icons** — external, via npm package (no changes needed)
3. **assets** — custom, `asset-server.js` — downloads files, searches stock photos, reads speaker grid
4. **viewport** — custom, `viewport-server.js` — reads scene dimensions, validates scene code

Servers 3 and 4 currently live at `packages/worker/src/agents/mcp-servers/` with their own `package.json` and `node_modules/` (66MB). This plan moves them to a proper workspace package.

### Key file paths
- Python agent: `packages/worker/src/agents/claude_visual_generator.py`
- Current servers: `packages/worker/src/agents/mcp-servers/{asset-server.js,viewport-server.js}`
- Current server deps: `packages/worker/src/agents/mcp-servers/{package.json,package-lock.json,node_modules/}`
- Root workspace config: `pnpm-workspace.yaml` (already globs `packages/*`)
- Root `package.json` build scripts: lines 10-15

---

### Task 1: Scaffold the `packages/mcp-servers` package

**Files:**
- Create: `packages/mcp-servers/package.json`
- Create: `packages/mcp-servers/tsconfig.json`
- Create: `packages/mcp-servers/src/` (directory)

**Step 1: Create `packages/mcp-servers/package.json`**

```json
{
  "name": "@viona/mcp-servers",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "unzipper": "^0.12.3",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "@types/unzipper": "^0.10.10",
    "typescript": "^5.3.3"
  }
}
```

**Step 2: Create `packages/mcp-servers/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Run `pnpm install` from the repo root**

Run: `pnpm install`
Expected: `packages/mcp-servers` appears as a workspace package, dependencies installed.

**Step 4: Commit**

```bash
git add packages/mcp-servers/package.json packages/mcp-servers/tsconfig.json pnpm-lock.yaml
git commit -m "feat(mcp-servers): scaffold workspace package"
```

---

### Task 2: Convert `asset-server.js` to TypeScript

**Files:**
- Create: `packages/mcp-servers/src/asset-server.ts`
- Reference: `packages/worker/src/agents/mcp-servers/asset-server.js` (source to convert)

**Step 1: Create `packages/mcp-servers/src/asset-server.ts`**

Convert the existing `asset-server.js` to TypeScript. Key changes:

1. Add type annotations for all function parameters and return types
2. Add interfaces at the top of the file:

```typescript
interface FetchHeaders {
  [key: string]: string;
}

interface HeadTrackingFrame {
  timestamp_ms: number;
  face?: {
    bbox: { x: number; y: number; width: number; height: number };
  };
}

interface HeadTrackingData {
  frames: HeadTrackingFrame[];
  video?: { width: number; height: number };
}

interface GridResult {
  grid: number[][];
  occupancy: string;
  speakerBbox: { x: string; y: string; w: string; h: string } | null;
  safePlacement: string[];
}
```

3. Remove the `screenshot` tool entirely (lines 213-289 in original `.js`)
4. Keep all 5 remaining tools: `download_file`, `search_unsplash`, `search_pexels`, `download_stock_photo`, `get_speaker_grid`
5. Type the `z.infer<>` callback params where possible
6. Keep all security measures: `validateUrl()` SSRF protection, `sanitizeFilename()`, `MAX_FILE_SIZE`, `FETCH_TIMEOUT`
7. Keep ZIP extraction logic (`extractImageFromZip`) for Freepik responses

The file structure stays the same — it's a standalone executable, not a library. The `main()` function at the bottom creates a `StdioServerTransport` and connects.

**Step 2: Verify it compiles**

Run: `cd packages/mcp-servers && pnpm build`
Expected: `dist/asset-server.js` is produced without errors.

**Step 3: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "feat(mcp-servers): convert asset-server to TypeScript"
```

---

### Task 3: Convert `viewport-server.js` to TypeScript

**Files:**
- Create: `packages/mcp-servers/src/viewport-server.ts`
- Reference: `packages/worker/src/agents/mcp-servers/viewport-server.js` (source to convert)

**Step 1: Create `packages/mcp-servers/src/viewport-server.ts`**

Convert the existing `viewport-server.js` to TypeScript. Key changes:

1. Add interfaces:

```typescript
interface SceneEntry {
  title?: string;
  name?: string;
  displayMode?: string;
  effectiveDimensions?: { width: number; height: number };
  speakerGrid?: {
    occupancy?: string;
    safePlacement?: string[];
  };
}

interface ScenesJson {
  scenes: SceneEntry[];
}

interface ScenesJsonResult {
  path: string;
  data: ScenesJson;
  projDir: string | null;
}

interface ValidationResult {
  sceneIndex: number;
  sceneNumber: number;
  displayMode: string;
  effectiveWidth: number;
  effectiveHeight: number;
  issues: string[];
  warnings: string[];
  valid: boolean;
}
```

2. Type all function params and returns
3. Keep both tools: `get_scene_dimensions`, `validate_scene_code`
4. Keep all validation logic (effective dimension checks, overlay transparency, hardcoded pixel detection)

**Step 2: Verify it compiles**

Run: `cd packages/mcp-servers && pnpm build`
Expected: `dist/viewport-server.js` produced alongside `dist/asset-server.js`, no errors.

**Step 3: Commit**

```bash
git add packages/mcp-servers/src/viewport-server.ts
git commit -m "feat(mcp-servers): convert viewport-server to TypeScript"
```

---

### Task 4: Update Python agent to use new package paths

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`
  - `build_mcp_servers()` function (~line 240)
  - `validate_mcp_servers()` function (~line 286)

**Step 1: Update path resolution in `build_mcp_servers()`**

The current code resolves paths relative to `agents_dir` (the directory containing the Python file):
```python
agents_dir = Path(__file__).parent
# ...
str(agents_dir / "mcp-servers" / "asset-server.js"),
str(agents_dir / "mcp-servers" / "viewport-server.js"),
```

Change to resolve from the monorepo `packages/` directory:
```python
_MONOREPO_ROOT = _WORKER_PKG_ROOT.parent.parent  # repo root
_MCP_SERVERS_DIST = _MONOREPO_ROOT / "packages" / "mcp-servers" / "dist"
```

Then in `build_mcp_servers()`, replace the paths:
```python
"assets": {
    "type": "stdio",
    "command": "node",
    "args": [
        str(_MCP_SERVERS_DIST / "asset-server.js"),
        "--workspace", workspace,
    ],
    "env": {
        "UNSPLASH_ACCESS_KEY": os.environ.get("UNSPLASH_ACCESS_KEY", ""),
        "PEXELS_API_KEY": os.environ.get("PEXELS_API_KEY", ""),
    },
},
"viewport": {
    "type": "stdio",
    "command": "node",
    "args": [
        str(_MCP_SERVERS_DIST / "viewport-server.js"),
        "--workspace", workspace,
    ],
},
```

Remove the `agents_dir = Path(__file__).parent` line from `build_mcp_servers()` since it's no longer used there.

**Step 2: Update `validate_mcp_servers()` to check asset-server and viewport-server**

Add the two new servers to the `checks` dict:
```python
checks = {
    "mcp-remote (proxy.js)": _MCP_REMOTE_JS,
    "better-icons (index.js)": _BETTER_ICONS_JS,
    "asset-server (dist)": str(_MCP_SERVERS_DIST / "asset-server.js"),
    "viewport-server (dist)": str(_MCP_SERVERS_DIST / "viewport-server.js"),
}
```

**Step 3: Test that the Python module loads without import errors**

Run: `cd packages/worker && python -c "from src.agents.claude_visual_generator import build_mcp_servers, validate_mcp_servers; print('OK')"`
Expected: `OK` (no ImportError)

**Step 4: Verify MCP server validation passes**

Run: `cd packages/worker && python -c "from src.agents.claude_visual_generator import validate_mcp_servers; validate_mcp_servers(); print('All MCP servers validated')"`
Expected: `All MCP servers validated` (no FileNotFoundError)

**Step 5: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(worker): update MCP server paths to packages/mcp-servers"
```

---

### Task 5: Add build script to root package.json and clean up

**Files:**
- Modify: `package.json` (root)
- Modify: `packages/worker/package.json` (remove stale `setup:auth` script)
- Delete: `packages/worker/src/agents/mcp-servers/` (entire directory)

**Step 1: Add build script to root `package.json`**

Add after the existing `build:templates` line (~line 15):
```json
"build:mcp-servers": "pnpm --filter @viona/mcp-servers build",
```

The existing `"build": "pnpm run --parallel build:*"` glob will automatically pick this up.

**Step 2: Remove stale `setup:auth` script from worker `package.json`**

In `packages/worker/package.json`, remove this line (the file was already deleted):
```json
"setup:auth": "python src/agents/setup_claude_auth.py",
```

**Step 3: Delete the old `mcp-servers` directory**

Run: `rm -rf packages/worker/src/agents/mcp-servers/`

This removes:
- `asset-server.js` (replaced by `packages/mcp-servers/src/asset-server.ts`)
- `viewport-server.js` (replaced by `packages/mcp-servers/src/viewport-server.ts`)
- `package.json` (no longer needed)
- `package-lock.json` (no longer needed)
- `node_modules/` (~66MB freed)

**Step 4: Verify full build works**

Run: `pnpm build:mcp-servers`
Expected: Compiles successfully, `packages/mcp-servers/dist/` contains `asset-server.js` and `viewport-server.js`.

**Step 5: Commit**

```bash
git add package.json packages/worker/package.json
git rm -r packages/worker/src/agents/mcp-servers/
git add packages/mcp-servers/
git commit -m "feat(mcp-servers): complete migration, remove old directory"
```

---

### Task 6: End-to-end verification

**Files:** None (verification only)

**Step 1: Verify TypeScript compilation**

Run: `cd packages/mcp-servers && pnpm typecheck`
Expected: No errors.

**Step 2: Verify MCP servers start and respond**

Test asset-server:
Run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node packages/mcp-servers/dist/asset-server.js --workspace /tmp/test-workspace`
Expected: JSON-RPC response with server capabilities (not a crash).

Test viewport-server:
Run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node packages/mcp-servers/dist/viewport-server.js --workspace /tmp/test-workspace`
Expected: JSON-RPC response with server capabilities (not a crash).

**Step 3: Verify Python agent validates all servers**

Run: `cd packages/worker && python -c "from src.agents.claude_visual_generator import validate_mcp_servers; validate_mcp_servers(); print('All MCP servers validated')"`
Expected: `All MCP servers validated`

**Step 4: Verify monorepo build**

Run: `pnpm build`
Expected: All packages build including `@viona/mcp-servers`.
