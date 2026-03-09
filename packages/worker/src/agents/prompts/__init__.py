"""
Prompts package for the two-phase visual generator pipeline.

Contains system prompts and message builders for:
- Director agent: Analyzes transcript, creates scene plan
- Animator agent: Implements plan scene-by-scene
"""

from .director import DIRECTOR_SYSTEM_PROMPT, build_director_user_message
from .animator import ANIMATOR_SYSTEM_PROMPT, build_animator_user_message, get_studio_section

__all__ = [
    "DIRECTOR_SYSTEM_PROMPT",
    "build_director_user_message",
    "ANIMATOR_SYSTEM_PROMPT",
    "build_animator_user_message",
    "get_studio_section",
]
