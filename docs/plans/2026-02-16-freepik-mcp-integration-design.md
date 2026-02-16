# Freepik MCP Integration Design

**Date:** 2026-02-16
**Status:** Approved
**Supersedes:** `2026-02-05-better-icons-integration-design.md`
**Goal:** Replace better-icons and lottiefiles MCP servers with Freepik MCP to give the visual generator access to millions of premium icons, illustrations, vectors, and photos.

## Decisions

| Decision | Choice |
|----------|--------|
| Asset source | Freepik (icons, vectors, illustrations, photos) |
| Integration point | Worker visual generator only (not Creative Director chat agent) |
| MCP deployment | Remote (`api.freepik.com/mcp` via `mcp-remote`) |
| Tools enabled | search_icons, download_icon, search_resources, download_resource (6 tools) |
| Asset usage | Download to workspace, inline SVG or staticFile() |
| Asset strategy | Premium-first — default to Freepik, hand-code only for dynamic data visualizations |
| Replaces | better-icons MCP + lottiefiles MCP |

## Architecture

```
Creative Director (API)              Visual Generator (Worker)
┌──────────────────────────┐         ┌─────────────────────────────────────┐
│ Plans scenes with         │         │ Claude Agent SDK                    │
│ asset-aware descriptions  │────────▶│   ↓                                │
│ "polished server icon"    │  scene  │ Freepik MCP Server (remote)        │
│ "gradient cloud visual"   │  plan   │   - search_icons("server rack")    │
│                           │         │   - download_icon_by_id(SVG)       │
│ No Freepik tools here     │         │   - search_resources("cloud")      │
└──────────────────────────┘         │   - download_resource_by_id        │
                                      │   ↓                                │
                                      │ Downloads to workspace/public/     │
                                      │   ↓                                │
                                      │ Writes Remotion components with    │
                                      │ inline SVGs + staticFile() refs    │
                                      │   ↓                                │
                                      │ Bundle (esbuild) → output          │
                                      └─────────────────────────────────────┘
```

## Freepik MCP Tools (6 tools)

| Tool | Purpose | When to use |
|------|---------|-------------|
| `search_icons` | Find icons by keyword with style/color filters | Any icon need (arrows, UI, concepts) |
| `get_icon_detail_by_id` | Get metadata for a specific icon | Preview before downloading |
| `download_icon_by_id` | Download icon as SVG/PNG | After finding the right icon |
| `search_resources` | Find photos, vectors, illustrations | Hero visuals, backgrounds, illustrations |
| `get_resource_detail_by_id` | Get resource metadata and formats | Check available formats |
| `download_resource_by_id` | Download a resource file | After finding the right resource |

## System Prompt Strategy

### Layer 1: Creative Director (`agent-system-prompt.ts`)

Short addition to existing prompt. Teaches the Director to write asset-aware scene descriptions:

```
ASSET-AWARE PLANNING:
The generation pipeline has access to Freepik's premium asset library — millions of
icons, illustrations, vectors, and photos. Plan scenes with PROFESSIONAL ASSETS in mind.

When writing scene descriptions, be specific:
- "polished isometric server rack icon with gradient fill" not "a server"
- "flat-design cloud icon matching the blue palette" not "cloud shape"
- "vector illustration of neural network layers" not "some AI visual"
- For data/charts: "animated bar chart showing growth" (these are hand-coded, be explicit)

Think like a creative director briefing a motion designer who has a premium asset library.
```

### Layer 2: Visual Generator (`claude_visual_generator.py`)

Replace the `<icons_and_svg>` section (~line 1761-1801) with comprehensive asset instructions:

```
<assets_and_visuals>
## PREMIUM ASSET LIBRARY — FREEPIK

You have access to Freepik's library of millions of premium icons, illustrations,
vectors, and photos via MCP tools. USE THEM. Your visuals should look like they
came from a professional motion design studio.

### DECISION FRAMEWORK

| Visual Need | Use | Why |
|------------|-----|-----|
| Any icon (arrows, UI, concepts) | Freepik search_icons → download_icon_by_id (SVG) | Professional, consistent |
| Illustrations (objects, scenes, people) | Freepik search_resources (vector) | Hand-drawn quality impossible with code |
| Background textures/patterns | Freepik search_resources (vector) | Rich visual depth |
| Data visualizations (charts, graphs) | Hand-coded SVG + Remotion animation | Needs dynamic values |
| Flowcharts / process diagrams | Hand-coded SVG with Freepik icons as nodes | Structure + polish |
| Abstract concepts (AI, growth, speed) | Freepik illustration + animation | Conveys concept instantly |

**RULE: Default to Freepik. Only hand-code when data is dynamic.**

If you're about to write an SVG path by hand, STOP and ask: "Does Freepik have
something better?" The answer is almost always yes.

### SEARCHING

Icons:
  search_icons({ term: "cloud computing", filters: { shape: "fill" } })
  search_icons({ term: "server", filters: { icon_type: ["standard"] } })

Search CONCEPTS, not literal descriptions. "growth" not "line going up".
Try 2-3 terms if first doesn't match: "database" → "storage" → "server rack".

Resources (illustrations, vectors):
  search_resources({ term: "isometric cloud infrastructure",
                     filters: { content_type: { vector: 1 } } })

Prefer vectors over photos — cleaner scaling, transparent backgrounds.

### USING DOWNLOADED ASSETS

Icons (SVG) — inline in JSX:
1. download_icon_by_id({ id: 12345, format: "svg" }) → URL
2. Bash: curl -sL -o public/assets/icon-name.svg "URL"
3. Read SVG file, paste markup into JSX
4. Wrap in animated container with spring/interpolate

Resources (images) — use staticFile:
1. download_resource_by_id({ resource-id: 67890 }) → URL
2. Bash: curl -sL -o public/assets/illustration.png "URL"
3. <Img src={staticFile('assets/illustration.png')} style={...} />
4. Animate with opacity, scale, position transforms

### ANIMATION WITH ASSETS

Don't just plop assets on screen. Animate them:
- Icons: spring scale-in, stroke draw effect, color transitions
- Illustrations: parallax layers, reveal masks, zoom-and-pan
- Backgrounds: subtle drift, gradient overlay animation

### GUARDRAILS

- ASSET BUDGET: 1-3 icons per scene, 0-1 illustration. Don't clutter.
- SEARCH BUDGET: 1-2 searches per concept. Don't spend 10 turns browsing.
- STYLE CONSISTENCY: Pick ONE icon style (fill OR outline) for all scenes. Match colors to style preset.
- FALLBACK: If download fails, hand-code a clean SVG. Never let asset failure break a scene.
- NO PHOTO BACKGROUNDS: Photos behind animated elements create noise. Use solid colors/gradients.
  Photos work as hero images, not backdrops.
- FIRST SCENE SETS THE STYLE: All subsequent scenes must match the asset family.
</assets_and_visuals>
```

## Files Modified

| File | Change |
|------|--------|
| `packages/worker/src/agents/claude_visual_generator.py` | Replace MCP servers config (~line 2793), replace `<icons_and_svg>` system prompt section (~line 1761), update allowed_tools (~line 2783) |
| `packages/worker/src/config.ts` | Add `freepik.apiKey` from `FREEPIK_API_KEY` env var |
| `packages/api/src/agent/agent-system-prompt.ts` | Add asset-aware planning section to Creative Director prompt |
| `docs/plans/2026-02-05-better-icons-integration-design.md` | Mark as superseded |

## Files NOT Changed

- **Frontend** — Assets baked into Remotion components at build time, no runtime fetching
- **Bundling pipeline** — SVGs are JSX, images use staticFile(), both already supported
- **Agent tools** (`agent-tools.ts`) — Creative Director doesn't call Freepik directly
- **TypeScript visual generator** (`claude-sdk/visual-generator.ts`) — Not actively used (Python generator is primary)

## Environment Setup

```env
FREEPIK_API_KEY=FPSX70f3938ef7bef7f4b3740afb10ee7ff3
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| MCP remote server latency | +1-2s per API call | Acceptable; searches happen during planning, not blocking render |
| Freepik API rate limits | Generation fails mid-scene | Asset budget guardrail (1-2 searches per concept) limits total calls |
| Downloaded asset too large | Bundle size bloat | Prefer SVG icons (tiny) and constrained image sizes |
| Agent ignores Freepik tools | Falls back to crude SVGs | "Premium-first" prompt + decision framework make it the default |
| Agent over-uses Freepik | Slow generation, cluttered visuals | Asset budget per scene (1-3 icons, 0-1 illustration) |
| Style inconsistency across scenes | Mismatched icon families | "First scene sets the style" guardrail |
| MCP server fails to start | No asset access | Fallback instruction: hand-code clean SVGs |

## Verification

1. Generate visuals for a tech explainer transcript → agent searches Freepik for icons, downloads SVGs, inlines them in components
2. Check icon style consistency across all scenes (all fill OR all outline, matching colors)
3. Verify illustrations use staticFile() and render correctly in Remotion player
4. Confirm no more than 2-3 search calls per scene (not spamming the API)
5. Test fallback: disconnect Freepik → agent should still produce clean hand-coded visuals
6. Verify Creative Director scene descriptions reference asset types ("polished icon" not "shape")
