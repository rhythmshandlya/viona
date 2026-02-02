#!/usr/bin/env python3
"""
Visual Director Utilities.

Helper functions for the Visual Director planning phase:
- Plan validation
- Style color lookup
- Event emission

The main planning logic is in visual_generator.py which uses OpenHands
native LLM reasoning support.
"""

import json
import re
from typing import Optional
from pathlib import Path


# Event types
EVENT_PLANNING_START = "planning_start"
EVENT_PLANNING_THINKING = "planning_thinking"
EVENT_PLANNING_COMPLETE = "planning_complete"
EVENT_PLANNING_ERROR = "planning_error"
EVENT_TOOL_CALL = "tool_call"


def emit_event(event_type: str, **kwargs):
    """Emit a JSON event to stdout."""
    event = {"type": event_type, **kwargs}
    print(json.dumps(event), flush=True)


# Style colors lookup (matches STYLE_GUIDELINES in generate-visuals.ts)
STYLE_COLORS = {
    "minimal": {
        "bg": "#1a1a1a",
        "primary": "#ffffff",
        "accent": "#3b82f6",
        "muted": "#6b7280",
        "text": "#ffffff"
    },
    "modern": {
        "bg": "#0f0f23",
        "primary": "#8b5cf6",
        "secondary": "#3b82f6",
        "accent": "#06b6d4",
        "success": "#22c55e",
        "text": "#ffffff"
    },
    "playful": {
        "bg": "#1a1a2e",
        "primary": "#f97316",
        "secondary": "#eab308",
        "accent": "#ec4899",
        "success": "#22c55e",
        "text": "#ffffff"
    },
    "bold": {
        "bg": "#000000",
        "primary": "#ffffff",
        "accent": "#ef4444",
        "text": "#ffffff"
    },
    "classic": {
        "bg": "#1e3a5f",
        "primary": "#d4af37",
        "text": "#f5f5dc",
        "muted": "#374151"
    }
}


def get_style_colors(preset: str) -> dict:
    """Get colors for a style preset."""
    return STYLE_COLORS.get(preset, STYLE_COLORS["modern"])


def validate_visual_plan(plan: dict, width: int, height: int) -> list:
    """Validate the visual plan against hard requirements.

    Returns list of error messages (empty if valid).
    """
    errors = []

    # Check required top-level sections
    required_sections = ['meta', 'concept_analysis', 'visual_system', 'scenes']
    for section in required_sections:
        if section not in plan:
            errors.append(f"Missing required section: {section}")

    if errors:
        return errors  # Can't continue without basic structure

    # Validate meta
    meta = plan.get('meta', {})
    if not meta.get('total_duration_frames'):
        errors.append("meta.total_duration_frames is required")

    # Validate concept_analysis
    concept = plan.get('concept_analysis', {})
    entities = concept.get('key_entities', [])
    if not entities:
        errors.append("concept_analysis.key_entities cannot be empty")

    # Validate visual_system
    visual = plan.get('visual_system', {})
    metaphors = visual.get('metaphor_mapping', {})

    # Check all entities have metaphors
    for entity in entities:
        entity_name = entity.get('name')
        if entity_name and entity_name not in metaphors:
            errors.append(f"Entity '{entity_name}' has no metaphor_mapping")

    # Validate scenes
    scenes = plan.get('scenes', [])
    if not scenes:
        errors.append("scenes cannot be empty")

    for scene in scenes:
        scene_id = scene.get('scene_id', 'unknown')

        # Check required scene fields
        if 'frame_range' not in scene:
            errors.append(f"Scene {scene_id}: missing frame_range")

        if 'visual_story' not in scene:
            errors.append(f"Scene {scene_id}: missing visual_story")
            continue

        visual_story = scene['visual_story']

        if 'build_sequence' not in visual_story:
            errors.append(f"Scene {scene_id}: missing build_sequence")

        # Validate element positions use percentages
        positions = scene.get('element_positions', {})
        for elem_name, pos in positions.items():
            if 'x_percent' not in pos and 'y_percent' not in pos:
                if 'x' in pos or 'y' in pos:
                    errors.append(f"Scene {scene_id}: element '{elem_name}' uses absolute position, must use x_percent/y_percent")

        # Validate build sequence timing
        build_seq = visual_story.get('build_sequence', [])
        for i, step in enumerate(build_seq):
            if 'at_frame' not in step:
                errors.append(f"Scene {scene_id}: build_sequence[{i}] missing at_frame")

            # Check stagger (min 8 frames between entries)
            if i > 0:
                prev_frame = build_seq[i-1].get('at_frame', 0)
                curr_frame = step.get('at_frame', 0)
                gap = curr_frame - prev_frame
                if 0 < gap < 8:
                    errors.append(f"Scene {scene_id}: stagger too short ({gap} frames) between build_sequence[{i-1}] and [{i}], minimum 8")

    # Check for overlapping hero animations across scenes
    hero_ranges = []
    for scene in scenes:
        hero = scene.get('visual_story', {}).get('hero_moment', {})
        if hero and 'frame_range' in hero:
            hero_ranges.append((scene.get('scene_id'), hero['frame_range']))

    for i, (id1, range1) in enumerate(hero_ranges):
        for j, (id2, range2) in enumerate(hero_ranges[i+1:], i+1):
            # Check if ranges overlap
            if range1[0] < range2[1] and range2[0] < range1[1]:
                errors.append(f"Overlapping hero animations: {id1} and {id2}")

    return errors


def parse_visual_plan(response: str) -> Optional[dict]:
    """Extract and parse a JSON Visual Plan from text response."""
    # Try to find JSON block in markdown code fence
    json_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', response)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try to find raw JSON object
    brace_count = 0
    start_idx = None
    for i, char in enumerate(response):
        if char == '{':
            if start_idx is None:
                start_idx = i
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and start_idx is not None:
                try:
                    return json.loads(response[start_idx:i+1])
                except json.JSONDecodeError:
                    start_idx = None
                    continue

    return None


def extract_thinking(response: str) -> Optional[str]:
    """Extract thinking/reasoning content from response."""
    # Find all <thinking>...</thinking> blocks
    thinking_blocks = re.findall(r'<thinking>([\s\S]*?)</thinking>', response, re.IGNORECASE)
    if thinking_blocks:
        return "\n\n---\n\n".join(thinking_blocks)
    return None
