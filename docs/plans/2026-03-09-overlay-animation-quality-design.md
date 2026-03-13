# Overlay Animation Quality Improvements Design

**Date:** 2026-03-09
**Status:** Approved

## Problem Statement

Current overlay animations look flat and amateur — simple fade-ins, overdamped springs, no visual variety. Research shows professional overlays use combined entrance patterns (opacity + translate + scale), snappier springs for emphasis, HUD-style techniques, and visual changes every 3 seconds.

## Changes

### All Modes
1. **3-Second Pacing Rule** — Director enforces visual change every ~90 frames across all display modes

### Overlay Mode Only
2. **HUD Aesthetic Vocabulary** — scan lines, glow pulses, animated borders, data viz patterns
3. **Quantized Frame Rate Trick** — opt-in 15fps motion for stylized hand-crafted feel
4. **Dynamic Spring Configs** — two tiers: default (damping 22-28) and hero/emphasis (damping 14-18)
5. **Combined Entrance Pattern** — replace simple fade-in default with opacity + translateY + scale
6. **Variable Font Weight Animation** — opt-in technique for emphasis on sync words

## Scope

All changes are prompt-only (markdown files). No pipeline or code changes needed.

- Director: `packages/worker/src/prompts/director/system.md`
- Animator overlay: `packages/worker/src/prompts/animator/overlay-rules.md`
