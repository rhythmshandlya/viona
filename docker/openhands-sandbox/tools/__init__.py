"""
Custom OpenHands tools for Remotion visual generation validation.

Tools:
- TypeScriptValidatorTool: Fast syntax/type checking
- RemotionBundleTool: Full Remotion build validation
- RemotionRenderStillTool: Render frames for visual verification
- WriteFileTool: Complete file replacement (bypasses str_replace issues)
- DiffPatchTool: Apply unified diffs for surgical edits
- root_generator: Auto-generate Root.tsx from detected compositions
"""

from .typescript_validator import (
    TypeScriptValidatorTool,
    TypeScriptValidatorAction,
    TypeScriptValidatorObservation,
    TypeScriptValidatorExecutor,
)
from .remotion_bundle import (
    RemotionBundleTool,
    RemotionBundleAction,
    RemotionBundleObservation,
    RemotionBundleExecutor,
)
from .remotion_render_still import (
    RemotionRenderStillTool,
    RemotionRenderStillAction,
    RemotionRenderStillObservation,
    RemotionRenderStillExecutor,
)
from .write_file import (
    WriteFileTool,
    WriteFileAction,
    WriteFileObservation,
    WriteFileExecutor,
)
from .diff_patch import (
    DiffPatchTool,
    DiffPatchAction,
    DiffPatchObservation,
    DiffPatchExecutor,
)
from .root_generator import (
    scan_compositions,
    generate_root_tsx,
    generate_and_write_root,
    CompositionInfo,
)

__all__ = [
    # TypeScript Validator
    "TypeScriptValidatorTool",
    "TypeScriptValidatorAction",
    "TypeScriptValidatorObservation",
    "TypeScriptValidatorExecutor",
    # Remotion Bundle
    "RemotionBundleTool",
    "RemotionBundleAction",
    "RemotionBundleObservation",
    "RemotionBundleExecutor",
    # Remotion Render Still
    "RemotionRenderStillTool",
    "RemotionRenderStillAction",
    "RemotionRenderStillObservation",
    "RemotionRenderStillExecutor",
    # Write File
    "WriteFileTool",
    "WriteFileAction",
    "WriteFileObservation",
    "WriteFileExecutor",
    # Diff Patch
    "DiffPatchTool",
    "DiffPatchAction",
    "DiffPatchObservation",
    "DiffPatchExecutor",
    # Root Generator
    "scan_compositions",
    "generate_root_tsx",
    "generate_and_write_root",
    "CompositionInfo",
]
