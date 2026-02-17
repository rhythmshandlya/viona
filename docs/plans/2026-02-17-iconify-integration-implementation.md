# Iconify (better-icons) Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Re-enable Iconify icon access via better-icons MCP alongside Freepik, giving the visual generator dual asset sources.

**Architecture:** Add `better-icons` as a second MCP server in the Python visual generator's Claude Agent SDK config. Update the system prompt to teach the agent when to use Iconify vs Freepik. Add the entry to `.mcp.json` for local dev.

**Tech Stack:** Python (visual generator agent), Claude Agent SDK MCP config, better-icons npm package (already installed)

---

### Task 1: Add better-icons MCP server and tools to visual generator

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py:2888-2909`

**Step 1: Add Iconify tools to allowed_tools**

In `packages/worker/src/agents/claude_visual_generator.py`, find the `allowed_tools` list at ~line 2888. Add the 4 Iconify tool entries after the Freepik tools:

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
                    # Iconify MCP tools (200k+ open-source icons via better-icons)
                    "mcp__better-icons__search_icons",
                    "mcp__better-icons__get_icon",
                    "mcp__better-icons__recommend_icons",
                    "mcp__better-icons__find_similar_icons",
                ],
```

**Step 2: Add better-icons MCP server config**

In the same file, find the `mcp_servers` dict at ~line 2898. Add the `better-icons` entry after the `freepik` entry:

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
                    },
                    "better-icons": {
                        "type": "stdio",
                        "command": "npx",
                        "args": ["better-icons"]
                    }
                },
```

**Step 3: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(worker): add better-icons MCP server alongside Freepik"
```

---

### Task 2: Update system prompt with dual-source asset guidance

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py:1740-1839`

**Step 1: Replace the `<assets_and_visuals>` section**

Find the `<assets_and_visuals>` block (lines 1740-1839). Replace the entire section with the dual-source version below. The section starts with `<assets_and_visuals>` and ends with `</assets_and_visuals>`.

Replace:
- Line 1741: `## PREMIUM ASSET LIBRARY — FREEPIK` → `## PREMIUM ASSET LIBRARIES — FREEPIK + ICONIFY`
- Lines 1743-1760: Replace the `<MANDATORY_ASSET_RULE>` block to cover both sources
- Lines 1762-1777: Replace single-source intro and decision framework with dual-source version
- Lines 1779-1839: Keep search/usage/animation/guardrails sections but add Iconify equivalents

The new `<assets_and_visuals>` section (replace lines 1740-1839 entirely):

```
<assets_and_visuals>
## PREMIUM ASSET LIBRARIES — FREEPIK + ICONIFY

<MANDATORY_ASSET_RULE>
**YOU MUST DOWNLOAD AND USE PROFESSIONAL ASSETS. DO NOT HAND-CODE SVG ICONS.**

❌ DO NOT search for icons and then write your own SVG instead
❌ DO NOT skip the download step "for speed" or "more control"
❌ DO NOT write SVG paths by hand when Freepik or Iconify has the icon
❌ DO NOT rationalize skipping downloads — this is a HARD REQUIREMENT

✅ Search → Download/Get → Read SVG → Paste into JSX → Animate
✅ EVERY icon in your scene MUST come from Freepik or Iconify
✅ The ONLY exception is if the download/get tool itself errors/fails
</MANDATORY_ASSET_RULE>

You have TWO asset libraries. Your visuals should look like they came from a
professional motion design studio, not a coding tutorial.

### DUAL ASSET SOURCES

1. **Freepik** (premium icons, illustrations, vectors, photos)
   - Best for: premium illustrations, complex vectors, photos, branded assets
   - Tools: `search_icons` → `download_icon_by_id`, `search_resources` → `download_resource_by_id`

2. **Iconify / better-icons** (200k+ open-source icons from 150+ collections)
   - Best for: clean UI-style icons, consistent icon sets (Lucide, Material, Heroicons, Tabler, Phosphor)
   - Tools: `search_icons`, `get_icon`, `recommend_icons`, `find_similar_icons`
   - Icon ID format: `prefix:name` (e.g., `lucide:home`, `mdi:chart-bar`)

### DECISION FRAMEWORK — What to use when

| Visual Need | Use | Why |
|------------|-----|-----|
| UI icons (arrows, chevrons, checkmarks) | Iconify `search_icons` → `get_icon` | Consistent sets, clean stroke/fill |
| Concept icons (lightbulb, rocket, gear) | Iconify `search_icons` → `get_icon` | Fast, many variations across collections |
| Multiple matching icons from one set | Iconify (pick a prefix like `lucide:`) | Collections ensure consistency |
| Premium illustrations (isometric, 3D) | Freepik `search_resources` → `download_resource_by_id` | Hand-drawn quality impossible with code |
| Photos, textures, backgrounds | Freepik `search_resources` → `download_resource_by_id` | Only source for photos |
| Branded/complex visuals | Freepik `search_icons` → `download_icon_by_id` | Premium library |
| Data visualizations (charts, graphs) | Hand-coded SVG + Remotion animation | Needs dynamic values |
| Flowcharts / process diagrams | Hand-coded SVG with Iconify/Freepik icons as nodes | Best of both |

**RULE: For simple/UI icons, start with Iconify (faster, consistent sets). For rich visuals and illustrations, use Freepik. Only hand-code SVGs for dynamic data.**

### HOW TO SEARCH EFFECTIVELY

**Iconify (better-icons):**
- `search_icons` with query: "arrow right", "chart bar", "cloud server"
- Search CONCEPTS, not literal descriptions
- Get SVG: `get_icon` with icon ID like "lucide:arrow-right" returns SVG markup directly
- Popular prefixes: lucide, mdi, heroicons, tabler, ph (phosphor)
- Use `find_similar_icons` to explore variations across collections
- Use `recommend_icons` when unsure which icon fits a concept

**Freepik:**
- `search_icons` with `term` parameter: "cloud computing", "server rack", "neural network"
- Filter by shape: "fill" for solid icons, "outline" for line icons
- Filter by icon_type: ["standard"] for static, ["animated"] for motion
- `search_resources` with `term` and content_type filter: {{ content_type: {{ vector: 1 }} }}
- Prefer vectors over photos — cleaner scaling, transparent backgrounds
- Try 2-3 search terms if the first doesn't match

### HOW TO USE DOWNLOADED ASSETS

**Iconify icons — inline in JSX:**
1. `get_icon` with icon ID (e.g., "lucide:zap") → returns SVG markup
2. Paste the SVG markup directly into your JSX component
3. Replace hardcoded width/height with style prop: `style={{{{ width: minDim * 0.08, height: minDim * 0.08 }}}}`
4. Use `currentColor` for dynamic coloring: wrap in div with `color: COLORS.accent`
5. Animate the wrapper with spring/interpolate

**Freepik icons (SVG) — download then inline:**
1. `download_icon_by_id` with id and format="svg" → returns {{ data: {{ url, filename }} }}
2. Download with Bash: `curl -sL -o public/assets/icon-name.svg "URL"`
3. Read the SVG file content with the Read tool
4. Paste the SVG markup directly into your JSX component
5. Replace hardcoded width/height with style prop
6. Use `currentColor` for dynamic coloring
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
    {{/* SVG paths from Iconify or Freepik download */}}
  </svg>
</div>
```

### GUARDRAILS

- **ASSET BUDGET**: 1-3 icons per scene, 0-1 illustration per scene. Don't clutter.
- **SEARCH BUDGET**: 1-2 searches per concept max. Don't spend 10 turns browsing.
- **STYLE CONSISTENCY**: Pick ONE icon style (fill OR outline) in the FIRST scene and use it for ALL scenes. If using Iconify, stick to ONE prefix (e.g., all `lucide:` or all `tabler:`). Match icon colors to the style preset's color scheme.
- **FALLBACK**: ONLY if the download/get tool returns an error or search returns zero results after 2-3 different search terms, hand-code a clean SVG.
- **NO PHOTO BACKGROUNDS**: Photos behind animated elements create visual noise. Use solid colors or subtle gradients.
- **FIRST SCENE SETS THE STYLE**: Whatever asset family/style you pick in scene 1, ALL subsequent scenes must match.
- **ALWAYS CREATE public/assets/ DIRECTORY**: Before downloading any Freepik assets, run `mkdir -p public/assets` in Bash.
</assets_and_visuals>
```

**Step 2: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(worker): update system prompt with dual Iconify+Freepik asset guidance"
```

---

### Task 3: Add better-icons to project .mcp.json

**Files:**
- Modify: `.mcp.json` (project root)

**Step 1: Add better-icons entry**

Add the `better-icons` MCP server entry to the existing `.mcp.json`:

```json
{
  "mcpServers": {
    "freepik": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://api.freepik.com/mcp",
        "--header",
        "x-freepik-api-key:FPSX70f3938ef7bef7f4b3740afb10ee7ff3"
      ]
    },
    "motion-dev": {
      "command": "node",
      "args": [
        "/Users/sarthakpant/motion-dev-mcp/dist/index.js"
      ]
    },
    "better-icons": {
      "command": "npx",
      "args": ["better-icons"]
    }
  }
}
```

**Step 2: Commit**

```bash
git add .mcp.json
git commit -m "feat: add better-icons MCP to project config"
```

---

### Task 4: Verify integration works

**Step 1: Test better-icons MCP starts**

```bash
cd /Users/sarthakpant/project/clippify && npx better-icons --help
```

Expected: Help output from better-icons showing available commands (search, get, etc.)

**Step 2: Test icon search works**

```bash
cd /Users/sarthakpant/project/clippify && npx better-icons search arrow
```

Expected: List of arrow icons with IDs like `lucide:arrow-right`, `mdi:arrow-left`, etc.

**Step 3: Test icon retrieval works**

```bash
cd /Users/sarthakpant/project/clippify && npx better-icons get lucide:home
```

Expected: SVG markup output for the home icon

**Step 4: Final commit with verification note**

```bash
git add -A
git commit -m "chore: verify better-icons MCP integration works"
```

Only commit if there are changes (e.g., lockfile updates). Skip if working tree is clean.

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Add MCP server + tools to visual generator | `claude_visual_generator.py:2888-2909` |
| 2 | Update system prompt with dual-source guidance | `claude_visual_generator.py:1740-1839` |
| 3 | Add to project `.mcp.json` | `.mcp.json` |
| 4 | Verify integration | CLI tests |
