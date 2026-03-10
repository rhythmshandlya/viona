#!/usr/bin/env python3
"""
Claude Visual Generator — orchestrates the visual generation pipeline.

Phases:
  0. Assistant Director → CREATIVE_BRIEF.md
  1. Director → SCENE_PLAN.md + scenes.json
  2. Animator (sequential) → Scene*.tsx files
  2e. Visual verification → screenshot review + fixes
  3. Bundle → Remotion bundle + CJS compilation

The class is composed of mixins for maintainability:
  _image_fetcher    — Pexels/Freepik image downloads
  _validators       — scene plan, metadata, interpolate clamping, overlay, dotgrid
  _verdict_parser   — structured + text fallback verdict parsing
  _typescript_healer — tsc verification + self-heal agent
  _build_pipeline   — entry point setup, Remotion bundle, CJS compilation
  _visual_verification — screenshot rendering, visual review, fix loops
  _scene_verification  — scene code verify, fix, composition verify
  _codegen          — index.tsx, metadata.json, composition ID
  _director         — Phase 1: scene planning from transcript
  _animator         — Phase 2: parallel scene generation via subagents
  _pipeline         — Two-phase orchestration (Director + Animator end-to-end)
"""

import asyncio
import json
import os
import sys
import threading
import time
from pathlib import Path

# Add agents directory to path for local imports
_agents_dir = Path(__file__).parent
if str(_agents_dir) not in sys.path:
    sys.path.insert(0, str(_agents_dir))

# Add src directory to path so `prompts` package resolves to src/prompts/
_src_dir = str(Path(__file__).parent.parent)
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

# Infrastructure imports (OAuth, SDK config, security)
from oauth import get_token_manager
from sdk_config import (
    emit_progress,
    create_security_settings,
)

# Mixin imports
from visual_generator import (
    ImageFetcherMixin,
    ValidatorsMixin,
    VerdictParserMixin,
    TypeScriptHealerMixin,
    BuildPipelineMixin,
    VisualVerificationMixin,
    SceneVerificationMixin,
    CodegenMixin,
    DirectorMixin,
    AnimatorMixin,
    PipelineMixin,
)


# =============================================================================
# Heartbeat Emitter
# =============================================================================


class HeartbeatEmitter:
    """Background thread heartbeat — keeps beating even if main thread hangs on API call."""

    def __init__(self, interval_sec: int = 10):
        self.phase = "starting"
        self.detail = ""
        self._interval = interval_sec
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self):
        while not self._stop.is_set():
            ts = int(time.time() * 1000)
            print(f"HEARTBEAT:{ts}:{self.phase}:{self.detail}", flush=True)
            self._stop.wait(self._interval)

    def update(self, phase: str, detail: str = ""):
        self.phase = phase
        self.detail = detail

    def stop(self):
        self._stop.set()
        self._thread.join(timeout=2)


# =============================================================================
# Visual Generator Class
# =============================================================================


class ClaudeVisualGenerator(
    ImageFetcherMixin,
    ValidatorsMixin,
    VerdictParserMixin,
    TypeScriptHealerMixin,
    BuildPipelineMixin,
    VisualVerificationMixin,
    SceneVerificationMixin,
    CodegenMixin,
    DirectorMixin,
    AnimatorMixin,
    PipelineMixin,
):
    """
    Generates Remotion video compositions using Claude Agent SDK.

    Uses OAuth authentication from Claude Pro/Max subscription.
    """

    def __init__(
        self,
        workspace: Path,
        project_id: str,
        bundle_output: Path,
        model: str = "claude-opus-4-5-20251101",
        max_thinking_tokens: int = 10000,
        max_turns: int = 100,
    ):
        self.workspace = workspace
        self.project_id = project_id
        self.src_dir = workspace / "src" / project_id
        self.bundle_output = bundle_output
        self.model = model
        self.max_thinking_tokens = max_thinking_tokens
        self.max_turns = max_turns

    def _write_security_settings(self) -> Path:
        """Write security settings to a temporary file."""
        settings = create_security_settings(str(self.workspace))
        settings_path = self.workspace / ".claude" / "settings.local.json"
        settings_path.parent.mkdir(parents=True, exist_ok=True)

        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)

        return settings_path


# =============================================================================
# CLI Entry Point
# =============================================================================


async def main():
    """CLI entry point for testing."""
    import argparse

    parser = argparse.ArgumentParser(description="Claude Code Visual Generator")
    parser.add_argument("--workspace", required=True, help="Path to Remotion workspace")
    parser.add_argument("--project-id", required=True, help="Project ID")
    parser.add_argument("--bundle-output", required=True, help="Bundle output directory")
    parser.add_argument("--transcript", required=True, help="Transcript text or file path")
    parser.add_argument("--words-json", help="Path to words JSON file with timestamps")
    parser.add_argument("--style-guide", help="Path to user style guide text file")
    parser.add_argument("--style-preset", default="studio-dark", help="Visual style preset (studio-dark, studio-light)")
    parser.add_argument("--layout-mode", default="pip", help="Layout mode (pip, stacked)")
    parser.add_argument("--width", type=int, default=1080, help="Video width")
    parser.add_argument("--height", type=int, default=1920, help="Video height")
    parser.add_argument("--duration", type=int, default=1800, help="Duration in frames")
    parser.add_argument("--fps", type=int, default=30, help="Frames per second")
    parser.add_argument("--model", default="claude-opus-4-5-20251101", help="Claude model")
    parser.add_argument("--source-width", type=int, default=None, help="Source video width (for coverage-aware layout)")
    parser.add_argument("--source-height", type=int, default=None, help="Source video height (for coverage-aware layout)")
    parser.add_argument("--pip-width", type=int, default=None, help="Effective pip width for stacked layout")
    parser.add_argument("--pip-height", type=int, default=None, help="Effective pip height for stacked layout")
    parser.add_argument("--safe-placement", type=str, default="[]",
                        help="JSON array of safe placement zones from head tracking")
    parser.add_argument("--phase", choices=["director", "animator"], default=None,
                        help="Run only a specific phase (director or animator). Default: all.")
    parser.add_argument("--skip-scenes", type=str, default=None,
                        help="Comma-separated scene numbers to skip (for retry from checkpoint)")

    args = parser.parse_args()

    heartbeat = HeartbeatEmitter(interval_sec=10)

    try:
        return await _main_inner(args, heartbeat)
    finally:
        heartbeat.stop()


async def _main_inner(args, heartbeat: HeartbeatEmitter):
    """Inner main logic, separated so heartbeat.stop() is guaranteed in finally."""

    # Load transcript
    transcript = args.transcript
    if os.path.exists(transcript):
        with open(transcript, encoding="utf-8") as f:
            transcript = f.read()

    # Load words if provided
    words = None
    if args.words_json and os.path.exists(args.words_json):
        with open(args.words_json, encoding="utf-8") as f:
            words = json.load(f)

    # Load style guide if provided
    style_guide = None
    if args.style_guide and os.path.exists(args.style_guide):
        with open(args.style_guide, encoding="utf-8") as f:
            style_guide = f.read().strip()

    # Create generator
    generator = ClaudeVisualGenerator(
        workspace=Path(args.workspace),
        project_id=args.project_id,
        bundle_output=Path(args.bundle_output),
        model=args.model,
    )

    if args.phase == "director":
        # Phase 1 only: Run Director to create scene plan
        from transcript_formatter import format_transcript_with_key_moments

        print("[ClaudeGenerator] Running Director phase only")
        emit_progress(8, "Preparing workspace...", {"phase": "plan", "phaseName": "Setting up"})

        # Ensure OAuth token is valid
        try:
            manager = get_token_manager()
            await manager.get_valid_token()
            print("[ClaudeGenerator] OAuth token validated/refreshed successfully")
        except Exception as e:
            print(f"[ClaudeGenerator] WARNING: OAuth token refresh failed: {e}")

        # Ensure src dir exists
        generator.src_dir.mkdir(parents=True, exist_ok=True)

        # Create public/assets directory for Freepik asset downloads
        assets_dir = generator.workspace / "public" / "assets"
        assets_dir.mkdir(parents=True, exist_ok=True)

        # Format transcript with timestamps if available
        if words:
            formatted_transcript = format_transcript_with_key_moments(words, args.fps)
        else:
            formatted_transcript = f"## TRANSCRIPT\n\n{transcript}"

        heartbeat.update('plan', 'Director analyzing transcript')
        emit_progress(18, "Director planning scenes...", {"phase": "plan", "phaseName": "Planning scenes"})

        import json as json_mod
        safe_placement = json_mod.loads(args.safe_placement) if hasattr(args, 'safe_placement') else []

        director_result = await generator._run_director(
            formatted_transcript=formatted_transcript,
            width=args.width,
            height=args.height,
            duration_frames=args.duration,
            fps=args.fps,
            style_preset=args.style_preset,
            layout_mode=args.layout_mode,
            style_guide=style_guide,
            source_width=args.source_width,
            source_height=args.source_height,
            pip_width=args.pip_width,
            pip_height=args.pip_height,
            safe_placement=safe_placement,
        )

        if not director_result["success"]:
            print(json.dumps(director_result, indent=2))
            sys.stdout.flush()
            sys.exit(1)

        # Phase 1.5: Fetch images for scenes
        emit_progress(36, "Fetching images for scenes...", {"phase": "workspace", "phaseName": "Setting up workspace"})
        image_count = await generator._fetch_scene_images()
        if image_count > 0:
            emit_progress(37, f"Downloaded {image_count} images", {"phase": "workspace", "phaseName": "Setting up workspace"})

        # Read plan files and output PLAN_READY signal for the worker to capture
        scenes_json_path = generator.src_dir / "scenes.json"
        scene_plan_path = generator.src_dir / "SCENE_PLAN.md"

        with open(scenes_json_path, encoding="utf-8") as f:
            scenes_data = json.load(f)
        with open(scene_plan_path, encoding="utf-8") as f:
            plan_markdown = f.read()

        plan_payload = {
            "scenePlan": plan_markdown,
            "scenes": scenes_data,
        }
        print(f"PLAN_READY:{json.dumps(plan_payload)}")
        sys.stdout.flush()

        emit_progress(35, f"Director complete: {director_result.get('sceneCount', 0)} scenes planned", {"phase": "plan", "phaseName": "Planning scenes", "totalScenes": director_result.get('sceneCount', 0)})

        result = director_result

    elif args.phase == "animator":
        # Phase 2 only: Run Animator (expects plan files already in workspace)
        print("[ClaudeGenerator] Running Animator phase only")

        # Ensure OAuth token is valid
        try:
            manager = get_token_manager()
            await manager.get_valid_token()
            print("[ClaudeGenerator] OAuth token validated/refreshed successfully")
        except Exception as e:
            print(f"[ClaudeGenerator] WARNING: OAuth token refresh failed: {e}")

        # Verify plan files exist before starting
        scenes_json_path = generator.src_dir / "scenes.json"
        scene_plan_path = generator.src_dir / "SCENE_PLAN.md"
        if not scenes_json_path.exists() or not scene_plan_path.exists():
            result = {
                "success": False,
                "error": f"Plan files not found in {generator.src_dir}. Run --phase director first.",
            }
            print(json.dumps(result, indent=2))
            sys.stdout.flush()
            sys.exit(1)

        # Resolve selected studio templates from registry
        generator._resolve_studio_templates(args.style_preset)

        heartbeat.update('animate', 'Animator implementing scenes')
        emit_progress(38, "Animator implementing scenes...", {"phase": "animate", "phaseName": "Animating scenes"})

        # Parse --skip-scenes into a set of scene numbers
        cli_skip_scenes: set[int] | None = None
        if args.skip_scenes:
            cli_skip_scenes = {int(s.strip()) for s in args.skip_scenes.split(",") if s.strip().isdigit()}
            print(f"[ClaudeGenerator] CLI --skip-scenes: {sorted(cli_skip_scenes)}")

        animator_result = await generator._run_animator_sequential(
            width=args.width, height=args.height,
            duration_frames=args.duration, fps=args.fps,
            style_preset=args.style_preset,
            skip_scenes=cli_skip_scenes,
        )

        if not animator_result["success"]:
            print(json.dumps(animator_result, indent=2))
            sys.stdout.flush()
            sys.exit(1)

        emit_progress(55, "All scenes implemented", {"phase": "animate", "phaseName": "Animating scenes"})

        # Verify TypeScript with self-healing
        heartbeat.update('verify', 'Type-checking scenes')
        emit_progress(58, "Verifying TypeScript...", {"phase": "self_heal", "phaseName": "Fixing errors"})
        print("[ClaudeGenerator] Verifying TypeScript...")
        ts_success, ts_errors = await generator._verify_typescript()

        heal_attempts = 0
        max_heal_attempts = 3
        while not ts_success and heal_attempts < max_heal_attempts:
            heal_attempts += 1
            emit_progress(58 + heal_attempts, f"Fixing TypeScript errors (attempt {heal_attempts}/{max_heal_attempts})...", {"phase": "self_heal", "phaseName": "Fixing errors", "iteration": heal_attempts, "maxIterations": max_heal_attempts})
            print(f"[ClaudeGenerator] TypeScript failed, self-healing attempt {heal_attempts}/{max_heal_attempts}...")
            heal_success = await generator._run_self_heal(ts_errors)
            if not heal_success:
                print("[ClaudeGenerator] Self-heal agent failed")
                break
            ts_success, ts_errors = await generator._verify_typescript()

        if not ts_success:
            result = {
                "success": False,
                "error": f"TypeScript validation failed after {heal_attempts} self-heal attempts",
            }
            print(json.dumps(result, indent=2))
            sys.stdout.flush()
            sys.exit(1)

        print("[ClaudeGenerator] TypeScript validation passed")

        # Check for missing interpolate clamp options
        clamp_warnings = generator._validate_interpolate_clamping()
        if clamp_warnings:
            print(f"[ClaudeGenerator] Found {len(clamp_warnings)} interpolate() calls missing clamp:")
            for w in clamp_warnings:
                print(f"  - {w}")
            clamp_error_msg = (
                "CRITICAL: The following interpolate() calls are missing extrapolateLeft: 'clamp' "
                "and/or extrapolateRight: 'clamp'. BOTH are required on EVERY interpolate() call. "
                "Without both, values extrapolate linearly beyond the range, causing catastrophic "
                "visual bugs (e.g. scale: 13x, opacity: 85).\n\n"
                + "\n".join(clamp_warnings)
                + "\n\nFix ALL of them by adding the missing clamp option(s)."
            )
            await generator._run_self_heal(clamp_error_msg)
            ts_success, ts_errors = await generator._verify_typescript()
            if not ts_success:
                print(f"[ClaudeGenerator] TypeScript broke after clamp fix, self-healing...")
                await generator._run_self_heal(ts_errors)

        emit_progress(62, "TypeScript validation passed", {"phase": "bundle", "phaseName": "Bundling for preview"})

        # Create metadata.json if not exists
        metadata_json = generator.src_dir / "metadata.json"
        if not metadata_json.exists():
            print("[ClaudeGenerator] Creating fallback metadata.json...")
            composition_id = args.project_id.replace("_", "-")
            fallback_metadata = {
                "compositionId": composition_id,
                "durationInFrames": args.duration,
                "fps": args.fps,
                "width": args.width,
                "height": args.height,
                "visuals": [
                    {"startMs": 0, "endMs": int(args.duration / args.fps * 1000), "type": "generated", "description": "AI-generated visual"}
                ]
            }
            with open(metadata_json, "w", encoding="utf-8") as f:
                json.dump(fallback_metadata, f, indent=2)

        # Validate metadata dimensions
        generator._validate_metadata(args.width, args.height)

        # Fix composition ID
        index_tsx = generator.src_dir / "index.tsx"
        composition_id_with_dashes = args.project_id.replace("_", "-")
        await generator._fix_composition_id(index_tsx, composition_id_with_dashes)

        # Bundle
        heartbeat.update('bundle', 'Remotion bundling')
        emit_progress(65, "Bundling Remotion project...", {"phase": "bundle", "phaseName": "Bundling for preview"})
        print("[ClaudeGenerator] Bundling project...")
        bundle_path = await generator._run_bundle(
            width=args.width, height=args.height, fps=args.fps,
            duration_frames=args.duration,
        )
        print(f"[ClaudeGenerator] Bundle complete: {bundle_path}")
        emit_progress(68, "Bundle complete", {"phase": "bundle", "phaseName": "Bundling for preview"})

        # Compile CJS
        emit_progress(69, "Compiling CJS module...", {"phase": "bundle", "phaseName": "Bundling for preview"})
        print("[ClaudeGenerator] Compiling CJS...")
        await generator._compile_cjs(bundle_path)

        heartbeat.update('upload', 'Finalizing')
        bundle_id = args.project_id.replace("_", "-")
        result = {
            "success": True,
            "bundleUrl": f"/bundles/{bundle_id}/index.html",
            "bundlePath": str(bundle_path),
            "pipeline": "two-phase-animator",
        }

    else:
        # Default: both phases via generate_two_phase (existing behavior)
        print("[ClaudeGenerator] Using two-phase pipeline (Director + Animator)")
        emit_progress(8, "Preparing workspace...", {"phase": "plan", "phaseName": "Setting up"})
        import json as json_mod
        safe_placement_full = json_mod.loads(args.safe_placement) if hasattr(args, 'safe_placement') else []

        result = await generator.generate_two_phase(
            transcript=transcript,
            words=words,
            width=args.width,
            height=args.height,
            duration_frames=args.duration,
            fps=args.fps,
            style_preset=args.style_preset,
            layout_mode=args.layout_mode,
            style_guide=style_guide,
            source_width=args.source_width,
            source_height=args.source_height,
            safe_placement=safe_placement_full,
        )

    print(json.dumps(result, indent=2))
    sys.stdout.flush()


if __name__ == "__main__":
    try:
        # On Windows, suppress harmless "Event loop is closed" errors during cleanup
        if sys.platform == "win32":
            _original_del = asyncio.proactor_events._ProactorBasePipeTransport.__del__  # type: ignore[attr-defined]
            def _silent_del(self, _warn=None):
                try:
                    _original_del(self, _warn=_warn)
                except (RuntimeError, ValueError, OSError):
                    pass
            asyncio.proactor_events._ProactorBasePipeTransport.__del__ = _silent_del  # type: ignore[attr-defined]

        asyncio.run(main())
    except Exception as e:
        import traceback
        print(f"FATAL ERROR: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        # Also print to stdout for worker to capture
        print(json.dumps({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }))
        sys.stdout.flush()
        sys.exit(1)
