"""
Bridge module: re-exports the shared prompts loader functions.

The shared loader lives at packages/worker/src/prompts/loader.py.
Now that this module is co-located, we can import directly.
"""

from prompts.loader import load_prompt, load_template, clear_cache  # noqa: F401

__all__ = ["load_prompt", "load_template", "clear_cache"]
