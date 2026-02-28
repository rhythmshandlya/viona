# Assistant Director Agent — Design

## Overview
The Assistant Director is a creative pre-processing LLM step (Haiku) that runs before the Director. It classifies the script's tone, sets the visual theme, recommends asset strategies (photos vs illustrations vs icons), and hints at scene structure. Output: `CREATIVE_BRIEF.md` that the Director reads before planning.

## Pipeline Position
```
Script/Transcript
       |
  Assistant Director (Haiku, ~5s)
       |  writes CREATIVE_BRIEF.md
  Director (Sonnet, reads brief + plans scenes)
       |  writes SCENE_PLAN.md + scenes.json
  Fetch Images
       |
  Animator (Sonnet, implements Remotion code)
```

## Decisions Made
1. **Output format:** Markdown file (`CREATIVE_BRIEF.md`) written to the project src directory
2. **Agent type:** LLM agent via Claude SDK (same pattern as Director/Animator)
3. **Model:** Haiku — fast/cheap, classification doesn't need heavy reasoning
4. **Responsibilities:**
   - Tone classification (playful, professional, dramatic, educational, inspirational)
   - Visual asset strategy (when to use photos vs illustrations vs icons vs hand-coded per beat)
   - Color palette & theme suggestion (palette, font pairing, mood)
   - Scene structure hints (beat count, hero moments, climax position, pacing)

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/worker/src/agents/prompts/assistant_director.py` | NEW — System prompt + brief builder |
| `packages/worker/src/agents/claude_visual_generator.py` | MODIFY — Add `_run_assistant_director()`, call before Director in `generate_two_phase()` |
| `packages/worker/src/agents/prompts/director.py` | MODIFY — Add instruction to read CREATIVE_BRIEF.md if present |

## CREATIVE_BRIEF.md Output Format

```markdown
# Creative Brief

## Tone
**Classification:** Playful
**Reasoning:** The script uses casual language, humor, and rhetorical questions...

## Theme & Mood
**Visual mood:** Energetic, bright, approachable
**Color palette suggestion:** Electric Sunset (warm corals + golds)
**Font suggestion:** friendlyTech (Nunito + Source Code Pro)

## Visual Asset Strategy
| Scene Beat | Recommended Asset Type | Reasoning |
|------------|----------------------|-----------|
| Hook (intro) | Illustration | Abstract concept, needs stylized visual |
| Problem setup | Photo | Real-world scenario, grounding |
| Technical explanation | Icons + hand-coded | Step-by-step, needs precision |
| Climax/insight | Illustration (hero) | Big reveal moment, needs impact |
| Conclusion | Icons | Clean summary, checkmarks |

## Scene Structure Hints
- **Suggested scene count:** 5
- **Hero moments:** Scene 1 (hook), Scene 4 (insight reveal)
- **Climax position:** ~70% through the video
- **Pacing:** Fast cuts for hook, slower for explanation, punchy ending
```

## Model & Cost
- Model: Haiku via Claude SDK (`--model haiku`)
- Max turns: 1 (single-shot, no tool use needed — just Write tool for the brief)
- Estimated time: 3-8 seconds
- Cost: ~$0.001 per call
