# Iconify (better-icons) Integration Design

**Date:** 2026-02-17
**Status:** Approved
**Goal:** Re-enable Iconify icon access via better-icons MCP alongside existing Freepik MCP, giving the visual generator agent dual asset sources — Iconify for clean, consistent open-source icons and Freepik for premium illustrations/vectors/photos.

## Decisions

| Decision | Choice |
|----------|--------|
| Icon source | better-icons (200k+ icons via Iconify) alongside Freepik |
| Integration | MCP server (re-enable existing dependency) |
| Selection strategy | Agent chooses best fit — Iconify for UI/concept icons, Freepik for premium visuals |
| API key | None required (Iconify API is free/open) |
| Tool count | 4 Iconify tools + 6 Freepik tools = 10 MCP tools total |

## Architecture

```
Visual Generator (Worker)
┌─────────────────────────────────────────────────┐
│ Claude Agent SDK                                │
│   ↓                                             │
│ ┌─────────────────────┐  ┌────────────────────┐ │
│ │ Freepik MCP (remote)│  │ better-icons MCP   │ │
│ │ - search_icons      │  │ - search_icons     │ │
│ │ - download_icon     │  │ - get_icon         │ │
│ │ - search_resources  │  │ - recommend_icons  │ │
│ │ - download_resource │  │ - find_similar     │ │
│ └─────────────────────┘  └────────────────────┘ │
│   ↓                         ↓                   │
│ Premium illustrations    Clean UI-style icons   │
│ Photos, vectors          150+ collections       │
│   ↓                         ↓                   │
│ Both → inline SVG in Remotion components        │
│   ↓                                             │
│ Bundle (esbuild) → output                       │
└─────────────────────────────────────────────────┘
```

## When to Use Which

| Need | Source | Why |
|------|--------|-----|
| UI icons (arrows, chevrons, checkmarks) | Iconify | Consistent sets, clean stroke/fill |
| Concept icons (lightbulb, rocket, gear) | Iconify | Fast, many variations across collections |
| Premium illustrations (isometric, 3D) | Freepik | Hand-drawn quality |
| Photos, textures, backgrounds | Freepik | Only source for photos |
| Branded/complex visuals | Freepik | Premium library |
| Multiple matching icons from same set | Iconify | Collections ensure consistency |

**Rule:** For simple icons, start with Iconify (faster, consistent sets). For rich visuals, use Freepik.

## Implementation

### 1. MCP Server Configuration

Add `better-icons` as a second MCP server in `packages/worker/src/agents/claude_visual_generator.py` (~line 2898):

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
}
```

### 2. Allowed Tools

Add 4 Iconify tools to `allowed_tools` (~line 2888):

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
    # Iconify MCP tools (200k+ open-source icons)
    "mcp__better-icons__search_icons",
    "mcp__better-icons__get_icon",
    "mcp__better-icons__recommend_icons",
    "mcp__better-icons__find_similar_icons",
],
```

### 3. System Prompt Update

Replace the single-source asset section with dual-source guidance in the `<assets_and_visuals>` system prompt section:

```
### DUAL ASSET SOURCES

You have TWO asset libraries:

1. **Freepik** (premium icons, illustrations, vectors, photos)
   - Best for: premium illustrations, complex vectors, photos, branded assets
   - Tools: search_icons, download_icon_by_id, search_resources, download_resource_by_id

2. **Iconify / better-icons** (200k+ open-source icons from 150+ collections)
   - Best for: clean UI-style icons, consistent icon sets (Lucide, Material, Heroicons, Tabler, Phosphor)
   - Tools: search_icons, get_icon, recommend_icons, find_similar_icons
   - Icon ID format: `prefix:name` (e.g., lucide:home, mdi:chart-bar)

### WHEN TO USE WHICH

| Need | Source | Why |
|------|--------|-----|
| UI icons (arrows, chevrons, checkmarks) | Iconify | Consistent sets, clean stroke/fill |
| Concept icons (lightbulb, rocket, gear) | Iconify | Fast, many variations across collections |
| Premium illustrations (isometric, 3D) | Freepik | Hand-drawn quality |
| Photos, textures, backgrounds | Freepik | Only source for photos |
| Branded/complex visuals | Freepik | Premium library |
| Need multiple matching icons from same set | Iconify | Collections ensure consistency |

**RULE: For simple icons, start with Iconify (faster, consistent sets). For rich visuals, use Freepik.**
```

### 4. Project MCP Config

Add `better-icons` to `.mcp.json` for local dev/testing:

```json
{
  "mcpServers": {
    "freepik": { ... },
    "motion-dev": { ... },
    "better-icons": {
      "command": "npx",
      "args": ["better-icons"]
    }
  }
}
```

## Files Modified

| File | Change |
|------|--------|
| `packages/worker/src/agents/claude_visual_generator.py` | Add `better-icons` to `mcp_servers`, add 4 tools to `allowed_tools`, update `<assets_and_visuals>` system prompt section |
| `.mcp.json` | Add `better-icons` entry |

## Files NOT Changed

- `packages/worker/package.json` — `better-icons@^1.0.0` already listed as dependency
- Frontend — icons baked into generated code at build time
- Creative Director prompt — already asset-aware, no changes needed
- Bundling pipeline — SVGs are JSX, already handled

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Extra MCP server startup time | +1-2s per generation | Acceptable; both start in parallel |
| Agent overwhelmed by 10 MCP tools | Confused tool selection | Decision framework in prompt makes selection clear |
| Tool name collision (both have `search_icons`) | Agent calls wrong one | MCP namespacing (`mcp__freepik__` vs `mcp__better-icons__`) prevents collision |
| better-icons server fails | No Iconify access | Agent falls back to Freepik for all assets |

## Verification

1. Generate visuals and confirm agent uses Iconify for simple UI icons (arrows, checkmarks)
2. Confirm agent uses Freepik for premium illustrations and photos
3. Verify icons from both sources render correctly in Remotion player
4. Check that both MCP servers start without errors
5. Confirm no tool name conflicts in agent output
