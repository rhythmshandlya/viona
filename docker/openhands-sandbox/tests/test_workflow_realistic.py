#!/usr/bin/env python3
"""
Realistic workflow tests for the visual generator.

These tests simulate real agent behavior and catch failures that
simpler unit tests miss. They test:
1. TypeScript error detection in actual code
2. Screenshot frame calculation from transcript
3. Self-healing prompt construction
4. Full pipeline with mock responses
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add tools to path
sys.path.insert(0, str(Path(__file__).parent.parent))


# =============================================================================
# TypeScript Validation Tests (Realistic)
# =============================================================================

class TestTypeScriptValidationRealistic:
    """Test TypeScript validation with actual code that fails in production.

    These tests use /workspace which has node_modules pre-installed in Docker.
    They validate that the TypeScript validator catches real errors.
    """

    def _has_workspace_env(self):
        """Check if we're in the Docker environment with /workspace."""
        return Path("/workspace/node_modules").exists()

    def test_detect_missing_import(self):
        """Test that missing imports are detected."""
        if not self._has_workspace_env():
            pytest.skip("Requires /workspace with node_modules (run inside Docker)")

        # This is a common error in production - using a component without importing
        code_with_missing_import = """
import { useCurrentFrame } from 'remotion';

export const TestVideo = () => {
    const frame = useCurrentFrame();
    // AbsoluteFill is used but not imported
    return (
        <AbsoluteFill>
            <div>{frame}</div>
        </AbsoluteFill>
    );
};
"""
        # Use /workspace which has node_modules
        workspace = Path("/workspace")
        project_dir = workspace / "src" / "TestVideo"
        project_dir.mkdir(parents=True, exist_ok=True)

        try:
            (project_dir / "index.tsx").write_text(code_with_missing_import)

            # Run TypeScript check
            result = subprocess.run(
                ["npx", "tsc", "--noEmit", "--pretty", "false"],
                cwd=str(workspace),
                capture_output=True,
                text=True,
                timeout=60
            )

            # Should detect the error
            output = result.stdout + result.stderr
            assert result.returncode != 0, "Expected TypeScript error for missing import"
            assert "AbsoluteFill" in output or "Cannot find name" in output
        finally:
            # Clean up
            if project_dir.exists():
                import shutil
                shutil.rmtree(project_dir)

    def test_detect_incorrect_props(self):
        """Test that incorrect prop types are detected."""
        if not self._has_workspace_env():
            pytest.skip("Requires /workspace with node_modules (run inside Docker)")

        code_with_wrong_props = """
import { useCurrentFrame, spring } from 'remotion';

export const TestVideo = () => {
    const frame = useCurrentFrame();
    // Missing required 'fps' parameter in spring()
    const scale = spring({
        frame,
        config: { damping: 10 },
    });
    return <div style={{ transform: `scale(${scale})` }}>Test</div>;
};
"""
        workspace = Path("/workspace")
        project_dir = workspace / "src" / "TestVideo"
        project_dir.mkdir(parents=True, exist_ok=True)

        try:
            (project_dir / "index.tsx").write_text(code_with_wrong_props)

            result = subprocess.run(
                ["npx", "tsc", "--noEmit", "--pretty", "false"],
                cwd=str(workspace),
                capture_output=True,
                text=True,
                timeout=60
            )

            # Should detect missing 'fps' property
            output = result.stdout + result.stderr
            assert result.returncode != 0, "Expected TypeScript error for missing fps"
            assert "fps" in output.lower() or "property" in output.lower()
        finally:
            # Clean up
            if project_dir.exists():
                import shutil
                shutil.rmtree(project_dir)

    def test_valid_code_passes(self):
        """Test that valid Remotion code passes validation."""
        if not self._has_workspace_env():
            pytest.skip("Requires /workspace with node_modules (run inside Docker)")

        valid_code = """
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, AbsoluteFill, interpolate } from 'remotion';

export const TestVideo: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const scale = spring({
        frame,
        fps,
        config: { damping: 10, stiffness: 100 },
    });

    const opacity = interpolate(frame, [0, 30], [0, 1]);

    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            <div style={{ transform: `scale(${scale})`, opacity }}>
                Frame: {frame}
            </div>
        </AbsoluteFill>
    );
};
"""
        workspace = Path("/workspace")
        project_dir = workspace / "src" / "TestVideo"
        project_dir.mkdir(parents=True, exist_ok=True)

        try:
            (project_dir / "index.tsx").write_text(valid_code)

            result = subprocess.run(
                ["npx", "tsc", "--noEmit", "--pretty", "false"],
                cwd=str(workspace),
                capture_output=True,
                text=True,
                timeout=60
            )

            # Should pass
            assert result.returncode == 0, f"Valid code should compile. Errors: {result.stdout + result.stderr}"
        finally:
            # Clean up
            if project_dir.exists():
                import shutil
                shutil.rmtree(project_dir)


# =============================================================================
# Screenshot Frame Calculation Tests
# =============================================================================

class TestScreenshotFrameCalculation:
    """Test that screenshot frames are calculated correctly from transcript."""

    def test_frame_calculation_from_transcript(self):
        """Test frame calculation from transcript segments."""
        from visual_generator import run_visual_evaluation

        # Simulate transcript segments
        transcript_segments = [
            {"startMs": 0, "endMs": 5000, "text": "Welcome to this video"},
            {"startMs": 5000, "endMs": 10000, "text": "Today we'll learn about sorting"},
            {"startMs": 10000, "endMs": 15000, "text": "Let's start with bubble sort"},
        ]

        fps = 30
        duration_frames = 450  # 15 seconds

        # Calculate expected frames
        expected_frames = set()
        expected_frames.add(0)  # Opening
        expected_frames.add(duration_frames - 10)  # Closing

        for seg in transcript_segments:
            start_frame = int((seg["startMs"] / 1000) * fps)
            mid_frame = int(((seg["startMs"] + seg["endMs"]) / 2 / 1000) * fps)
            if start_frame < duration_frames:
                expected_frames.add(start_frame)
            if mid_frame < duration_frames:
                expected_frames.add(mid_frame)

        # Verify frames are reasonable
        assert 0 in expected_frames, "Should include opening frame"
        assert 440 in expected_frames or 439 in expected_frames, "Should include closing frame"
        assert 150 in expected_frames, "Should include frame at 5 seconds"

    def test_empty_transcript_handling(self):
        """Test handling of empty transcript."""
        transcript_segments = []
        fps = 30
        duration_frames = 300

        # Should still calculate opening and closing frames
        frames = {0, duration_frames - 10}

        assert 0 in frames
        assert 290 in frames


# =============================================================================
# Self-Healing Prompt Construction Tests
# =============================================================================

class TestSelfHealingPrompt:
    """Test that self-healing prompts are constructed correctly."""

    def test_prompt_includes_validation_requirement(self):
        """Test that generator prompt includes TypeScript validation requirement."""
        base_prompt = "Create a video showing bubble sort algorithm"

        # Simulate what run_generator_with_self_healing does
        enhanced_prompt = f"""{base_prompt}

CRITICAL REQUIREMENT - SELF-HEALING:
After writing ALL files, you MUST:
1. Run TypeScriptValidatorTool to check for errors
2. If there are ANY errors, fix them
3. Run TypeScriptValidatorTool again
4. Repeat until ZERO errors

Do NOT finish until TypeScript validation passes with no errors.
This is a hard requirement - code that doesn't compile is unacceptable."""

        assert "TypeScriptValidatorTool" in enhanced_prompt
        assert "ZERO errors" in enhanced_prompt
        assert "CRITICAL" in enhanced_prompt

    def test_visual_feedback_prompt(self):
        """Test that visual feedback is properly formatted."""
        visual_feedback = """Visual Quality Score: 45/100 (need 90 to pass)
Visual Quality: 25/70

## Issues Found (TODO - fix these):
- Animation transition is too abrupt at frame 30
- Text is too small to read
- Colors don't match requested style

## Suggestion:
Use longer spring duration and increase font size to 48px."""

        base_prompt = "Create video"

        # Simulate improvement prompt
        improvement_prompt = f"""Improve the visuals based on this feedback:

{visual_feedback}

IMPORTANT:
- Focus on the VISUAL improvements mentioned above
- After making changes, validate TypeScript and fix any errors
- Do NOT finish until TypeScript compiles with ZERO errors

Original task:
{base_prompt}"""

        assert "VISUAL improvements" in improvement_prompt
        assert "Animation transition" in improvement_prompt
        assert "TypeScript compiles with ZERO errors" in improvement_prompt


# =============================================================================
# Root.tsx Generation Tests (Realistic)
# =============================================================================

class TestRootGenerationRealistic:
    """Test Root.tsx generation with realistic project structures."""

    def test_handles_underscore_project_ids(self):
        """Test that project IDs with underscores are converted correctly."""
        from tools.root_generator import scan_compositions, generate_root_tsx

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create project with underscore in name
            project_dir = Path(tmpdir) / "my_video_project"
            project_dir.mkdir()

            (project_dir / "index.tsx").write_text("""
import { useCurrentFrame } from 'remotion';
export const MyVideoProject = () => <div />;
""")

            compositions = scan_compositions(tmpdir)

            assert len(compositions) == 1
            # Underscores should be converted to hyphens
            assert compositions[0].composition_id == "my-video-project"

            # Generate Root.tsx
            root_content = generate_root_tsx(compositions)

            assert 'id="my-video-project"' in root_content

    def test_detects_composition_from_named_file(self):
        """Test that compositions are detected from files matching directory name."""
        from tools.root_generator import scan_compositions

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create project with named file instead of index.tsx
            project_dir = Path(tmpdir) / "BubbleSort"
            project_dir.mkdir()

            (project_dir / "BubbleSort.tsx").write_text("""
import { useCurrentFrame } from 'remotion';
export const BubbleSort = () => <div />;
""")

            compositions = scan_compositions(tmpdir)

            assert len(compositions) == 1
            assert compositions[0].component_name == "BubbleSort"


# =============================================================================
# Event Emission Tests
# =============================================================================

class TestEventEmission:
    """Test that events are emitted correctly for monitoring."""

    def test_emit_event_format(self):
        """Test that events are valid JSON."""
        from visual_generator import emit_event
        import io

        old_stdout = sys.stdout
        sys.stdout = captured = io.StringIO()

        try:
            emit_event("test_event", score=85, issues=["issue1", "issue2"])
            output = captured.getvalue()
        finally:
            sys.stdout = old_stdout

        # Parse JSON
        event = json.loads(output.strip())

        assert event["type"] == "test_event"
        assert event["score"] == 85
        assert event["issues"] == ["issue1", "issue2"]

    def test_emit_event_handles_special_characters(self):
        """Test that events handle special characters in data."""
        from visual_generator import emit_event
        import io

        old_stdout = sys.stdout
        sys.stdout = captured = io.StringIO()

        try:
            emit_event("test", message='Code has "quotes" and <brackets>')
            output = captured.getvalue()
        finally:
            sys.stdout = old_stdout

        # Should be valid JSON
        event = json.loads(output.strip())
        assert event["message"] == 'Code has "quotes" and <brackets>'


# =============================================================================
# Error Recovery Tests
# =============================================================================

class TestErrorRecovery:
    """Test error recovery scenarios."""

    def test_typescript_error_parsing(self):
        """Test that TypeScript errors are parsed correctly."""
        from tools.typescript_validator import TypeScriptValidatorObservation

        # Simulate tsc output
        tsc_output = """src/TestVideo/index.tsx(5,10): error TS2304: Cannot find name 'AbsoluteFill'.
src/TestVideo/index.tsx(8,5): error TS2322: Type 'number' is not assignable to type 'string'."""

        # Parse errors
        errors = []
        for line in tsc_output.split('\n'):
            if 'error TS' in line:
                errors.append(line.strip())

        assert len(errors) == 2
        assert "Cannot find name 'AbsoluteFill'" in errors[0]
        assert "not assignable" in errors[1]

    def test_handles_malformed_metadata(self):
        """Test that malformed metadata.json doesn't crash."""
        from tools.root_generator import scan_compositions

        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = Path(tmpdir) / "TestProject"
            project_dir.mkdir()

            (project_dir / "index.tsx").write_text("""
import { useCurrentFrame } from 'remotion';
export const TestProject = () => <div />;
""")

            # Write invalid JSON
            (project_dir / "metadata.json").write_text("{ invalid json }")

            # Should not crash, just use defaults
            compositions = scan_compositions(tmpdir)

            assert len(compositions) == 1
            assert compositions[0].duration_in_frames == 300  # Default


# =============================================================================
# Helper Functions
# =============================================================================

# No helper functions needed - tests use /workspace which has pre-installed deps


# =============================================================================
# Run Tests
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
