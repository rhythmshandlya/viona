"""Two-phase pipeline mixin — orchestrates Director + Animator end-to-end."""

import asyncio
import json
from pathlib import Path
from typing import Any

from sdk_config import emit_progress
from oauth import get_token_manager


class PipelineMixin:
    """Mixin providing generate_two_phase for ClaudeVisualGenerator."""

    async def generate_two_phase(
        self,
        transcript: str,
        words: list[dict] | None = None,
        width: int = 1920,
        height: int = 1080,
        duration_frames: int = 1800,
        fps: int = 30,
        timeout_seconds: int = 2400,
        max_retries: int = 2,
        style_preset: str = "studio-dark",
        layout_mode: str = "pip",
        style_guide: str | None = None,
        source_width: int | None = None,
        source_height: int | None = None,
        safe_placement: list[str] | None = None,
    ) -> dict[str, Any]:
        """Generate video using two-phase pipeline: Director + Animator.

        Phase 1 (Director): Analyzes transcript, creates scene plan
        Phase 2 (Animator): Implements plan scene-by-scene with TODO tracking
        """
        try:
            return await asyncio.wait_for(
                self._generate_two_phase_inner(
                    transcript=transcript,
                    words=words,
                    width=width,
                    height=height,
                    duration_frames=duration_frames,
                    fps=fps,
                    max_retries=max_retries,
                    style_preset=style_preset,
                    layout_mode=layout_mode,
                    style_guide=style_guide,
                    source_width=source_width,
                    source_height=source_height,
                    safe_placement=safe_placement,
                ),
                timeout=timeout_seconds,
            )
        except asyncio.TimeoutError:
            raise RuntimeError(
                f"Pipeline timed out after {timeout_seconds}s ({timeout_seconds // 60} minutes). "
                f"Check for hung SDK clients or MCP server deadlocks."
            )

    async def _generate_two_phase_inner(
        self,
        transcript: str,
        words: list[dict] | None,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
        max_retries: int,
        style_preset: str,
        layout_mode: str,
        style_guide: str | None,
        source_width: int | None,
        source_height: int | None,
        safe_placement: list[str] | None,
    ) -> dict[str, Any]:
        """Inner implementation of generate_two_phase (without timeout wrapper)."""
        from transcript_formatter import format_transcript_with_key_moments

        # Ensure OAuth token is valid
        try:
            manager = get_token_manager()
            await manager.get_valid_token()
            print("[ClaudeGenerator] OAuth token validated/refreshed successfully")
        except Exception as e:
            print(f"[ClaudeGenerator] WARNING: OAuth token refresh failed: {e}")

        last_error: Exception | None = None
        director_result: dict = {}

        for attempt in range(max_retries + 1):
            try:
                print(f"[ClaudeGenerator] Two-phase attempt {attempt + 1}/{max_retries + 1}")
                emit_progress(15, "Starting visual generation...", {"phase": "plan", "phaseName": "Planning scenes"})

                if attempt > 0:
                    base_delay = 10 * (2 ** (attempt - 1))
                    print(f"[ClaudeGenerator] Waiting {base_delay}s before retry...")
                    await asyncio.sleep(base_delay)

                # Check for resumable state from previous attempt
                index_tsx_path = self.src_dir / "index.tsx"
                metadata_path = self.src_dir / "metadata.json"
                scenes_path = self.src_dir / "scenes.json"
                can_resume = (
                    attempt == 0
                    and index_tsx_path.exists()
                    and metadata_path.exists()
                    and scenes_path.exists()
                )

                if can_resume:
                    print(f"[ClaudeGenerator] Found existing sources from previous attempt — skipping to TS verify + bundle")
                    emit_progress(55, "Resuming from previous attempt — skipping to verification...", {"phase": "self_heal", "phaseName": "Fixing errors"})
                    try:
                        with open(scenes_path, "r", encoding="utf-8") as f:
                            existing_scenes = json.load(f)
                        scene_count = len(existing_scenes.get("scenes", []))
                        print(f"[ClaudeGenerator] Resuming with {scene_count} existing scenes")
                    except Exception:
                        scene_count = 0

                    animator_result = {"success": True}
                else:
                    if not self.src_dir.exists():
                        self.src_dir.mkdir(parents=True)

                    assets_dir = self.workspace / "public" / "assets"
                    assets_dir.mkdir(parents=True, exist_ok=True)

                    if words:
                        formatted_transcript = format_transcript_with_key_moments(words, fps)
                    else:
                        formatted_transcript = f"## TRANSCRIPT\n\n{transcript}"

                    emit_progress(19, "Director planning scenes...", {"phase": "plan", "phaseName": "Planning scenes"})

                    # Phase 1: Director
                    director_result = await self._run_director(
                        formatted_transcript=formatted_transcript,
                        width=width,
                        height=height,
                        duration_frames=duration_frames,
                        fps=fps,
                        style_preset=style_preset,
                        layout_mode=layout_mode,
                        style_guide=style_guide,
                        source_width=source_width,
                        source_height=source_height,
                        safe_placement=safe_placement,
                    )

                    if not director_result["success"]:
                        raise RuntimeError(f"Director failed: {director_result.get('error', 'Unknown error')}")

                    scene_count = director_result['sceneCount']
                    print(f"[ClaudeGenerator] Director created {scene_count} scenes")
                    emit_progress(35, f"Director complete: {scene_count} scenes planned", {"phase": "plan", "phaseName": "Planning scenes", "totalScenes": scene_count})

                    # Phase 1.5: Fetch images
                    emit_progress(36, "Fetching images for scenes...", {"phase": "workspace", "phaseName": "Setting up workspace"})
                    image_count = await self._fetch_scene_images()
                    if image_count > 0:
                        emit_progress(37, f"Downloaded {image_count} images", {"phase": "workspace", "phaseName": "Setting up workspace"})

                    self._resolve_studio_templates(style_preset)

                    emit_progress(38, f"Animator implementing {scene_count} scenes...", {"phase": "animate", "phaseName": "Animating scenes", "totalScenes": scene_count})

                    # Phase 2: Animator
                    animator_result = await self._run_animator_sequential(
                        width=width, height=height,
                        duration_frames=duration_frames, fps=fps,
                        style_preset=style_preset,
                    )

                if not animator_result["success"]:
                    raise RuntimeError(f"Animator failed: {animator_result.get('error', 'Unknown error')}")

                emit_progress(55, "All scenes implemented", {"phase": "animate", "phaseName": "Animating scenes"})
                emit_progress(58, "Verifying TypeScript...", {"phase": "self_heal", "phaseName": "Fixing errors"})

                # Verify TypeScript with self-healing
                print(f"[ClaudeGenerator] Verifying TypeScript...")
                ts_success, ts_errors = await self._verify_typescript()

                heal_attempts = 0
                max_heal_attempts = 3
                while not ts_success and heal_attempts < max_heal_attempts:
                    heal_attempts += 1
                    emit_progress(58 + heal_attempts, f"Fixing TypeScript errors (attempt {heal_attempts}/{max_heal_attempts})...", {"phase": "self_heal", "phaseName": "Fixing errors", "iteration": heal_attempts, "maxIterations": max_heal_attempts})
                    print(f"[ClaudeGenerator] TypeScript failed, self-healing attempt {heal_attempts}/{max_heal_attempts}...")

                    heal_success = await self._run_self_heal(ts_errors)
                    if not heal_success:
                        print(f"[ClaudeGenerator] Self-heal agent failed")
                        break

                    ts_success, ts_errors = await self._verify_typescript()

                if not ts_success:
                    raise RuntimeError(f"TypeScript validation failed after {heal_attempts} self-heal attempts")

                print(f"[ClaudeGenerator] TypeScript validation passed")

                # Check for interpolate() issues: missing clamp options + non-monotonic inputRange
                clamp_warnings = self._validate_interpolate_clamping()
                if clamp_warnings:
                    print(f"[ClaudeGenerator] Found {len(clamp_warnings)} interpolate() issues:")
                    for w in clamp_warnings:
                        print(f"  - {w}")
                    clamp_error_msg = (
                        "CRITICAL interpolate() issues found:\n\n"
                        + "\n".join(clamp_warnings)
                        + "\n\nRules:\n"
                        "1. EVERY interpolate() call MUST have BOTH extrapolateLeft: 'clamp' AND extrapolateRight: 'clamp'.\n"
                        "2. inputRange MUST be strictly monotonically increasing (each value > previous). "
                        "e.g. [0, 1, 0.4] CRASHES — use [0, 15, 30] with actual frame numbers instead.\n\n"
                        "Fix ALL issues above."
                    )
                    await self._run_self_heal(clamp_error_msg)
                    ts_success, ts_errors = await self._verify_typescript()
                    if not ts_success:
                        print(f"[ClaudeGenerator] TypeScript broke after clamp fix, self-healing...")
                        await self._run_self_heal(ts_errors)

                emit_progress(62, "TypeScript validation passed", {"phase": "bundle", "phaseName": "Bundling for preview"})

                # Create metadata.json if not exists
                metadata_json = self.src_dir / "metadata.json"
                if not metadata_json.exists():
                    print("[ClaudeGenerator] Creating fallback metadata.json...")
                    composition_id = self.project_id.replace("_", "-")
                    fallback_metadata = {
                        "compositionId": composition_id,
                        "durationInFrames": duration_frames,
                        "fps": fps,
                        "width": width,
                        "height": height,
                        "visuals": [
                            {"startMs": 0, "endMs": int(duration_frames / fps * 1000), "type": "generated", "description": "AI-generated visual"}
                        ]
                    }
                    with open(metadata_json, "w", encoding="utf-8") as f:
                        json.dump(fallback_metadata, f, indent=2)

                self._validate_metadata(width, height)

                # Fix composition ID
                index_tsx = self.src_dir / "index.tsx"
                composition_id_with_dashes = self.project_id.replace("_", "-")
                await self._fix_composition_id(index_tsx, composition_id_with_dashes)

                # ── Phase 2e: VISUAL VERIFICATION ──
                emit_progress(63, "Visual verification...", {"phase": "verify", "phaseName": "Verifying scenes"})
                try:
                    with open(self.src_dir / "scenes.json", "r", encoding="utf-8") as f:
                        verify_scenes_data = json.load(f)
                    verify_plan_content = (self.src_dir / "SCENE_PLAN.md").read_text(encoding="utf-8")
                    await self._run_visual_verification_phase(
                        composition_id=composition_id_with_dashes,
                        scenes_data=verify_scenes_data,
                        plan_content=verify_plan_content,
                        style_preset=style_preset,
                        width=width, height=height, fps=fps,
                        duration_frames=duration_frames,
                    )
                    emit_progress(64, "Visual verification complete", {"phase": "verify", "phaseName": "Verifying scenes"})
                except Exception as e:
                    print(f"[ClaudeGenerator] Phase 2e failed (non-blocking): {e}")
                    emit_progress(64, "Visual verification skipped (error)", {"phase": "verify", "phaseName": "Verifying scenes"})

                # Bundle
                emit_progress(65, "Bundling Remotion project...", {"phase": "bundle", "phaseName": "Bundling for preview"})
                print(f"[ClaudeGenerator] Bundling project...")
                bundle_path = await self._run_bundle(
                    width=width, height=height, fps=fps,
                    duration_frames=duration_frames,
                )
                print(f"[ClaudeGenerator] Bundle complete: {bundle_path}")
                emit_progress(68, "Bundle complete", {"phase": "bundle", "phaseName": "Bundling for preview"})

                # Compile CJS
                emit_progress(69, "Compiling CJS module...", {"phase": "bundle", "phaseName": "Bundling for preview"})
                print(f"[ClaudeGenerator] Compiling CJS...")
                await self._compile_cjs(bundle_path)

                bundle_id = self.project_id.replace("_", "-")
                return {
                    "success": True,
                    "bundleUrl": f"/bundles/{bundle_id}/index.html",
                    "bundlePath": str(bundle_path),
                    "attempts": attempt + 1,
                    "pipeline": "two-phase",
                    "scenePlan": director_result.get("scenePlanPath"),
                    "implementationLog": str(self.src_dir / "IMPLEMENTATION_LOG.md"),
                }

            except Exception as e:
                last_error = e
                print(f"[ClaudeGenerator] Two-phase attempt {attempt + 1} failed: {e}")
                continue

        raise RuntimeError(f"Two-phase generation failed after {max_retries + 1} attempts: {last_error}")
