# Clipify Worker - OpenHands Agent Guidelines

## Purpose

Worker package for Clipify video generation. OpenHands agents generate Remotion compositions from transcripts.

## Skills

| Skill | Description |
|-------|-------------|
| remotion-best-practices | Frame-based animation patterns, hooks, forbidden patterns |
| visual-design | Style presets, glass morphism, gradients |
| animation-philosophy | Three Laws: continuous motion, conceptual, zero text |
| scene-planning | Chain-of-thought reasoning before coding |
| responsive-layout | Dimension-independent layouts using minDim |
| physics-effects | Gravity, bounce, particles, shake |
| transcript-to-visuals | Content-to-visual mapping |
| file-editing-guide | str_replace vs WriteFileTool patterns |
| reference-patterns | Production examples (search race, stack overflow, hash) |

## Critical Rules

### Remotion
- **Forbidden:** CSS transitions, @keyframes, setTimeout, useState for animation
- **Required:** Pure functions of frame, `useVideoConfig()`, `extrapolateRight: 'clamp'`

### Animation
1. Continuous motion throughout duration
2. Conceptual, not literal
3. Zero text overlays (subtitles handle text)

### Responsive
- Never hardcode pixels
- Use `minDim = Math.min(width, height)`

## Project Structure

```
packages/worker/
├── src/
│   ├── agents/           # Python agent implementations
│   ├── prompts/          # Prompt templates
│   └── processors/       # Job processors
└── .openhands/
    ├── AGENTS.md         # This file
    └── skills/           # name/description triggered skills
```

## Testing

```bash
npx tsc --noEmit                                    # TypeScript
npx remotion still ./src/index.ts <id> ./out.png   # Preview
npx remotion bundle ./src/index.ts                  # Bundle
```
