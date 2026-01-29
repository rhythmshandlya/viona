"""
Root.tsx Auto-Generator for Remotion Projects.

Scans the src/ directory for composition components and generates
a valid Root.tsx file automatically. This removes the most error-prone
step from the agent's workflow (editing Root.tsx with duplicate content).

Usage:
    from tools.root_generator import generate_root_tsx, scan_compositions

    compositions = scan_compositions("/workspace/src")
    root_content = generate_root_tsx(compositions)
"""

import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class CompositionInfo:
    """Information about a detected Remotion composition."""

    # Component name (e.g., "BubbleSort")
    component_name: str

    # Composition ID (e.g., "bubble-sort" or "BubbleSort")
    composition_id: str

    # Relative import path from Root.tsx (e.g., "./BubbleSort")
    import_path: str

    # Source file path
    source_file: str

    # Detected props (optional)
    default_props: Optional[dict] = None

    # Video configuration
    duration_in_frames: int = 300
    fps: int = 30
    width: int = 1920
    height: int = 1080


# Patterns to detect compositions in TypeScript/TSX files
COMPOSITION_PATTERNS = [
    # Direct Composition component usage
    re.compile(
        r'<Composition[^>]*\s+id=["\']([^"\']+)["\'][^>]*component=\{(\w+)\}',
        re.DOTALL
    ),
    # Composition with component first
    re.compile(
        r'<Composition[^>]*\s+component=\{(\w+)\}[^>]*id=["\']([^"\']+)["\']',
        re.DOTALL
    ),
]

# Pattern to detect exported React components
COMPONENT_EXPORT_PATTERNS = [
    # export const ComponentName = () => ...
    re.compile(r'export\s+const\s+(\w+)\s*[=:][^=].*?(?:React\.FC|FC|=>|\(\))', re.DOTALL),
    # export function ComponentName
    re.compile(r'export\s+function\s+(\w+)\s*\('),
    # export default function ComponentName
    re.compile(r'export\s+default\s+function\s+(\w+)\s*\('),
    # const ComponentName = ... ; export { ComponentName }
    re.compile(r'export\s*\{\s*(\w+)(?:\s+as\s+\w+)?\s*\}'),
]

# Pattern to detect composition config in metadata.json or component
CONFIG_PATTERNS = {
    'duration': re.compile(r'durationInFrames["\']?\s*[=:]\s*(\d+)'),
    'fps': re.compile(r'fps["\']?\s*[=:]\s*(\d+)'),
    'width': re.compile(r'width["\']?\s*[=:]\s*(\d+)'),
    'height': re.compile(r'height["\']?\s*[=:]\s*(\d+)'),
}

# Directories and files to skip
SKIP_DIRS = {'node_modules', '.git', 'build', 'dist', '__pycache__'}
# Only skip Root.tsx (auto-generated) - index.tsx in subdirectories are component entries
SKIP_FILES = {'Root.tsx'}


def scan_compositions(
    src_dir: str,
    project_id: Optional[str] = None
) -> list[CompositionInfo]:
    """
    Scan a directory for Remotion compositions.

    Only looks for main entry points (index.tsx) in direct subdirectories of src/.
    Does NOT recursively scan components/ or other subdirectories to avoid
    picking up helper components.

    Args:
        src_dir: Path to the src/ directory
        project_id: Optional specific project ID to look for.
                    When specified, ONLY returns that composition.

    Returns:
        List of detected CompositionInfo objects
    """
    compositions = []
    src_path = Path(src_dir)

    if not src_path.exists():
        return compositions

    # If project_id is specified, ONLY look for that specific composition
    if project_id:
        project_dir = src_path / project_id
        if project_dir.exists():
            comp = _scan_project_entry(project_dir, src_path)
            if comp:
                compositions.append(comp)
        return compositions

    # Scan immediate subdirectories of src/ for their entry points
    for item in src_path.iterdir():
        if item.is_dir() and item.name not in SKIP_DIRS:
            comp = _scan_project_entry(item, src_path)
            if comp:
                compositions.append(comp)

    # Deduplicate by composition_id
    seen_ids = set()
    unique_compositions = []
    for comp in compositions:
        if comp.composition_id not in seen_ids:
            seen_ids.add(comp.composition_id)
            unique_compositions.append(comp)

    return unique_compositions


def _scan_project_entry(
    project_dir: Path,
    src_root: Path
) -> Optional[CompositionInfo]:
    """
    Scan a project directory for its main composition entry point.

    Looks for index.tsx or a file matching the directory name.
    Does NOT recursively scan subdirectories.
    """
    # Priority 1: index.tsx in the project root
    index_file = project_dir / "index.tsx"
    if index_file.exists():
        try:
            content = index_file.read_text(encoding='utf-8')
            comp = _extract_composition(index_file, content, src_root)
            if comp:
                # Check for metadata.json to get config
                metadata_file = project_dir / 'metadata.json'
                if metadata_file.exists():
                    _update_single_from_metadata(comp, metadata_file)
                return comp
        except (OSError, UnicodeDecodeError):
            pass

    # Priority 2: File matching directory name (e.g., BubbleSort/BubbleSort.tsx)
    dir_name = project_dir.name
    for ext in ['.tsx', '.ts']:
        named_file = project_dir / f"{dir_name}{ext}"
        if named_file.exists():
            try:
                content = named_file.read_text(encoding='utf-8')
                comp = _extract_composition(named_file, content, src_root)
                if comp:
                    metadata_file = project_dir / 'metadata.json'
                    if metadata_file.exists():
                        _update_single_from_metadata(comp, metadata_file)
                    return comp
            except (OSError, UnicodeDecodeError):
                pass

    return None


def _update_single_from_metadata(comp: CompositionInfo, metadata_file: Path):
    """Update a single composition from metadata.json."""
    try:
        import json
        metadata = json.loads(metadata_file.read_text(encoding='utf-8'))

        if 'durationInFrames' in metadata:
            comp.duration_in_frames = metadata['durationInFrames']
        if 'fps' in metadata:
            comp.fps = metadata['fps']
        if 'width' in metadata:
            comp.width = metadata['width']
        if 'height' in metadata:
            comp.height = metadata['height']
    except (json.JSONDecodeError, OSError):
        pass




def _extract_composition(
    file_path: Path,
    content: str,
    src_root: Path
) -> Optional[CompositionInfo]:
    """Extract composition info from a TypeScript/TSX file."""

    # First, check if this file defines a Composition directly
    for pattern in COMPOSITION_PATTERNS:
        match = pattern.search(content)
        if match:
            groups = match.groups()
            # Pattern 1: id first, component second
            # Pattern 2: component first, id second
            if 'id=' in content[:match.start() + 50]:
                comp_id, comp_name = groups[0], groups[1]
            else:
                comp_name, comp_id = groups[0], groups[1]

            return CompositionInfo(
                component_name=comp_name,
                composition_id=comp_id,
                import_path=_get_import_path(file_path, src_root),
                source_file=str(file_path),
                **_extract_config(content)
            )

    # Otherwise, look for exported components that could be compositions
    for pattern in COMPONENT_EXPORT_PATTERNS:
        match = pattern.search(content)
        if match:
            comp_name = match.group(1)

            # Skip common non-composition exports
            if comp_name in ('RemotionRoot', 'Root', 'App', 'default'):
                continue

            # Check if this looks like a video component (uses Remotion hooks)
            if not _is_video_component(content):
                continue

            # Use the component name as the composition ID
            comp_id = _to_composition_id(comp_name)

            return CompositionInfo(
                component_name=comp_name,
                composition_id=comp_id,
                import_path=_get_import_path(file_path, src_root),
                source_file=str(file_path),
                **_extract_config(content)
            )

    return None


def _is_video_component(content: str) -> bool:
    """Check if content uses Remotion video APIs."""
    remotion_indicators = [
        'useCurrentFrame',
        'useVideoConfig',
        'interpolate(',
        'spring(',
        'Sequence',
        'AbsoluteFill',
        'from remotion',
        "from 'remotion'",
    ]
    return any(indicator in content for indicator in remotion_indicators)


def _get_import_path(file_path: Path, src_root: Path) -> str:
    """Get the import path relative to Root.tsx in src/."""
    try:
        rel_path = file_path.relative_to(src_root)
        # Remove .tsx extension and add ./
        import_path = './' + str(rel_path).replace('\\', '/').replace('.tsx', '').replace('.ts', '')
        return import_path
    except ValueError:
        return './' + file_path.stem


def _to_composition_id(component_name: str) -> str:
    """Convert a component name to a composition ID."""
    # Convert PascalCase to kebab-case
    # BubbleSort -> bubble-sort
    result = re.sub(r'([A-Z])', r'-\1', component_name).lower().strip('-')
    return result


def _extract_config(content: str) -> dict:
    """Extract video configuration from content."""
    config = {}

    for key, pattern in CONFIG_PATTERNS.items():
        match = pattern.search(content)
        if match:
            try:
                value = int(match.group(1))
                if key == 'duration':
                    config['duration_in_frames'] = value
                else:
                    config[key] = value
            except ValueError:
                pass

    return config




def generate_root_tsx(
    compositions: list[CompositionInfo],
    include_css_import: bool = True
) -> str:
    """
    Generate Root.tsx content from a list of compositions.

    Args:
        compositions: List of CompositionInfo objects
        include_css_import: Whether to include import "./index.css"

    Returns:
        Complete Root.tsx file content
    """
    if not compositions:
        # Return a minimal valid Root.tsx
        return '''import { Composition } from "remotion";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* No compositions found. Add your composition components here. */}
    </>
  );
};
'''

    # Build imports
    imports = ['import { Composition } from "remotion";']

    if include_css_import:
        imports.append('import "./index.css";')

    # Import each composition component
    for comp in compositions:
        imports.append(f'import {{ {comp.component_name} }} from "{comp.import_path}";')

    # Build composition JSX
    composition_jsx = []
    for comp in compositions:
        jsx = f'''      <Composition
        id="{comp.composition_id}"
        component={{{comp.component_name}}}
        durationInFrames={{{comp.duration_in_frames}}}
        fps={{{comp.fps}}}
        width={{{comp.width}}}
        height={{{comp.height}}}
      />'''
        composition_jsx.append(jsx)

    # Combine into full file
    content = f'''{chr(10).join(imports)}

export const RemotionRoot: React.FC = () => {{
  return (
    <>
{chr(10).join(composition_jsx)}
    </>
  );
}};
'''

    return content


def generate_and_write_root(
    workspace: str,
    project_id: Optional[str] = None
) -> tuple[bool, str, list[CompositionInfo]]:
    """
    Scan for compositions and write Root.tsx.

    Args:
        workspace: Path to the Remotion project workspace
        project_id: Optional specific project ID to prioritize

    Returns:
        Tuple of (success, message, compositions_found)
    """
    src_dir = Path(workspace) / "src"

    if not src_dir.exists():
        return False, f"src/ directory not found in {workspace}", []

    # Scan for compositions
    compositions = scan_compositions(str(src_dir), project_id)

    if not compositions:
        return False, "No compositions found in src/", []

    # Generate Root.tsx content
    root_content = generate_root_tsx(compositions)

    # Write to Root.tsx
    root_path = src_dir / "Root.tsx"
    try:
        root_path.write_text(root_content, encoding='utf-8')
        return True, f"Generated Root.tsx with {len(compositions)} composition(s)", compositions
    except OSError as e:
        return False, f"Failed to write Root.tsx: {e}", compositions


# CLI interface for testing
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python root_generator.py <workspace_path> [project_id]")
        sys.exit(1)

    workspace = sys.argv[1]
    project_id = sys.argv[2] if len(sys.argv) > 2 else None

    success, message, compositions = generate_and_write_root(workspace, project_id)

    print(message)
    if compositions:
        print("\nDetected compositions:")
        for comp in compositions:
            print(f"  - {comp.composition_id} ({comp.component_name}) from {comp.import_path}")

    sys.exit(0 if success else 1)
