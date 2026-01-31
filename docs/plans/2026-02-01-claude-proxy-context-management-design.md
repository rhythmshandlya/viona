# Claude Proxy Context Management Design

**Date:** 2026-02-01
**Status:** Approved
**Scope:** Aggressive context management when using Claude Code proxy

## Problem

When using Claude via Claude Code proxy (OpenAI-compatible endpoint), the visual generator experiences:
1. **Context window overflow** - Claude's 200K context fills faster than Gemini's 1M
2. **Evaluation looping** - Agent gets stuck iterating without terminating

Gemini Flash via OpenRouter works fine with current settings.

## Solution

Apply aggressive context management **only when Claude proxy is detected**. Keep default settings for Gemini/OpenRouter.

## Detection Strategy

Detect Claude by model name pattern:

```python
def is_claude_model(model_name: str) -> bool:
    """Detect if using Claude (via proxy or direct)."""
    claude_patterns = ['claude', 'anthropic']
    return any(p in model_name.lower() for p in claude_patterns)
```

## Configuration Comparison

| Setting | Default (Gemini) | Claude Proxy |
|---------|------------------|--------------|
| Condenser max_size (generator) | 100 | 35 |
| Condenser max_size (evaluator) | 50 | 20 |
| Condenser keep_first | 4 | 3 |
| Generator max_iterations | 50 | 25 |
| Evaluator max_iterations | 15 | 8 |
| Skills loaded | 5 (~1858 lines) | 2 (~377 lines) |
| Inline guidance | None | Yes (20 lines) |

## Skill Reduction

**Default skills (Gemini):**
- visual-planning.md (500 lines)
- motion-graphics.md (611 lines)
- remotion-best-practices.md (237 lines)
- visual-design.md (137 lines)
- file-editing-guide.md (140 lines)

**Claude skills (reduced):**
- remotion-best-practices.md (237 lines)
- file-editing-guide.md (140 lines)

**Inline guidance** compensates for missing skills:
```
Key animation patterns:
- Use spring() for organic motion: spring({fps: 30, config: {damping: 12}})
- Stagger elements: delay = index * 5 frames
- Interpolate opacity 0→1 over 15 frames for fade-ins
- Use easeInOut for smooth transitions
- Keep animations under 30 frames for snappy feel
```

## Condenser Strategy

The condenser LLM always uses Gemini Flash via OpenRouter (fast, cheap) regardless of main model. This avoids burning Claude tokens on summarization.

For Claude proxy:
- Trigger condensation earlier (35 events vs 100)
- Keep fewer initial messages (3 vs 4)
- Smaller evaluator threshold (20 vs 50)

## Files to Modify

| File | Changes |
|------|---------|
| `docker/openhands-sandbox/visual_generator.py` | Add detection, config selection, apply limits |
| `docker/openhands-sandbox/config.toml` | Add `[llm.claude-proxy]` section |

## Event Logging

Log which configuration is active:

```python
emit_event(EVENT_STARTED,
    provider="claude-proxy" if is_claude else "openrouter",
    context_mode="aggressive" if is_claude else "default",
    condenser_max_size=config['condenser_max_size'],
    skills_loaded=config['skills_to_load'],
)
```

## Rollback

If issues occur, user can force default config by using a non-Claude model name or adding `--force-default-config` flag.
