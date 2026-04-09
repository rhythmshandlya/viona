# Vox Explainer — Design System

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| background | {background} | Light backgrounds, off-white base |
| text | {text} | Primary text on light backgrounds |
| textMuted | {textMuted} | Secondary text, captions |
| accent | {accent} | THE signature yellow — highlighter, emphasis bars |
| secondary | {secondary} | Muted teal — secondary accent, borders, data viz |

### Extended Palette (hardcoded — not overridable via themes.json)

| Token | Hex | Usage |
|-------|-----|-------|
| deepPurple | #35313F | Dark backgrounds, cinematic overlays |
| lightGray | #BBBBBB | Tertiary text, borders |
| medGray | #AAAAAA | Disabled/muted elements |
| white | #FFFFFF | Text on dark backgrounds |
| warmBlack | #1A1A2E | Rich dark cinematic |
| mutedRed | #C84B4B | Negative/cons (never bright red) |
| mutedGreen | #5B8A72 | Positive/pros (never bright green) |

## Typography

| Role | Font | Weight | Size Range |
|------|------|--------|------------|
| Headline | Playfair Display | Bold (700) | s(48)–s(64) |
| Body | Inter | Regular–Medium (400–500) | s(24)–s(32) |
| Label | Inter | Medium (500), ALL-CAPS | s(18)–s(22) |
| Hero Number | Inter | Bold (700) | s(56)–s(72) |
| Mono/Code | JetBrains Mono | Regular (400) | s(20)–s(24) |

Font pair preset: `voxDocumentary`

## Spacing (at 1080px base, use s() for scaling)

| Token | Value |
|-------|-------|
| xs | 8 |
| sm | 16 |
| md | 24 |
| lg | 40 |
| xl | 64 |
| canvasEdge | 48 |

## Spring Configs

| Name | Damping | Stiffness | Mass | Usage |
|------|---------|-----------|------|-------|
| entrance | 20 | 180 | 1 | Primary element entrances |
| settle | 25 | 200 | 1 | Secondary element settling |

Vox uses mild overshoot (5-10% past target), NOT bouncy springs.

## Easing

| Name | Bezier | Usage |
|------|--------|-------|
| entrance | (0.25, 0.1, 0.25, 1.0) | Slide-in, reveals |
| exit | (0.4, 0.0, 1.0, 1.0) | Fade-out, exits |

## Timing

| Token | Frames | Usage |
|-------|--------|-------|
| stutterStep | 2.5 | 12fps stutter quantization (30fps/12fps) |
| entranceDuration | 10 | Default entrance |
| exitDuration | 8 | Default exit (75% of entrance) |
| staggerDelay | 5 | Between staggered items |
| holdMinimum | 20 | Minimum hold before exit |
| highlighterSpeed | 10 | Yellow highlight sweep |
| typewriterSpeed | 2 | Frames per character |

## Surface Treatment

Every scene MUST have:
1. Film grain — cycling noise at 25-35% opacity
2. Rough edges — feTurbulence displacement on rectangular shapes
3. NO drop shadows. NO gradients on text. NO glossy surfaces.

## Animation Language — "Deliberate Imperfection"

- ALL graphic elements animate at 12fps stutter (quantize frame to stutterStep intervals)
- Photographs and footage stay at full 30fps (smooth Ken Burns)
- Opacity transitions stay at full 30fps (stuttered opacity looks broken)
- Entrances: slide-in with easeOut, overshoot 5-10%
- Holds: micro-motion (0.5px vertical breathe, 60-frame period)
- Exits: reverse of entrance, 75% of entrance duration
