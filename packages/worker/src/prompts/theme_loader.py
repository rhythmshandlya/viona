"""Theme loader — reads themes.json and loads prompt files with placeholder substitution."""

import json
from pathlib import Path

_THEMES_DIR = Path(__file__).parent / "themes"
_manifest = None


def _load_manifest() -> dict:
    global _manifest
    if _manifest is None:
        with open(_THEMES_DIR / "themes.json") as f:
            _manifest = json.load(f)
    return _manifest


def get_theme(preset: str) -> dict | None:
    """Return theme config dict, or None if preset is not in manifest."""
    return _load_manifest()["themes"].get(preset)


def list_theme_presets() -> list[str]:
    """Return all registered theme preset names."""
    return list(_load_manifest()["themes"].keys())


def get_template_tags(preset: str) -> list[str]:
    """Return the templateTags list for the given preset."""
    theme = get_theme(preset)
    if not theme:
        raise ValueError(f"Unknown theme preset: {preset}")
    return theme["templateTags"]


def _load_theme_prompt(file_path: str, theme: dict) -> str:
    """Load a markdown prompt and substitute color placeholders."""
    raw = (_THEMES_DIR / file_path).read_text(encoding="utf-8")
    variant_label = theme["variant"].capitalize() + " mode"
    replacements = {
        **theme["colors"],
        "variant_label": variant_label,
        "variant": theme["variant"],
        "family": theme["family"],
        "label": theme["label"],
    }
    result = raw
    for key, value in replacements.items():
        result = result.replace(f"{{{key}}}", value)
    return result


def get_style_guide(preset: str) -> str:
    """Load {family}/{variant}/style-guide.md with placeholders filled."""
    theme = get_theme(preset)
    if not theme:
        raise ValueError(f"Unknown theme preset: {preset}")
    return _load_theme_prompt(f"{theme['family']}/{theme['variant']}/style-guide.md", theme)


def get_design_system(preset: str) -> str:
    """Load {family}/design-system.md with placeholders filled."""
    theme = get_theme(preset)
    if not theme:
        raise ValueError(f"Unknown theme preset: {preset}")
    return _load_theme_prompt(f"{theme['family']}/design-system.md", theme)


def get_director_style(preset: str) -> str:
    """Load {family}/director-style.md with placeholders filled."""
    theme = get_theme(preset)
    if not theme:
        raise ValueError(f"Unknown theme preset: {preset}")
    return _load_theme_prompt(f"{theme['family']}/director-style.md", theme)
