#!/usr/bin/env python3
"""
Claude Code Visual Generator

Generates Remotion video compositions using Claude Agent SDK with OAuth authentication.
Uses Claude Pro/Max subscription (no API key costs).

Reference: Auto-Claude apps/backend/core/auth.py, client.py
"""

import asyncio
import json
import math
import os
import platform
import re
import shutil
import sys
from pathlib import Path
from typing import Any

# Platform detection for subprocess shell parameter
# Windows requires shell=True for npx commands (npx.cmd)
# Mac/Linux work better with shell=False
IS_WINDOWS = platform.system() == "Windows"

# Add agents directory to path for local imports
_agents_dir = Path(__file__).parent
if str(_agents_dir) not in sys.path:
    sys.path.insert(0, str(_agents_dir))

# Claude Agent SDK imports
try:
    from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
    from claude_agent_sdk.types import HookMatcher
except ImportError:
    print("Error: claude-agent-sdk package not installed. Run: pip install claude-agent-sdk")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Monkey-patch: make the SDK silently skip unknown message types
# (e.g. rate_limit_event) instead of raising MessageParseError which
# kills the async generator and truncates multi-turn agent loops.
# ---------------------------------------------------------------------------
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
                return None  # sentinel — filtered out below
            raise  # re-raise genuine parse errors

    _mp.parse_message = _patched_parse_message

    # Also patch receive_messages to skip None values returned by our patch
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


# =============================================================================
# Windows Command Line Length Fix (GitHub Issue #238)
# Windows cmd.exe has 8191 char limit. Long prompts exceed this.
# Workaround: Write long arguments to temp files, use @filepath syntax.
# =============================================================================

if IS_WINDOWS:
    import tempfile
    try:
        from claude_agent_sdk._internal.transport.subprocess_cli import SubprocessCLITransport

        _original_build_command = SubprocessCLITransport._build_command
        _temp_files_to_cleanup = []

        def _write_to_temp_file(content: str, suffix: str = '.txt') -> str:
            """Write content to a temp file and return the path."""
            temp_file = tempfile.NamedTemporaryFile(
                mode='w',
                suffix=suffix,
                delete=False,
                encoding='utf-8'
            )
            temp_file.write(content)
            temp_file.close()
            _temp_files_to_cleanup.append(temp_file.name)
            return temp_file.name

        def _patched_build_command(self):
            """Patched build_command that handles Windows command line length limits."""
            cmd = _original_build_command(self)

            # Windows limit is 8191 chars total, and multiline/special-char prompts
            # corrupt cmd.exe parsing even under the limit. Be very aggressive.
            MAX_ARG_LENGTH = 500

            # Arguments that can be long and need file-based passing via @filepath.
            # NOTE: Only include args that the Claude CLI supports reading via @filepath.
            # --mcp-config does NOT support @filepath — passing it breaks MCP init silently.
            long_args = [
                '--system-prompt',
                '--append-system-prompt',  # Used with preset + append pattern
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


# =============================================================================
# Safe Print Helper (Windows Unicode Fix)
# =============================================================================

def safe_print(msg: str) -> None:
    """Print message safely, handling Unicode encoding errors on Windows."""
    try:
        print(msg)
    except UnicodeEncodeError:
        # Replace non-ASCII characters with ? for Windows console
        safe_msg = msg.encode('ascii', errors='replace').decode('ascii')
        print(safe_msg)


def emit_progress(percent: int, message: str, meta: dict | None = None) -> None:
    """Emit progress update in a format the TypeScript worker can parse.

    Format: PROGRESS:XX:message or PROGRESS:XX:message|{json_metadata}
    The worker parses this to update the job progress bar.
    """
    # Flush immediately so progress appears in real-time
    if meta:
        print(f"PROGRESS:{percent}:{message}|{json.dumps(meta)}", flush=True)
    else:
        print(f"PROGRESS:{percent}:{message}", flush=True)


def get_claude_cli_path() -> str | None:
    """
    Find the Claude CLI executable path.

    The Claude Agent SDK needs to spawn the CLI as a subprocess, but it may not
    be in PATH when running from a GUI app or subprocess. This function checks
    common installation locations.
    """
    # First try shutil.which (checks PATH)
    cli_path = shutil.which("claude")
    if cli_path:
        safe_print(f"[CLI] Found claude in PATH: {cli_path}")
        return cli_path

    # Windows-specific locations
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
        for path in possible_paths:
            if os.path.isfile(path):
                safe_print(f"[CLI] Found claude at: {path}")
                return path
    else:
        # macOS/Linux locations
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


# Get CLI path once at module load
CLAUDE_CLI_PATH = get_claude_cli_path()

# =============================================================================
# MCP Server Configuration (pre-installed, invoked via `node` directly)
# =============================================================================

# Resolve worker package root → node_modules for locally installed MCP servers.
# We invoke the JS entry-points via `node` directly instead of using .CMD shims,
# because Claude CLI's subprocess spawn doesn't handle .CMD files on Windows
# (would need shell:true or cmd.exe /c which the SDK doesn't do).
_WORKER_PKG_ROOT = Path(__file__).resolve().parent.parent.parent  # packages/worker
_NODE_MODULES = _WORKER_PKG_ROOT / "node_modules"

# JS entry-points (resolved from each package's bin field)
_MCP_REMOTE_JS = str(_NODE_MODULES / "mcp-remote" / "dist" / "proxy.js")
_BETTER_ICONS_JS = str(_NODE_MODULES / "better-icons" / "dist" / "index.js")


def build_mcp_servers(workspace: str) -> dict[str, Any]:
    """Build MCP server configuration using pre-installed local packages.

    All MCP servers are invoked as `node <entry.js>` so they work reliably
    on Windows without .CMD shim issues. No npx download needed at runtime.
    """
    agents_dir = Path(__file__).parent
    return {
        "freepik": {
            "type": "stdio",
            "command": "node",
            "args": [
                _MCP_REMOTE_JS,
                "https://api.freepik.com/mcp",
                "--header",
                f"x-freepik-api-key:{os.environ.get('FREEPIK_API_KEY', '')}",
            ],
        },
        "better-icons": {
            "type": "stdio",
            "command": "node",
            "args": [_BETTER_ICONS_JS],
        },
        "assets": {
            "type": "stdio",
            "command": "node",
            "args": [
                str(agents_dir / "mcp-servers" / "asset-server.js"),
                "--workspace", workspace,
            ],
            "env": {
                "UNSPLASH_ACCESS_KEY": os.environ.get("UNSPLASH_ACCESS_KEY", ""),
                "PEXELS_API_KEY": os.environ.get("PEXELS_API_KEY", ""),
            },
        },
        "viewport": {
            "type": "stdio",
            "command": "node",
            "args": [
                str(agents_dir / "mcp-servers" / "viewport-server.js"),
                "--workspace", workspace,
            ],
        },
    }


def validate_mcp_servers() -> None:
    """Validate that all MCP server entry-points exist on startup.

    Raises FileNotFoundError if a required file is missing, so the worker
    fails fast instead of timing out minutes into a generation job.
    """
    checks = {
        "mcp-remote (proxy.js)": _MCP_REMOTE_JS,
        "better-icons (index.js)": _BETTER_ICONS_JS,
    }
    # Also check that node is available
    node_path = shutil.which("node")
    if not node_path:
        checks["node"] = None  # type: ignore

    missing = []
    for name, fpath in checks.items():
        if fpath is None or not Path(fpath).exists():
            missing.append(f"  {name}: {fpath or '(not found in PATH)'}")
    if missing:
        raise FileNotFoundError(
            "MCP server files missing — run `pnpm install` in packages/worker:\n"
            + "\n".join(missing)
        )
    safe_print(f"[MCP] All server entry-points verified: mcp-remote, better-icons, node")


# Validate on module load so we fail fast
validate_mcp_servers()


# =============================================================================
# Security Hook (Reference: Auto-Claude apps/backend/core/client.py)
# =============================================================================


def is_safe_npm_command(command: str) -> bool:
    """
    Check if a bash command is a safe npm/npx command.

    Rejects commands with shell chaining operators to prevent bypass attacks.
    The sandbox mode provides defense-in-depth for edge cases.
    """
    ALLOWED_PREFIXES = ["npm ", "npx ", "npm.cmd ", "npx.cmd "]
    FORBIDDEN_OPERATORS = ["&&", "||", ";", "|", "`", "$(", "${", "\n"]

    stripped = command.strip()

    # Must start with allowed prefix
    if not any(stripped.startswith(prefix) for prefix in ALLOWED_PREFIXES):
        return False

    # Must not contain chaining operators
    if any(op in command for op in FORBIDDEN_OPERATORS):
        return False

    return True


async def bash_security_hook(
    input_data: dict,
    tool_use_id: str | None = None,
    context: Any = None,
) -> dict:
    """
    Security hook to restrict Bash commands to npm/npx only.

    Prevents arbitrary command execution while allowing TypeScript/Remotion tooling.
    Defense-in-depth: sandbox mode provides additional protection.
    """
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


# =============================================================================
# OAuth Authentication with Auto-Refresh
# =============================================================================

import time
import httpx
from dataclasses import dataclass
from typing import Callable

# Anthropic OAuth endpoints (based on Claude Code's auth flow)
ANTHROPIC_TOKEN_ENDPOINT = "https://console.anthropic.com/v1/oauth/token"
ANTHROPIC_AUTH_URL = "https://console.anthropic.com/oauth/authorize"

# Minimum token validity required (10 minutes in milliseconds)
MIN_TOKEN_VALIDITY_MS = 10 * 60 * 1000

# Token refresh buffer (refresh 5 minutes before expiry)
REFRESH_BUFFER_MS = 5 * 60 * 1000


@dataclass
class OAuthTokens:
    """OAuth token data structure."""
    access_token: str
    refresh_token: str | None
    expires_at: int | None  # milliseconds timestamp (None = never expires)
    scopes: list[str] | None = None
    subscription_type: str | None = None

    @property
    def is_expired(self) -> bool:
        """Check if access token is expired."""
        if self.expires_at is None:
            return False
        return int(time.time() * 1000) >= self.expires_at

    @property
    def needs_refresh(self) -> bool:
        """Check if token should be refreshed (within buffer period)."""
        if self.expires_at is None:
            return False
        return int(time.time() * 1000) >= (self.expires_at - REFRESH_BUFFER_MS)

    @property
    def minutes_remaining(self) -> int:
        """Minutes until token expires."""
        if self.expires_at is None:
            return 999
        remaining_ms = self.expires_at - int(time.time() * 1000)
        return max(0, int(remaining_ms / 60000))

    def to_dict(self) -> dict:
        """Convert to dictionary for storage."""
        return {
            "accessToken": self.access_token,
            "refreshToken": self.refresh_token,
            "expiresAt": self.expires_at,
            "scopes": self.scopes,
            "subscriptionType": self.subscription_type,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "OAuthTokens":
        """Create from dictionary."""
        return cls(
            access_token=data["accessToken"],
            refresh_token=data.get("refreshToken"),
            expires_at=data.get("expiresAt", 0),
            scopes=data.get("scopes"),
            subscription_type=data.get("subscriptionType"),
        )


class TokenStorage:
    """Abstract base for token storage backends."""

    def load(self) -> OAuthTokens | None:
        """Load tokens from storage."""
        raise NotImplementedError

    def save(self, tokens: OAuthTokens) -> None:
        """Save tokens to storage."""
        raise NotImplementedError


class FileTokenStorage(TokenStorage):
    """Store tokens in Claude's credential file (local development)."""

    def __init__(self, path: str | None = None):
        self.path = path or self._find_credential_path()

    def _find_credential_path(self) -> str | None:
        """Find Claude's credential file."""
        paths = [
            os.path.expandvars(r"%USERPROFILE%\.claude\.credentials.json"),
            os.path.expandvars(r"%USERPROFILE%\.claude\credentials.json"),
            os.path.expanduser("~/.claude/.credentials.json"),
            os.path.expanduser("~/.claude/credentials.json"),
        ]
        for p in paths:
            if os.path.exists(p):
                return p
        return paths[0]  # Default to first path for creation

    def load(self) -> OAuthTokens | None:
        """Load tokens from credential file."""
        if not self.path or not os.path.exists(self.path):
            return None
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
            oauth = data.get("claudeAiOauth", {})
            if oauth.get("accessToken"):
                return OAuthTokens.from_dict(oauth)
        except Exception as e:
            print(f"[TokenStorage] Error loading tokens: {e}")
        return None

    def save(self, tokens: OAuthTokens) -> None:
        """Save tokens to credential file."""
        if not self.path:
            return
        try:
            # Load existing data or create new
            data = {}
            if os.path.exists(self.path):
                with open(self.path, encoding="utf-8") as f:
                    data = json.load(f)

            # Update OAuth tokens
            data["claudeAiOauth"] = tokens.to_dict()

            # Ensure directory exists
            os.makedirs(os.path.dirname(self.path), exist_ok=True)

            # Write back
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)

            print(f"[TokenStorage] Tokens saved to {self.path}")
        except Exception as e:
            print(f"[TokenStorage] Error saving tokens: {e}")


class DatabaseTokenStorage(TokenStorage):
    """Store tokens in database (for server deployment)."""

    def __init__(
        self,
        load_fn: Callable[[], dict | None],
        save_fn: Callable[[dict], None],
    ):
        """
        Initialize with database callbacks.

        Args:
            load_fn: Function that returns token dict from DB or None
            save_fn: Function that saves token dict to DB
        """
        self.load_fn = load_fn
        self.save_fn = save_fn

    def load(self) -> OAuthTokens | None:
        """Load tokens from database."""
        try:
            data = self.load_fn()
            if data and data.get("accessToken"):
                return OAuthTokens.from_dict(data)
        except Exception as e:
            print(f"[TokenStorage] Error loading from DB: {e}")
        return None

    def save(self, tokens: OAuthTokens) -> None:
        """Save tokens to database."""
        try:
            self.save_fn(tokens.to_dict())
            print("[TokenStorage] Tokens saved to database")
        except Exception as e:
            print(f"[TokenStorage] Error saving to DB: {e}")


class EnvTokenStorage(TokenStorage):
    """
    Store tokens in environment variables (for Railway/server deployment).

    Set these environment variables:
    - CLAUDE_OAUTH_ACCESS_TOKEN: The OAuth access token
    - CLAUDE_OAUTH_REFRESH_TOKEN: The OAuth refresh token (optional)
    - CLAUDE_OAUTH_EXPIRES_AT: Token expiry timestamp in ms (optional)
    """

    def load(self) -> OAuthTokens | None:
        """Load tokens from environment variables."""
        access_token = os.environ.get("CLAUDE_OAUTH_ACCESS_TOKEN")
        if not access_token:
            return None

        refresh_token = os.environ.get("CLAUDE_OAUTH_REFRESH_TOKEN")
        expires_at = os.environ.get("CLAUDE_OAUTH_EXPIRES_AT")

        return OAuthTokens(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=int(expires_at) if expires_at else None,
            scopes=None,
            subscription_type=os.environ.get("CLAUDE_SUBSCRIPTION_TYPE", "max"),
        )

    def save(self, tokens: OAuthTokens) -> None:
        """Cannot save to env vars, but store in memory for session."""
        os.environ["CLAUDE_OAUTH_ACCESS_TOKEN"] = tokens.access_token
        if tokens.refresh_token:
            os.environ["CLAUDE_OAUTH_REFRESH_TOKEN"] = tokens.refresh_token
        if tokens.expires_at:
            os.environ["CLAUDE_OAUTH_EXPIRES_AT"] = str(tokens.expires_at)
        print("[TokenStorage] Tokens updated in environment")


def _get_default_storage() -> TokenStorage:
    """Get the appropriate token storage based on environment."""
    # Check for env var tokens first (Railway/server deployment)
    if os.environ.get("CLAUDE_OAUTH_ACCESS_TOKEN"):
        print("[TokenStorage] Using environment variable tokens")
        return EnvTokenStorage()
    # Fall back to file storage (local development)
    return FileTokenStorage()


class OAuthTokenManager:
    """
    Manages OAuth tokens with automatic refresh.

    Usage:
        # Local development (uses Claude's credential file)
        manager = OAuthTokenManager()

        # Server deployment with env vars (set CLAUDE_OAUTH_ACCESS_TOKEN)
        manager = OAuthTokenManager()  # Auto-detects env vars

        # Server deployment (uses database)
        manager = OAuthTokenManager(
            storage=DatabaseTokenStorage(
                load_fn=lambda: db.get_oauth_tokens(),
                save_fn=lambda tokens: db.save_oauth_tokens(tokens)
            )
        )

        # Get valid token (auto-refreshes if needed)
        token = await manager.get_valid_token()
    """

    def __init__(self, storage: TokenStorage | None = None):
        self.storage = storage or _get_default_storage()
        self._tokens: OAuthTokens | None = None
        self._http_client: httpx.AsyncClient | None = None

    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client

    async def close(self) -> None:
        """Close HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

    def load_tokens(self) -> OAuthTokens | None:
        """Load tokens from storage."""
        self._tokens = self.storage.load()
        return self._tokens

    def save_tokens(self, tokens: OAuthTokens) -> None:
        """Save tokens to storage."""
        self._tokens = tokens
        self.storage.save(tokens)

    async def refresh_tokens(self) -> OAuthTokens | None:
        """
        Refresh access token using refresh token.

        Returns new tokens or None if refresh failed.
        """
        if not self._tokens or not self._tokens.refresh_token:
            print("[OAuth] No refresh token available")
            return None

        print("[OAuth] Refreshing access token...")

        try:
            client = await self._get_http_client()

            # Try Anthropic's OAuth token endpoint
            response = await client.post(
                ANTHROPIC_TOKEN_ENDPOINT,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._tokens.refresh_token,
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )

            if response.status_code == 200:
                data = response.json()
                new_tokens = OAuthTokens(
                    access_token=data["access_token"],
                    refresh_token=data.get("refresh_token", self._tokens.refresh_token),
                    expires_at=int(time.time() * 1000) + (data.get("expires_in", 28800) * 1000),
                    scopes=self._tokens.scopes,
                    subscription_type=self._tokens.subscription_type,
                )
                self.save_tokens(new_tokens)
                print(f"[OAuth] Token refreshed! Valid for {new_tokens.minutes_remaining} minutes")
                return new_tokens

            # If standard OAuth fails, try alternative methods
            print(f"[OAuth] Standard refresh failed ({response.status_code}), trying CLI refresh...")
            return await self._refresh_via_cli()

        except Exception as e:
            print(f"[OAuth] Refresh error: {e}")
            return await self._refresh_via_cli()

    async def _refresh_via_cli(self) -> OAuthTokens | None:
        """Fallback: trigger refresh via Claude CLI."""
        import subprocess

        try:
            # Running any claude command may trigger internal token refresh
            result = subprocess.run(
                ["claude", "--version"],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                # Reload tokens from file (CLI may have refreshed them)
                new_tokens = self.load_tokens()
                if new_tokens and not new_tokens.needs_refresh:
                    print(f"[OAuth] CLI refresh worked! Valid for {new_tokens.minutes_remaining} minutes")
                    return new_tokens

        except Exception as e:
            print(f"[OAuth] CLI refresh failed: {e}")

        return None

    async def get_valid_token(self) -> str:
        """
        Get a valid access token, refreshing if needed.

        Returns:
            Valid access token string

        Raises:
            ValueError: If no valid token available and refresh failed
        """
        # Load tokens if not cached
        if not self._tokens:
            self._tokens = self.load_tokens()

        if not self._tokens:
            raise ValueError(
                "No OAuth tokens found.\n\n"
                "For local development:\n"
                "  1. Run: claude\n"
                "  2. Type: /login\n"
                "  3. Complete OAuth in browser\n\n"
                "For server deployment:\n"
                "  1. Do initial login locally\n"
                "  2. Copy tokens to database\n"
                "  3. Use DatabaseTokenStorage\n"
            )

        # Check if refresh needed
        if self._tokens.needs_refresh:
            print(f"[OAuth] Token expires in {self._tokens.minutes_remaining} minutes, refreshing...")
            refreshed = await self.refresh_tokens()
            if refreshed:
                self._tokens = refreshed
            elif self._tokens.is_expired:
                raise ValueError(
                    "OAuth token expired and refresh failed.\n"
                    "Please re-authenticate with: claude /login"
                )
            else:
                print("[OAuth] WARNING: Refresh failed but token still valid, continuing...")

        print(f"[OAuth] Using token valid for {self._tokens.minutes_remaining} minutes")
        return self._tokens.access_token


# Global token manager instance
_token_manager: OAuthTokenManager | None = None


def get_token_manager(storage: TokenStorage | None = None) -> OAuthTokenManager:
    """Get or create the global token manager."""
    global _token_manager
    if _token_manager is None or storage is not None:
        _token_manager = OAuthTokenManager(storage)
    return _token_manager


# Legacy functions for backwards compatibility
def get_credential_file_path() -> str | None:
    """Find the Claude credentials file path."""
    storage = FileTokenStorage()
    return storage.path


def get_oauth_credentials() -> dict | None:
    """Get full OAuth credentials."""
    storage = FileTokenStorage()
    tokens = storage.load()
    return tokens.to_dict() if tokens else None


def get_oauth_token_from_credential_store() -> str | None:
    """Get OAuth token from credential store."""
    creds = get_oauth_credentials()
    return creds.get("accessToken") if creds else None


def check_token_validity() -> tuple[bool, int | None]:
    """Check if token is valid and has enough time remaining."""
    storage = FileTokenStorage()
    tokens = storage.load()
    if not tokens:
        return False, None
    is_valid = not tokens.needs_refresh
    return is_valid, tokens.minutes_remaining


async def async_require_oauth_token() -> str:
    """Get OAuth token with auto-refresh (async version)."""
    manager = get_token_manager()
    return await manager.get_valid_token()


def require_oauth_token() -> str:
    """Get OAuth token with auto-refresh (sync version)."""
    # For sync contexts, just load and check (can't async refresh)
    storage = FileTokenStorage()
    tokens = storage.load()

    if not tokens:
        raise ValueError(
            "No OAuth token found.\n\n"
            "Claude Visual Generator requires Claude Pro/Max subscription.\n\n"
            "To authenticate:\n"
            "  1. Run: claude\n"
            "  2. Type: /login\n"
            "  3. Complete OAuth in browser\n"
        )

    if tokens.needs_refresh:
        print(f"[OAuth] Token expires in {tokens.minutes_remaining} minutes")
        if tokens.is_expired:
            raise ValueError("OAuth token expired. Please re-authenticate with: claude /login")
        print("[OAuth] WARNING: Token expiring soon. Consider refreshing.")

    print(f"[OAuth] Token valid for {tokens.minutes_remaining} minutes")
    return tokens.access_token


def configure_sdk_auth() -> None:
    """Configure environment for Claude Agent SDK authentication."""
    token = require_oauth_token()
    os.environ["CLAUDE_AGENT_OAUTH_TOKEN"] = token


async def configure_sdk_auth_async() -> None:
    """Configure environment for Claude Agent SDK authentication (async, with refresh)."""
    token = await async_require_oauth_token()
    os.environ["CLAUDE_AGENT_OAUTH_TOKEN"] = token


# =============================================================================
# Skill and Code Example Injection
# =============================================================================


def get_condensed_skills() -> str:
    """
    Return condensed, essential skill content to inject directly into prompt.
    Agents don't reliably read skill files, so we inject critical patterns directly.
    """
    return """
## REQUIRED ANIMATION PATTERNS (USE THESE EXACTLY)

### Spring Configuration (ALWAYS import from constants.ts)
```tsx
import { SPRINGS, STAGGER } from '../constants';
// Usage:
const progress = spring({frame: frame - startFrame, fps, config: SPRINGS.SMOOTH}); // { damping: 26, stiffness: 120, mass: 1.0 }
const heroProgress = spring({frame, fps, config: SPRINGS.SNAPPY}); // { damping: 18, stiffness: 180, mass: 0.8 }
```

### Stagger Pattern (REQUIRED for multiple elements)
```tsx
// NEVER animate all elements at once. Always stagger by 6+ frames:
{items.map((item, i) => (
  <Element key={i} delay={i * 6} />
))}
```

### Glassmorphism (for cards/containers)
```tsx
const glassStyle = {
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};
```

### Flowing Particles (for streams/rivers)
```tsx
const FlowingParticles: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <>
      {Array.from({length: 30}).map((_, i) => {
        const x = ((frame * 2 + i * 50) % (width + 100)) - 50;
        const y = (height * 0.4) + Math.sin((frame + i * 20) * 0.03) * 50;
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: y,
            width: 16, height: 16, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            opacity: 0.7,
          }} />
        );
      })}
    </>
  );
};
```

### Particle Emitter (for explosion/radial effects)
```tsx
const ParticleEmitter: React.FC<{count: number, startFrame: number}> = ({count, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {Array.from({length: count}).map((_, i) => {
        const delay = i * 6;
        const progress = spring({frame: frame - startFrame - delay, fps, config: {damping: 26, stiffness: 120}});
        const angle = (i / count) * Math.PI * 2;
        const radius = progress * 100;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `calc(50% + ${Math.cos(angle) * radius}px)`,
            top: `calc(50% + ${Math.sin(angle) * radius}px)`,
            width: 8, height: 8,
            borderRadius: '50%',
            background: '#8b5cf6',
            opacity: interpolate(progress, [0, 0.8, 1], [0, 1, 0]),
          }} />
        );
      })}
    </>
  );
};
```

### Counter Animation (for numbers)
```tsx
const Counter: React.FC<{target: number, start: number}> = ({target, start}) => {
  const frame = useCurrentFrame();
  const value = Math.round(interpolate(
    frame - start, [0, 45], [0, target], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  ));
  return <span style={{fontVariantNumeric: 'tabular-nums'}}>{value}</span>;
};
```

### Scale Entrance (for appearing elements)
```tsx
const ScaleIn: React.FC<{startFrame: number, children: React.ReactNode}> = ({startFrame, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = spring({frame: frame - startFrame, fps, config: {damping: 26, stiffness: 120}});
  return <div style={{transform: `scale(${scale})`}}>{children}</div>;
};
```

### Fade In Animation
```tsx
const FadeIn: React.FC<{startFrame: number, children: React.ReactNode}> = ({startFrame, children}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame - startFrame,
    [0, 20],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );
  return <div style={{opacity}}>{children}</div>;
};
```

## PROHIBITED PATTERNS (NEVER DO THESE)

- EMPTY FRAMES with just background (WORST OFFENSE - kills retention)
- Missing key prop on children arrays (causes React warnings)
- Math.sin() or Math.cos() on text rotation/position (causes jittery text)
- damping < 20 in spring config (too bouncy)
- All elements animating at the same time (no stagger)
- Plain colored circles instead of proper visuals
- Instant teleportation (no animation)
- Static backgrounds with no motion
- Missing extrapolateLeft/extrapolateRight: 'clamp' in interpolate() — BOTH are required
- Scenes with no visual metaphor (just text on background)
- Gaps between scenes (no animation happening)

## REACT KEYS (MANDATORY)
Every element in a children array needs a unique key:
```tsx
// CORRECT:
<AbsoluteFill>
  <AnimatedBackground key="bg" />
  <Sequence key="scene1" from={0}>...</Sequence>
  <Sequence key="scene2" from={90}>...</Sequence>
</AbsoluteFill>

// WRONG (missing keys):
<AbsoluteFill>
  <AnimatedBackground />
  <Sequence from={0}>...</Sequence>
  <Sequence from={90}>...</Sequence>
</AbsoluteFill>
```
"""


def get_instagram_design_guide() -> str:
    """
    Return Instagram-worthy design principles and guidance.
    Teaches agents how to create scroll-stopping, visually stunning content.
    """
    return '''
## INSTAGRAM-WORTHY DESIGN GUIDE

### THE HOOK (FIRST 3 SECONDS = EVERYTHING)
Your video has 0.5-3 seconds to stop the scroll. The opening MUST be visually striking.

**Hook Techniques (USE AT LEAST ONE):**
1. **Bold Statement** - Large, animated text that makes a provocative claim
2. **Visual Paradox** - Something unexpected (e.g., data flowing backwards, impossible shapes)
3. **Dramatic Reveal** - Start zoomed in, pull back to reveal context
4. **Motion Explosion** - Particles/elements bursting from center
5. **Question Hook** - Animated question mark or "Did you know...?"

```tsx
// EXAMPLE: Motion Explosion Hook (first 45 frames)
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Dramatic scale-in for main element
  const scale = spring({frame, fps, config: {damping: 12, stiffness: 100}});

  // Particle burst behind it
  const particles = Array.from({length: 20}).map((_, i) => {
    const angle = (i / 20) * Math.PI * 2;
    const distance = spring({frame: frame - 5, fps, config: {damping: 18}}) * 150;
    return (
      <div key={i} style={{
        position: 'absolute',
        left: `calc(50% + ${Math.cos(angle) * distance}px)`,
        top: `calc(50% + ${Math.sin(angle) * distance}px)`,
        width: 12, height: 12, borderRadius: '50%',
        background: 'linear-gradient(135deg, #ff6b6b, #feca57)',
        opacity: interpolate(frame, [0, 30], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      }} />
    );
  });

  return (
    <>
      {particles}
      <div style={{transform: `scale(${scale})`, textAlign: 'center'}}>
        <h1 style={{fontSize: 72, fontWeight: 900}}>🤯 Mind = Blown</h1>
      </div>
    </>
  );
};
```

### RETENTION TECHNIQUES (KEEP THEM WATCHING)

1. **Progressive Revelation** - Don't show everything at once. Build understanding.
2. **Visual Payoff Every 3-5 Seconds** - New animation, new element, new insight
3. **Anticipation Loops** - Show something partially, then reveal fully
4. **Counter/Progress Indicators** - Numbers counting, progress bars filling
5. **Pattern Interrupts** - Just when viewer expects X, do Y

### COLOR PALETTES (2024-2025 TRENDS)

**Palette 1: Electric Sunset (HIGH ENERGY)**
```tsx
const COLORS = {
  primary: '#ff6b6b',      // Coral red
  secondary: '#feca57',    // Golden yellow
  accent: '#ff9ff3',       // Pink
  dark: '#1a1a2e',         // Deep navy
  light: '#ffffff',
};
const GRADIENT = 'linear-gradient(135deg, #ff6b6b 0%, #feca57 50%, #ff9ff3 100%)';
```

**Palette 2: Cyber Neon (TECH/DATA)**
```tsx
const COLORS = {
  primary: '#00f5d4',      // Cyan
  secondary: '#7b2cbf',    // Purple
  accent: '#f72585',       // Magenta
  dark: '#0a0a0f',         // Near black
  light: '#e0e0e0',
};
const GRADIENT = 'linear-gradient(135deg, #00f5d4 0%, #7b2cbf 50%, #f72585 100%)';
```

**Palette 3: Soft Gradient (CALM/EDUCATIONAL)**
```tsx
const COLORS = {
  primary: '#667eea',      // Soft indigo
  secondary: '#764ba2',    // Soft purple
  accent: '#66a6ff',       // Sky blue
  dark: '#1e1e2f',         // Dark purple-gray
  light: '#f8f9fa',
};
const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
```

**Palette 4: Forest Tech (NATURE + TECH)**
```tsx
const COLORS = {
  primary: '#00b894',      // Mint green
  secondary: '#0984e3',    // Ocean blue
  accent: '#fdcb6e',       // Soft gold
  dark: '#0c1618',         // Deep forest
  light: '#dfe6e9',
};
const GRADIENT = 'linear-gradient(135deg, #00b894 0%, #0984e3 100%)';
```

### MOBILE-FIRST TYPOGRAPHY (1080x1920 VERTICAL)

```tsx
// Mobile text sizes (for 1080x1920)
const TYPOGRAPHY = {
  hero: {fontSize: 96, fontWeight: 900, lineHeight: 1.1},     // Main hook text
  title: {fontSize: 64, fontWeight: 800, lineHeight: 1.2},    // Section titles
  subtitle: {fontSize: 48, fontWeight: 600, lineHeight: 1.3}, // Supporting text
  body: {fontSize: 36, fontWeight: 500, lineHeight: 1.5},     // Explanatory text
  caption: {fontSize: 28, fontWeight: 400, lineHeight: 1.4},  // Small labels
};

// For 1920x1080 horizontal, use 75% of these values
```

### MOTION DESIGN TRENDS

1. **Morphing Shapes** - Elements that smoothly transform into other shapes
2. **Liquid Motion** - Blob-like, organic movements
3. **Kinetic Typography** - Text that moves with meaning (words bouncing when saying "bounce")
4. **3D Depth** - Parallax layers, perspective transforms
5. **Micro-interactions** - Small details that reward attention

### SCENE STRUCTURE FOR ENGAGEMENT

```
Scene 1 (0-3s): THE HOOK - Stop the scroll, create curiosity
Scene 2 (3-8s): THE SETUP - Establish the problem/question
Scene 3 (8-15s): THE BUILD - Progressive revelation of concept
Scene 4 (15-22s): THE PAYOFF - Visual climax, "aha" moment
Scene 5 (22-28s): THE REINFORCE - Solidify understanding
Scene 6 (28-30s): THE CTA - Call to action, loop point
```

### BACKGROUNDS THAT POP

Never use plain solid colors. Always add depth:

```tsx
// Animated gradient background
const AnimatedBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const gradientAngle = interpolate(frame, [0, 300], [135, 225]);
  return (
    <AbsoluteFill style={{
      background: `linear-gradient(${gradientAngle}deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`,
    }}>
      {/* Add floating particles or subtle grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)',
        backgroundSize: '40px 40px',
      }} />
    </AbsoluteFill>
  );
};
```

### VISUAL METAPHORS (MAKE ABSTRACT CONCRETE)

| Abstract Concept | Visual Metaphor |
|------------------|-----------------|
| Data flow | River of glowing particles |
| Algorithm | Assembly line / conveyor belt |
| Recursion | Mirrors reflecting mirrors |
| API call | Package being delivered |
| Cache | Drawer/filing cabinet |
| Memory | Grid of glowing boxes |
| Process | Gears turning together |
| Network | Connected nodes with pulses |
| Error | Red warning flash + shake |
| Success | Green checkmark + confetti |
'''


TECHNIQUE_CODE_EXAMPLES = {
    "particle-emitter": '''
// ParticleEmitter - Use for particle effects
const ParticleEmitter: React.FC<{count: number, startFrame: number}> = ({count, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {Array.from({length: count}).map((_, i) => {
        const delay = i * 6;
        const progress = spring({frame: frame - startFrame - delay, fps, config: {damping: 26, stiffness: 120}});
        const angle = (i / count) * Math.PI * 2;
        const radius = progress * 100;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `calc(50% + ${Math.cos(angle) * radius}px)`,
            top: `calc(50% + ${Math.sin(angle) * radius}px)`,
            width: 8, height: 8,
            borderRadius: '50%',
            background: '#8b5cf6',
            opacity: interpolate(progress, [0, 0.8, 1], [0, 1, 0]),
          }} />
        );
      })}
    </>
  );
};''',
    "glass-morphism": '''
// GlassCard - Glassmorphism container
const GlassCard: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  }}>
    {children}
  </div>
);''',
    "flowing-river": '''
// FlowingRiver - Animated data stream
const FlowingRiver: React.FC<{startFrame: number}> = ({startFrame}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const particles = Array.from({length: 50}).map((_, i) => {
    const speed = 2 + (i % 3);
    const yOffset = (i * 40) % height;
    const x = ((frame - startFrame) * speed + i * 30) % (width + 100) - 50;
    const y = yOffset + Math.sin((frame + i * 10) * 0.02) * 30;
    return (
      <div key={i} style={{
        position: 'absolute', left: x, top: y,
        width: 12 + (i % 8), height: 12 + (i % 8),
        borderRadius: '50%',
        background: `linear-gradient(135deg, #3b82f6, #8b5cf6)`,
        opacity: 0.6 + (i % 4) * 0.1,
      }} />
    );
  });
  return <>{particles}</>;
};''',
    "probability-gate": '''
// ProbabilityGate - Dice/spinner for random chance visualization
const ProbabilityGate: React.FC<{n: number, startFrame: number}> = ({n, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const spinProgress = spring({frame: frame - startFrame, fps, config: {damping: 15, stiffness: 80}});
  const rotation = interpolate(spinProgress, [0, 1], [0, 720]);
  return (
    <div style={{
      width: 80, height: 80,
      background: 'linear-gradient(135deg, #22c55e, #3b82f6)',
      borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: `rotate(${rotation}deg)`,
      boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)',
    }}>
      <span style={{fontSize: 24, fontWeight: 'bold', color: 'white'}}>1/{n}</span>
    </div>
  );
};''',
    "scale-spring": '''
// Scale spring entrance animation
const scaleEntrance = (frame: number, startFrame: number, fps: number) => {
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 }
  });
  return progress;
};
// Usage: transform: `scale(${scaleEntrance(frame, 15, fps)})`''',
    "counter-animation": '''
// AnimatedCounter - Number counting up
const AnimatedCounter: React.FC<{target: number, startFrame: number, duration?: number}> = ({target, startFrame, duration = 45}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - startFrame, [0, duration], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const value = Math.round(progress * target);
  return (
    <span style={{fontVariantNumeric: 'tabular-nums'}}>{value.toLocaleString()}</span>
  );
};''',
    "staggered-list": '''
// StaggeredList - Animated list with staggered entries
const StaggeredList: React.FC<{items: string[], startFrame: number}> = ({items, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div>
      {items.map((item, i) => {
        const delay = i * 6; // 6 frame stagger
        const progress = spring({
          frame: frame - startFrame - delay,
          fps,
          config: { damping: 26, stiffness: 120, mass: 1.0 }
        });
        return (
          <div key={i} style={{
            opacity: progress,
            transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`
          }}>
            {item}
          </div>
        );
      })}
    </div>
  );
};''',
}


def get_remotion_libraries_guide() -> str:
    """
    Return examples of Remotion's official libraries for advanced effects.
    These are npm packages that can be imported for sophisticated visuals.
    """
    return '''
## REMOTION LIBRARIES (ADVANCED EFFECTS)

These are official Remotion packages available in the workspace. Use them for sophisticated effects.

### @remotion/shapes - SVG Shape Primitives
```tsx
import {Pie, Triangle, Circle, Rect, Star, Polygon} from '@remotion/shapes';

// Animated pie chart
const AnimatedPie: React.FC<{progress: number}> = ({progress}) => (
  <Pie
    radius={100}
    progress={progress}
    fill="#667eea"
    stroke="#764ba2"
    strokeWidth={4}
  />
);

// Star rating animation
const StarRating: React.FC<{rating: number, startFrame: number}> = ({rating, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <div style={{display: 'flex', gap: 8}}>
      {[1, 2, 3, 4, 5].map((i) => {
        const delay = (i - 1) * 6;
        const scale = spring({frame: frame - startFrame - delay, fps, config: {damping: 15}});
        const isFilled = i <= rating;
        return (
          <div key={i} style={{transform: `scale(${scale})`}}>
            <Star
              points={5}
              innerRadius={20}
              outerRadius={40}
              fill={isFilled ? '#feca57' : 'transparent'}
              stroke="#feca57"
              strokeWidth={2}
            />
          </div>
        );
      })}
    </div>
  );
};
```

### @remotion/noise - Procedural Noise
```tsx
import {noise2D, noise3D} from '@remotion/noise';

// Organic floating particles using noise
const NoiseParticles: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <>
      {Array.from({length: 30}).map((_, i) => {
        const seed = i * 100;
        const x = noise2D(seed, frame * 0.01, 0) * 400 + 540;
        const y = noise2D(seed + 1000, frame * 0.01, 0) * 400 + 960;
        const scale = noise2D(seed + 2000, frame * 0.02, 0) * 0.5 + 0.75;

        return (
          <div key={i} style={{
            position: 'absolute',
            left: x, top: y,
            width: 20, height: 20,
            borderRadius: '50%',
            background: 'rgba(102, 126, 234, 0.6)',
            transform: `scale(${scale})`,
          }} />
        );
      })}
    </>
  );
};

// Wavy text using noise
const WavyText: React.FC<{text: string}> = ({text}) => {
  const frame = useCurrentFrame();

  return (
    <div style={{display: 'flex'}}>
      {text.split('').map((char, i) => {
        const y = noise2D(i, frame * 0.05, 0) * 20;
        return (
          <span key={i} style={{
            display: 'inline-block',
            transform: `translateY(${y}px)`,
            fontSize: 64, fontWeight: 700,
          }}>
            {char}
          </span>
        );
      })}
    </div>
  );
};
```

### @remotion/paths - SVG Path Animation
```tsx
import {
  getLength,
  getPointAtLength,
  evolvePath,
  translatePath,
  scalePath,
} from '@remotion/paths';

// Draw-on line animation
const AnimatedPath: React.FC<{startFrame: number}> = ({startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const path = 'M 100 200 Q 300 100 500 200 T 900 200';
  const length = getLength(path);
  const progress = spring({frame: frame - startFrame, fps, config: {damping: 20}});

  const strokeDasharray = length;
  const strokeDashoffset = length * (1 - progress);

  return (
    <svg width="1000" height="400" viewBox="0 0 1000 400">
      <path
        d={path}
        stroke="url(#gradient)"
        strokeWidth={8}
        fill="none"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#667eea" />
          <stop offset="100%" stopColor="#f72585" />
        </linearGradient>
      </defs>
    </svg>
  );
};

// Moving element along path
const ElementOnPath: React.FC<{progress: number}> = ({progress}) => {
  const path = 'M 0 100 Q 250 0 500 100 T 1000 100';
  const length = getLength(path);
  const point = getPointAtLength(path, progress * length);

  return (
    <div style={{
      position: 'absolute',
      left: point.x, top: point.y,
      width: 30, height: 30,
      borderRadius: '50%',
      background: '#00f5d4',
      transform: 'translate(-50%, -50%)',
      boxShadow: '0 0 20px #00f5d4',
    }} />
  );
};
```

### @remotion/animated-emoji - Animated Emojis
```tsx
import {AnimatedEmoji} from '@remotion/animated-emoji';

// Use animated emojis for visual interest
const EmojiReaction: React.FC<{emoji: string, startFrame: number}> = ({emoji, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = spring({frame: frame - startFrame, fps, config: {damping: 12}});

  return (
    <div style={{transform: `scale(${scale})`}}>
      <AnimatedEmoji emoji={emoji} />
    </div>
  );
};

// Available animated emojis: 🔥 ❤️ 👍 👎 😂 😮 😢 😡 🎉 💡 ✅ ❌
```

### @remotion/transitions - Scene Transitions
```tsx
import {
  TransitionSeries,
  springTiming,
  linearTiming,
} from '@remotion/transitions';
import {slide} from '@remotion/transitions/slide';
import {fade} from '@remotion/transitions/fade';
import {wipe} from '@remotion/transitions/wipe';

// Use TransitionSeries for smooth scene changes
const ScenesWithTransitions: React.FC = () => {
  const {fps} = useVideoConfig();

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={90}>
        <Scene1 />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({direction: 'from-right'})}
        timing={springTiming({config: {damping: 200}, durationInFrames: 30})}
      />

      <TransitionSeries.Sequence durationInFrames={90}>
        <Scene2 />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({durationInFrames: 20})}
      />

      <TransitionSeries.Sequence durationInFrames={90}>
        <Scene3 />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
```

### COMBINING LIBRARIES FOR ADVANCED EFFECTS

```tsx
// Data visualization with noise, shapes, and paths
const DataVisualization: React.FC<{startFrame: number}> = ({startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const progress = spring({frame: frame - startFrame, fps, config: {damping: 20}});

  // Use noise for organic data variation
  const dataPoints = [65, 78, 82, 91, 87, 95].map((value, i) => ({
    value,
    noise: noise2D(i, frame * 0.02, 0) * 3, // Subtle organic motion
  }));

  return (
    <div style={{display: 'flex', alignItems: 'flex-end', gap: 24, height: 300}}>
      {dataPoints.map((point, i) => {
        const delay = i * 8;
        const barProgress = spring({
          frame: frame - startFrame - delay,
          fps,
          config: {damping: 18}
        });
        const height = (point.value + point.noise) * 2.5 * barProgress;

        return (
          <div key={i} style={{
            width: 60,
            height,
            background: `linear-gradient(180deg, #667eea 0%, #764ba2 100%)`,
            borderRadius: '8px 8px 0 0',
            boxShadow: '0 0 20px rgba(102, 126, 234, 0.5)',
          }}>
            <span style={{
              position: 'absolute', top: -30,
              left: '50%', transform: 'translateX(-50%)',
              fontSize: 24, fontWeight: 700, color: '#fff',
              opacity: barProgress,
            }}>
              {Math.round(point.value * barProgress)}%
            </span>
          </div>
        );
      })}
    </div>
  );
};
```
'''


def extract_technique_examples(transcript: str) -> str:
    """
    Extract relevant code examples based on transcript content.
    Analyzes transcript for keywords that suggest certain techniques would be useful.
    """
    transcript_lower = transcript.lower()
    examples = []

    # Keywords that suggest certain techniques
    technique_keywords = {
        "particle-emitter": ["particle", "explosion", "burst", "radial", "scatter", "emit"],
        "glass-morphism": ["card", "container", "panel", "box", "glass", "blur", "overlay"],
        "flowing-river": ["flow", "stream", "river", "data", "continuous", "pipeline", "process"],
        "probability-gate": ["probability", "chance", "random", "dice", "spin", "lottery", "odds"],
        "scale-spring": ["appear", "pop", "enter", "show", "reveal", "intro"],
        "counter-animation": ["count", "number", "statistic", "metric", "percentage", "value"],
        "staggered-list": ["list", "item", "bullet", "point", "step", "sequence"],
    }

    for technique, keywords in technique_keywords.items():
        if any(kw in transcript_lower for kw in keywords):
            if technique in TECHNIQUE_CODE_EXAMPLES:
                examples.append(f"### {technique.replace('-', ' ').title()}\n```tsx{TECHNIQUE_CODE_EXAMPLES[technique]}\n```")

    # Always include basic patterns
    if "scale-spring" not in [e.split("\n")[0] for e in examples]:
        examples.append(f"### Scale Spring Entrance\n```tsx{TECHNIQUE_CODE_EXAMPLES['scale-spring']}\n```")

    if not examples:
        return ""

    return f"""
## CODE EXAMPLES - COPY THESE DIRECTLY

Based on your transcript content, these techniques are likely useful:

{chr(10).join(examples)}

**IMPORTANT**: Copy these implementations directly. Do NOT simplify them.
"""


# =============================================================================
# System Prompt and User Message Templates
# =============================================================================


SYSTEM_PROMPT = """
<role>
You are an EXPLAINER VIDEO specialist creating TECH and FINANCE content for Instagram/TikTok.
Your videos make complex concepts crystal clear through visual storytelling.
Your output must be production-quality TypeScript/React code that compiles without errors AND explains beautifully.
</role>

<storytelling_philosophy>
You are a VISUAL STORYTELLER, not a slideshow maker. Your #1 goal is making viewers UNDERSTAND through visuals.

**THE GOLDEN RULE: SHOW, DON'T TELL**
- BAD: Text says "Data flows through the system"
- GOOD: Animated particles visually flow from left to right through a pipe
- BAD: Text says "Memory fills up"
- GOOD: A container visually fills with blocks until it overflows

**VISUAL TRANSFORMATIONS (CRITICAL)**
Elements should MORPH and TRANSFORM, not just appear/disappear:
- Chaos → Order (scattered items organize themselves)
- Small → Large (element grows to show importance)
- Many → One (multiple items merge into single solution)
- Broken → Fixed (cracked element repairs itself)

**CAUSALITY - One Thing Leads to Another**
Every scene must visually CAUSE the next:
- Problem scene ends with visual tension (shaking, red glow, overflow)
- That SAME element transforms into the solution
- Don't cut to a new scene - TRANSITION the existing elements

**EMOTIONAL BEATS**
- TENSION: Elements shake, turn red, overflow, crack
- RELEASE: Tension element transforms, calms, turns green
- SATISFACTION: Celebration particles, checkmark, glow pulse
</storytelling_philosophy>

<show_dont_tell>
**BANNED: Text-as-explanation**
Never use text to explain concepts. Text is ONLY for:
- Short labels (2-3 words max): "Winner", "1/N", "O(1)"
- Single question hooks: "How?"

**REQUIRED: Visual demonstrations**
Every concept needs a VISUAL that demonstrates it:

| Concept | BAD (text) | GOOD (visual) |
|---------|-----------|---------------|
| "Data streams in" | Text label | Particles flowing left→right |
| "Memory overflows" | "Out of memory!" text | Container fills, cracks, explodes |
| "Random selection" | "Pick random(1,N)" | Spotlight sweeps across items, lands on one |
| "Equal probability" | "1/N for everyone" | N boxes, each lights up equally |
| "Efficient" | "O(1) memory" | Single small box vs huge pile |

**THE TEST**: Mute the video. Can you understand the concept from visuals alone?
If NO, you're relying too much on text. Redesign the visual.
</show_dont_tell>

<visual_continuity>
**PERSISTENT ELEMENTS**
The SAME visual element should persist across scenes and transform:
- Scene 1: River of particles (data stream)
- Scene 2: SAME river, but now showing items being selected
- Scene 3: SAME river, but now one item glows (the winner)

**NEVER:**
- Cut to completely new visuals between scenes
- Show disconnected concepts without visual links
- Reset the visual state between acts

**TRANSITIONS = TRANSFORMATIONS**
When moving between scenes:
- Element A morphs INTO element B (scale, color, shape change)
- Use spring animations for organic feel
- The "problem" visual becomes the "solution" visual
</visual_continuity>

<concrete_metaphors>
**Use TANGIBLE real-world metaphors:**

| Abstract Concept | Concrete Metaphor |
|-----------------|-------------------|
| Data stream | River of glowing particles flowing |
| Memory/Storage | Physical container/bucket that fills |
| Random selection | Spotlight/laser sweeping and landing |
| Probability | Dice rolling, wheel spinning, coin flipping |
| Algorithm steps | Assembly line / conveyor belt |
| Comparison | Side-by-side scales / before-after split |
| Growth | Plant growing / balloon inflating |
| Efficiency | Small box vs large pile |

**ANIMATE THE METAPHOR:**
Don't just show a static bucket - show items FALLING INTO IT, it FILLING UP, potentially OVERFLOWING.
The animation IS the explanation.
</concrete_metaphors>

<emotional_arc>
**Structure your video as an emotional journey:**

**ACT 1: CURIOSITY (0-10%)**
- Show something intriguing/impossible
- Visual: Counter going crazy, items flooding in
- Emotion: "Whoa, how does that work?"

**ACT 2: TENSION (10-30%)**
- Show the problem getting worse
- Visual: Container overflowing, system crashing, red warnings
- Emotion: "This is broken! What do we do?"

**ACT 3: REVELATION (30-50%)**
- The "aha!" moment - show the elegant insight
- Visual: Chaos TRANSFORMS into order (same elements, new arrangement)
- Emotion: "Oh! That's clever!"

**ACT 4: UNDERSTANDING (50-80%)**
- Walk through the mechanism step by step
- Visual: Slow-motion replay showing exactly how it works
- Emotion: "Now I get it!"

**ACT 5: SATISFACTION (80-100%)**
- Show it working at scale
- Visual: Massive numbers, everything smooth, celebration
- Emotion: "That's beautiful!"
</emotional_arc>

<layout_rules>
**1080x1920 VERTICAL format:**
- Top zone (y: 200-500): Minimal text labels only
- Center zone (y: 500-1400): THE VISUAL STORY (this is 90% of your content)
- Bottom zone (y: 1400-1700): Supporting info
- Side margins: 60px minimum
</layout_rules>

<workspace>
Working directory: {workspace_dir}
Output files:
- src/{project_id}/constants.ts (colors, timing, spring configs, typography)
- src/{project_id}/index.tsx (main composition with all scenes)
- src/{project_id}/metadata.json (composition metadata)
</workspace>

<remotion_libraries>
You have access to these official Remotion packages (already installed):
- @remotion/shapes: Pie, Star, Triangle, Circle, Rect, Polygon
- @remotion/noise: noise2D, noise3D for organic motion
- @remotion/paths: getLength, getPointAtLength, evolvePath for SVG animation
- @remotion/animated-emoji: AnimatedEmoji component
- @remotion/transitions: TransitionSeries, slide, fade, wipe

USE THESE for advanced effects. Import them in your code.
</remotion_libraries>

<three_js_3d>
**3D Animation with Three.js**

You have full Three.js support for complex 3D animations (rolling dice, 3D objects, etc.).

PRE-INSTALLED PACKAGES:
- @remotion/three: Remotion integration, provides ThreeCanvas
- @react-three/fiber: React renderer for Three.js
- @react-three/drei: Helpers (Box, Sphere, Text3D, RoundedBox, useGLTF, etc.)
- three: Core Three.js library

CRITICAL RULES:
1. Use ThreeCanvas from @remotion/three (NOT Canvas from @react-three/fiber)
2. Use useCurrentFrame() for animation timing (NOT useFrame hook)
3. Animations must be deterministic/frame-based for video rendering

EXAMPLE - Rotating 3D Cube:
```tsx
import {{ ThreeCanvas }} from '@remotion/three';
import {{ useCurrentFrame }} from 'remotion';

const My3DScene: React.FC = () => {{
  const frame = useCurrentFrame();
  const rotation = frame * 0.05;

  return (
    <ThreeCanvas>
      <ambientLight intensity={{0.5}} />
      <pointLight position={{[10, 10, 10]}} />
      <mesh rotation={{[rotation, rotation, 0]}}>
        <boxGeometry args={{[2, 2, 2]}} />
        <meshStandardMaterial color="#ff6600" />
      </mesh>
    </ThreeCanvas>
  );
}};
```

EXAMPLE - Rolling Dice with Spring:
```tsx
import {{ ThreeCanvas }} from '@remotion/three';
import {{ useCurrentFrame, spring }} from 'remotion';
import {{ RoundedBox }} from '@react-three/drei';

const RollingDice: React.FC = () => {{
  const frame = useCurrentFrame();
  const rotX = spring({{ frame, fps: 30, from: 0, to: Math.PI * 4 }});
  const rotZ = spring({{ frame, fps: 30, from: 0, to: Math.PI * 2.5 }});

  return (
    <ThreeCanvas>
      <ambientLight intensity={{0.4}} />
      <directionalLight position={{[5, 5, 5]}} />
      <RoundedBox args={{[1, 1, 1]}} radius={{0.1}} rotation={{[rotX, 0, rotZ]}}>
        <meshStandardMaterial color="white" />
      </RoundedBox>
    </ThreeCanvas>
  );
}};
```
</three_js_3d>


<assets_and_visuals>
## PREMIUM ASSET LIBRARIES — FREEPIK + ICONIFY

<MANDATORY_ASSET_RULE>
**YOU MUST DOWNLOAD AND USE PROFESSIONAL ASSETS. DO NOT HAND-CODE SVG ICONS.**

❌ DO NOT search for icons and then write your own SVG instead
❌ DO NOT skip the download step "for speed" or "more control"
❌ DO NOT write SVG paths by hand when Freepik or Iconify has the icon
❌ DO NOT rationalize skipping downloads — this is a HARD REQUIREMENT

✅ Search → Download/Get → Read SVG → Paste into JSX → Animate
✅ EVERY icon in your scene MUST come from Freepik or Iconify
✅ The ONLY exception is if the download/get tool itself errors/fails
</MANDATORY_ASSET_RULE>

You have TWO asset libraries. Your visuals should look like they came from a
professional motion design studio, not a coding tutorial.

### DUAL ASSET SOURCES

1. **Freepik** (premium icons, illustrations, vectors, photos)
   - Best for: premium illustrations, complex vectors, photos, branded assets
   - Tools: `search_icons` → `download_icon_by_id`, `search_resources` → `download_resource_by_id`

2. **Iconify / better-icons** (200k+ open-source icons from 150+ collections)
   - Best for: clean UI-style icons, consistent icon sets (Lucide, Material, Heroicons, Tabler, Phosphor)
   - **BEST for company/brand logos**: `simple-icons:*` has 3000+ brand logos (claude, google, apple, spotify, etc.), `logos:*` has full-color variants
   - Tools: `search_icons`, `get_icon`, `recommend_icons`, `find_similar_icons`
   - Icon ID format: `prefix:name` (e.g., `lucide:home`, `mdi:chart-bar`, `simple-icons:claude`)

### DECISION FRAMEWORK — What to use when

| Visual Need | Tool | Remotion Usage |
|------------|------|----------------|
| Hero/featured icons (main visual focus) | Freepik `search_icons` → `download_icon_by_id` (SVG) | Inline SVG in JSX, animate with spring — premium polish |
| Polished concept visuals (AI, cloud, growth) | Freepik `search_icons` → `download_icon_by_id` (SVG) | Inline SVG — professional quality, unique designs |
| Premium illustrations (isometric, 3D) | Freepik `search_resources` → `download_resource_by_id` | `<Img src={{{{staticFile('assets/...')}}}} />` |
| UI/supporting icons (arrows, chevrons, checkmarks) | Iconify `search_icons` → `get_icon` | Inline SVG in JSX — consistent sets, clean stroke/fill |
| Multiple matching icons from one set | Iconify (pick a prefix like `lucide:`) | Inline SVG — collections ensure consistency |
| Real-world product/app screenshots | `mcp__assets__screenshot` | `<Img>` with zoom/pan/highlight animations |
| Stock photos (people, places, concepts) | `search_unsplash`/`search_pexels` → `download_stock_photo` | `<Img>` with Ken Burns, overlays, masks |
| Data visualizations (charts, graphs) | Hand-coded SVG + Remotion animation | Needs dynamic values, animation |
| Flowcharts / process diagrams | Hand-coded SVG with Iconify/Freepik icons as nodes | Best of both — structure + polish |
| Company logos / branding | **Iconify FIRST**: `search_icons` ("claude", "google") → `get_icon` (has `simple-icons:*`, `logos:*` with accurate brand marks). Freepik fallback only if Iconify has 0 results. | Inline SVG — NEVER hand-draw a logo |
| Code snippets / terminal | Hand-coded with syntax highlighting | Typed-in animation |

**RULE: Use BOTH icon sources in every generation. Freepik for hero visuals, featured icons, and illustrations. Iconify for supporting UI icons and consistent icon sets. Use screenshots for websites/apps. Use stock photos for real-world subjects. Only hand-code SVGs for dynamic data.**

**MINIMUM USAGE: Every generation MUST use at least one Freepik asset (icon or illustration). Iconify supplements with clean UI icons. Do NOT use only one source — the whole point is leveraging both libraries.**

### HOW TO SEARCH EFFECTIVELY

**Freepik (search FIRST for hero/featured visuals):**
- `search_icons` with `term` parameter: "cloud computing", "server rack", "neural network"
- Filter by shape: "fill" for solid icons, "outline" for line icons
- Filter by icon_type: ["standard"] for static, ["animated"] for motion
- `search_resources` with `term` and content_type filter: {{ content_type: {{ vector: 1 }} }}
- Prefer vectors over photos — cleaner scaling, transparent backgrounds
- Try 2-3 search terms if the first doesn't match

**Iconify (better-icons — for UI icons AND company logos):**
- `search_icons` with query: "arrow right", "chart bar", "cloud server"
- Search CONCEPTS, not literal descriptions
- Get SVG: `get_icon` with icon ID like "lucide:arrow-right" returns SVG markup directly
- Popular prefixes: lucide, mdi, heroicons, tabler, ph (phosphor)
- **Brand/company logos**: Search the company name directly (e.g., "claude", "google", "spotify"). Uses `simple-icons:*` (3000+ brands) and `logos:*` collections. This is MORE RELIABLE than Freepik for company logos.
- Use `find_similar_icons` to explore variations across collections
- Use `recommend_icons` when unsure which icon fits a concept

### HOW TO USE DOWNLOADED ASSETS

**Iconify icons — inline in JSX:**
1. `get_icon` with icon ID (e.g., "lucide:zap") → returns SVG markup
2. Paste the SVG markup directly into your JSX component
3. Replace hardcoded width/height with style prop: `style={{{{ width: minDim * 0.08, height: minDim * 0.08 }}}}`
4. Use `currentColor` for dynamic coloring: wrap in div with `color: COLORS.accent`
5. Animate the wrapper with spring/interpolate

**Freepik icons (SVG) — download then inline:**
1. `download_icon_by_id` with id and format="svg" → returns {{ data: {{ url, filename }} }}
2. `mcp__assets__download_file` with the url and filename="icon-name.svg"
3. Read the SVG file content with the Read tool
4. Paste the SVG markup directly into your JSX component
5. Replace hardcoded width/height with style prop
6. Use `currentColor` for dynamic coloring
7. Animate the wrapper with spring/interpolate

**Resources (images/illustrations) — use staticFile:**
1. `download_resource_by_id` with resource-id → returns {{ data: {{ url, filename }} }}
2. `mcp__assets__download_file` with the url and filename="illustration.png"
3. In component: `<Img src={{staticFile('assets/illustration.png')}} style={{...}} />`
4. Import Img from remotion: `import {{ Img, staticFile }} from 'remotion';`
5. Animate with opacity, scale, position transforms

### ANIMATION WITH ASSETS

Don't just place assets on screen statically. Make them come alive:
- **Icons**: spring scale-in, stroke draw-in effect, color transitions via interpolateColors
- **Illustrations**: parallax layers (foreground moves faster), reveal masks, zoom-and-pan
- **Stagger**: When multiple icons appear, stagger by 6-8 frames each (never all at once)

Example — animated icon entry:
```tsx
const iconScale = spring({{ frame: frame - delay, fps, config: {{ damping: 26, stiffness: 120 }} }});
const iconOpacity = interpolate(frame, [delay, delay + 15], [0, 1], {{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }});

<div style={{{{ opacity: iconOpacity, transform: `scale(${{iconScale}})`, color: COLORS.accent }}}}>
  <svg viewBox="0 0 24 24" style={{{{ width: minDim * 0.08, height: minDim * 0.08 }}}}>
    {{/* SVG paths from Iconify or Freepik download */}}
  </svg>
</div>
```

### GUARDRAILS

- **ASSET BUDGET**: 1-3 icons per scene, 0-1 illustration per scene. Don't clutter.
- **SEARCH BUDGET**: 1-2 searches per concept max. Don't spend 10 turns browsing.
- **STYLE CONSISTENCY**: Pick ONE icon style (fill OR outline) in the FIRST scene and use it for ALL scenes. If using Iconify, stick to ONE prefix (e.g., all `lucide:` or all `tabler:`). Match icon colors to the style preset's color scheme.
- **FALLBACK**: ONLY if the download/get tool returns an error or search returns zero results after 2-3 different search terms, hand-code a clean SVG.
- **NEVER HAND-DRAW LOGOS**: Company logos (YouTube, Google, Apple, Claude, Spotify, etc.) must ALWAYS come from Iconify's `simple-icons:*` or `logos:*` collections first (`mcp__better-icons__search_icons` → `mcp__better-icons__get_icon`). These are the official brand SVGs — pixel-perfect and accurate. Only fall back to Freepik if Iconify returns 0 results for that brand. Hand-drawn logos look amateur and are often inaccurate.
- **NO PHOTO BACKGROUNDS**: Photos behind animated elements create visual noise. Use solid colors or subtle gradients.
- **NO EXTERNAL IMAGE URLS**: NEVER use `<Img src="https://icons8.com/...">` or any remote URL for icons/images. External URLs fail during rendering (CORS, rate limits, downtime) and crash the entire export. Always download assets first, then use `staticFile()` or inline SVG.
- **FIRST SCENE SETS THE STYLE**: Whatever asset family/style you pick in scene 1, ALL subsequent scenes must match.
- **ASSET DIRECTORY**: The `mcp__assets__download_file` tool automatically creates `public/assets/` — no need to mkdir manually.

### WEBSITE SCREENSHOTS

Use screenshots when the transcript references a specific website, app UI, dashboard, or tool.

**Workflow:**
1. mcp__assets__screenshot with url, filename, optional width/height
2. In composition: `<Img src={{{{staticFile('assets/screenshot.png')}}}} style={{{{...}}}} />`

**Animation patterns for screenshots:**
- **Browser frame mockup**: Wrap screenshot in a rounded-corner container with a fake
  address bar to make it look like a browser window
- **Zoom-to-region**: Start with the full page, then use scale + translate to zoom
  into a specific area the narrator is discussing
- **Scroll reveal**: Use translateY animation to simulate scrolling down a page
- **Highlight overlay**: Overlay a semi-transparent colored box that pulses to draw
  attention to a specific UI element

**Example — screenshot with browser chrome + zoom:**
```tsx
const zoomProgress = interpolate(frame, [30, 90], [1, 2.5], {{{{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}}});
const panX = interpolate(frame, [30, 90], [0, -200], {{{{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}}});
const panY = interpolate(frame, [30, 90], [0, -150], {{{{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}}});

<div style={{{{
  borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
}}}}>
  {{{{/* Browser chrome bar */}}}}
  <div style={{{{ height: 32, background: '#1e1e2e', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6 }}}}>
    <div style={{{{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }}}} />
    <div style={{{{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }}}} />
    <div style={{{{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }}}} />
  </div>
  {{{{/* Screenshot with zoom */}}}}
  <div style={{{{ overflow: 'hidden' }}}}>
    <Img
      src={{{{staticFile('assets/website-screenshot.png')}}}}
      style={{{{
        width: '100%', display: 'block',
        transform: `scale(${{{{zoomProgress}}}}) translate(${{{{panX}}}}px, ${{{{panY}}}}px)`,
        transformOrigin: 'top left',
      }}}}
    />
  </div>
</div>
```

### STOCK PHOTOS (Unsplash + Pexels)

Use stock photos when the transcript discusses real-world concepts that benefit from
photographic imagery (people, nature, cities, objects, abstract textures).

**Workflow:**
1. mcp__assets__search_unsplash or mcp__assets__search_pexels with a descriptive query
2. Pick the best result from returned list
3. mcp__assets__download_stock_photo with the photo's download URL and filename
4. In composition: `<Img src={{{{staticFile('assets/photo.jpg')}}}} style={{{{...}}}} />`

**When to use photos vs illustrations:**
- Photos: Real-world subjects, emotional impact, establishing shots, hero backgrounds
- Illustrations/vectors: Abstract concepts, diagrams, icons, technical content

**Animation patterns for photos:**
- **Ken Burns**: Slow zoom + pan creates cinematic motion from a still image
- **Parallax layers**: Photo as background, animated elements in foreground
- **Color overlay**: Semi-transparent gradient over photo to match color palette
- **Mask reveal**: Clip-path or opacity mask that reveals the photo progressively
- **Split comparison**: Two photos side by side with a sliding divider

**Example — Ken Burns effect:**
```tsx
const zoom = interpolate(frame, [0, durationInFrames], [1, 1.15], {{{{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}}});
const panX = interpolate(frame, [0, durationInFrames], [0, -30], {{{{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}}});

<div style={{{{ overflow: 'hidden', borderRadius: 16, width: '80%', margin: '0 auto' }}}}>
  <Img
    src={{{{staticFile('assets/hero-photo.jpg')}}}}
    style={{{{
      width: '100%', display: 'block',
      transform: `scale(${{{{zoom}}}}) translateX(${{{{panX}}}}px)`,
    }}}}
  />
  {{{{/* Color overlay to match palette */}}}}
  <div style={{{{
    position: 'absolute', inset: 0,
    background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))',
  }}}} />
</div>
```

**STOCK PHOTO GUARDRAILS:**
- Max 1 photo per scene — photos dominate visual attention
- Always add a color overlay or vignette to match the scene's palette
- Never use raw unprocessed photos as full backgrounds — too visually noisy
- Prefer landscape-oriented photos for horizontal video, portrait for vertical

### OVERLAY MODE — SPATIAL AWARENESS

When implementing a scene with `displayMode: "overlay"`, you MUST:

1. Call `mcp__assets__get_speaker_grid` with the scene's startMs and endMs
2. The tool returns a 6x6 grid where 1 = speaker present, 0 = safe zone
3. Design your composition to place elements ONLY in safe (0) cells
4. Use TRANSPARENT backgrounds — no opaque fills, no solid color backgrounds
5. Think of overlay as floating annotations on top of the speaker

**Reading the grid:**
```
Grid:  0 0 0 0 1 1      <- speaker is on the right side
       0 0 0 1 1 1
       0 0 0 1 1 1      1-cell buffer around speaker = avoid column 3 too
       0 0 0 1 1 1
       0 0 0 0 1 1
       0 0 0 0 0 0

-> Safe: left half, bottom row
-> Place title text top-left, stats stacked on left, annotation arrows pointing toward speaker
```

**Rules:**
- Background MUST be `transparent` or `rgba(0,0,0,0)` — NEVER a solid color
- Place text, icons, charts in safe zones (0 cells) only
- Leave a 1-cell buffer around occupied cells for breathing room
- Use opacity 0.8-0.9 on overlay elements — slightly see-through
- Prefer edges/corners away from the speaker
- If occupancy > 50%, use minimal floating annotations only (small labels, corner icons)
- If `get_speaker_grid` returns an error, design centered with generous margins on all sides

**Overlay uses full canvas dimensions** — the scene's `effectiveDimensions` will be the full
canvas size (same as fullscreen). Use these dimensions for positioning, but remember elements
must avoid the speaker's grid cells.
</assets_and_visuals>

<web_search>
You have access to WebSearch for researching unfamiliar topics.

**When to search:**
- Unfamiliar technical concepts in the transcript (algorithms, protocols, systems)
- Domain-specific terminology you don't fully understand
- Looking for visual metaphor inspiration for abstract concepts
- Remotion-specific patterns or APIs you're unsure about
- Current events or recent developments mentioned in content

**How to search effectively:**
- Use specific, targeted queries: "reservoir sampling algorithm visual explanation"
- For Remotion help: "remotion [specific feature] example"
- For visual inspiration: "[concept] infographic design" or "[concept] motion graphics"

**Example searches:**
- Transcript mentions "B-trees": search "B-tree data structure visual explanation"
- Transcript mentions "TCP handshake": search "TCP three-way handshake diagram"
- Unsure about spring physics: search "remotion spring animation examples"
- Need metaphor for "caching": search "caching visual metaphor infographic"

**DON'T search for:**
- Basic React/TypeScript syntax (you know this)
- Things already in this prompt (animation patterns, color theory)
- Every concept - only when genuinely stuck or unfamiliar
</web_search>

<svg_animation_patterns>
**1. Scale & Fade Entry:**
```tsx
const scale = spring({{ frame, fps, config: {{ damping: 26, stiffness: 120 }} }});
const opacity = interpolate(frame, [0, 15], [0, 1], {{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }});

<div style={{{{ opacity, transform: `scale(${{scale}})` }}}}>
  <svg>...</svg>
</div>
```

**2. Rotation:**
```tsx
const rotation = interpolate(frame, [0, 30], [0, 360]);
<svg style={{{{ transform: `rotate(${{rotation}}deg)` }}}}>...</svg>
```

**3. Stroke Draw-in Effect (for line icons):**
```tsx
const progress = spring({{ frame: frame - delay, fps, config: {{ damping: 30 }} }});
const strokeDashoffset = interpolate(progress, [0, 1], [100, 0]);

<svg>
  <path
    d="..."
    fill="none"
    stroke={{COLORS.accent}}
    strokeWidth={{2}}
    strokeDasharray={{100}}
    strokeDashoffset={{strokeDashoffset}}
  />
</svg>
```

**4. Color Transitions:**
```tsx
const color = interpolateColors(frame, [0, 30], [COLORS.muted, COLORS.accent]);
<svg style={{{{ color }}}}><path fill="currentColor" .../></svg>
```

**Rules:**
- Stagger icon animations by 6+ frames (never all at once)
- Use springs for natural motion, interpolate for linear effects
- Match strokeDasharray value to approximate path length for draw-in effect
</svg_animation_patterns>

<process>
1. PLAN (think thoroughly - this is where the magic happens):
   - What's the HOOK? How will frame 0-90 stop the scroll?
   - What VISUAL METAPHORS represent the concepts?
   - What COLOR PALETTE fits the mood? (Vibrant? Tech? Calm?)
   - How do scenes BUILD understanding progressively?
   - What ANIMATIONS will create "wow" moments?

2. WRITE:
   - Write constants.ts first with COLORS (gradient-ready), TYPOGRAPHY, TIMING, SPRING_CONFIG
   - Write index.tsx with hook scene first, then build from there
   - Use Sequence components for scene timing
   - Add animated backgrounds - NEVER plain colors

3. VALIDATE:
   - Run: npx tsc --noEmit --pretty false
   - Fix ALL errors before finishing
   - Re-run validation until clean
</process>

<animation_rules>
**Sequence + useCurrentFrame() Rule (CRITICAL):**
Inside a Sequence, useCurrentFrame() returns RELATIVE frames starting at 0.
NEVER subtract the Sequence's start time - frame is already relative!

**Transformation Animations (THE KEY TO GOOD STORYTELLING):**
```tsx
// GOOD: Element transforms from problem → solution
const problemScale = interpolate(frame, [0, 60], [1, 0], {{extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}});
const solutionScale = interpolate(frame, [60, 120], [0, 1], {{extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}});
// Problem shrinks as solution grows - VISUAL CAUSALITY

// BAD: Disconnected elements that just appear/disappear
{{frame < 60 && <ProblemElement />}}
{{frame >= 60 && <SolutionElement />}}  // No connection!
```

**Persistent Visual Elements:**
Create ONE main visual (e.g., a container, a stream of particles) that PERSISTS and TRANSFORMS:
```tsx
// The same "stream" element throughout, but its behavior changes
const StreamElement = () => {{
  const fillLevel = interpolate(frame, [0, 100, 200], [0, 1, 0.1]); // fills, then drains
  const color = frame < 150 ? COLORS.danger : COLORS.success; // red → green
  // Same element, different states = VISUAL STORY
}};
```

**Spring Configuration:**
  config: {{ damping: 26, stiffness: 120, mass: 1.0 }}

**Stagger Rule:**
  - Stagger by 6+ frames: startFrame + (index * 6)

**Interpolate Rule:**
  - ALWAYS use BOTH extrapolateLeft: 'clamp' AND extrapolateRight: 'clamp'

**React Keys Rule:**
  - EVERY array element needs a unique key prop

**Technical Rules:**
  - No overlapping elements
  - 60px minimum margins
  - MAX 3 animated elements at once
  - damping >= 20
</animation_rules>

<constraints>
- Resolution: {width}x{height}
- Duration: {duration_frames} frames at {fps} FPS
- Single file per type (no component splitting)
- MUST pass TypeScript validation
- MUST have animated backgrounds
- MUST have visual metaphors (not just text)
</constraints>

<quality_checklist>
Before declaring GENERATION COMPLETE, verify:

**STORYTELLING (MOST IMPORTANT):**
[ ] SHOW DON'T TELL: Can you understand the video on MUTE? If not, redesign.
[ ] VISUAL CONTINUITY: Same core visual element persists and transforms across scenes
[ ] TRANSFORMATION: Elements morph (problem→solution), not just appear/disappear
[ ] CAUSALITY: Each scene visually CAUSES the next (tension builds, then releases)
[ ] EMOTIONAL ARC: Curiosity → Tension → Revelation → Understanding → Satisfaction

**VISUAL METAPHORS:**
[ ] Every abstract concept has a CONCRETE visual metaphor
[ ] Metaphors are ANIMATED to demonstrate the concept (not just static icons)
[ ] Text is MINIMAL - only short labels, never explanations
[ ] The "mute test": Visuals alone tell the story

**CODE QUALITY:**
[ ] TypeScript compiles with no errors
[ ] All array children have unique key props
[ ] All spring configs use damping >= 20
[ ] All interpolate() calls have BOTH extrapolateLeft: 'clamp' AND extrapolateRight: 'clamp'
[ ] Inside Sequence, useCurrentFrame() used directly (no subtraction)

**LAYOUT:**
[ ] Main visuals in center zone (y: 500-1400)
[ ] 60px minimum margins
[ ] No overlapping elements
[ ] MAX 3 animated elements at once
</quality_checklist>
"""


USER_MESSAGE = """
## PROJECT: {project_id}

## VIDEO SPECS
- Resolution: {width}x{height}
- Duration: {duration_frames} frames ({duration_seconds}s)
- FPS: {fps}

## TRANSCRIPT
{transcript}

## YOUR TASK
Create a VISUAL STORY that explains the transcript's concept. The video should be understandable ON MUTE.

### THE MUTE TEST (MOST IMPORTANT)
Ask yourself: "If I watch this with sound off, do I understand the concept?"
- If YES: Good visual storytelling
- If NO: You're relying too much on text. REDESIGN.

### SHOW, DON'T TELL
**BANNED:** Using text to explain concepts
**REQUIRED:** Using animated visuals to DEMONSTRATE concepts

| Instead of this text... | Show this visual... |
|------------------------|---------------------|
| "Data streams in" | Particles flowing left→right |
| "Memory fills up" | Container filling with blocks, then overflowing |
| "Random selection" | Spotlight sweeping across items, landing on one |
| "1/N probability" | N items, one lights up randomly |
| "Algorithm runs" | Assembly line moving items through stages |

### VISUAL CONTINUITY (CRITICAL)
Create ONE persistent visual element that TRANSFORMS across the video:

**GOOD Example - Data Stream Story:**
- Hook: River of particles flooding in (overwhelming)
- Problem: River overflows a tiny bucket (can't store all)
- Insight: Single glowing particle captured in bucket (one variable!)
- Mechanism: Each new particle has chance to replace the one in bucket
- Payoff: River processed, bucket glows with fair winner

**The SAME visual (river + bucket) transforms throughout. Viewer follows one story.**

**BAD Example - Disconnected Slides:**
- Hook: Counter numbers
- Problem: Grid of boxes
- Insight: Text saying "one variable"
- Mechanism: Formula on screen
- Payoff: Checkmark

**Each scene is unrelated. Feels like a slideshow, not a story.**

### TRANSFORMATION ANIMATIONS
Elements should MORPH, not just appear/disappear:

```tsx
// GOOD: Container fills, then cracks, then explodes into particles
const fillProgress = interpolate(frame, [0, 60], [0, 1]);  // fills
const crackOpacity = interpolate(frame, [60, 80], [0, 1]); // crack appears
const explodeProgress = spring({{frame: frame - 90, fps}}); // explodes

// BAD: Just show different things
{{frame < 60 && <FilledBox />}}
{{frame >= 60 && <ExplodedParticles />}}  // No transformation!
```

### EMOTIONAL ARC
Structure your video emotionally:

**ACT 1: CURIOSITY (0-10%)**
Visual: Something intriguing - counter going crazy, items flooding
Emotion: "Whoa, what's happening?"

**ACT 2: TENSION (10-30%)**
Visual: Problem gets worse - overflow, cracks, red warnings, shaking
Emotion: "This is broken! How do we fix this?"

**ACT 3: REVELATION (30-50%)**
Visual: SAME problematic element TRANSFORMS - chaos becomes order
Emotion: "Oh! That's clever!"
**KEY: Don't cut to new visuals. Transform the existing ones.**

**ACT 4: UNDERSTANDING (50-80%)**
Visual: Slow-motion replay showing mechanism step by step
Emotion: "Now I get exactly how it works."

**ACT 5: SATISFACTION (80-100%)**
Visual: Massive scale, smooth operation, celebration particles
Emotion: "That's beautiful. I learned something."

### CONCRETE METAPHORS
Use TANGIBLE real-world objects:
- Data stream → River of glowing particles
- Storage → Physical bucket/container
- Selection → Spotlight/laser beam
- Probability → Dice rolling, wheel spinning
- Efficiency → Small box vs huge pile (side by side)

### TECHNICAL REQUIREMENTS
- Sequence frames are RELATIVE: useCurrentFrame() returns 0 at Sequence start
- Spring config: {{ damping: 26, stiffness: 120, mass: 1.0 }}
- All interpolate() need BOTH extrapolateLeft: 'clamp' AND extrapolateRight: 'clamp'
- All array children need unique key props
- 60px margins, no overlapping elements
- MAX 3 animated elements visible at once

### OUTPUT FILES (EXACTLY these paths and IDs):
- src/{project_id}/constants.ts
- src/{project_id}/index.tsx
- src/{project_id}/metadata.json

### CRITICAL - Exports Structure:
Your index.tsx MUST have this exact export structure:
```tsx
// MainComposition is the actual video content (scenes, animations, etc.)
const MainComposition: React.FC = () => {{
  return (
    <AbsoluteFill>
      {{/* Your scenes here */}}
    </AbsoluteFill>
  );
}};

// RemotionRoot registers the composition (for Remotion Studio)
export const RemotionRoot: React.FC = () => {{
  return (
    <Composition
      id="{composition_id}"
      component={{MainComposition}}
      durationInFrames={{{duration_frames}}}
      fps={{{fps}}}
      width={{{width}}}
      height={{{height}}}
    />
  );
}};

// CRITICAL: Export MainComposition as default (NOT RemotionRoot!)
// The frontend player needs the actual video component, not the registration wrapper
export default MainComposition;

// NOTE: Do NOT call registerRoot here - the workspace index.ts handles registration
```

### CRITICAL - metadata.json:
After creating the code, write this file:
```json
{{
  "compositionId": "{composition_id}",
  "durationInFrames": {duration_frames},
  "fps": {fps},
  "width": {width},
  "height": {height},
  "visuals": [
    {{"startMs": 0, "endMs": {duration_seconds}000, "type": "generated", "description": "AI-generated visual"}}
  ]
}}
```

### FINAL CHECK:
When TypeScript validation passes and all 3 files exist, respond with:
"GENERATION COMPLETE"
- Hook technique used: [describe]
- Visual metaphors: [list them]
- Color palette: [name]
- Remotion libraries used: [list them]
"""


# =============================================================================
# Security Settings (Reference: Auto-Claude apps/backend/core/client.py)
# =============================================================================


def create_security_settings(workspace_path: str) -> dict:
    """
    Create security settings for Claude Agent SDK.

    Reference: Auto-Claude apps/backend/core/client.py lines 603-654
    """
    return {
        "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True},
        "permissions": {
            "defaultMode": "acceptEdits",
            "allow": [
                # Allow all file operations within workspace
                "Read(./**)",
                "Write(./**)",
                "Edit(./**)",
                "Glob(./**)",
                "Grep(./**)",
                # Also allow absolute paths
                f"Read({workspace_path}/**)",
                f"Write({workspace_path}/**)",
                f"Edit({workspace_path}/**)",
                f"Glob({workspace_path}/**)",
                f"Grep({workspace_path}/**)",
                # Allow bash for TypeScript validation
                "Bash(*)",
            ],
        },
    }


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

    def _build_system_prompt(
        self,
        width: int,
        height: int,
        fps: int,
        duration_frames: int,
    ) -> str:
        """Build the system prompt with workspace context."""
        return SYSTEM_PROMPT.format(
            workspace_dir=str(self.workspace),
            project_id=self.project_id,
            width=width,
            height=height,
            fps=fps,
            duration_frames=duration_frames,
        )

    def _build_user_message(
        self,
        transcript: str,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
    ) -> str:
        """Build the user message with transcript, specs, and injected skills/examples."""
        duration_seconds = duration_frames / fps

        # Get all guides and examples to inject directly
        # (Agents don't reliably read skill files, so we inject everything)
        instagram_guide = get_instagram_design_guide()
        remotion_libraries = get_remotion_libraries_guide()
        condensed_skills = get_condensed_skills()
        technique_examples = extract_technique_examples(transcript)

        # Composition ID must use dashes (Remotion requirement), folder uses underscores
        composition_id = self.project_id.replace("_", "-")

        base_message = USER_MESSAGE.format(
            project_id=self.project_id,
            composition_id=composition_id,
            width=width,
            height=height,
            duration_frames=duration_frames,
            duration_seconds=f"{duration_seconds:.1f}",
            fps=fps,
            transcript=transcript,
        )

        # Inject everything directly into prompt
        # Order: Design guide first (sets mindset), then libraries, then patterns, then task
        return f"{instagram_guide}\n\n{remotion_libraries}\n\n{condensed_skills}\n\n{technique_examples}\n\n{base_message}"

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

    def _validate_scene_plan(self, plan_data: dict, fps: int, total_frames: int) -> dict:
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

    def _copy_studio_templates(self) -> int:
        """Copy studio-theme templates from packages/templates into the workspace.

        Copies src/templates/{slug}/ dirs into workspace/src/.templates/{slug}/
        for any template whose meta.json tags include 'studio-theme'.

        Returns number of templates copied.
        """
        templates_pkg = Path(__file__).parent.parent.parent.parent / "templates" / "src" / "templates"
        if not templates_pkg.exists():
            print(f"[ClaudeGenerator] Templates package not found at {templates_pkg}")
            return 0

        target_dir = self.workspace / "src" / ".templates"
        if target_dir.exists():
            shutil.rmtree(target_dir)
        target_dir.mkdir(parents=True)

        copied = 0
        for template_dir in sorted(templates_pkg.iterdir()):
            if not template_dir.is_dir():
                continue
            meta_path = template_dir / "meta.json"
            if not meta_path.exists():
                continue
            try:
                with open(meta_path, encoding="utf-8") as f:
                    meta = json.load(f)
                if "studio-theme" not in meta.get("tags", []):
                    continue
            except (json.JSONDecodeError, KeyError):
                continue

            dest = target_dir / template_dir.name
            shutil.copytree(template_dir, dest, ignore=shutil.ignore_patterns("register.ts"))
            copied += 1

        # Copy shared utility files that templates depend on.
        # Templates import from ../../use-scale which resolves to workspace/src/
        # (two dirs up from src/.templates/{slug}/).
        templates_src = templates_pkg.parent  # packages/templates/src/
        src_dir = target_dir.parent  # workspace/src/
        for shared_file in ["use-scale.ts", "fonts.ts"]:
            src = templates_src / shared_file
            if src.exists():
                shutil.copy2(src, src_dir / shared_file)

        print(f"[ClaudeGenerator] Copied {copied} studio templates to {target_dir}")
        return copied

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
                    model="claude-sonnet-4-20250514",  # Use Sonnet for speed
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": "You are a TypeScript error fixer. Fix compilation errors quickly and precisely."
                    },
                    cwd=str(self.workspace),
                    max_turns=20,
                    max_thinking_tokens=3000,
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

Output PASS or FAIL with numbered issues.
"""

        try:
            client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model="claude-sonnet-4-20250514",
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": VISUAL_VERIFY_PROMPT,
                    },
                    cwd=str(self.workspace),
                    max_turns=5,
                    allowed_tools=["Read"],
                    permission_mode="bypassPermissions",
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            response_text = ""
            async with client:
                await client.query(user_msg)

                async for msg in client.receive_response():
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "TextBlock" and hasattr(block, "text"):
                                response_text += block.text
                            elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[VisualVerify{scene_num} Tool: {block.name}]", flush=True)

            # Parse response
            if "PASS" in response_text and "FAIL" not in response_text:
                return True, []

            # Extract numbered issues and acceptance criteria from FAIL response
            issues: list[str] = []
            acceptance_criteria: list[str] = []
            for line in response_text.split("\n"):
                stripped = line.strip()
                # Capture numbered issues (1. ..., 2) ...)
                m = re.match(r'^\d+[.)]\s+(.+)', stripped)
                if m:
                    issues.append(m.group(1))
                # Capture acceptance criteria checklist items (- [ ] ...)
                m2 = re.match(r'^-\s*\[[ x]\]\s+(.+)', stripped)
                if m2:
                    acceptance_criteria.append(m2.group(1))
            # Fallback: capture text after FAIL if no numbered issues parsed
            if not issues:
                fail_idx = response_text.find("FAIL")
                if fail_idx >= 0:
                    remaining = response_text[fail_idx + 4:].strip()
                    if remaining:
                        issues.append(remaining[:500])
            # Append acceptance criteria to issues so the fix agent receives them
            if acceptance_criteria:
                issues.append("ACCEPTANCE CRITERIA: " + " | ".join(acceptance_criteria))
            return False, issues

        except Exception as e:
            print(f"[ClaudeGenerator] Scene {scene_num} visual verify error: {e}")
            return True, []  # Non-blocking: don't fail pipeline on verify errors

    async def _verify_and_fix_scene(
        self,
        scene_num: int,
        scene_data: dict,
        plan_content: str,
        composition_id: str,
        style_preset: str = "modern",
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

            remotion_libraries = get_remotion_libraries_guide()

            try:
                fix_client = ClaudeSDKClient(
                    options=ClaudeAgentOptions(
                        model="claude-sonnet-4-20250514",
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
        style_preset: str = "modern",
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

    async def _run_assistant_director(
        self,
        formatted_transcript: str,
        style_preset: str = "modern",
    ) -> dict[str, Any]:
        """
        Phase 0: Run the Assistant Director agent to create a Creative Brief.

        The Assistant Director analyzes the transcript and produces a
        CREATIVE_BRIEF.md that classifies tone, selects color palette / fonts,
        recommends visual asset types per beat, and provides scene-structure
        hints for the downstream Director.

        This phase is non-blocking: if it fails, the pipeline continues
        without a brief (the Director can still function independently).

        Args:
            formatted_transcript: Transcript with word-level timestamps.
            style_preset: Visual style preset (minimal, modern, playful,
                          bold, classic, studio).

        Returns:
            dict with success status and brief file path (or error details).
        """
        from prompts.assistant_director import (
            ASSISTANT_DIRECTOR_SYSTEM_PROMPT,
            build_assistant_director_message,
        )

        print("[ClaudeGenerator] Phase 0: Assistant Director analyzing transcript...", flush=True)

        # Ensure src_dir exists before running Claude
        self.src_dir.mkdir(parents=True, exist_ok=True)

        assistant_director_message = build_assistant_director_message(
            transcript=formatted_transcript,
            style_preset=style_preset,
            output_dir=str(self.src_dir),
        )

        # Write restricted security settings — only allow writes within the
        # project directory (src_dir).
        ad_settings_dir = self.src_dir / ".claude"
        ad_settings_dir.mkdir(parents=True, exist_ok=True)
        ad_settings = {
            "permissions": {
                "defaultMode": "acceptEdits",
                "allow": [
                    "Write(./**)",
                ],
            },
        }
        with open(ad_settings_dir / "settings.local.json", "w", encoding="utf-8") as f:
            json.dump(ad_settings, f, indent=2)

        # Assistant Director uses Haiku for fast classification.
        # cwd is set to src_dir so Claude writes CREATIVE_BRIEF.md directly
        # in the project directory.
        client = ClaudeSDKClient(
            options=ClaudeAgentOptions(
                model="claude-haiku-4-5-20251001",
                system_prompt={
                    "type": "preset",
                    "preset": "claude_code",
                    "append": ASSISTANT_DIRECTOR_SYSTEM_PROMPT,
                },
                cwd=str(self.src_dir),
                max_turns=5,  # Quick classification — no iterating
                max_thinking_tokens=2000,
                allowed_tools=["Write"],
                permission_mode="bypassPermissions",
                cli_path=CLAUDE_CLI_PATH,
            )
        )

        response_text = ""
        tool_calls_made = []
        try:
            async with client:
                await client.query(assistant_director_message)
                print("[Assistant Director] Query sent, waiting for response...", flush=True)

                async for msg in client.receive_response():
                    msg_type = type(msg).__name__
                    print(f"[Assistant Director] Received message type: {msg_type}", flush=True)

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
                                print(f"\n[Assistant Director Tool: {block.name}]", flush=True)
                            elif block_type == "ToolResultBlock":
                                print("\n[Assistant Director Tool Result received]", flush=True)
                            elif block_type == "ThinkingBlock":
                                pass  # Extended thinking — no output needed
                            else:
                                print(f"\n[Assistant Director] Unknown block type: {block_type}", flush=True)
                    elif msg_type == "ErrorMessage":
                        print(f"[Assistant Director] ERROR: {msg}", flush=True)
                    elif msg_type == "StopMessage":
                        print("[Assistant Director] Stop reason received", flush=True)

        except Exception as e:
            safe_print(f"[Assistant Director] WARNING: Agent failed with error: {e}")
            return {
                "success": False,
                "error": f"Assistant Director agent error: {e}",
            }

        print(f"\n[ClaudeGenerator] Assistant Director made {len(tool_calls_made)} tool calls: {tool_calls_made}", flush=True)
        print("\n[ClaudeGenerator] Assistant Director completed", flush=True)

        # Verify CREATIVE_BRIEF.md was created
        creative_brief = self.src_dir / "CREATIVE_BRIEF.md"

        # Debug: List what files exist in the source directory
        print(f"[ClaudeGenerator] Checking for CREATIVE_BRIEF.md in: {self.src_dir}")
        if self.src_dir.exists():
            existing_files = list(self.src_dir.iterdir())
            print(f"[ClaudeGenerator] Files in src_dir: {[f.name for f in existing_files]}")

        # ── Fallback file recovery ──
        # Claude sometimes writes files to the wrong location (workspace root,
        # flattened path in filename, etc.). Search common wrong locations and
        # move them.
        if not creative_brief.exists():
            import shutil
            print("[ClaudeGenerator] CREATIVE_BRIEF.md not in expected location, searching for misplaced files...")

            search_locations = [
                # Workspace root
                self.workspace / "CREATIVE_BRIEF.md",
                # Workspace root with project prefix
                self.workspace / f"{self.project_id}_CREATIVE_BRIEF.md",
                # src/ root (one level up from project dir)
                self.workspace / "src" / "CREATIVE_BRIEF.md",
            ]

            for alt_brief in search_locations:
                if alt_brief.exists():
                    print(f"[ClaudeGenerator] Found misplaced CREATIVE_BRIEF.md at {alt_brief}, moving to {creative_brief}")
                    shutil.move(str(alt_brief), str(creative_brief))
                    break

            # Also search for any CREATIVE_BRIEF.md in the workspace root with any prefix
            if not creative_brief.exists():
                for f in self.workspace.glob("*CREATIVE_BRIEF.md"):
                    print(f"[ClaudeGenerator] Found misplaced brief file: {f}, moving to {creative_brief}")
                    shutil.move(str(f), str(creative_brief))
                    break

        if not creative_brief.exists():
            safe_print("[ClaudeGenerator] WARNING: Assistant Director did not create CREATIVE_BRIEF.md — pipeline will continue without it")
            return {
                "success": False,
                "error": f"Assistant Director did not create CREATIVE_BRIEF.md (expected at {creative_brief})",
            }

        brief_size = creative_brief.stat().st_size
        safe_print(f"[ClaudeGenerator] Creative Brief created successfully ({brief_size} bytes)")

        return {
            "success": True,
            "creativeBriefPath": str(creative_brief),
        }

    async def _run_director(
        self,
        formatted_transcript: str,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
        style_preset: str = "modern",
        layout_mode: str = "pip",
        style_guide: str | None = None,
        source_width: int | None = None,
        source_height: int | None = None,
        pip_width: int | None = None,
        pip_height: int | None = None,
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
            style_preset: Visual style preset (minimal, modern, playful, bold, classic, studio)
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
        )

        # For studio style: inject template catalog directly into the Director prompt
        # so it can plan scenes around available templates without needing to discover files
        if style_preset == "studio":
            catalog_path = self.workspace / "src" / "STUDIO_TEMPLATES.md"
            if catalog_path.exists():
                catalog_content = catalog_path.read_text(encoding="utf-8")
                director_message += f"\n\n{catalog_content}"
                safe_print(f"[ClaudeGenerator] Injected studio template catalog ({len(catalog_content)} chars) into Director prompt")
            else:
                safe_print("[ClaudeGenerator] WARNING: STUDIO_TEMPLATES.md not found, Director will plan without template catalog")

        # For kinetic-typography: log that style is active.
        # No special injection needed — Director and Animator prompts handle it.
        if style_preset == "kinetic-typography":
            safe_print("[ClaudeGenerator] Kinetic typography style active — Director will output text-card segments")

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

        # Director uses Sonnet for fast planning.
        # cwd is set to src_dir so Claude writes SCENE_PLAN.md and scenes.json
        # directly in the project directory — prevents misplaced files at workspace root.
        client = ClaudeSDKClient(
            options=ClaudeAgentOptions(
                model="claude-sonnet-4-20250514",
                system_prompt={
                    "type": "preset",
                    "preset": "claude_code",
                    "append": DIRECTOR_SYSTEM_PROMPT
                },
                cwd=str(self.src_dir),
                max_turns=50,  # Enough turns for research + planning + writing
                max_thinking_tokens=5000,
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
        validation = self._validate_scene_plan(plan_data, fps, duration_frames)

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

    async def _run_animator(
        self,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
        style_preset: str = "modern",
    ) -> dict[str, Any]:
        """
        Phase 2: Run the Animator agent to implement the scene plan.

        The Animator reads SCENE_PLAN.md and scenes.json, then:
        - Creates TODO list for each scene
        - Implements each scene with reasoning logged
        - Validates against the plan
        - Outputs: constants.ts, index.tsx, metadata.json

        Args:
            width: Video width
            height: Video height
            duration_frames: Total frames
            fps: Frames per second

        Returns:
            dict with success status
        """
        from prompts.animator import ANIMATOR_SYSTEM_PROMPT, build_animator_user_message, get_studio_section

        print(f"[ClaudeGenerator] Phase 2: Animator implementing scenes...")

        # Get condensed skills and guides for Animator
        remotion_libraries = get_remotion_libraries_guide()
        condensed_skills = get_condensed_skills()

        # Build full system prompt with skills (+ studio design system only when studio preset)
        studio_section = get_studio_section(style_preset)
        full_system_prompt = f"{ANIMATOR_SYSTEM_PROMPT}{studio_section}\n\n{remotion_libraries}\n\n{condensed_skills}"

        # Inject user-provided assets summary so the AI knows about them immediately
        user_assets_path = self.src_dir / "user_assets.json"
        if user_assets_path.exists():
            try:
                user_assets_data = json.loads(user_assets_path.read_text(encoding="utf-8"))
                if user_assets_data.get("assets"):
                    asset_lines = []
                    for a in user_assets_data["assets"]:
                        asset_lines.append(f"- **{a['label']}**: `staticFile('{a['remotionPath']}')` ({a['contentType']})")
                    full_system_prompt += f"\n\n## USER-PROVIDED ASSETS\n\nThe user uploaded these custom assets. ALWAYS prefer them over Freepik/Iconify when they match.\n\n" + "\n".join(asset_lines)
                    print(f"[ClaudeGenerator] Injected {len(asset_lines)} user asset(s) into Animator system prompt")
            except Exception as e:
                print(f"[ClaudeGenerator] Warning: Failed to read user_assets.json: {e}")

        animator_message = build_animator_user_message(self.project_id, style_preset=style_preset)

        # Inject template catalog for studio preset
        if style_preset == "studio":
            catalog_path = self.workspace / "src" / "STUDIO_TEMPLATES.md"
            if catalog_path.exists():
                catalog_content = catalog_path.read_text(encoding="utf-8")
                animator_message += f"\n\n## AVAILABLE STUDIO TEMPLATES\n\n{catalog_content}"
                print(f"[ClaudeGenerator] Injected studio template catalog into Animator prompt")

        # Increase MCP initialization timeout: Freepik's remote MCP server
        # is network-dependent and can exceed the default 60s on Windows.
        prev_timeout = os.environ.get("CLAUDE_CODE_STREAM_CLOSE_TIMEOUT")
        os.environ["CLAUDE_CODE_STREAM_CLOSE_TIMEOUT"] = "120000"

        # Animator uses Opus for high-quality implementation
        # Use claude_code preset with append to preserve TodoWrite functionality
        client = ClaudeSDKClient(
            options=ClaudeAgentOptions(
                model=self.model,  # Use configured model (Opus)
                system_prompt={
                    "type": "preset",
                    "preset": "claude_code",
                    "append": full_system_prompt
                },
                cwd=str(self.workspace),
                max_turns=self.max_turns,
                max_thinking_tokens=self.max_thinking_tokens,
                max_buffer_size=10 * 1024 * 1024,
                enable_file_checkpointing=True,
                setting_sources=["project"],  # Load skills from .claude/skills/
                allowed_tools=[
                    "Read", "Write", "Edit", "Glob", "Grep", "Bash", "TodoWrite", "Skill",
                    # Freepik MCP tools (premium icons, illustrations, vectors)
                    "mcp__freepik__search_icons",
                    "mcp__freepik__get_icon_detail_by_id",
                    "mcp__freepik__download_icon_by_id",
                    "mcp__freepik__search_resources",
                    "mcp__freepik__get_resource_detail_by_id",
                    "mcp__freepik__download_resource_by_id",
                    # Iconify MCP tools (200k+ open-source icons via better-icons)
                    "mcp__better-icons__search_icons",
                    "mcp__better-icons__get_icon",
                    "mcp__better-icons__recommend_icons",
                    "mcp__better-icons__find_similar_icons",
                    # Asset download tools (download files, screenshots, stock photos)
                    "mcp__assets__download_file",
                    "mcp__assets__screenshot",
                    "mcp__assets__search_unsplash",
                    "mcp__assets__search_pexels",
                    "mcp__assets__download_stock_photo",
                    # Speaker grid tool (spatial awareness for overlay scenes)
                    "mcp__assets__get_speaker_grid",
                    # Viewport dimension tools (per-scene effective dimensions)
                    "mcp__viewport__get_scene_dimensions",
                    "mcp__viewport__validate_scene_code",
                ],
                mcp_servers=build_mcp_servers(str(self.workspace)),
                permission_mode="bypassPermissions",
                hooks={
                    "PreToolUse": [
                        HookMatcher(matcher="Bash", hooks=[bash_security_hook]),
                    ],
                },
                cli_path=CLAUDE_CLI_PATH,
            )
        )

        response_text = ""
        try:
            async with client:
                await client.query(animator_message)

                async for msg in client.receive_response():
                    msg_type = type(msg).__name__
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
                                print(f"\n[Animator Tool: {block.name}]", flush=True)
        finally:
            # Restore original timeout
            if prev_timeout is not None:
                os.environ["CLAUDE_CODE_STREAM_CLOSE_TIMEOUT"] = prev_timeout
            else:
                os.environ.pop("CLAUDE_CODE_STREAM_CLOSE_TIMEOUT", None)

        print(f"\n[ClaudeGenerator] Animator completed")

        # Verify output files
        index_tsx = self.src_dir / "index.tsx"
        if not index_tsx.exists():
            return {
                "success": False,
                "error": "Animator did not create index.tsx",
            }

        # Check for implementation log (optional but expected)
        impl_log = self.src_dir / "IMPLEMENTATION_LOG.md"
        if impl_log.exists():
            print(f"[ClaudeGenerator] Implementation log created: {impl_log}")

        return {
            "success": True,
            "indexPath": str(index_tsx),
            "hasImplementationLog": impl_log.exists(),
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
"""

        try:
            client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model="claude-sonnet-4-20250514",
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": SCENE_VERIFY_PROMPT,
                    },
                    cwd=str(self.workspace),
                    max_turns=10,
                    allowed_tools=["Read", "Bash"],
                    permission_mode="bypassPermissions",
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            response_text = ""
            async with client:
                await client.query(user_msg)

                async for msg in client.receive_response():
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "TextBlock" and hasattr(block, "text"):
                                response_text += block.text
                            elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[SceneVerify Tool: {block.name}]", flush=True)

            # Parse response — look for PASS/FAIL as standalone verdict lines
            lines = response_text.split("\n")
            verdict = None
            fail_line_idx = -1
            for idx, line in enumerate(lines):
                stripped = line.strip().upper()
                if stripped == "PASS" or stripped.startswith("PASS:") or stripped.startswith("PASS.") or stripped.startswith("PASS -"):
                    verdict = "PASS"
                elif stripped == "FAIL" or stripped.startswith("FAIL:") or stripped.startswith("FAIL.") or stripped.startswith("FAIL -"):
                    verdict = "FAIL"
                    fail_line_idx = idx

            if verdict == "PASS":
                return True, []

            if verdict == "FAIL" and fail_line_idx >= 0:
                # Only extract numbered issues from lines AFTER the FAIL verdict
                issues: list[str] = []
                for line in lines[fail_line_idx + 1:]:
                    stripped = line.strip()
                    m = re.match(r'^\d+[.)]\s+(.+)', stripped)
                    if m:
                        issues.append(m.group(1))
                return False, issues

            # Ambiguous response — no clear PASS/FAIL verdict. Treat as pass
            # to avoid false-negative blocking on verbose but correct responses.
            return True, []

        except Exception as e:
            print(f"[ClaudeGenerator] Scene {scene_num} verify error: {e}")
            return True, []  # Don't block on verify failures

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

        passed, issues = await self._run_scene_verify(
            scene_num=scene_num,
            scene_data=scene_data,
            plan_description=scene_plan_content,
            display_mode=scene_data.get("displayMode", "default"),
            constants_content=constants_content,
        )

        if passed:
            print(f"[ClaudeGenerator] Scene {scene_num} passed verification")
            return True, []

        if not issues:
            return passed, []

        print(f"[ClaudeGenerator] Scene {scene_num} failed verification: {issues}")

        from prompts.animator import ANIMATOR_BASE_PROMPT

        # Targeted Sonnet fix agent
        feedback_msg = "\n".join(f"- {iss}" for iss in issues)
        fix_prompt = f"""Fix these issues in src/{self.project_id}/scenes/Scene{scene_num}.tsx:

{feedback_msg}

Read the scene file and fix the listed issues.
Do NOT modify constants.ts or other scene files.
Do NOT run tsc — TypeScript will be validated after all scenes are verified.
When done, respond: "FIX COMPLETE"
"""
        try:
            fix_client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model="claude-sonnet-4-20250514",
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
            passed2, issues2 = await self._run_scene_verify(
                scene_num=scene_num,
                scene_data=scene_data,
                plan_description=scene_plan_content,
                display_mode=scene_data.get("displayMode", "default"),
                constants_content=constants_content,
            )
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
"""

        try:
            client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model="claude-sonnet-4-20250514",
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": COMPOSITION_VERIFY_PROMPT,
                    },
                    cwd=str(self.workspace),
                    max_turns=15,
                    allowed_tools=["Read", "Bash", "Edit", "Glob"],
                    permission_mode="bypassPermissions",
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            response_text = ""
            async with client:
                await client.query(user_msg)

                async for msg in client.receive_response():
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "TextBlock" and hasattr(block, "text"):
                                response_text += block.text
                            elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[CompVerify Tool: {block.name}]", flush=True)

            # Parse response — look for PASS/ISSUES as standalone verdict lines
            lines = response_text.split("\n")
            verdict = None
            issues_line_idx = -1
            for idx, line in enumerate(lines):
                stripped = line.strip().upper()
                if stripped == "PASS" or stripped.startswith("PASS:") or stripped.startswith("PASS.") or stripped.startswith("PASS -"):
                    verdict = "PASS"
                elif stripped == "ISSUES" or stripped.startswith("ISSUES:") or stripped.startswith("ISSUES.") or stripped.startswith("ISSUES -"):
                    verdict = "ISSUES"
                    issues_line_idx = idx

            if verdict == "PASS":
                return True, []

            if verdict == "ISSUES" and issues_line_idx >= 0:
                issues: list[str] = []
                for line in lines[issues_line_idx + 1:]:
                    stripped = line.strip()
                    m = re.match(r'^\d+[.)]\s+(.+)', stripped)
                    if m:
                        issues.append(m.group(1))
                return False, issues

            # Ambiguous response — no clear verdict. Treat as pass.
            return True, []

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
import {{ COLORS, TIMING, OVERLAY_RANGES }} from './constants';
import {{ Background }} from './components/Background';
{scene_imports}

const MainComposition: React.FC = () => {{
  const frame = useCurrentFrame();
  // During overlay frames, skip Background so the composition is transparent.
  const isOverlay = OVERLAY_RANGES.some(([s, e]) => frame >= s && frame < e);

  return (
    <AbsoluteFill style={{isOverlay ? undefined : {{ backgroundColor: COLORS.background }}}}>
      {{!isOverlay && <Background key="bg" />}}
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
        style_preset: str = "modern",
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

        Falls back to monolithic _run_animator on critical failure.

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

        setup_exists = constants_path.exists() and constants_path.stat().st_size > 50
        all_scene_nums = set(range(1, total_scenes + 1))
        missing_scenes_set = all_scene_nums - existing_scenes

        if setup_exists and existing_scenes:
            print(f"[ClaudeGenerator] CHECKPOINT RESUME: Setup done, {len(existing_scenes)}/{total_scenes} scenes exist. Missing: {sorted(missing_scenes_set) or 'none'}")
        elif setup_exists:
            print(f"[ClaudeGenerator] CHECKPOINT RESUME: Setup done, no scenes yet")

        # Get remotion libraries and condensed skills (same as monolithic)
        remotion_libraries = get_remotion_libraries_guide()
        condensed_skills = get_condensed_skills()

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
            setup_system = f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{remotion_libraries}\n\n{condensed_skills}\n\n{ANIMATOR_SETUP_PROMPT}{user_assets_section}"
            setup_message = build_setup_user_message(self.project_id)

            # Inject template catalog for studio preset
            if style_preset == "studio":
                catalog_path = self.workspace / "src" / "STUDIO_TEMPLATES.md"
                if catalog_path.exists():
                    catalog_content = catalog_path.read_text(encoding="utf-8")
                    setup_message += f"\n\n## AVAILABLE STUDIO TEMPLATES\n\n{catalog_content}"
                    print(f"[ClaudeGenerator] Injected studio template catalog into Setup prompt")

            # Spawn setup agent (Sonnet for speed)
            setup_client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model="claude-sonnet-4-20250514",
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
                print("[ClaudeGenerator] Setup failed: constants.ts not created, falling back to monolithic")
                return await self._run_animator(
                    width=width, height=height,
                    duration_frames=duration_frames, fps=fps,
                    style_preset=style_preset,
                )

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
                    model="claude-sonnet-4-20250514",
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": "You are an animation coordinator. Your ONLY job is to dispatch scene-generator subagents via the Task tool in batches. You must NOT implement scenes yourself. Do NOT use Write, Edit, or any MCP tools. ONLY use the Task tool to delegate work. Dispatch each batch in a single response, then wait for all tasks in that batch to complete before starting the next batch.",
                    },
                    cwd=str(self.workspace),
                    max_turns=scenes_to_dispatch + num_batches * 2 + 4,
                    max_buffer_size=10 * 1024 * 1024,  # 10MB — subagent results can be large
                    permission_mode="bypassPermissions",
                    allowed_tools=["Bash", "Task"],
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
                # Inject template catalog for studio preset
                if style_preset == "studio":
                    catalog_path = self.workspace / "src" / "STUDIO_TEMPLATES.md"
                    if catalog_path.exists():
                        catalog_content = catalog_path.read_text(encoding="utf-8")
                        scene_user_msg += f"\n\n## AVAILABLE STUDIO TEMPLATES\n\n{catalog_content}"
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

        # Verify OVERLAY_RANGES matches overlay scenes
        overlay_scene_nums = [
            i + 1 for i, s in enumerate(scenes)
            if s.get("displayMode") == "overlay"
        ]
        if overlay_scene_nums and "OVERLAY_RANGES" not in constants_text:
            print(f"[ClaudeGenerator] WARNING: Overlay scenes {overlay_scene_nums} but no OVERLAY_RANGES in constants.ts")

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
        style_preset: str = "modern",
        layout_mode: str = "pip",
        style_guide: str | None = None,
        source_width: int | None = None,
        source_height: int | None = None,
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
            style_preset: Visual style preset (minimal, modern, playful, bold, classic, studio)
            layout_mode: Layout mode (pip, stacked)
            style_guide: Optional user-provided style/layout guidance
            source_width: Source video width (for coverage-tier display mode guidance)
            source_height: Source video height (for coverage-tier display mode guidance)

        Returns:
            dict with success status and bundle URL
        """
        from transcript_formatter import (
            format_transcript_for_director,
            format_transcript_with_key_moments,
        )

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

                    # Copy studio templates to workspace if using studio preset
                    if style_preset == "studio":
                        self._copy_studio_templates()

                    # Format transcript with timestamps if available
                    if words:
                        formatted_transcript = format_transcript_with_key_moments(words, fps)
                    else:
                        formatted_transcript = f"## TRANSCRIPT\n\n{transcript}"

                    # Phase 0: Assistant Director (creative brief)
                    emit_progress(16, "Assistant Director analyzing script...", {"phase": "plan", "phaseName": "Planning scenes"})
                    ad_result = await self._run_assistant_director(
                        formatted_transcript=formatted_transcript,
                        style_preset=style_preset,
                    )
                    if ad_result["success"]:
                        print(f"[ClaudeGenerator] Creative brief ready")
                        emit_progress(18, "Creative brief complete", {"phase": "plan", "phaseName": "Planning scenes"})
                    else:
                        print(f"[ClaudeGenerator] Assistant Director skipped: {ad_result.get('error', 'unknown')}")
                        emit_progress(18, "Proceeding without creative brief", {"phase": "plan", "phaseName": "Planning scenes"})

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

                    emit_progress(38, f"Animator implementing {scene_count} scenes...", {"phase": "animate", "phaseName": "Animating scenes", "totalScenes": scene_count})

                    # Phase 2: Animator — use sequential mode for multi-scene compositions
                    scenes_path_check = self.src_dir / "scenes.json"
                    try:
                        with open(scenes_path_check, "r", encoding="utf-8") as f:
                            sd = json.load(f)
                        sc = len(sd.get("scenes", []))
                    except Exception:
                        sc = 0

                    if sc >= 2:
                        try:
                            animator_result = await self._run_animator_sequential(
                                width=width, height=height,
                                duration_frames=duration_frames, fps=fps,
                                style_preset=style_preset,
                            )
                        except Exception as seq_err:
                            print(f"[ClaudeGenerator] Sequential animator failed: {seq_err}, falling back to monolithic")
                            animator_result = await self._run_animator(
                                width=width, height=height,
                                duration_frames=duration_frames, fps=fps,
                                style_preset=style_preset,
                            )
                    else:
                        animator_result = await self._run_animator(
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
    parser.add_argument("--style-preset", default="modern", help="Visual style preset (minimal, modern, playful, bold, classic, studio)")
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
    parser.add_argument("--phase", choices=["assistant-director", "director", "animator"], default=None,
                        help="Run only a specific phase (assistant-director, director, or animator). Default: all.")

    args = parser.parse_args()

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

    if args.phase == "assistant-director":
        # Phase 0 only: Run Assistant Director to create creative brief
        from transcript_formatter import format_transcript_with_key_moments

        print("[ClaudeGenerator] Running Assistant Director phase only")

        try:
            manager = get_token_manager()
            await manager.get_valid_token()
        except Exception as e:
            print(f"[ClaudeGenerator] WARNING: OAuth token refresh failed: {e}")

        generator.src_dir.mkdir(parents=True, exist_ok=True)

        if words:
            formatted = format_transcript_with_key_moments(words, args.fps)
        else:
            formatted = f"## TRANSCRIPT\n\n{transcript}"

        ad_result = await generator._run_assistant_director(
            formatted_transcript=formatted,
            style_preset=args.style_preset if hasattr(args, 'style_preset') else "modern",
        )
        result = {
            "success": ad_result["success"],
            "pipeline": "assistant-director-only",
            "briefPath": ad_result.get("creativeBriefPath"),
        }
        print(json.dumps(result, indent=2))
        return

    elif args.phase == "director":
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

        # Copy studio templates to workspace if using studio preset
        if args.style_preset == "studio":
            generator._copy_studio_templates()

        # Format transcript with timestamps if available
        if words:
            formatted_transcript = format_transcript_with_key_moments(words, args.fps)
        else:
            formatted_transcript = f"## TRANSCRIPT\n\n{transcript}"

        emit_progress(18, "Director planning scenes...", {"phase": "plan", "phaseName": "Planning scenes"})

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

        # Copy studio templates to workspace if using studio preset
        if args.style_preset == "studio":
            generator._copy_studio_templates()

        emit_progress(38, "Animator implementing scenes...", {"phase": "animate", "phaseName": "Animating scenes"})

        # Route based on scene count — sequential for multi-scene compositions
        try:
            with open(scenes_json_path, "r", encoding="utf-8") as f:
                sd = json.load(f)
            sc = len(sd.get("scenes", []))
        except Exception:
            sc = 0

        if sc >= 2:
            try:
                animator_result = await generator._run_animator_sequential(
                    width=args.width, height=args.height,
                    duration_frames=args.duration, fps=args.fps,
                    style_preset=args.style_preset,
                )
            except Exception as seq_err:
                print(f"[ClaudeGenerator] Sequential animator failed: {seq_err}, falling back to monolithic")
                animator_result = await generator._run_animator(
                    width=args.width, height=args.height,
                    duration_frames=args.duration, fps=args.fps,
                    style_preset=args.style_preset,
                )
        else:
            animator_result = await generator._run_animator(
                width=args.width, height=args.height,
                duration_frames=args.duration, fps=args.fps,
                style_preset=args.style_preset,
            )

        if not animator_result["success"]:
            print(json.dumps(animator_result, indent=2))
            sys.stdout.flush()
            sys.exit(1)

        emit_progress(55, "All scenes implemented", {"phase": "animate", "phaseName": "Animating scenes"})

        # Verify TypeScript with self-healing
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

        # Fix composition ID
        index_tsx = generator.src_dir / "index.tsx"
        composition_id_with_dashes = args.project_id.replace("_", "-")
        await generator._fix_composition_id(index_tsx, composition_id_with_dashes)

        # Bundle
        emit_progress(65, "Bundling Remotion project...", {"phase": "bundle", "phaseName": "Bundling for preview"})
        print("[ClaudeGenerator] Bundling project...")
        bundle_path = await generator._run_bundle()
        print(f"[ClaudeGenerator] Bundle complete: {bundle_path}")
        emit_progress(68, "Bundle complete", {"phase": "bundle", "phaseName": "Bundling for preview"})

        # Compile CJS
        emit_progress(69, "Compiling CJS module...", {"phase": "bundle", "phaseName": "Bundling for preview"})
        print("[ClaudeGenerator] Compiling CJS...")
        await generator._compile_cjs(bundle_path)

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
