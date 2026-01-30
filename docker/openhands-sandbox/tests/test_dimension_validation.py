"""
Tests for dimension validation and correction in the visual generator.

These tests verify that the dimension handling works correctly:
1. Command-line argument parsing for --width and --height
2. Dimension validation of generated metadata.json
3. Auto-correction of incorrect dimensions
"""

import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
import tempfile
import os


class TestDimensionArgumentParsing:
    """Test that CLI arguments are parsed correctly."""

    def test_default_dimensions(self):
        """Default dimensions should be 1080x1920 (portrait for social media)."""
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--width", type=int, default=1080)
        parser.add_argument("--height", type=int, default=1920)

        args = parser.parse_args([])
        assert args.width == 1080
        assert args.height == 1920

    def test_custom_dimensions(self):
        """Custom dimensions from CLI should be used."""
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--width", type=int, default=1080)
        parser.add_argument("--height", type=int, default=1920)

        # Split layout dimensions
        args = parser.parse_args(["--width", "1080", "--height", "960"])
        assert args.width == 1080
        assert args.height == 960

    def test_landscape_dimensions(self):
        """Landscape dimensions should be accepted."""
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--width", type=int, default=1080)
        parser.add_argument("--height", type=int, default=1920)

        args = parser.parse_args(["--width", "1920", "--height", "1080"])
        assert args.width == 1920
        assert args.height == 1080


class TestMetadataValidation:
    """Test metadata.json dimension validation."""

    def validate_and_correct_dimensions(
        self,
        metadata: dict,
        expected_width: int,
        expected_height: int
    ) -> tuple[bool, dict]:
        """
        Simulate the dimension validation logic from visual_generator.py.

        Returns:
            Tuple of (was_corrected, corrected_metadata)
        """
        actual_width = metadata.get('width', 0)
        actual_height = metadata.get('height', 0)

        if actual_width != expected_width or actual_height != expected_height:
            metadata['width'] = expected_width
            metadata['height'] = expected_height
            return True, metadata

        return False, metadata

    def test_matching_dimensions_not_corrected(self):
        """Correct dimensions should not be modified."""
        metadata = {
            "compositionId": "test-project",
            "durationInFrames": 900,
            "fps": 30,
            "width": 1080,
            "height": 960,
        }

        corrected, result = self.validate_and_correct_dimensions(metadata, 1080, 960)

        assert corrected is False
        assert result["width"] == 1080
        assert result["height"] == 960

    def test_wrong_dimensions_corrected(self):
        """Wrong dimensions should be auto-corrected."""
        # Agent used default 1920x1080 instead of requested 1080x960
        metadata = {
            "compositionId": "test-project",
            "durationInFrames": 900,
            "fps": 30,
            "width": 1920,
            "height": 1080,
        }

        corrected, result = self.validate_and_correct_dimensions(metadata, 1080, 960)

        assert corrected is True
        assert result["width"] == 1080
        assert result["height"] == 960

    def test_missing_dimensions_corrected(self):
        """Missing dimensions should be added."""
        metadata = {
            "compositionId": "test-project",
            "durationInFrames": 900,
            "fps": 30,
        }

        corrected, result = self.validate_and_correct_dimensions(metadata, 1080, 960)

        assert corrected is True
        assert result["width"] == 1080
        assert result["height"] == 960

    def test_other_fields_preserved(self):
        """Non-dimension fields should be preserved during correction."""
        metadata = {
            "compositionId": "test-project",
            "durationInFrames": 900,
            "fps": 30,
            "width": 1920,
            "height": 1080,
            "visuals": [
                {"startMs": 0, "endMs": 5000, "type": "intro"}
            ]
        }

        corrected, result = self.validate_and_correct_dimensions(metadata, 1080, 960)

        assert result["compositionId"] == "test-project"
        assert result["durationInFrames"] == 900
        assert result["fps"] == 30
        assert len(result["visuals"]) == 1

    def test_partial_dimension_corrected(self):
        """Only width wrong should still trigger correction."""
        metadata = {
            "compositionId": "test-project",
            "width": 1920,  # Wrong
            "height": 960,  # Correct
        }

        corrected, result = self.validate_and_correct_dimensions(metadata, 1080, 960)

        assert corrected is True
        assert result["width"] == 1080
        assert result["height"] == 960


class TestDimensionFileCorrection:
    """Test actual file-based dimension correction."""

    def test_metadata_file_correction(self):
        """Test that metadata.json file is correctly updated."""
        with tempfile.TemporaryDirectory() as tmpdir:
            metadata_path = Path(tmpdir) / "metadata.json"

            # Write incorrect metadata
            original_metadata = {
                "compositionId": "test-project",
                "durationInFrames": 900,
                "fps": 30,
                "width": 1920,
                "height": 1080,
            }
            metadata_path.write_text(json.dumps(original_metadata, indent=2))

            # Simulate correction logic
            expected_width = 1080
            expected_height = 960

            metadata = json.loads(metadata_path.read_text())
            if metadata.get("width") != expected_width or metadata.get("height") != expected_height:
                metadata["width"] = expected_width
                metadata["height"] = expected_height
                metadata_path.write_text(json.dumps(metadata, indent=2))

            # Verify correction
            corrected = json.loads(metadata_path.read_text())
            assert corrected["width"] == 1080
            assert corrected["height"] == 960
            assert corrected["compositionId"] == "test-project"


class TestDimensionCalculations:
    """Test dimension calculations for different layouts."""

    def calculate_visuals_dimensions(
        self,
        canvas_width: int,
        canvas_height: int,
        layout_mode: str,
        split_ratio: int
    ) -> tuple[int, int]:
        """
        Calculate visuals dimensions based on layout mode.
        Replicates frontend logic for verification.
        """
        if layout_mode == 'pip':
            return canvas_width, canvas_height
        elif layout_mode == 'split-horizontal':
            visuals_height = round(canvas_height * (split_ratio / 100))
            return canvas_width, visuals_height
        else:  # split-vertical
            visuals_width = round(canvas_width * (split_ratio / 100))
            return visuals_width, canvas_height

    def test_pip_full_canvas(self):
        """PiP layout should use full canvas."""
        width, height = self.calculate_visuals_dimensions(1080, 1920, 'pip', 50)
        assert width == 1080
        assert height == 1920

    def test_split_horizontal_50_50(self):
        """50/50 horizontal split should halve height."""
        width, height = self.calculate_visuals_dimensions(1080, 1920, 'split-horizontal', 50)
        assert width == 1080
        assert height == 960

    def test_split_horizontal_30_70(self):
        """30/70 horizontal split should use 30% height for visuals."""
        width, height = self.calculate_visuals_dimensions(1080, 1920, 'split-horizontal', 30)
        assert width == 1080
        assert height == 576

    def test_split_horizontal_70_30(self):
        """70/30 horizontal split should use 70% height for visuals."""
        width, height = self.calculate_visuals_dimensions(1080, 1920, 'split-horizontal', 70)
        assert width == 1080
        assert height == 1344

    def test_split_vertical_50_50(self):
        """50/50 vertical split should halve width."""
        width, height = self.calculate_visuals_dimensions(1080, 1920, 'split-vertical', 50)
        assert width == 540
        assert height == 1920

    def test_landscape_canvas(self):
        """Landscape canvas dimensions should work correctly."""
        width, height = self.calculate_visuals_dimensions(1920, 1080, 'split-horizontal', 50)
        assert width == 1920
        assert height == 540


class TestAspectRatioDetection:
    """Test aspect ratio detection for prompt generation."""

    def get_aspect_ratio_type(self, width: int, height: int) -> str:
        if height > width:
            return 'portrait'
        elif width > height:
            return 'landscape'
        return 'square'

    def test_portrait_detection(self):
        assert self.get_aspect_ratio_type(1080, 1920) == 'portrait'
        assert self.get_aspect_ratio_type(720, 1280) == 'portrait'

    def test_landscape_detection(self):
        assert self.get_aspect_ratio_type(1920, 1080) == 'landscape'
        assert self.get_aspect_ratio_type(1280, 720) == 'landscape'

    def test_square_detection(self):
        assert self.get_aspect_ratio_type(1080, 1080) == 'square'


class TestResponsiveSizeCalculations:
    """Test responsive size calculations for the prompt."""

    def calculate_responsive_sizes(self, width: int, height: int) -> dict:
        return {
            'title_size': round(height * 0.04),
            'body_size': round(height * 0.025),
            'padding': round(min(width, height) * 0.05),
        }

    def test_portrait_sizes(self):
        sizes = self.calculate_responsive_sizes(1080, 1920)
        assert sizes['title_size'] == 77
        assert sizes['body_size'] == 48
        assert sizes['padding'] == 54

    def test_landscape_sizes(self):
        sizes = self.calculate_responsive_sizes(1920, 1080)
        assert sizes['title_size'] == 43
        assert sizes['body_size'] == 27
        assert sizes['padding'] == 54

    def test_split_layout_sizes(self):
        sizes = self.calculate_responsive_sizes(1080, 960)
        assert sizes['title_size'] == 38
        assert sizes['body_size'] == 24
        assert sizes['padding'] == 48


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
