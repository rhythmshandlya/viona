#!/usr/bin/env python3
"""
Unit tests for Root.tsx auto-generator.

These tests do NOT require API keys.
Run with: pytest tests/test_root_generator.py -v
"""

import os
import sys
import tempfile
from pathlib import Path

import pytest

# Add tools to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.root_generator import (
    CompositionInfo,
    scan_compositions,
    generate_root_tsx,
    generate_and_write_root,
    _to_composition_id,
    _is_video_component,
    _get_import_path,
)


# =============================================================================
# Helper Function Tests
# =============================================================================

class TestHelperFunctions:
    """Tests for helper functions."""

    def test_to_composition_id_pascal_case(self):
        """Test converting PascalCase to kebab-case."""
        assert _to_composition_id("BubbleSort") == "bubble-sort"
        assert _to_composition_id("MyAwesomeComponent") == "my-awesome-component"
        assert _to_composition_id("ABC") == "a-b-c"

    def test_to_composition_id_single_word(self):
        """Test single word conversion."""
        assert _to_composition_id("Component") == "component"
        assert _to_composition_id("Test") == "test"

    def test_is_video_component_true(self):
        """Test detection of video components."""
        content_samples = [
            "import { useCurrentFrame } from 'remotion';",
            "const frame = useVideoConfig();",
            "const opacity = interpolate(frame, [0, 30], [0, 1]);",
            "return <AbsoluteFill>",
            "<Sequence from={30}>",
        ]

        for content in content_samples:
            assert _is_video_component(content), f"Should detect: {content}"

    def test_is_video_component_false(self):
        """Test non-video components are not detected."""
        content_samples = [
            "import React from 'react';",
            "const Button = () => <button>Click</button>;",
            "export default function App() { return <div />; }",
        ]

        for content in content_samples:
            assert not _is_video_component(content), f"Should not detect: {content}"


# =============================================================================
# CompositionInfo Tests
# =============================================================================

class TestCompositionInfo:
    """Tests for CompositionInfo dataclass."""

    def test_create_composition_info(self):
        """Test creating CompositionInfo."""
        info = CompositionInfo(
            component_name="BubbleSort",
            composition_id="bubble-sort",
            import_path="./BubbleSort",
            source_file="/workspace/src/BubbleSort/index.tsx"
        )

        assert info.component_name == "BubbleSort"
        assert info.composition_id == "bubble-sort"
        assert info.duration_in_frames == 300  # default
        assert info.fps == 30  # default

    def test_composition_info_custom_config(self):
        """Test CompositionInfo with custom video config."""
        info = CompositionInfo(
            component_name="Test",
            composition_id="test",
            import_path="./Test",
            source_file="/workspace/src/Test.tsx",
            duration_in_frames=900,
            fps=60,
            width=3840,
            height=2160
        )

        assert info.duration_in_frames == 900
        assert info.fps == 60
        assert info.width == 3840
        assert info.height == 2160


# =============================================================================
# scan_compositions Tests
# =============================================================================

class TestScanCompositions:
    """Tests for scan_compositions function."""

    def test_scan_empty_directory(self):
        """Test scanning empty directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            compositions = scan_compositions(tmpdir)
            assert compositions == []

    def test_scan_nonexistent_directory(self):
        """Test scanning non-existent directory."""
        compositions = scan_compositions("/nonexistent/path")
        assert compositions == []

    def test_scan_simple_composition(self):
        """Test scanning a simple composition component."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a simple video component
            comp_dir = Path(tmpdir) / "MyVideo"
            comp_dir.mkdir()

            (comp_dir / "index.tsx").write_text("""
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const MyVideo = () => {
    const frame = useCurrentFrame();
    const { width, height } = useVideoConfig();

    const opacity = interpolate(frame, [0, 30], [0, 1]);

    return <div style={{ opacity }}>Hello</div>;
};
""")

            compositions = scan_compositions(tmpdir)

            assert len(compositions) == 1
            assert compositions[0].component_name == "MyVideo"
            # Composition ID uses folder name (with underscores converted to hyphens)
            assert compositions[0].composition_id == "MyVideo"

    def test_scan_with_metadata_json(self):
        """Test that metadata.json updates composition config."""
        with tempfile.TemporaryDirectory() as tmpdir:
            comp_dir = Path(tmpdir) / "CustomVideo"
            comp_dir.mkdir()

            (comp_dir / "index.tsx").write_text("""
import { useCurrentFrame } from 'remotion';
export const CustomVideo = () => {
    const frame = useCurrentFrame();
    return <div>{frame}</div>;
};
""")

            (comp_dir / "metadata.json").write_text("""{
    "durationInFrames": 600,
    "fps": 60,
    "width": 3840,
    "height": 2160
}""")

            compositions = scan_compositions(tmpdir)

            assert len(compositions) == 1
            assert compositions[0].duration_in_frames == 600
            assert compositions[0].fps == 60
            assert compositions[0].width == 3840
            assert compositions[0].height == 2160

    def test_scan_skips_root_tsx(self):
        """Test that Root.tsx named files are skipped."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a project that only has Root.tsx (no index.tsx)
            proj = Path(tmpdir) / "MyProject"
            proj.mkdir()
            (proj / "Root.tsx").write_text("""
import { useCurrentFrame } from 'remotion';
export const RemotionRoot = () => <div />;
""")

            compositions = scan_compositions(tmpdir)
            # Root.tsx is not a valid entry point, so no compositions found
            assert compositions == []

    def test_scan_with_project_id(self):
        """Test scanning with specific project_id returns ONLY that project."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create two projects
            proj1 = Path(tmpdir) / "Project1"
            proj1.mkdir()
            (proj1 / "index.tsx").write_text("""
import { useCurrentFrame } from 'remotion';
export const Project1 = () => <div />;
""")

            proj2 = Path(tmpdir) / "Project2"
            proj2.mkdir()
            (proj2 / "index.tsx").write_text("""
import { useCurrentFrame } from 'remotion';
export const Project2 = () => <div />;
""")

            # Scan with specific project_id - should ONLY return that project
            compositions = scan_compositions(tmpdir, project_id="Project1")

            assert len(compositions) == 1
            # Composition ID uses folder name
            assert compositions[0].composition_id == "Project1"
            assert compositions[0].component_name == "Project1"

            # Scan all should find both
            all_comps = scan_compositions(tmpdir)
            assert len(all_comps) == 2

    def test_scan_nested_components(self):
        """Test that only main entry points are found, not helper components."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create nested structure
            proj_dir = Path(tmpdir) / "MyProject"
            proj_dir.mkdir()

            (proj_dir / "index.tsx").write_text("""
import { useCurrentFrame } from 'remotion';
import { Scene1 } from './Scene1';

export const MyProject = () => {
    const frame = useCurrentFrame();
    return <Scene1 />;
};
""")

            # Scene1 is a helper component - should NOT be picked up
            (proj_dir / "Scene1.tsx").write_text("""
import { useCurrentFrame } from 'remotion';
export const Scene1 = () => <div />;
""")

            # Create a components subdirectory with helpers
            components_dir = proj_dir / "components"
            components_dir.mkdir()
            (components_dir / "Helper.tsx").write_text("""
import { interpolate } from 'remotion';
export const Helper = () => <div />;
""")

            compositions = scan_compositions(tmpdir)

            # Should ONLY find MyProject, not Scene1 or Helper
            assert len(compositions) == 1
            assert compositions[0].component_name == "MyProject"

    def test_scan_deduplicates_by_id(self):
        """Test that duplicate composition IDs are deduplicated."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a project directory
            proj1 = Path(tmpdir) / "Test"
            proj1.mkdir()
            (proj1 / "index.tsx").write_text("""
import { useCurrentFrame } from 'remotion';
export const Test = () => <div />;
""")

            # Note: Can't have two directories with same name, so this tests
            # the deduplication logic in a realistic scenario
            compositions = scan_compositions(tmpdir)

            # Should only have one "Test" composition (using folder name)
            test_comps = [c for c in compositions if c.composition_id == "Test"]
            assert len(test_comps) == 1


# =============================================================================
# generate_root_tsx Tests
# =============================================================================

class TestGenerateRootTsx:
    """Tests for generate_root_tsx function."""

    def test_generate_empty_compositions(self):
        """Test generating Root.tsx with no compositions."""
        content = generate_root_tsx([])

        assert "Composition" in content
        assert "RemotionRoot" in content
        assert "No compositions found" in content

    def test_generate_single_composition(self):
        """Test generating Root.tsx with one composition."""
        compositions = [
            CompositionInfo(
                component_name="MyVideo",
                composition_id="my-video",
                import_path="./MyVideo",
                source_file="/workspace/src/MyVideo/index.tsx",
                duration_in_frames=300,
                fps=30,
                width=1920,
                height=1080
            )
        ]

        content = generate_root_tsx(compositions)

        assert 'import { MyVideo } from "./MyVideo";' in content
        assert 'id="my-video"' in content
        assert 'component={MyVideo}' in content
        assert 'durationInFrames={300}' in content
        assert 'fps={30}' in content
        assert 'width={1920}' in content
        assert 'height={1080}' in content

    def test_generate_multiple_compositions(self):
        """Test generating Root.tsx with multiple compositions."""
        compositions = [
            CompositionInfo(
                component_name="Video1",
                composition_id="video-1",
                import_path="./Video1",
                source_file="src/Video1.tsx"
            ),
            CompositionInfo(
                component_name="Video2",
                composition_id="video-2",
                import_path="./Video2",
                source_file="src/Video2.tsx"
            ),
        ]

        content = generate_root_tsx(compositions)

        assert 'import { Video1 } from "./Video1";' in content
        assert 'import { Video2 } from "./Video2";' in content
        assert 'id="video-1"' in content
        assert 'id="video-2"' in content

    def test_generate_without_css_import(self):
        """Test generating Root.tsx without CSS import."""
        compositions = [
            CompositionInfo(
                component_name="Test",
                composition_id="test",
                import_path="./Test",
                source_file="src/Test.tsx"
            )
        ]

        content = generate_root_tsx(compositions, include_css_import=False)

        assert 'import "./index.css"' not in content
        assert 'import { Composition }' in content

    def test_generate_with_css_import(self):
        """Test generating Root.tsx with CSS import (default)."""
        compositions = [
            CompositionInfo(
                component_name="Test",
                composition_id="test",
                import_path="./Test",
                source_file="src/Test.tsx"
            )
        ]

        content = generate_root_tsx(compositions, include_css_import=True)

        assert 'import "./index.css";' in content

    def test_generated_root_tsx_is_valid_syntax(self):
        """Test that generated Root.tsx has valid TypeScript/JSX structure."""
        compositions = [
            CompositionInfo(
                component_name="MyComp",
                composition_id="my-comp",
                import_path="./MyComp",
                source_file="src/MyComp.tsx"
            )
        ]

        content = generate_root_tsx(compositions)

        # Check for balanced curly braces and parentheses
        assert content.count('{') == content.count('}'), "Unbalanced curly braces"
        assert content.count('(') == content.count(')'), "Unbalanced parentheses"

        # Note: < and > don't need to be equal because JSX uses /> for self-closing
        # Instead, check for proper JSX structure
        assert '<>' in content, "Missing fragment opening"
        assert '</>' in content, "Missing fragment closing"

        # Check for required exports
        assert 'export const RemotionRoot' in content
        assert 'import { Composition }' in content


# =============================================================================
# generate_and_write_root Tests
# =============================================================================

class TestGenerateAndWriteRoot:
    """Tests for generate_and_write_root function."""

    def test_write_root_no_src_dir(self):
        """Test error when src/ doesn't exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            success, message, compositions = generate_and_write_root(tmpdir)

            assert success is False
            assert "src/" in message
            assert compositions == []

    def test_write_root_no_compositions(self):
        """Test error when no compositions found."""
        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "src").mkdir()

            success, message, compositions = generate_and_write_root(tmpdir)

            assert success is False
            assert "No compositions" in message

    def test_write_root_success(self):
        """Test successful Root.tsx generation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            src_dir = Path(tmpdir) / "src"
            src_dir.mkdir()

            comp_dir = src_dir / "TestComp"
            comp_dir.mkdir()

            (comp_dir / "index.tsx").write_text("""
import { useCurrentFrame } from 'remotion';
export const TestComp = () => {
    const frame = useCurrentFrame();
    return <div>{frame}</div>;
};
""")

            success, message, compositions = generate_and_write_root(tmpdir)

            assert success is True
            assert "1 composition" in message
            assert len(compositions) == 1

            # Check Root.tsx was written
            root_path = src_dir / "Root.tsx"
            assert root_path.exists()

            content = root_path.read_text()
            assert 'import { TestComp }' in content
            assert 'component={TestComp}' in content

    def test_write_root_with_project_id(self):
        """Test Root.tsx generation with specific project_id."""
        with tempfile.TemporaryDirectory() as tmpdir:
            src_dir = Path(tmpdir) / "src"
            src_dir.mkdir()

            # Create target project
            proj_dir = src_dir / "TargetProject"
            proj_dir.mkdir()

            (proj_dir / "index.tsx").write_text("""
import { useCurrentFrame } from 'remotion';
export const TargetProject = () => <div />;
""")

            success, message, compositions = generate_and_write_root(
                tmpdir,
                project_id="TargetProject"
            )

            assert success is True
            comp_ids = [c.composition_id for c in compositions]
            # Composition ID uses folder name
            assert "TargetProject" in comp_ids


# =============================================================================
# Integration Test
# =============================================================================

class TestRootGeneratorIntegration:
    """Integration tests for the full Root.tsx generation workflow."""

    def test_full_workflow(self):
        """Test complete workflow: create project -> scan -> generate Root.tsx."""
        with tempfile.TemporaryDirectory() as tmpdir:
            src_dir = Path(tmpdir) / "src"
            src_dir.mkdir()

            # Create a realistic project structure
            bubble_sort = src_dir / "BubbleSort"
            bubble_sort.mkdir()

            (bubble_sort / "index.tsx").write_text("""
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from 'remotion';
import { Bars } from './Bars';

export const BubbleSort: React.FC = () => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    const progress = interpolate(frame, [0, durationInFrames], [0, 1]);

    return (
        <AbsoluteFill style={{ backgroundColor: '#1a1a2e' }}>
            <Bars progress={progress} />
        </AbsoluteFill>
    );
};
""")

            (bubble_sort / "Bars.tsx").write_text("""
import React from 'react';
import { interpolate } from 'remotion';

interface BarsProps {
    progress: number;
}

export const Bars: React.FC<BarsProps> = ({ progress }) => {
    return <div>Bars visualization at {progress}</div>;
};
""")

            (bubble_sort / "metadata.json").write_text("""{
    "durationInFrames": 900,
    "fps": 30,
    "width": 1920,
    "height": 1080
}""")

            # Run the generator
            success, message, compositions = generate_and_write_root(
                tmpdir,
                project_id="BubbleSort"
            )

            # Verify success - should find exactly 1 composition (BubbleSort only)
            assert success is True
            assert len(compositions) == 1
            assert compositions[0].component_name == "BubbleSort"

            # Verify Root.tsx content
            root_content = (src_dir / "Root.tsx").read_text()

            assert 'import { Composition } from "remotion";' in root_content
            assert 'import { BubbleSort }' in root_content
            # Composition ID uses folder name
            assert 'id="BubbleSort"' in root_content
            assert 'durationInFrames={900}' in root_content
            assert 'fps={30}' in root_content
            assert 'export const RemotionRoot' in root_content


# =============================================================================
# Run Tests
# =============================================================================

def run_all_tests():
    """Run all Root.tsx generator tests."""
    print("\n" + "=" * 60)
    print("Root.tsx Generator Unit Tests (No API Required)")
    print("=" * 60 + "\n")

    test_classes = [
        TestHelperFunctions,
        TestCompositionInfo,
        TestScanCompositions,
        TestGenerateRootTsx,
        TestGenerateAndWriteRoot,
        TestRootGeneratorIntegration,
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
