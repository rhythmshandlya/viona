> **SUPERSEDED** by `2026-02-16-freepik-mcp-integration-design.md` — Freepik MCP replaces better-icons.

# Better Icons Integration Design

**Date:** 2026-02-05
**Status:** Superseded
**Goal:** Enable the visual generator agent to use professional icons and custom SVG illustrations instead of emojis

## Overview

Integrate the `better-icons` MCP server with the Claude visual generator to give the agent access to 200,000+ icons from 150+ collections (Lucide, Material, Heroicons, Tabler, Phosphor, etc.) via Iconify.

## Decisions

| Decision | Choice |
|----------|--------|
| Icon source | better-icons (200k+ icons via Iconify) |
| Integration | MCP server (native tools for agent) |
| Custom illustrations | Inline SVG generation by agent |
| Icon discovery | Agent searches by concept |
| SVG usage | Inline in JSX |
| Animation | Full support (scale, rotation, color, stroke effects) |
| Limits | None - agent decides based on content |

## Architecture

```
Backend (Worker)                         Frontend (Web)
┌─────────────────────────────────────┐  ┌─────────────────────────────┐
│ Claude Agent                        │  │ DynamicVisualLoader         │
│   ↓                                 │  │                             │
│ better-icons MCP Server             │  │ Renders generated React     │
│   - search_icons("chart")           │  │ components with inline      │
│   - get_icon("lucide:bar-chart")    │  │ SVGs baked in               │
│   ↓                                 │  │                             │
│ Returns SVG: "<svg>...</svg>"       │  │ No icon library needed      │
│   ↓                                 │  │ No runtime fetching         │
│ Agent writes inline SVG to          │  │                             │
│ index.tsx with animations           │  └─────────────────────────────┘
│   ↓                                 │              ▲
│ Bundle (esbuild)  ──────────────────┼──────────────┘
└─────────────────────────────────────┘
```

Icons are retrieved at **generation time** and baked into the component code. The frontend receives static SVG elements - no runtime dependencies.

## Implementation

### 1. MCP Server Configuration

Modify `packages/worker/src/agents/claude_visual_generator.py` to add better-icons as an MCP server:

```python
# In the ClaudeSDKClient initialization (~line 2155)
client = ClaudeSDKClient(
    options=ClaudeAgentOptions(
        model=self.model,
        system_prompt=system_prompt,
        cwd=str(self.workspace),
        max_turns=self.max_turns,
        max_thinking_tokens=self.max_thinking_tokens,
        allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
        mcp_servers={
            "better-icons": {
                "type": "stdio",
                "command": "npx",
                "args": ["better-icons"]
            }
        },
        hooks={
            "PreToolUse": [
                HookMatcher(matcher="Bash", hooks=[bash_security_hook]),
            ],
        },
    )
)
```

**Tools the agent gains:**
- `search_icons` - Find icons by concept (e.g., "arrow", "chart", "user")
- `get_icon` - Retrieve SVG code with optional color/size
- `recommend_icons` - Get suggestions for use cases
- `find_similar_icons` - Find variations across collections

### 2. System Prompt Additions

Add the following sections to `_build_system_prompt()`:

```python
## ICONS & VISUALS

You have access to 200,000+ icons via the better-icons MCP tools:

1. **Search for icons**: Use `search_icons` with descriptive queries
   - Example: search_icons("arrow right") → finds arrow icons
   - Example: search_icons("chart bar") → finds chart icons

2. **Get SVG code**: Use `get_icon` with the icon ID
   - Example: get_icon("lucide:arrow-right") → returns SVG markup
   - Icon ID format: `prefix:name` (e.g., lucide:home, mdi:chart-bar)

3. **Popular collections**: lucide, mdi, heroicons, tabler, ph (phosphor)

**Using icons in components:**
- Inline the SVG directly in JSX
- Wrap in a container div for positioning/animation
- Remove hardcoded width/height, use style prop instead

**Example:**
```tsx
// Get icon via: get_icon("lucide:zap", { color: "currentColor" })
<div style={{ color: COLORS.accent, transform: `scale(${scale})` }}>
  <svg viewBox="0 0 24 24" style={{ width: 48, height: 48 }}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>
  </svg>
</div>
```

**Custom SVGs:** For diagrams, flowcharts, or concepts without matching icons,
write inline SVG code directly. Use simple shapes: rect, circle, path, line.
```

### 3. SVG Animation Patterns

Add to the animation rules section of the system prompt:

```python
## SVG ANIMATION PATTERNS

**1. Scale & Fade Entry:**
```tsx
const frame = useCurrentFrame();
const scale = spring({ frame, fps, config: { damping: 22, stiffness: 90 } });
const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

<div style={{ opacity, transform: `scale(${scale})` }}>
  <svg>...</svg>
</div>
```

**2. Rotation:**
```tsx
const rotation = interpolate(frame, [0, 30], [0, 360]);
<svg style={{ transform: `rotate(${rotation}deg)` }}>...</svg>
```

**3. Stroke Draw-in Effect:**
```tsx
// For icons with stroke paths
const progress = spring({ frame: frame - delay, fps, config: { damping: 30 } });
const strokeDashoffset = interpolate(progress, [0, 1], [100, 0]);

<svg>
  <path
    d="..."
    fill="none"
    stroke={COLORS.accent}
    strokeWidth={2}
    strokeDasharray={100}
    strokeDashoffset={strokeDashoffset}
  />
</svg>
```

**4. Color Transitions:**
```tsx
const color = interpolateColors(frame, [0, 30], [COLORS.muted, COLORS.accent]);
<svg style={{ color }}><path fill="currentColor" .../></svg>
```

**Rules:**
- Stagger icon animations by 6+ frames (never all at once)
- Use springs for natural motion, interpolate for linear effects
- Keep strokeDasharray/strokeDashoffset values matched
```

### 4. Example Generated Output

```tsx
// src/proj_abc123/index.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, TIMING } from './constants';

export const ProjAbc123: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Icon animations - staggered entry
  const icon1Scale = spring({ frame, fps, config: { damping: 22, stiffness: 90 } });
  const icon2Scale = spring({ frame: frame - 8, fps, config: { damping: 22, stiffness: 90 } });
  const icon3Scale = spring({ frame: frame - 16, fps, config: { damping: 22, stiffness: 90 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Intro scene with icons */}
      <div style={{ display: 'flex', gap: 40, justifyContent: 'center', marginTop: 200 }}>

        {/* Icon 1: Lightbulb (lucide:lightbulb) */}
        <div style={{ transform: `scale(${icon1Scale})`, color: COLORS.accent }}>
          <svg viewBox="0 0 24 24" style={{ width: 64, height: 64 }} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
            <path d="M9 18h6"/><path d="M10 22h4"/>
          </svg>
        </div>

        {/* Icon 2: Arrow (lucide:arrow-right) */}
        <div style={{ transform: `scale(${icon2Scale})`, color: COLORS.text }}>
          <svg viewBox="0 0 24 24" style={{ width: 64, height: 64 }} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
          </svg>
        </div>

        {/* Icon 3: Rocket (lucide:rocket) */}
        <div style={{ transform: `scale(${icon3Scale})`, color: COLORS.accent }}>
          <svg viewBox="0 0 24 24" style={{ width: 64, height: 64 }} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

## Files to Modify

| File | Changes |
|------|---------|
| `packages/worker/src/agents/claude_visual_generator.py` | Add `mcp_servers` config, update system prompt |
| `packages/worker/package.json` | Add `better-icons` as dev dependency |

## Files NOT Changed

- **Frontend** - Icons are baked into generated code at build time
- **DynamicVisualLoader** - Already handles inline SVGs in JSX
- **Bundling pipeline** - SVGs are just JSX, no special handling needed

## Testing

1. Run a generation with a transcript mentioning concepts with clear icon matches:
   - "lightbulb moment" → should use lightbulb icon
   - "rocket growth" → should use rocket icon
   - "chart showing data" → should use chart icon

2. Verify agent behavior:
   - Calls `search_icons` to find relevant icons
   - Calls `get_icon` to retrieve SVG code
   - Inlines SVG with proper Remotion animations

3. Check output quality:
   - SVGs render correctly in Remotion player
   - Animations are smooth and staggered
   - No runtime errors from missing dependencies

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| MCP server startup latency | +1-2s per generation | Acceptable for quality improvement |
| No icon found for concept | Falls back to emoji/text | Agent instructed to write custom SVG |
| Large SVGs bloat composition | Larger bundle size | Iconify SVGs are optimized; unlikely issue |
| MCP server crashes | Generation fails | Retry logic already in place |

## References

- [better-icons GitHub](https://github.com/better-auth/better-icons)
- [Claude Agent SDK MCP docs](https://docs.claude.com/en/docs/agent-sdk/mcp)
- [Iconify API](https://api.iconify.design)
