---
name: scene-planning
description: Chain-of-thought reasoning before writing animation code. Structures thinking about visual metaphors, beat-by-beat breakdowns, and aha moments.
triggers:
  - scene plan
  - reasoning
  - conceptual animation
  - beat-by-beat
  - visual metaphor
  - aha moment
---

# Scene Planning

Before writing ANY code, analyze transcript and output a scene plan.

## Format

```json
{
  "scenes": [{
    "timestamp": "0:00 - 0:08",
    "transcript": "Exact words spoken",
    "reasoning": {
      "whatIsBeingExplained": "The core concept",
      "whyNotLiteral": "Why obvious approach fails",
      "whatWouldMakeItClick": "The aha moment",
      "howAnimationAddsUnderstanding": "What motion communicates"
    },
    "decision": {
      "visualMetaphor": "Chosen representation",
      "animationNarrative": "Beat-by-beat motion",
      "keyframes": ["start", "middle", "end"]
    }
  }]
}
```

## Example

**Transcript:** "The problem with bubble sort is that it keeps comparing adjacent elements over and over..."

```json
{
  "reasoning": {
    "whatIsBeingExplained": "Bubble sort inefficiency - redundant comparisons",
    "whyNotLiteral": "Just showing swaps doesn't convey WASTE",
    "whatWouldMakeItClick": "Show SAME comparisons repeatedly. Make repetition tedious.",
    "howAnimationAddsUnderstanding": "Multiple passes over sorted sections shows wasted work"
  },
  "decision": {
    "visualMetaphor": "Array with scan line re-scanning sorted sections",
    "animationNarrative": "Pass 1: scan, swaps → Pass 2: starts over, fewer swaps → Pass 3: full scan for 1 swap",
    "keyframes": ["full array", "pass 2 starting over", "pass N, counter shows waste"]
  }
}
```

## Checklist

- "whyNotLiteral" identifies failure of obvious approach
- "whatWouldMakeItClick" describes insight, not just visual
- "howAnimationAddsUnderstanding" explains what MOTION contributes
- Animation narrative has multiple beats
