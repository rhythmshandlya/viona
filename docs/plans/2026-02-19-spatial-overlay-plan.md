# Spatial Overlay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make overlay display mode spatially aware of the speaker's position via a 6x6 grid heatmap MCP tool.

**Architecture:** Add `get_speaker_grid` tool to the existing asset MCP server. Worker writes `head_tracking.json` to the project folder before agents run. Animator calls the tool for overlay scenes, places elements in safe cells with transparent backgrounds. No frontend/compositor/DB/FFmpeg changes.

**Tech Stack:** Node.js (MCP server), Python (agent subprocess), TypeScript (worker processors)

---

### Task 1: Add `get_speaker_grid` tool to asset MCP server

**Files:**
- Modify: `packages/worker/src/agents/mcp-servers/asset-server.js:462` (before the `// Start` section)

**Step 1: Write the tool implementation**

Add before line 464 (`// Start`) in `asset-server.js`:

```javascript
// -- get_speaker_grid -------------------------------------------------------
/**
 * Scans workspace for head_tracking.json files, filters frames by time range,
 * and projects face bboxes onto a grid.
 */
server.registerTool(
  "get_speaker_grid",
  {
    description:
      "Get a spatial grid showing where the speaker is located in the video for a given time range. Returns a 6x6 grid where 1=speaker present, 0=safe for overlay elements. Use this when implementing overlay scenes to avoid placing visuals on top of the speaker.",
    inputSchema: {
      startMs: z.number().describe("Start of time range in milliseconds"),
      endMs: z.number().describe("End of time range in milliseconds"),
      gridRows: z
        .number()
        .int()
        .min(2)
        .max(12)
        .optional()
        .default(6)
        .describe("Number of grid rows (default 6)"),
      gridCols: z
        .number()
        .int()
        .min(2)
        .max(12)
        .optional()
        .default(6)
        .describe("Number of grid columns (default 6)"),
    },
  },
  async ({ startMs, endMs, gridRows, gridCols }) => {
    try {
      const rows = gridRows || 6;
      const cols = gridCols || 6;

      // Find head_tracking.json in workspace (scans src/*/)
      const srcDir = path.join(WORKSPACE, "src");
      let trackingPath = null;
      try {
        const entries = await readdir(srcDir);
        for (const entry of entries) {
          const candidate = path.join(srcDir, entry, "head_tracking.json");
          try {
            await stat(candidate);
            trackingPath = candidate;
            break;
          } catch { /* not found, try next */ }
        }
      } catch { /* src dir may not exist */ }

      if (!trackingPath) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: "Head tracking data not available for this project.",
              fallback: true,
              hint: "Design overlay with generous margins on all sides.",
            }),
          }],
          isError: true,
        };
      }

      const raw = JSON.parse(await readFile(trackingPath, "utf-8"));
      const frames = raw.frames || [];

      // Filter frames by time range
      const filtered = frames.filter(
        (f) => f.timestamp_ms >= startMs && f.timestamp_ms <= endMs && f.face?.bbox
      );

      if (filtered.length === 0) {
        // No detections in range — entire frame is safe
        const emptyGrid = Array.from({ length: rows }, () => Array(cols).fill(0));
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              grid: emptyGrid,
              occupancy: "0%",
              speakerBbox: null,
              safePlacement: ["entire frame"],
            }),
          }],
        };
      }

      // Build grid: project each face bbox onto the grid
      const cellHits = Array.from({ length: rows }, () => Array(cols).fill(0));

      for (const frame of filtered) {
        const b = frame.face.bbox; // {x, y, width, height} as 0-1 fractions
        const bx1 = b.x;
        const by1 = b.y;
        const bx2 = b.x + b.width;
        const by2 = b.y + b.height;

        for (let r = 0; r < rows; r++) {
          const cellY1 = r / rows;
          const cellY2 = (r + 1) / rows;
          for (let c = 0; c < cols; c++) {
            const cellX1 = c / cols;
            const cellX2 = (c + 1) / cols;
            // Check overlap
            if (bx1 < cellX2 && bx2 > cellX1 && by1 < cellY2 && by2 > cellY1) {
              cellHits[r][c]++;
            }
          }
        }
      }

      // Mark cells occupied if speaker present in >30% of filtered frames
      const threshold = filtered.length * 0.3;
      const grid = cellHits.map((row) =>
        row.map((count) => (count >= threshold ? 1 : 0))
      );

      // Compute occupancy
      const totalCells = rows * cols;
      const occupiedCells = grid.flat().filter((v) => v === 1).length;
      const occupancy = `${Math.round((occupiedCells / totalCells) * 100)}%`;

      // Compute aggregate bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const frame of filtered) {
        const b = frame.face.bbox;
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      }

      const speakerBbox = {
        x: `${Math.round(minX * 100)}%`,
        y: `${Math.round(minY * 100)}%`,
        w: `${Math.round((maxX - minX) * 100)}%`,
        h: `${Math.round((maxY - minY) * 100)}%`,
      };

      // Compute safe placement regions
      const safePlacement = [];
      const midRow = Math.floor(rows / 2);
      const midCol = Math.floor(cols / 2);

      // Check corners and edges
      const regions = {
        "top-left":     () => grid.slice(0, midRow).flatMap((r) => r.slice(0, midCol)).every((v) => v === 0),
        "top-right":    () => grid.slice(0, midRow).flatMap((r) => r.slice(midCol)).every((v) => v === 0),
        "bottom-left":  () => grid.slice(midRow).flatMap((r) => r.slice(0, midCol)).every((v) => v === 0),
        "bottom-right": () => grid.slice(midRow).flatMap((r) => r.slice(midCol)).every((v) => v === 0),
        "top":          () => grid[0].every((v) => v === 0),
        "bottom":       () => grid[rows - 1].every((v) => v === 0),
        "left":         () => grid.every((r) => r[0] === 0),
        "right":        () => grid.every((r) => r[cols - 1] === 0),
      };

      for (const [name, check] of Object.entries(regions)) {
        if (check()) safePlacement.push(name);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ grid, occupancy, speakerBbox, safePlacement }),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error reading speaker grid: ${err.message}` }],
        isError: true,
      };
    }
  }
);
```

**Step 2: Add `readFile` and `readdir` and `stat` imports**

At line 20 in `asset-server.js`, the existing import is:
```javascript
import { writeFile, mkdir } from "node:fs/promises";
```

Change to:
```javascript
import { writeFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
```

**Step 3: Run the unit test to verify 6 tools are listed**

Run:
```bash
cd packages/worker/src/agents/mcp-servers
node -e "
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ws = await mkdtemp(path.join(tmpdir(), 'grid-test-'));
// Create fake head_tracking.json
const projDir = path.join(ws, 'src', 'proj_test');
await mkdir(projDir, { recursive: true });
await writeFile(path.join(projDir, 'head_tracking.json'), JSON.stringify({
  frames: [
    { frame: 0, timestamp_ms: 0, face: { bbox: { x: 0.3, y: 0.1, width: 0.4, height: 0.7 } }, confidence: 0.95 },
    { frame: 3, timestamp_ms: 100, face: { bbox: { x: 0.31, y: 0.11, width: 0.39, height: 0.69 } }, confidence: 0.93 },
    { frame: 6, timestamp_ms: 200, face: { bbox: { x: 0.29, y: 0.09, width: 0.41, height: 0.71 } }, confidence: 0.94 },
  ],
  metadata: { fps: 30, totalFrames: 10, width: 1080, height: 1920 },
}));

const t = new StdioClientTransport({ command: 'node', args: ['asset-server.js', '--workspace', ws] });
const c = new Client({ name: 'test', version: '1.0.0' });
await c.connect(t);

// List tools — expect 6
const tools = await c.listTools();
console.log('Tools:', tools.tools.length, tools.tools.map(t => t.name));

// Call get_speaker_grid
const res = await c.callTool({ name: 'get_speaker_grid', arguments: { startMs: 0, endMs: 300 } });
const data = JSON.parse(res.content[0].text);
console.log('Grid:', JSON.stringify(data.grid));
console.log('Occupancy:', data.occupancy);
console.log('Bbox:', data.speakerBbox);
console.log('Safe:', data.safePlacement);

// Verify speaker is in center-right area (x:0.3, w:0.4 → cols 1-4 of 6)
const occupied = data.grid.flat().filter(v => v === 1).length;
console.log('Occupied cells:', occupied, '/ 36');
console.assert(occupied > 0, 'Should have occupied cells');
console.assert(data.safePlacement.length > 0, 'Should have safe zones');

await c.close();
await rm(ws, { recursive: true, force: true });
console.log('PASS');
"
```

Expected: `PASS` with occupied cells in center-right area, safe placement includes `top-left`, `bottom-left`.

**Step 4: Test edge case — no tracking data**

Run:
```bash
cd packages/worker/src/agents/mcp-servers
node -e "
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ws = await mkdtemp(path.join(tmpdir(), 'grid-nodata-'));
const t = new StdioClientTransport({ command: 'node', args: ['asset-server.js', '--workspace', ws] });
const c = new Client({ name: 'test', version: '1.0.0' });
await c.connect(t);

const res = await c.callTool({ name: 'get_speaker_grid', arguments: { startMs: 0, endMs: 1000 } });
console.log('isError:', res.isError);
const data = JSON.parse(res.content[0].text);
console.log('fallback:', data.fallback);
console.assert(res.isError === true, 'Should be error');
console.assert(data.fallback === true, 'Should have fallback flag');

await c.close();
await rm(ws, { recursive: true, force: true });
console.log('PASS');
"
```

Expected: `PASS` — returns error with `fallback: true`.

**Step 5: Commit**

```bash
git add packages/worker/src/agents/mcp-servers/asset-server.js
git commit -m "feat: add get_speaker_grid tool to asset MCP server

6x6 heatmap of speaker position for spatially-aware overlay mode.
Reads head_tracking.json, projects face bboxes onto grid,
returns occupied cells + safe placement regions."
```

---

### Task 2: Write head tracking data to project folder

**Files:**
- Modify: `packages/worker/src/processors/plan-visuals.ts:33-51` (PlanVisualsJobData interface)
- Modify: `packages/worker/src/processors/plan-visuals.ts:95-97` (project query)
- Modify: `packages/worker/src/processors/plan-visuals.ts:113-115` (write file)
- Modify: `packages/worker/src/processors/generate-visuals.ts:272-286` (GenerateVisualsJobData interface)
- Modify: `packages/worker/src/processors/generate-visuals.ts:350-357` (project query)
- Modify: `packages/worker/src/processors/generate-visuals.ts:393-394` (write file)

**Step 1: Add `headTrackingData` to `PlanVisualsJobData`**

In `plan-visuals.ts` at line 50, before the closing `}` of the interface:

```typescript
  sourceWidth?: number;
  sourceHeight?: number;
  headTrackingData?: Record<string, unknown>;
}
```

**Step 2: Write `head_tracking.json` after creating the project directory**

In `plan-visuals.ts`, after line 115 (`logger.info({ projectDir, compositionId }, 'Created project directory for plan');`):

```typescript
      // Write head tracking data to project folder for spatial overlay awareness
      if (job.data.headTrackingData) {
        const htPath = join(projectDir, 'head_tracking.json');
        await writeFile(htPath, JSON.stringify(job.data.headTrackingData), 'utf-8');
        logger.info({ projectDir }, 'Wrote head_tracking.json for spatial overlay');
      }
```

**Step 3: Add `headTrackingData` to `GenerateVisualsJobData`**

In `generate-visuals.ts` at line 285, before `planJobId`:

```typescript
  /** Head tracking data for spatial overlay awareness */
  headTrackingData?: Record<string, unknown>;
  /** If set, skip Director phase and run Animator only using plan from this job */
  planJobId?: string;
```

**Step 4: Write `head_tracking.json` in generate-visuals.ts**

In `generate-visuals.ts`, after line 394 (`logger.info({ projectDir, compositionId }, 'Created fresh project directory');`):

```typescript
    // Write head tracking data for spatial overlay awareness
    if (project.headTrackingData) {
      const htPath = join(projectDir, 'head_tracking.json');
      await writeFile(htPath, JSON.stringify(project.headTrackingData), 'utf-8');
      logger.info({ projectDir }, 'Wrote head_tracking.json for spatial overlay');
    }
```

Note: `generate-visuals.ts` already queries the full project from the DB at line 351, so `project.headTrackingData` is already available — no extra query needed.

**Step 5: Commit**

```bash
git add packages/worker/src/processors/plan-visuals.ts packages/worker/src/processors/generate-visuals.ts
git commit -m "feat: write head_tracking.json to project folder for spatial overlay

Both plan-visuals and generate-visuals processors now write
head tracking data to src/{project_id}/head_tracking.json
so the asset MCP server's get_speaker_grid tool can read it."
```

---

### Task 3: Register `get_speaker_grid` in allowed tools

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py:3030-3036` (allowed_tools list)

**Step 1: Add the tool to allowed_tools**

In `claude_visual_generator.py`, after line 3036 (`"mcp__assets__download_stock_photo",`), add:

```python
                    # Speaker grid tool (spatial awareness for overlay scenes)
                    "mcp__assets__get_speaker_grid",
```

**Step 2: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat: register get_speaker_grid in Animator allowed tools"
```

---

### Task 4: Update Director prompt — overlay note

**Files:**
- Modify: `packages/worker/src/agents/prompts/director.py:372` (overlay row in display mode table)
- Modify: `packages/worker/src/agents/prompts/director.py:377` (overlay planning guideline)

**Step 1: Update the overlay description in `_DISPLAY_MODE_TABLE`**

At line 372, change the overlay row from:
```
| `"overlay"` | Speaker fullscreen, visual layered on top at ~70% opacity | Speaker credibility moments, emotional beats, transitions, conclusions |
```
to:
```
| `"overlay"` | Speaker fullscreen, visual layered on top (transparent bg, spatially aware) | Speaker credibility moments, emotional beats — Animator uses speaker grid to avoid covering face |
```

At line 377, change the overlay guideline from:
```
- Use `"overlay"` sparingly — when the speaker's face matters more than the visual (intro/outro, emotional beats)
```
to:
```
- Use `"overlay"` sparingly — the Animator has a `get_speaker_grid` tool that tells it where the speaker is, so overlay visuals will use transparent backgrounds and float around the speaker
```

**Step 2: Commit**

```bash
git add packages/worker/src/agents/prompts/director.py
git commit -m "feat: update Director prompt — overlay is now spatially aware"
```

---

### Task 5: Update Animator prompt — spatial overlay section

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py:515` (after ASSET DIRECTORY guardrail)
- Modify: `packages/worker/src/agents/claude_visual_generator.py` (inline copy, after ASSET DIRECTORY guardrail — same location as animator.py)

**Step 1: Add overlay spatial awareness section to `animator.py`**

After line 515 (`- **ASSET DIRECTORY**: The \`mcp__assets__download_file\` tool...`), before `</assets_and_visuals>`, add:

```python
### OVERLAY MODE — SPATIAL AWARENESS

When implementing a scene with `displayMode: "overlay"`, you MUST:

1. Call `mcp__assets__get_speaker_grid` with the scene's startMs and endMs
2. The tool returns a 6x6 grid where 1 = speaker present, 0 = safe zone
3. Design your composition to place elements ONLY in safe (0) cells
4. Use TRANSPARENT backgrounds — no opaque fills, no solid color backgrounds
5. Think of overlay as floating annotations on top of the speaker

**Reading the grid:**
```
Grid:  0 0 0 0 1 1      ← speaker is on the right side
       0 0 0 1 1 1
       0 0 0 1 1 1      1-cell buffer around speaker = avoid column 3 too
       0 0 0 1 1 1
       0 0 0 0 1 1
       0 0 0 0 0 0

→ Safe: left half, bottom row
→ Place title text top-left, stats stacked on left, annotation arrows pointing toward speaker
```

**Rules:**
- Background MUST be `transparent` or `rgba(0,0,0,0)` — NEVER a solid color
- Place text, icons, charts in safe zones (0 cells) only
- Leave a 1-cell buffer around occupied cells for breathing room
- Use opacity 0.8-0.9 on overlay elements — slightly see-through
- Prefer edges/corners away from the speaker
- If occupancy > 50%, use minimal floating annotations only (small labels, corner icons)
- If `get_speaker_grid` returns an error, design centered with generous margins on all sides

**Overlay uses full canvas dimensions** — the scene's `effectiveDimensions` will be the full
canvas size (same as fullscreen). Use these dimensions for positioning, but remember elements
must avoid the speaker's grid cells.
```

**Step 2: Add the same section to the inline copy in `claude_visual_generator.py`**

In `claude_visual_generator.py`, find the `- **ASSET DIRECTORY**` line in the inline prompt (the one we updated earlier with screenshots/stock photos). Add the same overlay section after the `STOCK PHOTO GUARDRAILS` and before `</assets_and_visuals>`.

**Step 3: Commit**

```bash
git add packages/worker/src/agents/prompts/animator.py packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat: add OVERLAY MODE — SPATIAL AWARENESS section to Animator prompts

Instructs the Animator to call get_speaker_grid for overlay scenes,
read the 6x6 heatmap, and place elements only in safe cells with
transparent backgrounds."
```

---

### Task 6: E2E test — speaker grid with real Agent SDK

**Files:**
- No permanent files — this is a manual verification step

**Step 1: Create test head tracking data**

Pick any existing project that has `headTrackingData` in the DB, or manually insert test data:

```bash
cd packages/worker/src/agents/mcp-servers
node -e "
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Create workspace with tracking data
const ws = await mkdtemp(path.join(tmpdir(), 'e2e-overlay-'));
const projDir = path.join(ws, 'src', 'proj_test');
await mkdir(projDir, { recursive: true });
await mkdir(path.join(ws, 'public', 'assets'), { recursive: true });

// Speaker is center-right, typical portrait video framing
await writeFile(path.join(projDir, 'head_tracking.json'), JSON.stringify({
  frames: Array.from({ length: 30 }, (_, i) => ({
    frame: i * 3,
    timestamp_ms: i * 100,
    face: { bbox: { x: 0.3 + Math.random() * 0.05, y: 0.08 + Math.random() * 0.03, width: 0.4, height: 0.7 } },
    confidence: 0.9 + Math.random() * 0.1,
  })),
  metadata: { fps: 30, totalFrames: 90, width: 1080, height: 1920 },
}));

const t = new StdioClientTransport({ command: 'node', args: ['asset-server.js', '--workspace', ws] });
const c = new Client({ name: 'test', version: '1.0.0' });
await c.connect(t);

// Query multiple time ranges
for (const [start, end] of [[0, 1000], [1000, 2000], [0, 3000]]) {
  const res = await c.callTool({ name: 'get_speaker_grid', arguments: { startMs: start, endMs: end } });
  const d = JSON.parse(res.content[0].text);
  console.log(\`[\${start}-\${end}ms] Occupancy: \${d.occupancy}, Safe: \${d.safePlacement?.join(', ')}\`);
  console.log(d.grid.map(r => r.map(v => v ? 'X' : '.').join(' ')).join('\n'));
  console.log();
}

await c.close();
await rm(ws, { recursive: true, force: true });
console.log('E2E test complete');
"
```

Expected: Grid shows speaker in center-right, safe zones on left side and corners.

**Step 2: Verify full agent SDK integration**

Follow the same pattern as the asset server e2e test — spawn a Claude agent with the asset MCP server, ask it to call `get_speaker_grid`, verify it gets the grid and describes safe placement.

---

### Task 7: Integration verification

**Step 1: Verify the full pipeline manually**

1. Find a project in the DB that has `headTrackingData` populated
2. Trigger a `plan-visuals` or `generate-visuals` job for that project
3. Check that `head_tracking.json` was written to `src/{compositionId}/`
4. Check agent logs for `mcp__assets__get_speaker_grid` tool calls during overlay scenes
5. Preview the result in the editor — overlay visuals should be positioned around the speaker

**Step 2: Final commit — update .env.example**

Add placeholder comments to `packages/worker/.env.example`:

```bash
# Stock photo APIs (optional — for asset MCP server)
# UNSPLASH_ACCESS_KEY=
# PEXELS_API_KEY=
```

```bash
git add packages/worker/.env.example
git commit -m "docs: add stock photo API key placeholders to .env.example"
```
