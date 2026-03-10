#!/usr/bin/env python3
"""
Claude Visual Generator — orchestrates the visual generation pipeline.

Phases:
  0. Assistant Director → CREATIVE_BRIEF.md
  1. Director → SCENE_PLAN.md + scenes.json
  2. Animator (sequential) → Scene*.tsx files
  2e. Visual verification → screenshot review + fixes
  3. Bundle → Remotion bundle + CJS compilation
"""

import asyncio
import json
import math
import os
import platform
import re
import shutil
import sys
import threading
import time
from pathlib import Path
from typing import Any

# Add agents directory to path for local imports
_agents_dir = Path(__file__).parent
if str(_agents_dir) not in sys.path:
    sys.path.insert(0, str(_agents_dir))

# Add src directory to path so `prompts` package resolves to src/prompts/
_src_dir = str(Path(__file__).parent.parent)
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

# Infrastructure imports (OAuth, SDK config, MCP, security)
from prompts.theme_loader import get_theme
from oauth import get_token_manager
from sdk_config import (
    IS_WINDOWS,
    CLAUDE_CLI_PATH,
    safe_print,
    emit_progress,
    build_mcp_servers,
    bash_security_hook,
    get_skills_directive,
    create_security_settings,
    ClaudeSDKClient,
    ClaudeAgentOptions,
    HookMatcher,
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


class ClaudeVisualGenerator:
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
        """
        Initialize the visual generator.

        Args:
            workspace: Path to the Remotion workspace (with node_modules)
            project_id: Unique project identifier
            bundle_output: Path to output bundled video
            model: Claude model to use
            max_thinking_tokens: Token budget for extended thinking
            max_turns: Maximum agent turns
        """
        self.workspace = workspace
        self.project_id = project_id
        self.src_dir = workspace / "src" / project_id
        self.bundle_output = bundle_output
        self.model = model
        self.max_thinking_tokens = max_thinking_tokens
        self.max_turns = max_turns

        # SDK automatically uses Claude Code CLI authentication
        # No manual configuration needed

    def _write_security_settings(self) -> Path:
        """Write security settings to a temporary file."""
        settings = create_security_settings(str(self.workspace))
        settings_path = self.workspace / ".claude" / "settings.local.json"
        settings_path.parent.mkdir(parents=True, exist_ok=True)

        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)

        return settings_path

    async def _fetch_scene_images(self) -> int:
        """
        Fetch images for scenes based on the Director's [IMAGE: keyword] entries.

        Reads scenes.json, downloads photos from Pexels and illustrations from Freepik,
        saves them to public/assets/images/, and updates scenes.json in-place.

        Returns the count of successfully downloaded images.
        """
        import httpx
        import re
        import zipfile
        import io

        scenes_json_path = self.src_dir / "scenes.json"
        if not scenes_json_path.exists():
            print("[ClaudeGenerator] No scenes.json found — skipping image fetch")
            return 0

        with open(scenes_json_path, encoding="utf-8") as f:
            scenes_data = json.load(f)

        scenes = scenes_data.get("scenes", [])
        if not scenes:
            return 0

        # Collect all image requests
        image_tasks = []
        for si, scene in enumerate(scenes):
            images = scene.get("images", [])
            if not isinstance(images, list):
                continue
            for ii, img in enumerate(images[:2]):  # Max 2 per scene
                if len(image_tasks) >= 10:  # Max 10 total
                    break
                keyword = img.get("keyword", "")
                img_type = img.get("type", "photo")
                purpose = img.get("purpose", "accent")
                if keyword:
                    image_tasks.append({
                        "scene_index": si,
                        "image_index": ii,
                        "keyword": keyword,
                        "type": img_type,
                        "purpose": purpose,
                    })
            if len(image_tasks) >= 10:
                break

        if not image_tasks:
            print("[ClaudeGenerator] No image requests in scenes — skipping")
            return 0

        print(f"[ClaudeGenerator] Fetching {len(image_tasks)} images for scenes...")

        # Create images directory
        images_dir = self.workspace / "public" / "assets" / "images"
        images_dir.mkdir(parents=True, exist_ok=True)

        pexels_api_key = os.environ.get("PEXELS_API_KEY", "")
        freepik_api_key = os.environ.get("FREEPIK_API_KEY", "")

        downloaded = 0

        async with httpx.AsyncClient(timeout=30.0) as client:
            for task in image_tasks:
                try:
                    scene_id = scenes[task["scene_index"]].get("id", task["scene_index"] + 1)
                    slug = re.sub(r'[^a-z0-9]+', '-', task["keyword"].lower()).strip('-')[:30]
                    filename = f"scene{scene_id}-{task['purpose']}-{slug}.jpg"
                    dest_path = images_dir / filename

                    if task["type"] == "photo" and pexels_api_key:
                        # Search Pexels
                        resp = await client.get(
                            "https://api.pexels.com/v1/search",
                            params={"query": task["keyword"], "per_page": "3"},
                            headers={"Authorization": pexels_api_key},
                        )
                        if resp.status_code != 200:
                            continue
                        data = resp.json()
                        photos = data.get("photos", [])
                        if not photos:
                            continue

                        photo = photos[0]
                        photo_url = photo.get("src", {}).get("large", "")
                        if not photo_url:
                            continue

                        # Download
                        dl_resp = await client.get(photo_url)
                        if dl_resp.status_code != 200:
                            continue
                        dest_path.write_bytes(dl_resp.content)

                        # Update scene data
                        img_entry = scenes[task["scene_index"]]["images"][task["image_index"]]
                        img_entry["localPath"] = str(dest_path)
                        img_entry["remotionPath"] = f"assets/images/{filename}"
                        img_entry["source"] = "pexels"
                        img_entry["attribution"] = f"Photo by {photo.get('photographer', 'Unknown')} on Pexels"
                        img_entry["width"] = photo.get("width")
                        img_entry["height"] = photo.get("height")
                        downloaded += 1
                        print(f"[ClaudeGenerator] Downloaded photo: {filename}")

                    elif task["type"] == "illustration" and freepik_api_key:
                        # Search Freepik resources
                        resp = await client.get(
                            "https://api.freepik.com/v1/resources",
                            params={
                                "term": task["keyword"],
                                "limit": "3",
                                "filters[content_type][vector]": "1",
                            },
                            headers={
                                "x-freepik-api-key": freepik_api_key,
                                "Accept": "application/json",
                            },
                        )
                        if resp.status_code != 200:
                            continue
                        data = resp.json()
                        resources = data.get("data", [])
                        if not resources:
                            continue

                        resource = resources[0]
                        resource_id = str(resource.get("id", ""))
                        if not resource_id:
                            continue

                        # Get download URL
                        dl_info_resp = await client.get(
                            f"https://api.freepik.com/v1/resources/{resource_id}/download",
                            headers={
                                "x-freepik-api-key": freepik_api_key,
                                "Accept": "application/json",
                            },
                        )
                        if dl_info_resp.status_code != 200:
                            continue
                        dl_info = dl_info_resp.json()
                        dl_url = dl_info.get("data", {}).get("url", "")
                        if not dl_url:
                            continue

                        # Download
                        dl_resp = await client.get(dl_url)
                        if dl_resp.status_code != 200:
                            continue

                        raw_bytes = dl_resp.content

                        # Freepik returns ZIP archives containing image + vector sources.
                        # Extract the largest raster image from the ZIP.
                        if len(raw_bytes) >= 4 and raw_bytes[:4] == b'PK\x03\x04':
                            image_exts = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
                            try:
                                with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
                                    image_entries = [
                                        info for info in zf.infolist()
                                        if not info.is_dir()
                                        and os.path.splitext(info.filename)[1].lower() in image_exts
                                        and info.file_size > 0
                                    ]
                                    # Pick the largest image file
                                    image_entries.sort(key=lambda e: e.file_size, reverse=True)
                                    if image_entries:
                                        extracted = zf.read(image_entries[0].filename)
                                        print(f"[ClaudeGenerator] Extracted {image_entries[0].filename} ({len(extracted)} bytes) from Freepik ZIP")
                                        raw_bytes = extracted
                                    else:
                                        print(f"[ClaudeGenerator] Freepik ZIP has no raster images, skipping: {[i.filename for i in zf.infolist()]}")
                                        continue
                            except zipfile.BadZipFile:
                                print(f"[ClaudeGenerator] Bad ZIP from Freepik, saving raw download")

                        dest_path.write_bytes(raw_bytes)

                        # Update scene data
                        img_entry = scenes[task["scene_index"]]["images"][task["image_index"]]
                        img_entry["localPath"] = str(dest_path)
                        img_entry["remotionPath"] = f"assets/images/{filename}"
                        img_entry["source"] = "freepik"
                        img_entry["attribution"] = "Illustration from Freepik"
                        downloaded += 1
                        print(f"[ClaudeGenerator] Downloaded illustration: {filename}")

                except Exception as e:
                    print(f"[ClaudeGenerator] Image fetch failed for '{task['keyword']}': {e}")
                    continue

        # Remove image entries that weren't successfully fetched
        for scene in scenes:
            if "images" in scene and isinstance(scene["images"], list):
                scene["images"] = [
                    img for img in scene["images"]
                    if isinstance(img, dict) and img.get("remotionPath")
                ]

        # Write updated scenes.json
        with open(scenes_json_path, "w", encoding="utf-8") as f:
            json.dump(scenes_data, f, indent=2)

        print(f"[ClaudeGenerator] Image fetch complete: {downloaded}/{len(image_tasks)} downloaded")
        return downloaded

    async def _verify_typescript(self) -> tuple[bool, str]:
        """Run TypeScript validation on the generated code.

        Returns:
            Tuple of (success, error_output)
        """
        import subprocess

        try:
            result = subprocess.run(
                ["npx", "tsc", "--noEmit"],
                cwd=str(self.workspace),
                capture_output=True,
                timeout=60,
                shell=IS_WINDOWS,
                encoding="utf-8",
                errors="replace",
            )
            if result.returncode == 0:
                return True, ""
            else:
                errors = result.stdout + result.stderr
                print(f"[ClaudeGenerator] TypeScript errors:\n{errors[:2000]}")
                return False, errors
        except subprocess.TimeoutExpired:
            return False, "TypeScript check timed out"
        except Exception as e:
            return False, str(e)

    def _validate_scene_plan(
        self,
        plan_data: dict,
        fps: int,
        total_frames: int,
        canvas_width: int = 1080,
        canvas_height: int = 1920,
        layout_mode: str = "pip",
        pip_width: int | None = None,
        pip_height: int | None = None,
    ) -> dict:
        """Validate scenes.json constraints and auto-repair violations.

        Checks:
        1. Scene duration: min 210 frames (7s), max 450 frames (15s)
        2. Scene contiguity: no gaps between scenes
        3. Sync point gaps: max 150 frames (5s) between consecutive sync points
        4. Total coverage: scenes span from 0 to total_frames

        Returns dict with:
            valid: bool - True if all constraints pass (after repairs)
            warnings: list[str] - non-fatal issues
            errors: list[str] - fatal issues that couldn't be auto-repaired
            repaired: bool - True if scenes were modified
        """
        MAX_FRAMES = 450   # 15 seconds
        MAX_SYNC_GAP = 150 # 5 seconds

        # Short video exception: relax minimum duration for videos ≤ 20s
        if total_frames <= 600:  # 20 seconds or less at 30fps
            MIN_FRAMES = 120   # 4 seconds
        else:
            MIN_FRAMES = 210   # 7 seconds

        scenes = plan_data.get("scenes", [])
        warnings = []
        errors = []
        repaired = False

        # Allow single scene for very short videos (< 10s)
        min_scenes = 1 if total_frames < 300 else 2
        if len(scenes) < min_scenes:
            errors.append(f"Need at least {min_scenes} scene(s) for storytelling structure")
            return {"valid": False, "warnings": warnings, "errors": errors, "repaired": False}

        # ── 1. Fix contiguity ──
        # Sort by start frame, then fix gaps/overlaps
        for scene in scenes:
            frames = scene.get("frames", [0, 0])
            if isinstance(frames, list) and len(frames) == 2:
                scene["_start"] = frames[0]
                scene["_end"] = frames[1]
            else:
                errors.append(f"Scene {scene.get('id', '?')}: invalid frames format {frames}")
                return {"valid": False, "warnings": warnings, "errors": errors, "repaired": False}

        scenes.sort(key=lambda s: s["_start"])

        for i in range(1, len(scenes)):
            prev_end = scenes[i - 1]["_end"]
            curr_start = scenes[i]["_start"]
            gap = curr_start - prev_end

            if gap > 0:
                warnings.append(
                    f"Scene {scenes[i-1]['id']}→{scenes[i]['id']}: {gap} frame gap "
                    f"({gap/fps:.1f}s). Auto-fixed by extending scene {scenes[i-1]['id']}."
                )
                # Extend previous scene to close the gap
                scenes[i - 1]["_end"] = curr_start
                scenes[i - 1]["frames"] = [scenes[i - 1]["_start"], curr_start]
                repaired = True
            elif gap < 0:
                overlap = -gap
                warnings.append(
                    f"Scene {scenes[i-1]['id']}→{scenes[i]['id']}: {overlap} frame overlap. "
                    f"Auto-fixed by trimming scene {scenes[i-1]['id']}."
                )
                scenes[i - 1]["_end"] = curr_start
                scenes[i - 1]["frames"] = [scenes[i - 1]["_start"], curr_start]
                repaired = True

        # ── 2. Fix total coverage ──
        if scenes[0]["_start"] != 0:
            warnings.append(
                f"Scene 1 starts at frame {scenes[0]['_start']}, not 0. Auto-fixed."
            )
            scenes[0]["_start"] = 0
            scenes[0]["frames"] = [0, scenes[0]["_end"]]
            repaired = True

        if scenes[-1]["_end"] != total_frames:
            diff = abs(scenes[-1]["_end"] - total_frames)
            if diff <= 30:  # Within 1 second — just adjust
                warnings.append(
                    f"Last scene ends at {scenes[-1]['_end']}, not {total_frames} "
                    f"(off by {diff} frames). Auto-fixed."
                )
                scenes[-1]["_end"] = total_frames
                scenes[-1]["frames"] = [scenes[-1]["_start"], total_frames]
                repaired = True
            else:
                warnings.append(
                    f"Last scene ends at {scenes[-1]['_end']}, total video is {total_frames} "
                    f"frames (off by {diff} frames). This may need manual review."
                )

        # ── 3. Check durations and auto-split long scenes ──
        # Loop until no scene exceeds MAX_FRAMES (splits may produce halves still too long)
        max_split_passes = 5  # Safety limit
        for split_pass in range(max_split_passes):
            split_needed = []
            for i, scene in enumerate(scenes):
                duration = scene["_end"] - scene["_start"]
                if duration > MAX_FRAMES:
                    split_needed.append(i)

            if not split_needed:
                break

            new_scenes = []
            next_id = max(s["id"] for s in scenes) + 1

            for i, scene in enumerate(scenes):
                if i not in split_needed:
                    new_scenes.append(scene)
                    continue

                duration = scene["_end"] - scene["_start"]
                warnings.append(
                    f"Scene {scene['id']}: {duration} frames ({duration/fps:.1f}s) — "
                    f"exceeds {MAX_FRAMES} frames ({MAX_FRAMES/fps:.0f}s). Auto-splitting."
                )

                # Find the best split point: largest gap between sync points
                sync_points = sorted(
                    scene.get("syncPoints", []),
                    key=lambda sp: sp.get("frame", 0)
                )

                best_split = scene["_start"] + duration // 2  # Default: midpoint

                if len(sync_points) >= 2:
                    max_gap = 0
                    for j in range(1, len(sync_points)):
                        gap = sync_points[j]["frame"] - sync_points[j - 1]["frame"]
                        if gap > max_gap:
                            max_gap = gap
                            best_split = (sync_points[j - 1]["frame"] + sync_points[j]["frame"]) // 2

                # Ensure both halves meet minimum duration
                first_half = best_split - scene["_start"]
                second_half = scene["_end"] - best_split

                if first_half < MIN_FRAMES:
                    best_split = scene["_start"] + MIN_FRAMES
                elif second_half < MIN_FRAMES:
                    best_split = scene["_end"] - MIN_FRAMES

                # Create two scenes from the split
                first_syncs = [sp for sp in sync_points if sp["frame"] < best_split]
                second_syncs = [sp for sp in sync_points if sp["frame"] >= best_split]

                scene_a = {**scene}
                scene_a["frames"] = [scene["_start"], best_split]
                scene_a["_start"] = scene["_start"]
                scene_a["_end"] = best_split
                scene_a["syncPoints"] = first_syncs
                scene_a["name"] = scene.get("name", f"Scene {scene['id']}") + " (Part 1)"
                if first_syncs:
                    scene_a["keySync"] = first_syncs[len(first_syncs) // 2]

                scene_b = {**scene}
                scene_b["id"] = next_id
                next_id += 1
                scene_b["frames"] = [best_split, scene["_end"]]
                scene_b["_start"] = best_split
                scene_b["_end"] = scene["_end"]
                scene_b["syncPoints"] = second_syncs
                scene_b["name"] = scene.get("name", f"Scene {scene['id']}") + " (Part 2)"
                if second_syncs:
                    scene_b["keySync"] = second_syncs[len(second_syncs) // 2]

                new_scenes.append(scene_a)
                new_scenes.append(scene_b)
                repaired = True

            scenes = new_scenes

        # Report short scenes (after all splits are done)
        for scene in scenes:
            duration = scene["_end"] - scene["_start"]
            if duration < MIN_FRAMES:
                warnings.append(
                    f"Scene {scene['id']}: {duration} frames ({duration/fps:.1f}s) — "
                    f"below minimum {MIN_FRAMES} frames ({MIN_FRAMES/fps:.0f}s). "
                    f"Consider merging with adjacent scene."
                )

        # ── 4. Check sync point gaps within each scene ──
        for scene in scenes:
            sync_points = sorted(
                scene.get("syncPoints", []),
                key=lambda sp: sp.get("frame", 0)
            )

            if len(sync_points) < 2:
                duration = scene["_end"] - scene["_start"]
                if duration > MAX_SYNC_GAP:
                    warnings.append(
                        f"Scene {scene['id']}: only {len(sync_points)} sync point(s) "
                        f"across {duration} frames ({duration/fps:.1f}s). "
                        f"Add more sync points for visual variety."
                    )
                continue

            # Check gaps between consecutive sync points
            for j in range(1, len(sync_points)):
                gap = sync_points[j]["frame"] - sync_points[j - 1]["frame"]
                if gap > MAX_SYNC_GAP:
                    warnings.append(
                        f"Scene {scene['id']}: {gap} frame gap ({gap/fps:.1f}s) "
                        f"between sync '{sync_points[j-1].get('word', '?')}' "
                        f"and '{sync_points[j].get('word', '?')}'. "
                        f"Consider splitting this scene or adding intermediate sync points."
                    )

            # Also check gap from scene start to first sync, and last sync to scene end
            first_gap = sync_points[0]["frame"] - scene["_start"]
            if first_gap > MAX_SYNC_GAP:
                warnings.append(
                    f"Scene {scene['id']}: {first_gap} frames ({first_gap/fps:.1f}s) "
                    f"before first sync point. Scene start may feel empty."
                )

            last_gap = scene["_end"] - sync_points[-1]["frame"]
            if last_gap > MAX_SYNC_GAP:
                warnings.append(
                    f"Scene {scene['id']}: {last_gap} frames ({last_gap/fps:.1f}s) "
                    f"after last sync point. Scene end may feel stale."
                )

        # ── Check: Last scene must have substantive content ──
        last_scene = scenes[-1]
        visual_desc = (last_scene.get("visual") or "").lower()
        empty_outro_keywords = ["ambient", "particles fade", "subtle background", "fade to black", "gentle fade", "minimal visual"]
        if any(kw in visual_desc for kw in empty_outro_keywords) and len(visual_desc) < 120:
            warnings.append(
                f"Last scene '{last_scene.get('name', '?')}' may lack substantive content. "
                f"Outro scenes need Layer 1 content (summary stat, takeaway, callback), "
                f"not just ambient effects."
            )

        # ── Check: Adjacent scene archetype variety ──
        for i in range(1, len(scenes)):
            prev_arch = scenes[i - 1].get("archetype", "")
            curr_arch = scenes[i].get("archetype", "")
            if prev_arch and curr_arch and prev_arch == curr_arch:
                warnings.append(
                    f"Scenes {scenes[i-1]['id']} and {scenes[i]['id']} share archetype "
                    f"'{curr_arch}'. Adjacent scenes should use different archetypes for variety."
                )

        # ── Enforce effectiveDimensions per scene ──
        # displayModes: "default" (pip area), "fullscreen" / "overlay" (full canvas)
        eff_pip_w = pip_width or canvas_width
        eff_pip_h = pip_height or canvas_height

        for scene in scenes:
            dm = scene.get("displayMode", "default")
            if dm in ("fullscreen", "overlay"):
                correct = {"width": canvas_width, "height": canvas_height}
            else:
                correct = {"width": eff_pip_w, "height": eff_pip_h}
            existing = scene.get("effectiveDimensions")
            if existing != correct:
                if existing:
                    warnings.append(
                        f"Scene {scene.get('id', '?')}: fixed effectiveDimensions "
                        f"{existing} → {correct}"
                    )
                scene["effectiveDimensions"] = correct
                repaired = True

        # ── Clean up internal fields and write back ──
        for scene in scenes:
            scene.pop("_start", None)
            scene.pop("_end", None)

        if repaired:
            plan_data["scenes"] = scenes

        valid = len(errors) == 0
        return {
            "valid": valid,
            "warnings": warnings,
            "errors": errors,
            "repaired": repaired,
        }

    def _resolve_studio_templates(self, style_preset: str) -> None:
        """Resolve selected studio templates from registry after Director phase.

        Reads scenes.json to find which templates were selected, then calls
        the Node resolver script to copy only those templates into the workspace
        and generate a markdown summary of their source code.

        Sets self._resolved_templates_md with the markdown content.
        """
        self._resolved_templates_md = ""
        if not get_theme(style_preset):
            return

        scenes_path = self.src_dir / "scenes.json"
        if not scenes_path.exists():
            return

        try:
            resolve_script = Path(__file__).parent.parent / "processors" / "generate-visuals" / "resolve-templates-cli.ts"
            result = subprocess.run(
                ["npx", "tsx", str(resolve_script), str(scenes_path), str(self.workspace / "src")],
                capture_output=True, text=True, timeout=30,
                cwd=str(Path(__file__).parent.parent.parent),
                shell=IS_WINDOWS,
            )
            if result.returncode == 0:
                resolve_data = json.loads(result.stdout)
                self._resolved_templates_md = resolve_data.get("markdown", "")
                safe_print(f"[ClaudeGenerator] Resolved {resolve_data.get('copiedCount', 0)} templates from registry")
            else:
                safe_print(f"[ClaudeGenerator] Template resolution failed: {result.stderr[:200]}")
        except Exception as e:
            safe_print(f"[ClaudeGenerator] Template resolution error: {e}")

    def _validate_metadata(self, canvas_width: int, canvas_height: int) -> bool:
        """Validate and fix metadata.json dimensions if they don't match expected canvas."""
        metadata_path = self.src_dir / "metadata.json"
        if not metadata_path.exists():
            print(f"[ClaudeGenerator] WARNING: metadata.json not found at {metadata_path}")
            return False

        import json as json_mod
        metadata = json_mod.loads(metadata_path.read_text(encoding="utf-8"))

        # Support both key formats
        w_key = "compositionWidth" if "compositionWidth" in metadata else "width"
        h_key = "compositionHeight" if "compositionHeight" in metadata else "height"
        meta_w = metadata.get(w_key, 0)
        meta_h = metadata.get(h_key, 0)

        # Check for dimension flip (portrait should have width < height)
        if canvas_width < canvas_height and meta_w > meta_h:
            print(f"[ClaudeGenerator] FIXING metadata dimension flip: {meta_w}x{meta_h} -> {canvas_width}x{canvas_height}")
            metadata[w_key] = canvas_width
            metadata[h_key] = canvas_height
            metadata_path.write_text(json_mod.dumps(metadata, indent=2), encoding="utf-8")
            return True

        # Check for general mismatch
        if meta_w != canvas_width or meta_h != canvas_height:
            print(f"[ClaudeGenerator] FIXING metadata dimensions: {meta_w}x{meta_h} -> {canvas_width}x{canvas_height}")
            metadata[w_key] = canvas_width
            metadata[h_key] = canvas_height
            metadata_path.write_text(json_mod.dumps(metadata, indent=2), encoding="utf-8")
            return True

        return False

    # ------------------------------------------------------------------
    # Structured verdict parsing (for verification agents)
    # ------------------------------------------------------------------

    def _parse_verdict_from_response(
        self,
        messages: list,
        label: str = "Verify",
    ) -> tuple[bool, list[str]]:
        """Parse structured verdict from agent response messages.

        Prefers submit_verdict tool results (structured JSON).
        Falls back to regex PASS/FAIL parsing for backwards compatibility.

        Args:
            messages: List of SDK message objects collected during response
            label: Label for logging (e.g. "SceneVerify3", "CompVerify")

        Returns:
            (passed, issues_list)
        """
        # 1. Check for submit_verdict tool use in messages
        for msg in messages:
            if not hasattr(msg, "content"):
                continue
            for block in msg.content:
                block_type = type(block).__name__

                # Check ToolUseBlock for submit_verdict calls (input contains the verdict)
                if block_type == "ToolUseBlock" and hasattr(block, "name"):
                    if "submit_verdict" in getattr(block, "name", "") and hasattr(block, "input"):
                        inp = block.input
                        if isinstance(inp, dict) and "passed" in inp:
                            passed = bool(inp["passed"])
                            issues = list(inp.get("issues", []))
                            criteria = list(inp.get("acceptance_criteria", []))
                            if criteria:
                                issues.append("ACCEPTANCE CRITERIA: " + " | ".join(criteria))
                            print(f"[{label}] Structured verdict: {'PASS' if passed else 'FAIL'} ({len(issues)} issues)")
                            return passed, issues

                # Check ToolResultBlock for JSON verdict in tool output
                if block_type == "ToolResultBlock" and hasattr(block, "content"):
                    try:
                        content_str = ""
                        if isinstance(block.content, str):
                            content_str = block.content
                        elif isinstance(block.content, list):
                            for item in block.content:
                                if isinstance(item, dict) and item.get("type") == "text":
                                    content_str = item["text"]
                                    break
                        if content_str:
                            data = json.loads(content_str)
                            if "passed" in data:
                                passed = bool(data["passed"])
                                issues = list(data.get("issues", []))
                                criteria = list(data.get("acceptance_criteria", []))
                                if criteria:
                                    issues.append("ACCEPTANCE CRITERIA: " + " | ".join(criteria))
                                print(f"[{label}] Structured verdict (tool result): {'PASS' if passed else 'FAIL'} ({len(issues)} issues)")
                                return passed, issues
                    except (json.JSONDecodeError, TypeError, KeyError):
                        pass

        # 2. Fallback: regex parsing of response text
        response_text = ""
        for msg in messages:
            if not hasattr(msg, "content"):
                continue
            for block in msg.content:
                block_type = type(block).__name__
                if block_type == "TextBlock" and hasattr(block, "text"):
                    response_text += block.text

        print(f"[{label}] No structured verdict found, falling back to text parsing")
        return self._parse_verdict_text_fallback(response_text)

    def _parse_verdict_text_fallback(
        self,
        response_text: str,
    ) -> tuple[bool, list[str]]:
        """Legacy fallback: parse PASS/FAIL from free text."""
        lines = response_text.split("\n")
        verdict = None
        verdict_line_idx = -1

        for idx, line in enumerate(lines):
            stripped = line.strip().upper()
            if stripped == "PASS" or stripped.startswith("PASS:") or stripped.startswith("PASS.") or stripped.startswith("PASS -"):
                verdict = "PASS"
            elif stripped in ("FAIL", "ISSUES") or any(
                stripped.startswith(p) for p in ("FAIL:", "FAIL.", "FAIL -", "ISSUES:", "ISSUES.", "ISSUES -")
            ):
                verdict = "FAIL"
                verdict_line_idx = idx

        if verdict == "PASS":
            return True, []

        if verdict == "FAIL" and verdict_line_idx >= 0:
            issues: list[str] = []
            for line in lines[verdict_line_idx + 1:]:
                stripped = line.strip()
                m = re.match(r'^\d+[.)]\s+(.+)', stripped)
                if m:
                    issues.append(m.group(1))
            return False, issues

        # Ambiguous — no clear verdict, treat as pass
        return True, []

    def _validate_interpolate_clamping(self) -> list[str]:
        """Check all scene files for interpolate() calls missing extrapolateLeft/Right: 'clamp'.

        Returns list of warning strings. Empty list = all good.
        """
        warnings = []
        scenes_dir = self.src_dir / "scenes"
        if not scenes_dir.exists():
            return warnings

        # Match interpolate( calls and check for missing clamp options
        # Pattern: find interpolate(...) calls, then check the options object
        interpolate_call_re = re.compile(
            r'interpolate\s*\([^)]*\{([^}]*)\}[^)]*\)',
            re.DOTALL
        )

        for scene_file in sorted(scenes_dir.glob("Scene*.tsx")):
            content = scene_file.read_text(encoding="utf-8", errors="replace")
            for match in interpolate_call_re.finditer(content):
                opts = match.group(1)
                has_left = "extrapolateLeft" in opts
                has_right = "extrapolateRight" in opts
                if not has_left or not has_right:
                    # Find line number
                    line_num = content[:match.start()].count('\n') + 1
                    missing = []
                    if not has_left:
                        missing.append("extrapolateLeft: 'clamp'")
                    if not has_right:
                        missing.append("extrapolateRight: 'clamp'")
                    warnings.append(
                        f"{scene_file.name}:{line_num} — interpolate() missing {', '.join(missing)}"
                    )

        return warnings

    async def _run_self_heal(self, ts_errors: str) -> bool:
        """Run a mini-agent to fix TypeScript errors.

        Args:
            ts_errors: The TypeScript error output

        Returns:
            True if the agent ran successfully (doesn't guarantee errors fixed)
        """
        print(f"[ClaudeGenerator] Running self-heal agent...")

        heal_prompt = f"""
## TASK: Fix TypeScript Errors

The code has TypeScript compilation errors. Your job is to fix them.

### TypeScript Errors:
```
{ts_errors[:3000]}
```

### Instructions:
1. Read the error messages carefully
2. Identify the files and line numbers with errors
3. Read those files to understand the context
4. Fix each error - common issues are:
   - Missing imports
   - Type mismatches
   - Undefined variables
   - Syntax errors (missing brackets, etc.)
5. After fixing, run `npx tsc --noEmit` to verify

### Rules:
- Fix the MINIMUM needed to resolve errors
- Do NOT refactor or change working code
- Do NOT add new features
- Focus ONLY on making TypeScript compile

When done, respond: "SELF-HEAL COMPLETE"
"""

        try:
            client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model=self.model,
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": "You are a TypeScript error fixer. Fix compilation errors quickly and precisely."
                    },
                    cwd=str(self.workspace),
                    max_turns=20,
                    max_thinking_tokens=self.max_thinking_tokens,
                    setting_sources=["project"],  # Load skills from .claude/skills/
                    allowed_tools=["Read", "Edit", "Bash", "Glob", "Skill"],
                    permission_mode="bypassPermissions",
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            async with client:
                await client.query(heal_prompt)

                async for msg in client.receive_response():
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "TextBlock" and hasattr(block, "text"):
                                try:
                                    print(block.text[:200], end="", flush=True)
                                except UnicodeEncodeError:
                                    pass
                            elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[SelfHeal Tool: {block.name}]", flush=True)

            print(f"\n[ClaudeGenerator] Self-heal agent completed")
            return True

        except Exception as e:
            print(f"[ClaudeGenerator] Self-heal agent error: {e}")
            return False

    def _setup_entry_point(self) -> str:
        """Set up src/index.ts to import from the generated project.

        Returns:
            The original index.ts content (for later restoration).
        """
        index_ts_path = self.workspace / "src" / "index.ts"
        original = index_ts_path.read_text(encoding="utf-8") if index_ts_path.exists() else ""

        new_index_ts = f'''/**
 * Auto-generated entry point for project: {self.project_id}
 */
import {{ registerRoot }} from "remotion";
import {{ RemotionRoot }} from "./{self.project_id}/index";

registerRoot(RemotionRoot);
'''
        index_ts_path.write_text(new_index_ts)
        print(f"[ClaudeGenerator] Updated src/index.ts to import from {self.project_id}")
        return original

    def _restore_entry_point(self, original: str) -> None:
        """Restore the original src/index.ts content."""
        index_ts_path = self.workspace / "src" / "index.ts"
        index_ts_path.write_text(original)

    async def _render_scene_still(
        self,
        composition_id: str,
        frame: int,
        output_path: Path,
    ) -> tuple[bool, str]:
        """Render a single still frame using remotion still (async subprocess).

        Args:
            composition_id: Remotion composition ID (with dashes)
            frame: Frame number to render
            output_path: Where to save the PNG

        Returns:
            (success, error_message)
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)

        cmd_parts = [
            "npx", "remotion", "still",
            composition_id,
            str(output_path),
            f"--frame={frame}",
        ]

        try:
            if IS_WINDOWS:
                # Windows needs shell=True for npx.cmd
                cmd_str = " ".join(cmd_parts)
                proc = await asyncio.create_subprocess_shell(
                    cmd_str,
                    cwd=str(self.workspace),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
            else:
                proc = await asyncio.create_subprocess_exec(
                    *cmd_parts,
                    cwd=str(self.workspace),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)

            if proc.returncode != 0:
                err = stderr.decode("utf-8", errors="replace") if stderr else "Unknown error"
                print(f"[ClaudeGenerator] remotion still failed (frame {frame}): {err[:500]}")
                return False, err

            print(f"[ClaudeGenerator] Rendered still at frame {frame}: {output_path}")
            return True, ""

        except asyncio.TimeoutError:
            print(f"[ClaudeGenerator] remotion still timed out (frame {frame})")
            return False, "Render timed out after 120s"
        except Exception as e:
            print(f"[ClaudeGenerator] remotion still error (frame {frame}): {e}")
            return False, str(e)

    async def _run_visual_verify(
        self,
        scene_num: int,
        screenshot_paths: list[Path],
        scene_data: dict,
        plan_content: str,
    ) -> tuple[bool, list[str]]:
        """Spawn a Sonnet subagent to review screenshots against the plan.

        Args:
            scene_num: Scene number (1-based)
            screenshot_paths: Paths to rendered PNG screenshots (early, keySync, late)
            scene_data: The scene's dict from scenes.json
            plan_content: Full SCENE_PLAN.md content

        Returns:
            (passed, issues_list)
        """
        from prompts.animator import VISUAL_VERIFY_PROMPT

        scene_json_str = json.dumps(scene_data, indent=2)
        display_mode = scene_data.get("displayMode", "default")
        description = scene_data.get("visual", scene_data.get("description", "No description"))

        # Build screenshot section for all available frames
        screenshot_lines = []
        labels = ["Early (entrance check)", "Key sync (main content)", "Late (exit/outro check)"]
        for i, path in enumerate(screenshot_paths):
            path_str = str(path).replace("\\", "/")
            label = labels[i] if i < len(labels) else f"Frame {i+1}"
            screenshot_lines.append(f"- **{label}**: `{path_str}`")
        screenshots_str = "\n".join(screenshot_lines)

        user_msg = f"""## Visual Review: Scene {scene_num}

### Screenshots
Read each screenshot file to see the rendered frames:
{screenshots_str}

### Scene Data:
```json
{scene_json_str}
```

### Display Mode: `{display_mode}`
### Scene Description: {description}

### Director's Plan:
{plan_content}

Review ALL screenshots against the plan and scene data:
- **Early frame**: Check entrance animations are visible (elements should be appearing)
- **Key sync frame**: Check main content is present and correctly laid out
- **Late frame**: Check exit/outro phase (elements may be fading, content still visible)

After reviewing all screenshots, call the `mcp__viewport__submit_verdict` tool with your verdict.
"""

        try:
            mcp_servers_config = build_mcp_servers(str(self.workspace))
            client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model=self.model,
                    max_thinking_tokens=self.max_thinking_tokens,
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": VISUAL_VERIFY_PROMPT,
                    },
                    cwd=str(self.workspace),
                    max_turns=5,
                    allowed_tools=["Read", "mcp__viewport__submit_verdict"],
                    mcp_servers={"viewport": mcp_servers_config["viewport"]},
                    permission_mode="bypassPermissions",
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            messages = []
            async with client:
                await client.query(user_msg)

                async for msg in client.receive_response():
                    messages.append(msg)
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[VisualVerify{scene_num} Tool: {block.name}]", flush=True)

            return self._parse_verdict_from_response(messages, f"VisualVerify{scene_num}")

        except Exception as e:
            print(f"[ClaudeGenerator] Scene {scene_num} visual verify error: {e}")
            return True, []  # Non-blocking: don't fail pipeline on verify errors

    async def _verify_and_fix_scene(
        self,
        scene_num: int,
        scene_data: dict,
        plan_content: str,
        composition_id: str,
        style_preset: str = "studio-dark",
    ) -> None:
        """Per-scene verify → fix → re-verify loop.

        Args:
            scene_num: Scene number (1-based)
            scene_data: The scene's dict from scenes.json
            plan_content: Full SCENE_PLAN.md content
            composition_id: Remotion composition ID (with dashes)
        """
        from prompts.animator import VISUAL_FIX_PROMPT_TEMPLATE, ANIMATOR_BASE_PROMPT, get_studio_section

        studio_section = get_studio_section(style_preset)
        display_mode = scene_data.get("displayMode", "default")
        description = scene_data.get("visual", scene_data.get("description", "No description"))
        verify_dir = self.workspace / "visual-verify"

        # Determine verification frames: early, keySync/mid, late
        frames_range = scene_data.get("frames", [0, 60])
        start = frames_range[0] if len(frames_range) > 0 else 0
        end = frames_range[1] if len(frames_range) > 1 else start + 60
        scene_duration = end - start

        key_sync = scene_data.get("keySync", {})
        mid_frame = key_sync.get("frame") if key_sync.get("frame") is not None else (start + end) // 2

        if scene_duration < 45:
            # Very short scene: just check the midpoint
            verify_frames = [mid_frame]
        elif scene_duration < 90:
            # Short scene: check early and mid only
            verify_frames = [start + 10, mid_frame]
        else:
            # Normal scene: 3 frames with guaranteed spacing
            early = min(start + 15, mid_frame - 1)
            late = max(end - 15, mid_frame + 1)
            verify_frames = [early, mid_frame, late]

        max_retries = 2
        for attempt in range(max_retries + 1):
            # Step 1: Render all 3 stills
            screenshot_paths: list[Path] = []
            render_failed = False
            for i, vf in enumerate(verify_frames):
                screenshot_path = verify_dir / f"scene{scene_num}_f{i}_attempt{attempt}.png"
                success, err = await self._render_scene_still(
                    composition_id, vf, screenshot_path
                )
                if not success:
                    print(f"[ClaudeGenerator] Scene {scene_num} still render failed (frame {vf}): {err[:200]}")
                    render_failed = True
                    break
                screenshot_paths.append(screenshot_path)

            if render_failed:
                return  # Can't verify without screenshots

            # Step 2: Visual verify with all 3 frames
            passed, issues = await self._run_visual_verify(
                scene_num, screenshot_paths, scene_data, plan_content
            )

            if passed:
                print(f"[ClaudeGenerator] Scene {scene_num} passed visual verification")
                return

            print(f"[ClaudeGenerator] Scene {scene_num} failed visual verify: {issues}")

            # Step 3: Fix (if retries remaining)
            if attempt >= max_retries:
                print(f"[ClaudeGenerator] Scene {scene_num} accepting as-is after {max_retries} fix attempts")
                return

            issues_str = "\n".join(f"{i+1}. {issue}" for i, issue in enumerate(issues))
            # Use the key sync screenshot (middle frame) for the fix agent
            fix_screenshot = screenshot_paths[1] if len(screenshot_paths) > 1 else screenshot_paths[0]
            fix_msg = VISUAL_FIX_PROMPT_TEMPLATE.format(
                scene_num=scene_num,
                project_id=self.project_id,
                display_mode=display_mode,
                scene_description=description,
                screenshot_path=str(fix_screenshot).replace("\\", "/"),
                issues=issues_str,
            )

            skills_directive = get_skills_directive()

            try:
                fix_client = ClaudeSDKClient(
                    options=ClaudeAgentOptions(
                        model=self.model,
                        max_thinking_tokens=self.max_thinking_tokens,
                        system_prompt={
                            "type": "preset",
                            "preset": "claude_code",
                            "append": f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{skills_directive}",
                        },
                        cwd=str(self.workspace),
                        max_turns=15,
                        allowed_tools=["Read", "Edit", "Bash", "Glob", "Skill"],
                        permission_mode="bypassPermissions",
                        cli_path=CLAUDE_CLI_PATH,
                    )
                )

                async with fix_client:
                    await fix_client.query(fix_msg)
                    async for msg in fix_client.receive_response():
                        msg_type = type(msg).__name__
                        if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                            for block in msg.content:
                                block_type = type(block).__name__
                                if block_type == "ToolUseBlock" and hasattr(block, "name"):
                                    print(f"\n[VisualFix{scene_num} Tool: {block.name}]", flush=True)

                print(f"[ClaudeGenerator] Scene {scene_num} visual fix attempt {attempt + 1} complete")

            except Exception as e:
                print(f"[ClaudeGenerator] Scene {scene_num} visual fix error: {e}")
                return  # Don't retry if fix agent itself fails

    async def _run_visual_verification_phase(
        self,
        composition_id: str,
        scenes_data: dict,
        plan_content: str,
        style_preset: str = "studio-dark",
    ) -> None:
        """Top-level orchestrator for Phase 2e visual verification.

        Sets up entry point once, launches all scene verifications in parallel,
        then cleans up. Fix agents run in parallel per-scene but each targets
        only its own Scene<N>.tsx file, so concurrent edits are isolated.

        Args:
            composition_id: Remotion composition ID (with dashes)
            scenes_data: Full scenes.json content as dict
            plan_content: Full SCENE_PLAN.md content
        """
        scenes = scenes_data.get("scenes", [])
        if not scenes:
            print("[ClaudeGenerator] No scenes to verify")
            return

        original_index_ts = self._setup_entry_point()
        verify_dir = self.workspace / "visual-verify"

        try:
            tasks = []
            for i, scene in enumerate(scenes):
                scene_num = i + 1
                scene_file = self.src_dir / "scenes" / f"Scene{scene_num}.tsx"
                if not scene_file.exists():
                    print(f"[ClaudeGenerator] Skipping visual verify for Scene{scene_num} (no .tsx file)")
                    continue

                tasks.append(
                    self._verify_and_fix_scene(
                        scene_num=scene_num,
                        scene_data=scene,
                        plan_content=plan_content,
                        composition_id=composition_id,
                        style_preset=style_preset,
                    )
                )

            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        print(f"[ClaudeGenerator] Visual verify task {i+1} exception: {result}")

        finally:
            self._restore_entry_point(original_index_ts)
            # Clean up screenshots
            if verify_dir.exists():
                try:
                    shutil.rmtree(verify_dir)
                except Exception as e:
                    print(f"[ClaudeGenerator] Failed to clean up visual-verify dir: {e}")

    async def _run_bundle(self) -> Path:
        """Bundle the Remotion project."""
        import subprocess

        # TypeScript processor expects dashes, not underscores in bundle path
        bundle_id = self.project_id.replace("_", "-")
        bundle_path = self.bundle_output / bundle_id

        # Create output directory
        bundle_path.mkdir(parents=True, exist_ok=True)

        original_index_ts = self._setup_entry_point()

        try:
            result = subprocess.run(
                ["npx", "remotion", "bundle", "--out-dir", str(bundle_path)],
                cwd=str(self.workspace),
                capture_output=True,
                timeout=300,  # 5 min for bundling
                shell=IS_WINDOWS,
                encoding="utf-8",
                errors="replace",
            )

            if result.returncode != 0:
                print(f"[ClaudeGenerator] Bundle stderr: {result.stderr}")
                raise RuntimeError(f"Bundle failed: {result.stderr}")

            return bundle_path

        except subprocess.TimeoutExpired:
            raise RuntimeError("Bundle timed out after 5 minutes")
        finally:
            # Restore original index.ts for next project
            self._restore_entry_point(original_index_ts)

    async def _compile_cjs(self, bundle_path: Path) -> None:
        """
        Compile the composition source to CommonJS for dynamic frontend loading.

        The frontend's DynamicVisualLoader expects a composition.cjs.js file
        that exports the React component in CommonJS format.
        """
        import subprocess

        # Use absolute paths to avoid issues with cwd
        index_tsx = (self.src_dir / "index.tsx").resolve()
        cjs_output = (bundle_path / "composition.cjs.js").resolve()

        if not index_tsx.exists():
            safe_print(f"[ClaudeGenerator] Warning: index.tsx not found, skipping CJS compilation")
            return

        safe_print(f"[ClaudeGenerator] Compiling composition to CJS: {cjs_output}")

        try:
            # Use esbuild to compile the composition to CommonJS
            # This creates a file the frontend can dynamically import
            # Externalize all packages that the frontend's customRequire provides
            result = subprocess.run(
                [
                    "npx", "esbuild",
                    str(index_tsx),
                    "--bundle",
                    "--format=cjs",
                    "--platform=browser",
                    "--target=es2020",
                    "--external:react",
                    "--external:react/jsx-runtime",
                    "--external:react/jsx-dev-runtime",
                    "--external:remotion",
                    "--external:@remotion/noise",
                    "--external:@remotion/shapes",
                    "--external:@remotion/paths",
                    "--external:@remotion/three",
                    f"--outfile={cjs_output}",
                ],
                cwd=str(self.workspace),
                capture_output=True,
                timeout=60,
                shell=IS_WINDOWS,
                encoding="utf-8",
                errors="replace",
            )

            if result.returncode != 0:
                safe_print(f"[ClaudeGenerator] CJS compilation warning: {result.stderr}")
                # Don't fail - the browser bundle still works for some use cases
            else:
                safe_print(f"[ClaudeGenerator] CJS compilation successful")
                # Post-process to add React keys
                self._add_react_keys_to_cjs(cjs_output)

        except subprocess.TimeoutExpired:
            safe_print(f"[ClaudeGenerator] CJS compilation timed out")
        except Exception as e:
            safe_print(f"[ClaudeGenerator] CJS compilation error: {e}")

    def _add_react_keys_to_cjs(self, cjs_path: Path) -> None:
        """
        Post-process CJS file to add React keys to children arrays.
        This fixes the 'Each child in a list should have a unique key prop' warnings.

        Strategy: Find jsx/jsxs calls that end with }), and add a key before the closing paren.
        Skip ones that already have a key (end with }, "...")).
        """
        if not cjs_path.exists():
            return

        content = cjs_path.read_text(encoding="utf-8")
        lines = content.split('\n')
        modified = False
        key_counter = 0

        new_lines = []
        for line in lines:
            # Look for jsx calls ending with }) that don't have a key
            # Pattern: ...import_jsx_runtime.jsx)(..., {...}) or ...jsxs)(..., {...})
            # Should become: ...import_jsx_runtime.jsx)(..., {...}, "key")

            # Check if line has a jsx/jsxs call that ends with })
            if 'import_jsx_runtime.jsx' in line and line.rstrip().endswith('}),'):
                # Check if it already has a key (third arg)
                # Has key: }, "key"),  No key: }),
                stripped = line.rstrip()
                # Find the last }) and insert key before it
                if not '},  "' in stripped and not '}, "' in stripped:
                    # No key, add one
                    key_counter += 1
                    # Replace trailing }), with }, "k{n}"),
                    new_line = stripped[:-2] + f', "k{key_counter}"),'
                    new_lines.append(new_line)
                    modified = True
                    continue
            elif 'import_jsx_runtime.jsx' in line and line.rstrip().endswith('})'):
                stripped = line.rstrip()
                if not '},  "' in stripped and not '}, "' in stripped:
                    key_counter += 1
                    new_line = stripped[:-1] + f', "k{key_counter}")'
                    new_lines.append(new_line)
                    modified = True
                    continue

            new_lines.append(line)

        if modified:
            cjs_path.write_text('\n'.join(new_lines), encoding="utf-8")
            safe_print(f"[ClaudeGenerator] Added {key_counter} React keys to CJS output")

    # =========================================================================
    # Two-Phase Generation Pipeline (Director + Animator)
    # =========================================================================

    async def _run_director(
        self,
        formatted_transcript: str,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
        style_preset: str = "studio-dark",
        layout_mode: str = "pip",
        style_guide: str | None = None,
        source_width: int | None = None,
        source_height: int | None = None,
        pip_width: int | None = None,
        pip_height: int | None = None,
        safe_placement: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Phase 1: Run the Director agent to create the scene plan.

        The Director analyzes the transcript and creates:
        - SCENE_PLAN.md: Human-readable plan with visual story
        - scenes.json: Machine-readable scene data for Animator

        Args:
            formatted_transcript: Transcript with word-level timestamps
            width: Full canvas width
            height: Full canvas height
            duration_frames: Total frames
            fps: Frames per second
            style_preset: Visual style preset (studio-dark, studio-light)
            layout_mode: Layout mode (pip, stacked)
            style_guide: Optional user-provided style/layout guidance
            source_width: Source video width (for coverage-tier display mode guidance)
            source_height: Source video height (for coverage-tier display mode guidance)

        Returns:
            dict with success status and plan file paths
        """
        from prompts.director import DIRECTOR_SYSTEM_PROMPT, build_director_user_message

        print(f"[ClaudeGenerator] Phase 1: Director analyzing transcript...")

        # Ensure src_dir exists before running Claude
        self.src_dir.mkdir(parents=True, exist_ok=True)

        director_message = build_director_user_message(
            project_id=self.project_id,
            formatted_transcript=formatted_transcript,
            width=width,
            height=height,
            duration_frames=duration_frames,
            fps=fps,
            style_preset=style_preset,
            layout_mode=layout_mode,
            style_guide=style_guide,
            output_dir=str(self.src_dir),
            source_width=source_width,
            source_height=source_height,
            pip_width=pip_width,
            pip_height=pip_height,
            safe_placement=safe_placement,
        )

        # For studio style: inject template catalog directly into the Director prompt
        # so it can plan scenes around available templates without needing to discover files
        if get_theme(style_preset):
            catalog_path = self.workspace / "src" / "STUDIO_TEMPLATES.md"
            if catalog_path.exists():
                catalog_content = catalog_path.read_text(encoding="utf-8")
                director_message += f"\n\n{catalog_content}"
                safe_print(f"[ClaudeGenerator] Injected studio template catalog ({len(catalog_content)} chars) into Director prompt")
            else:
                safe_print("[ClaudeGenerator] WARNING: STUDIO_TEMPLATES.md not found, Director will plan without template catalog")

        # Write restricted security settings for the Director — only allow writes
        # within the project directory (src_dir). This prevents Claude from writing
        # plan files to the workspace root.
        director_settings_dir = self.src_dir / ".claude"
        director_settings_dir.mkdir(parents=True, exist_ok=True)
        src_dir_posix = str(self.src_dir).replace(chr(92), '/')
        workspace_posix = str(self.workspace).replace(chr(92), '/')
        director_settings = {
            "permissions": {
                "defaultMode": "acceptEdits",
                "allow": [
                    "Read(./**)",
                    "Write(./**)",
                    "Edit(./**)",
                    "Glob(./**)",
                    "Grep(./**)",
                    # Absolute paths for project dir (prompt tells Claude to use absolute paths)
                    f"Read({src_dir_posix}/**)",
                    f"Write({src_dir_posix}/**)",
                    f"Edit({src_dir_posix}/**)",
                    f"Glob({src_dir_posix}/**)",
                    f"Grep({src_dir_posix}/**)",
                    # Also allow reading from workspace root (for CLAUDE.md, config files)
                    f"Read({workspace_posix}/**)",
                    f"Glob({workspace_posix}/**)",
                    f"Grep({workspace_posix}/**)",
                    "Bash(*)",
                ],
            },
        }
        with open(director_settings_dir / "settings.local.json", "w", encoding="utf-8") as f:
            json.dump(director_settings, f, indent=2)

        # Director uses configured model (Opus) for high-quality planning.
        # cwd is set to src_dir so Claude writes SCENE_PLAN.md and scenes.json
        # directly in the project directory — prevents misplaced files at workspace root.
        client = ClaudeSDKClient(
            options=ClaudeAgentOptions(
                model=self.model,
                system_prompt={
                    "type": "preset",
                    "preset": "claude_code",
                    "append": DIRECTOR_SYSTEM_PROMPT
                },
                cwd=str(self.src_dir),
                max_turns=50,  # Enough turns for research + planning + writing
                max_thinking_tokens=self.max_thinking_tokens,
                allowed_tools=["Read", "Write", "Grep", "Glob", "WebSearch", "TodoWrite"],
                permission_mode="bypassPermissions",
                cli_path=CLAUDE_CLI_PATH,
            )
        )

        response_text = ""
        tool_calls_made = []
        async with client:
            await client.query(director_message)
            print(f"[Director] Query sent, waiting for response...", flush=True)

            async for msg in client.receive_response():
                msg_type = type(msg).__name__
                print(f"[Director] Received message type: {msg_type}", flush=True)

                if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__
                        if block_type == "TextBlock" and hasattr(block, "text"):
                            response_text += block.text
                            try:
                                print(block.text, end="", flush=True)
                            except UnicodeEncodeError:
                                safe_text = block.text.encode("ascii", errors="replace").decode("ascii")
                                print(safe_text, end="", flush=True)
                        elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                            tool_calls_made.append(block.name)
                            print(f"\n[Director Tool: {block.name}]", flush=True)
                        elif block_type == "ToolResultBlock":
                            print(f"\n[Director Tool Result received]", flush=True)
                        elif block_type == "ThinkingBlock":
                            pass  # Extended thinking — no output needed
                        else:
                            print(f"\n[Director] Unknown block type: {block_type}", flush=True)
                elif msg_type == "ErrorMessage":
                    print(f"[Director] ERROR: {msg}", flush=True)
                elif msg_type == "StopMessage":
                    print(f"[Director] Stop reason received", flush=True)

        print(f"\n[ClaudeGenerator] Director made {len(tool_calls_made)} tool calls: {tool_calls_made}", flush=True)

        print(f"\n[ClaudeGenerator] Director completed")

        # Verify plan files were created
        scene_plan = self.src_dir / "SCENE_PLAN.md"
        scenes_json = self.src_dir / "scenes.json"

        # Debug: List what files exist in the source directory
        print(f"[ClaudeGenerator] Checking for plan files in: {self.src_dir}")
        if self.src_dir.exists():
            existing_files = list(self.src_dir.iterdir())
            print(f"[ClaudeGenerator] Files in src_dir: {[f.name for f in existing_files]}")
        else:
            print(f"[ClaudeGenerator] WARNING: src_dir does not exist!")
            self.src_dir.mkdir(parents=True, exist_ok=True)

        # ── Fallback file recovery ──
        # Claude sometimes writes plan files to the wrong location (workspace root,
        # flattened path in filename, etc.). Search common wrong locations and move them.
        if not scene_plan.exists() or not scenes_json.exists():
            import shutil
            print(f"[ClaudeGenerator] Plan files not in expected location, searching for misplaced files...")

            # Search patterns: workspace root, with project prefix in filename, src/ root
            search_locations = [
                # Workspace root — Claude ignores the path and writes to cwd
                (self.workspace / "SCENE_PLAN.md", self.workspace / "scenes.json"),
                # Workspace root with project prefix flattened into filename
                (self.workspace / f"{self.project_id}_SCENE_PLAN.md", self.workspace / f"{self.project_id}_scenes.json"),
                # src/ root (one level up from project dir)
                (self.workspace / "src" / "SCENE_PLAN.md", self.workspace / "src" / "scenes.json"),
            ]

            for alt_plan, alt_scenes in search_locations:
                if alt_plan.exists() and not scene_plan.exists():
                    print(f"[ClaudeGenerator] Found misplaced SCENE_PLAN.md at {alt_plan}, moving to {scene_plan}")
                    shutil.move(str(alt_plan), str(scene_plan))
                if alt_scenes.exists() and not scenes_json.exists():
                    print(f"[ClaudeGenerator] Found misplaced scenes.json at {alt_scenes}, moving to {scenes_json}")
                    shutil.move(str(alt_scenes), str(scenes_json))

            # Also search for any SCENE_PLAN.md in the workspace root with any prefix
            if not scene_plan.exists():
                for f in self.workspace.glob("*SCENE_PLAN.md"):
                    print(f"[ClaudeGenerator] Found misplaced plan file: {f}, moving to {scene_plan}")
                    shutil.move(str(f), str(scene_plan))
                    break
            if not scenes_json.exists():
                for f in self.workspace.glob("*scenes.json"):
                    print(f"[ClaudeGenerator] Found misplaced scenes file: {f}, moving to {scenes_json}")
                    shutil.move(str(f), str(scenes_json))
                    break

        if not scene_plan.exists():
            return {
                "success": False,
                "error": f"Director did not create SCENE_PLAN.md (expected at {scene_plan})",
            }

        if not scenes_json.exists():
            return {
                "success": False,
                "error": f"Director did not create scenes.json (expected at {scenes_json})",
            }

        # Validate scenes.json structure
        try:
            with open(scenes_json, encoding="utf-8") as f:
                plan_data = json.load(f)

            # Kinetic-typography uses "segments" instead of "scenes"
            has_scenes = "scenes" in plan_data and len(plan_data.get("scenes", [])) > 0
            has_segments = "segments" in plan_data and len(plan_data.get("segments", [])) > 0

            if not has_scenes and not has_segments:
                return {
                    "success": False,
                    "error": "scenes.json has no scenes or segments defined",
                }

            scene_count = len(plan_data.get("scenes", plan_data.get("segments", [])))
            print(f"[ClaudeGenerator] Director created plan with {scene_count} {'segments' if has_segments else 'scenes'}")

        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"scenes.json is invalid JSON: {e}",
            }

        # ── Programmatic scene constraint validation ──
        validation = self._validate_scene_plan(
            plan_data, fps, duration_frames,
            canvas_width=width, canvas_height=height,
            layout_mode=layout_mode,
            pip_width=pip_width, pip_height=pip_height,
        )

        if validation["warnings"]:
            print(f"[ClaudeGenerator] Scene plan warnings ({len(validation['warnings'])}):")
            for w in validation["warnings"]:
                print(f"  ⚠ {w}")

        if validation["errors"]:
            print(f"[ClaudeGenerator] Scene plan ERRORS ({len(validation['errors'])}):")
            for e in validation["errors"]:
                print(f"  ✗ {e}")
            return {
                "success": False,
                "error": f"Scene plan validation failed: {'; '.join(validation['errors'])}",
            }

        if validation["repaired"]:
            # Write the repaired scenes.json back
            print(f"[ClaudeGenerator] Auto-repaired scene plan, writing updated scenes.json")
            with open(scenes_json, "w", encoding="utf-8") as f:
                json.dump(plan_data, f, indent=2, ensure_ascii=False)
            scene_count = len(plan_data["scenes"])
            print(f"[ClaudeGenerator] Updated scene count after repairs: {scene_count}")

        return {
            "success": True,
            "scenePlanPath": str(scene_plan),
            "scenesJsonPath": str(scenes_json),
            "sceneCount": scene_count,
        }

    # ------------------------------------------------------------------
    # Sequential Animator helpers
    # ------------------------------------------------------------------

    async def _verify_typescript_file(self, file_path: str) -> tuple[bool, str]:
        """Run TypeScript validation on a specific file.

        Runs full project tsc check, then filters errors to those mentioning
        the target file.  Uses `npx tsc` (not ./node_modules/.bin/tsc) so it
        works correctly on Windows.

        Args:
            file_path: Path relative to the workspace (e.g. "src/proj/scenes/Scene1.tsx")

        Returns:
            Tuple of (success, error_output)
        """
        import subprocess

        try:
            result = subprocess.run(
                ["npx", "tsc", "--noEmit"],
                cwd=str(self.workspace),
                capture_output=True,
                timeout=90,
                shell=IS_WINDOWS,
                encoding="utf-8",
                errors="replace",
            )
            if result.returncode == 0:
                return True, ""
            else:
                # Filter errors to only those relevant to the target file
                all_errors = result.stdout + result.stderr
                # Normalize path separators for matching
                file_key = file_path.replace("\\", "/")
                relevant = []
                for line in all_errors.splitlines():
                    normalized = line.replace("\\", "/")
                    if file_key in normalized or (relevant and not line.strip().startswith("src/")):
                        relevant.append(line)
                if relevant:
                    filtered = "\n".join(relevant)
                    print(f"[ClaudeGenerator] TypeScript errors in {file_path}:\n{filtered[:2000]}")
                    return False, filtered
                # Errors exist but not in our target file — treat as success for this file
                return True, ""
        except subprocess.TimeoutExpired:
            return False, "TypeScript check timed out"
        except Exception as e:
            return False, str(e)

    async def _run_scene_verify(
        self,
        scene_num: int,
        scene_data: dict,
        plan_description: str,
        display_mode: str,
        constants_content: str,
    ) -> tuple[bool, list[str]]:
        """Spawn a Sonnet verification subagent for a single scene.

        Args:
            scene_num: Scene number (1-based)
            scene_data: The scene's dict from scenes.json
            plan_description: Full SCENE_PLAN.md content
            display_mode: The scene's display mode
            constants_content: Current constants.ts content

        Returns:
            (passed, issues_list) — passed is True if PASS, issues_list contains numbered issues
        """
        from prompts.animator import SCENE_VERIFY_PROMPT

        scene_file = f"src/{self.project_id}/scenes/Scene{scene_num}.tsx"
        scene_json_str = json.dumps(scene_data, indent=2)

        user_msg = f"""
## Verify Scene {scene_num}

Scene file: `{scene_file}`
Display mode: `{display_mode}`

### Scene Data:
```json
{scene_json_str}
```

### Plan Description:
{plan_description}

### constants.ts:
```typescript
{constants_content}
```

Read the scene file and verify it against the plan and scene data.
After your analysis, call the `mcp__viewport__submit_verdict` tool with your verdict.
"""

        try:
            mcp_servers_config = build_mcp_servers(str(self.workspace))
            client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model=self.model,
                    max_thinking_tokens=self.max_thinking_tokens,
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": SCENE_VERIFY_PROMPT,
                    },
                    cwd=str(self.workspace),
                    max_turns=10,
                    allowed_tools=["Read", "Bash", "mcp__viewport__submit_verdict"],
                    mcp_servers={"viewport": mcp_servers_config["viewport"]},
                    permission_mode="bypassPermissions",
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            messages = []
            async with client:
                await client.query(user_msg)

                async for msg in client.receive_response():
                    messages.append(msg)
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[SceneVerify{scene_num} Tool: {block.name}]", flush=True)

            return self._parse_verdict_from_response(messages, f"SceneVerify{scene_num}")

        except Exception as e:
            print(f"[ClaudeGenerator] Scene {scene_num} verify error: {e}")
            return True, []  # Don't block on verify failures

    def _validate_overlay_placement(
        self,
        scene_num: int,
        scene_data: dict,
        scene_code: str,
    ) -> list[str]:
        """Statically verify overlay scene code against the 24x24 speaker grid.

        Checks:
        1. Elements are positioned in safe zones (not overlapping speaker grid cells)
        2. No opacity multiplication / reduced max opacity on elements
        3. No opaque backgrounds

        Returns list of issues (empty = all good).
        """
        issues: list[str] = []
        display_mode = scene_data.get("displayMode", "default")
        if display_mode != "overlay":
            return issues

        speaker_grid = scene_data.get("speakerGrid")
        ew = scene_data.get("effectiveDimensions", {}).get("width", 1080)
        eh = scene_data.get("effectiveDimensions", {}).get("height", 1920)

        # ── Check 1: Opacity violations ──
        # Look for patterns that reduce max opacity below 1.0
        opacity_patterns = [
            # opacity: X where X < 1.0 and is a literal (not interpolate/spring result)
            (r'opacity:\s*(0\.\d+)\b', "Literal opacity {val} < 1.0 — overlay elements must reach full opacity (1.0) at rest"),
            # opacity * fraction patterns (e.g., progress * 0.6)
            (r'opacity:\s*\w+\s*\*\s*(0\.\d+)', "Opacity multiplied by {val} — elements will look ghostly. Use full opacity (1.0) at rest"),
        ]
        for pattern, msg_template in opacity_patterns:
            for m in re.finditer(pattern, scene_code):
                val = float(m.group(1))
                # Allow opacity: 0 (hidden state for animation) and values >= 0.95 (close enough)
                if val < 0.95 and val > 0.0:
                    # Check if this is inside an interpolate (animation) — those are OK for entrance/exit
                    # Look at surrounding context (100 chars before)
                    start = max(0, m.start() - 100)
                    context = scene_code[start:m.start()]
                    if 'interpolate(' not in context and 'spring(' not in context:
                        issues.append(msg_template.format(val=val))

        # ── Check 2: Background violations ──
        # Only flag OPAQUE scene-level backgrounds (solid hex colors, opaque rgb).
        # Semi-transparent rgba, gradients on cards/badges are fine for overlay elements.
        bg_patterns = [
            (r"backgroundColor:\s*['\"]#[0-9a-fA-F]{3,8}['\"]", "Overlay scene has solid backgroundColor — must be transparent"),
            (r"backgroundColor:\s*['\"]rgb\(\s*\d", "Overlay scene has opaque rgb backgroundColor — use rgba with alpha or transparent"),
        ]
        for pattern, msg in bg_patterns:
            if re.search(pattern, scene_code):
                issues.append(msg)

        if issues:
            print(f"[ClaudeGenerator] Scene {scene_num} overlay validation: {len(issues)} issues found")
        else:
            print(f"[ClaudeGenerator] Scene {scene_num} overlay validation: PASS")

        return issues

    def _validate_dotgrid(self, scene_num: int, scene_code: str) -> list[str]:
        """Check for invisible DotGrid parameters."""
        issues = []
        # Check for tiny dot radius in pattern context
        for m in re.finditer(r'r[=:]\s*[\{(]?\s*[s(]*(\d+)\s*[)}\s]', scene_code):
            val = int(m.group(1))
            if val < 2:
                start = max(0, m.start() - 200)
                context = scene_code[start:m.end()].lower()
                if 'pattern' in context or 'dot' in context or 'grid' in context:
                    issues.append(f"Scene {scene_num}: DotGrid radius r={val} is too small (invisible). Use r=3 minimum.")
        # Check for too-tight spacing
        for m in re.finditer(r'spacing[=:]\s*[\{(]?\s*(\d+)', scene_code):
            val = int(m.group(1))
            if val < 60:
                start = max(0, m.start() - 100)
                context = scene_code[start:m.end()].lower()
                if 'dot' in context or 'grid' in context or 'pattern' in context:
                    issues.append(f"Scene {scene_num}: DotGrid spacing={val} is too tight (dots merge). Use spacing=80 minimum.")
        return issues

    async def _verify_and_fix_scene_code(
        self,
        scene_num: int,
        scene_data: dict,
        scene_plan_content: str,
        constants_content: str,
        studio_section: str,
        remotion_libraries: str,
    ) -> tuple[bool, list[str]]:
        """Verify a single scene's code against the plan and fix if needed.

        This is the per-scene verify+fix logic extracted for parallel execution.
        Returns (passed, issues) tuple.
        """
        scene_file = self.src_dir / "scenes" / f"Scene{scene_num}.tsx"
        if not scene_file.exists():
            return True, []

        # Run static overlay validation (positioning, opacity, backgrounds)
        scene_code = scene_file.read_text(encoding="utf-8")
        overlay_issues = self._validate_overlay_placement(scene_num, scene_data, scene_code)

        # Run DotGrid validation
        dotgrid_issues = self._validate_dotgrid(scene_num, scene_code)
        overlay_issues.extend(dotgrid_issues)

        passed, issues = await self._run_scene_verify(
            scene_num=scene_num,
            scene_data=scene_data,
            plan_description=scene_plan_content,
            display_mode=scene_data.get("displayMode", "default"),
            constants_content=constants_content,
        )

        # Merge overlay issues into the Sonnet verify issues
        if overlay_issues:
            issues = overlay_issues + issues
            passed = False

        if passed:
            print(f"[ClaudeGenerator] Scene {scene_num} passed verification")
            return True, []

        if not issues:
            return passed, []

        print(f"[ClaudeGenerator] Scene {scene_num} failed verification: {issues}")

        from prompts.animator import ANIMATOR_BASE_PROMPT

        # Targeted fix agent
        feedback_msg = "\n".join(f"- {iss}" for iss in issues)

        # Include speaker grid context for overlay fix agents
        grid_context = ""
        if scene_data.get("displayMode") == "overlay" and scene_data.get("speakerGrid"):
            sg = scene_data["speakerGrid"]
            grid_context = f"""

## OVERLAY LAYOUT RULES
Canvas: {scene_data.get('effectiveDimensions', {}).get('width', 1080)}x{scene_data.get('effectiveDimensions', {}).get('height', 1920)}
ALL overlay elements must be horizontally centered (left: 0, right: 0 with centered flex).
Place content in top strip (0-15% from top) or lower-third (60-85% from top).
NEVER scatter elements at random absolute positions.
All overlay elements must have opacity 1.0 at rest — no ghosting.
"""
        fix_prompt = f"""Fix these issues in src/{self.project_id}/scenes/Scene{scene_num}.tsx:

{feedback_msg}
{grid_context}
Read the scene file and fix the listed issues.
Do NOT modify constants.ts or other scene files.
Do NOT run tsc — TypeScript will be validated after all scenes are verified.
When done, respond: "FIX COMPLETE"
"""
        try:
            fix_client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model=self.model,
                    max_thinking_tokens=self.max_thinking_tokens,
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{remotion_libraries}",
                    },
                    cwd=str(self.workspace),
                    max_turns=15,
                    allowed_tools=["Read", "Edit", "Bash", "Glob"],
                    permission_mode="bypassPermissions",
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            async with fix_client:
                await fix_client.query(fix_prompt)
                async for msg in fix_client.receive_response():
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[SceneFix{scene_num} Tool: {block.name}]", flush=True)

            # Re-verify (accept regardless after 1 retry)
            # Re-run overlay validation on fixed code
            fixed_code = scene_file.read_text(encoding="utf-8")
            overlay_issues2 = self._validate_overlay_placement(scene_num, scene_data, fixed_code)

            passed2, issues2 = await self._run_scene_verify(
                scene_num=scene_num,
                scene_data=scene_data,
                plan_description=scene_plan_content,
                display_mode=scene_data.get("displayMode", "default"),
                constants_content=constants_content,
            )
            if overlay_issues2:
                issues2 = overlay_issues2 + issues2
                passed2 = False

            if passed2:
                print(f"[ClaudeGenerator] Scene {scene_num} passed verification after fix")
                return True, []
            else:
                print(f"[ClaudeGenerator] Scene {scene_num} still has issues after fix (accepted): {issues2}")
                return False, issues2
        except Exception as fix_err:
            print(f"[ClaudeGenerator] Scene {scene_num} fix agent error: {fix_err}")
            return False, issues

    async def _run_composition_verify(
        self,
        project_id: str,
        scenes_data: dict,
        plan_content: str,
    ) -> tuple[bool, list[str]]:
        """Spawn a Sonnet verification subagent for the full composition.

        Args:
            project_id: The project identifier
            scenes_data: Full scenes.json content as dict
            plan_content: Full SCENE_PLAN.md content

        Returns:
            (passed, issues_list)
        """
        from prompts.animator import COMPOSITION_VERIFY_PROMPT

        scenes = scenes_data.get("scenes", [])
        scene_count = len(scenes)
        scenes_summary = json.dumps(
            {
                "totalFrames": scenes_data.get("totalFrames"),
                "fps": scenes_data.get("fps"),
                "sceneCount": scene_count,
                "scenes": [
                    {"name": s.get("name", f"Scene {i+1}"), "displayMode": s.get("displayMode", "default")}
                    for i, s in enumerate(scenes)
                ],
            },
            indent=2,
        )

        user_msg = f"""
## Verify Full Composition

Project directory: `src/{project_id}/`
Scene count: {scene_count}

### scenes.json summary:
```json
{scenes_summary}
```

### Plan:
{plan_content}

Verify all scenes exist, constants match, and TypeScript compiles.
Fix any issues you can.
After your analysis, call the `mcp__viewport__submit_verdict` tool with your verdict.
"""

        try:
            mcp_servers_config = build_mcp_servers(str(self.workspace))
            client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model=self.model,
                    max_thinking_tokens=self.max_thinking_tokens,
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": COMPOSITION_VERIFY_PROMPT,
                    },
                    cwd=str(self.workspace),
                    max_turns=15,
                    allowed_tools=["Read", "Bash", "Edit", "Glob", "mcp__viewport__submit_verdict"],
                    mcp_servers={"viewport": mcp_servers_config["viewport"]},
                    permission_mode="bypassPermissions",
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            messages = []
            async with client:
                await client.query(user_msg)

                async for msg in client.receive_response():
                    messages.append(msg)
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[CompVerify Tool: {block.name}]", flush=True)

            return self._parse_verdict_from_response(messages, "CompVerify")

        except Exception as e:
            print(f"[ClaudeGenerator] Composition verify error: {e}")
            return True, []  # Don't block on verify failures

    def _generate_index_tsx(self, scenes: list[dict], project_id: str) -> str:
        """Generate the full index.tsx content from scene data.

        Pure Python codegen — assembles imports, Sequences, overlay logic,
        RemotionRoot with Composition, and default export.

        Args:
            scenes: List of scene dicts from scenes.json
            project_id: Project identifier

        Returns:
            Full index.tsx file content as a string
        """
        composition_id = project_id.replace("_", "-")
        total_scenes = len(scenes)

        # Build scene imports
        scene_imports = "\n".join(
            f"import {{ Scene{i+1} }} from './scenes/Scene{i+1}';"
            for i in range(total_scenes)
        )

        # Build Sequence blocks
        sequence_blocks = "\n".join(
            f"""
      <Sequence key="scene{i+1}" from={{TIMING.scene{i+1}Start}} durationInFrames={{TIMING.scene{i+1}End - TIMING.scene{i+1}Start}}>
        <Scene{i+1} startFrame={{0}} />
      </Sequence>"""
            for i in range(total_scenes)
        )

        index_content = f"""import React from 'react';
import {{
  AbsoluteFill,
  Composition,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
}} from 'remotion';
import {{ COLORS, TIMING }} from './constants';
{scene_imports}

const MainComposition: React.FC = () => {{
  return (
    <AbsoluteFill>
      {{/* NO global background here. Each non-overlay scene renders its own
          Background component internally. Overlay scenes are transparent.
          The editor uses screen blend mode to composite overlays on video. */}}
{sequence_blocks}
    </AbsoluteFill>
  );
}};

export const RemotionRoot: React.FC = () => {{
  return (
    <Composition
      id="{composition_id}"
      component={{MainComposition}}
      durationInFrames={{TIMING.totalFrames}}
      fps={{TIMING.fps}}
      width={{TIMING.width}}
      height={{TIMING.height}}
    />
  );
}};

// CRITICAL: Export MainComposition as default (NOT RemotionRoot!)
export default MainComposition;

// NOTE: Do NOT call registerRoot here - the workspace index.ts handles registration
"""
        return index_content

    def _generate_metadata_json(self, scenes_data: dict, project_id: str) -> str:
        """Generate metadata.json content from scenes data.

        Args:
            scenes_data: Full scenes.json content as dict
            project_id: Project identifier

        Returns:
            JSON string for metadata.json
        """
        composition_id = project_id.replace("_", "-")
        total_frames = scenes_data.get("totalFrames", 1800)
        fps_val = scenes_data.get("fps", 30)
        width_val = scenes_data.get("width", 1920)
        height_val = scenes_data.get("height", 1080)

        scenes = scenes_data.get("scenes", [])
        visuals = []
        for scene in scenes:
            frames = scene.get("frames", [0, total_frames])
            start_frame = frames[0] if len(frames) > 0 else 0
            end_frame = frames[1] if len(frames) > 1 else total_frames
            start_ms = int(start_frame / fps_val * 1000)
            end_ms = int(end_frame / fps_val * 1000)
            visuals.append({
                "startMs": start_ms,
                "endMs": end_ms,
                "type": "generated",
                "description": scene.get("name", "AI-generated visual"),
                "displayMode": scene.get("displayMode", "default"),
            })

        if not visuals:
            visuals = [{
                "startMs": 0,
                "endMs": int(total_frames / fps_val * 1000),
                "type": "generated",
                "description": "AI-generated visual",
            }]

        metadata = {
            "compositionId": composition_id,
            "durationInFrames": total_frames,
            "fps": fps_val,
            "width": width_val,
            "height": height_val,
            "visuals": visuals,
        }
        return json.dumps(metadata, indent=2)

    async def _run_scene_agent(
        self,
        scene_num: int,
        scene_system: str,
        scene_user_msg: str,
        mcp_servers: dict,
        bash_security_hook,
        label: str = "",
    ) -> None:
        """Spawn a scene agent (Opus) to implement a single scene file.

        Args:
            scene_num: 1-based scene number
            scene_system: Full system prompt (base + mode-specific rules)
            scene_user_msg: User message with scene data and context
            mcp_servers: MCP server configuration dict
            bash_security_hook: PreToolUse hook for Bash safety
            label: Optional label suffix for tool logging (e.g. "Retry")
        """
        tag = f"Scene{scene_num}{' ' + label if label else ''}"
        client = ClaudeSDKClient(
            options=ClaudeAgentOptions(
                model=self.model,
                system_prompt={
                    "type": "preset",
                    "preset": "claude_code",
                    "append": scene_system,
                },
                cwd=str(self.workspace),
                max_turns=40,
                max_thinking_tokens=self.max_thinking_tokens,
                max_buffer_size=10 * 1024 * 1024,  # 10MB — MCP tool results (icons, screenshots) can be large
                allowed_tools=[
                    "Read", "Write", "Edit", "Glob", "Grep", "Bash", "Skill",
                    "mcp__freepik__search_icons",
                    "mcp__freepik__get_icon_detail_by_id",
                    "mcp__freepik__download_icon_by_id",
                    "mcp__freepik__search_resources",
                    "mcp__freepik__get_resource_detail_by_id",
                    "mcp__freepik__download_resource_by_id",
                    "mcp__better-icons__search_icons",
                    "mcp__better-icons__get_icon",
                    "mcp__better-icons__recommend_icons",
                    "mcp__better-icons__find_similar_icons",
                    "mcp__assets__download_file",
                    "mcp__assets__screenshot",
                    "mcp__assets__search_unsplash",
                    "mcp__assets__search_pexels",
                    "mcp__assets__download_stock_photo",
                    "mcp__assets__get_speaker_grid",
                    "mcp__viewport__get_scene_dimensions",
                    "mcp__viewport__validate_scene_code",
                ],
                mcp_servers=mcp_servers,
                permission_mode="bypassPermissions",
                setting_sources=["project"],
                hooks={
                    "PreToolUse": [
                        HookMatcher(matcher="Bash", hooks=[bash_security_hook]),
                    ],
                },
                cli_path=CLAUDE_CLI_PATH,
            )
        )

        async with client:
            await client.query(scene_user_msg)

            async for msg in client.receive_response():
                msg_type = type(msg).__name__
                if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__
                        if block_type == "TextBlock" and hasattr(block, "text"):
                            try:
                                print(block.text[:200], end="", flush=True)
                            except UnicodeEncodeError:
                                pass
                        elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                            print(f"\n[{tag} Tool: {block.name}]", flush=True)

    async def _run_animator_sequential(
        self,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
        style_preset: str = "studio-dark",
        skip_scenes: set[int] | None = None,
    ) -> dict[str, Any]:
        """
        Phase 2 (Parallel): Implement scenes via SDK subagents.

        Instead of a single monolithic Animator agent, this pipeline:
        - Runs a SETUP agent to create constants.ts and shared components
        - Dispatches a coordinator agent that spawns scene-generator subagents
          in parallel (one per scene) via the Task tool
        - Validates TypeScript after all scenes complete
        - Assembles index.tsx and metadata.json via Python codegen
        - Runs a composition verification pass

        Raises RuntimeError on critical failure (e.g. setup fails).

        Args:
            width: Video width
            height: Video height
            duration_frames: Total frames
            fps: Frames per second

        Returns:
            dict with success status
        """
        from prompts.animator import (
            ANIMATOR_BASE_PROMPT,
            ANIMATOR_SETUP_PROMPT,
            ANIMATOR_SCENE_PROMPT_TEMPLATE,
            get_display_mode_rules,
            build_setup_user_message,
            build_scene_user_message,
            build_scene_task_prompt,
            get_studio_section,
        )
        from claude_agent_sdk import AgentDefinition

        print("[ClaudeGenerator] Phase 2 (Parallel): Implementing scenes via subagents...")

        # Studio design system section (only injected for studio preset)
        studio_section = get_studio_section(style_preset)

        # Read scenes.json and SCENE_PLAN.md
        scenes_json_path = self.src_dir / "scenes.json"
        scene_plan_path = self.src_dir / "SCENE_PLAN.md"

        with open(scenes_json_path, "r", encoding="utf-8") as f:
            scenes_data = json.load(f)
        with open(scene_plan_path, "r", encoding="utf-8") as f:
            scene_plan_content = f.read()

        scenes = scenes_data.get("scenes", [])
        total_scenes = len(scenes)

        # ── CHECKPOINT DETECTION ──
        # Check which phases are already completed from a previous run
        constants_path = self.src_dir / "constants.ts"
        scenes_dir = self.src_dir / "scenes"
        existing_scenes: set[int] = set()
        if scenes_dir.exists():
            for f in scenes_dir.iterdir():
                if f.suffix == ".tsx" and f.stem.startswith("Scene"):
                    try:
                        scene_num = int(f.stem[5:])  # "Scene3" → 3
                        # Verify it's not empty (> 100 bytes = has real content)
                        if f.stat().st_size > 100:
                            existing_scenes.add(scene_num)
                    except (ValueError, OSError):
                        pass

        # Merge CLI --skip-scenes into existing checkpoint scenes
        if skip_scenes:
            print(f"[ClaudeGenerator] CLI --skip-scenes: treating scenes {sorted(skip_scenes)} as already done")
            existing_scenes |= skip_scenes

        setup_exists = constants_path.exists() and constants_path.stat().st_size > 50
        all_scene_nums = set(range(1, total_scenes + 1))
        missing_scenes_set = all_scene_nums - existing_scenes

        if setup_exists and existing_scenes:
            print(f"[ClaudeGenerator] CHECKPOINT RESUME: Setup done, {len(existing_scenes)}/{total_scenes} scenes exist. Missing: {sorted(missing_scenes_set) or 'none'}")
        elif setup_exists:
            print(f"[ClaudeGenerator] CHECKPOINT RESUME: Setup done, no scenes yet")

        # Skills directive (agent reads full content via Skill tool on demand)
        skills_directive = get_skills_directive()

        # MCP servers config (uses pre-installed local binaries)
        mcp_servers = build_mcp_servers(str(self.workspace))

        # Inject user-provided assets summary for sequential pipeline
        user_assets_section = ""
        user_assets_path = self.src_dir / "user_assets.json"
        if user_assets_path.exists():
            try:
                user_assets_data = json.loads(user_assets_path.read_text(encoding="utf-8"))
                if user_assets_data.get("assets"):
                    asset_lines = []
                    for a in user_assets_data["assets"]:
                        asset_lines.append(f"- **{a['label']}**: `staticFile('{a['remotionPath']}')` ({a['contentType']})")
                    user_assets_section = f"\n\n## USER-PROVIDED ASSETS\n\nThe user uploaded these custom assets. ALWAYS prefer them over Freepik/Iconify when they match.\n\n" + "\n".join(asset_lines)
                    print(f"[ClaudeGenerator] Injected {len(asset_lines)} user asset(s) into sequential pipeline prompts")
            except Exception as e:
                print(f"[ClaudeGenerator] Warning: Failed to read user_assets.json: {e}")

        # ── Phase 2a: SETUP ──
        if setup_exists:
            print(f"[ClaudeGenerator] Skipping Setup phase — constants.ts already exists")
            emit_progress(40, "Resuming — setup already done", {"phase": "workspace", "phaseName": "Setting up workspace"})
            constants_content = constants_path.read_text(encoding="utf-8")
            components_dir = self.src_dir / "components"
            components_list = (
                [f.name for f in components_dir.iterdir() if f.suffix == ".tsx"]
                if components_dir.exists()
                else []
            )
        else:
            emit_progress(38, "Setting up project foundation...", {"phase": "workspace", "phaseName": "Setting up workspace"})
            setup_system = f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{skills_directive}\n\n{ANIMATOR_SETUP_PROMPT}{user_assets_section}"
            setup_message = build_setup_user_message(self.project_id)

            # Inject resolved template source for studio preset
            if get_theme(style_preset) and self._resolved_templates_md:
                setup_message += f"\n\n{self._resolved_templates_md}"
                safe_print(f"[ClaudeGenerator] Injected {len(self._resolved_templates_md)} chars of resolved template source into Setup prompt")

            # Spawn setup agent (Opus for quality)
            setup_client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model=self.model,
                    max_thinking_tokens=self.max_thinking_tokens,
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": setup_system,
                    },
                    cwd=str(self.workspace),
                    max_turns=30,
                    max_buffer_size=10 * 1024 * 1024,  # 10MB
                    allowed_tools=[
                        "Read", "Write", "Edit", "Glob", "Bash", "Skill",
                        "mcp__viewport__get_scene_dimensions",
                    ],
                    mcp_servers={"viewport": mcp_servers["viewport"]},
                    permission_mode="bypassPermissions",
                    setting_sources=["project"],
                    hooks={
                        "PreToolUse": [
                            HookMatcher(matcher="Bash", hooks=[bash_security_hook]),
                        ],
                    },
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            async with setup_client:
                await setup_client.query(setup_message)

                async for msg in setup_client.receive_response():
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "TextBlock" and hasattr(block, "text"):
                                try:
                                    print(block.text[:200], end="", flush=True)
                                except UnicodeEncodeError:
                                    safe_text = block.text.encode("ascii", errors="replace").decode("ascii")
                                    print(safe_text[:200], end="", flush=True)
                            elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[Setup Tool: {block.name}]", flush=True)

            # Verify constants.ts exists
            if not constants_path.exists():
                raise RuntimeError("Setup failed: constants.ts not created")

            constants_content = constants_path.read_text(encoding="utf-8")

            # List available components
            components_dir = self.src_dir / "components"
            components_list = (
                [f.name for f in components_dir.iterdir() if f.suffix == ".tsx"]
                if components_dir.exists()
                else []
            )

            emit_progress(40, "Project foundation ready", {"phase": "workspace", "phaseName": "Setting up workspace"})

        # ── Phase 2b: PARALLEL SCENE GENERATION via coordinator + subagents ──
        scenes_dir = self.src_dir / "scenes"
        scenes_dir.mkdir(exist_ok=True)

        # Determine which scenes need generation (checkpoint-aware)
        scenes_to_generate = []
        for i, scene in enumerate(scenes):
            scene_num = i + 1
            if scene_num in existing_scenes:
                print(f"[ClaudeGenerator] Skipping Scene {scene_num} — already exists from checkpoint")
                continue
            scenes_to_generate.append((i, scene_num, scene))

        if not scenes_to_generate:
            print(f"[ClaudeGenerator] All {total_scenes} scenes already exist — skipping to validation")
            emit_progress(50, f"All {total_scenes} scenes restored from checkpoint", {"phase": "animate", "phaseName": "Animating scenes", "scene": total_scenes, "totalScenes": total_scenes})
        else:
            scenes_to_dispatch = len(scenes_to_generate)
            emit_progress(40, f"Animating {scenes_to_dispatch} of {total_scenes} scenes...", {"phase": "animate", "phaseName": "Animating scenes", "totalScenes": total_scenes})
            print(f"\n[ClaudeGenerator] Phase 2b: Dispatching {scenes_to_dispatch} scene-generator subagents ({total_scenes - scenes_to_dispatch} from checkpoint)...")

            # Build the scene-generator subagent definition (+ studio design system when applicable)
            scene_gen_system = (
                f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{remotion_libraries}\n\n{condensed_skills}"
            )

            scene_gen_tools = [
                "Read", "Write", "Edit", "Glob", "Grep", "Bash",
                "mcp__freepik__search_icons",
                "mcp__freepik__get_icon_detail_by_id",
                "mcp__freepik__download_icon_by_id",
                "mcp__freepik__search_resources",
                "mcp__freepik__get_resource_detail_by_id",
                "mcp__freepik__download_resource_by_id",
                "mcp__better-icons__search_icons",
                "mcp__better-icons__get_icon",
                "mcp__better-icons__recommend_icons",
                "mcp__better-icons__find_similar_icons",
                "mcp__assets__download_file",
                "mcp__assets__screenshot",
                "mcp__assets__search_unsplash",
                "mcp__assets__search_pexels",
                "mcp__assets__download_stock_photo",
                "mcp__assets__get_speaker_grid",
                "mcp__viewport__get_scene_dimensions",
                "mcp__viewport__validate_scene_code",
            ]

            agents = {
                "scene-generator": AgentDefinition(
                    description=(
                        "Generates a single Remotion scene file (scenes/SceneN.tsx). "
                        "Receives scene data in the task prompt, reads constants.ts "
                        "and SCENE_PLAN.md from disk, writes the .tsx file, validates "
                        "TypeScript, and self-heals any compilation errors."
                    ),
                    prompt=scene_gen_system,
                    tools=scene_gen_tools,
                ),
            }

            # Build compact per-scene task prompts only for missing scenes
            scene_task_entries = ""
            scene_nums_to_dispatch = []
            for i, scene_num, scene in scenes_to_generate:
                task_prompt = build_scene_task_prompt(
                    self.project_id, scene_num, scene.get("displayMode", "default"),
                    scene_data=scene,
                    style_preset=style_preset,
                )
                scene_task_entries += f"### Scene {scene_num}\n<scene_{scene_num}_task>\n{task_prompt}\n</scene_{scene_num}_task>\n\n"
                scene_nums_to_dispatch.append(scene_num)

            # Batch scenes into groups of 6 to avoid overwhelming the system
            MAX_PARALLEL = 6
            num_batches = math.ceil(scenes_to_dispatch / MAX_PARALLEL)
            batch_instructions = ""
            for batch_idx in range(num_batches):
                start = batch_idx * MAX_PARALLEL
                end = min((batch_idx + 1) * MAX_PARALLEL, scenes_to_dispatch)
                batch_scene_nums = scene_nums_to_dispatch[start:end]
                batch_instructions += f"**Batch {batch_idx + 1}:** Dispatch scenes {', '.join(str(s) for s in batch_scene_nums)} — make {len(batch_scene_nums)} Task tool calls in ONE response. Wait for ALL to complete before starting the next batch.\n"

            coordinator_user_msg = f"""You are the Animation Coordinator. Dispatch {scenes_to_dispatch} scene-generator subagents in batches of {MAX_PARALLEL}.

IMPORTANT: Do NOT dispatch all {scenes_to_dispatch} scenes at once. Follow this batching plan:
{batch_instructions}
{scene_task_entries}

After ALL batches complete, run: ls src/{self.project_id}/scenes/
Report which scenes were created.
"""

            # Increase MCP initialization timeout for the coordinator: Freepik's
            # remote MCP server is network-dependent and can exceed the default 60s.
            prev_timeout = os.environ.get("CLAUDE_CODE_STREAM_CLOSE_TIMEOUT")
            os.environ["CLAUDE_CODE_STREAM_CLOSE_TIMEOUT"] = "120000"

            # CRITICAL: permission_mode="bypassPermissions" is required so subagents
            # inherit it and can use Write/Edit tools. Without this, subagents default
            # to "default" mode which denies tool use without a canUseTool callback.
            # See: platform.claude.com/docs/en/agent-sdk/permissions
            coordinator_client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model=self.model,
                    max_thinking_tokens=2000,  # Coordinator only dispatches tasks
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": f"You are an animation coordinator. Your ONLY job is to dispatch scene-generator subagents via the Task tool in batches. You must NOT implement scenes yourself. Do NOT use Write or Edit. After each batch completes, use Glob to verify the expected scene files were created (e.g., `src/{self.project_id}/scenes/Scene*.tsx`). If any are missing, report which ones failed. Dispatch each batch in a single response, then wait for all tasks in that batch to complete before starting the next batch.",
                    },
                    cwd=str(self.workspace),
                    max_turns=scenes_to_dispatch + num_batches * 2 + 4,
                    max_buffer_size=10 * 1024 * 1024,  # 10MB — subagent results can be large
                    permission_mode="bypassPermissions",
                    allowed_tools=["Bash", "Task", "Read", "Glob"],
                    agents=agents,
                    mcp_servers=mcp_servers,
                    hooks={
                        "PreToolUse": [
                            HookMatcher(matcher="Bash", hooks=[bash_security_hook]),
                        ],
                    },
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            try:
                async with coordinator_client:
                    await coordinator_client.query(coordinator_user_msg)

                    async for msg in coordinator_client.receive_response():
                        msg_type = type(msg).__name__
                        if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                            for block in msg.content:
                                block_type = type(block).__name__
                                if block_type == "TextBlock" and hasattr(block, "text"):
                                    try:
                                        print(block.text[:200], end="", flush=True)
                                    except UnicodeEncodeError:
                                        safe_text = block.text.encode("ascii", errors="replace").decode("ascii")
                                        print(safe_text[:200], end="", flush=True)
                                elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                                    print(f"\n[Coordinator Tool: {block.name}]", flush=True)
            finally:
                # Restore original timeout
                if prev_timeout is not None:
                    os.environ["CLAUDE_CODE_STREAM_CLOSE_TIMEOUT"] = prev_timeout
                else:
                    os.environ.pop("CLAUDE_CODE_STREAM_CLOSE_TIMEOUT", None)

        # Post-dispatch: verify all scene files exist, retry missing ones sequentially
        missing_scenes = []
        for i in range(total_scenes):
            scene_file = self.src_dir / "scenes" / f"Scene{i + 1}.tsx"
            if not scene_file.exists():
                missing_scenes.append(i + 1)

        if missing_scenes:
            print(f"[ClaudeGenerator] WARNING: Missing scene files after dispatch (including checkpoint): {missing_scenes}")
            for scene_num in missing_scenes:
                i = scene_num - 1
                scene = scenes[i]
                display_mode = scene.get("displayMode", "default")
                eff = scene.get("effectiveDimensions", {})
                ew = eff.get("width", 1080)
                eh = eff.get("height", 960)
                mode_rules = get_display_mode_rules(display_mode, ew, eh)
                scene_prompt_filled = ANIMATOR_SCENE_PROMPT_TEMPLATE.format(
                    scene_number=scene_num,
                    display_mode_rules=mode_rules,
                    project_id=self.project_id,
                )
                scene_system = f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{remotion_libraries}\n\n{condensed_skills}\n\n{scene_prompt_filled}{user_assets_section}"
                scene_user_msg = build_scene_user_message(
                    project_id=self.project_id,
                    scene_index=i,
                    scene_data=scene,
                    total_scenes=total_scenes,
                    constants_content=constants_content,
                    components_list=components_list,
                    scene_plan_content=scene_plan_content,
                    display_mode=display_mode,
                )
                # Inject resolved template source for studio preset retries
                if get_theme(style_preset) and self._resolved_templates_md:
                    scene_user_msg += f"\n\n{self._resolved_templates_md}"
                print(f"[ClaudeGenerator] Retrying Scene {scene_num} individually...")
                await self._run_scene_agent(
                    scene_num=scene_num,
                    scene_system=scene_system,
                    scene_user_msg=scene_user_msg,
                    mcp_servers=mcp_servers,
                    bash_security_hook=bash_security_hook,
                    label="Retry",
                )

        # TypeScript validation on all scenes
        emit_progress(50, "Validating TypeScript...", {"phase": "animate", "phaseName": "Animating scenes", "totalScenes": total_scenes})
        ts_success, ts_errors = await self._verify_typescript()
        if not ts_success:
            print("[ClaudeGenerator] TypeScript errors after scene generation, running self-heal...")
            await self._run_self_heal(ts_errors)

        emit_progress(52, f"{total_scenes} scenes generated", {"phase": "animate", "phaseName": "Animating scenes", "scene": total_scenes, "totalScenes": total_scenes})

        # Re-read constants_content in case self-heal modified constants.ts
        constants_content = constants_path.read_text(encoding="utf-8")

        # ── Phase 2b+: PER-SCENE VERIFICATION ──
        emit_progress(53, "Verifying scenes against plan...", {"phase": "verify", "phaseName": "Verifying scenes"})
        print("\n[ClaudeGenerator] Phase 2b+: Running per-scene verification...")

        verify_tasks = [
            self._verify_and_fix_scene_code(
                scene_num=i + 1,
                scene_data=scene,
                scene_plan_content=scene_plan_content,
                constants_content=constants_content,
                studio_section=studio_section,
                remotion_libraries=remotion_libraries,
            )
            for i, scene in enumerate(scenes)
        ]
        verify_results = await asyncio.gather(*verify_tasks, return_exceptions=True)
        success_count = 0
        for i, result in enumerate(verify_results):
            if isinstance(result, Exception):
                print(f"[ClaudeGenerator] Scene {i+1} verify/fix exception: {result}")
            elif result[0]:
                success_count += 1
        print(f"[ClaudeGenerator] Phase 2b+: {success_count}/{len(scenes)} scenes passed verification")

        emit_progress(54, "Scene verification done", {"phase": "verify", "phaseName": "Verifying scenes"})

        # ── Phase 2c: ASSEMBLY ──
        emit_progress(55, "Assembling composition...", {"phase": "bundle", "phaseName": "Bundling for preview"})
        print("\n[ClaudeGenerator] Assembling index.tsx and metadata.json...")

        # Pre-assembly validation
        constants_text = constants_path.read_text(encoding="utf-8")

        # Check TIMING keys exist for all scenes
        missing_timing = []
        for i in range(total_scenes):
            n = i + 1
            for key in [f"scene{n}Start", f"scene{n}End"]:
                if f"TIMING.{key}" not in constants_text and key not in constants_text:
                    missing_timing.append(key)
        if missing_timing:
            print(f"[ClaudeGenerator] WARNING: constants.ts missing TIMING keys: {missing_timing}")

        # Verify scene exports
        for i in range(total_scenes):
            scene_file = self.src_dir / "scenes" / f"Scene{i + 1}.tsx"
            if scene_file.exists():
                scene_code = scene_file.read_text(encoding="utf-8")
                if f"export const Scene{i + 1}" not in scene_code:
                    print(f"[ClaudeGenerator] WARNING: Scene{i + 1}.tsx missing 'export const Scene{i + 1}'")

        # Generate index.tsx
        index_content = self._generate_index_tsx(scenes, self.project_id)
        index_path = self.src_dir / "index.tsx"
        index_path.write_text(index_content, encoding="utf-8")

        # Generate metadata.json
        metadata_content = self._generate_metadata_json(scenes_data, self.project_id)
        metadata_path = self.src_dir / "metadata.json"
        metadata_path.write_text(metadata_content, encoding="utf-8")

        # Final tsc on index.tsx
        ts_success, ts_errors = await self._verify_typescript_file(
            str(index_path.relative_to(self.workspace))
        )
        if not ts_success:
            print("[ClaudeGenerator] index.tsx has TS errors, running self-heal...")
            await self._run_self_heal(ts_errors)
            ts_success, ts_errors = await self._verify_typescript_file(
                str(index_path.relative_to(self.workspace))
            )

        # ── Phase 2d: COMPOSITION VERIFY ──
        emit_progress(57, "Verifying composition...", {"phase": "verify", "phaseName": "Verifying scenes"})

        comp_passed, comp_issues = await self._run_composition_verify(
            project_id=self.project_id,
            scenes_data=scenes_data,
            plan_content=scene_plan_content,
        )

        if not comp_passed:
            # Separate critical issues (bundle/import failures) from warnings.
            # Use specific error patterns to avoid false positives from words
            # like "import" appearing in stylistic suggestions.
            _critical_patterns = [
                "bundle fail", "bundle error", "cannot find module",
                "module not found", "import error", "missing import",
                "failed to compile", "compilation error", "syntax error",
            ]
            critical_issues = [
                issue for issue in comp_issues
                if any(pat in issue.lower() for pat in _critical_patterns)
            ]
            warning_issues = [
                issue for issue in comp_issues
                if issue not in critical_issues
            ]

            if warning_issues:
                print(f"[ClaudeGenerator] Composition warnings (non-blocking): {warning_issues}")

            if critical_issues:
                print(f"[ClaudeGenerator] Composition CRITICAL issues: {critical_issues}")
                # Run self-heal to try to fix critical issues
                ts_success, ts_errors = await self._verify_typescript()
                if not ts_success:
                    await self._run_self_heal(ts_errors)

        emit_progress(58, "All scenes implemented", {"phase": "animate", "phaseName": "Animating scenes"})

        # Verify final output
        if not index_path.exists():
            return {"success": False, "error": "Sequential animator did not create index.tsx"}

        return {
            "success": True,
            "indexPath": str(index_path),
            "pipeline": "sequential",
        }

    async def generate_two_phase(
        self,
        transcript: str,
        words: list[dict] | None = None,
        width: int = 1920,
        height: int = 1080,
        duration_frames: int = 1800,
        fps: int = 30,
        timeout_seconds: int = 2400,  # 40 minutes for two phases
        max_retries: int = 2,
        style_preset: str = "studio-dark",
        layout_mode: str = "pip",
        style_guide: str | None = None,
        source_width: int | None = None,
        source_height: int | None = None,
        safe_placement: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Generate video using two-phase pipeline: Director + Animator.

        Phase 1 (Director): Analyzes transcript, creates scene plan
        Phase 2 (Animator): Implements plan scene-by-scene with TODO tracking

        Args:
            transcript: Plain text transcript
            words: Optional word-level timestamps from WhisperX
            width: Video width in pixels
            height: Video height in pixels
            duration_frames: Total duration in frames
            fps: Frames per second
            timeout_seconds: Total timeout for both phases
            max_retries: Retry attempts per phase
            style_preset: Visual style preset (studio-dark, studio-light)
            layout_mode: Layout mode (pip, stacked)
            style_guide: Optional user-provided style/layout guidance
            source_width: Source video width (for coverage-tier display mode guidance)
            source_height: Source video height (for coverage-tier display mode guidance)

        Returns:
            dict with success status and bundle URL
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

        # Ensure OAuth token is valid before starting (auto-refreshes if needed)
        try:
            manager = get_token_manager()
            await manager.get_valid_token()
            print("[ClaudeGenerator] OAuth token validated/refreshed successfully")
        except Exception as e:
            print(f"[ClaudeGenerator] WARNING: OAuth token refresh failed: {e}")
            # Continue anyway - the Claude SDK might still work with cached credentials

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

                # Check if previous attempt left valid source files (BullMQ retry recovery).
                # If index.tsx, metadata.json, and scenes.json all exist, skip Director + Animator
                # and jump straight to TS verification + bundling.
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
                    # Read scene count from existing scenes.json for logging
                    try:
                        with open(scenes_path, "r", encoding="utf-8") as f:
                            existing_scenes = json.load(f)
                        scene_count = len(existing_scenes.get("scenes", []))
                        print(f"[ClaudeGenerator] Resuming with {scene_count} existing scenes")
                    except Exception:
                        scene_count = 0

                    # Animator result not needed — we already have the code
                    animator_result = {"success": True}
                else:
                    # Preserve existing artifacts for checkpoint resume instead of wiping.
                    # The Node.js processor already handles plan-change detection via
                    # .plan_job_id marker and cleans stale artifacts when the plan changes.
                    if not self.src_dir.exists():
                        self.src_dir.mkdir(parents=True)

                    # Create public/assets directory for Freepik asset downloads
                    assets_dir = self.workspace / "public" / "assets"
                    assets_dir.mkdir(parents=True, exist_ok=True)

                    # Format transcript with timestamps if available
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

                    # Phase 1.5: Fetch images for scenes
                    emit_progress(36, "Fetching images for scenes...", {"phase": "workspace", "phaseName": "Setting up workspace"})
                    image_count = await self._fetch_scene_images()
                    if image_count > 0:
                        emit_progress(37, f"Downloaded {image_count} images", {"phase": "workspace", "phaseName": "Setting up workspace"})

                    # Resolve selected studio templates from registry (after Director, before Animator)
                    self._resolve_studio_templates(style_preset)

                    emit_progress(38, f"Animator implementing {scene_count} scenes...", {"phase": "animate", "phaseName": "Animating scenes", "totalScenes": scene_count})

                    # Phase 2: Animator — sequential scene generation
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

                # Self-healing loop: try to fix TypeScript errors up to 3 times
                heal_attempts = 0
                max_heal_attempts = 3
                while not ts_success and heal_attempts < max_heal_attempts:
                    heal_attempts += 1
                    emit_progress(58 + heal_attempts, f"Fixing TypeScript errors (attempt {heal_attempts}/{max_heal_attempts})...", {"phase": "self_heal", "phaseName": "Fixing errors", "iteration": heal_attempts, "maxIterations": max_heal_attempts})
                    print(f"[ClaudeGenerator] TypeScript failed, self-healing attempt {heal_attempts}/{max_heal_attempts}...")

                    # Run a mini-healing agent to fix the errors
                    heal_success = await self._run_self_heal(ts_errors)
                    if not heal_success:
                        print(f"[ClaudeGenerator] Self-heal agent failed")
                        break

                    # Re-verify
                    ts_success, ts_errors = await self._verify_typescript()

                if not ts_success:
                    raise RuntimeError(f"TypeScript validation failed after {heal_attempts} self-heal attempts")

                print(f"[ClaudeGenerator] TypeScript validation passed")

                # Check for missing interpolate clamp options (catastrophic visual bug prevention)
                clamp_warnings = self._validate_interpolate_clamping()
                if clamp_warnings:
                    print(f"[ClaudeGenerator] Found {len(clamp_warnings)} interpolate() calls missing clamp:")
                    for w in clamp_warnings:
                        print(f"  - {w}")
                    # Auto-fix: run self-heal with the clamp warnings as "errors"
                    clamp_error_msg = (
                        "CRITICAL: The following interpolate() calls are missing extrapolateLeft: 'clamp' "
                        "and/or extrapolateRight: 'clamp'. BOTH are required on EVERY interpolate() call. "
                        "Without both, values extrapolate linearly beyond the range, causing catastrophic "
                        "visual bugs (e.g. scale: 13x, opacity: 85).\n\n"
                        + "\n".join(clamp_warnings)
                        + "\n\nFix ALL of them by adding the missing clamp option(s)."
                    )
                    await self._run_self_heal(clamp_error_msg)
                    # Re-verify TypeScript after clamp fixes
                    ts_success, ts_errors = await self._verify_typescript()
                    if not ts_success:
                        print(f"[ClaudeGenerator] TypeScript broke after clamp fix, self-healing...")
                        await self._run_self_heal(ts_errors)

                emit_progress(62, "TypeScript validation passed", {"phase": "bundle", "phaseName": "Bundling for preview"})

                # Create metadata.json if not exists
                metadata_json = self.src_dir / "metadata.json"
                if not metadata_json.exists():
                    print("[ClaudeGenerator] Creating fallback metadata.json...")
                    # Composition ID must use dashes (Remotion requirement)
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

                # Validate metadata dimensions (catches dimension flips)
                self._validate_metadata(width, height)

                # Fix composition ID (must use dashes, not underscores - Remotion requirement)
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
                    )
                    emit_progress(64, "Visual verification complete", {"phase": "verify", "phaseName": "Verifying scenes"})
                except Exception as e:
                    print(f"[ClaudeGenerator] Phase 2e failed (non-blocking): {e}")
                    emit_progress(64, "Visual verification skipped (error)", {"phase": "verify", "phaseName": "Verifying scenes"})

                # Bundle
                emit_progress(65, "Bundling Remotion project...", {"phase": "bundle", "phaseName": "Bundling for preview"})
                print(f"[ClaudeGenerator] Bundling project...")
                bundle_path = await self._run_bundle()
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

    async def _fix_composition_id(self, index_tsx: Path, expected_id: str) -> None:
        """
        Ensure the Composition id in index.tsx and metadata.json use dashes (Remotion requirement).
        The agent sometimes uses underscores or descriptive names instead of the correct format.

        Remotion only allows: a-z, A-Z, 0-9, CJK characters and -
        Underscores are NOT allowed.
        """
        import re

        # Ensure expected_id uses dashes (defensive check)
        expected_id = expected_id.replace("_", "-")

        # Fix index.tsx
        content = index_tsx.read_text(encoding="utf-8")

        # Find all Composition id= values
        pattern = r'<Composition\s+id="([^"]+)"'
        matches = re.findall(pattern, content)

        if not matches:
            print(f"[ClaudeGenerator] Warning: No Composition found in index.tsx")
        else:
            current_id = matches[0]
            if current_id == expected_id:
                print(f"[ClaudeGenerator] Composition ID is correct: {current_id}")
            else:
                # Replace the composition ID
                print(f"[ClaudeGenerator] Fixing composition ID in index.tsx: {current_id} -> {expected_id}")
                new_content = re.sub(
                    r'(<Composition\s+id=")([^"]+)(")',
                    f'\\g<1>{expected_id}\\g<3>',
                    content,
                    count=1  # Only replace the first one
                )
                index_tsx.write_text(new_content, encoding="utf-8")

        # Fix metadata.json
        metadata_json = self.src_dir / "metadata.json"
        if metadata_json.exists():
            try:
                with open(metadata_json, encoding="utf-8") as f:
                    metadata = json.load(f)

                current_comp_id = metadata.get("compositionId", "")
                if current_comp_id != expected_id:
                    print(f"[ClaudeGenerator] Fixing compositionId in metadata.json: {current_comp_id} -> {expected_id}")
                    metadata["compositionId"] = expected_id
                    with open(metadata_json, "w", encoding="utf-8") as f:
                        json.dump(metadata, f, indent=2)
                else:
                    print(f"[ClaudeGenerator] metadata.json compositionId is correct: {current_comp_id}")
            except Exception as e:
                print(f"[ClaudeGenerator] Warning: Could not fix metadata.json: {e}")


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

        # Check for missing interpolate clamp options (catastrophic visual bug prevention)
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

        # Validate metadata dimensions (catches dimension flips)
        generator._validate_metadata(args.width, args.height)

        # Fix composition ID
        index_tsx = generator.src_dir / "index.tsx"
        composition_id_with_dashes = args.project_id.replace("_", "-")
        await generator._fix_composition_id(index_tsx, composition_id_with_dashes)

        # Bundle
        heartbeat.update('bundle', 'Remotion bundling')
        emit_progress(65, "Bundling Remotion project...", {"phase": "bundle", "phaseName": "Bundling for preview"})
        print("[ClaudeGenerator] Bundling project...")
        bundle_path = await generator._run_bundle()
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
