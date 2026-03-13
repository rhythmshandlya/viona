"""
Prompt loader for Python visual generation pipeline.

Loads .md prompt files from disk relative to this directory,
with caching and simple {{variable}} template substitution.
"""

import re
from pathlib import Path

_PROMPTS_DIR = Path(__file__).resolve().parent
_cache: dict[str, str] = {}


def load_prompt(name: str) -> str:
    """Load a .md prompt file by name.

    Args:
        name: Slash-separated path without extension,
              e.g. 'animator/system' resolves to ./animator/system.md

    Returns:
        The file contents as a string.

    Raises:
        FileNotFoundError: If the prompt file does not exist.
    """
    if name in _cache:
        return _cache[name]

    path = _PROMPTS_DIR / f"{name}.md"
    content = path.read_text(encoding="utf-8")
    _cache[name] = content
    return content


def load_template(name: str, **kwargs: str | int) -> str:
    """Load a .md prompt file and substitute {{variable}} placeholders.

    Args:
        name: Slash-separated path without extension (same as load_prompt).
        **kwargs: Key-value pairs where each key corresponds to a
                  {{key}} placeholder in the template.

    Returns:
        The rendered template string.

    Raises:
        FileNotFoundError: If the prompt file does not exist.
    """
    raw = load_prompt(name)

    def _replace(match: re.Match) -> str:
        key = match.group(1)
        if key in kwargs:
            return str(kwargs[key])
        return match.group(0)  # leave unmatched placeholders

    return re.sub(r"\{\{(\w+)\}\}", _replace, raw)


def clear_cache() -> None:
    """Clear the in-memory prompt cache."""
    _cache.clear()


# --- Shared module composition ---

_SHARED_MODULES = [
    "shared/technical-rules",
    "shared/motion-design-principles",
    "shared/vocabulary",
    "shared/quality-checklist",
]


def load_shared_modules() -> str:
    """Load and concatenate all shared prompt modules.

    Returns a single string with all shared modules separated by newlines.
    Used by agent builders to prepend shared context to role-specific prompts.
    """
    parts: list[str] = []
    for name in _SHARED_MODULES:
        parts.append(load_prompt(name))
    return "\n\n".join(parts)
