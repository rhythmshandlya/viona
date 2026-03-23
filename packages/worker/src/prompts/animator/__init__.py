"""Animator prompts sub-package — re-exports from animator.py."""

from .animator import (  # noqa: F401
    ANIMATOR_BASE_PROMPT,
    ANIMATOR_SCENE_PROMPT_TEMPLATE,
    ANIMATOR_SETUP_PROMPT,
    ANIMATOR_SYSTEM_PROMPT,
    COMPOSITION_VERIFY_PROMPT,
    SCENE_VERIFY_PROMPT,
    VIDEO_OVERLAY_SECTION,
    VISUAL_FIX_PROMPT_TEMPLATE,
    VISUAL_VERIFY_PROMPT,
    YOUTUBE_CLIP_SCENE_SECTION,
    build_animator_user_message,
    build_scene_brief,
    build_scene_task_prompt,
    build_scene_user_message,
    build_setup_user_message,
    get_animator_prompt,
    get_display_mode_rules,
    get_studio_section,
    get_video_overlay_section,
    get_youtube_clip_section,
)
