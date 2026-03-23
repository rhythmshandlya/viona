"""
Bridge module: re-exports the shared prompts loader functions.

The shared loader lives at packages/worker/src/prompts/loader.py.
Now that this module is co-located, we can import directly.
"""

from prompts.loader import (  # noqa: F401
    load_prompt, load_template, clear_cache, load_shared_modules,
    load_strategy, list_strategies, build_agent_prompt,
)

__all__ = [
    "load_prompt", "load_template", "clear_cache", "load_shared_modules",
    "load_strategy", "list_strategies", "build_agent_prompt",
]
