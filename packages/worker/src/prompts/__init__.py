"""
Prompts package for the two-phase visual generator pipeline.

Contains system prompts and message builders for:
- Director agent: Analyzes transcript, creates scene plan
- Animator agent: Implements plan scene-by-scene
"""

from .director.director import DIRECTOR_SYSTEM_PROMPT, build_director_user_message, get_director_prompt
from .animator.animator import ANIMATOR_SYSTEM_PROMPT, build_animator_user_message, get_theme_section, get_animator_prompt
from .loader import build_agent_prompt, load_strategy, list_strategies

__all__ = [
    "DIRECTOR_SYSTEM_PROMPT",
    "build_director_user_message",
    "get_director_prompt",
    "ANIMATOR_SYSTEM_PROMPT",
    "build_animator_user_message",
    "get_theme_section",
    "get_animator_prompt",
    "build_agent_prompt",
    "load_strategy",
    "list_strategies",
]
