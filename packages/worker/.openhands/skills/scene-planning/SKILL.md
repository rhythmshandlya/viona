---
triggers:
  - scene plan
  - reasoning
  - conceptual animation
  - beat-by-beat
  - visual metaphor
  - aha moment
---

# Scene Planning with Reasoning

## REQUIRED FIRST STEP

Before writing ANY code, analyze the transcript and output a scene plan.

## Scene Plan Format

```json
{
  "scenes": [
    {
      "timestamp": "0:00 - 0:08",
      "transcript": "Exact words being spoken",
      "reasoning": {
        "whatIsBeingExplained": "The core concept",
        "whyNotLiteral": "Why a literal depiction would fail",
        "whatWouldMakeItClick": "The aha moment visual",
        "howAnimationAddsUnderstanding": "What motion communicates"
      },
      "decision": {
        "visualMetaphor": "The chosen representation",
        "animationNarrative": "Beat-by-beat motion description",
        "keyframes": ["start state", "middle state", "end state"]
      }
    }
  ]
}
```

## Example Scene Plan

**Transcript:** "The problem with bubble sort is that it keeps comparing adjacent elements over and over..."

```json
{
  "scenes": [
    {
      "timestamp": "0:00 - 0:07",
      "transcript": "The problem with bubble sort is that it keeps comparing adjacent elements over and over",
      "reasoning": {
        "whatIsBeingExplained": "Bubble sort's inefficiency - redundant comparisons",
        "whyNotLiteral": "Just showing swaps doesn't convey the WASTE. Viewer won't feel the redundancy.",
        "whatWouldMakeItClick": "Show the SAME comparisons repeatedly. Make repetition visually tedious.",
        "howAnimationAddsUnderstanding": "Multiple passes over already-sorted sections shows wasted work. Counter quantifies it."
      },
      "decision": {
        "visualMetaphor": "Array with scan line re-scanning sorted sections",
        "animationNarrative": "Pass 1: scan left-to-right, swaps happen → Pass 2: starts over, fewer swaps but SAME distance → Pass 3: full scan for 1 swap → counter climbs",
        "keyframes": ["full array, scan begins", "pass 2 starting over", "pass N, counter shows wasted ops"]
      }
    }
  ]
}
```

## Reasoning Quality Checklist

- [ ] "whyNotLiteral" identifies specific failure of obvious approach
- [ ] "whatWouldMakeItClick" describes an insight, not just a visual
- [ ] "howAnimationAddsUnderstanding" explains what MOTION contributes
- [ ] Animation narrative has multiple beats (not just "elements appear")
