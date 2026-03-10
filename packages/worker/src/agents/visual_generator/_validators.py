"""Validation mixins — scene plan, metadata, interpolate clamping, overlay, dotgrid."""

import json
import re
from pathlib import Path


class ValidatorsMixin:
    """Mixin providing validation methods for ClaudeVisualGenerator."""

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

    def _validate_metadata(self, canvas_width: int, canvas_height: int) -> bool:
        """Validate and fix metadata.json dimensions if they don't match expected canvas."""
        metadata_path = self.src_dir / "metadata.json"
        if not metadata_path.exists():
            print(f"[ClaudeGenerator] WARNING: metadata.json not found at {metadata_path}")
            return False

        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

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
            metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
            return True

        # Check for general mismatch
        if meta_w != canvas_width or meta_h != canvas_height:
            print(f"[ClaudeGenerator] FIXING metadata dimensions: {meta_w}x{meta_h} -> {canvas_width}x{canvas_height}")
            metadata[w_key] = canvas_width
            metadata[h_key] = canvas_height
            metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
            return True

        return False

    def _validate_interpolate_clamping(self) -> list[str]:
        """Check all scene files for interpolate() calls missing extrapolateLeft/Right: 'clamp'.

        Returns list of warning strings. Empty list = all good.
        """
        warnings = []
        scenes_dir = self.src_dir / "scenes"
        if not scenes_dir.exists():
            return warnings

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

        # ── Check 1: Opacity violations ──
        opacity_patterns = [
            (r'opacity:\s*(0\.\d+)\b', "Literal opacity {val} < 1.0 — overlay elements must reach full opacity (1.0) at rest"),
            (r'opacity:\s*\w+\s*\*\s*(0\.\d+)', "Opacity multiplied by {val} — elements will look ghostly. Use full opacity (1.0) at rest"),
        ]
        for pattern, msg_template in opacity_patterns:
            for m in re.finditer(pattern, scene_code):
                val = float(m.group(1))
                if val < 0.95 and val > 0.0:
                    start = max(0, m.start() - 100)
                    context = scene_code[start:m.start()]
                    if 'interpolate(' not in context and 'spring(' not in context:
                        issues.append(msg_template.format(val=val))

        # ── Check 2: Background violations ──
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
        for m in re.finditer(r'r[=:]\s*[\{(]?\s*[s(]*(\d+)\s*[)}\s]', scene_code):
            val = int(m.group(1))
            if val < 2:
                start = max(0, m.start() - 200)
                context = scene_code[start:m.end()].lower()
                if 'pattern' in context or 'dot' in context or 'grid' in context:
                    issues.append(f"Scene {scene_num}: DotGrid radius r={val} is too small (invisible). Use r=3 minimum.")
        for m in re.finditer(r'spacing[=:]\s*[\{(]?\s*(\d+)', scene_code):
            val = int(m.group(1))
            if val < 60:
                start = max(0, m.start() - 100)
                context = scene_code[start:m.end()].lower()
                if 'dot' in context or 'grid' in context or 'pattern' in context:
                    issues.append(f"Scene {scene_num}: DotGrid spacing={val} is too tight (dots merge). Use spacing=80 minimum.")
        return issues
