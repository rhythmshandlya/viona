# Clipify Worker - OpenHands Agent Guidelines

## Repository Purpose

This is the **worker package** for Clipify - a video generation platform. The worker uses OpenHands agents to generate Remotion video compositions from transcripts.

## Agent Architecture

### Generator Agent
Creates Remotion compositions from transcripts using:
- `remotion-best-practices` - Frame-based animation patterns
- `visual-design` - Style presets and visual components
- `animation-philosophy` - Three Laws of Meaningful Animation
- `scene-planning` - Chain of Thought reasoning before coding
- `responsive-layout` - Dimension-independent layouts
- `physics-effects` - Gravity, bounce, particles
- `transcript-to-visuals` - Content-to-visual mapping
- `reference-patterns` - Production-ready examples

### Critic Agent
Evaluates generated compositions:
- TypeScriptValidatorTool - Check for compile errors
- RemotionBundleTool - Verify bundle succeeds
- RemotionRenderStillTool - Visual inspection at 0%, 50%, 100%

## Project Structure

```
packages/worker/
├── src/
│   ├── agents/           # Python agent implementations
│   │   └── visual_generator.py
│   ├── prompts/          # Prompt templates
│   │   ├── generate-visuals.ts
│   │   ├── visual-references.ts
│   │   └── physics-helpers.ts
│   └── processors/       # Job processors
├── .openhands/
│   ├── AGENTS.md         # This file
│   └── skills/           # Keyword-triggered skills
│       ├── remotion-best-practices/
│       ├── visual-design/
│       ├── animation-philosophy/
│       ├── scene-planning/
│       ├── responsive-layout/
│       ├── physics-effects/
│       ├── transcript-to-visuals/
│       ├── file-editing-guide/
│       └── reference-patterns/
└── skills/               # Legacy skill location (deprecated)
```

## Critical Rules

### Remotion Rendering
- **FORBIDDEN:** CSS transitions, @keyframes, setTimeout, useState for animation
- **REQUIRED:** Pure functions of frame number, useVideoConfig() for dimensions
- **REQUIRED:** `extrapolateRight: 'clamp'` on all interpolate() calls
- **REQUIRED:** `fps` parameter in all spring() calls
- **REQUIRED:** `key` prop on all .map() elements

### Animation Philosophy
1. **CONTINUOUS MOTION** - Not just entrance effects
2. **CONCEPTUAL, NOT LITERAL** - Show WHY, not just WHAT
3. **ZERO TEXT OVERLAYS** - Subtitles handle text

### Responsive Design
- Never hardcode pixel values
- Use `const minDim = Math.min(width, height)`
- All sizes relative to width/height/minDim

## Iterative Refinement Loop

```
Generator → Critic → Score < 90? → Feedback → Generator (max 3 iterations)
```

Quality threshold: **90/100** to pass

## Testing Commands

```bash
# TypeScript validation
npx tsc --noEmit

# Render preview frame
npx remotion still ./src/index.ts <compositionId> ./preview.png --frame=0

# Bundle for production
npx remotion bundle ./src/index.ts
```

## Skills Trigger Reference

| Skill | Triggers |
|-------|----------|
| remotion-best-practices | remotion, video composition, frame animation, useCurrentFrame, spring |
| visual-design | visual design, style preset, color palette, glass morphism |
| animation-philosophy | meaningful animation, continuous motion, visual storytelling |
| scene-planning | scene plan, reasoning, conceptual animation, beat-by-beat |
| responsive-layout | responsive, dimension, minDim, hardcoded pixels |
| physics-effects | physics, gravity, bounce, squash stretch, particles |
| transcript-to-visuals | transcript, content mapping, visual segment, stat counter |
| file-editing-guide | str_replace, file editing, WriteFileTool, line numbers |
| reference-patterns | search race, stack overflow, hash collisions, reference example |
