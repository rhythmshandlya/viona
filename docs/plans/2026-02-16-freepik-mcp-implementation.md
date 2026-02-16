# Freepik MCP Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace better-icons and lottiefiles MCP servers with Freepik MCP in the visual generator, add premium-first asset prompts to both the Creative Director and visual generator agents.

**Architecture:** The Python visual generator (`claude_visual_generator.py`) spawns Claude via Agent SDK with MCP servers. We swap the `better-icons` + `lottiefiles` servers for one `freepik` remote MCP server, update the system prompt to teach premium-first asset usage, and add asset-aware planning to the Creative Director's prompt.

**Tech Stack:** Python (Claude Agent SDK), TypeScript (Fastify API), Freepik remote MCP (`mcp-remote`), environment variables for API key.

---

### Task 1: Add Freepik API key to worker config

**Files:**
- Modify: `packages/worker/src/config.ts`

**Step 1: Add freepik config block**

In `packages/worker/src/config.ts`, add after the `enhance` block (after line 98, before `remotion`):

```typescript
  freepik: {
    apiKey: process.env.FREEPIK_API_KEY || '',
  },
```

**Step 2: Add env var to local .env (if exists)**

Check if `packages/worker/.env` exists. If so, add:

```
FREEPIK_API_KEY=FPSX70f3938ef7bef7f4b3740afb10ee7ff3
```

If no `.env` file exists, skip — the key is already in `.mcp.json` and the Python script reads `os.environ` which inherits from the Node process. Just ensure the env var is set when running the worker.

**Step 3: Commit**

```bash
git add packages/worker/src/config.ts
git commit -m "feat(worker): add Freepik API key to config"
```

---

### Task 2: Replace MCP servers in Python visual generator

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py:2783-2804`

**Step 1: Replace allowed_tools list**

At line 2783, replace the `allowed_tools` list:

```python
                allowed_tools=[
                    "Read", "Write", "Edit", "Glob", "Grep", "Bash", "TodoWrite", "Skill",
                    # Freepik MCP tools (premium icons, illustrations, vectors)
                    "mcp__freepik__search_icons",
                    "mcp__freepik__get_icon_detail_by_id",
                    "mcp__freepik__download_icon_by_id",
                    "mcp__freepik__search_resources",
                    "mcp__freepik__get_resource_detail_by_id",
                    "mcp__freepik__download_resource_by_id",
                ],
```

**Step 2: Replace mcp_servers config**

At line 2793, replace the `mcp_servers` dict:

```python
                mcp_servers={
                    "freepik": {
                        "type": "stdio",
                        "command": "npx",
                        "args": [
                            "-y", "mcp-remote",
                            "https://api.freepik.com/mcp",
                            "--header",
                            f"x-freepik-api-key:{os.environ.get('FREEPIK_API_KEY', '')}",
                        ]
                    }
                },
```

**Step 3: Verify the import**

Confirm `os` is already imported at the top of the file (it is — used extensively throughout).

**Step 4: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(worker): replace better-icons/lottiefiles with Freepik MCP server"
```

---

### Task 3: Replace `<icons_and_svg>` system prompt in Python generator

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py:1761-1801`

**Step 1: Replace the `<icons_and_svg>` section**

Replace lines 1761-1801 (the entire `<icons_and_svg>...</icons_and_svg>` block) with:

```python
<assets_and_visuals>
## PREMIUM ASSET LIBRARY — FREEPIK

You have access to Freepik's library of millions of premium icons, illustrations,
vectors, and photos via MCP tools. USE THEM. Your visuals should look like they
came from a professional motion design studio, not a coding tutorial.

### DECISION FRAMEWORK — What to use when

| Visual Need | Use | Why |
|------------|-----|-----|
| Any icon (arrows, UI, concepts) | Freepik `search_icons` → `download_icon_by_id` (format="svg") | Professional, consistent, polished |
| Illustrations (objects, scenes, people) | Freepik `search_resources` (vector) | Hand-drawn quality impossible with code |
| Background textures/patterns | Freepik `search_resources` (vector) | Rich visual depth |
| Data visualizations (charts, graphs) | Hand-coded SVG + Remotion animation | Needs dynamic values, animation |
| Flowcharts / process diagrams | Hand-coded SVG with Freepik icons as nodes | Best of both — structure + polish |
| Abstract concepts (AI, growth, speed) | Freepik illustration + animation overlay | Conveys concept instantly |

**RULE: Default to Freepik. Only hand-code when data is dynamic.**

If you're about to write an SVG path by hand, STOP and ask yourself: "Does Freepik have
something better?" The answer is almost always yes.

### HOW TO SEARCH EFFECTIVELY

**Icons:**
- search_icons with `term` parameter: "cloud computing", "server rack", "neural network"
- Filter by shape: "fill" for solid icons, "outline" for line icons
- Filter by icon_type: ["standard"] for static, ["animated"] for motion
- Search CONCEPTS, not literal descriptions. "growth" not "line going up".
- Try 2-3 search terms if the first doesn't match: "database" → "storage" → "server rack"

**Resources (illustrations, vectors, photos):**
- search_resources with `term` and content_type filter: {{ content_type: {{ vector: 1 }} }}
- Prefer vectors over photos — cleaner scaling, transparent backgrounds
- Use orientation filters for portrait content: {{ orientation: {{ portrait: 1 }} }}

### HOW TO USE DOWNLOADED ASSETS

**Icons (SVG) — inline in JSX:**
1. `download_icon_by_id` with id and format="svg" → returns {{ data: {{ url, filename }} }}
2. Download with Bash: `curl -sL -o public/assets/icon-name.svg "URL"`
3. Read the SVG file content with the Read tool
4. Paste the SVG markup directly into your JSX component
5. Replace hardcoded width/height with style prop: `style={{{{ width: minDim * 0.08, height: minDim * 0.08 }}}}`
6. Use `currentColor` for dynamic coloring: wrap in div with `color: COLORS.accent`
7. Animate the wrapper with spring/interpolate

**Resources (images/illustrations) — use staticFile:**
1. `download_resource_by_id` with resource-id → returns {{ data: {{ url, filename }} }}
2. Download: `curl -sL -o public/assets/illustration.png "URL"`
3. In component: `<Img src={{staticFile('assets/illustration.png')}} style={{...}} />`
4. Import Img from remotion: `import {{ Img, staticFile }} from 'remotion';`
5. Animate with opacity, scale, position transforms

### ANIMATION WITH ASSETS

Don't just place assets on screen statically. Make them come alive:
- **Icons**: spring scale-in, stroke draw-in effect, color transitions via interpolateColors
- **Illustrations**: parallax layers (foreground moves faster), reveal masks, zoom-and-pan
- **Stagger**: When multiple icons appear, stagger by 6-8 frames each (never all at once)

Example — animated icon entry:
```tsx
const iconScale = spring({{ frame: frame - delay, fps, config: {{ damping: 22, stiffness: 90 }} }});
const iconOpacity = interpolate(frame, [delay, delay + 15], [0, 1], {{ extrapolateRight: 'clamp' }});

<div style={{{{ opacity: iconOpacity, transform: `scale(${{iconScale}})`, color: COLORS.accent }}}}>
  <svg viewBox="0 0 24 24" style={{{{ width: minDim * 0.08, height: minDim * 0.08 }}}}>
    {{/* SVG paths from Freepik download */}}
  </svg>
</div>
```

### GUARDRAILS

- **ASSET BUDGET**: 1-3 icons per scene, 0-1 illustration per scene. Don't clutter.
- **SEARCH BUDGET**: 1-2 searches per concept max. Don't spend 10 turns browsing Freepik.
- **STYLE CONSISTENCY**: Pick ONE icon style (fill OR outline) in the FIRST scene and use it for ALL scenes. Match icon colors to the style preset's color scheme.
- **FALLBACK**: If a download fails or search returns nothing useful, hand-code a clean SVG. Never let an asset failure break a scene.
- **NO PHOTO BACKGROUNDS**: Photos behind animated elements create visual noise. Use solid colors or subtle gradients for backgrounds. Photos work as hero images, not backdrops.
- **FIRST SCENE SETS THE STYLE**: Whatever asset family/style you pick in scene 1, ALL subsequent scenes must match. Consistency > variety.
- **ALWAYS CREATE public/assets/ DIRECTORY**: Before downloading any assets, run `mkdir -p public/assets` in Bash.
</assets_and_visuals>
```

**Step 2: Verify the replacement**

Search the file for `better-icons` and `lottiefiles` references in the system prompt area — there should be none remaining (the MCP config references were already replaced in Task 2).

**Step 3: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(worker): replace icons/SVG prompt with Freepik premium-first asset strategy"
```

---

### Task 4: Update Creative Director system prompt

**Files:**
- Modify: `packages/api/src/agent/agent-system-prompt.ts:81-84`

**Step 1: Add asset-aware planning section**

After the `SCENE PLANS:` line (line 82) and before the `STYLES:` line (line 84), insert:

```typescript
ASSET-AWARE PLANNING:
The generation pipeline has access to Freepik's premium asset library — millions of icons, illustrations, vectors, and photos. When planning scenes, think in terms of PROFESSIONAL ASSETS, not crude shapes.
- Be specific about visual elements: "polished isometric server rack icon with gradient fill" not "a server"
- Mention desired style: "flat-design cloud icon matching the color palette" not "cloud shape"
- For illustrations: "vector illustration of neural network layers" not "some AI visual"
- For data/charts, say so explicitly: "animated bar chart showing growth" (these get hand-coded, not sourced from Freepik)
Think like a creative director briefing a motion designer who has access to a premium asset library.

```

This goes between the `SCENE PLANS:` paragraph and the `STYLES:` line so the Director sees it when writing scene descriptions.

**Step 2: Commit**

```bash
git add packages/api/src/agent/agent-system-prompt.ts
git commit -m "feat(api): add asset-aware planning to Creative Director system prompt"
```

---

### Task 5: Mark old design doc as superseded

**Files:**
- Modify: `docs/plans/2026-02-05-better-icons-integration-design.md:1-6`

**Step 1: Add superseded notice**

Add at the top of the file, before the existing title:

```markdown
> **SUPERSEDED** by `2026-02-16-freepik-mcp-integration-design.md` — Freepik MCP replaces better-icons.

```

**Step 2: Commit**

```bash
git add docs/plans/2026-02-05-better-icons-integration-design.md
git commit -m "docs: mark better-icons design as superseded by Freepik integration"
```

---

### Task 6: Ensure workspace `public/assets/` directory is created

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py` (workspace setup section)

**Step 1: Find the workspace directory creation**

Search for `mkdir` or directory creation near the workspace setup. The animator phase sets up the workspace structure before running Claude. Find where `src/{compositionId}` is created and add `public/assets/` creation alongside it.

**Step 2: Add assets directory creation**

After the existing workspace directory creation (where `src/` subdirectories are made), add:

```python
# Create public/assets directory for Freepik downloaded assets
assets_dir = self.workspace / "public" / "assets"
assets_dir.mkdir(parents=True, exist_ok=True)
```

This ensures the directory exists before the agent tries to `curl` assets into it.

**Step 3: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(worker): create public/assets directory for Freepik asset downloads"
```

---

### Task 7: Verify end-to-end with type checks

**Step 1: Type-check the API package**

```bash
cd packages/api && npx tsc --noEmit
```

Expected: No new errors (only pre-existing style type mismatch).

**Step 2: Type-check the worker package**

```bash
cd packages/worker && npx tsc --noEmit
```

Expected: No new errors (only pre-existing opacity/styleOverrides errors).

**Step 3: Verify Python syntax**

```bash
python3 -c "import ast; ast.parse(open('packages/worker/src/agents/claude_visual_generator.py').read()); print('OK')"
```

Expected: `OK` (no syntax errors).

**Step 4: Verify FREEPIK_API_KEY is accessible**

```bash
FREEPIK_API_KEY=test node -e "require('./packages/worker/src/config.ts')" 2>/dev/null || echo "Config loads via tsx at runtime, skip static check"
```

The env var flows through `process.env` → Python subprocess → `os.environ.get('FREEPIK_API_KEY')` → MCP server args. No runtime check needed since the MCP server will simply fail to auth if the key is missing (and the agent falls back to hand-coded SVGs per the prompt guardrail).

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: integrate Freepik MCP for premium visual assets

Replace better-icons and lottiefiles MCP servers with Freepik MCP in the
visual generator. Add premium-first asset strategy to system prompts for
both the Creative Director and visual generator agents.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary of all changes

| # | File | What changes |
|---|------|-------------|
| 1 | `packages/worker/src/config.ts` | Add `freepik.apiKey` config |
| 2 | `packages/worker/src/agents/claude_visual_generator.py:2783-2804` | Replace `allowed_tools` + `mcp_servers` (better-icons/lottiefiles → freepik) |
| 3 | `packages/worker/src/agents/claude_visual_generator.py:1761-1801` | Replace `<icons_and_svg>` with `<assets_and_visuals>` (premium-first Freepik prompt) |
| 4 | `packages/api/src/agent/agent-system-prompt.ts:82` | Add `ASSET-AWARE PLANNING` section to Creative Director prompt |
| 5 | `docs/plans/2026-02-05-better-icons-integration-design.md` | Mark as superseded |
| 6 | `packages/worker/src/agents/claude_visual_generator.py` | Add `public/assets/` dir creation in workspace setup |
