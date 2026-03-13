"""Build pipeline mixin — entry point setup, Remotion bundle, CJS compilation."""

import subprocess
from pathlib import Path

from sdk_config import IS_WINDOWS, safe_print


class BuildPipelineMixin:
    """Mixin providing build/bundle methods for ClaudeVisualGenerator."""

    def _setup_entry_point(
        self,
        width: int = 1080,
        height: int = 1920,
        fps: int = 60,
        duration_frames: int = 1800,
    ) -> str:
        """Set up src/index.tsx to import MainComposition and wrap with correct dimensions.

        Uses infrastructure-known dimensions instead of AI-generated RemotionRoot,
        preventing dimension swap bugs.

        Returns:
            The original index.tsx content (for later restoration).
        """
        index_tsx_path = self.workspace / "src" / "index.tsx"
        index_ts_path = self.workspace / "src" / "index.ts"

        if index_tsx_path.exists():
            original = index_tsx_path.read_text(encoding="utf-8")
        elif index_ts_path.exists():
            original = index_ts_path.read_text(encoding="utf-8")
        else:
            original = ""

        # Remove .ts version — JSX content requires .tsx extension for esbuild
        if index_ts_path.exists():
            index_ts_path.unlink()

        composition_id = self.project_id.replace("_", "-")
        new_index_ts = f'''/**
 * Auto-generated entry point for project: {self.project_id}
 * Dimensions set by infrastructure (not AI-generated).
 */
import {{ registerRoot }} from "remotion";
import {{ Composition }} from "remotion";
import MainComposition from "./{self.project_id}";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="{composition_id}"
    component={{MainComposition}}
    durationInFrames={{{duration_frames}}}
    fps={{{fps}}}
    width={{{width}}}
    height={{{height}}}
  />
);

registerRoot(RemotionRoot);
'''
        index_tsx_path.write_text(new_index_ts)
        print(f"[ClaudeGenerator] Updated src/index.tsx with infrastructure dimensions {width}x{height}")
        return original

    def _restore_entry_point(self, original: str) -> None:
        """Restore the original src/index.ts content (non-JSX template version)."""
        index_tsx_path = self.workspace / "src" / "index.tsx"
        index_ts_path = self.workspace / "src" / "index.ts"
        if index_tsx_path.exists():
            index_tsx_path.unlink()
        index_ts_path.write_text(original)

    async def _run_bundle(
        self,
        width: int = 1080,
        height: int = 1920,
        fps: int = 60,
        duration_frames: int = 1800,
    ) -> Path:
        """Bundle the Remotion project."""
        # TypeScript processor expects dashes, not underscores in bundle path
        bundle_id = self.project_id.replace("_", "-")
        bundle_path = self.bundle_output / bundle_id

        bundle_path.mkdir(parents=True, exist_ok=True)

        original_index_ts = self._setup_entry_point(
            width=width, height=height, fps=fps, duration_frames=duration_frames,
        )

        try:
            result = subprocess.run(
                ["npx", "remotion", "bundle", "--out-dir", str(bundle_path)],
                cwd=str(self.workspace),
                capture_output=True,
                timeout=300,
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
            self._restore_entry_point(original_index_ts)

    async def _compile_cjs(self, bundle_path: Path) -> None:
        """Compile the composition source to CommonJS for dynamic frontend loading."""
        index_tsx = (self.src_dir / "index.tsx").resolve()
        cjs_output = (bundle_path / "composition.cjs.js").resolve()

        if not index_tsx.exists():
            safe_print(f"[ClaudeGenerator] Warning: index.tsx not found, skipping CJS compilation")
            return

        safe_print(f"[ClaudeGenerator] Compiling composition to CJS: {cjs_output}")

        try:
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
            else:
                safe_print(f"[ClaudeGenerator] CJS compilation successful")
                self._add_react_keys_to_cjs(cjs_output)

        except subprocess.TimeoutExpired:
            safe_print(f"[ClaudeGenerator] CJS compilation timed out")
        except Exception as e:
            safe_print(f"[ClaudeGenerator] CJS compilation error: {e}")

    def _add_react_keys_to_cjs(self, cjs_path: Path) -> None:
        """Post-process CJS file to add React keys to children arrays."""
        if not cjs_path.exists():
            return

        content = cjs_path.read_text(encoding="utf-8")
        lines = content.split('\n')
        modified = False
        key_counter = 0

        new_lines = []
        for line in lines:
            if 'import_jsx_runtime.jsx' in line and line.rstrip().endswith('}),'):
                stripped = line.rstrip()
                if not '},  "' in stripped and not '}, "' in stripped:
                    key_counter += 1
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
