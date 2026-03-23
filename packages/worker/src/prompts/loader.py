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

_SHARED_MODULES: list[str] = []  # Cleared — content moved to strategies/ and skills


def load_shared_modules() -> str:
    """Deprecated: shared modules moved to strategies/ and skills.
    Returns empty string for backward compatibility."""
    parts: list[str] = []
    for name in _SHARED_MODULES:
        parts.append(load_prompt(name))
    return "\n\n".join(parts)


# --- Strategy-based prompt composition ---


def load_strategy(genre: str) -> str:
    """Load both strategy files for a genre.

    Args:
        genre: Strategy directory name (e.g. 'explainer-videos', 'informative-media')

    Returns:
        Concatenated creative-direction + technique-preferences content.

    Raises:
        FileNotFoundError: If the strategy directory or files don't exist.
    """
    creative = load_prompt(f"strategies/{genre}/creative-direction")
    techniques = load_prompt(f"strategies/{genre}/technique-preferences")
    return f"{creative}\n\n{techniques}"


def list_strategies() -> list[str]:
    """Return available genre strategy names."""
    strategies_dir = _PROMPTS_DIR / "strategies"
    if not strategies_dir.exists():
        return []
    return sorted([d.name for d in strategies_dir.iterdir() if d.is_dir()])


def build_agent_prompt(agent: str, genre: str) -> str:
    """Assemble the full system prompt for an agent.

    Components (in order):
    1. composition.md — display mode rules (always loaded)
    2. strategy — genre-specific creative direction + technique preferences
    3. agent/system.md — role-specific workflow

    Args:
        agent: Agent name ('director' or 'animator')
        genre: Strategy genre name (e.g. 'explainer-videos')

    Returns:
        Assembled system prompt string.
    """
    composition = load_prompt("composition")
    strategy = load_strategy(genre)
    role = load_prompt(f"{agent}/system")
    return f"{composition}\n\n{strategy}\n\n{role}"
