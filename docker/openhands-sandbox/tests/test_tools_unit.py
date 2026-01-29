#!/usr/bin/env python3
"""
Unit tests for custom OpenHands tools.

These tests do NOT require API keys and test the tool logic directly.
Run with: pytest tests/test_tools_unit.py -v
"""

import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add tools to path
sys.path.insert(0, str(Path(__file__).parent.parent))


# =============================================================================
# WriteFileTool Tests
# =============================================================================

class TestWriteFileTool:
    """Tests for WriteFileTool."""

    def test_import(self):
        """Test that WriteFileTool can be imported."""
        from tools.write_file import (
            WriteFileTool,
            WriteFileAction,
            WriteFileObservation,
            WriteFileExecutor,
        )
        assert WriteFileTool.name == "WriteFileTool"

    def test_write_new_file(self):
        """Test writing a new file."""
        from tools.write_file import WriteFileAction, WriteFileExecutor

        with tempfile.TemporaryDirectory() as tmpdir:
            executor = WriteFileExecutor(working_dir=tmpdir)
            action = WriteFileAction(
                path="test.txt",
                content="Hello, World!"
            )

            result = executor(action)

            assert result.success is True
            assert result.created_new is True
            assert result.bytes_written == 13
            assert Path(tmpdir, "test.txt").read_text() == "Hello, World!"

    def test_overwrite_existing_file(self):
        """Test overwriting an existing file."""
        from tools.write_file import WriteFileAction, WriteFileExecutor

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create existing file
            test_file = Path(tmpdir, "test.txt")
            test_file.write_text("Old content")

            executor = WriteFileExecutor(working_dir=tmpdir)
            action = WriteFileAction(
                path="test.txt",
                content="New content"
            )

            result = executor(action)

            assert result.success is True
            assert result.created_new is False
            assert test_file.read_text() == "New content"

    def test_create_nested_directories(self):
        """Test creating nested directories automatically."""
        from tools.write_file import WriteFileAction, WriteFileExecutor

        with tempfile.TemporaryDirectory() as tmpdir:
            executor = WriteFileExecutor(working_dir=tmpdir)
            action = WriteFileAction(
                path="deep/nested/path/file.txt",
                content="Nested content"
            )

            result = executor(action)

            assert result.success is True
            assert result.created_new is True
            assert Path(tmpdir, "deep/nested/path/file.txt").read_text() == "Nested content"

    def test_security_path_traversal(self):
        """Test that path traversal attacks are blocked."""
        from tools.write_file import WriteFileAction, WriteFileExecutor

        with tempfile.TemporaryDirectory() as tmpdir:
            executor = WriteFileExecutor(working_dir=tmpdir)
            action = WriteFileAction(
                path="../../../etc/passwd",
                content="malicious"
            )

            result = executor(action)

            assert result.success is False
            assert "outside workspace" in result.error

    def test_unicode_content(self):
        """Test writing unicode content."""
        from tools.write_file import WriteFileAction, WriteFileExecutor

        with tempfile.TemporaryDirectory() as tmpdir:
            executor = WriteFileExecutor(working_dir=tmpdir)
            action = WriteFileAction(
                path="unicode.txt",
                content="Hello 世界 🌍 émojis"
            )

            result = executor(action)

            assert result.success is True
            assert Path(tmpdir, "unicode.txt").read_text(encoding="utf-8") == "Hello 世界 🌍 émojis"

    def test_llm_content_success(self):
        """Test LLM content generation for success case."""
        from tools.write_file import WriteFileObservation

        obs = WriteFileObservation(
            success=True,
            path="/workspace/test.txt",
            bytes_written=100,
            created_new=True
        )

        content = obs.to_llm_content
        assert len(content) == 1
        assert "Created" in content[0].text
        assert "100 bytes" in content[0].text

    def test_llm_content_failure(self):
        """Test LLM content generation for failure case."""
        from tools.write_file import WriteFileObservation

        obs = WriteFileObservation(
            success=False,
            error="Permission denied"
        )

        content = obs.to_llm_content
        assert len(content) == 1
        assert "Failed" in content[0].text
        assert "Permission denied" in content[0].text


# =============================================================================
# DiffPatchTool Tests
# =============================================================================

class TestDiffPatchTool:
    """Tests for DiffPatchTool."""

    def test_import(self):
        """Test that DiffPatchTool can be imported."""
        from tools.diff_patch import (
            DiffPatchTool,
            DiffPatchAction,
            DiffPatchObservation,
            DiffPatchExecutor,
        )
        assert DiffPatchTool.name == "DiffPatchTool"

    def test_validate_diff_empty(self):
        """Test validation rejects empty diff."""
        from tools.diff_patch import DiffPatchExecutor

        executor = DiffPatchExecutor(terminal=MagicMock(), working_dir="/tmp")
        is_valid, error = executor.validate_diff("")

        assert is_valid is False
        assert "empty" in error.lower()

    def test_validate_diff_missing_header(self):
        """Test validation rejects diff without header."""
        from tools.diff_patch import DiffPatchExecutor

        executor = DiffPatchExecutor(terminal=MagicMock(), working_dir="/tmp")
        is_valid, error = executor.validate_diff("some random text")

        assert is_valid is False
        assert "header" in error.lower()

    def test_validate_diff_missing_hunk(self):
        """Test validation rejects diff without hunk header."""
        from tools.diff_patch import DiffPatchExecutor

        diff = """--- a/file.txt
+++ b/file.txt
 some content without hunk header"""

        executor = DiffPatchExecutor(terminal=MagicMock(), working_dir="/tmp")
        is_valid, error = executor.validate_diff(diff)

        assert is_valid is False
        assert "hunk" in error.lower()

    def test_validate_diff_merge_conflict(self):
        """Test validation rejects diff with merge conflict markers."""
        from tools.diff_patch import DiffPatchExecutor

        diff = """--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
<<<<<<< HEAD
 content
======="""

        executor = DiffPatchExecutor(terminal=MagicMock(), working_dir="/tmp")
        is_valid, error = executor.validate_diff(diff)

        assert is_valid is False
        assert "merge conflict" in error.lower()

    def test_validate_diff_valid(self):
        """Test validation accepts valid diff."""
        from tools.diff_patch import DiffPatchExecutor

        diff = """--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line 1
-old line
+new line
 line 3"""

        executor = DiffPatchExecutor(terminal=MagicMock(), working_dir="/tmp")
        is_valid, error = executor.validate_diff(diff)

        assert is_valid is True
        assert error == ""

    def test_security_path_traversal(self):
        """Test that path traversal attacks are blocked."""
        from tools.diff_patch import DiffPatchAction, DiffPatchExecutor

        with tempfile.TemporaryDirectory() as tmpdir:
            executor = DiffPatchExecutor(terminal=MagicMock(), working_dir=tmpdir)
            action = DiffPatchAction(
                path="../../../etc/passwd",
                diff="--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b"
            )

            result = executor(action)

            assert result.success is False
            assert "outside workspace" in result.error

    def test_file_not_found(self):
        """Test error when file doesn't exist."""
        from tools.diff_patch import DiffPatchAction, DiffPatchExecutor

        with tempfile.TemporaryDirectory() as tmpdir:
            executor = DiffPatchExecutor(terminal=MagicMock(), working_dir=tmpdir)
            action = DiffPatchAction(
                path="nonexistent.txt",
                diff="--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b"
            )

            result = executor(action)

            assert result.success is False
            assert "does not exist" in result.error

    def test_llm_content_success(self):
        """Test LLM content generation for success case."""
        from tools.diff_patch import DiffPatchObservation

        obs = DiffPatchObservation(
            success=True,
            path="/workspace/test.txt",
            hunks_applied=3,
            hunks_failed=0
        )

        content = obs.to_llm_content
        assert len(content) == 1
        assert "successfully" in content[0].text
        assert "3" in content[0].text

    def test_llm_content_partial(self):
        """Test LLM content generation for partial success."""
        from tools.diff_patch import DiffPatchObservation

        obs = DiffPatchObservation(
            success=False,
            path="/workspace/test.txt",
            hunks_applied=2,
            hunks_failed=1
        )

        content = obs.to_llm_content
        assert len(content) == 1
        assert "partially" in content[0].text.lower()
        assert "WriteFileTool" in content[0].text


# =============================================================================
# TypeScriptValidatorTool Tests
# =============================================================================

class TestTypeScriptValidatorTool:
    """Tests for TypeScriptValidatorTool."""

    def test_import(self):
        """Test that TypeScriptValidatorTool can be imported."""
        from tools.typescript_validator import (
            TypeScriptValidatorTool,
            TypeScriptValidatorAction,
            TypeScriptValidatorObservation,
        )
        assert TypeScriptValidatorTool.name == "TypeScriptValidatorTool"

    def test_error_pattern_parsing(self):
        """Test parsing TypeScript error output."""
        from tools.typescript_validator import TypeScriptValidatorExecutor

        output = """src/Component.tsx(15,10): error TS2304: Cannot find name 'foo'.
src/Other.tsx(20,5): error TS2339: Property 'bar' does not exist."""

        errors = []
        for match in TypeScriptValidatorExecutor.ERROR_PATTERN.finditer(output):
            file_path, line, column, _, code, message = match.groups()
            errors.append({
                "file": file_path,
                "line": int(line),
                "code": code,
                "message": message.strip()
            })

        assert len(errors) == 2
        assert errors[0]["file"] == "src/Component.tsx"
        assert errors[0]["line"] == 15
        assert errors[0]["code"] == "TS2304"
        assert errors[1]["file"] == "src/Other.tsx"

    def test_llm_content_success(self):
        """Test LLM content for successful validation."""
        from tools.typescript_validator import TypeScriptValidatorObservation

        obs = TypeScriptValidatorObservation(
            success=True,
            error_count=0,
            errors=[]
        )

        content = obs.to_llm_content
        assert len(content) == 1
        assert "passed" in content[0].text.lower()

    def test_llm_content_errors(self):
        """Test LLM content for validation with errors."""
        from tools.typescript_validator import TypeScriptValidatorObservation

        obs = TypeScriptValidatorObservation(
            success=False,
            error_count=2,
            errors=[
                {"file": "test.tsx", "line": 10, "code": "TS2304", "message": "Cannot find name"},
                {"file": "test.tsx", "line": 20, "code": "TS2339", "message": "Property missing"},
            ]
        )

        content = obs.to_llm_content
        assert len(content) == 1
        assert "FAILED" in content[0].text
        assert "2 error" in content[0].text


# =============================================================================
# RemotionBundleTool Tests
# =============================================================================

class TestRemotionBundleTool:
    """Tests for RemotionBundleTool."""

    def test_import(self):
        """Test that RemotionBundleTool can be imported."""
        from tools.remotion_bundle import (
            RemotionBundleTool,
            RemotionBundleAction,
            RemotionBundleObservation,
        )
        assert RemotionBundleTool.name == "RemotionBundleTool"

    def test_error_patterns(self):
        """Test error extraction patterns."""
        from tools.remotion_bundle import RemotionBundleExecutor

        outputs = [
            "Error: Cannot find module 'react'",
            "Module not found: Error: Can't resolve './Component'",
            "SyntaxError: Unexpected token",
        ]

        for output in outputs:
            found = False
            for pattern in RemotionBundleExecutor.ERROR_PATTERNS:
                if pattern.search(output):
                    found = True
                    break
            assert found, f"Pattern not matched for: {output}"

    def test_llm_content_success(self):
        """Test LLM content for successful bundle."""
        from tools.remotion_bundle import RemotionBundleObservation

        obs = RemotionBundleObservation(
            success=True,
            bundle_path="/workspace/build",
            duration_ms=5000,
            warnings=[]
        )

        content = obs.to_llm_content
        assert len(content) == 1
        assert "succeeded" in content[0].text.lower()
        assert "5000ms" in content[0].text

    def test_llm_content_failure(self):
        """Test LLM content for failed bundle."""
        from tools.remotion_bundle import RemotionBundleObservation

        obs = RemotionBundleObservation(
            success=False,
            errors=["Cannot find module 'react'", "Import not found"],
            raw_output="error output here"
        )

        content = obs.to_llm_content
        assert len(content) == 1
        assert "FAILED" in content[0].text
        assert "react" in content[0].text


# =============================================================================
# RemotionRenderStillTool Tests
# =============================================================================

class TestRemotionRenderStillTool:
    """Tests for RemotionRenderStillTool."""

    def test_import(self):
        """Test that RemotionRenderStillTool can be imported."""
        from tools.remotion_render_still import (
            RemotionRenderStillTool,
            RemotionRenderStillAction,
            RemotionRenderStillObservation,
        )
        assert RemotionRenderStillTool.name == "RemotionRenderStillTool"

    def test_action_defaults(self):
        """Test action default values."""
        from tools.remotion_render_still import RemotionRenderStillAction

        action = RemotionRenderStillAction(composition_id="test")

        assert action.frame == 0
        assert action.width == 1920
        assert action.height == 1080
        assert action.entry_point == "src/index.ts"


# =============================================================================
# Tools __init__ Tests
# =============================================================================

class TestToolsInit:
    """Tests for tools package initialization."""

    def test_all_exports(self):
        """Test that all expected exports are available."""
        from tools import (
            # TypeScript Validator
            TypeScriptValidatorTool,
            TypeScriptValidatorAction,
            TypeScriptValidatorObservation,
            # Remotion Bundle
            RemotionBundleTool,
            RemotionBundleAction,
            RemotionBundleObservation,
            # Remotion Render Still
            RemotionRenderStillTool,
            RemotionRenderStillAction,
            RemotionRenderStillObservation,
            # Write File
            WriteFileTool,
            WriteFileAction,
            WriteFileObservation,
            # Diff Patch
            DiffPatchTool,
            DiffPatchAction,
            DiffPatchObservation,
            # Root Generator
            scan_compositions,
            generate_root_tsx,
            generate_and_write_root,
            CompositionInfo,
        )

        # All imports should succeed
        assert TypeScriptValidatorTool.name == "TypeScriptValidatorTool"
        assert WriteFileTool.name == "WriteFileTool"
        assert DiffPatchTool.name == "DiffPatchTool"


# =============================================================================
# Run Tests
# =============================================================================

def run_all_tests():
    """Run all unit tests."""
    print("\n" + "=" * 60)
    print("OpenHands Tools Unit Tests (No API Required)")
    print("=" * 60 + "\n")

    # Collect test classes
    test_classes = [
        TestWriteFileTool,
        TestDiffPatchTool,
        TestTypeScriptValidatorTool,
        TestRemotionBundleTool,
        TestRemotionRenderStillTool,
        TestToolsInit,
    ]

    passed = 0
    failed = 0

    for test_class in test_classes:
        print(f"\n--- {test_class.__name__} ---")
        instance = test_class()

        for method_name in dir(instance):
            if method_name.startswith("test_"):
                try:
                    getattr(instance, method_name)()
                    print(f"  ✓ {method_name}")
                    passed += 1
                except Exception as e:
                    print(f"  ✗ {method_name}: {e}")
                    failed += 1

    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
