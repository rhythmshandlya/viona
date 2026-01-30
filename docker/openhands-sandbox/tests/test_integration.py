#!/usr/bin/env python3
"""
Integration tests for OpenHands visual generator workflow.

These tests require API keys and will be SKIPPED if not available.
Run with: pytest tests/test_integration.py -v

Set environment variables:
- GEMINI_API_KEY or ANTHROPIC_API_KEY or OPENAI_API_KEY

To run these tests:
  GEMINI_API_KEY=your-key pytest tests/test_integration.py -v
"""

import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add tools to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def get_api_key():
    """Get API key from environment."""
    return (
        os.environ.get("GEMINI_API_KEY") or
        os.environ.get("ANTHROPIC_API_KEY") or
        os.environ.get("OPENAI_API_KEY") or
        os.environ.get("LLM_API_KEY")
    )


def skip_if_no_api_key():
    """Skip test if no API key available."""
    if not get_api_key():
        pytest.skip("No API key available (set GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY)")


# =============================================================================
# Visual Generator Module Tests
# =============================================================================

class TestVisualGeneratorModule:
    """Tests for visual_generator.py module."""

    def test_import_module(self):
        """Test that visual_generator can be imported."""
        import visual_generator

        assert hasattr(visual_generator, 'emit_event')
        assert hasattr(visual_generator, 'load_skill')
        assert hasattr(visual_generator, 'create_generator_agent')
        assert hasattr(visual_generator, 'create_visual_evaluator_agent')
        assert hasattr(visual_generator, 'run_generator_with_self_healing')
        assert hasattr(visual_generator, 'run_visual_evaluation')
        assert hasattr(visual_generator, 'auto_generate_root_tsx')

    def test_emit_event(self):
        """Test event emission."""
        from visual_generator import emit_event
        import io
        import sys

        # Capture stdout
        old_stdout = sys.stdout
        sys.stdout = captured = io.StringIO()

        try:
            emit_event("test_event", foo="bar", count=42)
            output = captured.getvalue()
        finally:
            sys.stdout = old_stdout

        assert '"type": "test_event"' in output
        assert '"foo": "bar"' in output
        assert '"count": 42' in output

    def test_load_skill_existing(self):
        """Test loading an existing skill."""
        from visual_generator import load_skill

        skills_dir = Path(__file__).parent.parent / "skills"
        content = load_skill(str(skills_dir / "remotion-best-practices.md"))

        assert len(content) > 0
        assert "Remotion" in content

    def test_load_skill_nonexistent(self):
        """Test loading a non-existent skill."""
        from visual_generator import load_skill

        content = load_skill("/nonexistent/skill.md")
        assert content == ""

    def test_run_typescript_check_import(self):
        """Test that run_typescript_check function exists."""
        import visual_generator

        assert hasattr(visual_generator, 'run_typescript_check')
        assert callable(visual_generator.run_typescript_check)


# =============================================================================
# Agent Creation Tests (Mocked SDK)
# =============================================================================

class TestAgentCreation:
    """Tests for agent creation functions with mocked SDK."""

    def test_create_generator_agent(self):
        """Test generator agent creation by verifying imports work."""
        # This test verifies that the function can be called without errors
        # when the SDK is available. Full behavior testing requires the SDK.
        try:
            from visual_generator import create_generator_agent
            from openhands.sdk import LLM
            from pydantic import SecretStr

            # Just verify the function exists and has correct signature
            import inspect
            sig = inspect.signature(create_generator_agent)
            params = list(sig.parameters.keys())

            assert 'llm' in params
            assert 'remotion_skill' in params
            assert 'style_skill' in params
            assert 'file_editing_skill' in params

        except ImportError as e:
            pytest.skip(f"SDK not available: {e}")


# =============================================================================
# Full Workflow Integration Tests (Require API Key)
# =============================================================================

class TestFullWorkflowIntegration:
    """Integration tests that require API keys."""

    def test_auto_generate_root_tsx(self):
        """Test auto-generating Root.tsx after agent run."""
        from visual_generator import auto_generate_root_tsx

        with tempfile.TemporaryDirectory() as tmpdir:
            src_dir = Path(tmpdir) / "src"
            src_dir.mkdir()

            # Create a composition
            comp_dir = src_dir / "TestProject"
            comp_dir.mkdir()

            (comp_dir / "index.tsx").write_text("""
import { useCurrentFrame } from 'remotion';
export const TestProject = () => {
    const frame = useCurrentFrame();
    return <div>{frame}</div>;
};
""")

            # Run auto-generator
            success = auto_generate_root_tsx(tmpdir, "TestProject")

            assert success is True

            # Check Root.tsx was created
            root_path = src_dir / "Root.tsx"
            assert root_path.exists()

            content = root_path.read_text()
            assert 'import { TestProject }' in content

    @pytest.mark.skipif(not get_api_key(), reason="No API key available")
    def test_llm_connection(self):
        """Test that LLM can be initialized with API key."""
        try:
            from pydantic import SecretStr
            from openhands.sdk import LLM
        except ImportError:
            pytest.skip("OpenHands SDK not installed")

        api_key = get_api_key()

        # Determine model based on which key we have
        if os.environ.get("GEMINI_API_KEY"):
            model = "gemini/gemini-2.0-flash"
        elif os.environ.get("ANTHROPIC_API_KEY"):
            model = "anthropic/claude-3-haiku-20240307"
        elif os.environ.get("OPENAI_API_KEY"):
            model = "openai/gpt-4o-mini"
        else:
            model = "gemini/gemini-2.0-flash"

        # This should not raise an exception
        llm = LLM(
            model=model,
            api_key=SecretStr(api_key),
        )

        assert llm is not None


# =============================================================================
# Tool Integration Tests
# =============================================================================

class TestToolIntegration:
    """Integration tests for tools working together."""

    def test_write_file_then_scan_compositions(self):
        """Test WriteFileTool creates file that scan_compositions can detect."""
        from tools.write_file import WriteFileAction, WriteFileExecutor
        from tools.root_generator import scan_compositions

        with tempfile.TemporaryDirectory() as tmpdir:
            # Use WriteFileTool to create a composition
            executor = WriteFileExecutor(working_dir=tmpdir)

            component_content = """
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';

export const GeneratedVideo = () => {
    const frame = useCurrentFrame();
    const opacity = interpolate(frame, [0, 30], [0, 1]);

    return (
        <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
            <h1>Generated Video</h1>
        </AbsoluteFill>
    );
};
"""

            action = WriteFileAction(
                path="GeneratedVideo/index.tsx",
                content=component_content
            )

            result = executor(action)
            assert result.success is True

            # Now scan for compositions
            compositions = scan_compositions(tmpdir)

            assert len(compositions) == 1
            assert compositions[0].component_name == "GeneratedVideo"

    def test_full_file_editing_workflow(self):
        """Test complete file editing workflow: create -> modify -> validate."""
        from tools.write_file import WriteFileAction, WriteFileExecutor
        from tools.root_generator import generate_and_write_root

        with tempfile.TemporaryDirectory() as tmpdir:
            src_dir = Path(tmpdir) / "src"
            src_dir.mkdir()

            executor = WriteFileExecutor(working_dir=str(src_dir))

            # Step 1: Create initial component
            initial_content = """
import { useCurrentFrame } from 'remotion';

export const MyAnimation = () => {
    const frame = useCurrentFrame();
    return <div>Frame: {frame}</div>;
};
"""

            action1 = WriteFileAction(
                path="MyAnimation/index.tsx",
                content=initial_content
            )
            result1 = executor(action1)
            assert result1.success is True

            # Step 2: Create metadata
            metadata_content = """{
    "durationInFrames": 450,
    "fps": 30,
    "width": 1920,
    "height": 1080
}"""

            action2 = WriteFileAction(
                path="MyAnimation/metadata.json",
                content=metadata_content
            )
            result2 = executor(action2)
            assert result2.success is True

            # Step 3: Generate Root.tsx
            success, message, compositions = generate_and_write_root(tmpdir)

            assert success is True
            assert len(compositions) == 1
            assert compositions[0].duration_in_frames == 450

            # Step 4: Verify Root.tsx content
            root_content = (src_dir / "Root.tsx").read_text()
            assert 'import { MyAnimation }' in root_content
            assert 'durationInFrames={450}' in root_content


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestErrorHandling:
    """Tests for error handling across tools."""

    def test_write_file_permission_error(self):
        """Test WriteFileTool handles permission errors gracefully."""
        from tools.write_file import WriteFileAction, WriteFileExecutor

        # Skip this test in Docker/root environments where permission tests don't work
        if os.geteuid() == 0:
            # Running as root - skip permission test
            return

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a read-only directory (Unix only)
            if os.name != 'nt':  # Skip on Windows
                readonly_dir = Path(tmpdir) / "readonly"
                readonly_dir.mkdir()
                os.chmod(readonly_dir, 0o444)

                try:
                    executor = WriteFileExecutor(working_dir=str(readonly_dir))
                    action = WriteFileAction(
                        path="test.txt",
                        content="content"
                    )

                    result = executor(action)

                    # Should fail gracefully
                    assert result.success is False
                    assert result.error != ""
                finally:
                    # Restore permissions for cleanup
                    os.chmod(readonly_dir, 0o755)

    def test_diff_patch_invalid_diff(self):
        """Test DiffPatchTool rejects invalid diffs."""
        from tools.diff_patch import DiffPatchAction, DiffPatchExecutor

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a file to patch
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("original content")

            executor = DiffPatchExecutor(
                terminal=MagicMock(),
                working_dir=tmpdir
            )

            action = DiffPatchAction(
                path="test.txt",
                diff="this is not a valid diff format"
            )

            result = executor(action)

            assert result.success is False
            assert "Invalid diff" in result.error


# =============================================================================
# Run Tests
# =============================================================================

def run_all_tests():
    """Run all integration tests."""
    print("\n" + "=" * 60)
    print("OpenHands Integration Tests")
    print("=" * 60)

    api_key = get_api_key()
    if api_key:
        print(f"API key found: {'*' * 8}...{api_key[-4:]}")
    else:
        print("No API key found - some tests will be skipped")

    print("=" * 60 + "\n")

    test_classes = [
        TestVisualGeneratorModule,
        TestAgentCreation,
        TestFullWorkflowIntegration,
        TestToolIntegration,
        TestErrorHandling,
    ]

    passed = 0
    failed = 0
    skipped = 0

    for test_class in test_classes:
        print(f"\n--- {test_class.__name__} ---")
        instance = test_class()

        for method_name in dir(instance):
            if method_name.startswith("test_"):
                try:
                    getattr(instance, method_name)()
                    print(f"  ✓ {method_name}")
                    passed += 1
                except pytest.skip.Exception as e:
                    print(f"  ○ {method_name} (skipped: {e})")
                    skipped += 1
                except Exception as e:
                    print(f"  ✗ {method_name}: {e}")
                    failed += 1

    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed, {skipped} skipped")
    print("=" * 60)

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
