---
name: remotion-fundamentals
description: Core Remotion patterns for video generation. Use when creating Remotion compositions.
user-invocable: false
---

# Remotion Fundamentals

## Essential Hooks

### useCurrentFrame and useVideoConfig
Always use these hooks for frame-based animations:
- frame = current frame number
- fps, durationInFrames, width, height from config

## Animation Fundamentals

### Spring Animation (REQUIRED for entrances)
- ALWAYS use damping >= 20 (22 is ideal)
- ALWAYS use stiffness around 90
- ALWAYS pass fps from useVideoConfig

### Interpolate (REQUIRED for smooth values)
- ALWAYS use extrapolateRight: "clamp"
- Map frame ranges to output values
- Chain interpolations for complex effects

## Composition Structure

### Sequence for Scene Timing
- Use from prop for start frame
- Use durationInFrames for scene length
- Stack Sequences for scene order

### AbsoluteFill for Layers
- Use zIndex for layer ordering
- Background at zIndex 0
- Content layers above

## Constants Pattern

### Required Exports
- COLORS: Background, primary, secondary, accent, text
- TIMING: Frame counts for each scene
- SPRING_CONFIG: damping 22, stiffness 90, mass 0.9

## PROHIBITED Patterns

1. Math.sin/cos on text positions (causes jitter)
2. damping < 20 (too bouncy)
3. All elements at frame 0 (no stagger)
4. Missing extrapolateRight: "clamp"
5. Hardcoded dimensions (use useVideoConfig)
