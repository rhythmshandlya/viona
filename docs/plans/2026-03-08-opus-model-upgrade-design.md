# Design: Move All Visual Generation Agents to Opus + Extended Thinking

## Problem

Generated visuals for project `aa0b7b70` scored 3/10. Analysis of 9 generated scenes revealed systemic issues:

1. **Not studio theme** — ignores `useScale()`, `FONT_PAIRS`, `BACKGROUNDS`, `CardShell`; uses raw pixel values, inline font families, custom aquatic color palette instead of studio theme colors
2. **No studio background** — custom Background.tsx with wrong DotGrid values, water-themed effects, photo backgrounds (violates "NO PHOTO BACKGROUNDS" rule)
3. **No movement** — elements fade in then freeze; "breathing" animations are invisible (0.8% scale, 2px float)
4. **Empty space** — Scene 4 has 55% empty screen, Scene 8 is 66% empty before hero text
5. **Flat globe** — Scene 7 uses `rotateY()` on a 2D `<div>` with `borderRadius: 50%` (squishes horizontally)
6. **Caption duplication** — Scenes 1, 2, 4, 8 display narrator's words verbatim as visual content
7. **Emojis as icons** — swimmer emoji, chart emoji used as "professional" icons
8. **Same visual recipe x9** — every scene: dark bg + glassmorphic blur + text + particles
9. **Wrong DotGrid values** — Scenes 2, 3, 5 still use `40/40/1.5` instead of `80/80/3`

## Root Cause

The prompts already contain comprehensive rules covering all these issues (studio theme immersion, template reading, no emojis, motion choreography, DotGrid values). **Sonnet doesn't follow them.** All 9 agent invocations in the sequential pipeline hardcode `claude-sonnet-4-20250514` while `self.model` (Opus) is only used for the monolithic animator fallback.

## Solution

Replace all 9 hardcoded Sonnet model references with `self.model` (Opus) and add `max_thinking_tokens` for extended reasoning.

### File: `packages/worker/src/agents/claude_visual_generator.py`

### Agents to upgrade (9 total):

| Line | Agent | Purpose |
|------|-------|---------|
| 3295 | Scene Verify | Verifies scene code against plan |
| 3481 | Composition Verify | Verifies full composition coherence |
| 3638 | TSC Self-Heal | Fixes TypeScript compilation errors |
| 4164 | Director | Plans scenes from transcript |
| 4621 | Screenshot Verify | Reviews rendered screenshots |
| 4843 | Scene Fix | Patches issues found by verify |
| 4947 | Scene Self-Heal | Fixes runtime errors |
| 5345 | Setup | Creates constants.ts, components |
| 5512 | Coordinator | Dispatches scene generator subagents |

### Changes per agent:
1. Replace `model="claude-sonnet-4-20250514"` with `model=self.model`
2. Add `max_thinking_tokens=self.max_thinking_tokens` (default: 10000)
3. Exception: Coordinator (line 5512) gets `max_thinking_tokens=2000` since it only dispatches tasks

### Expected Impact
- Opus follows complex multi-step instructions (read 3+ templates, use studio design system)
- Opus respects prohibitions (no emojis, no photo backgrounds, no caption duplication)
- Opus produces better motion choreography with extended thinking
- Cost increase: ~5x per video generation (acceptable for quality improvement)
