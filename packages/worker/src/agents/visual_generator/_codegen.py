"""Codegen mixin — generate index.tsx, metadata.json, fix composition ID."""

import json
import re
from pathlib import Path


class CodegenMixin:
    """Mixin providing code generation methods for ClaudeVisualGenerator."""

    def _generate_index_tsx(self, scenes: list[dict], project_id: str) -> str:
        """Generate the full index.tsx content from scene data.

        Pure Python codegen — assembles imports, Sequences, overlay logic,
        RemotionRoot with Composition, and default export.

        Returns:
            Full index.tsx file content as a string
        """
        composition_id = project_id.replace("_", "-")
        total_scenes = len(scenes)

        scene_imports = "\n".join(
            f"import {{ Scene{i+1} }} from './scenes/Scene{i+1}';"
            for i in range(total_scenes)
        )

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

    async def _fix_composition_id(self, index_tsx: Path, expected_id: str) -> None:
        """Ensure the Composition id in index.tsx and metadata.json use dashes.

        Remotion only allows: a-z, A-Z, 0-9, CJK characters and -
        Underscores are NOT allowed.
        """
        expected_id = expected_id.replace("_", "-")

        content = index_tsx.read_text(encoding="utf-8")

        pattern = r'<Composition\s+id="([^"]+)"'
        matches = re.findall(pattern, content)

        if not matches:
            print(f"[ClaudeGenerator] Warning: No Composition found in index.tsx")
        else:
            current_id = matches[0]
            if current_id == expected_id:
                print(f"[ClaudeGenerator] Composition ID is correct: {current_id}")
            else:
                print(f"[ClaudeGenerator] Fixing composition ID in index.tsx: {current_id} -> {expected_id}")
                new_content = re.sub(
                    r'(<Composition\s+id=")([^"]+)(")',
                    f'\\g<1>{expected_id}\\g<3>',
                    content,
                    count=1
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
