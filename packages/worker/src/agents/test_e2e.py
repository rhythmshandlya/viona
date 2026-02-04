#!/usr/bin/env python3
"""
End-to-end test for Claude Code Visual Generator.

This test:
1. Tests the skill injection functions
2. Tests prompt building with skill content
3. Tests the full generator initialization (without actual API calls)
4. Validates the generated prompt structure
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Test configuration
TEST_PROJECT_ID = "test_rest_api"
TEST_DURATION_FRAMES = 900  # 30 seconds at 30fps
TEST_FPS = 30
TEST_WIDTH = 1080
TEST_HEIGHT = 1920


def get_test_transcript():
    """Get a sample transcript for testing."""
    return """Let's understand how REST APIs work.
You have a client, like your browser or mobile app, that wants data.
On the other side, there's a server that stores and manages that data.
When you need something, your client sends a REQUEST to the server.
The server processes the request and sends back a response with the data.
This process of request and response is the foundation of how the web works."""


def test_skill_injection():
    """Test that skill injection functions work correctly."""
    print("=" * 60)
    print("TEST 1: Skill Injection Functions")
    print("=" * 60)

    from claude_visual_generator import get_condensed_skills, extract_technique_examples

    skills = get_condensed_skills()
    assert len(skills) > 1000, "Condensed skills should be substantial"
    assert "SPRING_CONFIG" in skills, "Should include spring config"
    assert "damping: 22" in skills, "Should include damping value"
    print("  OK get_condensed_skills() returns valid content")

    transcript = get_test_transcript()
    examples = extract_technique_examples(transcript)
    assert "CODE EXAMPLES" in examples or "Scale Spring" in examples, "Should have code examples"
    print("  OK extract_technique_examples() extracts relevant patterns")

    print("  OK PASSED\n")


def test_prompt_building():
    """Test that prompts are built correctly with injected skills."""
    print("=" * 60)
    print("TEST 2: Prompt Building")
    print("=" * 60)

    from claude_visual_generator import ClaudeVisualGenerator

    with patch('claude_visual_generator.configure_sdk_auth'):
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir)
            bundle_output = workspace / "bundles"
            bundle_output.mkdir()

            generator = ClaudeVisualGenerator(
                workspace=workspace,
                project_id=TEST_PROJECT_ID,
                bundle_output=bundle_output,
            )

            system_prompt = generator._build_system_prompt(
                width=TEST_WIDTH,
                height=TEST_HEIGHT,
                fps=TEST_FPS,
                duration_frames=TEST_DURATION_FRAMES,
            )

            assert "<role>" in system_prompt, "Should have XML role tag"
            assert "<workspace>" in system_prompt, "Should have XML workspace tag"
            print("  OK System prompt built correctly with XML tags")

            transcript = get_test_transcript()
            user_message = generator._build_user_message(
                transcript=transcript,
                width=TEST_WIDTH,
                height=TEST_HEIGHT,
                duration_frames=TEST_DURATION_FRAMES,
                fps=TEST_FPS,
            )

            assert "SPRING_CONFIG" in user_message, "Should inject condensed skills"
            print("  OK User message includes injected skills")

    print("  OK PASSED\n")


def test_security_settings():
    """Test that security settings are created correctly."""
    print("=" * 60)
    print("TEST 3: Security Settings")
    print("=" * 60)

    from claude_visual_generator import create_security_settings

    workspace = "/test/workspace/path"
    settings = create_security_settings(workspace)

    assert "sandbox" in settings, "Should have sandbox section"
    assert "permissions" in settings, "Should have permissions section"
    assert settings["sandbox"]["enabled"] is True, "Sandbox should be enabled"
    print("  OK Settings structure is correct")

    print("  OK PASSED\n")


def test_generator_initialization():
    """Test that the generator initializes correctly (mocked auth)."""
    print("=" * 60)
    print("TEST 4: Generator Initialization")
    print("=" * 60)

    from claude_visual_generator import ClaudeVisualGenerator

    with patch('claude_visual_generator.configure_sdk_auth') as mock_auth:
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir)
            bundle_output = workspace / "bundles"
            bundle_output.mkdir()

            generator = ClaudeVisualGenerator(
                workspace=workspace,
                project_id=TEST_PROJECT_ID,
                bundle_output=bundle_output,
            )

            assert generator.workspace == workspace
            assert generator.project_id == TEST_PROJECT_ID
            mock_auth.assert_called_once()
            print("  OK Generator initialized correctly")

    print("  OK PASSED\n")


def test_prompt_pipeline():
    """Test the complete prompt generation pipeline."""
    print("=" * 60)
    print("TEST 5: Prompt Pipeline Integration")
    print("=" * 60)

    from claude_visual_generator import ClaudeVisualGenerator

    with patch('claude_visual_generator.configure_sdk_auth'):
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir)
            bundle_output = workspace / "bundles"
            bundle_output.mkdir()

            generator = ClaudeVisualGenerator(
                workspace=workspace,
                project_id=TEST_PROJECT_ID,
                bundle_output=bundle_output,
            )

            transcript = get_test_transcript()
            system_prompt = generator._build_system_prompt(
                width=TEST_WIDTH, height=TEST_HEIGHT, fps=TEST_FPS, duration_frames=TEST_DURATION_FRAMES
            )
            user_message = generator._build_user_message(
                transcript=transcript, width=TEST_WIDTH, height=TEST_HEIGHT,
                duration_frames=TEST_DURATION_FRAMES, fps=TEST_FPS
            )

            total_length = len(system_prompt) + len(user_message)
            print(f"  Total prompt length: {total_length} chars")
            assert total_length > 5000, "Combined prompt should be substantial"
            print("  OK Combined prompt is substantial")

    print("  OK PASSED\n")


def main():
    """Run all end-to-end tests."""
    print("\n" + "=" * 60)
    print("CLAUDE CODE VISUAL GENERATOR - E2E TEST SUITE")
    print("=" * 60 + "\n")

    try:
        test_skill_injection()
        test_prompt_building()
        test_security_settings()
        test_generator_initialization()
        test_prompt_pipeline()

        print("=" * 60)
        print("ALL E2E TESTS PASSED OK")
        print("=" * 60)
        return 0

    except AssertionError as e:
        print(f"\nFAIL TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1
    except Exception as e:
        print(f"\nFAIL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
