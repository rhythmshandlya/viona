"""SDK configuration, MCP servers, security hooks, and CLI utilities."""

import json
import os
import platform
import re
import shutil
import sys
from pathlib import Path
from typing import Any

# Platform detection for subprocess shell parameter
IS_WINDOWS = platform.system() == "Windows"

# Add packages/mcp-servers to Python path for registry loader
_MCP_SERVERS_PKG = Path(__file__).resolve().parent.parent.parent.parent / "mcp-servers"
if str(_MCP_SERVERS_PKG) not in sys.path:
    sys.path.insert(0, str(_MCP_SERVERS_PKG))
from registry import load_mcp_registry, validate_mcp_registry


# ---------------------------------------------------------------------------
# SDK Monkey-patches
# ---------------------------------------------------------------------------

# Claude Agent SDK imports
try:
    from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
    from claude_agent_sdk.types import HookMatcher
except ImportError:
    print("Error: claude-agent-sdk package not installed. Run: pip install claude-agent-sdk")
    sys.exit(1)

# Patch: make the SDK silently skip unknown message types (e.g. rate_limit_event)
# instead of raising MessageParseError which kills the async generator.
try:
    from claude_agent_sdk._internal import message_parser as _mp
    from claude_agent_sdk._errors import MessageParseError

    _original_parse_message = _mp.parse_message

    def _patched_parse_message(data):
        try:
            return _original_parse_message(data)
        except MessageParseError as exc:
            if "Unknown message type" in str(exc):
                print(f"[SDK] Skipping unknown event: {exc}", flush=True)
                return None
            raise

    _mp.parse_message = _patched_parse_message

    from claude_agent_sdk.client import ClaudeSDKClient as _Client

    _original_receive_messages = _Client.receive_messages

    async def _patched_receive_messages(self):
        async for msg in _original_receive_messages(self):
            if msg is not None:
                yield msg

    _Client.receive_messages = _patched_receive_messages
    print("[SDK] Monkey-patch applied: unknown message types will be skipped", flush=True)
except Exception as patch_err:
    print(f"[SDK] Warning: could not apply monkey-patch ({patch_err}), unknown events may crash", flush=True)


# ---------------------------------------------------------------------------
# Windows Command Line Length Fix (GitHub Issue #238)
# ---------------------------------------------------------------------------

if IS_WINDOWS:
    import tempfile
    try:
        from claude_agent_sdk._internal.transport.subprocess_cli import SubprocessCLITransport

        _original_build_command = SubprocessCLITransport._build_command
        _temp_files_to_cleanup = []

        def _write_to_temp_file(content: str, suffix: str = '.txt') -> str:
            """Write content to a temp file and return the path."""
            temp_file = tempfile.NamedTemporaryFile(
                mode='w', suffix=suffix, delete=False, encoding='utf-8'
            )
            temp_file.write(content)
            temp_file.close()
            _temp_files_to_cleanup.append(temp_file.name)
            return temp_file.name

        def _patched_build_command(self):
            """Patched build_command that handles Windows command line length limits."""
            cmd = _original_build_command(self)

            MAX_ARG_LENGTH = 500

            # Args that support @filepath syntax for file-based passing.
            # NOTE: --mcp-config does NOT support @filepath.
            long_args = [
                '--system-prompt',
                '--append-system-prompt',
                '--agents',
                '--settings',
                '--json-schema',
            ]

            for arg_name in long_args:
                if arg_name in cmd:
                    idx = cmd.index(arg_name)
                    if idx + 1 < len(cmd):
                        arg_value = cmd[idx + 1]
                        if len(arg_value) > MAX_ARG_LENGTH:
                            suffix = '.json' if arg_value.strip().startswith(('{', '[')) else '.txt'
                            temp_path = _write_to_temp_file(arg_value, suffix)
                            cmd[idx + 1] = f"@{temp_path}"
                            print(f"[Windows Fix] Wrote {arg_name} ({len(arg_value)} chars) to temp file")

            return cmd

        SubprocessCLITransport._build_command = _patched_build_command
        print("[Windows Fix] Applied monkey patch for command line length limit")
    except ImportError:
        print("[Windows Fix] Could not import SubprocessCLITransport, skipping patch")


# ---------------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------------

def safe_print(msg: str) -> None:
    """Print message safely, handling Unicode encoding errors on Windows."""
    try:
        print(msg)
    except UnicodeEncodeError:
        safe_msg = msg.encode('ascii', errors='replace').decode('ascii')
        print(safe_msg)


def emit_progress(percent: int, message: str, meta: dict | None = None) -> None:
    """Emit progress update in a format the TypeScript worker can parse.

    Format: PROGRESS:XX:message or PROGRESS:XX:message|{json_metadata}
    """
    if meta:
        print(f"PROGRESS:{percent}:{message}|{json.dumps(meta)}", flush=True)
    else:
        print(f"PROGRESS:{percent}:{message}", flush=True)


# ---------------------------------------------------------------------------
# Claude CLI Path Discovery
# ---------------------------------------------------------------------------

def get_claude_cli_path() -> str | None:
    """Find the Claude CLI executable path."""
    cli_path = shutil.which("claude")
    if cli_path:
        safe_print(f"[CLI] Found claude in PATH: {cli_path}")
        return cli_path

    if IS_WINDOWS:
        user_home = os.environ.get("USERPROFILE", "")
        possible_paths = [
            os.path.join(user_home, "AppData", "Roaming", "npm", "claude.cmd"),
            os.path.join(user_home, "AppData", "Roaming", "npm", "claude"),
            os.path.join(user_home, ".npm-global", "bin", "claude.cmd"),
            os.path.join(user_home, ".npm-global", "bin", "claude"),
            os.path.join(user_home, "node_modules", ".bin", "claude.cmd"),
            os.path.join(user_home, "node_modules", ".bin", "claude"),
        ]
    else:
        possible_paths = [
            os.path.expanduser("~/.npm-global/bin/claude"),
            "/usr/local/bin/claude",
            "/opt/homebrew/bin/claude",
            os.path.expanduser("~/node_modules/.bin/claude"),
        ]

    for path in possible_paths:
        if os.path.isfile(path):
            safe_print(f"[CLI] Found claude at: {path}")
            return path

    safe_print("[CLI] WARNING: Claude CLI not found in PATH or common locations")
    return None


CLAUDE_CLI_PATH = get_claude_cli_path()


# ---------------------------------------------------------------------------
# MCP Server Configuration
# ---------------------------------------------------------------------------

def _find_worker_root() -> Path:
    """Find packages/worker root by walking up from this file."""
    p = Path(__file__).resolve().parent
    while p != p.parent:
        if (p / "package.json").exists() and p.name == "worker":
            return p
        p = p.parent
    # Fallback: assume src/agents layout (3 levels up)
    return Path(__file__).resolve().parent.parent.parent

_WORKER_PKG_ROOT = _find_worker_root()
_NODE_MODULES = _WORKER_PKG_ROOT / "node_modules"

_MCP_REMOTE_JS = str(_NODE_MODULES / "mcp-remote" / "dist" / "proxy.js")
_BETTER_ICONS_JS = str(_NODE_MODULES / "better-icons" / "dist" / "index.js")
_MCP_SERVERS_DIST = _WORKER_PKG_ROOT.parent / "mcp-servers" / "dist"

_REGISTRY_VARS = {
    "dist": str(_MCP_SERVERS_DIST),
    "mcp-remote": _MCP_REMOTE_JS,
    "better-icons": _BETTER_ICONS_JS,
}


def build_mcp_servers(workspace: str) -> dict[str, Any]:
    """Build MCP server configuration from the JSON registry."""
    return load_mcp_registry({**_REGISTRY_VARS, "workspace": workspace})


def validate_mcp_servers() -> None:
    """Validate that all MCP server entry-points exist on startup."""
    node_path = shutil.which("node")
    if not node_path:
        raise FileNotFoundError(
            "node is not available in PATH — required to run MCP servers"
        )
    validate_mcp_registry(_REGISTRY_VARS)


# Validate on module load so we fail fast
validate_mcp_servers()


# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------

def is_safe_npm_command(command: str) -> bool:
    """Check if a bash command is a safe npm/npx command."""
    ALLOWED_PREFIXES = ["npm ", "npx ", "npm.cmd ", "npx.cmd "]
    FORBIDDEN_OPERATORS = ["&&", "||", ";", "|", "`", "$(", "${", "\n"]

    stripped = command.strip()
    if not any(stripped.startswith(prefix) for prefix in ALLOWED_PREFIXES):
        return False
    if any(op in command for op in FORBIDDEN_OPERATORS):
        return False
    return True


async def bash_security_hook(
    input_data: dict,
    tool_use_id: str | None = None,
    context: Any = None,
) -> dict:
    """Security hook to restrict Bash commands to npm/npx only."""
    if input_data.get("tool_name") != "Bash":
        return {}

    command = input_data.get("tool_input", {}).get("command", "")
    if is_safe_npm_command(command):
        return {}

    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"Only safe npm/npx commands allowed. Got: {command[:100]}..."
        }
    }


# ---------------------------------------------------------------------------
# Skills & Security Settings
# ---------------------------------------------------------------------------

def get_skills_directive() -> str:
    """Return a directive telling the agent to use skills for animation patterns."""
    return """
## SKILLS (MANDATORY)

Before writing ANY scene code, use the Skill tool to read these skills:
1. `framer-motion` — Reusable components (Card, ParticleEmitter, AnimatedCounter, FlowingStream, ProbabilityGate), animation patterns, prohibited patterns
2. `motion-one` — Spring configs (SMOOTH, SNAPPY, BOUNCY, HEAVY), Disney's 12 principles, stagger timing
3. `video-engagement` — Hook techniques, retention, color palettes, scene structure, visual metaphors
4. `remotion-best-practices` — Official Remotion patterns (read specific rules/ for @remotion/shapes, @remotion/noise, @remotion/paths, @remotion/transitions)

Copy technique implementations from skills directly. Do NOT reinvent or simplify them.
"""


def create_security_settings(workspace_path: str) -> dict:
    """Create security settings for Claude Agent SDK."""
    return {
        "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True},
        "permissions": {
            "defaultMode": "acceptEdits",
            "allow": [
                "Read(./**)",
                "Write(./**)",
                "Edit(./**)",
                "Glob(./**)",
                "Grep(./**)",
                f"Read({workspace_path}/**)",
                f"Write({workspace_path}/**)",
                f"Edit({workspace_path}/**)",
                f"Glob({workspace_path}/**)",
                f"Grep({workspace_path}/**)",
                "Bash(*)",
            ],
        },
    }
